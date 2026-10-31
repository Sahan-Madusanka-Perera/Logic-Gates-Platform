import { useId, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { ExprView } from '@/components/expr/ExprView';
import { ExpressionInput } from '@/components/expr/ExpressionInput';
import { IconCheck, IconHint, IconReset, IconSpark, IconUndo, IconX } from '@/components/icons';
import { RichInline } from '@/components/RichText';
import { equivalent, type Expr, literalCount, outputsOf, parseExpression, toText, tryParse, variablesOf } from '@/lib/logic/expression';
import { simplestForm, type SolveStep, solveSimplification } from '@/lib/logic/lawSolver';
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
  /** Added from a hint or the solution, not typed. */
  shown?: boolean;
}

/** Help for the current line: the law only, then the line itself. */
interface Help {
  level: 'law' | 'line';
  step: SolveStep | null;
}

/** A full solution from one line of the working. */
interface Shown {
  /** The line number the solution starts from (1 is the given expression). */
  from: number;
  steps: SolveStep[];
  complete: boolean;
  /** Lines revealed so far. */
  revealed: number;
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
      return 'Both lines are equal, but no single law turns the previous line into this one. Write one law per line: you can apply the same law in several places at once, but start a new line for each different law. Stuck? Press “Hint” to see which law to use first.';
  }
}

function Line({ n, expr, law, note, tag, given }: { n: number; expr: Expr; law?: string; note?: string; tag?: string; given?: boolean }) {
  return (
    <li className="space-y-0.5">
      <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-lg">
        <span className="w-6 shrink-0 text-sm text-ink-3">{n}</span>
        {!given && <span className="text-ink-3">=</span>}
        <ExprView expr={expr} />
        {law && <span className="text-sm text-ink-2">({law})</span>}
        {tag && <span className="text-xs font-semibold text-info">{tag}</span>}
      </p>
      {note && (
        <p className="pl-8 text-sm text-ink-2">
          <RichInline text={note} />
        </p>
      )}
    </li>
  );
}

/**
 * Step-by-step simplification. Each step must keep the truth table (every row
 * is compared) and must follow from the line before by the law the student
 * names (see laws.ts), so a correct answer typed in one jump is not accepted.
 *
 * When stuck, the student can ask for the law to use next, then for the next
 * line, or for a full solution from their current line, revealed a line at a
 * time (lawSolver.ts). Every line the solver shows passes the same checker.
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
  const [help, setHelp] = useState<Help | null>(null);
  const [solution, setSolution] = useState<Shown | null>(null);
  const formsId = useId();
  const last = steps[steps.length - 1]?.expr ?? first;
  const shortest = literalCount(last) <= best;
  // Fewest variables is not enough: B.1 still simplifies to B (Identity law).
  const leftover = useMemo(() => (shortest ? leftoverStep(last) : null), [shortest, last]);
  const reached = shortest && leftover === null;

  const changeSteps = (next: Step[]) => {
    setSteps(next);
    setHelp(null);
    setError(null);
  };

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
    changeSteps([...steps, { expr: parsed.expr, text, law }]);
    setText('');
    if (literalCount(parsed.expr) <= best && !leftoverStep(parsed.expr)) onComplete?.();
  };

  const askHelp = (level: Help['level']) => {
    onInteract?.();
    const step = solveSimplification(last).steps[0] ?? null;
    setHelp({ level, step });
    setError(null);
    if (step) setLaw(step.law);
  };

  const appendLines = (lines: SolveStep[]) => {
    changeSteps([...steps, ...lines.map((s) => ({ expr: s.expr, text: toText(s.expr), law: s.law, shown: true }))]);
    setText('');
  };

  const solve = () => {
    onInteract?.();
    const result = solveSimplification(last);
    setSolution({ from: steps.length + 1, steps: result.steps, complete: result.complete, revealed: 1 });
    setHelp(null);
  };

  const solutionStart = solution ? (solution.from === 1 ? first : (steps[solution.from - 2]?.expr ?? first)) : first;
  const solutionIsCurrent = solution !== null && solution.from === steps.length + 1;

  return (
    <div className="card space-y-4 p-4">
      <ol className="space-y-1.5 rounded-xl border border-line bg-surface px-4 py-3" aria-label="Your working">
        <li>
          <p className="flex flex-wrap items-baseline gap-2 text-lg">
            <span className="w-6 text-sm text-ink-3">1</span>
            <ExprView expr={first} />
            <span className="text-sm text-ink-3">(given)</span>
          </p>
        </li>
        {steps.map((s, i) => (
          <li key={i}>
            <p className="flex flex-wrap items-baseline gap-2 text-lg">
              <span className="w-6 text-sm text-ink-3">{i + 2}</span>
              <span className="text-ink-3">=</span>
              <ExprView expr={s.expr} />
              <span className="text-sm text-ink-2">({s.law})</span>
              <IconCheck size={16} className="text-ok" />
              <span className="sr-only">checked: equal to the line before, using this law</span>
              {s.shown && <span className="text-xs font-semibold text-info">shown by the solver</span>}
            </p>
          </li>
        ))}
      </ol>
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
          {help && (
            <div className="space-y-2 rounded-xl border border-info bg-info-soft p-3 text-sm" role="status" aria-label="Hint">
              {help.step ? (
                <>
                  <p className="flex gap-2">
                    <IconHint size={18} className="mt-0.5 shrink-0 text-info" />
                    <span>
                      <span className="font-semibold">Next, use the {help.step.law}.</span> <RichInline text={help.step.hint} />
                    </span>
                  </p>
                  {help.level === 'line' ? (
                    <>
                      <p className="flex flex-wrap items-baseline gap-2 pl-6 text-lg">
                        <span className="text-ink-3">=</span>
                        <ExprView expr={help.step.expr} />
                        <span className="text-sm text-ink-2">({help.step.law})</span>
                      </p>
                      <p className="pl-6 text-ink-2">
                        <RichInline text={help.step.note} />
                      </p>
                      <div className="flex flex-wrap gap-2 pl-6">
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => help.step && appendLines([help.step])}>
                          Use this line
                        </button>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => help.step && setText(toText(help.step.expr))}>
                          Copy it into “Next line”
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="pl-6">
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => askHelp('line')}>
                        Show me the next line
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <p>No single step was found from this line within the time allowed. Try “Remove last step”, or see the simplest form below.</p>
              )}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-primary btn-sm" onClick={add} disabled={!text.trim()}>
              Check this step
            </button>
            <button type="button" className="btn btn-secondary btn-sm" disabled={steps.length === 0} onClick={() => changeSteps(steps.slice(0, -1))}>
              <IconUndo size={16} /> Remove last step
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => askHelp('law')} aria-expanded={help !== null}>
              <IconHint size={16} /> Hint
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={solve}>
              <IconSpark size={16} /> Solve it step by step
            </button>
          </div>
          <p className="text-xs text-ink-3">
            Current: {literalCount(last)} variable occurrences · simplest possible: {best}. Each step must give the same output as the line before on every input row, and must follow from it by the law you choose. You can apply that law in several places in one line, and reorder terms as you go.
          </p>
        </div>
      )}

      {solution && (
        <section className="space-y-3 rounded-xl border border-info bg-info-soft p-4" aria-label="Solution">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-semibold">
              Solution {solution.from === 1 ? 'from the given expression' : `from your line ${solution.from}`}
              {solution.steps.length > 0 && (
                <span className="font-normal text-ink-2">
                  {' '}
                  · {solution.steps.length} line{solution.steps.length === 1 ? '' : 's'}, one law each
                </span>
              )}
            </h3>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSolution(null)}>
              Hide solution
            </button>
          </div>
          {solution.steps.length === 0 && solution.complete ? (
            <p>This line is already fully simplified.</p>
          ) : (
            <>
              <ol className="space-y-2">
                <Line n={solution.from} expr={solutionStart} given tag={solution.from === 1 ? '(given)' : '(your line)'} />
                {solution.steps.slice(0, solution.revealed).map((s, i) => (
                  <Line key={i} n={solution.from + i + 1} expr={s.expr} law={s.law} note={s.note} />
                ))}
              </ol>
              {solution.revealed < solution.steps.length ? (
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => setSolution({ ...solution, revealed: solution.revealed + 1 })}>
                    Show the next line
                  </button>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSolution({ ...solution, revealed: solution.steps.length })}>
                    Show all lines
                  </button>
                  <span className="text-sm text-ink-2">
                    Try to work out the next line first, then check it here. {solution.steps.length - solution.revealed} more to go.
                  </span>
                </div>
              ) : (
                <div className="space-y-2">
                  {solution.complete ? (
                    <p className="font-semibold">
                      Answer: <ExprView expr={solution.steps[solution.steps.length - 1]?.expr ?? solutionStart} />
                    </p>
                  ) : (
                    <p>
                      The solver could not finish this one within its time limit. The simplest form, from the truth table, is <ExprView expr={simplestForm(solutionStart)} />. The{' '}
                      <Link to="/lab/kmap" className="underline">
                        K-map lab
                      </Link>{' '}
                      shows how to find it by grouping.
                    </p>
                  )}
                  {solutionIsCurrent && solution.steps.length > 0 && !reached && (
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => appendLines(solution.steps)}>
                      Add these lines to my working
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </section>
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
            changeSteps([]);
            setText('');
            setSolution(null);
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
