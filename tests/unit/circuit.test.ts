import { describe, expect, it } from 'vitest';
import { describeIssue, evaluateCircuit, nodeDepths, validateCircuit } from '@/lib/logic/circuit';
import { circuitToExpr } from '@/lib/logic/convert';
import { evaluateExpr, parseExpression, toText } from '@/lib/logic/expression';
import { circuitTruthTable, outputColumn } from '@/lib/logic/truthTable';
import type { Circuit } from '@/lib/logic/types';

/** N p.36 peeling example: F = NOT((A + B) . C), drawn as OR → AND → NOT. */
const notesExample: Circuit = {
  nodes: [
    { kind: 'input', id: 'A', label: 'A' },
    { kind: 'input', id: 'B', label: 'B' },
    { kind: 'input', id: 'C', label: 'C' },
    { kind: 'gate', id: 'G1', gate: 'OR', inputs: ['A', 'B'] },
    { kind: 'gate', id: 'G2', gate: 'AND', inputs: ['G1', 'C'] },
    { kind: 'gate', id: 'G3', gate: 'NOT', inputs: ['G2'] },
    { kind: 'output', id: 'F', label: 'F', source: 'G3' },
  ],
};

describe('circuit evaluation', () => {
  it('evaluates intermediate signals in dependency order', () => {
    const r = evaluateCircuit(notesExample, { A: 1, B: 0, C: 1 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.values.G1).toBe(1);
    expect(r.values.G2).toBe(1);
    expect(r.outputs.F).toBe(0);
    expect(r.steps.map((s) => s.nodeId)).toEqual(['G1', 'G2', 'G3']);
    expect(r.steps[1]).toMatchObject({ gate: 'AND', inputValues: [1, 1], output: 1 });
  });

  it('is independent of the order nodes are declared in', () => {
    const shuffled: Circuit = { nodes: [...notesExample.nodes].reverse() };
    const a = circuitTruthTable(notesExample);
    const b = circuitTruthTable(shuffled, ['A', 'B', 'C']);
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) expect(outputColumn(b.table)).toEqual(outputColumn(a.table));
  });

  it('generates the truth table straight from the circuit', () => {
    const t = circuitTruthTable(notesExample);
    expect(t.ok).toBe(true);
    if (!t.ok) return;
    // (A+B).C is 1 for rows 011, 101, 111 → F = 0 there and 1 elsewhere.
    expect(outputColumn(t.table)).toEqual([1, 1, 1, 0, 1, 0, 1, 0]);
    expect(t.table.rows[0]).toMatchObject({ icn: 1, index: 0, inputs: [0, 0, 0] });
    expect(t.table.rows[7]?.gates.G1).toBe(1);
  });

  it('derives the expression of a circuit', () => {
    expect(toText(circuitToExpr(notesExample))).toBe("((A + B).C)'");
  });

  it('computes depths for layout', () => {
    expect(nodeDepths(notesExample)).toMatchObject({ A: 0, G1: 1, G2: 2, G3: 3, F: 4 });
  });
});

describe('circuit validation', () => {
  const codes = (c: Circuit) => validateCircuit(c).map((i) => i.code);

  it('accepts a valid circuit', () => {
    expect(validateCircuit(notesExample).filter((i) => i.severity === 'error')).toEqual([]);
  });

  it('reports missing inputs instead of guessing a value', () => {
    const c: Circuit = {
      nodes: [
        { kind: 'input', id: 'A', label: 'A' },
        { kind: 'gate', id: 'G1', gate: 'AND', inputs: ['A', null] },
        { kind: 'output', id: 'F', label: 'F', source: 'G1' },
      ],
    };
    expect(codes(c)).toContain('missing-input');
    expect(evaluateCircuit(c, { A: 1 }).ok).toBe(false);
  });

  it('reports wrong input counts', () => {
    const c: Circuit = {
      nodes: [
        { kind: 'input', id: 'A', label: 'A' },
        { kind: 'gate', id: 'G1', gate: 'NOT', inputs: ['A', 'A'] },
        { kind: 'gate', id: 'G2', gate: 'OR', inputs: ['A'] },
        { kind: 'output', id: 'F', label: 'F', source: 'G1' },
      ],
    };
    expect(codes(c).filter((x) => x === 'bad-arity')).toHaveLength(2);
  });

  it('detects loops', () => {
    const c: Circuit = {
      nodes: [
        { kind: 'input', id: 'A', label: 'A' },
        { kind: 'gate', id: 'G1', gate: 'AND', inputs: ['A', 'G2'] },
        { kind: 'gate', id: 'G2', gate: 'NOT', inputs: ['G1'] },
        { kind: 'output', id: 'F', label: 'F', source: 'G2' },
      ],
    };
    expect(codes(c)).toContain('cycle');
    const r = evaluateCircuit(c, { A: 1 });
    expect(r.ok).toBe(false);
  });

  it('detects unknown components, unconnected outputs, duplicate ids and outputs used as sources', () => {
    const c: Circuit = {
      nodes: [
        { kind: 'input', id: 'A', label: 'A' },
        { kind: 'input', id: 'A', label: 'A again' },
        { kind: 'gate', id: 'G1', gate: 'AND', inputs: ['A', 'Z'] },
        { kind: 'gate', id: 'G2', gate: 'OR', inputs: ['A', 'F'] },
        { kind: 'gate', id: 'G3', gate: 'MAYBE' as never, inputs: ['A', 'A'] },
        { kind: 'output', id: 'F', label: 'F', source: null },
      ],
    };
    const found = codes(c);
    for (const code of ['duplicate-id', 'unknown-source', 'output-as-source', 'unknown-gate', 'output-unconnected']) {
      expect(found).toContain(code);
    }
  });

  it('requires at least one output', () => {
    expect(codes({ nodes: [{ kind: 'input', id: 'A', label: 'A' }] })).toContain('no-outputs');
  });

  it('flags missing input values at evaluation time', () => {
    const r = evaluateCircuit(notesExample, { A: 1, B: 0 } as never);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues.map((i) => i.code)).toContain('missing-value');
  });

  it('warns about unused gates and inputs', () => {
    const c: Circuit = {
      nodes: [
        { kind: 'input', id: 'A', label: 'A' },
        { kind: 'input', id: 'B', label: 'B' },
        { kind: 'gate', id: 'G1', gate: 'NOT', inputs: ['A'] },
        { kind: 'gate', id: 'G2', gate: 'NOT', inputs: ['A'] },
        { kind: 'output', id: 'F', label: 'F', source: 'G1' },
      ],
    };
    const issues = validateCircuit(c);
    expect(issues.find((i) => i.code === 'unused-gate')).toMatchObject({ nodeId: 'G2', severity: 'warning' });
    expect(issues.find((i) => i.code === 'unused-input')).toMatchObject({ nodeId: 'B', severity: 'warning' });
    expect(evaluateCircuit(c, { A: 0, B: 0 }).ok).toBe(true);
  });

  it('describes every issue in plain language', () => {
    for (const issue of validateCircuit({ nodes: [{ kind: 'gate', id: 'G', gate: 'AND', inputs: [null] }] })) {
      expect(describeIssue(issue).length).toBeGreaterThan(10);
    }
  });
});

describe('expression ↔ circuit agreement', () => {
  it('a circuit and its expression agree on every row', () => {
    const t = circuitTruthTable(notesExample);
    if (!t.ok) throw new Error('invalid');
    const e = parseExpression("((A+B).C)'");
    for (const row of t.table.rows) {
      const env = { A: row.inputs[0], B: row.inputs[1], C: row.inputs[2] } as Record<string, 0 | 1>;
      expect(evaluateExpr(e, env)).toBe(row.outputs[0]);
    }
  });
});
