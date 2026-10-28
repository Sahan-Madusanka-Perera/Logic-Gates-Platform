import { useEffect, useMemo, useRef, useState } from 'react';
import { ExprView } from '@/components/expr/ExprView';
import { IconCheck, IconReset, IconTrash, IconUndo, IconWarn } from '@/components/icons';
import { type Cell, allCells, analyzeCover, cellIndex, cellKey, checkGroup, groupTerm, type GroupIssue, type KMapGroupKind, kmapLayout } from '@/lib/logic/kmap';
import { toText } from '@/lib/logic/expression';
import { minimumCover } from '@/lib/logic/minimize';
import type { Bit } from '@/lib/logic/types';
import { GROUP_COLORS, KMapGrid } from './KMapGrid';

interface Props {
  variables: string[];
  values: Bit[];
  /** Lab mode: the learner can change cell values. */
  editable?: boolean;
  onValuesChange?: (v: Bit[]) => void;
  initialKind?: KMapGroupKind;
  onInteract?: () => void;
  /** Called when the learner reaches an optimal grouping. */
  onOptimal?: () => void;
}

/** The cells a prime implicant covers. */
function implicantCells(cells: Cell[], layout: ReturnType<typeof kmapLayout>, imp: { value: number; mask: number }): Cell[] {
  return cells.filter((c) => (cellIndex(layout, c) & ~imp.mask) === (imp.value & ~imp.mask));
}

/**
 * Grouping trainer: select cells, make a group, and get feedback that quotes
 * the notes' grouping rules. The cover is analysed by the engine (uncovered
 * cells, groups that could be larger, redundant groups, the optimal answer).
 */
export function KMapTrainer({ variables, values, editable, onValuesChange, initialKind = 1, onInteract, onOptimal }: Props) {
  const layout = useMemo(() => kmapLayout(variables), [variables]);
  const cells = useMemo(() => allCells(layout), [layout]);
  const [kind, setKind] = useState<KMapGroupKind>(initialKind);
  const [tool, setTool] = useState<'group' | 'edit'>(editable ? 'edit' : 'group');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [groups, setGroups] = useState<Cell[][]>([]);
  const [issues, setIssues] = useState<GroupIssue[]>([]);
  const [revealed, setRevealed] = useState(false);
  const notified = useRef(false);

  const analysis = useMemo(() => analyzeCover(layout, values, groups, kind), [layout, values, groups, kind]);
  const target = values.filter((v) => v === kind).length;
  const fn = kind === 1 ? 'SOP' : 'POS';

  useEffect(() => {
    if (analysis.isOptimal && groups.length > 0 && !revealed && !notified.current) {
      notified.current = true;
      onOptimal?.();
    }
  }, [analysis.isOptimal, groups.length, revealed, onOptimal]);

  const resetGroups = () => {
    setGroups([]);
    setSelected(new Set());
    setIssues([]);
    setRevealed(false);
    notified.current = false;
  };

  const onCell = (cell: Cell) => {
    onInteract?.();
    if (tool === 'edit' && onValuesChange) {
      const i = cellIndex(layout, cell);
      const next = [...values];
      next[i] = values[i] === 1 ? 0 : 1;
      onValuesChange(next);
      resetGroups();
      return;
    }
    const k = cellKey(cell);
    setIssues([]);
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });
  };

  const makeGroup = () => {
    const chosen = cells.filter((c) => selected.has(cellKey(c)));
    const result = checkGroup(layout, values, chosen, kind);
    onInteract?.();
    if (!result.valid) {
      setIssues(result.issues);
      return;
    }
    setGroups((g) => [...g, chosen]);
    setSelected(new Set());
    setIssues([]);
  };

  const reveal = () => {
    const onSet = values.flatMap((b, i) => (b === kind ? [i] : []));
    const best = minimumCover(onSet, variables.length).map((imp) => implicantCells(cells, layout, imp));
    setGroups(best);
    setSelected(new Set());
    setIssues([]);
    setRevealed(true);
    onInteract?.();
  };

  const selectedCount = selected.size;

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
        <div className="inline-flex rounded-lg border border-line-strong bg-surface p-0.5 text-sm" role="radiogroup" aria-label="What to group">
          {([1, 0] as KMapGroupKind[]).map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={kind === k}
              onClick={() => {
                setKind(k);
                resetGroups();
              }}
              className={`rounded-md px-3 py-1.5 font-semibold ${kind === k ? 'bg-ink text-paper' : 'text-ink-2'}`}
            >
              Group {k}s ({k === 1 ? 'SOP' : 'POS'})
            </button>
          ))}
        </div>
        {editable && (
          <div className="inline-flex rounded-lg border border-line-strong bg-surface p-0.5 text-sm" role="radiogroup" aria-label="Tool">
            {(['edit', 'group'] as const).map((t) => (
              <button key={t} type="button" role="radio" aria-checked={tool === t} onClick={() => setTool(t)} className={`rounded-md px-3 py-1.5 font-semibold ${tool === t ? 'bg-ink text-paper' : 'text-ink-2'}`}>
                {t === 'edit' ? 'Edit cell values' : 'Make groups'}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-4 p-4 lg:grid-cols-[auto_minmax(0,1fr)]">
        <div className="space-y-3">
          <p className="text-sm text-ink-2">
            {tool === 'edit' ? 'Tap a cell to switch it between 0 and 1.' : `Tap the ${kind}s you want in one group, then press “Make group”.`}
          </p>
          <KMapGrid layout={layout} values={values} onCellClick={onCell} selected={selected} groups={groups} showIndex />
          {tool === 'group' && (
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn btn-primary btn-sm" disabled={selectedCount === 0} onClick={makeGroup}>
                Make group ({selectedCount} cell{selectedCount === 1 ? '' : 's'})
              </button>
              <button type="button" className="btn btn-secondary btn-sm" disabled={groups.length === 0} onClick={() => setGroups((g) => g.slice(0, -1))}>
                <IconUndo size={16} /> Undo group
              </button>
              <button type="button" className="btn btn-ghost btn-sm" disabled={groups.length === 0 && selectedCount === 0} onClick={resetGroups}>
                <IconReset size={16} /> Start again
              </button>
            </div>
          )}
          {issues.length > 0 && (
            <div className="rounded-xl border border-bad bg-bad-soft p-3 text-sm" role="alert">
              <p className="flex items-center gap-2 font-semibold text-bad">
                <IconWarn size={18} /> That is not a valid group
              </p>
              <ul className="mt-1 list-disc pl-5">
                {issues.map((i) => (
                  <li key={i.rule}>
                    <span className="font-semibold">Rule {i.rule}:</span> {i.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="space-y-3" aria-live="polite">
          <h4 className="font-display text-lg">Your groups</h4>
          {groups.length === 0 ? (
            <p className="text-sm text-ink-2">No groups yet. {target === 0 ? `There are no ${kind}s to group.` : `There ${target === 1 ? 'is' : 'are'} ${target} cell${target === 1 ? '' : 's'} with ${kind} to cover.`}</p>
          ) : (
            <ol className="space-y-1.5">
              {groups.map((g, i) => (
                <li key={i} className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2">
                  <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-xs font-bold text-white" style={{ background: GROUP_COLORS[i % GROUP_COLORS.length] }}>
                    {i + 1}
                  </span>
                  <span className="text-sm text-ink-2">
                    {g.length} cell{g.length === 1 ? '' : 's'} →
                  </span>
                  <ExprView expr={groupTerm(layout, g, kind)} className="text-lg" />
                  {analysis.notLargest.includes(i) && <span className="chip">could be bigger</span>}
                  {analysis.redundant.includes(i) && <span className="chip">not needed</span>}
                  <button type="button" className="ml-auto rounded-md p-1.5 text-ink-3 hover:bg-surface-2" aria-label={`Remove group ${i + 1}`} onClick={() => setGroups((gs) => gs.filter((_, j) => j !== i))}>
                    <IconTrash size={16} />
                  </button>
                </li>
              ))}
            </ol>
          )}

          {groups.length > 0 && (
            <div className="rounded-xl border border-line bg-surface-2 p-3 text-[0.95rem]">
              <p className="flex flex-wrap items-baseline gap-2">
                <span className="font-semibold">{fn}:</span>
                <span className="font-display">F =</span>
                <ExprView expr={analysis.expression} className="text-xl" />
              </p>
              <ul className="mt-2 space-y-1 text-sm">
                <li>
                  {analysis.uncovered.length === 0 ? '✓ Every' : `✗ ${analysis.uncovered.length} cell${analysis.uncovered.length === 1 ? '' : 's'} with`} {analysis.uncovered.length === 0 ? `${kind} is covered.` : `${kind} ${analysis.uncovered.length === 1 ? 'is' : 'are'} not in any group yet (rule 4: every ${kind} must be covered).`}
                </li>
                {analysis.notLargest.length > 0 && <li>✗ Group {analysis.notLargest.map((i) => i + 1).join(', ')} could be made bigger (rule 5: make groups as large as possible).</li>}
                {analysis.redundant.length > 0 && <li>✗ Group {analysis.redundant.map((i) => i + 1).join(', ')} only covers cells that are already in other groups, so it can be removed.</li>}
                <li>
                  Best possible: {analysis.optimalGroups} group{analysis.optimalGroups === 1 ? '' : 's'}, {analysis.optimalLiterals} variable{analysis.optimalLiterals === 1 ? '' : 's'} in total.
                </li>
              </ul>
              {analysis.isOptimal && (
                <p className="mt-2 flex items-center gap-2 font-semibold text-ok">
                  <IconCheck size={18} /> {revealed ? 'This is a best grouping.' : 'Excellent — this is a simplest possible answer.'}
                </p>
              )}
            </div>
          )}
          {!analysis.isOptimal && target > 0 && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={reveal}>
              Show a best grouping
            </button>
          )}
          {revealed && <p className="text-sm text-ink-2">Shown: {toText(analysis.expression)}. Clear the groups and try to find it yourself on a new map.</p>}
        </div>
      </div>
    </div>
  );
}
