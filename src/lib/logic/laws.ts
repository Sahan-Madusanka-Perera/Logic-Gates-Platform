import { type Expr, exprKey, flatten, literalCount } from './expression';

/**
 * Checking that one line of a simplification follows from the line before it
 * by the law the student names (N p.21–28). A step may apply the same law in
 * several places at once, as the notes do (one "Idempotent law" line removing
 * several repeated terms), but it may not combine different laws: the notes
 * keep the 0s and 1s a complement step leaves behind and remove them with the
 * Identity law on the next line.
 *
 * Reordering and regrouping are allowed inside any step, because lines are
 * compared in a canonical form (AND, OR and XOR flattened, operands sorted).
 */

/** Law names as used in the notes (N p.21), plus the NOT and XOR truth-table facts the notes leave unnamed. */
export const LAWS = [
  'Commutative law',
  'Associative law',
  'Distributive law',
  'Identity law',
  'Complement law',
  'Idempotent law',
  'Double complement law',
  'Redundancy law',
  "De Morgan's law",
  'NOT/XOR rule',
] as const;

export type LawName = (typeof LAWS)[number];

/** The notes also call the complement laws "inverse" laws (N p.21). */
export const LAW_ALIASES: Partial<Record<LawName, string>> = {
  'Complement law': 'inverse law',
  'Double complement law': 'double inverse law',
};

/** The forms of each law, shown beside the law picker. */
export const LAW_FORMS: Record<LawName, string[]> = {
  'Commutative law': ['A.B = B.A', 'A + B = B + A'],
  'Associative law': ['A.(B.C) = (A.B).C', 'A + (B + C) = (A + B) + C'],
  'Distributive law': ['A.(B + C) = A.B + A.C', 'A + B.C = (A + B).(A + C)'],
  'Identity law': ['A.1 = A', 'A + 0 = A', 'A.0 = 0', 'A + 1 = 1'],
  'Complement law': ["A.A' = 0", "A + A' = 1"],
  'Idempotent law': ['A.A = A', 'A + A = A'],
  'Double complement law': ["A'' = A"],
  'Redundancy law': ['A + A.B = A', "A + A'.B = A + B", 'A.(A + B) = A', "A.(A' + B) = A.B"],
  "De Morgan's law": ["(A.B)' = A' + B'", "(A + B)' = A'.B'"],
  'NOT/XOR rule': ["0' = 1", "1' = 0", "A ⊕ B = A.B' + A'.B", 'A ⊕ 0 = A', "A ⊕ 1 = A'", 'A ⊕ A = 0', "A ⊕ A' = 1"],
};

/** "Complement law / inverse law", for the law picker. */
export const lawLabel = (law: LawName) => (LAW_ALIASES[law] ? `${law} / ${LAW_ALIASES[law]}` : law);

type NAry = 'and' | 'or' | 'xor';

const SYMBOL = { and: '.', or: '+', xor: '⊕' } as const;
const keys = new WeakMap<Expr, string>();
/** A compact structural key (cached, as the search compares thousands of lines). */
function keyOf(e: Expr): string {
  let k = keys.get(e);
  if (k === undefined) {
    k = e.type === 'var' ? e.name : e.type === 'const' ? String(e.value) : e.type === 'not' ? `~${keyOf(e.operand)}` : `${SYMBOL[e.type]}(${e.operands.map(keyOf).join(',')})`;
    keys.set(e, k);
  }
  return k;
}
const make = (type: NAry, ops: Expr[]): Expr => (ops.length === 1 ? (ops[0] as Expr) : { type, operands: ops });
const neg = (x: Expr): Expr => ({ type: 'not', operand: x });
const one: Expr = { type: 'const', value: 1 };
const zero: Expr = { type: 'const', value: 0 };
const byKey = (a: Expr, b: Expr) => (keyOf(a) < keyOf(b) ? -1 : keyOf(a) > keyOf(b) ? 1 : 0);

const canonicalForms = new WeakMap<Expr, Expr>();

/**
 * Brackets dropped and operands sorted. With `flat` (the default) nested AND,
 * OR and XOR are also merged, so two lines that differ only by the
 * commutative and associative laws get the same form.
 */
export function canonical(e: Expr, flat = true): Expr {
  const cached = flat ? canonicalForms.get(e) : undefined;
  if (cached) return cached;
  let out: Expr;
  switch (e.type) {
    case 'var':
      out = { type: 'var', name: e.name };
      break;
    case 'const':
      out = { type: 'const', value: e.value };
      break;
    case 'not':
      out = neg(canonical(e.operand, flat));
      break;
    default: {
      const ops: Expr[] = [];
      for (const o of e.operands.map((x) => canonical(x, flat))) {
        if (flat && o.type === e.type) ops.push(...o.operands);
        else ops.push(o);
      }
      out = make(e.type, ops.sort(byKey));
    }
  }
  if (flat) {
    // Rewrites share untouched subtrees with the line they came from, so this keeps each check cheap.
    canonicalForms.set(e, out);
    canonicalForms.set(out, out);
  }
  return out;
}

const isNegationOf = (x: Expr, y: Expr) => (x.type === 'not' && keyOf(x.operand) === keyOf(y)) || (y.type === 'not' && keyOf(y.operand) === keyOf(x));

const without = <T>(xs: T[], ...idx: number[]) => xs.filter((_, i) => !idx.includes(i));

/** Multiset inclusion, comparing by key. */
function includesAll(big: Expr[], small: Expr[]): boolean {
  const pool = big.map(keyOf);
  for (const k of small.map(keyOf)) {
    const at = pool.indexOf(k);
    if (at < 0) return false;
    pool.splice(at, 1);
  }
  return true;
}

/** Non-empty subsets of the first `limit` items. */
function subsets<T>(xs: T[], limit = 6): T[][] {
  const n = Math.min(xs.length, limit);
  const out: T[][] = [];
  for (let mask = 1; mask < 1 << n; mask++) out.push(xs.filter((_, i) => i < n && (mask >> i) & 1));
  return out;
}

/** Multiply out completely: an AND of ORs becomes an OR of ANDs (or the dual). Null when too large. */
function expandFully(type: 'and' | 'or', ops: Expr[]): Expr | null {
  const inner: NAry = type === 'and' ? 'or' : 'and';
  let terms: Expr[][] = [[]];
  for (const o of ops) {
    const parts = o.type === inner ? o.operands : [o];
    terms = terms.flatMap((t) => parts.map((p) => [...t, p]));
    if (terms.length > 64) return null;
  }
  return make(inner, terms.map((t) => make(type, t)));
}

/**
 * Every way to apply `law` once at the top of this canonical node, reading the
 * law left to right (as written in LAW_FORMS). Right-to-left uses, such as
 * factorising or writing A as A.1, are found by searching from the student's
 * line back to the previous one.
 */
function localRewrites(e: Expr, law: LawName): Expr[] {
  const out: Expr[] = [];
  if (e.type === 'var' || e.type === 'const') return out;

  if (e.type === 'not') {
    const o = e.operand;
    if (law === 'Double complement law' && o.type === 'not') out.push(o.operand);
    if (law === "De Morgan's law" && (o.type === 'and' || o.type === 'or')) out.push(make(o.type === 'and' ? 'or' : 'and', o.operands.map(neg)));
    if (law === 'NOT/XOR rule' && o.type === 'const') out.push(o.value === 0 ? one : zero);
    return out;
  }

  const ops = e.operands;
  if (e.type === 'xor') {
    if (law !== 'NOT/XOR rule') return out;
    ops.forEach((o, i) => {
      if (o.type === 'const') out.push(o.value === 0 ? make('xor', without(ops, i)) : neg(make('xor', without(ops, i))));
    });
    for (let i = 0; i < ops.length; i++)
      for (let j = i + 1; j < ops.length; j++) {
        const x = ops[i] as Expr;
        const y = ops[j] as Expr;
        const rest = without(ops, i, j);
        const put = (r: Expr) => out.push(rest.length ? make('xor', [...rest, r]) : r);
        if (keyOf(x) === keyOf(y)) put(zero);
        if (isNegationOf(x, y)) put(one);
        put(make('or', [make('and', [x, neg(y)]), make('and', [neg(x), y])]));
        put(make('and', [make('or', [x, y]), make('or', [neg(x), neg(y)])]));
      }
    return out;
  }

  const type = e.type;
  const dual: NAry = type === 'and' ? 'or' : 'and';
  const parts = (x: Expr) => (x.type === dual ? x.operands : [x]);

  switch (law) {
    case 'Identity law': {
      const keep = type === 'and' ? 1 : 0;
      ops.forEach((o, i) => {
        if (o.type === 'const') out.push(o.value === keep ? make(type, without(ops, i)) : o);
      });
      break;
    }
    case 'Complement law':
      for (let i = 0; i < ops.length; i++)
        for (let j = i + 1; j < ops.length; j++) {
          if (isNegationOf(ops[i] as Expr, ops[j] as Expr)) out.push(make(type, [...without(ops, i, j), type === 'and' ? zero : one]));
        }
      break;
    case 'Idempotent law':
      ops.forEach((o, i) => {
        if (ops.findIndex((x) => keyOf(x) === keyOf(o)) < i) out.push(make(type, without(ops, i)));
      });
      break;
    case 'Redundancy law':
      // A + A.B = A and A + A'.B = A + B, and the duals A.(A + B) = A and A.(A' + B) = A.B.
      ops.forEach((x, i) =>
        ops.forEach((y, j) => {
          if (i === j || y.type !== dual) return;
          const ys = y.operands;
          if (ys.length > parts(x).length && includesAll(ys, parts(x))) out.push(make(type, without(ops, j)));
          ys.forEach((f, k) => {
            if (isNegationOf(f, x)) out.push(make(type, ops.map((o, m) => (m === j ? make(dual, without(ys, k)) : o))));
          });
        }),
      );
      break;
    case 'Distributive law': {
      // A.(B + C) = A.B + A.C and A + B.C = (A + B).(A + C), spreading any group of the other operands.
      ops.forEach((t, i) => {
        if (t.type !== dual) return;
        const others = without(ops, i);
        for (const s of subsets(others)) {
          const rest = others.filter((o) => !s.includes(o));
          const spread = make(dual, t.operands.map((ti) => make(type, [...s, ti])));
          out.push(rest.length ? make(type, [...rest, spread]) : spread);
        }
      });
      // Multiplying out every bracket at once is still one law, as the notes do (N p.42–51).
      if (ops.filter((o) => o.type === dual).length > 1) {
        const full = expandFully(type, ops);
        if (full) out.push(full);
      }
      break;
    }
    default:
      break;
  }
  return out;
}

/** One application of `law` anywhere in the expression. */
function rewritesEverywhere(e: Expr, law: LawName): Expr[] {
  const out = localRewrites(e, law);
  if (e.type === 'not') {
    for (const r of rewritesEverywhere(e.operand, law)) out.push(neg(r));
  } else if (e.type !== 'var' && e.type !== 'const') {
    e.operands.forEach((o, i) => {
      for (const r of rewritesEverywhere(o, law)) out.push({ type: e.type, operands: e.operands.map((x, k) => (k === i ? r : x)) });
    });
  }
  return out;
}

/** Every result of applying `law` once, left to right, somewhere in `e` (exported for tests). */
export const applyLawOnce = (e: Expr, law: LawName): Expr[] => rewritesEverywhere(canonical(e), law);

/** Can `to` be reached from `from` by applying `law` (left to right) in up to `maxApplications` places? */
function reaches(from: Expr, to: Expr, law: LawName, maxApplications = 8, maxStates = 3000): boolean {
  const target = keyOf(canonical(to));
  // The distributive law never removes variables, so a line already longer than the target is a dead end.
  const tooLong = law === 'Distributive law' ? literalCount(to) : Infinity;
  const start = canonical(from);
  const seen = new Set([keyOf(start)]);
  let frontier = [start];
  for (let depth = 0; depth < maxApplications && frontier.length > 0; depth++) {
    const next: Expr[] = [];
    for (const e of frontier) {
      for (const r of rewritesEverywhere(e, law)) {
        const c = canonical(r);
        const k = keyOf(c);
        if (k === target) return true;
        if (seen.has(k) || literalCount(c) > tooLong) continue;
        seen.add(k);
        if (seen.size > maxStates) return false;
        next.push(c);
      }
    }
    frontier = next;
  }
  return false;
}

/** The distinct literals (A, A', 0, 1 …) in an expression. */
function literalsOf(e: Expr, out = new Set<string>()): Set<string> {
  if (e.type === 'var' || e.type === 'const' || (e.type === 'not' && (e.operand.type === 'var' || e.operand.type === 'const'))) out.add(keyOf(e));
  else if (e.type === 'not') literalsOf(e.operand, out);
  else for (const o of e.operands) literalsOf(o, out);
  return out;
}

const sameSet = (a: Set<string>, b: Set<string>) => a.size === b.size && [...a].every((x) => b.has(x));

/** True when `next` is `previous` with `law` applied (in either direction) in one or more places. */
export function stepUsesLaw(previous: Expr, next: Expr, law: LawName): boolean {
  if (law === 'Commutative law' || law === 'Associative law') return false;
  // The distributive law only moves and copies literals, so it cannot add or remove one.
  if (law === 'Distributive law' && !sameSet(literalsOf(previous), literalsOf(next))) return false;
  return reaches(previous, next, law) || reaches(next, previous, law);
}

export type StepCheck =
  | { ok: true }
  | { ok: false; reason: 'unchanged' }
  /** Only the order or grouping changed, and the law named was not the one that does that. */
  | { ok: false; reason: 'reorder'; laws: LawName[] }
  /** The step is one law, but not the one named. */
  | { ok: false; reason: 'other-law'; laws: LawName[] }
  /** Equal, but no single law turns one line into the other. */
  | { ok: false; reason: 'several-laws' };

/**
 * Check one simplification step against the law the student named. The caller
 * checks first that the two lines are equivalent (every truth-table row).
 */
export function checkStep(previous: Expr, next: Expr, law: LawName): StepCheck {
  if (exprKey(previous) === exprKey(next)) return { ok: false, reason: 'unchanged' };

  if (keyOf(canonical(previous)) === keyOf(canonical(next))) {
    // Same operands throughout: the step moved them (commutative), regrouped them (associative), or both.
    const moved = exprKey(flatten(previous)) !== exprKey(flatten(next));
    const regrouped = keyOf(canonical(previous, false)) !== keyOf(canonical(next, false));
    const laws: LawName[] = [...(moved ? (['Commutative law'] as const) : []), ...(regrouped ? (['Associative law'] as const) : [])];
    if (laws.length === 0) return { ok: false, reason: 'unchanged' };
    return laws.includes(law) ? { ok: true } : { ok: false, reason: 'reorder', laws };
  }

  if (stepUsesLaw(previous, next, law)) return { ok: true };
  const others = LAWS.filter((l) => l !== law && stepUsesLaw(previous, next, l));
  return others.length > 0 ? { ok: false, reason: 'other-law', laws: others } : { ok: false, reason: 'several-laws' };
}
