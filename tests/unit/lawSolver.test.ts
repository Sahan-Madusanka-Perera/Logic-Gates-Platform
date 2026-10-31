import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { LESSONS } from '@/content/lessons';
import { QUESTIONS } from '@/data/questions';
import { type Expr, isEquivalent, literalCount, outputsOf, parseExpression, toText, variablesOf } from '@/lib/logic/expression';
import { nextStep, simplestForm, type Solution, solveSimplification } from '@/lib/logic/lawSolver';
import { checkStep } from '@/lib/logic/laws';
import { leftoverStep, minimalLiteralCount } from '@/lib/logic/minimize';
import type { Bit } from '@/lib/logic/types';

const fullySimplified = (start: Expr, e: Expr) => {
  const vars = variablesOf(start);
  return literalCount(e) <= minimalLiteralCount(outputsOf(start, vars), vars) && leftoverStep(e) === null;
};

/** Every line passes the student's step checker with the law it names, and the last is fully simplified. */
function expectValid(src: string, solution: Solution = solveSimplification(parseExpression(src))) {
  const start = parseExpression(src);
  expect(solution.complete, `${src} not solved`).toBe(true);
  let prev = start;
  for (const s of solution.steps) {
    expect(isEquivalent(prev, s.expr), `${toText(prev)} → ${toText(s.expr)}`).toBe(true);
    expect(checkStep(prev, s.expr, s.law), `${toText(prev)} → ${toText(s.expr)} (${s.law})`).toEqual({ ok: true });
    expect(s.note.length).toBeGreaterThan(0);
    expect(s.hint.length).toBeGreaterThan(0);
    prev = s.expr;
  }
  expect(fullySimplified(start, prev), `${src} ends at ${toText(prev)}`).toBe(true);
  return solution;
}

const lines = (src: string) => solveSimplification(parseExpression(src)).steps.map((s) => [toText(s.expr), s.law]);

describe('the solver writes the short solutions a teacher would', () => {
  it('A.B + A.B′: factorise, complement, identity', () => {
    expect(lines("A.B + A.B'")).toEqual([
      ["A.(B + B')", 'Distributive law'],
      ['A.1', 'Complement law'],
      ['A', 'Identity law'],
    ]);
  });

  it('(A + B).(A + B′): the dual, factorising a sum', () => {
    expect(lines("(A + B).(A + B')")).toEqual([
      ["A + B.B'", 'Distributive law'],
      ['A + 0', 'Complement law'],
      ['A', 'Identity law'],
    ]);
  });

  it('A.(A + B) and A + A′.B in one line with the redundancy law', () => {
    expect(lines('A.(A + B)')).toEqual([['A', 'Redundancy law']]);
    expect(lines("A + A'.B")).toEqual([['A + B', 'Redundancy law']]);
  });

  it('the consensus case brings in the missing variable: B.C = B.C.1 = B.C.(A + A′)', () => {
    expect(lines("A.B + A'.C + B.C").map(([, law]) => law)).toEqual(['Identity law', 'Complement law', 'Distributive law', 'Redundancy law']);
    expect(lines("A.B + A'.C + B.C").at(-1)).toEqual(["A.B + A'.C", 'Redundancy law']);
  });

  it("De Morgan, then the double bars, then the rest", () => {
    expect(lines("(A.B')'.A")).toEqual([
      ["A.(A' + B'')", "De Morgan's law"],
      ["A.(A' + B)", 'Double complement law'],
      ['A.B', 'Redundancy law'],
    ]);
  });

  it('XOR is written out with the NOT/XOR rule first', () => {
    expect(lines('A ⊕ A.B')[0]?.[1]).toBe('NOT/XOR rule');
  });

  it('notes show the actual terms', () => {
    const [first] = solveSimplification(parseExpression("A.B + A.B'")).steps;
    expect(first?.note).toBe("Take out the common factor [[A]]: [[A.B + A.B' = A.(B + B')]].");
    expect(first?.hint).toMatch(/factor/);
  });
});

describe('every solution is accepted, line by line, by the step checker', () => {
  it.each([
    "A.B + A.B'",
    "A'.B + A.B + A.B'",
    'B.1',
    "(A.B)' + A",
    "(A + B)'.(A + B')'",
    "A'.B'.C + A'.B.C + A.B'.C + A.B.C",
    'A.C + A.D + B.C + B.D',
    "X.Y.Z + X.Y'.Z + X.Y.Z'",
    "A.B + A.B' + A'.B + A'.B'",
    "A.B + A.B'.C + A.B.C + A'.B.C'",
    "A'.B.C + A'.B.C'.D + A.B.C.D'",
    "A.(A' + B).(B + C)",
    "((A ⊕ B) + A.B)'",
    "A ⊕ 1 ⊕ A",
  ])('%s', (src) => {
    expectValid(src);
  });

  it('the lessons’ simplify exercises', () => {
    const starts = LESSONS.flatMap((l) => l.sections.flatMap((s) => s.blocks.flatMap((b) => (b.kind === 'simplify' ? [b.start] : []))));
    expect(starts.length).toBeGreaterThan(0);
    for (const src of starts) expectValid(src);
  });

  it('every "simplify fully" question in the question bank', () => {
    const starts = QUESTIONS.flatMap((q) => (q.type === 'expression' && q.require === 'simplest' ? [/\[\[(.+?)\]\]/.exec(q.prompt)?.[1]].filter((x): x is string => !!x && !x.includes('=')) : []));
    expect(starts.length).toBeGreaterThan(3);
    for (const src of starts) expectValid(src);
  });

  it('a case that needs the standard-form method, with every line checked in full', () => {
    // Its simplest form is a product of sums, reached by multiplying out the simplest SOP.
    const src = "A'.B.C'.D' + A.B'.D' + A'.B'.C'.D' + A.B'.C + A.B'.C.D'";
    const solution = solveSimplification(parseExpression(src), { timeLimit: 20000 });
    expect(solution.method).toBe('standard-form');
    expectValid(src, solution);
  }, 60000);

  it('random expressions in up to three variables', () => {
    const variable = fc.constantFrom('A', 'B', 'C').map((name): Expr => ({ type: 'var', name }));
    const { expr } = fc.letrec<{ expr: Expr }>((tie) => ({
      expr: fc.oneof(
        { depthSize: 'small', withCrossShrink: true },
        variable,
        variable.map((x): Expr => ({ type: 'not', operand: x })),
        fc.constantFrom<Bit>(0, 1).map((value): Expr => ({ type: 'const', value })),
        tie('expr').map((x): Expr => ({ type: 'not', operand: x as Expr })),
        fc.tuple(fc.constantFrom('and', 'or', 'xor' as const), fc.array(tie('expr'), { minLength: 2, maxLength: 3 })).map(([type, ops]): Expr => ({ type, operands: ops as Expr[] })),
      ),
    }));
    fc.assert(
      fc.property(expr, (e) => {
        expectValid(toText(e), solveSimplification(e, { timeLimit: 20000 }));
      }),
      { numRuns: 120 },
    );
  }, 120000);
});

describe('helpers', () => {
  it('nothing to do when the expression is already fully simplified', () => {
    for (const src of ['A', "A.B + A'.C", "(A + B)'", '0', '1']) {
      const s = solveSimplification(parseExpression(src));
      expect(s).toMatchObject({ steps: [], complete: true, method: 'already-simplest' });
      expect(nextStep(parseExpression(src))).toBeNull();
    }
  });

  it('nextStep is the first line of the solution', () => {
    expect(nextStep(parseExpression("A.B + A.B'"))).toMatchObject({ law: 'Distributive law' });
    expect(toText(nextStep(parseExpression('B.1'))?.expr as Expr)).toBe('B');
  });

  it('simplestForm picks the shorter of the simplest SOP and POS', () => {
    expect(toText(simplestForm(parseExpression('A.C + A.D + B.C + B.D')))).toBe('(A + B).(C + D)');
    expect(toText(simplestForm(parseExpression("A.B + A.B'")))).toBe('A');
  });

  it('stays within its time limit and says so when it cannot finish', () => {
    const e = parseExpression("A'.B.C'.D'.E + B'.C'.D + B'.D.E + A'.B.E + B.D'.E + A'.B.C'.D.E' + A.B.C.D.E + A'.B'.C.D'.E'");
    const t0 = performance.now();
    const s = solveSimplification(e, { timeLimit: 50 });
    expect(performance.now() - t0).toBeLessThan(3000);
    if (!s.complete) expect(s.method === 'none' || s.steps.length > 0).toBe(true);
  });
});
