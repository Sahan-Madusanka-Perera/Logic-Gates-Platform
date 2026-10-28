import { type Expr, andE, exprKey, flatten, literalCount, notE, orE, v } from './expression';
import type { Bit } from './types';

/**
 * An implicant: `value` holds the fixed bits, `mask` has a 1 for every
 * eliminated variable. Bit k (from the left) corresponds to variables[k].
 */
export interface Implicant {
  value: number;
  mask: number;
  covers: number[];
}

function popcount(x: number): number {
  let n = 0;
  for (let y = x; y; y &= y - 1) n++;
  return n;
}

/** Prime implicants of the on-set (Quine–McCluskey). */
export function primeImplicants(onSet: number[], nVars: number): Implicant[] {
  if (onSet.length === 0) return [];
  let current: Implicant[] = [...new Set(onSet)].sort((a, b) => a - b).map((m) => ({ value: m, mask: 0, covers: [m] }));
  const primes: Implicant[] = [];
  const key = (i: Implicant) => `${i.mask}:${i.value}`;
  while (current.length > 0) {
    const used = new Set<string>();
    const next = new Map<string, Implicant>();
    for (let i = 0; i < current.length; i++) {
      for (let j = i + 1; j < current.length; j++) {
        const a = current[i] as Implicant;
        const b = current[j] as Implicant;
        if (a.mask !== b.mask) continue;
        const diff = a.value ^ b.value;
        if (popcount(diff) !== 1) continue;
        const merged: Implicant = {
          value: a.value & ~diff,
          mask: a.mask | diff,
          covers: [...new Set([...a.covers, ...b.covers])].sort((x, y) => x - y),
        };
        used.add(key(a));
        used.add(key(b));
        next.set(key(merged), merged);
      }
    }
    for (const imp of current) if (!used.has(key(imp)) && !primes.some((p) => key(p) === key(imp))) primes.push(imp);
    current = [...next.values()];
  }
  void nVars;
  return primes;
}

function implicantLiterals(imp: Implicant, nVars: number): number {
  return nVars - popcount(imp.mask);
}

/**
 * Exact minimum cover: fewest terms, then fewest literals. Uses essential prime
 * implicants then exhaustive search over the rest (fine for ≤ 6 variables).
 */
export function minimumCover(onSet: number[], nVars: number): Implicant[] {
  const primes = primeImplicants(onSet, nVars);
  const target = [...new Set(onSet)];
  if (target.length === 0) return [];
  // Essential primes.
  const chosen: Implicant[] = [];
  for (const m of target) {
    const covering = primes.filter((p) => p.covers.includes(m));
    if (covering.length === 1 && !chosen.includes(covering[0] as Implicant)) chosen.push(covering[0] as Implicant);
  }
  const coveredBy = (set: Implicant[]) => new Set(set.flatMap((p) => p.covers));
  const remaining = () => target.filter((m) => !coveredBy(chosen).has(m));
  if (remaining().length === 0) return sortImplicants(chosen, nVars);

  const candidates = primes.filter((p) => !chosen.includes(p));
  let best: Implicant[] | null = null;
  const cost = (set: Implicant[]) => [set.length, set.reduce((s, p) => s + implicantLiterals(p, nVars), 0)] as const;
  const better = (a: Implicant[], b: Implicant[] | null) => {
    if (!b) return true;
    const [ta, la] = cost(a);
    const [tb, lb] = cost(b);
    return ta < tb || (ta === tb && la < lb);
  };
  const need = remaining();
  const search = (start: number, picked: Implicant[]) => {
    const covered = coveredBy(picked);
    if (need.every((m) => covered.has(m))) {
      if (better(picked, best)) best = [...picked];
      return;
    }
    if (best && picked.length >= (best as Implicant[]).length) return;
    // Branch on the first uncovered minterm to keep the search small.
    const first = need.find((m) => !covered.has(m)) as number;
    for (let i = start; i < candidates.length; i++) {
      const c = candidates[i] as Implicant;
      if (!c.covers.includes(first)) continue;
      picked.push(c);
      search(0, picked);
      picked.pop();
    }
  };
  search(0, []);
  return sortImplicants([...chosen, ...((best ?? []) as Implicant[])], nVars);
}

function sortImplicants(list: Implicant[], nVars: number): Implicant[] {
  return [...list].sort((a, b) => implicantLiterals(a, nVars) - implicantLiterals(b, nVars) || (a.covers[0] ?? 0) - (b.covers[0] ?? 0));
}

/** Product term for an implicant of the 1s. */
export function implicantToProduct(imp: Implicant, variables: string[]): Expr {
  const n = variables.length;
  const lits: Expr[] = [];
  variables.forEach((name, k) => {
    const bit = 1 << (n - 1 - k);
    if (imp.mask & bit) return;
    lits.push(imp.value & bit ? v(name) : notE(v(name)));
  });
  return lits.length === 0 ? { type: 'const', value: 1 } : andE(...lits);
}

/** Sum term for an implicant of the 0s (variable complemented where its bit is 1). */
export function implicantToSum(imp: Implicant, variables: string[]): Expr {
  const n = variables.length;
  const lits: Expr[] = [];
  variables.forEach((name, k) => {
    const bit = 1 << (n - 1 - k);
    if (imp.mask & bit) return;
    lits.push(imp.value & bit ? notE(v(name)) : v(name));
  });
  return lits.length === 0 ? { type: 'const', value: 0 } : orE(...lits);
}

export function minimalSOP(outputs: readonly Bit[], variables: string[]): Expr {
  const ones = outputs.flatMap((b, i) => (b === 1 ? [i] : []));
  if (ones.length === 0) return { type: 'const', value: 0 };
  if (ones.length === outputs.length) return { type: 'const', value: 1 };
  const cover = minimumCover(ones, variables.length);
  return orE(...cover.map((imp) => implicantToProduct(imp, variables)));
}

export function minimalPOS(outputs: readonly Bit[], variables: string[]): Expr {
  const zeros = outputs.flatMap((b, i) => (b === 0 ? [i] : []));
  if (zeros.length === 0) return { type: 'const', value: 1 };
  if (zeros.length === outputs.length) return { type: 'const', value: 0 };
  const cover = minimumCover(zeros, variables.length);
  return andE(...cover.map((imp) => implicantToSum(imp, variables)));
}

/** Smallest literal count among the minimal SOP and POS forms — the bar for "fully simplified". */
export function minimalLiteralCount(outputs: readonly Bit[], variables: string[]): number {
  return Math.min(literalCount(minimalSOP(outputs, variables)), literalCount(minimalPOS(outputs, variables)));
}

export interface LeftoverStep {
  /** The part of the expression that a law still shortens. */
  at: Expr;
  /** The law's name as used in the notes, when the notes name it. */
  law?: string;
  /** The general rule in plain text, e.g. "A.1 = A". */
  rule: string;
}

const CONSTANT_RULES: Record<'and' | 'or' | 'xor', Record<Bit, { law?: string; rule: string }>> = {
  // The notes group A.0 = 0 and A + 1 = 1 under the Identity law too (N p.21–22).
  and: { 1: { law: 'Identity law', rule: 'A.1 = A' }, 0: { law: 'Identity law', rule: 'A.0 = 0' } },
  or: { 0: { law: 'Identity law', rule: 'A + 0 = A' }, 1: { law: 'Identity law', rule: 'A + 1 = 1' } },
  // The notes do not name these; the step checker calls them the NOT/XOR rule.
  xor: { 0: { law: 'NOT/XOR rule', rule: 'A ⊕ 0 = A' }, 1: { law: 'NOT/XOR rule', rule: "A ⊕ 1 = A'" } },
};

function leftoverIn(e: Expr): LeftoverStep | null {
  switch (e.type) {
    case 'var':
    case 'const':
      return null;
    case 'not':
      if (e.operand.type === 'const') return { at: e, law: 'NOT/XOR rule', rule: e.operand.value === 0 ? "0' = 1" : "1' = 0" };
      if (e.operand.type === 'not') return { at: e, law: 'Double complement law', rule: "A'' = A" };
      return leftoverIn(e.operand);
    default: {
      const c = e.operands.find((o) => o.type === 'const');
      if (c?.type === 'const') return { at: e, ...CONSTANT_RULES[e.type][c.value] };
      const keys = e.operands.map(exprKey);
      if (new Set(keys).size < keys.length) {
        return e.type === 'xor' ? { at: e, law: 'NOT/XOR rule', rule: 'A ⊕ A = 0' } : { at: e, law: 'Idempotent law', rule: e.type === 'and' ? 'A.A = A' : 'A + A = A' };
      }
      if (e.operands.some((o) => o.type === 'not' && keys.includes(exprKey(o.operand)))) {
        return e.type === 'xor' ? { at: e, law: 'NOT/XOR rule', rule: "A ⊕ A' = 1" } : { at: e, law: 'Complement law', rule: e.type === 'and' ? "A.A' = 0" : "A + A' = 1" };
      }
      for (const o of e.operands) {
        const found = leftoverIn(o);
        if (found) return found;
      }
      return null;
    }
  }
}

/**
 * A law that can still shorten an expression even when it already has the fewest
 * variable occurrences: a constant inside a larger expression (B.1 → B), a double
 * bar, or a repeated or complementary operand. Null when nothing is left to remove.
 * "Fully simplified" means the minimal literal count AND no leftover step.
 */
export function leftoverStep(expr: Expr): LeftoverStep | null {
  return leftoverIn(flatten(expr));
}
