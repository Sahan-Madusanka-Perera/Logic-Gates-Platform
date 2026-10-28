import { useMemo, useState } from 'react';
import { ScrollRegion } from '@/components/ScrollRegion';
import { Signal, SignalToggle } from '@/components/signals';
import { rippleAdder } from '@/content/circuits';
import { evaluateCircuit } from '@/lib/logic/circuit';
import type { Bit } from '@/lib/logic/types';

/** n-bit ripple-carry adder (N p.61–62). The sums and carries come from evaluating the gate-level circuit. */
export function RippleAdder({ bits = 4, onInteract }: { bits?: number; onInteract?: () => void }) {
  const circuit = useMemo(() => rippleAdder(bits), [bits]);
  const [a, setA] = useState<Bit[]>(() => Array.from({ length: bits }, (_, i) => (i === bits - 2 || i === bits - 3 ? 1 : 0) as Bit));
  const [b, setB] = useState<Bit[]>(() => Array.from({ length: bits }, (_, i) => (i >= bits - 2 ? 1 : 0) as Bit));
  // a[0] is the most significant bit (A3 for 4 bits); input ids are A{i} with i = 0 the least significant bit.
  const assignment: Record<string, Bit> = {};
  for (let i = 0; i < bits; i++) {
    assignment[`A${i}`] = a[bits - 1 - i] as Bit;
    assignment[`B${i}`] = b[bits - 1 - i] as Bit;
  }
  const result = evaluateCircuit(circuit, assignment);
  if (!result.ok) return null;
  const v = result.values;
  const carryInto = (i: number): Bit | null => (i === 0 ? null : ((i === 1 ? v.n0 : v[`c${i - 1}`]) as Bit));
  const carryOut = (i: number): Bit => (i === 0 ? v.n0 : v[`c${i}`]) as Bit;
  const sum = Array.from({ length: bits }, (_, i) => result.outputs[`S${i}`] as Bit);
  const cout = result.outputs.Cout as Bit;
  const toNum = (xs: Bit[]) => xs.reduce<number>((acc, x) => acc * 2 + x, 0);
  const total = toNum([cout, ...[...sum].reverse()]);

  const flip = (which: 'a' | 'b', k: number, val: Bit) => {
    (which === 'a' ? setA : setB)((xs) => xs.map((x, j) => (j === k ? val : x)) as Bit[]);
    onInteract?.();
  };

  return (
    <div className="card space-y-4 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {(['a', 'b'] as const).map((which) => {
          const xs = which === 'a' ? a : b;
          return (
            <div key={which}>
              <p className="mb-1.5 text-sm font-semibold">
                {which.toUpperCase()} = <span className="font-mono">{xs.join('')}</span> <span className="text-ink-3">({toNum(xs)} in decimal)</span>
              </p>
              <div className="flex flex-wrap gap-1.5">
                {xs.map((x, k) => (
                  <SignalToggle key={k} label={`${which.toUpperCase()}${bits - 1 - k}`} value={x} onChange={(val) => flip(which, k, val)} size="sm" />
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <ScrollRegion label="Adder stages">
        <div className="flex min-w-max gap-2" role="list" aria-label="Adder stages, most significant first">
          {Array.from({ length: bits }, (_, k) => bits - 1 - k).map((i) => (
            <div key={i} role="listitem" className="w-36 rounded-xl border border-line-strong bg-surface p-2.5 text-sm">
              <p className="font-semibold">
                Bit {i}: {i === 0 ? 'half adder' : 'full adder'}
              </p>
              <dl className="mt-1.5 grid grid-cols-[auto_1fr] items-center gap-x-2 gap-y-1">
                <dt className="text-ink-2">A{i}, B{i}</dt>
                <dd className="flex gap-1">
                  <Signal value={assignment[`A${i}`]} />
                  <Signal value={assignment[`B${i}`]} />
                </dd>
                <dt className="text-ink-2">carry in</dt>
                <dd>{i === 0 ? <span className="text-ink-3">none</span> : <Signal value={carryInto(i)} />}</dd>
                <dt className="text-ink-2">sum S{i}</dt>
                <dd>
                  <Signal value={sum[i]} />
                </dd>
                <dt className="text-ink-2">carry out</dt>
                <dd>
                  <Signal value={carryOut(i)} />
                </dd>
              </dl>
            </div>
          ))}
        </div>
      </ScrollRegion>
      <p className="rounded-xl border border-line bg-surface-2 p-3 font-mono text-base" aria-live="polite">
        {a.join('')} + {b.join('')} = {cout}
        {[...sum].reverse().join('')} <span className="font-sans text-sm text-ink-2">({toNum(a)} + {toNum(b)} = {total})</span>
      </p>
      <p className="text-sm text-ink-2">Each carry out becomes the next stage&apos;s carry in — it “ripples” from bit 0 to the left. The final carry out is the extra bit at the front of the answer.</p>
    </div>
  );
}
