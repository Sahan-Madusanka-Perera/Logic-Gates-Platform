import type { ReactNode } from 'react';
import { ExprView } from '@/components/expr/ExprView';
import { ScrollRegion } from '@/components/ScrollRegion';
import { type Cell, type KMapLayout, cellIndex, cellKey, groupRectangles } from '@/lib/logic/kmap';
import type { Bit } from '@/lib/logic/types';

export const GROUP_COLORS = ['#0b6b65', '#c2410c', '#6d28d9', '#be185d', '#1d4ed8', '#4d7c0f', '#b45309', '#0e7490'];

interface Props {
  layout: KMapLayout;
  /** Value in each cell (null = blank for the student to fill). */
  values: (Bit | null)[] | ((cell: Cell) => Bit | null);
  onCellClick?: (cell: Cell) => void;
  selected?: Set<string>;
  groups?: Cell[][];
  wrongCells?: Set<string>;
  showIndex?: boolean;
  cellLabel?: (cell: Cell) => string;
  renderCell?: (cell: Cell, value: Bit | null) => ReactNode;
}

const CELL = 56;

/** Karnaugh map in the notes' layout: column variables across the top, row variables down the side. */
export function KMapGrid({ layout, values, onCellClick, selected, groups = [], wrongCells, showIndex, cellLabel, renderCell }: Props) {
  const valueAt = (cell: Cell): Bit | null => (typeof values === 'function' ? values(cell) : (values[cellIndex(layout, cell)] ?? null));
  const head = 52;
  const side = 44;
  const W = side + layout.cols * CELL;
  const H = head + layout.rows * CELL;
  return (
    <ScrollRegion label="Karnaugh map">
      <div className="relative mx-auto" style={{ width: W + 4, height: H + 4 }}>
        {/* corner label */}
        <div className="absolute left-0 top-0 flex h-[52px] w-[44px] flex-col justify-between p-1 text-xs font-semibold" aria-hidden="true">
          <span className="self-end">
            <ExprView expr={layout.colVars.join('')} andStyle="juxtapose" />
          </span>
          <span>
            <ExprView expr={layout.rowVars.join('')} andStyle="juxtapose" />
          </span>
        </div>
        <svg className="pointer-events-none absolute left-0 top-0" width={side} height={head} aria-hidden="true">
          <line x1={4} y1={4} x2={side} y2={head} stroke="var(--line-strong)" />
        </svg>
        {layout.colCodes.map((code, c) => (
          <div key={code} className="absolute text-center font-mono text-sm font-semibold text-ink-2" style={{ left: side + c * CELL, top: head - 24, width: CELL }}>
            {code}
          </div>
        ))}
        {layout.rowCodes.map((code, r) => (
          <div key={code} className="absolute flex items-center justify-end pr-2 font-mono text-sm font-semibold text-ink-2" style={{ left: 0, top: head + r * CELL, width: side, height: CELL }}>
            {code}
          </div>
        ))}
        <div role="grid" aria-label="Karnaugh map" className="absolute" style={{ left: side, top: head }}>
          {Array.from({ length: layout.rows }, (_, r) => (
            <div role="row" key={r} className="flex">
              {Array.from({ length: layout.cols }, (_, c) => {
                const cell = { r, c };
                const key = cellKey(cell);
                const v = valueAt(cell);
                const isSel = selected?.has(key);
                const isWrong = wrongCells?.has(key);
                const content = renderCell ? renderCell(cell, v) : v === null ? '' : v;
                const label = cellLabel?.(cell) ?? `Cell ${layout.colVars.join('')}=${layout.colCodes[c]}, ${layout.rowVars.join('')}=${layout.rowCodes[r]}, value ${v ?? 'empty'}`;
                const cls = `relative flex items-center justify-center border border-line-strong font-mono text-xl font-semibold transition-colors ${
                  isSel ? 'bg-accent-soft ring-2 ring-inset ring-accent' : v === 1 ? 'bg-hi-soft' : 'bg-surface'
                } ${isWrong ? 'ring-2 ring-inset ring-bad' : ''}`;
                return onCellClick ? (
                  <button key={c} role="gridcell" type="button" aria-label={label} aria-selected={isSel} onClick={() => onCellClick(cell)} className={`${cls} hover:bg-surface-2`} style={{ width: CELL, height: CELL }}>
                    {content}
                    {showIndex && <span className="absolute bottom-0.5 right-1 text-[0.6rem] font-normal text-ink-3">m{cellIndex(layout, cell)}</span>}
                  </button>
                ) : (
                  <div key={c} role="gridcell" aria-label={label} className={cls} style={{ width: CELL, height: CELL }}>
                    {content}
                    {showIndex && <span className="absolute bottom-0.5 right-1 text-[0.6rem] font-normal text-ink-3">m{cellIndex(layout, cell)}</span>}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        <svg className="pointer-events-none absolute" style={{ left: side, top: head }} width={layout.cols * CELL} height={layout.rows * CELL} aria-hidden="true">
          {groups.map((g, gi) =>
            groupRectangles(layout, g).map((rect, ri) => {
              const inset = 4 + (gi % 3) * 3;
              const color = GROUP_COLORS[gi % GROUP_COLORS.length];
              const x = rect.c * CELL + inset - (rect.openLeft ? inset + 2 : 0);
              const y = rect.r * CELL + inset - (rect.openTop ? inset + 2 : 0);
              const w = rect.w * CELL - inset * 2 + (rect.openLeft ? inset + 2 : 0) + (rect.openRight ? inset + 2 : 0);
              const h = rect.h * CELL - inset * 2 + (rect.openTop ? inset + 2 : 0) + (rect.openBottom ? inset + 2 : 0);
              return (
                <g key={`${gi}-${ri}`}>
                  <rect x={x} y={y} width={w} height={h} rx={14} fill="none" stroke={color} strokeWidth={3} strokeDasharray={gi % 2 ? '7 4' : undefined} />
                  {ri === 0 && (
                    // Group number, so groups can be told apart without relying on colour.
                    <g transform={`translate(${Math.max(x, 0) + 9} ${Math.max(y, 0) + 9})`}>
                      <circle r={8} fill={color} />
                      <text y={3.5} textAnchor="middle" fontSize={10} fontWeight={700} fill="#fff" fontFamily="var(--font-mono)">
                        {gi + 1}
                      </text>
                    </g>
                  )}
                </g>
              );
            }),
          )}
        </svg>
      </div>
    </ScrollRegion>
  );
}
