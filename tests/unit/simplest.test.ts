import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { literalCount, parseExpression, toText } from '@/lib/logic/expression';
import { leftoverStep, minimalLiteralCount, minimalPOS, minimalSOP } from '@/lib/logic/minimize';
import type { Bit } from '@/lib/logic/types';

const leftover = (src: string) => leftoverStep(parseExpression(src));

describe('"fully simplified" needs more than the fewest variables', () => {
  it('B.1 has the minimum literal count but still simplifies to B (Identity law)', () => {
    const e = parseExpression('B.1');
    expect(literalCount(e)).toBe(minimalLiteralCount([0, 1], ['B']));
    expect(leftover('B.1')).toMatchObject({ law: 'Identity law', rule: 'A.1 = A' });
    expect(toText(leftover('B.1')?.at as never)).toBe('B.1');
  });

  it.each([
    ['A + 0', 'Identity law', 'A + 0 = A'],
    ['A.0', 'Identity law', 'A.0 = 0'],
    ['A + 1', 'Identity law', 'A + 1 = 1'],
    ["A''", 'Double complement law', "A'' = A"],
    ['A.A', 'Idempotent law', 'A.A = A'],
    ['A + A', 'Idempotent law', 'A + A = A'],
    ["A.A'", 'Complement law', "A.A' = 0"],
    ["A + A'", 'Complement law', "A + A' = 1"],
  ])('%s → %s (%s)', (src, law, rule) => {
    expect(leftover(src)).toMatchObject({ law, rule });
  });

  it('finds leftovers nested inside larger expressions', () => {
    expect(toText(leftover('(B.1) + C')?.at as never)).toBe('B.1');
    expect(leftover("(A.B)'' + C")).toMatchObject({ law: 'Double complement law' });
    expect(leftover("1'")).toMatchObject({ rule: "1' = 0" });
    expect(leftover('A ⊕ 1')).toMatchObject({ rule: "A ⊕ 1 = A'" });
    expect(leftover('(A.B).A')).toMatchObject({ law: 'Idempotent law' });
  });

  it('accepts expressions with nothing left to remove', () => {
    for (const src of ['B', '0', '1', "A'", 'A.B', 'A + B', "(A + B)'", 'A ⊕ B', "A.(B + C')", "A.B + A'.C"]) expect(leftover(src), src).toBeNull();
  });

  it('the engine’s own minimal SOP and POS never have a leftover step (property)', () => {
    const outputsArb = fc.integer({ min: 1, max: 4 }).chain((n) =>
      fc.array(fc.constantFrom<Bit>(0, 1), { minLength: 2 ** n, maxLength: 2 ** n }).map((outs) => ({ n, outs })),
    );
    fc.assert(
      fc.property(outputsArb, ({ n, outs }) => {
        const vars = ['A', 'B', 'C', 'D'].slice(0, n);
        return leftoverStep(minimalSOP(outs, vars)) === null && leftoverStep(minimalPOS(outs, vars)) === null;
      }),
      { numRuns: 300 },
    );
  });
});
