/** A logical value. Always 0 or 1 — never a JavaScript truthy/falsy value. */
export type Bit = 0 | 1;

export const GATE_TYPES = ['NOT', 'BUFFER', 'AND', 'OR', 'NAND', 'NOR', 'XOR', 'XNOR'] as const;
export type GateType = (typeof GATE_TYPES)[number];

/** Gates that take exactly one input. */
export const UNARY_GATES: readonly GateType[] = ['NOT', 'BUFFER'];

export const MAX_GATE_INPUTS = 8;

export interface InputNode {
  kind: 'input';
  id: string;
  label: string;
}

export interface ConstNode {
  kind: 'const';
  id: string;
  value: Bit;
}

export interface GateNode {
  kind: 'gate';
  id: string;
  gate: GateType;
  /** Source node id for each input pin, or null when the pin is not connected yet. */
  inputs: (string | null)[];
  label?: string;
}

export interface OutputNode {
  kind: 'output';
  id: string;
  label: string;
  source: string | null;
}

export type CircuitNode = InputNode | ConstNode | GateNode | OutputNode;

export interface Point {
  x: number;
  y: number;
}

export interface Circuit {
  nodes: CircuitNode[];
  /** Optional hand-placed positions (used by the builder). Diagrams auto-layout otherwise. */
  layout?: Record<string, Point>;
}

/** Values for the circuit's input nodes, keyed by input node id. */
export type Assignment = Record<string, Bit>;

export type IssueSeverity = 'error' | 'warning';

export type CircuitIssue =
  | { code: 'duplicate-id'; severity: 'error'; nodeId: string }
  | { code: 'unknown-gate'; severity: 'error'; nodeId: string; gate: string }
  | { code: 'bad-arity'; severity: 'error'; nodeId: string; gate: GateType; count: number }
  | { code: 'missing-input'; severity: 'error'; nodeId: string; pin: number }
  | { code: 'unknown-source'; severity: 'error'; nodeId: string; pin: number; sourceId: string }
  | { code: 'output-as-source'; severity: 'error'; nodeId: string; pin: number; sourceId: string }
  | { code: 'cycle'; severity: 'error'; nodeIds: string[] }
  | { code: 'no-outputs'; severity: 'error' }
  | { code: 'output-unconnected'; severity: 'error'; nodeId: string }
  | { code: 'missing-value'; severity: 'error'; nodeId: string }
  | { code: 'unused-gate'; severity: 'warning'; nodeId: string }
  | { code: 'unused-input'; severity: 'warning'; nodeId: string };

export interface EvalStep {
  /** 1-based position in the evaluation order. */
  index: number;
  nodeId: string;
  gate: GateType;
  sources: string[];
  inputValues: Bit[];
  output: Bit;
}

export type EvaluationResult =
  | {
      ok: true;
      values: Record<string, Bit>;
      outputs: Record<string, Bit>;
      steps: EvalStep[];
      order: string[];
    }
  | { ok: false; issues: CircuitIssue[] };
