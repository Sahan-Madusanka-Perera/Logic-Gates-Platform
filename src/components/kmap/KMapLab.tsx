import { useMemo, useState } from 'react';
import { ExprView } from '@/components/expr/ExprView';
import { ExpressionInput } from '@/components/expr/ExpressionInput';
import { outputsOf, parseExpression, tryParse, variablesOf } from '@/lib/logic/expression';
import { minimalPOS, minimalSOP } from '@/lib/logic/minimize';
import type { Bit } from '@/lib/logic/types';
import { KMapTrainer } from './KMapTrainer';

const VARS: Record<number, string[]> = { 2: ['A', 'B'], 3: ['A', 'B', 'C'], 4: ['A', 'B', 'C', 'D'] };
const STARTERS: Record<number, string> = { 2: "A.B' + A'.B'", 3: "A.B + A'.C + B.C", 4: "A'.B'.D + B.C.D + A.B.D' + A'.B'.C.D'" };

export default function KMapLab() {
  const [n, setN] = useState(3);
  const vars = VARS[n] as string[];
  const [values, setValues] = useState<Bit[]>(() => outputsOf(parseExpression(STARTERS[3] as string), VARS[3] as string[]));
  const [version, setVersion] = useState(0);
  const [text, setText] = useState(STARTERS[3] as string);
  const [error, setError] = useState<string | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);

  const load = (next: Bit[]) => {
    setValues(next);
    setVersion((v) => v + 1);
    setShowAnswer(false);
  };

  const fromExpression = (src = text, count = n) => {
    const r = tryParse(src);
    if (!r.ok) {
      setError(`Can’t read that yet: ${r.error.message}.`);
      return;
    }
    const allowed = VARS[count] as string[];
    const extra = variablesOf(r.expr).filter((x) => !allowed.includes(x));
    if (extra.length) {
      setError(`A ${count}-variable map uses only ${allowed.join(', ')}. Remove ${extra.join(', ')} or choose more variables.`);
      return;
    }
    setError(null);
    load(outputsOf(r.expr, allowed));
  };

  const changeCount = (k: number) => {
    setN(k);
    const starter = STARTERS[k] as string;
    setText(starter);
    fromExpression(starter, k);
  };

  const simplest = useMemo(() => ({ sop: minimalSOP(values, vars), pos: minimalPOS(values, vars) }), [values, vars]);
  const ones = values.filter((v) => v === 1).length;

  return (
    <div className="space-y-5">
      <section className="card space-y-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-semibold">Variables</span>
          <div className="inline-flex rounded-lg border border-line-strong bg-surface p-0.5 text-sm" role="radiogroup" aria-label="Number of variables">
            {[2, 3, 4].map((k) => (
              <button key={k} type="button" role="radio" aria-checked={n === k} onClick={() => changeCount(k)} className={`rounded-md px-3 py-1.5 font-semibold ${n === k ? 'bg-ink text-paper' : 'text-ink-2'}`}>
                {k} ({(VARS[k] as string[]).join(', ')})
              </button>
            ))}
          </div>
        </div>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            fromExpression();
          }}
        >
          <ExpressionInput value={text} onChange={setText} variables={vars} label="Fill the map from an expression" onSubmit={() => fromExpression()} />
          <div className="flex flex-wrap gap-2">
            <button type="submit" className="btn btn-primary btn-sm">
              Fill the map
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => load(Array.from({ length: 2 ** n }, () => 0 as Bit))}>
              Clear all cells to 0
            </button>
          </div>
          {error && <p className="text-sm text-bad">{error}</p>}
        </form>
        <p className="text-sm text-ink-2">You can also switch to “Edit cell values” and tap cells to change them. Don’t-care conditions are not used: the notes mark them as not in the syllabus.</p>
      </section>

      <KMapTrainer key={`${n}:${version}`} variables={vars} values={values} editable onValuesChange={setValues} />

      <section className="card space-y-3 p-4 sm:p-5" aria-labelledby="kmap-answer">
        <h2 id="kmap-answer" className="font-display text-xl">
          Simplest expressions
        </h2>
        <p className="text-sm text-ink-2">
          The map has {ones} cell{ones === 1 ? '' : 's'} with 1 and {values.length - ones} with 0. Try grouping first, then check.
        </p>
        <button type="button" className="btn btn-secondary btn-sm" aria-expanded={showAnswer} onClick={() => setShowAnswer((s) => !s)}>
          {showAnswer ? 'Hide' : 'Show'} the simplest SOP and POS
        </button>
        {showAnswer && (
          <dl className="space-y-1 text-lg">
            <div>
              <dt className="inline font-semibold">SOP: </dt>
              <dd className="inline">
                F = <ExprView expr={simplest.sop} />
              </dd>
            </div>
            <div>
              <dt className="inline font-semibold">POS: </dt>
              <dd className="inline">
                F = <ExprView expr={simplest.pos} />
              </dd>
            </div>
          </dl>
        )}
      </section>
    </div>
  );
}
