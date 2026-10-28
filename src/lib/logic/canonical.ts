import { type Expr, andE, notE, orE, v } from './expression';
import { indexToBits } from './gates';
import type { Bit } from './types';

export function mintermIndices(outputs: readonly Bit[]): number[] {
  return outputs.flatMap((b, i) => (b === 1 ? [i] : []));
}

export function maxtermIndices(outputs: readonly Bit[]): number[] {
  return outputs.flatMap((b, i) => (b === 0 ? [i] : []));
}

/** Minterm for a row: a product with each variable plain when its bit is 1 and complemented when 0. */
export function mintermExpr(index: number, variables: string[]): Expr {
  const bits = indexToBits(index, variables.length);
  return andE(...variables.map((name, k) => (bits[k] === 1 ? v(name) : notE(v(name)))));
}

/** Maxterm for a row: a sum with each variable plain when its bit is 0 and complemented when 1. */
export function maxtermExpr(index: number, variables: string[]): Expr {
  const bits = indexToBits(index, variables.length);
  return orE(...variables.map((name, k) => (bits[k] === 0 ? v(name) : notE(v(name)))));
}

/** Canonical (standard) SOP: OR of the minterms where the output is 1. */
export function canonicalSOP(outputs: readonly Bit[], variables: string[]): Expr {
  const ms = mintermIndices(outputs);
  if (ms.length === 0) return { type: 'const', value: 0 };
  return orE(...ms.map((m) => mintermExpr(m, variables)));
}

/** Canonical (standard) POS: AND of the maxterms where the output is 0. */
export function canonicalPOS(outputs: readonly Bit[], variables: string[]): Expr {
  const Ms = maxtermIndices(outputs);
  if (Ms.length === 0) return { type: 'const', value: 1 };
  return andE(...Ms.map((m) => maxtermExpr(m, variables)));
}

/**
 * Is the expression in standard (canonical) form? Every product term (SOP) or sum
 * term (POS) must contain every variable exactly once.
 */
export function isStandardForm(expr: Expr, variables: string[], form: 'sop' | 'pos'): boolean {
  const termOp = form === 'sop' ? 'and' : 'or';
  const outerOp = form === 'sop' ? 'or' : 'and';
  const terms = expr.type === outerOp ? expr.operands : [expr];
  return terms.every((t) => {
    const lits = t.type === termOp ? t.operands : [t];
    const names = lits.map((l) => (l.type === 'var' ? l.name : l.type === 'not' && l.operand.type === 'var' ? l.operand.name : null));
    if (names.some((n) => n === null)) return false;
    return names.length === variables.length && new Set(names).size === variables.length && variables.every((x) => names.includes(x));
  });
}
