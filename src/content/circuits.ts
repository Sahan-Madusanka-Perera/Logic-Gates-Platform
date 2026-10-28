import { exprToCircuit, type ExprToCircuitOptions } from '@/lib/logic/convert';
import { parseExpression } from '@/lib/logic/expression';
import type { Circuit } from '@/lib/logic/types';

export function circuitFromExpr(expr: string, options: ExprToCircuitOptions & { multi?: string[] } = {}): Circuit {
  return exprToCircuit(parseExpression(expr, { variables: options.multi }), options).circuit;
}

/** Half adder (N p.56–57): Sum = A ⊕ B, Carry = A.B. */
export const HALF_ADDER: Circuit = {
  nodes: [
    { kind: 'input', id: 'A', label: 'A' },
    { kind: 'input', id: 'B', label: 'B' },
    { kind: 'gate', id: 'X1', gate: 'XOR', inputs: ['A', 'B'], label: 'XOR' },
    { kind: 'gate', id: 'N1', gate: 'AND', inputs: ['A', 'B'], label: 'AND' },
    { kind: 'output', id: 'S', label: 'Sum', source: 'X1' },
    { kind: 'output', id: 'C', label: 'Carry', source: 'N1' },
  ],
};

/** Full adder from two half adders and an OR gate (N p.60). */
export const FULL_ADDER: Circuit = {
  nodes: [
    { kind: 'input', id: 'A', label: 'A' },
    { kind: 'input', id: 'B', label: 'B' },
    { kind: 'input', id: 'Cin', label: 'Cin' },
    { kind: 'gate', id: 'X1', gate: 'XOR', inputs: ['A', 'B'], label: 'G1' },
    { kind: 'gate', id: 'N1', gate: 'AND', inputs: ['A', 'B'], label: 'G2' },
    { kind: 'gate', id: 'X2', gate: 'XOR', inputs: ['X1', 'Cin'], label: 'G3' },
    { kind: 'gate', id: 'N2', gate: 'AND', inputs: ['X1', 'Cin'], label: 'G4' },
    { kind: 'gate', id: 'O1', gate: 'OR', inputs: ['N2', 'N1'], label: 'G5' },
    { kind: 'output', id: 'S', label: 'Sum', source: 'X2' },
    { kind: 'output', id: 'Co', label: 'Cout', source: 'O1' },
  ],
};

/** n-bit ripple-carry adder; bit 0 uses a half adder because it has no carry in (N p.61). */
export function rippleAdder(bits: number): Circuit {
  const nodes: Circuit['nodes'] = [];
  for (let i = bits - 1; i >= 0; i--) nodes.push({ kind: 'input', id: `A${i}`, label: `A${i}` }, { kind: 'input', id: `B${i}`, label: `B${i}` });
  let carry: string | null = null;
  for (let i = 0; i < bits; i++) {
    const a = `A${i}`;
    const b = `B${i}`;
    nodes.push({ kind: 'gate', id: `x${i}`, gate: 'XOR', inputs: [a, b] }, { kind: 'gate', id: `n${i}`, gate: 'AND', inputs: [a, b] });
    if (carry === null) {
      nodes.push({ kind: 'output', id: `S${i}`, label: `S${i}`, source: `x${i}` });
      carry = `n${i}`;
    } else {
      nodes.push(
        { kind: 'gate', id: `s${i}`, gate: 'XOR', inputs: [`x${i}`, carry] },
        { kind: 'gate', id: `m${i}`, gate: 'AND', inputs: [`x${i}`, carry] },
        { kind: 'gate', id: `c${i}`, gate: 'OR', inputs: [`m${i}`, `n${i}`] },
        { kind: 'output', id: `S${i}`, label: `S${i}`, source: `s${i}` },
      );
      carry = `c${i}`;
    }
  }
  nodes.push({ kind: 'output', id: 'Cout', label: 'Cout', source: carry as string });
  return { nodes };
}

export interface PresetCircuit {
  id: string;
  title: string;
  blurb: string;
  circuit: Circuit;
  multi?: string[];
}

export const PRESET_CIRCUITS: PresetCircuit[] = [
  {
    id: 'peeling',
    title: 'NOT((A + B).C)',
    blurb: 'The notes\' expression-to-circuit example: OR, then AND, then NOT.',
    circuit: circuitFromExpr("((A + B).C)'"),
  },
  {
    id: 'xor-sop',
    title: 'XOR from basic gates (SOP)',
    blurb: 'A\'.B + A.B\' — two NOTs, two ANDs and an OR behave exactly like XOR.',
    circuit: circuitFromExpr("A'.B + A.B'"),
  },
  {
    id: 'majority',
    title: 'Majority: at least two of three',
    blurb: 'Opens a safe when at least two of three keys are used (N p.49).',
    circuit: circuitFromExpr('K1.K2 + K2.K3 + K1.K3'),
  },
  {
    id: 'nand-xor',
    title: 'XOR from four NAND gates',
    blurb: 'A universal-gate construction. Step through it to see why it works.',
    circuit: circuitFromExpr("((A.(A.B)')'.(B.(A.B)')')'", { fuseNegations: true }),
  },
  {
    id: 'demorgan',
    title: 'De Morgan: NOT(A.B) = Ā + B̄',
    blurb: 'NOT gates on each input followed by OR give the same table as NAND.',
    circuit: circuitFromExpr("A' + B'"),
  },
  {
    id: 'distributive',
    title: '(X + Y).(X + Z)',
    blurb: 'Compare its truth table with X + Y.Z — they match (distributive law).',
    circuit: circuitFromExpr('(X + Y).(X + Z)'),
  },
  { id: 'half-adder', title: 'Half adder', blurb: 'Sum = A ⊕ B and Carry = A.B.', circuit: HALF_ADDER },
  { id: 'full-adder', title: 'Full adder', blurb: 'Two half adders and an OR gate add A, B and a carry in.', circuit: FULL_ADDER, multi: ['Cin'] },
];
