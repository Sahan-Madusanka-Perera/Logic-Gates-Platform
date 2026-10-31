import { equivalent, type Expr, literalCount, outputsOf, toText, variablesOf } from './expression';
import { canonicalKey, type LawName, stepUsesLaw } from './laws';
import { leftoverStep, minimalLiteralCount, minimalPOS, minimalSOP, minimumCover } from './minimize';

/**
 * Solving a simplification automatically, one law per line, as the notes do
 * (N p.21–28). Every line the solver writes is checked by the same step
 * checker that marks students' lines (laws.ts), so a shown solution can always
 * be typed back into the checker and accepted.
 *
 * Two methods, tried in order:
 *  1. A best-first search over single-law moves (factorise, complement,
 *     identity, absorb, De Morgan, multiply out …). It finds the short,
 *     natural solutions a teacher would write for textbook questions.
 *  2. The standard-form method, which always works: reach a sum of products
 *     (or product of sums), expand every term to a minterm with
 *     A = A.1 = A.(B + B') = A.B + A.B', then combine pairs back into the
 *     groups of the simplest form with X.Y + X.Y' = X.(Y + Y') = X.1 = X.
 */

export interface SolveStep {
  /** The new line. */
  expr: Expr;
  /** The one law that turns the line before into this one. */
  law: LawName;
  /** What was done, with the actual terms, in the RichText [[expr]] markup. */
  note: string;
  /** A nudge for this step that does not give the new line away. */
  hint: string;
}

export interface Solution {
  steps: SolveStep[];
  /** True when the last line is fully simplified (fewest variables, nothing left to remove). */
  complete: boolean;
  /** Which method produced the steps. */
  method: 'already-simplest' | 'search' | 'standard-form' | 'none';
}

type Junction = 'and' | 'or';
type NAry = Junction | 'xor';

interface Move extends SolveStep {
  /** The same move applied one place at a time, for when the checker wants smaller steps. */
  parts?: Move[];
  /** One law applied at one place, exactly as written in LAW_FORMS (see `checked`). */
  onePlace?: true;
}

const ONE: Expr = { type: 'const', value: 1 };
const ZERO: Expr = { type: 'const', value: 0 };
const neg = (x: Expr): Expr => ({ type: 'not', operand: x });
const variable = (name: string): Expr => ({ type: 'var', name });
const dualOf = (t: Junction): Junction => (t === 'and' ? 'or' : 'and');
/** The constant that leaves an AND (1) or an OR (0) unchanged. */
const neutralOf = (t: Junction): Expr => (t === 'and' ? ONE : ZERO);
/** The constant that an AND (0) or an OR (1) collapses to. */
const absorbingOf = (t: Junction): Expr => (t === 'and' ? ZERO : ONE);
const isJunction = (e: Expr): e is Extract<Expr, { type: Junction }> => e.type === 'and' || e.type === 'or';
const isLiteral = (e: Expr) => e.type === 'var' || (e.type === 'not' && e.operand.type === 'var');
const key = canonicalKey;
const sameAs = (a: Expr, b: Expr) => key(a) === key(b);
const isNegationOf = (x: Expr, y: Expr) => (x.type === 'not' && sameAs(x.operand, y)) || (y.type === 'not' && sameAs(y.operand, x));
const without = <T>(xs: readonly T[], ...idx: number[]) => xs.filter((_, i) => !idx.includes(i));

// ---------------------------------------------------------------- display order

const sortKeys = new WeakMap<Expr, string>();
/** Lines are shown in a steady order: A before A', A before A.B, constants last. */
function sortKey(e: Expr): string {
  let k = sortKeys.get(e);
  if (k === undefined) {
    k = e.type === 'var' ? `${e.name}\u0001` : e.type === 'const' ? `\uffff${e.value}` : e.type === 'not' ? `${sortKey(e.operand)}\u0002` : e.operands.map(sortKey).join('\u0000');
    sortKeys.set(e, k);
  }
  return k;
}

/** Build an AND/OR/XOR with nested same-type operands merged and operands in display order. */
function make(type: NAry, ops: readonly Expr[]): Expr {
  const flat: Expr[] = [];
  for (const o of ops) {
    if (o.type === type) flat.push(...o.operands);
    else flat.push(o);
  }
  if (flat.length === 0) return type === 'and' ? ONE : ZERO;
  if (flat.length === 1) return flat[0] as Expr;
  return { type, operands: flat.sort((a, b) => (type === 'and' ? rank(a) - rank(b) : 0) || (sortKey(a) < sortKey(b) ? -1 : sortKey(a) > sortKey(b) ? 1 : 0)) };
}

/** In a product, single letters come first, then brackets, then constants: A.C.(B + B'), A.1. */
const rank = (e: Expr) => (e.type === 'const' ? 2 : isLiteral(e) ? 0 : 1);

function norm(e: Expr): Expr {
  switch (e.type) {
    case 'var':
      return variable(e.name);
    case 'const':
      return e.value === 1 ? ONE : ZERO;
    case 'not':
      return neg(norm(e.operand));
    default:
      return make(e.type, e.operands.map(norm));
  }
}

// ---------------------------------------------------------------- local moves

/** One line's change at one node of the expression. */
interface Local {
  to: Expr;
  law: LawName;
  /** What the step does, without the terms, e.g. "Take out the common factor". */
  action: string;
  hint: string;
  /** The equation to show for this place, when the whole node would be too much. */
  show?: [Expr, Expr];
}

/** Each option is a chain of lines (most moves are one line; a few are short, fixed sequences). */
type LocalFn = (e: Expr) => Local[][];

const instance = (from: Expr, l: Local) => {
  const [a, b] = l.show ?? [from, l.to];
  return `[[${toText(a)} = ${toText(b)}]]`;
};

function noteFor(done: { at: Expr; local: Local }[]): string {
  const actions = [...new Set(done.map((d) => d.local.action))];
  return `${actions
    .map((a) => {
      const shown = done.filter((d) => d.local.action === a).map((d) => instance(d.at, d.local));
      return `${a}: ${shown.join(shown.length > 2 ? ', ' : ' and ')}`;
    })
    .join('; ')}.`;
}

/**
 * The most times one line repeats a law at a single place (removing four 0s, say).
 * The step checker searches up to eight applications per line, so longer
 * clean-ups are split over several lines.
 */
const PER_PLACE = 4;
/** The most places one line changes; the rest are left for the next line. */
const PER_LINE = 4;

const doubleComplement: LocalFn = (e) =>
  e.type === 'not' && e.operand.type === 'not' ? [[{ to: e.operand.operand, law: 'Double complement law', action: 'Two bars cancel out', hint: 'Look for a double bar: a NOT of a NOT cancels out.' }]] : [];

const notConstant: LocalFn = (e) =>
  e.type === 'not' && e.operand.type === 'const' ? [[{ to: e.operand.value === 0 ? ONE : ZERO, law: 'NOT/XOR rule', action: 'Invert the constant', hint: 'Look for a bar over a 0 or a 1.' }]] : [];

const identity: LocalFn = (e) => {
  if (!isJunction(e)) return [];
  const t = e.type;
  const hint = 'Look for a 0 or a 1 left inside a term or a bracket.';
  const absorbing = absorbingOf(t);
  if (e.operands.some((o) => sameAs(o, absorbing))) return [[{ to: absorbing, law: 'Identity law', action: t === 'and' ? 'Anything AND 0 is 0' : 'Anything OR 1 is 1', hint }]];
  let removed = 0;
  const keep = e.operands.filter((o) => !(sameAs(o, neutralOf(t)) && removed++ < PER_PLACE));
  if (keep.length === e.operands.length) return [];
  return [[{ to: make(t, keep), law: 'Identity law', action: t === 'and' ? 'AND with 1 leaves a term unchanged' : 'OR with 0 leaves a term unchanged', hint }]];
};

const complement: LocalFn = (e) => {
  if (!isJunction(e)) return [];
  const ops = e.operands;
  for (let i = 0; i < ops.length; i++)
    for (let j = i + 1; j < ops.length; j++) {
      const x = ops[i] as Expr;
      const y = ops[j] as Expr;
      if (!isNegationOf(x, y)) continue;
      const to = make(e.type, [...without(ops, i, j), absorbingOf(e.type)]);
      return [
        [
          {
            to,
            law: 'Complement law',
            action: e.type === 'and' ? 'A term AND its complement is 0' : 'A term OR its complement is 1',
            hint: "Look for a term next to its own complement, such as [[B + B']] or [[B.B']].",
            show: [make(e.type, [x, y]), absorbingOf(e.type)],
          },
        ],
      ];
    }
  return [];
};

const idempotent: LocalFn = (e) => {
  if (!isJunction(e)) return [];
  const seen = new Set<string>();
  let removed = 0;
  const keep = e.operands.filter((o) => (seen.has(key(o)) && removed < PER_PLACE ? (removed++, false) : (seen.add(key(o)), true)));
  if (keep.length === e.operands.length) return [];
  const twice = e.operands.find((o, i) => e.operands.findIndex((x) => sameAs(x, o)) < i) as Expr;
  return [[{ to: make(e.type, keep), law: 'Idempotent law', action: 'A term written twice only needs to appear once', hint: 'Look for the same term written twice.', show: [make(e.type, [twice, twice]), twice] }]];
};

/** Multiset inclusion by canonical key. */
function includesAll(big: readonly Expr[], small: readonly Expr[]): boolean {
  const pool = big.map(key);
  for (const k of small.map(key)) {
    const at = pool.indexOf(k);
    if (at < 0) return false;
    pool.splice(at, 1);
  }
  return true;
}

const redundancy: LocalFn = (e) => {
  if (!isJunction(e)) return [];
  const t = e.type;
  const d = dualOf(t);
  const parts = (x: Expr) => (x.type === d ? x.operands : [x]);
  // A + A.B = A (and A.(A + B) = A), as many times as it applies here.
  let ops = [...e.operands];
  for (let again = true, n = 0; again && n < PER_PLACE; n++) {
    again = false;
    for (let j = 0; j < ops.length && !again; j++) {
      const y = ops[j] as Expr;
      if (y.type !== d) continue;
      if (ops.some((x, i) => i !== j && y.operands.length > parts(x).length && includesAll(y.operands, parts(x)))) {
        ops = without(ops, j);
        again = true;
      }
    }
  }
  if (ops.length < e.operands.length)
    return [
      [
        {
          to: make(t, ops),
          law: 'Redundancy law',
          action: t === 'or' ? 'A term that contains another whole term is not needed' : 'A bracket that contains another whole bracket is not needed',
          hint: t === 'or' ? 'Look for a term that contains another whole term, such as [[A + A.B]].' : 'Look for a bracket that contains another whole bracket, such as [[A.(A + B)]].',
        },
      ],
    ];
  // A + A'.B = A + B (and A.(A' + B) = A.B).
  ops = [...e.operands];
  for (let again = true, n = 0; again && n < PER_PLACE; n++) {
    again = false;
    for (let i = 0; i < ops.length && !again; i++)
      for (let j = 0; j < ops.length && !again; j++) {
        const x = ops[i] as Expr;
        const y = ops[j] as Expr;
        if (i === j || y.type !== d) continue;
        const k = y.operands.findIndex((f) => isNegationOf(f, x));
        if (k >= 0) {
          ops = ops.map((o, m) => (m === j ? make(d, without(y.operands, k)) : o));
          again = true;
        }
      }
  }
  if (sameAs(make(t, ops), e)) return [];
  return [
    [
      {
        to: make(t, ops),
        law: 'Redundancy law',
        action: t === 'or' ? 'The complement inside the other term can be dropped' : 'The complement inside the other bracket can be dropped',
        hint: t === 'or' ? "Look for a term next to another term that contains its complement, such as [[A + A'.B]]." : "Look for a term next to a bracket that contains its complement, such as [[A.(A' + B)]].",
      },
    ],
  ];
};

const deMorgan: LocalFn = (e) =>
  e.type === 'not' && isJunction(e.operand)
    ? [[{ to: make(dualOf(e.operand.type), e.operand.operands.map(neg)), law: "De Morgan's law", action: 'Break the bar and change the sign', hint: 'Look for a bar over a whole bracket or term: break the bar and change the sign.' }]]
    : [];

const xorRules: LocalFn = (e) => {
  if (e.type !== 'xor') return [];
  const ops = e.operands;
  const law: LawName = 'NOT/XOR rule';
  const hint = "Rewrite the XOR with AND, OR and NOT: [[A ⊕ B = A.B' + A'.B]].";
  const out: Local[][] = [];
  const withRest = (rest: Expr[], r: Expr) => (rest.length ? make('xor', [...rest, r]) : r);
  ops.forEach((o, i) => {
    if (o.type === 'const') {
      const rest = make('xor', without(ops, i));
      out.push([{ to: o.value === 0 ? rest : neg(rest), law, action: o.value === 0 ? 'XOR with 0 changes nothing' : 'XOR with 1 inverts', hint: 'Look for an XOR with a 0 or a 1.' }]);
    }
  });
  for (let i = 0; i < ops.length; i++)
    for (let j = i + 1; j < ops.length; j++) {
      const x = ops[i] as Expr;
      const y = ops[j] as Expr;
      if (sameAs(x, y)) out.push([{ to: withRest(without(ops, i, j), ZERO), law, action: 'A term XOR itself is 0', hint: 'Look for a term XORed with itself.' }]);
      else if (isNegationOf(x, y)) out.push([{ to: withRest(without(ops, i, j), ONE), law, action: 'A term XOR its complement is 1', hint: 'Look for a term XORed with its complement.' }]);
    }
  const [x, y] = ops as [Expr, Expr];
  const expanded = make('or', [make('and', [x, neg(y)]), make('and', [neg(x), y])]);
  out.push([{ to: withRest(ops.slice(2), expanded), law, action: 'Write the XOR with AND, OR and NOT', hint, show: [make('xor', [x, y]), expanded] }]);
  return out;
};

/** Multiply out every bracket of an AND (or the dual). Null when too large. */
function expandFully(type: Junction, ops: readonly Expr[]): Expr | null {
  const inner = dualOf(type);
  let terms: Expr[][] = [[]];
  for (const o of ops) {
    const parts = o.type === inner ? o.operands : [o];
    terms = terms.flatMap((t) => parts.map((p) => [...t, p]));
    if (terms.length > 64) return null;
  }
  return make(inner, terms.map((t) => make(type, t)));
}

const distributeAction = (t: Junction) => (t === 'and' ? 'Multiply out the brackets' : 'Spread the OR over the AND');
const distributeHint = (t: Junction) => (t === 'and' ? 'Multiply out a bracket.' : 'Spread an OR over an AND: [[A + B.C = (A + B).(A + C)]].');

const distribute: LocalFn = (e) => {
  if (!isJunction(e)) return [];
  const t = e.type;
  const d = dualOf(t);
  const out: Local[][] = [];
  e.operands.forEach((o, i) => {
    if (o.type !== d) return;
    const others = without(e.operands, i);
    out.push([{ to: make(d, o.operands.map((p) => make(t, [...others, p]))), law: 'Distributive law', action: distributeAction(t), hint: distributeHint(t) }]);
  });
  if (out.length > 1) {
    const full = expandFully(t, e.operands);
    if (full) out.push([{ to: full, law: 'Distributive law', action: distributeAction(t), hint: distributeHint(t) }]);
  }
  return out;
};

/** Multiply out every bracket in one go: used to reach a sum of products (or a product of sums). */
const toTwoLevel =
  (outer: Junction): LocalFn =>
  (e) => {
    const inner = dualOf(outer);
    if (e.type !== inner || !e.operands.some((o) => o.type === outer)) return [];
    const full = expandFully(inner, e.operands);
    return full ? [[{ to: full, law: 'Distributive law', action: distributeAction(inner), hint: distributeHint(inner) }]] : [];
  };

/** Remove one copy of each factor in `small` from `big` (by canonical key). */
function minus(big: readonly Expr[], small: readonly Expr[]): Expr[] {
  const out = [...big];
  for (const s of small) {
    const at = out.findIndex((x) => sameAs(x, s));
    if (at >= 0) out.splice(at, 1);
  }
  return out;
}

/** X.Y + X.Z = X.(Y + Z), and the dual (X + Y).(X + Z) = X + Y.Z: the distributive law read right to left. */
const factor: LocalFn = (e) => {
  if (!isJunction(e) || e.operands.length < 2) return [];
  const t = e.type;
  const d = dualOf(t);
  const ops = e.operands;
  const factorsOf = (x: Expr) => (x.type === d ? x.operands : [x]);
  const out: Local[][] = [];
  const seen = new Set<string>();
  for (let i = 0; i < ops.length; i++)
    for (let j = i + 1; j < ops.length; j++) {
      const fi = factorsOf(ops[i] as Expr);
      const fj = factorsOf(ops[j] as Expr);
      const common: Expr[] = [];
      const pool = [...fj];
      for (const f of fi) {
        const at = pool.findIndex((p) => sameAs(p, f));
        if (at >= 0) {
          common.push(f);
          pool.splice(at, 1);
        }
      }
      if (common.length === 0 || common.length === fi.length || common.length === fj.length) continue;
      const fits = (k: number) => {
        const fk = factorsOf(ops[k] as Expr);
        return fk.length > common.length && includesAll(fk, common);
      };
      const all = ops.map((_, k) => k).filter(fits);
      for (const group of all.length > 2 ? [all, [i, j]] : [[i, j]]) {
        const inside = make(
          t,
          group.map((k) => make(d, minus(factorsOf(ops[k] as Expr), common))),
        );
        const factored = make(d, [...common, inside]);
        const to = make(t, [...without(ops, ...group), factored]);
        if (seen.has(key(to))) continue;
        seen.add(key(to));
        out.push([
          {
            to,
            law: 'Distributive law',
            action: `Take out the common factor [[${toText(make(d, common))}]]`,
            hint: t === 'or' ? 'Look for a factor that two or more terms share, and take it outside a bracket.' : 'Look for a term that two or more brackets share, and take it outside.',
            show: [make(t, group.map((k) => ops[k] as Expr)), factored],
          },
        ]);
      }
    }
  return out;
};

/** True for an OR of products of literals (or the dual): the nodes the term-level macros work on. */
const isTwoLevel = (e: Expr): e is Extract<Expr, { type: Junction }> => isJunction(e) && e.operands.every((o) => isLiteral(o) || (o.type === dualOf(e.type) && o.operands.every(isLiteral)));

/**
 * Bring a missing variable X into a term: T = T.1 = T.(X + X') = T.X + T.X'
 * (and the dual T = T + 0 = T + X.X' = (T + X).(T + X')). Needed for the
 * consensus case A.B + A'.C + B.C = A.B + A'.C.
 */
const bringInVariable =
  (vars: readonly string[]): LocalFn =>
  (e) => {
    if (!isTwoLevel(e)) return [];
    const t = e.type;
    const d = dualOf(t);
    const out: Local[][] = [];
    e.operands.forEach((x, i) => {
      const present = new Set(variablesOf(x));
      for (const name of vars) {
        if (present.has(name)) continue;
        const X = variable(name);
        const pair = make(t, [X, neg(X)]);
        const lines = [make(d, [x, neutralOf(d)]), make(d, [x, pair]), make(t, [make(d, [x, X]), make(d, [x, neg(X)])])];
        const at = (r: Expr) => make(t, e.operands.map((o, k) => (k === i ? r : o)));
        const hint = `Bring the missing variable ${name} into a term: [[${toText(x)} = ${toText(lines[0] as Expr)} = ${toText(lines[1] as Expr)}]].`;
        out.push([
          { to: at(lines[0] as Expr), law: 'Identity law', action: t === 'or' ? 'Multiply by 1, which changes nothing' : 'OR with 0, which changes nothing', hint, show: [x, lines[0] as Expr] },
          { to: at(lines[1] as Expr), law: 'Complement law', action: `Write ${t === 'or' ? '1' : '0'} as [[${toText(pair)}]]`, hint, show: [lines[0] as Expr, lines[1] as Expr] },
          { to: at(lines[2] as Expr), law: 'Distributive law', action: distributeAction(d), hint, show: [lines[1] as Expr, lines[2] as Expr] },
        ]);
      }
    });
    return out;
  };

/**
 * The middle line of bringInVariable on its own: T.1 = T.(X + X') (and
 * T + 0 = T + X.X'), so a solution can carry on from a student's T.1.
 */
const unitToPair =
  (vars: readonly string[]): LocalFn =>
  (e) => {
    if (!isJunction(e)) return [];
    const t = e.type;
    const unit = neutralOf(t);
    const at = e.operands.findIndex((o) => sameAs(o, unit));
    if (at < 0 || !e.operands.every((o, i) => i === at || isLiteral(o))) return [];
    const present = new Set(variablesOf(e));
    return vars
      .filter((name) => !present.has(name))
      .map((name) => {
        const pair = make(dualOf(t), [variable(name), neg(variable(name))]);
        return [
          {
            to: make(t, e.operands.map((o, i) => (i === at ? pair : o))),
            law: 'Complement law' as const,
            action: `Write ${toText(unit)} as [[${toText(pair)}]]`,
            hint: `Write the ${toText(unit)} using a missing variable and its complement, such as [[${toText(pair)}]].`,
            show: [unit, pair] as [Expr, Expr],
          },
        ];
      });
  };

/** X = X + X: write a term twice so that it can be combined with two different terms. */
const duplicate: LocalFn = (e) => {
  if (!isTwoLevel(e) || e.operands.length < 3) return [];
  return e.operands.map((x) => [
    {
      to: make(e.type, [...e.operands, x]),
      law: 'Idempotent law' as const,
      action: 'Write a term twice so that it can be combined with two different terms',
      hint: `A term can be written twice ([[X = X ${e.type === 'or' ? '+' : '.'} X]]) so that it pairs up with two different terms.`,
      show: [x, make(e.type, [x, x])] as [Expr, Expr],
    },
  ]);
};

// ---------------------------------------------------------------- applying moves

interface Placed {
  lines: Expr[];
  at: Expr;
  chain: Local[];
}

/** Every way to apply one option of `fn` at one place in `e`. */
function places(e: Expr, fn: LocalFn): Placed[] {
  const out: Placed[] = fn(e).map((chain) => ({ lines: chain.map((l) => l.to), at: e, chain }));
  if (e.type === 'not') {
    for (const p of places(e.operand, fn)) out.push({ ...p, lines: p.lines.map(neg) });
  } else if (e.type !== 'var' && e.type !== 'const') {
    const type = e.type;
    e.operands.forEach((o, i) => {
      for (const p of places(o, fn)) out.push({ ...p, lines: p.lines.map((l) => make(type, e.operands.map((x, k) => (k === i ? l : x)))) });
    });
  }
  return out;
}

/** Apply the first one-line option of `fn` at every place it fits (outermost first), up to `limit` places. */
function allPlaces(e: Expr, fn: LocalFn, limit = Infinity): { expr: Expr; done: { at: Expr; local: Local }[] } {
  const done: { at: Expr; local: Local }[] = [];
  const go = (x: Expr): Expr => {
    if (done.length >= limit) return x;
    const option = fn(x).find((c) => c.length === 1)?.[0];
    if (option) {
      done.push({ at: x, local: option });
      return option.to;
    }
    if (x.type === 'not') {
      const o = go(x.operand);
      return o === x.operand ? x : neg(o);
    }
    if (x.type === 'var' || x.type === 'const') return x;
    const ops = x.operands.map(go);
    return ops.every((o, i) => o === x.operands[i]) ? x : make(x.type, ops);
  };
  return { expr: go(e), done };
}

/** One line that applies `fn` everywhere it fits, with the one-place-at-a-time version kept as `parts`. */
function everywhere(e: Expr, fn: LocalFn): Move | null {
  const { expr, done } = allPlaces(e, fn, PER_LINE);
  const first = done[0];
  if (!first) return null;
  const move: Move = { expr, law: first.local.law, note: noteFor(done), hint: first.local.hint };
  if (done.length > 1) {
    move.parts = done.map((_, k) => {
      const step = allPlaces(e, fn, k + 1);
      return { expr: step.expr, law: first.local.law, note: noteFor(step.done.slice(k)), hint: first.local.hint };
    });
  }
  return move;
}

function chainMoves(p: Placed): Move[] {
  return p.chain.map((l, k) => ({ expr: p.lines[k] as Expr, law: l.law, note: noteFor([{ at: k === 0 ? p.at : (p.chain[k - 1] as Local).to, local: l }]), hint: l.hint }));
}

// ---------------------------------------------------------------- method 1: search

/** Laws that only ever tidy up, applied everywhere at once. */
const TIDY: LocalFn[] = [doubleComplement, notConstant, identity, complement, idempotent, redundancy];

function successors(e: Expr, vars: readonly string[]): Move[][] {
  const out: Move[][] = [];
  for (const fn of [...TIDY, deMorgan]) {
    const m = everywhere(e, fn);
    if (m) out.push([m]);
  }
  for (const fn of [xorRules, factor, distribute, unitToPair(vars)]) for (const p of places(e, fn)) out.push(chainMoves(p));
  // Writing a term twice, or bringing in a missing variable, only helps in the top-level sum (or product).
  for (const fn of [duplicate, bringInVariable(vars)]) for (const chain of fn(e)) out.push(chainMoves({ lines: chain.map((l) => l.to), at: e, chain }));
  return out;
}

/** Work still to do that the literal count does not show: constants, bars over brackets, XORs. */
function untidiness(e: Expr): number {
  switch (e.type) {
    case 'var':
      return 0;
    case 'const':
      return 1;
    case 'not':
      return (e.operand.type === 'var' ? 0 : 1) + untidiness(e.operand);
    default:
      return (e.type === 'xor' ? 1 : 0) + e.operands.reduce((s, o) => s + untidiness(o), 0);
  }
}

interface Node {
  expr: Expr;
  g: number;
  f: number;
  parent: Node | null;
  moves: Move[];
}

/** A small binary heap ordered by f, then by fewer lines. */
class Queue {
  private items: Node[] = [];
  get size() {
    return this.items.length;
  }
  private less(a: Node, b: Node) {
    return a.f < b.f || (a.f === b.f && a.g < b.g);
  }
  push(n: Node) {
    const xs = this.items;
    xs.push(n);
    for (let i = xs.length - 1; i > 0; ) {
      const p = (i - 1) >> 1;
      if (!this.less(xs[i] as Node, xs[p] as Node)) break;
      [xs[i], xs[p]] = [xs[p] as Node, xs[i] as Node];
      i = p;
    }
  }
  pop(): Node | undefined {
    const xs = this.items;
    const top = xs[0];
    const last = xs.pop();
    if (xs.length > 0 && last) {
      xs[0] = last;
      for (let i = 0; ; ) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < xs.length && this.less(xs[l] as Node, xs[m] as Node)) m = l;
        if (r < xs.length && this.less(xs[r] as Node, xs[m] as Node)) m = r;
        if (m === i) break;
        [xs[i], xs[m]] = [xs[m] as Node, xs[i] as Node];
        i = m;
      }
    }
    return top;
  }
}

/**
 * Best-first search. A small `weight` finds the fewest lines but explores more;
 * a large one heads straight for fewer variables and finds long solutions fast.
 */
function search(start: Expr, vars: readonly string[], best: number, isDone: (e: Expr) => boolean, budget: number, deadline: number, weight = 1.5): Move[] | null {
  const h = (e: Expr) => 0.75 * Math.max(0, literalCount(e) - best) + untidiness(e);
  const maxLiterals = 2 * literalCount(start) + 8;
  const seen = new Map<string, number>([[key(start), 0]]);
  const queue = new Queue();
  queue.push({ expr: start, g: 0, f: weight * h(start), parent: null, moves: [] });
  for (let expanded = 0; queue.size > 0 && expanded < budget && (expanded % 16 !== 0 || now() < deadline); expanded++) {
    const node = queue.pop() as Node;
    if (isDone(node.expr)) {
      const path: Move[] = [];
      for (let n: Node | null = node; n; n = n.parent) path.unshift(...n.moves);
      return path;
    }
    if ((seen.get(key(node.expr)) ?? Infinity) < node.g) continue;
    for (const moves of successors(node.expr, vars)) {
      const expr = (moves[moves.length - 1] as Move).expr;
      if (literalCount(expr) > maxLiterals) continue;
      const g = node.g + moves.length;
      const k = key(expr);
      if ((seen.get(k) ?? Infinity) <= g) continue;
      seen.set(k, g);
      queue.push({ expr, g, f: g + weight * h(expr), parent: node, moves });
    }
  }
  return null;
}

// ---------------------------------------------------------------- method 2: standard form

interface Lit {
  name: string;
  positive: boolean;
}
const litExpr = (l: Lit) => (l.positive ? variable(l.name) : neg(variable(l.name)));

/** The literals of one term of a sum of products (or product of sums), or null if it is not that shape. */
function literalsOfTerm(e: Expr, inner: Junction): Lit[] | null {
  const parts = e.type === inner ? e.operands : [e];
  const out: Lit[] = [];
  for (const p of parts) {
    if (p.type === 'var') out.push({ name: p.name, positive: true });
    else if (p.type === 'not' && p.operand.type === 'var') out.push({ name: p.operand.name, positive: false });
    else return null;
  }
  return out;
}

interface Place {
  before: Expr[];
  after: Expr[];
}

/**
 * Lines that change several terms of the outer AND/OR, at most PER_LINE terms
 * per line, each with the one-term-at-a-time version as `parts`.
 */
function termSteps(outer: Junction, rest: Expr[], list: Place[], law: LawName, action: string, hint: string): Move[] {
  const build = (k: number) => make(outer, [...rest, ...list.flatMap((p, i) => (i < k ? p.after : p.before))]);
  const note = (ps: Place[]) => {
    const shown = ps.map((p) => `[[${toText(make(outer, p.before))} = ${toText(make(outer, p.after))}]]`);
    return `${action}: ${shown.join(shown.length > 2 ? ', ' : ' and ')}.`;
  };
  const out: Move[] = [];
  for (let from = 0; from < list.length; from += PER_LINE) {
    const to = Math.min(list.length, from + PER_LINE);
    const chunk = list.slice(from, to);
    const move: Move = { expr: build(to), law, note: note(chunk), hint };
    if (chunk.length > 1) move.parts = chunk.map((p, i) => ({ expr: build(from + i + 1), law, note: note([p]), hint, onePlace: true }));
    else move.onePlace = true;
    out.push(move);
  }
  return out;
}

function standardForm(start: Expr, vars: readonly string[], isDone: (e: Expr) => boolean, outer: Junction): Move[] {
  const outputs = outputsOf(start, [...vars]);
  const inner = dualOf(outer);
  const moves: Move[] = [];
  let cur = norm(start);

  // Phase A: tidy up, remove XOR and bars over brackets, multiply out into a sum of products (or product of sums).
  const phaseA = [...TIDY, xorRules, deMorgan, toTwoLevel(outer)];
  for (let guard = 0; guard < 80 && !isDone(cur); guard++) {
    const m = phaseA.map((fn) => everywhere(cur, fn)).find((x) => x !== null);
    if (!m || literalCount(m.expr) > 600) break;
    moves.push(m);
    cur = m.expr;
  }
  if (isDone(cur)) return moves;

  const termExprs = cur.type === outer ? cur.operands : [cur];
  const parsed = termExprs.map((t) => literalsOfTerm(t, inner));
  if (parsed.some((p) => p === null)) return moves;
  const order = new Map(vars.map((name, i) => [name, i]));
  const byVar = (ls: Lit[]) => [...ls].sort((a, b) => (order.get(a.name) ?? 0) - (order.get(b.name) ?? 0));
  const product = (ls: Lit[]) => make(inner, byVar(ls).map(litExpr));
  let terms = parsed as Lit[][];

  // Phase B1: expand every term into a minterm (maxterm), one missing variable per round.
  const unit = neutralOf(inner);
  const unitText = toText(unit);
  if (terms.reduce((n, t) => n + 2 ** (vars.length - t.length), 0) * vars.length > MAX_EXPANDED) return moves;
  while (terms.some((t) => t.length < vars.length)) {
    const missing = (t: Lit[]) => vars.find((name) => !t.some((l) => l.name === name)) as string;
    const grow = terms.map((t, i) => (t.length < vars.length ? i : -1)).filter((i) => i >= 0);
    const rest = terms.filter((t) => t.length === vars.length).map(product);
    const stage = (t: Lit[], s: 0 | 1 | 2 | 3): Expr[] => {
      const X = variable(missing(t));
      if (s === 0) return [product(t)];
      if (s === 1) return [make(inner, [product(t), unit])];
      if (s === 2) return [make(inner, [product(t), make(outer, [X, neg(X)])])];
      return [product([...t, { name: missing(t), positive: true }]), product([...t, { name: missing(t), positive: false }])];
    };
    const hint = `Bring each missing variable into its term: [[A = A${inner === 'and' ? '.1' : ' + 0'}]], then write ${unitText} as [[${toText(make(outer, [variable('B'), neg(variable('B'))]))}]].`;
    const steps: [LawName, string][] = [
      ['Identity law', inner === 'and' ? 'Multiply by 1, which changes nothing' : 'OR with 0, which changes nothing'],
      ['Complement law', `Write ${unitText} using the missing variable and its complement`],
      ['Distributive law', distributeAction(inner)],
    ];
    steps.forEach(([law, action], s) => {
      const list = grow.map((i) => ({ before: stage(terms[i] as Lit[], s as 0 | 1 | 2), after: stage(terms[i] as Lit[], (s + 1) as 1 | 2 | 3) }));
      moves.push(...termSteps(outer, rest, list, law, action, hint));
    });
    terms = terms.flatMap((t) => (t.length < vars.length ? [[...t, { name: missing(t), positive: true }], [...t, { name: missing(t), positive: false }]] : [t]));
  }

  // Each term is now one row of the truth table: its minterm (maxterm) number.
  const indexOf = (t: Lit[]) => vars.reduce((n, name) => 2 * n + ((t.find((l) => l.name === name) as Lit).positive === (outer === 'or') ? 1 : 0), 0);
  const rows = outputs.flatMap((b, i) => (b === (outer === 'or' ? 1 : 0) ? [i] : []));
  const cover = minimumCover(rows, vars.length);
  const litsOfRow = (row: number): Lit[] => vars.map((name, k) => ({ name, positive: (((row >> (vars.length - 1 - k)) & 1) === 1) === (outer === 'or') }));
  const need = new Map<number, number>();
  for (const imp of cover) for (const m of imp.covers) need.set(m, (need.get(m) ?? 0) + 1);
  const have = new Map<number, number>();
  for (const t of terms) have.set(indexOf(t), (have.get(indexOf(t)) ?? 0) + 1);

  // Phase B2: keep each row exactly as many times as the groups need it.
  const termOf = (m: number) => product(litsOfRow(m));
  const copies = (counts: Map<number, number>, skip: number[]) => [...counts].filter(([m]) => !skip.includes(m)).flatMap(([m, n]) => Array<Expr>(n).fill(termOf(m)));
  const extra = [...have].filter(([m, n]) => n > (need.get(m) ?? 0)).map(([m]) => m);
  if (extra.length > 0) {
    const list = extra.map((m) => ({ before: Array<Expr>(have.get(m) ?? 0).fill(termOf(m)), after: Array<Expr>(need.get(m) ?? 0).fill(termOf(m)) }));
    moves.push(...termSteps(outer, copies(have, extra), list, 'Idempotent law', 'A term written twice only needs to appear once', 'Look for the same term written twice.'));
    for (const m of extra) have.set(m, need.get(m) ?? 0);
  }
  const again = [...need].filter(([m, n]) => (have.get(m) ?? 0) < n).map(([m]) => m);
  if (again.length > 0) {
    const list = again.map((m) => ({ before: Array<Expr>(have.get(m) ?? 0).fill(termOf(m)), after: Array<Expr>(need.get(m) ?? 0).fill(termOf(m)) }));
    moves.push(...termSteps(outer, copies(have, again), list, 'Idempotent law', 'Write a term again so that it can be used in two groups', `A term can be written twice ([[X = X ${outer === 'or' ? '+' : '.'} X]]) so that it pairs up with two different terms.`));
  }

  // Phase B3: combine pairs that differ in one variable, a round at a time: X.Y + X.Y' = X.(Y + Y') = X.1 = X.
  const groups = cover.map((imp) => ({
    terms: imp.covers.map(litsOfRow),
    eliminate: vars.filter((_, k) => (imp.mask >> (vars.length - 1 - k)) & 1).reverse(),
  }));
  const rounds = Math.max(0, ...groups.map((g) => g.eliminate.length));
  for (let r = 0; r < rounds; r++) {
    const active = groups.filter((g) => g.eliminate.length > r);
    const rest = groups.filter((g) => g.eliminate.length <= r).flatMap((g) => g.terms.map(product));
    const pairs: { common: Lit[]; name: string }[] = [];
    for (const g of active) {
      const name = g.eliminate[r] as string;
      const seen = new Set<string>();
      for (const t of g.terms) {
        const common = t.filter((l) => l.name !== name);
        const k = toText(product(common));
        if (seen.has(k)) continue;
        seen.add(k);
        pairs.push({ common, name });
      }
    }
    const stage = (p: (typeof pairs)[number], s: 0 | 1 | 2 | 3): Expr[] => {
      const X = variable(p.name);
      const X0 = product(p.common);
      if (s === 0) return [product([...p.common, { name: p.name, positive: true }]), product([...p.common, { name: p.name, positive: false }])];
      if (s === 1) return [p.common.length ? make(inner, [X0, make(outer, [X, neg(X)])]) : make(outer, [X, neg(X)])];
      if (s === 2) return [p.common.length ? make(inner, [X0, unit]) : absorbingOf(outer)];
      return [p.common.length ? X0 : absorbingOf(outer)];
    };
    const withCommon = pairs.filter((p) => p.common.length > 0);
    const list = (ps: typeof pairs, from: 0 | 1 | 2, to: 1 | 2 | 3, others: typeof pairs, othersAt: 0 | 1 | 2 | 3) => ({
      rest: [...rest, ...others.flatMap((p) => stage(p, othersAt))],
      list: ps.map((p) => ({ before: stage(p, from), after: stage(p, to) })),
    });
    const factorHint = outer === 'or' ? 'Look for two terms that differ only in one variable, and take out what they share.' : 'Look for two brackets that differ only in one variable, and take out what they share.';
    const noCommon = pairs.filter((p) => p.common.length === 0);
    if (withCommon.length) {
      const a = list(withCommon, 0, 1, noCommon, 0);
      moves.push(...termSteps(outer, a.rest, a.list, 'Distributive law', 'Take out the common factor', factorHint));
    }
    const b = list(pairs, 1, 2, [], 0);
    moves.push(...termSteps(outer, b.rest, b.list, 'Complement law', outer === 'or' ? 'A variable OR its complement is 1' : 'A variable AND its complement is 0', "Look for a variable next to its own complement, such as [[B + B']]."));
    if (withCommon.length) {
      const c = list(withCommon, 2, 3, noCommon, 3);
      moves.push(...termSteps(outer, c.rest, c.list, 'Identity law', inner === 'and' ? 'AND with 1 leaves a term unchanged' : 'OR with 0 leaves a term unchanged', 'Look for a 0 or a 1 left inside a term or a bracket.'));
    }
    for (const g of active) {
      const name = g.eliminate[r] as string;
      const seen = new Set<string>();
      g.terms = g.terms
        .map((t) => t.filter((l) => l.name !== name))
        .filter((t) => {
          const k = toText(product(t));
          return seen.has(k) ? false : (seen.add(k), true);
        });
    }
  }
  return moves;
}

// ---------------------------------------------------------------- checking and the public API

/** Above this many variable occurrences, a one-place line is checked on the truth table only (see `checked`). */
const LONG_LINE = 40;

/**
 * Keep only lines the step checker accepts, splitting a many-place line into
 * one place at a time if needed. With `quick`, a one-place line of the
 * standard-form method longer than LONG_LINE is checked on its truth table
 * only: the step checker accepts such a line (tests check this with
 * `quick: false`), but on lines that long its search takes a large fraction
 * of a second per line.
 */
function checked(start: Expr, moves: Move[], deadline = Infinity, quick = true): SolveStep[] | null {
  // The same test checkStep passes (it only adds reasons for a rejection, which would cost a search per law).
  const ok = (a: Expr, b: Move) =>
    key(a) !== key(b.expr) && equivalent(a, b.expr).equivalent && ((quick && b.onePlace && literalCount(b.expr) > LONG_LINE) || stepUsesLaw(a, b.expr, b.law));
  const out: SolveStep[] = [];
  let prev = start;
  for (const m of moves) {
    if (now() > deadline) return null;
    // Checking a many-place distributive line on a long expression is a large search; one place per line is quick.
    const tryWhole = !m.parts || m.law !== 'Distributive law' || literalCount(m.expr) <= 20;
    if (tryWhole && ok(prev, m)) {
      out.push({ expr: m.expr, law: m.law, note: m.note, hint: m.hint });
      prev = m.expr;
      continue;
    }
    if (!m.parts) return null;
    for (const p of m.parts) {
      if (now() > deadline || !ok(prev, p)) return null;
      out.push({ expr: p.expr, law: p.law, note: p.note, hint: p.hint });
      prev = p.expr;
    }
  }
  return out;
}

/**
 * Stop at the first fully simplified line, then keep any tidy-up line that
 * still removes a variable (a redundancy the "fully simplified" test does not
 * look for, such as A + A'.C.D = A + C.D inside a bracket).
 */
function finish(start: Expr, steps: SolveStep[], isDone: (e: Expr) => boolean): SolveStep[] {
  const at = steps.findIndex((s) => isDone(s.expr));
  const out = at < 0 ? steps : steps.slice(0, at + 1);
  if (at < 0) return out;
  for (let guard = 0; guard < 10; guard++) {
    const last = (out[out.length - 1] ?? { expr: start }).expr;
    const better = TIDY.map((fn) => everywhere(last, fn)).find((m) => m !== null && literalCount(m.expr) < literalCount(last) && isDone(m.expr));
    const step = better && checked(last, [better]);
    if (!step) break;
    out.push(...step);
  }
  return out;
}

/** Past this many variable occurrences, writing every term out in full is too long to be useful. */
const MAX_EXPANDED = 128;

const cache = new Map<string, Solution>();
const now = () => (typeof performance === 'undefined' ? Date.now() : performance.now());

/**
 * A full step-by-step simplification of `start`, one law per line, ending at
 * a fully simplified line: the fewest variable occurrences of any SOP or POS
 * form, and no constant, double bar, repeat or complement pair left. Gives up
 * (complete: false) rather than run for more than about `timeLimit` ms.
 */
export function solveSimplification(start: Expr, options: { timeLimit?: number } = {}): Solution {
  const timeLimit = options.timeLimit ?? 2500;
  const cacheKey = `${toText(start)}|${timeLimit}`;
  const hit = cache.get(cacheKey);
  if (hit) return hit;
  const began = now();
  const vars = variablesOf(start);
  const best = minimalLiteralCount(outputsOf(start, vars), vars);
  const isDone = (e: Expr) => literalCount(e) <= best && leftoverStep(e) === null;
  const solution = ((): Solution => {
    if (isDone(start)) return { steps: [], complete: true, method: 'already-simplest' };
    // First look for a short solution, then for any solution.
    const found = search(norm(start), vars, best, isDone, 300, began + 0.1 * timeLimit, 0.5) ?? search(norm(start), vars, best, isDone, 1500, began + 0.35 * timeLimit);
    const viaSearch = found && checked(start, found, began + timeLimit);
    if (viaSearch) return { steps: finish(start, viaSearch, isDone), complete: true, method: 'search' };
    // The standard form, then a short search to finish (factorising A.C + A.D = A.(C + D), say). If the
    // other standard form is simpler, carry on from the first one's end: multiplying out the simplest SOP
    // is far shorter than multiplying out the expression as given.
    const routes: Junction[] = start.type === 'and' ? ['and', 'or'] : ['or', 'and'];
    let partial: SolveStep[] = [];
    let from = start;
    const moves: Move[] = [];
    for (const outer of routes) {
      moves.push(...standardForm(from, vars, isDone, outer));
      const end = moves[moves.length - 1]?.expr ?? norm(start);
      const finishing = isDone(end) ? [] : (search(end, vars, best, isDone, 400, now() + 0.15 * timeLimit) ?? []);
      const steps = checked(start, [...moves, ...finishing], began + timeLimit);
      if (!steps) break;
      const done = finish(start, steps, isDone);
      const last = done[done.length - 1]?.expr;
      if (last && isDone(last)) return { steps: done, complete: true, method: 'standard-form' };
      if (done.length > partial.length) partial = done;
      from = end;
    }
    return { steps: partial, complete: false, method: partial.length ? 'standard-form' : 'none' };
  })();
  if (cache.size > 200) cache.clear();
  cache.set(cacheKey, solution);
  return solution;
}

/** The simplest SOP or POS form (whichever has fewer variable occurrences): the answer a solution ends at. */
export function simplestForm(e: Expr): Expr {
  const vars = variablesOf(e);
  const outputs = outputsOf(e, vars);
  const sop = minimalSOP(outputs, vars);
  const pos = minimalPOS(outputs, vars);
  return literalCount(pos) < literalCount(sop) ? pos : sop;
}

/** The next line from `current`, or null when it is already fully simplified (or no step was found). */
export function nextStep(current: Expr): SolveStep | null {
  return solveSimplification(current).steps[0] ?? null;
}
