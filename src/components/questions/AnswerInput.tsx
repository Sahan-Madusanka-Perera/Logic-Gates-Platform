import { type KeyboardEvent, useMemo } from 'react';
import { CircuitDiagram } from '@/components/circuits/CircuitDiagram';
import { ExprView } from '@/components/expr/ExprView';
import { ExpressionInput } from '@/components/expr/ExpressionInput';
import { IconCheck, IconX } from '@/components/icons';
import { KMapGrid } from '@/components/kmap/KMapGrid';
import { RichInline } from '@/components/RichText';
import { BitPicker } from '@/components/signals';
import { type Draft, shuffled } from '@/lib/assessment/draft';
import { intermediateModel, kmapModel, questionVariables, truthTableModel } from '@/lib/assessment/check';
import type { McqOption, Question } from '@/lib/assessment/types';
import { cellKey } from '@/lib/logic/kmap';
import type { Bit } from '@/lib/logic/types';
import { FigureView } from './FigureView';

export interface Marking {
  correct: boolean;
  /** Show which MCQ option was right. */
  revealAnswer?: boolean;
  wrongCells?: Set<string>;
}

interface Props {
  question: Question;
  draft: Draft;
  onChange: (d: Draft) => void;
  disabled?: boolean;
  marking?: Marking | null;
  /** Seed for option shuffling (stable per session). */
  seed?: string;
  onSubmit?: () => void;
}

const next = (v: Bit | null | undefined): Bit => (v === 0 ? 1 : 0);

/** A 0/1 cell for grids: tap cycles empty → 0 → 1 → 0; typing 0 or 1 also works. */
function CycleCell({ value, onChange, label, disabled, wrong }: { value: Bit | null | undefined; onChange: (v: Bit | null) => void; label: string; disabled?: boolean; wrong?: boolean }) {
  const onKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === '0' || e.key === '1') {
      e.preventDefault();
      onChange(Number(e.key) as Bit);
    } else if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault();
      onChange(null);
    }
  };
  const empty = value === null || value === undefined;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(next(value))}
      onKeyDown={onKey}
      aria-label={`${label}: ${empty ? 'empty' : value}${wrong ? ', marked wrong' : ''}. Press to change, or type 0 or 1.`}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-md border-2 font-mono text-base font-semibold transition-colors ${
        empty ? 'border-dashed border-line-strong text-ink-3' : value === 1 ? 'border-hi-strong bg-hi text-[#1d1400]' : 'border-lo bg-surface text-lo-ink'
      } ${wrong ? 'outline outline-2 outline-offset-1 outline-bad' : ''}`}
    >
      {empty ? '?' : value}
      {wrong && <span className="sr-only"> (wrong)</span>}
    </button>
  );
}

export function AnswerInput({ question: q, draft, onChange, disabled, marking, seed = '', onSubmit }: Props) {
  switch (q.type) {
    case 'mcq':
      return draft.type === 'mcq' ? <McqInput q={q} choice={draft.choice} onChoose={(c) => onChange({ type: 'mcq', choice: c })} disabled={disabled} marking={marking} seed={seed} /> : null;
    case 'binary':
      if (draft.type !== 'binary') return null;
      return (
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-display text-lg">Output =</span>
          <BitPicker value={draft.value} onChange={(v) => onChange({ type: 'binary', value: v })} label="Output" disabled={disabled} state={marking ? (marking.correct ? 'right' : 'wrong') : undefined} />
        </div>
      );
    case 'numeric':
      if (draft.type !== 'numeric') return null;
      return (
        <label className="flex flex-wrap items-center gap-3">
          <span className="font-semibold">Your answer</span>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={draft.text}
            disabled={disabled}
            onChange={(e) => onChange({ type: 'numeric', text: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && onSubmit) {
                e.preventDefault();
                onSubmit();
              }
            }}
            className={`w-28 rounded-xl border-2 bg-surface px-3 py-2 font-mono text-lg outline-none focus:border-accent ${marking ? (marking.correct ? 'border-ok' : 'border-bad') : 'border-line-strong'}`}
          />
        </label>
      );
    case 'expression':
      if (draft.type !== 'expression') return null;
      return (
        <ExpressionInput
          value={draft.text}
          onChange={(t) => onChange({ type: 'expression', text: t })}
          variables={q.variables ?? questionVariables({ expr: q.answer, parseVariables: q.parseVariables })}
          multi={q.parseVariables}
          disabled={disabled}
          onSubmit={onSubmit}
        />
      );
    case 'truth-table':
      return draft.type === 'truth-table' ? <TruthTableInput q={q} cells={draft.cells} onChange={(cells) => onChange({ type: 'truth-table', cells })} disabled={disabled} wrong={marking?.wrongCells} /> : null;
    case 'intermediate':
      return draft.type === 'intermediate' ? <IntermediateInput q={q} values={draft.values} onChange={(values) => onChange({ type: 'intermediate', values })} disabled={disabled} wrong={marking?.wrongCells} /> : null;
    case 'kmap-fill': {
      if (draft.type !== 'kmap-fill') return null;
      const { layout } = kmapModel(q);
      const cells = draft.cells;
      return (
        <div className="space-y-2">
          <p className="text-sm text-ink-2">Tap a cell to enter 0 or 1 (tap again to change). On a keyboard, type 0 or 1.</p>
          <KMapGrid
            layout={layout}
            values={(cell) => cells[cellKey(cell)] ?? null}
            wrongCells={marking?.wrongCells}
            onCellClick={
              disabled
                ? undefined
                : (cell) => {
                    const k = cellKey(cell);
                    onChange({ type: 'kmap-fill', cells: { ...cells, [k]: next(cells[k]) } });
                  }
            }
            renderCell={(_, v) => (v === null ? <span className="text-base text-ink-3">?</span> : v)}
          />
        </div>
      );
    }
    case 'latch-sequence':
      if (draft.type !== 'latch-sequence') return null;
      return (
        <div className="table-scroll">
          <table className="min-w-[18rem] border-collapse text-center">
            <thead>
              <tr className="text-sm text-ink-2">
                <th className="border-b border-line px-3 py-2 font-semibold">Step</th>
                <th className="border-b border-line px-3 py-2 font-semibold">S</th>
                <th className="border-b border-line px-3 py-2 font-semibold">R</th>
                <th className="border-b border-line px-3 py-2 font-semibold">Q after this step</th>
              </tr>
            </thead>
            <tbody>
              <tr className="text-ink-3">
                <td className="px-3 py-1.5 text-sm">start</td>
                <td colSpan={2} />
                <td className="px-3 py-1.5 font-mono">Q = 0</td>
              </tr>
              {q.steps.map((st, i) => (
                <tr key={i} className="border-t border-line">
                  <td className="px-3 py-1.5 font-mono">{i + 1}</td>
                  <td className="px-3 py-1.5 font-mono">{st.s}</td>
                  <td className="px-3 py-1.5 font-mono">{st.r}</td>
                  <td className="px-3 py-1.5">
                    <BitPicker
                      label={`Q after step ${i + 1}`}
                      value={draft.values[i] ?? null}
                      disabled={disabled}
                      state={marking?.wrongCells ? (marking.wrongCells.has(String(i)) ? 'wrong' : 'right') : undefined}
                      onChange={(v) => onChange({ type: 'latch-sequence', values: draft.values.map((x, j) => (j === i ? v : x)) })}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
  }
}

function OptionBody({ o }: { o: McqOption }) {
  return (
    <span className="flex min-w-0 flex-col gap-2">
      {o.expr && <ExprView expr={o.expr} className="text-lg" />}
      {o.text && (
        <span>
          <RichInline text={o.text} />
        </span>
      )}
      {o.figure && <FigureView figure={o.figure} />}
    </span>
  );
}

function McqInput({ q, choice, onChoose, disabled, marking, seed }: { q: Extract<Question, { type: 'mcq' }>; choice: string | null; onChoose: (id: string) => void; disabled?: boolean; marking?: Marking | null; seed: string }) {
  const options = useMemo(() => (q.fixedOrder ? q.options : shuffled(q.options, `${q.id}:${seed}`)), [q, seed]);
  return (
    <div role="radiogroup" aria-label="Answer options" className="grid gap-2">
      {options.map((o, i) => {
        const selected = choice === o.id;
        const isAnswer = o.id === q.answer;
        const showRight = marking && (marking.revealAnswer || marking.correct) && isAnswer;
        const showWrong = marking && selected && !isAnswer;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChoose(o.id)}
            className={`flex items-start gap-3 rounded-xl border-2 bg-surface p-3 text-left transition-colors ${
              showRight ? 'border-ok bg-ok-soft' : showWrong ? 'border-bad bg-bad-soft' : selected ? 'border-accent bg-accent-soft' : 'border-line hover:border-line-strong'
            }`}
          >
            <span
              className={`mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 font-mono text-sm font-semibold ${selected ? 'border-accent bg-accent text-accent-ink' : 'border-line-strong text-ink-2'}`}
              aria-hidden="true"
            >
              {i + 1}
            </span>
            <OptionBody o={o} />
            {showRight && (
              <span className="ml-auto inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-ok">
                <IconCheck width={18} height={18} /> Correct answer
              </span>
            )}
            {showWrong && (
              <span className="ml-auto inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-bad">
                <IconX width={18} height={18} /> Your choice
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function TruthTableInput({ q, cells, onChange, disabled, wrong }: { q: Extract<Question, { type: 'truth-table' }>; cells: Record<string, Bit | null>; onChange: (c: Record<string, Bit | null>) => void; disabled?: boolean; wrong?: Set<string> }) {
  const model = useMemo(() => truthTableModel(q), [q]);
  const fill = [...model.cols.map((c) => ({ key: c.key, label: c.label })), { key: 'out', label: model.outputLabel }];
  const outLabel = q.outputLabel ?? 'F';
  return (
    <div className="space-y-2">
      <p className="text-sm text-ink-2">Tap each “?” to enter 0 or 1 (tap again to change). On a keyboard, type 0 or 1.</p>
      <div className="table-scroll">
        <table className="mx-auto border-collapse text-center">
          <thead>
            <tr className="text-sm">
              <th className="border-b-2 border-line-strong px-2 py-2 font-semibold text-ink-3">ICN</th>
              {model.vars.map((v) => (
                <th key={v} className="border-b-2 border-line-strong px-3 py-2 font-display text-base">
                  {v}
                </th>
              ))}
              {fill.map((c, i) => (
                <th key={c.key} className={`border-b-2 border-line-strong px-3 py-2 font-display text-base ${i === 0 ? 'border-l-2' : ''}`}>
                  {c.key === 'out' ? outLabel : <ExprView expr={c.label} multi={q.parseVariables} />}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {model.rows.map((row) => {
              const given = q.givenRows?.includes(row.index);
              return (
                <tr key={row.index} className="border-t border-line">
                  <td className="px-2 py-1 font-mono text-sm text-ink-3">{row.icn}</td>
                  {row.inputs.map((b, k) => (
                    <td key={k} className="px-3 py-1 font-mono">
                      {b}
                    </td>
                  ))}
                  {fill.map((c, i) => {
                    const key = `${row.index}:${c.key}`;
                    return (
                      <td key={c.key} className={`px-2 py-1 ${i === 0 ? 'border-l-2 border-line-strong' : ''}`}>
                        {given ? (
                          <span className="font-mono font-semibold" aria-label={`given value ${row.values[c.key]}`}>
                            {row.values[c.key]}
                          </span>
                        ) : (
                          <CycleCell
                            value={cells[key]}
                            disabled={disabled}
                            wrong={wrong?.has(key)}
                            label={`Row ICN ${row.icn} (${model.vars.map((v, k) => `${v}=${row.inputs[k]}`).join(' ')}), column ${c.key === 'out' ? outLabel : c.label}`}
                            onChange={(v) => onChange({ ...cells, [key]: v })}
                          />
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function IntermediateInput({ q, values, onChange, disabled, wrong }: { q: Extract<Question, { type: 'intermediate' }>; values: Record<string, Bit | null>; onChange: (v: Record<string, Bit | null>) => void; disabled?: boolean; wrong?: Set<string> }) {
  const model = useMemo(() => intermediateModel(q), [q]);
  const known = useMemo(() => new Set(Object.keys(q.assignment)), [q]);
  const label = (id: string) => (model.circuit.nodes.find((n) => n.id === id) as { label?: string } | undefined)?.label ?? id;
  // Gates are listed by label (G1, G2, …) so the order does not give away the evaluation order.
  const gates = [...model.result.steps].sort((a, b) => label(a.nodeId).localeCompare(label(b.nodeId), undefined, { numeric: true }));
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-line bg-surface p-2">
        <CircuitDiagram circuit={model.circuit} values={q.assignment} known={known} animate={false} />
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {gates.map((s) => (
          <div key={s.nodeId} className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 ${wrong?.has(s.nodeId) ? 'border-bad bg-bad-soft' : 'border-line bg-surface'}`}>
            <span className="font-mono font-semibold">
              {label(s.nodeId)} <span className="font-sans text-sm font-normal text-ink-2">output</span>
            </span>
            <BitPicker
              label={`${label(s.nodeId)} output`}
              value={values[s.nodeId] ?? null}
              disabled={disabled}
              state={wrong ? (wrong.has(s.nodeId) ? 'wrong' : 'right') : undefined}
              onChange={(v) => onChange({ ...values, [s.nodeId]: v })}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
