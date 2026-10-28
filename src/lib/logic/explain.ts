import { nodeById } from './circuit';
import { gateExpressions } from './convert';
import { toText } from './expression';
import type { Bit, Circuit, EvalStep, GateType } from './types';

const article = (g: GateType) => (/^(AND|OR|XOR|XNOR)$/.test(g) ? 'an' : 'a');

/** Why a gate produced its output, in one sentence. */
export function gateReason(gate: GateType, ins: Bit[], out: Bit): string {
  const ones = ins.filter((b) => b === 1).length;
  const n = ins.length;
  switch (gate) {
    case 'NOT':
      return `NOT reverses its input: ${ins[0]} becomes ${out}.`;
    case 'BUFFER':
      return `A buffer passes its input straight through, so the output is ${out}.`;
    case 'AND':
      return ones === n ? `All inputs are 1, so AND gives 1.` : `At least one input is 0, so AND gives 0.`;
    case 'OR':
      return ones > 0 ? `At least one input is 1, so OR gives 1.` : `Every input is 0, so OR gives 0.`;
    case 'NAND':
      return ones === n ? `All inputs are 1, so AND would give 1 — NAND inverts it to 0.` : `At least one input is 0, so AND would give 0 — NAND inverts it to 1.`;
    case 'NOR':
      return ones > 0 ? `At least one input is 1, so OR would give 1 — NOR inverts it to 0.` : `Every input is 0, so OR would give 0 — NOR inverts it to 1.`;
    case 'XOR':
      return n === 2
        ? ins[0] !== ins[1]
          ? 'The inputs are different, so XOR gives 1.'
          : 'The inputs are the same, so XOR gives 0.'
        : `${ones} input${ones === 1 ? ' is' : 's are'} 1 — ${ones % 2 === 1 ? 'an odd' : 'an even'} number — so XOR gives ${out}.`;
    case 'XNOR':
      return n === 2
        ? ins[0] === ins[1]
          ? 'The inputs are the same, so XNOR gives 1.'
          : 'The inputs are different, so XNOR gives 0.'
        : `${ones} input${ones === 1 ? ' is' : 's are'} 1 — ${ones % 2 === 1 ? 'odd' : 'even'} — so XNOR gives ${out}.`;
  }
}

export function nodeLabel(circuit: Circuit, id: string): string {
  const n = nodeById(circuit).get(id);
  if (!n) return id;
  if (n.kind === 'gate') return n.label ?? n.id;
  if (n.kind === 'const') return String(n.value);
  return n.label;
}

/** Rich-text explanation of one evaluation step (uses [[expr]] markup). */
export function describeStep(circuit: Circuit, step: EvalStep, exprs = gateExpressions(circuit)): string {
  const label = nodeLabel(circuit, step.nodeId);
  const sources = step.sources.map((s, i) => {
    const node = nodeById(circuit).get(s);
    const name = nodeLabel(circuit, s);
    const sub = node?.kind === 'gate' && exprs[s] ? ` (= [[${toText(exprs[s])}]])` : '';
    return `${name}${sub} = ${step.inputValues[i]}`;
  });
  const own = exprs[step.nodeId];
  return `**${label}** is ${article(step.gate)} ${step.gate} gate${own ? ` computing [[${toText(own)}]]` : ''}. Its input${sources.length > 1 ? 's are' : ' is'} ${sources.join(' and ')}. ${gateReason(step.gate, step.inputValues, step.output)} So ${label} = **${step.output}**.`;
}

/** A plain description of every connection, for screen readers and the "describe circuit" panel. */
export function describeCircuit(circuit: Circuit): string[] {
  const lines: string[] = [];
  const exprs = gateExpressions(circuit);
  for (const n of circuit.nodes) {
    if (n.kind === 'gate') {
      const ins = n.inputs.map((s) => (s ? nodeLabel(circuit, s) : 'nothing (unconnected)'));
      const e = exprs[n.id];
      lines.push(`${n.label ?? n.id}: ${n.gate} gate with input${ins.length > 1 ? 's' : ''} ${ins.join(', ')}${e ? ` — computes ${toText(e)}` : ''}.`);
    } else if (n.kind === 'output') {
      lines.push(`Output ${n.label} comes from ${n.source ? nodeLabel(circuit, n.source) : 'nothing (unconnected)'}.`);
    }
  }
  return lines;
}
