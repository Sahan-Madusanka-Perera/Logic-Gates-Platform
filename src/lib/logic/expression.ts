import { allCombinations } from './gates';
import type { Bit } from './types';

/**
 * Boolean expression AST. AND/OR/XOR are n-ary so that A.B.C stays one
 * 3-input gate, as in the notes. `paren` records brackets the author wrote,
 * so they are preserved when the expression is shown again.
 */
export type Expr =
  | { type: 'var'; name: string; paren?: boolean }
  | { type: 'const'; value: Bit; paren?: boolean }
  | { type: 'not'; operand: Expr; paren?: boolean }
  | { type: 'and'; operands: Expr[]; paren?: boolean }
  | { type: 'or'; operands: Expr[]; paren?: boolean }
  | { type: 'xor'; operands: Expr[]; paren?: boolean };

export type BinaryOp = 'and' | 'or' | 'xor';

export const v = (name: string): Expr => ({ type: 'var', name });
export const c = (value: Bit): Expr => ({ type: 'const', value });
export const notE = (operand: Expr): Expr => ({ type: 'not', operand });
export const andE = (...operands: Expr[]): Expr => (operands.length === 1 ? (operands[0] as Expr) : { type: 'and', operands });
export const orE = (...operands: Expr[]): Expr => (operands.length === 1 ? (operands[0] as Expr) : { type: 'or', operands });
export const xorE = (...operands: Expr[]): Expr => (operands.length === 1 ? (operands[0] as Expr) : { type: 'xor', operands });

// ---------------------------------------------------------------- parsing

export class ParseError extends Error {
  constructor(
    message: string,
    public readonly position: number,
  ) {
    super(message);
    this.name = 'ParseError';
  }
}

type Token =
  | { t: 'var'; name: string; pos: number }
  | { t: 'const'; value: Bit; pos: number }
  | { t: 'and' | 'or' | 'xor' | 'not' | 'prime' | 'lparen' | 'rparen'; pos: number };

const AND_CHARS = new Set(['.', '·', '*', '&', '∧', '•', '⋅']);
const OR_CHARS = new Set(['+', '|', '∨']);
const XOR_CHARS = new Set(['⊕', '^', '⨁']);
const NOT_CHARS = new Set(['~', '!', '¬']);
const PRIME_CHARS = new Set(["'", '’', '′']);
const WORDS: Record<string, Token['t']> = { AND: 'and', OR: 'or', XOR: 'xor', NOT: 'not' };

export interface ParseOptions {
  /** Multi-letter variable names to recognise, e.g. ["Cin", "Cout"]. */
  variables?: string[];
}

function tokenize(src: string, options: ParseOptions): Token[] {
  const tokens: Token[] = [];
  const multi = [...(options.variables ?? [])].sort((a, b) => b.length - a.length);
  let i = 0;
  while (i < src.length) {
    const ch = src[i] as string;
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    const word = /^[A-Za-z]+/.exec(src.slice(i))?.[0];
    if (word && WORDS[word] && (i + word.length >= src.length || !/[A-Za-z0-9]/.test(src[i + word.length] as string))) {
      tokens.push({ t: WORDS[word] as 'and', pos: i });
      i += word.length;
      continue;
    }
    const named = multi.find((m) => src.startsWith(m, i));
    if (named) {
      tokens.push({ t: 'var', name: named, pos: i });
      i += named.length;
      continue;
    }
    if (/[A-Za-z]/.test(ch)) {
      // A variable is one letter followed by optional digits or a subscript digit (K1, S2, X₁).
      let j = i + 1;
      while (j < src.length && /[0-9₀-₉]/.test(src[j] as string)) j++;
      const raw = src.slice(i, j).replace(/[₀-₉]/g, (d) => String(d.charCodeAt(0) - 0x2080));
      tokens.push({ t: 'var', name: raw, pos: i });
      i = j;
      continue;
    }
    if (ch === '0' || ch === '1') {
      tokens.push({ t: 'const', value: ch === '1' ? 1 : 0, pos: i });
      i++;
      continue;
    }
    if (AND_CHARS.has(ch)) tokens.push({ t: 'and', pos: i });
    else if (OR_CHARS.has(ch)) tokens.push({ t: 'or', pos: i });
    else if (XOR_CHARS.has(ch)) tokens.push({ t: 'xor', pos: i });
    else if (NOT_CHARS.has(ch)) tokens.push({ t: 'not', pos: i });
    else if (PRIME_CHARS.has(ch)) tokens.push({ t: 'prime', pos: i });
    else if (ch === '(' || ch === '[') tokens.push({ t: 'lparen', pos: i });
    else if (ch === ')' || ch === ']') tokens.push({ t: 'rparen', pos: i });
    else throw new ParseError(`"${ch}" is not a symbol this lab understands`, i);
    i++;
  }
  return tokens;
}

/**
 * Parse an expression. Precedence (highest first): NOT / prime, AND (dot or
 * juxtaposition), XOR, OR. Accepts A', ~A, !A, ¬A, NOT A; A.B, AB, A*B; A+B; A⊕B, A^B.
 */
export function parseExpression(src: string, options: ParseOptions = {}): Expr {
  const tokens = tokenize(src, options);
  if (tokens.length === 0) throw new ParseError('Type an expression first', 0);
  let p = 0;
  const peek = () => tokens[p];
  const startsOperand = (tok: Token | undefined) => tok !== undefined && (tok.t === 'var' || tok.t === 'const' || tok.t === 'lparen' || tok.t === 'not');

  function parseOr(): Expr {
    const parts = [parseXor()];
    while (peek()?.t === 'or') {
      p++;
      if (!startsOperand(peek())) throw new ParseError('Something is missing after "+"', peek()?.pos ?? src.length);
      parts.push(parseXor());
    }
    return parts.length === 1 ? (parts[0] as Expr) : { type: 'or', operands: parts };
  }
  function parseXor(): Expr {
    const parts = [parseAnd()];
    while (peek()?.t === 'xor') {
      p++;
      if (!startsOperand(peek())) throw new ParseError('Something is missing after "⊕"', peek()?.pos ?? src.length);
      parts.push(parseAnd());
    }
    return parts.length === 1 ? (parts[0] as Expr) : { type: 'xor', operands: parts };
  }
  function parseAnd(): Expr {
    const parts = [parseUnary()];
    for (;;) {
      const tok = peek();
      if (tok?.t === 'and') {
        p++;
        if (!startsOperand(peek())) throw new ParseError('Something is missing after "."', peek()?.pos ?? src.length);
        parts.push(parseUnary());
      } else if (startsOperand(tok)) {
        parts.push(parseUnary()); // juxtaposition: AB means A.B
      } else break;
    }
    return parts.length === 1 ? (parts[0] as Expr) : { type: 'and', operands: parts };
  }
  function parseUnary(): Expr {
    const tok = peek();
    if (tok?.t === 'not') {
      p++;
      if (!startsOperand(peek())) throw new ParseError('NOT needs something to invert', peek()?.pos ?? src.length);
      return applyPrimes({ type: 'not', operand: parseUnary() });
    }
    return applyPrimes(parsePrimary());
  }
  function applyPrimes(e: Expr): Expr {
    let out = e;
    while (peek()?.t === 'prime') {
      p++;
      out = { type: 'not', operand: out };
    }
    return out;
  }
  function parsePrimary(): Expr {
    const tok = peek();
    if (!tok) throw new ParseError('The expression ends too early', src.length);
    if (tok.t === 'var') {
      p++;
      return { type: 'var', name: tok.name };
    }
    if (tok.t === 'const') {
      p++;
      return { type: 'const', value: tok.value };
    }
    if (tok.t === 'lparen') {
      p++;
      if (peek()?.t === 'rparen') throw new ParseError('Empty brackets', tok.pos);
      const inner = parseOr();
      if (peek()?.t !== 'rparen') throw new ParseError('A closing bracket ")" is missing', peek()?.pos ?? src.length);
      p++;
      return { ...inner, paren: true };
    }
    if (tok.t === 'prime') throw new ParseError("A prime (') must come after a variable or bracket", tok.pos);
    if (tok.t === 'rparen') throw new ParseError('There is a ")" without a matching "("', tok.pos);
    throw new ParseError('An operator is missing its left-hand side', tok.pos);
  }

  const expr = parseOr();
  const rest = peek();
  if (rest) throw new ParseError(rest.t === 'rparen' ? 'There is a ")" without a matching "("' : 'Unexpected symbol', rest.pos);
  return expr;
}

export function tryParse(src: string, options?: ParseOptions): { ok: true; expr: Expr } | { ok: false; error: ParseError } {
  try {
    return { ok: true, expr: parseExpression(src, options) };
  } catch (e) {
    if (e instanceof ParseError) return { ok: false, error: e };
    throw e;
  }
}

// ---------------------------------------------------------------- evaluation

export type Env = Record<string, Bit>;

export function evaluateExpr(expr: Expr, env: Env): Bit {
  switch (expr.type) {
    case 'var': {
      const value = env[expr.name];
      if (value !== 0 && value !== 1) throw new Error(`No value for variable ${expr.name}`);
      return value;
    }
    case 'const':
      return expr.value;
    case 'not':
      return evaluateExpr(expr.operand, env) === 1 ? 0 : 1;
    case 'and':
      return expr.operands.every((o) => evaluateExpr(o, env) === 1) ? 1 : 0;
    case 'or':
      return expr.operands.some((o) => evaluateExpr(o, env) === 1) ? 1 : 0;
    case 'xor':
      return (expr.operands.reduce<number>((acc, o) => acc + evaluateExpr(o, env), 0) % 2) as Bit;
  }
}

/** Natural order: A < B < C, K1 < K2 < K10, Cin after C. */
export function compareVariables(a: string, b: string): number {
  return a.localeCompare(b, 'en', { numeric: true, sensitivity: 'case' });
}

export function variablesOf(expr: Expr): string[] {
  const found = new Set<string>();
  const walk = (e: Expr) => {
    if (e.type === 'var') found.add(e.name);
    else if (e.type === 'not') walk(e.operand);
    else if (e.type !== 'const') e.operands.forEach(walk);
  };
  walk(expr);
  return [...found].sort(compareVariables);
}

export interface ExprTable {
  variables: string[];
  rows: { icn: number; index: number; inputs: Bit[]; output: Bit }[];
}

export function exprTruthTable(expr: Expr, variables: string[] = variablesOf(expr)): ExprTable {
  const combos = allCombinations(variables.length);
  return {
    variables,
    rows: combos.map((bits, i) => {
      const env: Env = {};
      variables.forEach((name, k) => (env[name] = bits[k] as Bit));
      return { icn: i + 1, index: i, inputs: bits, output: evaluateExpr(expr, env) };
    }),
  };
}

export function outputsOf(expr: Expr, variables: string[]): Bit[] {
  return exprTruthTable(expr, variables).rows.map((r) => r.output);
}

/** Exhaustive comparison over the union of both expressions' variables. */
export function equivalent(a: Expr, b: Expr): { equivalent: true } | { equivalent: false; counterexample: Env; left: Bit; right: Bit } {
  const vars = [...new Set([...variablesOf(a), ...variablesOf(b)])].sort(compareVariables);
  for (const bits of allCombinations(vars.length)) {
    const env: Env = {};
    vars.forEach((name, k) => (env[name] = bits[k] as Bit));
    const left = evaluateExpr(a, env);
    const right = evaluateExpr(b, env);
    if (left !== right) return { equivalent: false, counterexample: env, left, right };
  }
  return { equivalent: true };
}

export function isEquivalent(a: Expr | string, b: Expr | string, options?: ParseOptions): boolean {
  const ea = typeof a === 'string' ? parseExpression(a, options) : a;
  const eb = typeof b === 'string' ? parseExpression(b, options) : b;
  return equivalent(ea, eb).equivalent;
}

// ---------------------------------------------------------------- measures

/** Number of variable occurrences (literals). */
export function literalCount(expr: Expr): number {
  switch (expr.type) {
    case 'var':
      return 1;
    case 'const':
      return 0;
    case 'not':
      return literalCount(expr.operand);
    default:
      return expr.operands.reduce((s, o) => s + literalCount(o), 0);
  }
}

/** Number of operators (each NOT, and each n-ary AND/OR/XOR counts once). */
export function operatorCount(expr: Expr): number {
  switch (expr.type) {
    case 'var':
    case 'const':
      return 0;
    case 'not':
      return expr.operand.type === 'var' ? 1 : 1 + operatorCount(expr.operand);
    default:
      return 1 + expr.operands.reduce((s, o) => s + operatorCount(o), 0);
  }
}

// ---------------------------------------------------------------- printing

export interface PrintOptions {
  /** 'dot' prints A.B (the notes' style); 'juxtapose' prints AB. */
  and?: 'dot' | 'juxtapose';
  /** 'prime' prints A' instead of an overbar (plain-text contexts). */
  not?: 'prime' | 'bar-combining';
}

const PREC: Record<Expr['type'], number> = { or: 1, xor: 2, and: 3, not: 4, var: 5, const: 5 };

/** Plain-text form, e.g. "(A + B)'.C". Used for keys, aria labels and the text input. */
export function toText(expr: Expr, opts: PrintOptions = {}): string {
  const andSep = opts.and === 'juxtapose' ? '' : '.';
  const wrap = (e: Expr, parentPrec: number, forceParen = false): string => {
    const s = toText(e, opts);
    const needs = forceParen || PREC[e.type] < parentPrec || (e.paren === true && e.type !== 'var' && e.type !== 'const' && e.type !== 'not');
    return needs ? `(${s})` : s;
  };
  switch (expr.type) {
    case 'var':
      return expr.name;
    case 'const':
      return String(expr.value);
    case 'not': {
      const o = expr.operand;
      if (o.type === 'var' || o.type === 'const') return `${toText(o, opts)}'`;
      if (o.type === 'not') return `${toText(o, opts)}'`;
      return `(${toText(o, opts)})'`;
    }
    case 'and': {
      const parts = expr.operands.map((o) => wrap(o, PREC.and + (o.type === 'and' ? 1 : 0)));
      if (andSep === '') {
        // Juxtaposition is ambiguous for multi-character names: fall back to a dot.
        const ambiguous = expr.operands.some((o) => variablesOf(o).some((n) => n.length > 1));
        return parts.join(ambiguous ? '.' : '');
      }
      return parts.join(andSep);
    }
    case 'or':
      return expr.operands.map((o) => wrap(o, PREC.or + (o.type === 'or' ? 1 : 0))).join(' + ');
    case 'xor':
      return expr.operands.map((o) => wrap(o, PREC.xor + 1)).join(' ⊕ ');
  }
}

/** Stable key for comparing structure (ignores author brackets). */
export function exprKey(expr: Expr): string {
  return toText(stripParens(expr));
}

export function stripParens(expr: Expr): Expr {
  switch (expr.type) {
    case 'var':
      return { type: 'var', name: expr.name };
    case 'const':
      return { type: 'const', value: expr.value };
    case 'not':
      return { type: 'not', operand: stripParens(expr.operand) };
    default:
      return { type: expr.type, operands: expr.operands.map(stripParens) };
  }
}

/** Flatten nested same-type operators: (A.B).C → A.B.C. */
export function flatten(expr: Expr): Expr {
  switch (expr.type) {
    case 'var':
    case 'const':
      return expr;
    case 'not':
      return { type: 'not', operand: flatten(expr.operand) };
    default: {
      const ops: Expr[] = [];
      for (const o of expr.operands.map(flatten)) {
        if (o.type === expr.type) ops.push(...(o as { operands: Expr[] }).operands);
        else ops.push(o);
      }
      return { type: expr.type, operands: ops };
    }
  }
}
