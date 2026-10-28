import { useState } from 'react';
import { IconReset, IconWarn } from '@/components/icons';
import { ScrollRegion } from '@/components/ScrollRegion';
import { SignalToggle } from '@/components/signals';
import { initialLatchState, type LatchKind, type LatchMode, type LatchState, type LatchStep, stepLatch } from '@/lib/logic/sequential';
import type { Bit } from '@/lib/logic/types';
import { LatchDiagram } from './LatchDiagram';

const MODE_TEXT: Record<LatchKind, Record<LatchMode, string>> = {
  nor: {
    set: 'Set: S = 1 makes Q = 1.',
    reset: 'Reset: R = 1 makes Q = 0.',
    memory: 'Memory: S = R = 0, so Q keeps its previous value.',
    forbidden: 'Not allowed: S = R = 1 forces Q and Q̄ both to 0.',
    unpredictable: 'Unpredictable: after S = R = 1, the gates race and Q could settle at 0 or 1.',
  },
  nand: {
    set: 'Set: S = 0 (active-low) makes Q = 1.',
    reset: 'Reset: R = 0 (active-low) makes Q = 0.',
    memory: 'Memory: S = R = 1, so Q keeps its previous value.',
    forbidden: 'Not allowed: S = R = 0 forces Q and Q̄ both to 1.',
    unpredictable: 'Unpredictable: after S = R = 0, the gates race and Q could settle at 0 or 1.',
  },
  'or-and': {
    set: 'S = 1 feeds a 1 into the OR gate; with R = 0 it passes through the AND gate, so Q = 1.',
    reset: 'R = 1 makes NOT R = 0, so the AND gate outputs 0: Q = 0.',
    memory: 'S = R = 0: the OR gate receives Q itself, so Q is fed back and stays the same.',
    forbidden: '',
    unpredictable: '',
  },
};

/** Interactive latch (N p.64–70). Every step is computed by the sequential engine. */
export function LatchSimulator({ kind, onInteract }: { kind: LatchKind; onInteract?: () => void }) {
  const idle: { s: Bit; r: Bit } = kind === 'nand' ? { s: 1, r: 1 } : { s: 0, r: 0 };
  const [inputs, setInputs] = useState(idle);
  const [state, setState] = useState<LatchState>(() => initialLatchState(kind));
  const [history, setHistory] = useState<LatchStep[]>([]);
  const last = history[history.length - 1];

  const apply = (s: Bit, r: Bit) => {
    const step = stepLatch(kind, state, s, r);
    setInputs({ s, r });
    setState(step.after);
    setHistory((h) => [...h, step].slice(-8));
    onInteract?.();
  };

  const reset = () => {
    setInputs(idle);
    setState(initialLatchState(kind));
    setHistory([]);
  };

  const warn = last && (last.mode === 'forbidden' || last.mode === 'unpredictable');
  const title = kind === 'nor' ? 'NOR SR latch' : kind === 'nand' ? 'NAND SR latch (active-low)' : 'Feedback loop: Q = (S + Q).R̄';

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
        <span className="font-display text-lg">{title}</span>
        <div className="ml-auto flex flex-wrap gap-2">
          <SignalToggle label="S" value={inputs.s} onChange={(v) => apply(v, inputs.r)} size="sm" />
          <SignalToggle label="R" value={inputs.r} onChange={(v) => apply(inputs.s, v)} size="sm" />
          <button type="button" className="btn btn-ghost btn-sm" onClick={reset}>
            <IconReset size={16} /> Reset
          </button>
        </div>
      </div>
      <div className="grid gap-4 p-4 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div className="space-y-3">
          <div className="flex justify-center rounded-xl border border-line bg-surface p-2">
            <LatchDiagram kind={kind} s={inputs.s} r={inputs.r} q={state.q} qBar={state.qBar} />
          </div>
          <div className="flex flex-wrap gap-3 font-mono text-lg">
            <span className="rounded-lg border border-line bg-surface px-3 py-1">Q = {state.q ?? '?'}</span>
            {kind !== 'or-and' && <span className="rounded-lg border border-line bg-surface px-3 py-1">Q̄ = {state.qBar ?? '?'}</span>}
          </div>
          <p className={`rounded-xl border p-3 text-[0.95rem] ${warn ? 'border-bad bg-bad-soft' : 'border-line bg-surface-2'}`} aria-live="polite">
            {warn && <IconWarn size={18} className="mr-1 inline text-bad" />}
            {last ? MODE_TEXT[kind][last.mode] : kind === 'nand' ? 'Inputs are active-low: S = R = 1 means "no change". Press S or R to make it 0.' : 'Change S or R to set, reset or hold the stored bit.'}
          </p>
        </div>
        <div>
          <h4 className="mb-2 font-display text-lg">What happened</h4>
          {history.length === 0 ? (
            <p className="text-sm text-ink-2">Each change you make is listed here, so you can see that the same inputs can give a different Q depending on what happened before.</p>
          ) : (
            <ScrollRegion label="History table">
              <table className="w-full border-collapse text-center text-sm">
                <thead>
                  <tr className="text-ink-2">
                    <th className="border-b border-line px-2 py-1.5 font-semibold">Step</th>
                    <th className="border-b border-line px-2 py-1.5 font-semibold">S</th>
                    <th className="border-b border-line px-2 py-1.5 font-semibold">R</th>
                    <th className="border-b border-line px-2 py-1.5 font-semibold">Q before</th>
                    <th className="border-b border-line px-2 py-1.5 font-semibold">Q after</th>
                    <th className="border-b border-line px-2 py-1.5 font-semibold">State</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h, i) => (
                    <tr key={i} className="border-t border-line font-mono">
                      <td className="px-2 py-1">{i + 1}</td>
                      <td className="px-2 py-1">{h.s}</td>
                      <td className="px-2 py-1">{h.r}</td>
                      <td className="px-2 py-1">{h.before.q ?? '?'}</td>
                      <td className="px-2 py-1 font-semibold">{h.after.q ?? '?'}</td>
                      <td className="px-2 py-1 font-sans">{h.mode === 'forbidden' ? 'not allowed' : h.mode}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollRegion>
          )}
        </div>
      </div>
    </div>
  );
}
