import { type ReactNode, useMemo, useState } from 'react';
import { CircuitExplorer } from '@/components/circuits/CircuitExplorer';
import { ExprView } from '@/components/expr/ExprView';
import { ExpressionInput } from '@/components/expr/ExpressionInput';
import { IconCheck, IconX } from '@/components/icons';
import { TruthTable, type TTColumn } from '@/components/truth-tables/TruthTable';
import { canonicalPOS, canonicalSOP, maxtermIndices, mintermIndices } from '@/lib/logic/canonical';
import { exprToCircuit } from '@/lib/logic/convert';
import { equivalent, type Expr, exprTruthTable, literalCount, tryParse, variablesOf } from '@/lib/logic/expression';
import { leftoverStep, minimalLiteralCount, minimalPOS, minimalSOP } from '@/lib/logic/minimize';
import type { Bit } from '@/lib/logic/types';
import { PeelTutor } from './PeelTutor';
import { SimplifyChecker } from './SimplifyChecker';

const EXAMPLES = ["A.B + A'.C", "(A+B)'.C", 'A⊕B⊕C', "A.B + A.B'", "A.(A+B)", "(A.B)' + C"];
const MAX_VARS = 5;

type View = 'table' | 'circuit' | 'forms' | 'compare' | 'peel' | 'simplify';
const VIEWS: { id: View; label: string }[] = [
  { id: 'table', label: 'Truth table' },
  { id: 'circuit', label: 'Circuit' },
  { id: 'forms', label: 'SOP and POS' },
  { id: 'compare', label: 'Compare' },
  { id: 'peel', label: 'Draw it step by step' },
  { id: 'simplify', label: 'Simplify with laws' },
];

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 border-b border-line py-3 last:border-0 sm:grid-cols-[12rem_minmax(0,1fr)] sm:gap-4">
      <dt className="text-sm font-semibold text-ink-2">{label}</dt>
      <dd className="min-w-0 break-words text-lg">{children}</dd>
    </div>
  );
}

function Compare({ expr, vars }: { expr: Expr; vars: string[] }) {
  const [text, setText] = useState('');
  const other = text.trim() ? tryParse(text) : null;
  const res = other?.ok ? equivalent(expr, other.expr) : null;
  return (
    <div className="space-y-4">
      <p className="text-ink-2">Type a second expression. The lab checks every input combination to see whether the two always give the same output.</p>
      <ExpressionInput value={text} onChange={setText} variables={vars.length ? vars : ['A', 'B', 'C']} label="Compare with" />
      {other && !other.ok && <p className="text-sm text-bad">Can’t read that yet: {other.error.message}.</p>}
      {res &&
        (res.equivalent ? (
          <p role="status" className="flex items-center gap-2 rounded-xl border border-ok bg-ok-soft p-3 font-semibold">
            <IconCheck size={18} className="text-ok" /> Equivalent: the outputs match for every input combination.
          </p>
        ) : (
          <p role="status" className="flex items-start gap-2 rounded-xl border border-bad bg-bad-soft p-3 font-semibold">
            <IconX size={18} className="mt-1 shrink-0 text-bad" />
            <span>
              Not equivalent. When{' '}
              {Object.entries(res.counterexample)
                .map(([k, v]) => `${k} = ${v}`)
                .join(', ')}
              , the first gives {res.left} but the second gives {res.right}.
            </span>
          </p>
        ))}
    </div>
  );
}

export default function ExpressionLab() {
  const [text, setText] = useState("A.B + A'.C");
  const [view, setView] = useState<View>('table');
  const [fuse, setFuse] = useState(false);
  const parsed = useMemo(() => (text.trim() ? tryParse(text) : null), [text]);
  const expr = parsed?.ok ? parsed.expr : null;
  const vars = useMemo(() => (expr ? variablesOf(expr) : []), [expr]);
  const tooMany = vars.length > MAX_VARS;

  const data = useMemo(() => {
    if (!expr || vars.length === 0 || tooMany) return null;
    const table = exprTruthTable(expr, vars);
    const outputs = table.rows.map((r) => r.output) as Bit[];
    return {
      table,
      outputs,
      minterms: mintermIndices(outputs),
      maxterms: maxtermIndices(outputs),
      csop: canonicalSOP(outputs, vars),
      cpos: canonicalPOS(outputs, vars),
      msop: minimalSOP(outputs, vars),
      mpos: minimalPOS(outputs, vars),
      best: minimalLiteralCount(outputs, vars),
    };
  }, [expr, vars, tooMany]);

  const circuit = useMemo(() => (expr && !tooMany ? exprToCircuit(expr, { fuseNegations: fuse }).circuit : null), [expr, fuse, tooMany]);

  return (
    <div className="space-y-5">
      <section className="card space-y-4 p-4 sm:p-5">
        <ExpressionInput value={text} onChange={setText} variables={vars.length ? [...vars, ...['A', 'B', 'C', 'D'].filter((x) => !vars.includes(x))].slice(0, 4) : ['A', 'B', 'C', 'D']} label="Expression" placeholder="e.g. A.B + A'.C" />
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-ink-2">Try:</span>
          {EXAMPLES.map((ex) => (
            <button key={ex} type="button" className="rounded-lg border border-line-strong bg-surface px-2.5 py-1 hover:bg-surface-2" onClick={() => setText(ex)}>
              <ExprView expr={ex} />
            </button>
          ))}
        </div>
        {parsed && !parsed.ok && <p className="text-sm text-bad">Can’t read that yet: {parsed.error.message}.</p>}
        {expr && vars.length === 0 && <p className="text-sm text-ink-2">This expression has no variables, so it is always {exprTruthTable(expr, []).rows[0]?.output}.</p>}
        {tooMany && <p className="text-sm text-bad">This lab works with up to {MAX_VARS} variables. Your expression uses {vars.length}.</p>}
      </section>

      {data && expr && (
        <>
          <nav aria-label="Views" className="table-scroll -mx-4 px-4">
            <ul className="flex min-w-max gap-1.5">
              {VIEWS.map((v) => (
                <li key={v.id}>
                  <button type="button" aria-pressed={view === v.id} onClick={() => setView(v.id)} className={`rounded-lg px-3 py-2 text-sm font-semibold ${view === v.id ? 'bg-ink text-paper' : 'border border-line-strong bg-surface text-ink-2 hover:bg-surface-2'}`}>
                    {v.label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          {view === 'table' && (
            <section className="space-y-2" aria-label="Truth table">
              <TruthTable
                columns={[...vars.map((name): TTColumn => ({ key: name, header: name, name, kind: 'input' })), { key: 'F', header: 'F', name: 'F', kind: 'output' }]}
                rows={data.table.rows.map((r) => ({ icn: r.icn, cells: { ...Object.fromEntries(vars.map((name, k) => [name, r.inputs[k] as Bit])), F: r.output } }))}
                caption={
                  <span>
                    F = <ExprView expr={expr} />. Rows are in binary counting order, with {vars[0]} as the most significant bit. ICN is the input combination number (1 to {data.table.rows.length}).
                  </span>
                }
              />
            </section>
          )}

          {view === 'circuit' && circuit && (
            <section className="space-y-3" aria-label="Circuit">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={fuse} onChange={(e) => setFuse(e.target.checked)} className="h-5 w-5 accent-[var(--accent)]" />
                Draw a bar over AND/OR as one NAND/NOR gate
              </label>
              <CircuitExplorer key={`${text}:${fuse}`} circuit={circuit} showTruthTable={false} />
            </section>
          )}

          {view === 'forms' && (
            <section className="card p-4 sm:p-5" aria-label="Standard and simplest forms">
              <dl>
                <Row label="Minterms (output 1)">{data.minterms.length ? `Σm(${data.minterms.join(', ')})` : 'none — F is always 0'}</Row>
                <Row label="Standard SOP">
                  <ExprView expr={data.csop} />
                </Row>
                <Row label="Maxterms (output 0)">{data.maxterms.length ? `ΠM(${data.maxterms.join(', ')})` : 'none — F is always 1'}</Row>
                <Row label="Standard POS">
                  <ExprView expr={data.cpos} />
                </Row>
                <Row label="Simplest SOP">
                  <ExprView expr={data.msop} /> <span className="text-sm text-ink-3">({literalCount(data.msop)} literals)</span>
                </Row>
                <Row label="Simplest POS">
                  <ExprView expr={data.mpos} /> <span className="text-sm text-ink-3">({literalCount(data.mpos)} literals)</span>
                </Row>
              </dl>
              <p className="mt-3 text-sm text-ink-2">
                Minterm and maxterm numbers start at 0 (the decimal value of the inputs). The ICN in the truth table starts at 1, so minterm m<sub>n</sub> is on row ICN n + 1. Your expression has {literalCount(expr)} literals.
              </p>
            </section>
          )}

          {view === 'compare' && (
            <section className="card p-4 sm:p-5" aria-label="Compare expressions">
              <Compare expr={expr} vars={vars} />
            </section>
          )}

          {view === 'peel' && (
            <section aria-label="Draw the circuit step by step">
              <PeelTutor key={text} expr={text} />
            </section>
          )}

          {view === 'simplify' && (
            <section aria-label="Simplify with Boolean laws">
              {literalCount(expr) <= data.best && !leftoverStep(expr) ? (
                <p className="card p-4">
                  This expression is already fully simplified: it has the fewest variables possible ({literalCount(expr)}) and no law can shorten it further. Try one of the examples such as <ExprView expr="A.B + A.B'" />.
                </p>
              ) : (
                <SimplifyChecker key={text} start={text} />
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
