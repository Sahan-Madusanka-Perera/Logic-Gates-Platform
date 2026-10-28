import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { canonicalPOS, canonicalSOP, isStandardForm, maxtermExpr, mintermExpr } from '@/lib/logic/canonical';
import { evaluateCircuit } from '@/lib/logic/circuit';
import { circuitToExpr, exprToCircuit, peelSteps } from '@/lib/logic/convert';
import {
  type Env,
  type Expr,
  equivalent,
  evaluateExpr,
  isEquivalent,
  literalCount,
  outputsOf,
  parseExpression,
  ParseError,
  toText,
  variablesOf,
} from '@/lib/logic/expression';
import { allCombinations } from '@/lib/logic/gates';
import { minimalLiteralCount, minimalPOS, minimalSOP } from '@/lib/logic/minimize';
import type { Bit } from '@/lib/logic/types';

const VARS = ['A', 'B', 'C', 'D'];

/** Random expressions over up to four variables. */
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

const envs = (vars: string[]): Env[] =>
  allCombinations(vars.length).map((bits) => Object.fromEntries(vars.map((n, k) => [n, bits[k] as Bit])));

describe('parser', () => {
  it('accepts every notation used in the notes and past papers', () => {
    const forms = ["(A + B)'.C", '~(A+B).C', '!(A+B)*C', '¬(A+B)·C', 'NOT (A OR B) AND C', "(A+B)'C"];
    const ref = parseExpression("(A+B)'.C");
    for (const f of forms) expect(isEquivalent(parseExpression(f), ref)).toBe(true);
  });

  it('treats juxtaposition as AND and gives AND priority over OR', () => {
    expect(isEquivalent('AB + C', '(A.B) + C')).toBe(true);
    expect(isEquivalent('A + BC', 'A + (B.C)')).toBe(true);
    expect(isEquivalent('A + B.C', '(A + B).C')).toBe(false);
  });

  it('applies primes to the nearest operand', () => {
    expect(isEquivalent("AB'", "A.(B')")).toBe(true);
    expect(isEquivalent("(AB)'", "A' + B'")).toBe(true);
    expect(isEquivalent("A''", 'A')).toBe(true);
  });

  it('reads variables with digits (K1, S2) and multi-letter names on request', () => {
    expect(variablesOf(parseExpression('K1.K2 + K2.K3'))).toEqual(['K1', 'K2', 'K3']);
    expect(variablesOf(parseExpression('A.B + Cin.(A ⊕ B)', { variables: ['Cin'] }))).toEqual(['A', 'B', 'Cin']);
  });

  it('explains malformed input with a position', () => {
    for (const bad of ['', 'A +', '(A + B', 'A + B)', '+A', "'A", 'A ? B', '()']) {
      expect(() => parseExpression(bad)).toThrow(ParseError);
    }
  });

  it('round-trips through the printer', () => {
    fc.assert(
      fc.property(exprArb, (e) => {
        const back = parseExpression(toText(e));
        return equivalent(e, back).equivalent;
      }),
      { numRuns: 400 },
    );
  });

  it('prints in the notes style', () => {
    expect(toText(parseExpression("A'.B + A.B'"))).toBe("A'.B + A.B'");
    expect(toText(parseExpression('(A+B).(C+D)'))).toBe('(A + B).(C + D)');
    expect(toText(parseExpression("((A+B).C)'"))).toBe("((A + B).C)'");
    expect(toText(parseExpression('A.B + C'), { and: 'juxtapose' })).toBe('AB + C');
  });
});

describe('evaluation and equivalence', () => {
  it('XOR of three variables is 1 for an odd number of 1s (N p.7)', () => {
    const e = parseExpression('A ⊕ B ⊕ C');
    expect(outputsOf(e, ['A', 'B', 'C'])).toEqual([0, 1, 1, 0, 1, 0, 0, 1]);
  });

  it('finds counterexamples for non-equivalent expressions', () => {
    const r = equivalent(parseExpression('A + B'), parseExpression('A ⊕ B'));
    expect(r.equivalent).toBe(false);
    if (!r.equivalent) expect(r.counterexample).toEqual({ A: 1, B: 1 });
  });

  it('verifies the Boolean laws listed in the notes (N p.21)', () => {
    const laws: [string, string][] = [
      ["A''", 'A'],
      ['A + A', 'A'],
      ['A.A', 'A'],
      ['A.0', '0'],
      ['A.1', 'A'],
      ['A + 0', 'A'],
      ['A + 1', '1'],
      ["A.A'", '0'],
      ["A + A'", '1'],
      ['A.B', 'B.A'],
      ['A + B', 'B + A'],
      ['A.(B.C)', '(A.B).C'],
      ['A + (B + C)', '(A + B) + C'],
      ['A.(B + C)', 'A.B + A.C'],
      ['A + B.C', '(A + B).(A + C)'],
      ["(A.B)'", "A' + B'"],
      ["(A + B)'", "A'.B'"],
      ['A + A.B', 'A'],
      ["A + A'.B", 'A + B'],
    ];
    for (const [l, r] of laws) expect(isEquivalent(l, r), `${l} = ${r}`).toBe(true);
  });

  it('XOR from basic gates (N p.9): SOP and POS forms', () => {
    expect(isEquivalent('A ⊕ B', "A.B' + A'.B")).toBe(true);
    expect(isEquivalent('A ⊕ B', "(A + B).(A' + B')")).toBe(true);
    expect(isEquivalent('A ⊕ B ⊕ C', "A'.B'.C + A'.B.C' + A.B'.C' + A.B.C")).toBe(true);
    expect(isEquivalent('A ⊕ B ⊕ C', "(A + B + C).(A + B' + C').(A' + B + C').(A' + B' + C)")).toBe(true);
  });
});

describe('expression → circuit → expression', () => {
  it('a generated circuit computes the same function as its expression (property)', () => {
    fc.assert(
      fc.property(exprArb, fc.boolean(), fc.boolean(), (e, fuse, two) => {
        const vars = variablesOf(e);
        const { circuit, outputId } = exprToCircuit(e, { fuseNegations: fuse, twoInputOnly: two, variables: vars });
        for (const env of envs(vars)) {
          const r = evaluateCircuit(circuit, env);
          if (!r.ok || r.outputs[outputId] !== evaluateExpr(e, env)) return false;
        }
        return equivalent(circuitToExpr(circuit), e).equivalent;
      }),
      { numRuns: 300 },
    );
  });

  it('uses NAND/NOR gates when negations are fused', () => {
    const { circuit } = exprToCircuit(parseExpression("((A.B)'.(A.B)')'"), { fuseNegations: true });
    expect(circuit.nodes.filter((n) => n.kind === 'gate').every((n) => n.kind === 'gate' && n.gate === 'NAND')).toBe(true);
  });

  it('peels operators from the outside in (N p.35–36)', () => {
    const steps = peelSteps(parseExpression("((A + B).C)'"));
    expect(steps.map((s) => s.gate)).toEqual(['NOT', 'AND', 'OR']);
    expect(steps.map((s) => s.level)).toEqual([0, 1, 2]);
  });
});

describe('canonical forms and minimisation', () => {
  const outputsArb = fc.integer({ min: 2, max: 4 }).chain((n) =>
    fc.array(fc.constantFrom<Bit>(0, 1), { minLength: 2 ** n, maxLength: 2 ** n }).map((outs) => ({ n, outs })),
  );

  it('canonical SOP/POS and minimal SOP/POS all reproduce the truth table (property)', () => {
    fc.assert(
      fc.property(outputsArb, ({ n, outs }) => {
        const vars = VARS.slice(0, n);
        for (const e of [canonicalSOP(outs, vars), canonicalPOS(outs, vars), minimalSOP(outs, vars), minimalPOS(outs, vars)]) {
          const got = outputsOf(e, vars);
          if (got.join('') !== outs.join('')) return false;
        }
        return literalCount(minimalSOP(outs, vars)) <= literalCount(canonicalSOP(outs, vars));
      }),
      { numRuns: 300 },
    );
  });

  it('minterm m3 of A,B,C is A\'.B.C and maxterm M3 is A + B\' + C\' (N p.39)', () => {
    expect(toText(mintermExpr(3, ['A', 'B', 'C']))).toBe("A'.B.C");
    expect(toText(maxtermExpr(3, ['A', 'B', 'C']))).toBe("A + B' + C'");
  });

  it('majority function: the safe example of N p.49–51', () => {
    const outs: Bit[] = [0, 0, 0, 1, 0, 1, 1, 1];
    const vars = ['K1', 'K2', 'K3'];
    expect(isEquivalent(minimalSOP(outs, vars), parseExpression('K1.K2 + K2.K3 + K1.K3'))).toBe(true);
    expect(literalCount(minimalSOP(outs, vars))).toBe(6);
    expect(literalCount(minimalPOS(outs, vars))).toBe(6);
    expect(minimalLiteralCount(outs, vars)).toBe(6);
    expect(isStandardForm(canonicalSOP(outs, vars), vars, 'sop')).toBe(true);
    expect(isStandardForm(parseExpression('K1.K2 + K2.K3'), vars, 'sop')).toBe(false);
  });

  it('full adder carry: A.B + B.Cin + A.Cin = A.B + Cin.(A ⊕ B) (N p.58–60)', () => {
    const o = { variables: ['Cin'] };
    expect(isEquivalent('A.B + B.Cin + A.Cin', 'A.B + Cin.(A ⊕ B)', o)).toBe(true);
  });
});
