import { useId, useMemo, useState } from 'react';
import { ExprView } from '@/components/expr/ExprView';
import { ExpressionInput } from '@/components/expr/ExpressionInput';
import { IconCheck, IconReset, IconUndo, IconX } from '@/components/icons';
import { RichInline } from '@/components/RichText';
import { equivalent, type Expr, literalCount, outputsOf, parseExpression, toText, tryParse, variablesOf } from '@/lib/logic/expression';
import { checkStep, LAW_FORMS, lawLabel, type LawName, LAWS, type StepCheck } from '@/lib/logic/laws';
import { leftoverStep, minimalLiteralCount } from '@/lib/logic/minimize';

export interface WorkedStep {
  expr: string;
  law: string;
}

interface Step {
  expr: Expr;
  text: string;
  law: LawName;
}

const orList = (laws: readonly string[]) => laws.join(' or the ');

/** Why a step that keeps the truth table was still not accepted. */
function lawFeedback(check: Exclude<StepCheck, { ok: true }>, law: LawName): string {
  switch (check.reason) {
    case 'unchanged':
      return 'This line is the same as the line before. Apply a law to change it.';
    case 'reorder':
      return `Both lines are equal. This step only ${check.laws.includes('Commutative law') ? 'changes the order of terms' : 'moves the brackets'}, which is the ${orList(check.laws)}, not the ${law}. Change “Law used” and check again.`;
    case 'other-law':
      return `Both lines are equal, but this step uses the ${orList(check.laws)}, not the ${law}. Change “Law used” and check again.`;
    case 'several-laws':
      return 'Both lines are equal, but no single law turns the previous line into this one. Write one law per line: you can apply the same law in several places at once, but start a new line for each different law.';
  }
}

/**
 * Step-by-step simplification. Each step must keep the truth table (every row
 * is compared) and must follow from the line before by the law the student
 * names (see laws.ts), so a correct answer typed in one jump is not accepted.
 */
export function SimplifyChecker({ start, worked, onComplete, onInteract }: { start: string; worked?: WorkedStep[]; onComplete?: () => void; onInteract?: () => void }) {
  const first = useMemo(() => parseExpression(start), [start]);
  const vars = useMemo(() => variablesOf(first), [first]);
  const best = useMemo(() => minimalLiteralCount(outputsOf(first, vars), vars), [first, vars]);
  const [steps, setSteps] = useState<Step[]>([]);
  const [text, setText] = useState('');
  const [law, setLaw] = useState<LawName>(LAWS[2]);
  const [error, setError] = useState<string | null>(null);
  const [showWorked, setShowWorked] = useState(false);
  const formsId = useId();
  const last = steps[steps.length - 1]?.expr ?? first;
  const shortest = literalCount(last) <= best;
  // Fewest variables is not enough: B.1 still simplifies to B (Identity law).
  const leftover = useMemo(() => (shortest ? leftoverStep(last) : null), [shortest, last]);
  const reached = shortest && leftover === null;

  const add = () => {
    onInteract?.();
    const parsed = tryParse(text);
    if (!parsed.ok) {
      setError(`Can't read that: ${parsed.error.message}.`);
      return;
    }
    const extra = variablesOf(parsed.expr).filter((n) => !vars.includes(n));
    if (extra.length > 0) {
      setError(`Only ${vars.join(', ')} appear in this expression. Remove ${extra.join(', ')}.`);
      return;
    }
    const eq = equivalent(parsed.expr, last);
    if (!eq.equivalent) {
      const where = Object.entries(eq.counterexample)
        .filter(([n]) => vars.includes(n))
        .map(([n, b]) => `${n} = ${b}`)
        .join(', ');
      setError(`This step changes the function: when ${where}, your new line gives ${eq.left} but the previous line gives ${eq.right}. Check the last law you applied.`);
      return;
    }
    const check = checkStep(last, parsed.expr, law);
    if (!check.ok) {
      setError(lawFeedback(check, law));
      return;
    }
    setError(null);
    const next = [...steps, { expr: parsed.expr, text, law }];
    setSteps(next);
    setText('');
    if (literalCount(parsed.expr) <= best && !leftoverStep(parsed.expr)) onComplete?.();
  };

  return (
    <div className="card space-y-4 p-4">
      <div className="space-y-1.5 rounded-xl border border-line bg-surface px-4 py-3">
        <p className="flex flex-wrap items-baseline gap-2 text-lg">
          <span className="w-6 text-sm text-ink-3">1</span>
          <ExprView expr={first} />
          <span className="text-sm text-ink-3">(given)</span>
        </p>
        {steps.map((s, i) => (
          <p key={i} className="flex flex-wrap items-baseline gap-2 text-lg">
            <span className="w-6 text-sm text-ink-3">{i + 2}</span>
            <span className="text-ink-3">=</span>
            <ExprView expr={s.expr} />
            <span className="text-sm text-ink-2">({s.law})</span>
            <IconCheck size={16} className="text-ok" />
            <span className="sr-only">checked: equal to the line before, using this law</span>
          </p>
        ))}
      </div>
      {reached && steps.length > 0 ? (
        <p className="flex items-center gap-2 rounded-xl border border-ok bg-ok-soft p-3 font-semibold text-ok" role="status">
          <IconCheck size={18} /> Fully simplified: {literalCount(last)} variable occurrence{literalCount(last) === 1 ? '' : 's'}, the fewest possible, and no law can shorten it further.
        </p>
      ) : (
        <div className="space-y-3">
          {leftover && (
            <p className="rounded-xl border border-info bg-info-soft p-3 text-sm" role="status">
              <span className="font-semibold">Nearly there.</span> This line already has the fewest variables possible, but{' '}
              <RichInline text={`[[${toText(leftover.at)}]]`} /> can still be simplified{leftover.law ? ` with the ${leftover.law}` : ''}: <RichInline text={`[[${leftover.rule}]]`} />.
            </p>
          )}
          <ExpressionInput value={text} onChange={setText} variables={vars} label="Next line" onSubmit={add} placeholder="Type the next step" />
          <div className="space-y-1.5">
            <label className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-semibold">Law used</span>
              <select
                value={law}
                onChange={(e) => {
                  setLaw(e.target.value as LawName);
                  setError(null);
                }}
                aria-describedby={formsId}
                className="rounded-lg border border-line-strong bg-surface px-2 py-2"
              >
                {LAWS.map((l) => (
                  <option key={l} value={l}>
                    {lawLabel(l)}
                  </option>
                ))}
              </select>
            </label>
            <p id={formsId} className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-2">
              {LAW_FORMS[law].map((f) => (
                <RichInline key={f} text={`[[${f}]]`} />
              ))}
            </p>
          </div>
          {error && (
            <p className="flex gap-2 rounded-xl border border-bad bg-bad-soft p-3 text-sm" role="alert">
              <IconX size={18} className="mt-0.5 shrink-0 text-bad" /> {error}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-primary btn-sm" onClick={add} disabled={!text.trim()}>
              Check this step
            </button>
            <button type="button" className="btn btn-secondary btn-sm" disabled={steps.length === 0} onClick={() => setSteps((s) => s.slice(0, -1))}>
              <IconUndo size={16} /> Remove last step
            </button>
          </div>
          <p className="text-xs text-ink-3">
            Current: {literalCount(last)} variable occurrences · simplest possible: {best}. Each step must give the same output as the line before on every input row, and must follow from it by the law you choose. You can apply that law in several places in one line, and reorder terms as you go.
          </p>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {worked && (
          <button type="button" className="btn btn-ghost btn-sm" aria-expanded={showWorked} onClick={() => setShowWorked((s) => !s)}>
            {showWorked ? 'Hide' : 'Show'} a worked solution
          </button>
        )}
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => {
            setSteps([]);
            setError(null);
            setText('');
          }}
        >
          <IconReset size={16} /> Start again
        </button>
      </div>
      {showWorked && worked && (
        <ol className="space-y-1 rounded-xl border border-info bg-info-soft p-4">
          {worked.map((w, i) => (
            <li key={i} className="flex flex-wrap items-baseline gap-2">
              <span className="text-ink-3">{i === 0 ? '' : '='}</span>
              <RichInline text={`[[${w.expr}]]`} />
              {w.law && <span className="text-sm text-ink-2">({w.law})</span>}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
