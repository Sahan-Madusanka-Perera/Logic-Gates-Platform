import { describe, expect, it } from 'vitest';
import { allCombinations, bitsToIndex, evaluateGate, GateArityError, indexToBits } from '@/lib/logic/gates';
import type { Bit, GateType } from '@/lib/logic/types';

/** Reference truth tables copied from the notes (N p.4–8). Row order 00, 01, 10, 11. */
const TWO_INPUT: Record<Exclude<GateType, 'NOT' | 'BUFFER'>, Bit[]> = {
  AND: [0, 0, 0, 1],
  OR: [0, 1, 1, 1],
  NAND: [1, 1, 1, 0],
  NOR: [1, 0, 0, 0],
  XOR: [0, 1, 1, 0],
  XNOR: [1, 0, 0, 1],
};

/** Three-input tables from the notes (rows 000 … 111). */
const THREE_INPUT: Record<Exclude<GateType, 'NOT' | 'BUFFER'>, Bit[]> = {
  AND: [0, 0, 0, 0, 0, 0, 0, 1],
  OR: [0, 1, 1, 1, 1, 1, 1, 1],
  NAND: [1, 1, 1, 1, 1, 1, 1, 0],
  NOR: [1, 0, 0, 0, 0, 0, 0, 0],
  XOR: [0, 1, 1, 0, 1, 0, 0, 1],
  XNOR: [1, 0, 0, 1, 0, 1, 1, 0],
};

describe('single gates', () => {
  it('NOT reverses its input', () => {
    expect(evaluateGate('NOT', [0])).toBe(1);
    expect(evaluateGate('NOT', [1])).toBe(0);
  });

  it('BUFFER passes its input through', () => {
    expect(evaluateGate('BUFFER', [0])).toBe(0);
    expect(evaluateGate('BUFFER', [1])).toBe(1);
  });

  for (const [gate, expected] of Object.entries(TWO_INPUT)) {
    it(`2-input ${gate} matches the notes for every combination`, () => {
      const got = allCombinations(2).map((bits) => evaluateGate(gate as GateType, bits));
      expect(got).toEqual(expected);
    });
  }

  for (const [gate, expected] of Object.entries(THREE_INPUT)) {
    it(`3-input ${gate} matches the notes for every combination`, () => {
      const got = allCombinations(3).map((bits) => evaluateGate(gate as GateType, bits));
      expect(got).toEqual(expected);
    });
  }

  it('n-input gates follow the general definitions for 2–6 inputs', () => {
    for (let n = 2; n <= 6; n++) {
      for (const bits of allCombinations(n)) {
        const ones = bits.filter((b) => b === 1).length;
        expect(evaluateGate('AND', bits)).toBe(ones === n ? 1 : 0);
        expect(evaluateGate('OR', bits)).toBe(ones > 0 ? 1 : 0);
        expect(evaluateGate('NAND', bits)).toBe(ones === n ? 0 : 1);
        expect(evaluateGate('NOR', bits)).toBe(ones > 0 ? 0 : 1);
        expect(evaluateGate('XOR', bits)).toBe(ones % 2);
        expect(evaluateGate('XNOR', bits)).toBe(ones % 2 === 1 ? 0 : 1);
      }
    }
  });

  it('rejects impossible input counts', () => {
    expect(() => evaluateGate('NOT', [0, 1])).toThrow(GateArityError);
    expect(() => evaluateGate('AND', [1])).toThrow(GateArityError);
    expect(() => evaluateGate('OR', [])).toThrow(GateArityError);
  });

  it('rejects values that are not bits instead of using truthiness', () => {
    expect(() => evaluateGate('AND', [1, 2 as unknown as Bit])).toThrow(TypeError);
    expect(() => evaluateGate('OR', [0, true as unknown as Bit])).toThrow(TypeError);
  });
});

describe('combinations', () => {
  it('produces 2^n rows in counting order with the first input as MSB', () => {
    expect(allCombinations(1)).toEqual([[0], [1]]);
    expect(allCombinations(2)).toEqual([[0, 0], [0, 1], [1, 0], [1, 1]]);
    expect(allCombinations(3)).toHaveLength(8);
    expect(allCombinations(4)).toHaveLength(16);
    expect(allCombinations(3)[5]).toEqual([1, 0, 1]);
  });

  it('converts between indices and bits', () => {
    for (let i = 0; i < 16; i++) expect(bitsToIndex(indexToBits(i, 4))).toBe(i);
  });
});
