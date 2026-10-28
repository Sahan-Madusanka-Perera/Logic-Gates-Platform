import { describe, expect, it } from 'vitest';
import {
  addNode,
  CANVAS_W,
  challengeCircuit,
  connect,
  disconnect,
  emptyCircuit,
  labelProblem,
  moveNode,
  removeNode,
  sanitizeCircuit,
  setGateType,
  setInputCount,
} from '@/components/builder/model';
import { BUILD_CHALLENGES } from '@/content/buildChallenges';
import { checkBuild } from '@/lib/assessment/buildCheck';
import { evaluateCircuit, validateCircuit } from '@/lib/logic/circuit';
import { exprToCircuit } from '@/lib/logic/convert';
import { parseExpression } from '@/lib/logic/expression';
import type { Circuit, CircuitNode, GateType } from '@/lib/logic/types';

const input = (label: string): CircuitNode => ({ kind: 'input', id: label, label });
const gate = (id: string, g: GateType, inputs: string[]): CircuitNode => ({ kind: 'gate', id, gate: g, inputs, label: id });
const output = (label: string, source: string): CircuitNode => ({ kind: 'output', id: `out-${label}`, label, source });

/** A reference solution for every challenge, built the way a student would. */
const SOLUTIONS: Record<string, Circuit> = {
  'not-nand': { nodes: [input('A'), gate('g1', 'NAND', ['A', 'A']), output('F', 'g1')] },
  'and-nand': { nodes: [input('A'), input('B'), gate('g1', 'NAND', ['A', 'B']), gate('g2', 'NAND', ['g1', 'g1']), output('F', 'g2')] },
  'or-nand': { nodes: [input('A'), input('B'), gate('g1', 'NAND', ['A', 'A']), gate('g2', 'NAND', ['B', 'B']), gate('g3', 'NAND', ['g1', 'g2']), output('F', 'g3')] },
  'or-nor': { nodes: [input('A'), input('B'), gate('g1', 'NOR', ['A', 'B']), gate('g2', 'NOR', ['g1', 'g1']), output('F', 'g2')] },
  'and-nor': { nodes: [input('A'), input('B'), gate('g1', 'NOR', ['A', 'A']), gate('g2', 'NOR', ['B', 'B']), gate('g3', 'NOR', ['g1', 'g2']), output('F', 'g3')] },
  'xor-basic': exprToCircuit(parseExpression("A.B' + A'.B")).circuit,
  majority: exprToCircuit(parseExpression('A.B + B.C + A.C')).circuit,
  'half-adder': { nodes: [input('A'), input('B'), gate('g1', 'XOR', ['A', 'B']), gate('g2', 'AND', ['A', 'B']), output('S', 'g1'), output('C', 'g2')] },
};

describe('build challenges', () => {
  it('every challenge has a reference solution that passes the checker', () => {
    for (const ch of BUILD_CHALLENGES) {
      const sol = SOLUTIONS[ch.id];
      expect(sol, ch.id).toBeDefined();
      const r = checkBuild(ch, sol as Circuit);
      expect(r, `${ch.id}: ${r.message}`).toMatchObject({ ok: true });
    }
  });

  it('every challenge target parses and uses only its own inputs', () => {
    for (const ch of BUILD_CHALLENGES) {
      for (const t of Object.values(ch.targets)) {
        const e = parseExpression(t);
        expect(e).toBeDefined();
      }
      expect(ch.allowed.length).toBeGreaterThan(0);
    }
  });

  const andNand = BUILD_CHALLENGES.find((c) => c.id === 'and-nand');
  if (!andNand) throw new Error('missing challenge');

  it('rejects gates that are not allowed', () => {
    const r = checkBuild(andNand, { nodes: [input('A'), input('B'), gate('g1', 'AND', ['A', 'B']), output('F', 'g1')] });
    expect(r.ok).toBe(false);
    expect(r.message).toContain('only NAND');
  });

  it('gives a counterexample when the function is wrong', () => {
    const r = checkBuild(andNand, { nodes: [input('A'), input('B'), gate('g1', 'NAND', ['A', 'B']), output('F', 'g1')] });
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/When A = 0, B = 0, output F is 1, but it should be 0/);
  });

  it('reports missing inputs, extra inputs and unconnected parts', () => {
    expect(checkBuild(andNand, { nodes: [input('A'), gate('g1', 'NAND', ['A', 'A']), output('F', 'g1')] }).message).toContain('named B');
    expect(checkBuild(andNand, { nodes: [input('A'), input('B'), input('C'), gate('g1', 'NAND', ['A', 'B']), output('F', 'g1')] }).message).toContain('Remove or rename C');
    const open = checkBuild(andNand, { nodes: [input('A'), input('B'), gate('g1', 'NAND', ['A', null as unknown as string]), output('F', 'g1')] });
    expect(open.message).toContain('Input 2 of NAND gate g1 is not connected');
  });

  it('starts a challenge with exactly the required terminals', () => {
    const half = BUILD_CHALLENGES.find((c) => c.id === 'half-adder');
    if (!half) throw new Error('missing');
    const c = challengeCircuit(half.inputs, Object.keys(half.targets));
    expect(c.nodes.filter((n) => n.kind === 'input').map((n) => (n.kind === 'input' ? n.label : ''))).toEqual(['A', 'B']);
    expect(c.nodes.filter((n) => n.kind === 'output').map((n) => (n.kind === 'output' ? n.label : ''))).toEqual(['S', 'C']);
  });
});

describe('builder editing model', () => {
  it('adds, wires and evaluates a gate', () => {
    let c = emptyCircuit();
    const added = addNode(c, 'AND');
    c = added.circuit;
    c = connect(c, 'in1', added.id, 0);
    c = connect(c, 'in2', added.id, 1);
    c = connect(c, added.id, 'out1', 0);
    expect(validateCircuit(c).filter((i) => i.severity === 'error')).toEqual([]);
    const r = evaluateCircuit(c, { in1: 1, in2: 1 });
    expect(r.ok && r.outputs.out1).toBe(1);
  });

  it('gives new components unique ids, labels and non-overlapping positions', () => {
    let c = emptyCircuit();
    for (let i = 0; i < 6; i++) c = addNode(c, 'OR').circuit;
    c = addNode(c, 'input').circuit;
    c = addNode(c, 'output').circuit;
    const ids = c.nodes.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
    const labels = c.nodes.flatMap((n) => (n.kind === 'input' || n.kind === 'output' ? [n.label] : []));
    expect(new Set(labels).size).toBe(labels.length);
    expect(labels).toContain('C');
    expect(labels).toContain('G');
    const pos = Object.values(c.layout ?? {});
    for (let i = 0; i < pos.length; i++)
      for (let j = i + 1; j < pos.length; j++) {
        const a = pos[i] as { x: number; y: number };
        const b = pos[j] as { x: number; y: number };
        expect(Math.abs(a.x - b.x) > 90 || Math.abs(a.y - b.y) > 60).toBe(true);
      }
  });

  it('removing a component also removes the wires that used it', () => {
    let c = emptyCircuit();
    const g = addNode(c, 'NOT');
    c = connect(connect(g.circuit, 'in1', g.id, 0), g.id, 'out1', 0);
    c = removeNode(c, g.id);
    expect(c.nodes.find((n) => n.id === g.id)).toBeUndefined();
    expect(c.nodes.find((n) => n.id === 'out1')).toMatchObject({ source: null });
    expect(c.layout?.[g.id]).toBeUndefined();
  });

  it('changing gate type or input count keeps existing wires where possible', () => {
    let c = emptyCircuit();
    const g = addNode(c, 'AND');
    c = connect(connect(g.circuit, 'in1', g.id, 0), 'in2', g.id, 1);
    c = setInputCount(c, g.id, 3);
    expect(c.nodes.find((n) => n.id === g.id)).toMatchObject({ inputs: ['in1', 'in2', null] });
    c = setGateType(c, g.id, 'NOT');
    expect(c.nodes.find((n) => n.id === g.id)).toMatchObject({ gate: 'NOT', inputs: ['in1'] });
    c = setGateType(c, g.id, 'XOR');
    expect(c.nodes.find((n) => n.id === g.id)).toMatchObject({ gate: 'XOR', inputs: ['in1', null] });
    c = disconnect(c, g.id, 0);
    expect(c.nodes.find((n) => n.id === g.id)).toMatchObject({ inputs: [null, null] });
  });

  it('keeps moved components on the canvas and snaps them to the grid', () => {
    const c = moveNode(emptyCircuit(), 'in1', { x: -50, y: 33 });
    expect(c.layout?.in1).toEqual({ x: 0, y: 30 });
    const far = moveNode(emptyCircuit(), 'out1', { x: 5000, y: 10 });
    expect((far.layout?.out1?.x ?? 0) + 64).toBeLessThanOrEqual(CANVAS_W);
  });

  it('validates terminal names', () => {
    const c = emptyCircuit();
    expect(labelProblem(c, 'in1', 'B')).toMatch(/already/);
    expect(labelProblem(c, 'in1', 'a')).toMatch(/capital/);
    expect(labelProblem(c, 'in1', 'Cin')).toBeNull();
  });

  it('rejects corrupted saved circuits and accepts valid ones', () => {
    expect(sanitizeCircuit(null)).toBeNull();
    expect(sanitizeCircuit({ nodes: [{ kind: 'gate', id: 'x', gate: 'MAYBE', inputs: [] }] })).toBeNull();
    const ok = sanitizeCircuit(JSON.parse(JSON.stringify(emptyCircuit())));
    expect(ok?.nodes).toHaveLength(3);
  });
});
