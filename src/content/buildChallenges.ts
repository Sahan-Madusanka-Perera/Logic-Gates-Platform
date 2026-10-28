import type { GateType } from '@/lib/logic/types';

/** Original circuit-building tasks for the builder. Targets are checked by the logic engine. */
export interface BuildChallenge {
  id: string;
  title: string;
  /** Rich text: [[...]] renders as an expression. */
  brief: string;
  inputs: string[];
  /** Output label → the expression it must equal. */
  targets: Record<string, string>;
  allowed: GateType[];
  hint: string;
  source: string;
}

export const BUILD_CHALLENGES: BuildChallenge[] = [
  {
    id: 'not-nand',
    title: 'NOT from NAND',
    brief: "Make F = [[A']] using only NAND gates.",
    inputs: ['A'],
    targets: { F: "A'" },
    allowed: ['NAND'],
    hint: "Join both inputs of one NAND gate to A: (A.A)' = A'.",
    source: 'N p.13–14',
  },
  {
    id: 'and-nand',
    title: 'AND from NAND',
    brief: 'Make F = [[A.B]] using only NAND gates.',
    inputs: ['A', 'B'],
    targets: { F: 'A.B' },
    allowed: ['NAND'],
    hint: "One NAND gate gives (A.B)'. Invert it with a second NAND gate whose two inputs are joined.",
    source: 'N p.13–14',
  },
  {
    id: 'or-nand',
    title: 'OR from NAND',
    brief: 'Make F = [[A+B]] using only NAND gates.',
    inputs: ['A', 'B'],
    targets: { F: 'A+B' },
    allowed: ['NAND'],
    hint: "By De Morgan's law, A + B = (A'.B')'. Invert A and B with NAND gates first, then NAND the results.",
    source: 'N p.13–14',
  },
  {
    id: 'or-nor',
    title: 'OR from NOR',
    brief: 'Make F = [[A+B]] using only NOR gates.',
    inputs: ['A', 'B'],
    targets: { F: 'A+B' },
    allowed: ['NOR'],
    hint: "One NOR gate gives (A+B)'. Invert it with a second NOR gate whose two inputs are joined.",
    source: 'N p.15–16',
  },
  {
    id: 'and-nor',
    title: 'AND from NOR',
    brief: 'Make F = [[A.B]] using only NOR gates.',
    inputs: ['A', 'B'],
    targets: { F: 'A.B' },
    allowed: ['NOR'],
    hint: "A.B = (A'+B')'. Invert A and B with NOR gates, then NOR the two results.",
    source: 'N p.15–16',
  },
  {
    id: 'xor-basic',
    title: 'XOR from basic gates',
    brief: 'Make F = [[A⊕B]] using only AND, OR and NOT gates.',
    inputs: ['A', 'B'],
    targets: { F: 'A⊕B' },
    allowed: ['AND', 'OR', 'NOT'],
    hint: "A⊕B = A.B' + A'.B. You need two NOT gates, two AND gates and one OR gate.",
    source: 'N p.9–10',
  },
  {
    id: 'majority',
    title: 'Majority vote',
    brief: 'Three judges press A, B and C (1 means “pass”). The light F turns on when at least two judges press 1. Use AND and OR gates.',
    inputs: ['A', 'B', 'C'],
    targets: { F: 'A.B + B.C + A.C' },
    allowed: ['AND', 'OR'],
    hint: 'List the pairs that can agree: A and B, B and C, A and C. Use one AND gate per pair, then one 3-input OR gate.',
    source: 'Original scenario (design skill, N p.49–55)',
  },
  {
    id: 'half-adder',
    title: 'Half adder',
    brief: 'Add two bits A and B. Output S is the sum bit and output C is the carry bit.',
    inputs: ['A', 'B'],
    targets: { S: 'A⊕B', C: 'A.B' },
    allowed: ['AND', 'XOR'],
    hint: 'S is 1 when exactly one input is 1, so it is an XOR. C is 1 only when both inputs are 1, so it is an AND.',
    source: 'N p.56–58',
  },
];
