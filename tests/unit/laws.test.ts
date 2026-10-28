import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { LESSONS } from '@/content/lessons';
import { type Expr, isEquivalent, parseExpression, toText } from '@/lib/logic/expression';
import { applyLawOnce, checkStep, type LawName, LAWS } from '@/lib/logic/laws';
import type { Bit } from '@/lib/logic/types';

const step = (from: string, to: string, law: LawName) => checkStep(parseExpression(from), parseExpression(to), law);

describe('a step is accepted when it follows by the law named', () => {
  it.each<[string, string, LawName]>([
    // Identity law, including A.0 = 0 and A + 1 = 1 (the notes file them under Identity, N p.21–22)
    ['A.1', 'A', 'Identity law'],
    ['A + 0', 'A', 'Identity law'],
    ['A.0', '0', 'Identity law'],
    ['A + 1', '1', 'Identity law'],
    ['A', 'A.1', 'Identity law'],
    ['1.B + A.1', 'B + A', 'Identity law'],
    ['1.B + A.1', 'A + B', 'Identity law'],
    ["0 + A'.B' + A.B + 0", "A'.B' + A.B", 'Identity law'],
    // Complement law
    ["A + A'", '1', 'Complement law'],
    ["A.A'", '0', 'Complement law'],
    ["A.(B + B')", 'A.1', 'Complement law'],
    ["(A' + A).B + A.(B + B')", '1.B + A.1', 'Complement law'],
    ["A.A'.B", '0.B', 'Complement law'],
    // Idempotent law
    ['A + A', 'A', 'Idempotent law'],
    ['A.A', 'A', 'Idempotent law'],
    ["A'.B + A.B + A.B'", "A'.B + A.B + A.B + A.B'", 'Idempotent law'],
    ['A.B + A.B + C + C', 'A.B + C', 'Idempotent law'],
    // Double complement law
    ["A''", 'A', 'Double complement law'],
    ["A''.B''", 'A.B', 'Double complement law'],
    ["(A.B)''", 'A.B', 'Double complement law'],
    ['A', "A''", 'Double complement law'],
    // Redundancy law, both forms and their duals, in several places at once
    ['A + A.B', 'A', 'Redundancy law'],
    ['A.(A + B)', 'A', 'Redundancy law'],
    ["A + A'.B", 'A + B', 'Redundancy law'],
    ["A.(A' + B)", 'A.B', 'Redundancy law'],
    ['A.B + A.B.C', 'A.B', 'Redundancy law'],
    ["Y + Z.Y + X'.Y", 'Y', 'Redundancy law'],
    // Distributive law: expanding, factorising, the OR-over-AND form, multiplying out at once
    ['A.(B + C)', 'A.B + A.C', 'Distributive law'],
    ["A.B + A.B'", "A.(B + B')", 'Distributive law'],
    ["A + A'.B", "(A + A').(A + B)", 'Distributive law'],
    ["(A + A').(A + B)", "A + A'.B", 'Distributive law'],
    ['(A + B).(C + D)', 'A.C + A.D + B.C + B.D', 'Distributive law'],
    ['A.B + A.C + D', 'A.(B + C) + D', 'Distributive law'],
    ['A.B.C + A.B.D', 'A.B.(C + D)', 'Distributive law'],
    ["A'.B + A.B + A.B + A.B'", "(A' + A).B + A.(B + B')", 'Distributive law'],
    // De Morgan's law, keeping double bars for the next line as the notes do
    ["(A.B)'", "A' + B'", "De Morgan's law"],
    ["(A + B)'", "A'.B'", "De Morgan's law"],
    ["A' + B'", "(A.B)'", "De Morgan's law"],
    ["(A' + B')'", "A''.B''", "De Morgan's law"],
    ["(A.B + C)'", "(A' + B').C'", "De Morgan's law"],
    // NOT and XOR truth-table facts
    ["0'", '1', 'NOT/XOR rule'],
    ["B.1'", 'B.0', 'NOT/XOR rule'],
    ['A ⊕ 0', 'A', 'NOT/XOR rule'],
    ['A ⊕ 1', "A'", 'NOT/XOR rule'],
    ['A ⊕ A', '0', 'NOT/XOR rule'],
    ['A ⊕ B', "A.B' + A'.B", 'NOT/XOR rule'],
    ["A'.B + A.B'", 'A ⊕ B', 'NOT/XOR rule'],
    // Reordering and regrouping
    ['B + A', 'A + B', 'Commutative law'],
    ['B.A + C', 'C + A.B', 'Commutative law'],
    ['A.(B.C)', '(A.B).C', 'Associative law'],
    ['(A + B) + C', 'A + (B + C)', 'Associative law'],
  ])('%s = %s (%s)', (from, to, law) => {
    expect(isEquivalent(from, to)).toBe(true);
    expect(step(from, to, law)).toEqual({ ok: true });
  });
});

describe('a step is rejected when the law named does not match', () => {
  it('a correct answer typed in one jump is not one law, whichever law is chosen', () => {
    for (const law of LAWS) expect(step("A.B + A.B'", 'A', law), law).toEqual({ ok: false, reason: 'several-laws' });
  });

  it.each<[string, string, LawName, LawName]>([
    ["A.(B + B')", 'A.1', 'Identity law', 'Complement law'],
    ["A.B + A.B'", "A.(B + B')", 'Complement law', 'Distributive law'],
    ['A.1', 'A', 'Distributive law', 'Identity law'],
    ['A + A.B', 'A', 'Identity law', 'Redundancy law'],
    ["(A.B)'", "A' + B'", 'Complement law', "De Morgan's law"],
    ["A''", 'A', "De Morgan's law", 'Double complement law'],
    ['A + A', 'A', 'Redundancy law', 'Idempotent law'],
  ])('%s = %s is not the %s: it names the %s', (from, to, chosen, actual) => {
    const result = step(from, to, chosen);
    expect(result).toMatchObject({ ok: false, reason: 'other-law' });
    expect(result.ok === false && result.reason === 'other-law' && result.laws).toContain(actual);
  });

  it('a reordering names the commutative or associative law', () => {
    expect(step('B + A', 'A + B', 'Identity law')).toEqual({ ok: false, reason: 'reorder', laws: ['Commutative law'] });
    expect(step('A.(B.C)', '(A.B).C', 'Commutative law')).toEqual({ ok: false, reason: 'reorder', laws: ['Associative law'] });
    expect(step('B + A', 'A + B', 'Associative law')).toEqual({ ok: false, reason: 'reorder', laws: ['Commutative law'] });
  });

  it('two different laws in one line are rejected, as the notes write one law per line', () => {
    // De Morgan's law, then the Double complement law (N p.25–26).
    expect(step("(A' + B')'", 'A.B', "De Morgan's law")).toEqual({ ok: false, reason: 'several-laws' });
    // Complement law, then the Identity law.
    expect(step("A.A'.B", '0', 'Complement law')).toEqual({ ok: false, reason: 'several-laws' });
    expect(step("A.(B + B')", 'A', 'Complement law')).toEqual({ ok: false, reason: 'several-laws' });
  });

  it('an unchanged line is not a step', () => {
    expect(step('A + B', '(A + B)', 'Identity law')).toEqual({ ok: false, reason: 'unchanged' });
  });
});

describe('the lessons', () => {
  it("every worked simplification step follows by the law it names", () => {
    let checked = 0;
    for (const lesson of LESSONS)
      for (const section of lesson.sections)
        for (const block of section.blocks) {
          if (block.kind !== 'simplify' || !block.worked) continue;
          block.worked.forEach((w, i) => {
            const prev = block.worked?.[i - 1];
            if (!prev) return;
            expect(LAWS, w.law).toContain(w.law);
            expect(step(prev.expr, w.expr, w.law as LawName), `${prev.expr} = ${w.expr} (${w.law})`).toEqual({ ok: true });
            checked++;
          });
        }
    expect(checked).toBeGreaterThanOrEqual(8);
  });
});

const VARS = ['A', 'B', 'C'];
const exprArb: fc.Arbitrary<Expr> = fc.letrec<{ e: Expr }>((tie) => ({
  e: fc.oneof(
    { depthSize: 'small', withCrossShrink: true },
    fc.constantFrom(...VARS).map((name): Expr => ({ type: 'var', name })),
    fc.constantFrom<Bit>(0, 1).map((value): Expr => ({ type: 'const', value })),
    tie('e').map((operand): Expr => ({ type: 'not', operand })),
    fc.array(tie('e'), { minLength: 2, maxLength: 3 }).map((operands): Expr => ({ type: 'and', operands })),
    fc.array(tie('e'), { minLength: 2, maxLength: 3 }).map((operands): Expr => ({ type: 'or', operands })),
    fc.array(tie('e'), { minLength: 2, maxLength: 3 }).map((operands): Expr => ({ type: 'xor', operands })),
  ),
})).e;

describe('soundness', () => {
  it('every single application of every law keeps the truth table', () => {
    fc.assert(
      fc.property(exprArb, fc.constantFrom(...LAWS), (e, law) => {
        for (const r of applyLawOnce(e, law)) expect(isEquivalent(e, r), `${toText(e)} → ${toText(r)} (${law})`).toBe(true);
      }),
      { numRuns: 400 },
    );
  });
});
