import type { BuildChallenge } from '@/content/buildChallenges';
import { describeIssue, gateNodes, inputNodes, outputNodes, validateCircuit } from '@/lib/logic/circuit';
import { evaluateExpr, parseExpression } from '@/lib/logic/expression';
import { circuitTruthTable } from '@/lib/logic/truthTable';
import type { Circuit, CircuitNode } from '@/lib/logic/types';

export type BuildCheck = { ok: true; message: string } | { ok: false; message: string };

/** How the builder names a component in messages. */
export function builderLabel(node: CircuitNode | undefined): string {
  if (!node) return 'a component';
  switch (node.kind) {
    case 'input':
      return `input ${node.label}`;
    case 'output':
      return `output ${node.label}`;
    case 'const':
      return `constant ${node.value}`;
    case 'gate':
      return `${node.gate} gate ${node.label ?? node.id}`;
  }
}

/** Names for describeIssue, which already says "Input"/"Output" before a terminal's name. */
export function issueLabel(node: CircuitNode | undefined): string {
  return node && (node.kind === 'input' || node.kind === 'output') ? node.label : builderLabel(node);
}

const list = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

/** Check a built circuit against a challenge, explaining the first problem found. */
export function checkBuild(challenge: BuildChallenge, circuit: Circuit): BuildCheck {
  const byId = new Map(circuit.nodes.map((n) => [n.id, n]));
  const inputs = inputNodes(circuit);
  const outputs = outputNodes(circuit);
  const inLabels = inputs.map((n) => n.label);
  const outLabels = outputs.map((n) => n.label);
  const wantOut = Object.keys(challenge.targets);

  const missingIn = challenge.inputs.filter((l) => !inLabels.includes(l));
  if (missingIn.length) return { ok: false, message: `Your circuit needs input${missingIn.length > 1 ? 's' : ''} named ${list(missingIn)}.` };
  const extraIn = inLabels.filter((l) => !challenge.inputs.includes(l));
  if (extraIn.length) return { ok: false, message: `This task only uses inputs ${list(challenge.inputs)}. Remove or rename ${list(extraIn)}.` };
  if (new Set(inLabels).size !== inLabels.length) return { ok: false, message: 'Two inputs have the same name. Give each input a different name.' };

  const missingOut = wantOut.filter((l) => !outLabels.includes(l));
  if (missingOut.length) return { ok: false, message: `Your circuit needs output${missingOut.length > 1 ? 's' : ''} named ${list(missingOut)}.` };
  const extraOut = outLabels.filter((l) => !wantOut.includes(l));
  if (extraOut.length) return { ok: false, message: `This task only needs output${wantOut.length > 1 ? 's' : ''} ${list(wantOut)}. Remove or rename ${list(extraOut)}.` };

  const errors = validateCircuit(circuit).filter((i) => i.severity === 'error');
  if (errors[0]) return { ok: false, message: describeIssue(errors[0], (id) => issueLabel(byId.get(id))) };

  const gates = gateNodes(circuit);
  if (gates.length === 0) return { ok: false, message: 'Add at least one gate.' };
  const banned = [...new Set(gates.filter((g) => !challenge.allowed.includes(g.gate)).map((g) => g.gate))];
  if (banned.length) return { ok: false, message: `This task allows only ${list(challenge.allowed)} gates, but your circuit uses ${list(banned)}.` };

  const order = challenge.inputs.map((l) => inputs.find((n) => n.label === l)?.id as string);
  const table = circuitTruthTable(circuit, order);
  if (!table.ok) return { ok: false, message: 'The circuit cannot be evaluated yet.' };
  const targets = wantOut.map((label) => ({ label, expr: parseExpression(challenge.targets[label] as string), index: table.table.outputLabels.indexOf(label) }));

  for (const row of table.table.rows) {
    const env = Object.fromEntries(challenge.inputs.map((l, k) => [l, row.inputs[k] ?? 0]));
    for (const t of targets) {
      const got = row.outputs[t.index];
      const want = evaluateExpr(t.expr, env);
      if (got !== want) {
        const when = challenge.inputs.map((l, k) => `${l} = ${row.inputs[k]}`).join(', ');
        return { ok: false, message: `Not yet. When ${when}, output ${t.label} is ${got}, but it should be ${want}.` };
      }
    }
  }
  return {
    ok: true,
    message: `Correct! Your circuit gives the right output for all ${table.table.rows.length} input combinations, using ${gates.length} gate${gates.length === 1 ? '' : 's'}.`,
  };
}
