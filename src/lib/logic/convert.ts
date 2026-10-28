import { inputNodes, nodeById, outputNodes } from './circuit';
import { type Expr, compareVariables, toText, variablesOf } from './expression';
import type { Circuit, CircuitNode, GateNode, GateType } from './types';

export interface ExprToCircuitOptions {
  /** Draw NOT-over-AND as one NAND gate (and NOR, XNOR likewise). Default false, as in the notes' peeling method. */
  fuseNegations?: boolean;
  /** Split n-input gates into chains of 2-input gates. */
  twoInputOnly?: boolean;
  /** Label for the output terminal. */
  outputLabel?: string;
  /** Force these inputs to exist (and in this order) even if unused. */
  variables?: string[];
  /** Reuse one gate for identical sub-expressions. Default true. */
  shareSubexpressions?: boolean;
}

export interface ExprCircuit {
  circuit: Circuit;
  /** The sub-expression each gate computes, for labels and step-by-step explanations. */
  gateExpr: Record<string, Expr>;
  outputId: string;
}

const OP_GATE: Record<'and' | 'or' | 'xor', GateType> = { and: 'AND', or: 'OR', xor: 'XOR' };
const NEGATED: Record<'and' | 'or' | 'xor', GateType> = { and: 'NAND', or: 'NOR', xor: 'XNOR' };

/** Build a gate-level circuit that computes an expression. */
export function exprToCircuit(expr: Expr, options: ExprToCircuitOptions = {}): ExprCircuit {
  const vars = options.variables ?? variablesOf(expr);
  const share = options.shareSubexpressions ?? true;
  const nodes: CircuitNode[] = vars.map((name) => ({ kind: 'input', id: name, label: name }));
  const gateExpr: Record<string, Expr> = {};
  const memo = new Map<string, string>();
  let counter = 0;
  const constIds: Partial<Record<0 | 1, string>> = {};

  const addGate = (gate: GateType, inputs: string[], computes: Expr): string => {
    const key = `${gate}(${inputs.join(',')})`;
    if (share && memo.has(key)) return memo.get(key) as string;
    counter += 1;
    // ':' never appears in a variable name, so gate ids cannot collide with inputs such as G1 or K1.
    const id = `gate:${counter}`;
    nodes.push({ kind: 'gate', id, gate, inputs, label: `G${counter}` });
    gateExpr[id] = computes;
    memo.set(key, id);
    return id;
  };

  const chain = (gate: GateType, ids: string[], parts: Expr[], whole: Expr, finalGate: GateType = gate): string => {
    if (!options.twoInputOnly || ids.length <= 2) return addGate(finalGate, ids, whole);
    let acc = ids[0] as string;
    let accExpr = parts[0] as Expr;
    for (let i = 1; i < ids.length; i++) {
      const last = i === ids.length - 1;
      const op = gate === 'AND' ? 'and' : gate === 'OR' ? 'or' : 'xor';
      const partial: Expr = { type: op, operands: [accExpr, parts[i] as Expr] };
      acc = addGate(last ? finalGate : gate, [acc, ids[i] as string], last ? whole : partial);
      accExpr = partial;
    }
    return acc;
  };

  const build = (e: Expr): string => {
    switch (e.type) {
      case 'var':
        return e.name;
      case 'const': {
        const existing = constIds[e.value];
        if (existing) return existing;
        const id = `const:${e.value}`;
        nodes.push({ kind: 'const', id, value: e.value });
        constIds[e.value] = id;
        return id;
      }
      case 'not': {
        const inner = e.operand;
        if (options.fuseNegations && (inner.type === 'and' || inner.type === 'or' || inner.type === 'xor')) {
          const ids = inner.operands.map(build);
          const base = OP_GATE[inner.type];
          return chain(base, ids, inner.operands, e, NEGATED[inner.type]);
        }
        return addGate('NOT', [build(inner)], e);
      }
      case 'and':
      case 'or':
      case 'xor': {
        const ids = e.operands.map(build);
        return chain(OP_GATE[e.type], ids, e.operands, e);
      }
    }
  };

  const top = build(expr);
  const outputId = 'out:F';
  nodes.push({ kind: 'output', id: outputId, label: options.outputLabel ?? 'F', source: top });
  // Inputs first in variable order, then gates in build order, then the output.
  nodes.sort((a, b) => {
    const rank = (n: CircuitNode) => (n.kind === 'input' ? 0 : n.kind === 'const' ? 1 : n.kind === 'gate' ? 2 : 3);
    const r = rank(a) - rank(b);
    if (r !== 0) return r;
    if (a.kind === 'input' && b.kind === 'input') return compareVariables(a.label, b.label);
    return 0;
  });
  return { circuit: { nodes }, gateExpr, outputId };
}

/** Derive the Boolean expression a circuit output computes (gate by gate, from the inputs). */
export function circuitToExpr(circuit: Circuit, outputId?: string): Expr {
  const byId = nodeById(circuit);
  const out = outputId ? byId.get(outputId) : outputNodes(circuit)[0];
  if (!out || out.kind !== 'output' || out.source === null) throw new Error('Circuit has no connected output');
  const visiting = new Set<string>();
  const build = (id: string): Expr => {
    const node = byId.get(id);
    if (!node) throw new Error(`Unknown node ${id}`);
    if (visiting.has(id)) throw new Error('Circuit contains a loop');
    switch (node.kind) {
      case 'input':
        return { type: 'var', name: node.label };
      case 'const':
        return { type: 'const', value: node.value };
      case 'output':
        throw new Error('An output cannot drive another component');
      case 'gate': {
        visiting.add(id);
        const ins = node.inputs.map((s) => {
          if (s === null) throw new Error(`${id} has an unconnected input`);
          return build(s);
        });
        visiting.delete(id);
        return gateToExpr(node, ins);
      }
    }
  };
  return build(out.source);
}

export function gateToExpr(node: Pick<GateNode, 'gate'>, ins: Expr[]): Expr {
  switch (node.gate) {
    case 'NOT':
      return { type: 'not', operand: ins[0] as Expr };
    case 'BUFFER':
      return ins[0] as Expr;
    case 'AND':
      return { type: 'and', operands: ins };
    case 'OR':
      return { type: 'or', operands: ins };
    case 'XOR':
      return { type: 'xor', operands: ins };
    case 'NAND':
      return { type: 'not', operand: { type: 'and', operands: ins } };
    case 'NOR':
      return { type: 'not', operand: { type: 'or', operands: ins } };
    case 'XNOR':
      return { type: 'not', operand: { type: 'xor', operands: ins } };
  }
}

/** Expressions for every gate output in a circuit, keyed by gate id. */
export function gateExpressions(circuit: Circuit): Record<string, Expr> {
  const byId = nodeById(circuit);
  const memo: Record<string, Expr> = {};
  const build = (id: string, depth = 0): Expr => {
    if (memo[id]) return memo[id];
    if (depth > 200) throw new Error('Circuit too deep or cyclic');
    const node = byId.get(id);
    if (!node || node.kind === 'output') throw new Error(`Bad source ${id}`);
    let e: Expr;
    if (node.kind === 'input') e = { type: 'var', name: node.label };
    else if (node.kind === 'const') e = { type: 'const', value: node.value };
    else e = gateToExpr(node, node.inputs.map((s) => (s === null ? ({ type: 'var', name: '?' } as Expr) : build(s, depth + 1))));
    memo[id] = e;
    return e;
  };
  for (const n of circuit.nodes) if (n.kind === 'gate') build(n.id);
  return Object.fromEntries(Object.entries(memo).filter(([id]) => byId.get(id)?.kind === 'gate'));
}

// ------------------------------------------------------------ peeling method

export interface PeelStep {
  /** The (sub-)expression being examined at this step. */
  expression: Expr;
  /** The outermost operator found. */
  operator: 'not' | 'or' | 'and' | 'xor';
  gate: GateType;
  /** The pieces that become this gate's inputs. */
  inputs: Expr[];
  /** How many gates away from the output this gate is (0 = the output gate). */
  level: number;
}

/**
 * The notes' procedure for drawing a circuit from an expression: examine the
 * whole expression, find its outermost operator (a bar over everything, then a
 * top-level "+", then a top-level "."), draw that gate, and treat each operand
 * as a new expression. Returns steps in the order they are drawn (output first).
 */
export function peelSteps(expr: Expr): PeelStep[] {
  const steps: PeelStep[] = [];
  const queue: { e: Expr; level: number }[] = [{ e: expr, level: 0 }];
  const seen = new Set<string>();
  while (queue.length > 0) {
    const { e, level } = queue.shift() as { e: Expr; level: number };
    if (e.type === 'var' || e.type === 'const') continue;
    const key = toText(e);
    if (seen.has(key)) continue;
    seen.add(key);
    const inputs = e.type === 'not' ? [e.operand] : e.operands;
    steps.push({ expression: e, operator: e.type, gate: e.type === 'not' ? 'NOT' : OP_GATE[e.type], inputs, level });
    for (const i of inputs) queue.push({ e: i, level: level + 1 });
  }
  return steps;
}

/** Input labels in a circuit, in node order. */
export function circuitVariables(circuit: Circuit): string[] {
  return inputNodes(circuit).map((n) => n.label);
}
