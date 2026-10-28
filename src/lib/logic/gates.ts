import { type Bit, type GateType, GATE_TYPES, MAX_GATE_INPUTS, UNARY_GATES } from './types';

export function isBit(value: unknown): value is Bit {
  return value === 0 || value === 1;
}

export function isGateType(value: string): value is GateType {
  return (GATE_TYPES as readonly string[]).includes(value);
}

export function isUnary(gate: GateType): boolean {
  return UNARY_GATES.includes(gate);
}

/** Smallest and largest number of inputs a gate accepts. */
export function gateArity(gate: GateType): { min: number; max: number } {
  return isUnary(gate) ? { min: 1, max: 1 } : { min: 2, max: MAX_GATE_INPUTS };
}

export function isValidArity(gate: GateType, count: number): boolean {
  const { min, max } = gateArity(gate);
  return Number.isInteger(count) && count >= min && count <= max;
}

export class GateArityError extends Error {
  constructor(gate: GateType, count: number) {
    super(`${gate} gate cannot take ${count} input(s)`);
    this.name = 'GateArityError';
  }
}

export function not(a: Bit): Bit {
  return a === 1 ? 0 : 1;
}

function countOnes(inputs: readonly Bit[]): number {
  let n = 0;
  for (const b of inputs) {
    if (b !== 0 && b !== 1) throw new TypeError(`Expected a bit (0 or 1), received ${String(b)}`);
    if (b === 1) n += 1;
  }
  return n;
}

/**
 * Evaluate one gate.
 * AND: 1 only when every input is 1. OR: 1 when at least one input is 1.
 * XOR: 1 when an odd number of inputs are 1 (for two inputs: when they differ).
 * NAND/NOR/XNOR invert AND/OR/XOR. NOT inverts, BUFFER passes the value through.
 */
export function evaluateGate(gate: GateType, inputs: readonly Bit[]): Bit {
  if (!isValidArity(gate, inputs.length)) throw new GateArityError(gate, inputs.length);
  const ones = countOnes(inputs);
  const all = ones === inputs.length;
  const any = ones > 0;
  const odd = ones % 2 === 1;
  switch (gate) {
    case 'NOT':
      return any ? 0 : 1;
    case 'BUFFER':
      return any ? 1 : 0;
    case 'AND':
      return all ? 1 : 0;
    case 'OR':
      return any ? 1 : 0;
    case 'NAND':
      return all ? 0 : 1;
    case 'NOR':
      return any ? 0 : 1;
    case 'XOR':
      return odd ? 1 : 0;
    case 'XNOR':
      return odd ? 0 : 1;
  }
}

export const GATE_INFO: Record<
  GateType,
  { name: string; symbolName: string; family: 'basic' | 'combinational' | 'other'; inverted: boolean; base?: GateType }
> = {
  NOT: { name: 'NOT', symbolName: 'Inverter', family: 'basic', inverted: true },
  BUFFER: { name: 'Buffer', symbolName: 'Buffer', family: 'other', inverted: false },
  AND: { name: 'AND', symbolName: 'Conjunction', family: 'basic', inverted: false },
  OR: { name: 'OR', symbolName: 'Disjunction', family: 'basic', inverted: false },
  NAND: { name: 'NAND', symbolName: 'NOT-AND', family: 'combinational', inverted: true, base: 'AND' },
  NOR: { name: 'NOR', symbolName: 'NOT-OR', family: 'combinational', inverted: true, base: 'OR' },
  XOR: { name: 'XOR', symbolName: 'Exclusive-OR', family: 'combinational', inverted: false },
  XNOR: { name: 'XNOR', symbolName: 'Exclusive-NOR', family: 'combinational', inverted: true, base: 'XOR' },
};

/** Every assignment of n bits in truth-table order (first bit is the most significant). */
export function allCombinations(n: number): Bit[][] {
  if (!Number.isInteger(n) || n < 0) throw new RangeError('n must be a non-negative integer');
  if (n > 16) throw new RangeError('Too many inputs for an exhaustive table');
  const rows: Bit[][] = [];
  const total = 2 ** n;
  for (let i = 0; i < total; i++) rows.push(indexToBits(i, n));
  return rows;
}

export function indexToBits(index: number, n: number): Bit[] {
  const bits: Bit[] = [];
  for (let k = n - 1; k >= 0; k--) bits.push(((index >> k) & 1) as Bit);
  return bits;
}

export function bitsToIndex(bits: readonly Bit[]): number {
  return bits.reduce<number>((acc, b) => acc * 2 + b, 0);
}
