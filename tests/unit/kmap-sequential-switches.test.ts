import { describe, expect, it } from 'vitest';
import { exprToCircuit } from '@/lib/logic/convert';
import { evaluateCircuit } from '@/lib/logic/circuit';
import { isEquivalent, outputsOf, parseExpression, toText } from '@/lib/logic/expression';
import { allCombinations, evaluateGate } from '@/lib/logic/gates';
import { analyzeCover, allCells, cellIndex, checkGroup, grayCodes, groupRectangles, kmapLayout } from '@/lib/logic/kmap';
import { runLatch } from '@/lib/logic/sequential';
import { GATE_SWITCH_CIRCUITS, lampState } from '@/lib/logic/switches';
import type { Bit, GateType } from '@/lib/logic/types';

describe('Gray code and layouts', () => {
  it('generates reflected binary code', () => {
    expect(grayCodes(1)).toEqual(['0', '1']);
    expect(grayCodes(2)).toEqual(['00', '01', '11', '10']);
    for (const bits of [2, 3, 4]) {
      const g = grayCodes(bits);
      for (let i = 0; i < g.length; i++) {
        const a = g[i] as string;
        const b = g[(i + 1) % g.length] as string;
        expect([...a].filter((ch, k) => ch !== b[k]).length).toBe(1);
      }
    }
  });

  it('numbers 3-variable cells like the notes (AB across, C down; N p.31 uses ICN = index + 1)', () => {
    const L = kmapLayout(['A', 'B', 'C']);
    const icn = (r: number, c: number) => cellIndex(L, { r, c }) + 1;
    expect([icn(0, 0), icn(0, 1), icn(0, 2), icn(0, 3)]).toEqual([1, 3, 7, 5]);
    expect([icn(1, 0), icn(1, 1), icn(1, 2), icn(1, 3)]).toEqual([2, 4, 8, 6]);
  });

  it('numbers 4-variable cells like the notes (AB across, CD down)', () => {
    const L = kmapLayout(['A', 'B', 'C', 'D']);
    const col0 = [0, 1, 2, 3].map((r) => cellIndex(L, { r, c: 0 }) + 1);
    const col2 = [0, 1, 2, 3].map((r) => cellIndex(L, { r, c: 2 }) + 1);
    expect(col0).toEqual([1, 2, 4, 3]);
    expect(col2).toEqual([13, 14, 16, 15]);
  });
});

describe('K-map grouping rules', () => {
  const vars = ['A', 'B', 'C'];
  const L = kmapLayout(vars);
  const values = outputsOf(parseExpression('A.B + B.C + A.C'), vars);

  it('rejects mixed groups, non-powers of two and diagonals', () => {
    expect(checkGroup(L, values, [{ r: 0, c: 0 }, { r: 0, c: 1 }], 1).issues.map((i) => i.rule)).toContain(2);
    expect(checkGroup(L, values, [{ r: 1, c: 1 }, { r: 1, c: 2 }, { r: 1, c: 3 }], 1).issues.map((i) => i.rule)).toContain(3);
    expect(checkGroup(L, values, [{ r: 0, c: 2 }, { r: 1, c: 1 }], 1).issues.map((i) => i.rule)).toContain(9);
  });

  it('accepts wrap-around groups and returns the term', () => {
    const vals = outputsOf(parseExpression("C'"), vars); // the whole top row is 1
    const wrap = checkGroup(L, vals, [{ r: 0, c: 0 }, { r: 0, c: 3 }], 1);
    expect(wrap.valid).toBe(true);
    expect(toText(wrap.term!)).toBe("B'.C'");
  });

  it('reads the majority function optimally with three pairs', () => {
    const groups = [
      [{ r: 1, c: 1 }, { r: 1, c: 2 }],
      [{ r: 0, c: 2 }, { r: 1, c: 2 }],
      [{ r: 1, c: 2 }, { r: 1, c: 3 }],
    ];
    const a = analyzeCover(L, values, groups, 1);
    expect(a.uncovered).toEqual([]);
    expect(a.isOptimal).toBe(true);
    expect(isEquivalent(a.expression, parseExpression('A.B + B.C + A.C'))).toBe(true);
  });

  it('spots groups that could be larger, redundant groups and uncovered 1s', () => {
    const vals = outputsOf(parseExpression('B'), vars);
    const a = analyzeCover(L, vals, [[{ r: 0, c: 1 }, { r: 0, c: 2 }], [{ r: 0, c: 1 }, { r: 1, c: 1 }], [{ r: 0, c: 1 }]], 1);
    expect(a.notLargest).toContain(0);
    expect(a.redundant).toContain(2);
    expect(a.uncovered.length).toBe(1);
    expect(a.isOptimal).toBe(false);
  });

  it('groups of 0s give POS terms', () => {
    const a = analyzeCover(L, values, [
      [{ r: 0, c: 0 }, { r: 1, c: 0 }],
      [{ r: 0, c: 0 }, { r: 0, c: 1 }],
      [{ r: 0, c: 0 }, { r: 0, c: 3 }],
    ], 0);
    expect(a.isOptimal).toBe(true);
    expect(isEquivalent(a.expression, parseExpression('(A + B).(B + C).(A + C)'))).toBe(true);
  });

  it('splits wrap-around groups into drawable rectangles', () => {
    const rects = groupRectangles(L, [{ r: 0, c: 0 }, { r: 0, c: 3 }]);
    expect(rects).toHaveLength(2);
    expect(rects.some((r) => r.openLeft)).toBe(true);
    expect(allCells(L)).toHaveLength(8);
  });
});

describe('SR latches (N p.66–70)', () => {
  it('NOR latch follows the four-state table', () => {
    const steps = runLatch('nor', [
      { s: 0, r: 0 },
      { s: 1, r: 0 },
      { s: 0, r: 0 },
      { s: 0, r: 1 },
      { s: 0, r: 0 },
    ]);
    expect(steps.map((s) => [s.after.q, s.after.qBar])).toEqual([[0, 1], [1, 0], [1, 0], [0, 1], [0, 1]]);
    expect(steps.map((s) => s.mode)).toEqual(['memory', 'set', 'memory', 'reset', 'memory']);
  });

  it('NOR latch: S = R = 1 is forbidden and leaving it is unpredictable', () => {
    const steps = runLatch('nor', [{ s: 1, r: 1 }, { s: 0, r: 0 }]);
    expect(steps[0]).toMatchObject({ mode: 'forbidden', after: { q: 0, qBar: 0 } });
    expect(steps[1]).toMatchObject({ mode: 'unpredictable', after: { q: null } });
  });

  it('NAND latch uses active-low inputs', () => {
    const steps = runLatch('nand', [
      { s: 1, r: 1 },
      { s: 0, r: 1 },
      { s: 1, r: 1 },
      { s: 1, r: 0 },
      { s: 1, r: 1 },
      { s: 0, r: 0 },
    ]);
    expect(steps.map((s) => s.after.q)).toEqual([0, 1, 1, 0, 0, 1]);
    expect(steps[5]?.mode).toBe('forbidden');
    expect(steps[5]?.after.qBar).toBe(1);
  });

  it('the notes\' OR-AND-NOT loop remembers a set until reset', () => {
    const steps = runLatch('or-and', [
      { s: 1, r: 0 },
      { s: 0, r: 0 },
      { s: 0, r: 1 },
      { s: 0, r: 0 },
    ]);
    expect(steps.map((s) => s.after.q)).toEqual([1, 1, 0, 0]);
  });
});

describe('switch circuits model their gates (N p.19)', () => {
  for (const [gate, model] of Object.entries(GATE_SWITCH_CIRCUITS)) {
    it(`${gate} switch circuit`, () => {
      const names = gate === 'NOT' ? ['S'] : ['S1', 'S2'];
      for (const bits of allCombinations(names.length)) {
        const sw = Object.fromEntries(names.map((n, k) => [n, bits[k] as Bit]));
        expect(lampState(model, sw)).toBe(evaluateGate(gate as GateType, bits));
      }
    });
  }
});

describe('universal gate constructions (N p.14–17)', () => {
  const twoVar = allCombinations(2);
  const check = (expr: string, gate: GateType, onlyGate: GateType) => {
    const { circuit, outputId } = exprToCircuit(parseExpression(expr), { fuseNegations: true, variables: ['A', 'B'] });
    for (const n of circuit.nodes) if (n.kind === 'gate') expect(n.gate).toBe(onlyGate);
    for (const [a, b] of twoVar) {
      const r = evaluateCircuit(circuit, { A: a as Bit, B: b as Bit });
      expect(r.ok && r.outputs[outputId]).toBe(gate === 'NOT' ? evaluateGate('NOT', [a as Bit]) : gate === 'BUFFER' ? a : evaluateGate(gate, [a as Bit, b as Bit]));
    }
  };

  it('NAND-only', () => {
    check("(A.A)'", 'NOT', 'NAND');
    check("((A.B)'.(A.B)')'", 'AND', 'NAND');
    check("((A.A)'.(B.B)')'", 'OR', 'NAND');
    check("((A.A)'.(A.A)')'", 'BUFFER', 'NAND');
    check("((A.(A.B)')'.(B.(A.B)')')'", 'XOR', 'NAND');
  });

  it('NOR-only', () => {
    check("(A+A)'", 'NOT', 'NOR');
    check("((A+A)' + (B+B)')'", 'AND', 'NOR');
    check("((A+B)' + (A+B)')'", 'OR', 'NOR');
    check("((A+A)' + (A+A)')'", 'BUFFER', 'NOR');
    check("((A+(A+B)')' + (B+(A+B)')')'", 'XNOR', 'NOR');
  });
});
