import { evaluateGate } from './gates';
import type { Bit } from './types';

/**
 * Latches from the notes (N p.64–70):
 *  - 'nor':    Q = NOR(R, Q̄), Q̄ = NOR(S, Q). Active-high inputs; S = R = 1 is not allowed.
 *  - 'nand':   Q = NAND(S, Q̄), Q̄ = NAND(R, Q). Active-low inputs; S = R = 0 is not allowed.
 *  - 'or-and': the notes' feedback loop, Q = (S + Q).R̄. Reset wins, so there is no forbidden input.
 */
export type LatchKind = 'nor' | 'nand' | 'or-and';

export interface LatchState {
  /** null when the state cannot be predicted (after leaving the forbidden input). */
  q: Bit | null;
  qBar: Bit | null;
}

export type LatchMode = 'set' | 'reset' | 'memory' | 'forbidden' | 'unpredictable';

export interface LatchStep {
  s: Bit;
  r: Bit;
  before: LatchState;
  after: LatchState;
  mode: LatchMode;
}

export function initialLatchState(kind: LatchKind): LatchState {
  return kind === 'or-and' ? { q: 0, qBar: 1 } : { q: 0, qBar: 1 };
}

export function latchMode(kind: LatchKind, s: Bit, r: Bit): Exclude<LatchMode, 'unpredictable'> {
  if (kind === 'nand') {
    if (s === 0 && r === 0) return 'forbidden';
    if (s === 0) return 'set';
    if (r === 0) return 'reset';
    return 'memory';
  }
  if (kind === 'nor' && s === 1 && r === 1) return 'forbidden';
  if (r === 1) return 'reset';
  if (s === 1) return 'set';
  return 'memory';
}

/** Apply new inputs and let the cross-coupled gates settle. */
export function stepLatch(kind: LatchKind, before: LatchState, s: Bit, r: Bit): LatchStep {
  const mode = latchMode(kind, s, r);
  if (kind === 'or-and') {
    const prev = before.q ?? 0;
    const q = evaluateGate('AND', [evaluateGate('OR', [s, prev]), evaluateGate('NOT', [r])]);
    return { s, r, before, after: { q, qBar: q === 1 ? 0 : 1 }, mode };
  }
  if (mode === 'memory' && (before.q === null || before.q === before.qBar)) {
    // Leaving the forbidden input: both gates race and the result cannot be predicted.
    return { s, r, before, after: { q: null, qBar: null }, mode: 'unpredictable' };
  }
  const gate = kind === 'nor' ? 'NOR' : 'NAND';
  let q: Bit = before.q ?? 0;
  let qBar: Bit = before.qBar ?? (q === 1 ? 0 : 1);
  for (let i = 0; i < 8; i++) {
    const nq = evaluateGate(gate, [kind === 'nor' ? r : s, qBar]);
    const nqBar = evaluateGate(gate, [kind === 'nor' ? s : r, nq]);
    if (nq === q && nqBar === qBar) break;
    q = nq;
    qBar = nqBar;
  }
  return { s, r, before, after: { q, qBar }, mode };
}

export function runLatch(kind: LatchKind, inputs: { s: Bit; r: Bit }[], start: LatchState = initialLatchState(kind)): LatchStep[] {
  const steps: LatchStep[] = [];
  let state = start;
  for (const { s, r } of inputs) {
    const step = stepLatch(kind, state, s, r);
    steps.push(step);
    state = step.after;
  }
  return steps;
}
