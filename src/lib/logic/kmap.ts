import { type Expr, andE, notE, orE, v, literalCount } from './expression';
import { minimumCover } from './minimize';
import type { Bit } from './types';

/** Gray-code sequences: neighbouring codes differ in exactly one bit. */
export function grayCodes(bits: number): string[] {
  if (bits === 0) return [''];
  const prev = grayCodes(bits - 1);
  return [...prev.map((c) => `0${c}`), ...[...prev].reverse().map((c) => `1${c}`)];
}

export interface KMapLayout {
  variables: string[];
  rowVars: string[];
  colVars: string[];
  rowCodes: string[];
  colCodes: string[];
  rows: number;
  cols: number;
}

/**
 * Layout used in the notes and past papers: for 3 variables AB across the top
 * (00 01 11 10) and C down the side; for 4 variables AB across and CD down;
 * for 2 variables A down the side and B across.
 */
export function kmapLayout(variables: string[]): KMapLayout {
  const n = variables.length;
  if (n < 2 || n > 4) throw new RangeError('K-maps here support 2 to 4 variables');
  const colVars = n === 2 ? variables.slice(1) : variables.slice(0, 2);
  const rowVars = n === 2 ? variables.slice(0, 1) : variables.slice(2);
  const rowCodes = grayCodes(rowVars.length);
  const colCodes = grayCodes(colVars.length);
  return { variables, rowVars, colVars, rowCodes, colCodes, rows: rowCodes.length, cols: colCodes.length };
}

export interface Cell {
  r: number;
  c: number;
}

/** Bits of a cell in variable order. */
export function cellBits(layout: KMapLayout, cell: Cell): Bit[] {
  const values: Record<string, Bit> = {};
  layout.rowVars.forEach((name, k) => (values[name] = Number(layout.rowCodes[cell.r]?.[k]) as Bit));
  layout.colVars.forEach((name, k) => (values[name] = Number(layout.colCodes[cell.c]?.[k]) as Bit));
  return layout.variables.map((name) => values[name] as Bit);
}

/** Truth-table row index (minterm number) shown in a cell. */
export function cellIndex(layout: KMapLayout, cell: Cell): number {
  return cellBits(layout, cell).reduce<number>((acc, b) => acc * 2 + b, 0);
}

export function allCells(layout: KMapLayout): Cell[] {
  const cells: Cell[] = [];
  for (let r = 0; r < layout.rows; r++) for (let c = 0; c < layout.cols; c++) cells.push({ r, c });
  return cells;
}

export function cellKey(cell: Cell): string {
  return `${cell.r},${cell.c}`;
}

const isPow2 = (n: number) => n > 0 && (n & (n - 1)) === 0;

/** Is a set of indices a cyclic run (wrap-around allowed) of a power-of-two length? */
function cyclicRun(indices: number[], size: number): boolean {
  const set = new Set(indices);
  const len = set.size;
  if (!isPow2(len) || len > size) return false;
  if (len === size) return true;
  for (let start = 0; start < size; start++) {
    let ok = true;
    for (let k = 0; k < len; k++) if (!set.has((start + k) % size)) ok = false;
    if (ok) return true;
  }
  return false;
}

export type KMapGroupKind = 1 | 0;

export interface GroupIssue {
  /** Rule number from the notes (N p.32–33). */
  rule: number;
  message: string;
}

export interface GroupCheck {
  valid: boolean;
  issues: GroupIssue[];
  term?: Expr;
}

/** Check one proposed group against the notes' grouping rules. */
export function checkGroup(layout: KMapLayout, values: readonly Bit[], cells: Cell[], kind: KMapGroupKind): GroupCheck {
  const issues: GroupIssue[] = [];
  const unique = [...new Map(cells.map((c) => [cellKey(c), c])).values()];
  if (unique.length === 0) return { valid: false, issues: [{ rule: 4, message: 'Select at least one cell.' }] };
  const wrong = unique.filter((cell) => values[cellIndex(layout, cell)] !== kind);
  if (wrong.length > 0) {
    issues.push({ rule: 2, message: `A group may contain only ${kind}s. ${wrong.length} selected cell(s) hold ${kind === 1 ? 0 : 1}.` });
  }
  if (!isPow2(unique.length)) {
    issues.push({ rule: 3, message: `A group must hold 1, 2, 4, 8 or 16 cells (a power of 2). This one has ${unique.length}.` });
  }
  const rows = [...new Set(unique.map((c) => c.r))];
  const cols = [...new Set(unique.map((c) => c.c))];
  const isRectangle = rows.length * cols.length === unique.length;
  if (!isRectangle || !cyclicRun(rows, layout.rows) || !cyclicRun(cols, layout.cols)) {
    if (isPow2(unique.length)) {
      issues.push({
        rule: 9,
        message:
          'The cells must form one square or rectangle of side 1, 2 or 4 — horizontal or vertical, never diagonal. Groups may wrap around the edges.',
      });
    }
  }
  const valid = issues.length === 0;
  return { valid, issues, term: valid ? groupTerm(layout, unique, kind) : undefined };
}

/**
 * The term a valid group stands for. Variables that keep the same value in every
 * cell stay; the others are eliminated. Groups of 1s give a product (SOP);
 * groups of 0s give a sum (POS) with each variable complemented where it is 1.
 */
export function groupTerm(layout: KMapLayout, cells: Cell[], kind: KMapGroupKind): Expr {
  const bitsList = cells.map((c) => cellBits(layout, c));
  const lits: Expr[] = [];
  layout.variables.forEach((name, k) => {
    const first = bitsList[0]?.[k];
    if (bitsList.every((b) => b[k] === first)) {
      if (kind === 1) lits.push(first === 1 ? v(name) : notE(v(name)));
      else lits.push(first === 0 ? v(name) : notE(v(name)));
    }
  });
  if (lits.length === 0) return { type: 'const', value: kind };
  return kind === 1 ? andE(...lits) : orE(...lits);
}

/** Every valid group (all cells the right kind) — used to tell whether a group could be larger. */
export function allValidGroups(layout: KMapLayout, values: readonly Bit[], kind: KMapGroupKind): Cell[][] {
  const out: Cell[][] = [];
  const seen = new Set<string>();
  const lens = (size: number) => [1, 2, 4].filter((l) => l <= size);
  for (const rl of lens(layout.rows)) {
    for (let rs = 0; rs < (rl === layout.rows ? 1 : layout.rows); rs++) {
      for (const cl of lens(layout.cols)) {
        for (let cs = 0; cs < (cl === layout.cols ? 1 : layout.cols); cs++) {
          const cells: Cell[] = [];
          for (let i = 0; i < rl; i++) for (let j = 0; j < cl; j++) cells.push({ r: (rs + i) % layout.rows, c: (cs + j) % layout.cols });
          if (!cells.every((cell) => values[cellIndex(layout, cell)] === kind)) continue;
          const key = cells.map(cellKey).sort().join('|');
          if (seen.has(key)) continue;
          seen.add(key);
          out.push(cells);
        }
      }
    }
  }
  return out;
}

export interface CoverAnalysis {
  /** Cells of the chosen kind not in any group (rule 4). */
  uncovered: Cell[];
  /** Groups that could be made bigger (rule 5). */
  notLargest: number[];
  /** Groups whose cells are all inside other groups — removable sub-groups. */
  redundant: number[];
  expression: Expr;
  /** Minimum number of groups (and literals) possible for this map. */
  optimalGroups: number;
  optimalLiterals: number;
  isOptimal: boolean;
}

export function analyzeCover(layout: KMapLayout, values: readonly Bit[], groups: Cell[][], kind: KMapGroupKind): CoverAnalysis {
  const covered = new Set(groups.flat().map(cellKey));
  const uncovered = allCells(layout).filter((cell) => values[cellIndex(layout, cell)] === kind && !covered.has(cellKey(cell)));
  const valid = allValidGroups(layout, values, kind);
  const notLargest: number[] = [];
  const redundant: number[] = [];
  groups.forEach((g, i) => {
    const keys = new Set(g.map(cellKey));
    if (valid.some((big) => big.length > keys.size && [...keys].every((k) => big.some((cell) => cellKey(cell) === k)))) notLargest.push(i);
    const others = new Set(groups.filter((_, j) => j !== i).flat().map(cellKey));
    if ([...keys].every((k) => others.has(k))) redundant.push(i);
  });
  const terms = groups.map((g) => groupTerm(layout, g, kind));
  const expression: Expr =
    terms.length === 0 ? { type: 'const', value: kind === 1 ? 0 : 1 } : kind === 1 ? orE(...terms) : andE(...terms);

  const target = values.flatMap((b, i) => (b === kind ? [i] : []));
  const n = layout.variables.length;
  const best = target.length === 0 ? [] : minimumCover(target, n);
  const optimalGroups = best.length;
  const optimalLiterals = best.reduce((s, imp) => {
    let fixed = n;
    for (let m = imp.mask; m; m &= m - 1) fixed--;
    return s + fixed;
  }, 0);
  const literals = terms.reduce((s, t) => s + literalCount(t), 0);
  const isOptimal = uncovered.length === 0 && groups.length === optimalGroups && literals === optimalLiterals;
  return { uncovered, notLargest, redundant, expression, optimalGroups, optimalLiterals, isOptimal };
}

/** Split a (possibly wrapping) group into contiguous rectangles for drawing. */
export function groupRectangles(layout: KMapLayout, cells: Cell[]): { r: number; c: number; h: number; w: number; openTop: boolean; openBottom: boolean; openLeft: boolean; openRight: boolean }[] {
  const runs = (idx: number[], size: number) => {
    const set = new Set(idx);
    if (set.size === size) return [{ start: 0, len: size, wrapStart: false, wrapEnd: false }];
    const sorted = [...set].sort((a, b) => a - b);
    const segments: { start: number; len: number }[] = [];
    for (const i of sorted) {
      const last = segments[segments.length - 1];
      if (last && last.start + last.len === i) last.len++;
      else segments.push({ start: i, len: 1 });
    }
    const wraps = segments.length === 2 && set.has(0) && set.has(size - 1);
    return segments.map((s) => ({
      ...s,
      wrapStart: wraps && s.start === 0,
      wrapEnd: wraps && s.start + s.len === size,
    }));
  };
  const rowRuns = runs(cells.map((c) => c.r), layout.rows);
  const colRuns = runs(cells.map((c) => c.c), layout.cols);
  const rects = [];
  for (const rr of rowRuns)
    for (const cr of colRuns)
      rects.push({ r: rr.start, h: rr.len, c: cr.start, w: cr.len, openTop: rr.wrapStart, openBottom: rr.wrapEnd, openLeft: cr.wrapStart, openRight: cr.wrapEnd });
  return rects;
}
