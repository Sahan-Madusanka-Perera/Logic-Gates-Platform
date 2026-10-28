import { evaluateGate, isBit, isGateType, isValidArity } from './gates';
import type {
  Assignment,
  Bit,
  Circuit,
  CircuitIssue,
  CircuitNode,
  EvalStep,
  EvaluationResult,
  GateNode,
  InputNode,
  OutputNode,
} from './types';

export function inputNodes(circuit: Circuit): InputNode[] {
  return circuit.nodes.filter((n): n is InputNode => n.kind === 'input');
}

export function outputNodes(circuit: Circuit): OutputNode[] {
  return circuit.nodes.filter((n): n is OutputNode => n.kind === 'output');
}

export function gateNodes(circuit: Circuit): GateNode[] {
  return circuit.nodes.filter((n): n is GateNode => n.kind === 'gate');
}

export function nodeById(circuit: Circuit): Map<string, CircuitNode> {
  return new Map(circuit.nodes.map((n) => [n.id, n]));
}

/** Ids of the nodes a node reads from (null pins are skipped). */
export function sourcesOf(node: CircuitNode): string[] {
  if (node.kind === 'gate') return node.inputs.filter((s): s is string => s !== null);
  if (node.kind === 'output') return node.source === null ? [] : [node.source];
  return [];
}

/**
 * Deterministic topological order (Kahn's algorithm, ties broken by declaration order).
 * Returns the ids of nodes that sit on or behind a cycle as `cyclic`.
 */
export function topologicalOrder(circuit: Circuit): { order: string[]; cyclic: string[] } {
  const byId = nodeById(circuit);
  const indegree = new Map<string, number>();
  const dependents = new Map<string, string[]>();
  for (const node of circuit.nodes) {
    indegree.set(node.id, 0);
    dependents.set(node.id, []);
  }
  for (const node of circuit.nodes) {
    for (const src of sourcesOf(node)) {
      if (!byId.has(src)) continue;
      indegree.set(node.id, (indegree.get(node.id) ?? 0) + 1);
      dependents.get(src)?.push(node.id);
    }
  }
  const position = new Map(circuit.nodes.map((n, i) => [n.id, i]));
  const ready = circuit.nodes.filter((n) => indegree.get(n.id) === 0).map((n) => n.id);
  const order: string[] = [];
  while (ready.length > 0) {
    ready.sort((a, b) => (position.get(a) ?? 0) - (position.get(b) ?? 0));
    const id = ready.shift() as string;
    order.push(id);
    for (const dep of dependents.get(id) ?? []) {
      const d = (indegree.get(dep) ?? 0) - 1;
      indegree.set(dep, d);
      if (d === 0) ready.push(dep);
    }
  }
  const placed = new Set(order);
  const cyclic = circuit.nodes.filter((n) => !placed.has(n.id)).map((n) => n.id);
  return { order, cyclic };
}

/** Structural checks. Errors make a circuit impossible to evaluate; warnings are advice. */
export function validateCircuit(circuit: Circuit): CircuitIssue[] {
  const issues: CircuitIssue[] = [];
  const seen = new Set<string>();
  for (const node of circuit.nodes) {
    if (seen.has(node.id)) issues.push({ code: 'duplicate-id', severity: 'error', nodeId: node.id });
    seen.add(node.id);
  }
  const byId = nodeById(circuit);
  const used = new Set<string>();

  for (const node of circuit.nodes) {
    if (node.kind === 'const' && !isBit(node.value)) {
      issues.push({ code: 'missing-value', severity: 'error', nodeId: node.id });
    }
    if (node.kind === 'gate') {
      if (!isGateType(node.gate)) {
        issues.push({ code: 'unknown-gate', severity: 'error', nodeId: node.id, gate: String(node.gate) });
        continue;
      }
      if (!isValidArity(node.gate, node.inputs.length)) {
        issues.push({ code: 'bad-arity', severity: 'error', nodeId: node.id, gate: node.gate, count: node.inputs.length });
      }
      node.inputs.forEach((src, pin) => {
        if (src === null) {
          issues.push({ code: 'missing-input', severity: 'error', nodeId: node.id, pin });
          return;
        }
        const source = byId.get(src);
        if (!source) issues.push({ code: 'unknown-source', severity: 'error', nodeId: node.id, pin, sourceId: src });
        else if (source.kind === 'output') issues.push({ code: 'output-as-source', severity: 'error', nodeId: node.id, pin, sourceId: src });
        else used.add(src);
      });
    }
    if (node.kind === 'output') {
      if (node.source === null) {
        issues.push({ code: 'output-unconnected', severity: 'error', nodeId: node.id });
      } else {
        const source = byId.get(node.source);
        if (!source) issues.push({ code: 'unknown-source', severity: 'error', nodeId: node.id, pin: 0, sourceId: node.source });
        else if (source.kind === 'output') issues.push({ code: 'output-as-source', severity: 'error', nodeId: node.id, pin: 0, sourceId: node.source });
        else used.add(node.source);
      }
    }
  }

  if (!circuit.nodes.some((n) => n.kind === 'output')) issues.push({ code: 'no-outputs', severity: 'error' });

  const { cyclic } = topologicalOrder(circuit);
  if (cyclic.length > 0) issues.push({ code: 'cycle', severity: 'error', nodeIds: cyclic });

  for (const node of circuit.nodes) {
    if (node.kind === 'gate' && !used.has(node.id)) issues.push({ code: 'unused-gate', severity: 'warning', nodeId: node.id });
    if (node.kind === 'input' && !used.has(node.id)) issues.push({ code: 'unused-input', severity: 'warning', nodeId: node.id });
  }
  return issues;
}

export function hasErrors(issues: readonly CircuitIssue[]): boolean {
  return issues.some((i) => i.severity === 'error');
}

/**
 * Evaluate every node of a circuit for one input assignment.
 * An invalid circuit never returns values — it returns the issues instead.
 */
export function evaluateCircuit(circuit: Circuit, assignment: Assignment): EvaluationResult {
  const issues = validateCircuit(circuit).filter((i) => i.severity === 'error');
  for (const input of inputNodes(circuit)) {
    if (!isBit(assignment[input.id])) issues.push({ code: 'missing-value', severity: 'error', nodeId: input.id });
  }
  if (issues.length > 0) return { ok: false, issues };

  const byId = nodeById(circuit);
  const { order } = topologicalOrder(circuit);
  const values: Record<string, Bit> = {};
  const outputs: Record<string, Bit> = {};
  const steps: EvalStep[] = [];

  for (const id of order) {
    const node = byId.get(id) as CircuitNode;
    switch (node.kind) {
      case 'input':
        values[id] = assignment[id] as Bit;
        break;
      case 'const':
        values[id] = node.value;
        break;
      case 'gate': {
        const sources = node.inputs as string[];
        const inputValues = sources.map((s) => values[s] as Bit);
        const output = evaluateGate(node.gate, inputValues);
        values[id] = output;
        steps.push({ index: steps.length + 1, nodeId: id, gate: node.gate, sources, inputValues, output });
        break;
      }
      case 'output':
        values[id] = values[node.source as string] as Bit;
        outputs[id] = values[id];
        break;
    }
  }
  return { ok: true, values, outputs, steps, order };
}

/** Evaluate and throw on an invalid circuit — for content that is known to be valid (tested). */
export function evaluateOrThrow(circuit: Circuit, assignment: Assignment) {
  const result = evaluateCircuit(circuit, assignment);
  if (!result.ok) throw new Error(`Invalid circuit: ${result.issues.map((i) => i.code).join(', ')}`);
  return result;
}

/** Longest distance (in gates) from any input to each node — used for layout and step grouping. */
export function nodeDepths(circuit: Circuit): Record<string, number> {
  const byId = nodeById(circuit);
  const { order } = topologicalOrder(circuit);
  const depth: Record<string, number> = {};
  for (const id of order) {
    const node = byId.get(id) as CircuitNode;
    const srcs = sourcesOf(node).filter((s) => depth[s] !== undefined);
    const base = srcs.length === 0 ? 0 : Math.max(...srcs.map((s) => depth[s] as number));
    depth[id] = node.kind === 'gate' ? base + 1 : node.kind === 'output' ? base + 1 : 0;
  }
  return depth;
}

export function describeIssue(issue: CircuitIssue, label: (id: string) => string = (id) => id): string {
  switch (issue.code) {
    case 'duplicate-id':
      return `Two components share the id "${issue.nodeId}".`;
    case 'unknown-gate':
      return `${label(issue.nodeId)} uses an unknown gate type "${issue.gate}".`;
    case 'bad-arity':
      return issue.gate === 'NOT' || issue.gate === 'BUFFER'
        ? `${label(issue.nodeId)} is a ${issue.gate} gate, which takes exactly one input.`
        : `${label(issue.nodeId)} is a ${issue.gate} gate, which needs at least two inputs.`;
    case 'missing-input':
      return `Input ${issue.pin + 1} of ${label(issue.nodeId)} is not connected to anything.`;
    case 'unknown-source':
      return `${label(issue.nodeId)} is wired to a component that does not exist.`;
    case 'output-as-source':
      return `${label(issue.nodeId)} takes its value from an output terminal. Outputs can only receive signals.`;
    case 'cycle':
      return `There is a loop: a gate's output feeds back into its own input path (${issue.nodeIds.map(label).join(', ')}). This lab only evaluates combinational circuits — use the SR latch simulator for feedback circuits.`;
    case 'no-outputs':
      return 'Add an output so the circuit has a result to show.';
    case 'output-unconnected':
      return `Output ${label(issue.nodeId)} is not connected to any gate or input.`;
    case 'missing-value':
      return `${label(issue.nodeId)} has no value (it must be 0 or 1).`;
    case 'unused-gate':
      return `${label(issue.nodeId)} is not connected to the output, so it has no effect.`;
    case 'unused-input':
      return `Input ${label(issue.nodeId)} is not used by any gate.`;
  }
}
