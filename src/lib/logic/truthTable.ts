import { evaluateCircuit, gateNodes, inputNodes, outputNodes } from './circuit';
import { allCombinations } from './gates';
import type { Assignment, Bit, Circuit, CircuitIssue } from './types';

export const MAX_TABLE_INPUTS = 10;

export interface TruthTableRow {
  /** Input Combination Number, 1-based, as used in the notes. */
  icn: number;
  /** Minterm/maxterm index (decimal value of the inputs), 0-based. */
  index: number;
  inputs: Bit[];
  outputs: Bit[];
  /** Value of every gate (by node id) for this row. */
  gates: Record<string, Bit>;
}

export interface TruthTable {
  inputIds: string[];
  inputLabels: string[];
  outputIds: string[];
  outputLabels: string[];
  gateIds: string[];
  rows: TruthTableRow[];
}

export type TruthTableResult = { ok: true; table: TruthTable } | { ok: false; issues: CircuitIssue[] };

/**
 * Build a truth table straight from the circuit definition. Rows are in binary
 * counting order with the first input as the most significant bit.
 */
export function circuitTruthTable(circuit: Circuit, inputOrder?: string[]): TruthTableResult {
  const inputs = inputNodes(circuit);
  const ids = inputOrder ?? inputs.map((n) => n.id);
  if (ids.length > MAX_TABLE_INPUTS) throw new RangeError(`Truth tables are limited to ${MAX_TABLE_INPUTS} inputs`);
  const labelOf = new Map(inputs.map((n) => [n.id, n.label]));
  const outs = outputNodes(circuit);
  const gates = gateNodes(circuit);
  const rows: TruthTableRow[] = [];
  const combos = allCombinations(ids.length);
  for (let i = 0; i < combos.length; i++) {
    const bits = combos[i] as Bit[];
    const assignment: Assignment = {};
    ids.forEach((id, k) => (assignment[id] = bits[k] as Bit));
    const result = evaluateCircuit(circuit, assignment);
    if (!result.ok) return { ok: false, issues: result.issues };
    const gateValues: Record<string, Bit> = {};
    for (const g of gates) gateValues[g.id] = result.values[g.id] as Bit;
    rows.push({ icn: i + 1, index: i, inputs: bits, outputs: outs.map((o) => result.outputs[o.id] as Bit), gates: gateValues });
  }
  return {
    ok: true,
    table: {
      inputIds: ids,
      inputLabels: ids.map((id) => labelOf.get(id) ?? id),
      outputIds: outs.map((o) => o.id),
      outputLabels: outs.map((o) => o.label),
      gateIds: gates.map((g) => g.id),
      rows,
    },
  };
}

/** Output column (first output) as a list of bits in row order. */
export function outputColumn(table: TruthTable, outputIndex = 0): Bit[] {
  return table.rows.map((r) => r.outputs[outputIndex] as Bit);
}
