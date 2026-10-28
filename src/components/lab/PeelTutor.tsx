import { useMemo, useState } from 'react';
import { CircuitDiagram } from '@/components/circuits/CircuitDiagram';
import { ExprView } from '@/components/expr/ExprView';
import { IconCheck, IconReset, IconX } from '@/components/icons';
import { exprToCircuit, type PeelStep, peelSteps } from '@/lib/logic/convert';
import { type Expr, parseExpression } from '@/lib/logic/expression';

const CHOICES: { op: PeelStep['operator']; label: string; gate: string }[] = [
  { op: 'not', label: 'A bar over the whole thing', gate: 'NOT' },
  { op: 'or', label: 'A “+” outside all brackets', gate: 'OR' },
  { op: 'and', label: 'A “.” outside all brackets', gate: 'AND' },
  { op: 'xor', label: 'A “⊕” outside all brackets', gate: 'XOR' },
];

const GATE_NAME: Record<PeelStep['operator'], string> = { not: 'NOT', or: 'OR', and: 'AND', xor: 'XOR' };

/**
 * The notes' peeling method (N p.35–36): look at the whole expression, find the
 * outermost operation in the order bar → plus → dot, draw that gate, then
 * repeat for each of its inputs.
 */
export function PeelTutor({ expr, multi, onComplete, onInteract }: { expr: string; multi?: string[]; onComplete?: () => void; onInteract?: () => void }) {
  const parsed = useMemo<Expr>(() => parseExpression(expr, { variables: multi }), [expr, multi]);
  const steps = useMemo(() => peelSteps(parsed), [parsed]);
  const circuit = useMemo(() => exprToCircuit(parsed).circuit, [parsed]);
  const [done, setDone] = useState(0);
  const [wrong, setWrong] = useState<PeelStep['operator'] | null>(null);
  const current = steps[done];
  const finished = done >= steps.length;
  const usesXor = steps.some((s) => s.operator === 'xor');

  const choose = (op: PeelStep['operator']) => {
    if (!current) return;
    onInteract?.();
    if (op === current.operator) {
      setWrong(null);
      const next = done + 1;
      setDone(next);
      if (next >= steps.length) onComplete?.();
    } else setWrong(op);
  };

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
        <span className="font-display text-lg">
          Peel <ExprView expr={parsed} multi={multi} />
        </span>
        <span className="chip ml-auto">
          {Math.min(done, steps.length)} of {steps.length} gates
        </span>
      </div>
      <div className="space-y-4 p-4">
        <ol className="space-y-2">
          {steps.slice(0, done).map((s, i) => (
            <li key={i} className="flex flex-wrap items-baseline gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-[0.95rem]" style={{ marginLeft: `${Math.min(s.level, 4) * 1}rem` }}>
              <IconCheck size={16} className="shrink-0 text-ok" />
              <ExprView expr={s.expression} multi={multi} />
              <span className="text-ink-2">→ {GATE_NAME[s.operator]} gate with input{s.inputs.length > 1 ? 's' : ''}</span>
              {s.inputs.map((inp, k) => (
                <span key={k} className="rounded bg-surface-2 px-1.5">
                  <ExprView expr={inp} multi={multi} />
                </span>
              ))}
            </li>
          ))}
        </ol>

        {current && (
          <div className="space-y-3 rounded-xl border border-accent bg-accent-soft p-4">
            <p className="text-[0.95rem]">
              Look at <ExprView expr={current.expression} multi={multi} className="text-lg" />. What is its <strong>outermost</strong> operation? Check in the order: bar, then plus, then dot.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {CHOICES.filter((c) => c.op !== 'xor' || usesXor).map((c) => (
                <button key={c.op} type="button" className={`btn justify-start text-left ${wrong === c.op ? 'border-bad bg-bad-soft' : 'btn-secondary'}`} onClick={() => choose(c.op)}>
                  {wrong === c.op && <IconX size={16} className="text-bad" />}
                  {c.label} <span className="text-ink-3">→ {c.gate}</span>
                </button>
              ))}
            </div>
            {wrong && (
              <p className="text-sm" role="alert">
                Not that one. {wrong === 'not' ? 'A bar counts only if it covers the whole expression.' : 'Ignore anything inside brackets or under a bar — only operations at the top level count. Plus is checked before dot because dot is done first, so plus is "outside" it.'}
              </p>
            )}
          </div>
        )}

        {finished && (
          <div className="space-y-3">
            <p className="flex items-center gap-2 font-semibold text-ok">
              <IconCheck size={18} /> Peeled! Here is the circuit, drawn from the output back to the inputs.
            </p>
            <div className="rounded-xl border border-line bg-surface p-2">
              <CircuitDiagram circuit={circuit} showValues={false} animate={false} />
            </div>
          </div>
        )}
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => {
            setDone(0);
            setWrong(null);
          }}
        >
          <IconReset size={16} /> Start again
        </button>
      </div>
    </div>
  );
}
