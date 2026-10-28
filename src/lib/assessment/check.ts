import { evaluateCircuit } from '@/lib/logic/circuit';
import { exprToCircuit } from '@/lib/logic/convert';
import {
  type Env,
  type Expr,
  equivalent,
  evaluateExpr,
  literalCount,
  outputsOf,
  parseExpression,
  toText,
  tryParse,
  variablesOf,
} from '@/lib/logic/expression';
import { allCombinations } from '@/lib/logic/gates';
import { allCells, cellIndex, cellKey, kmapLayout } from '@/lib/logic/kmap';
import { leftoverStep, minimalLiteralCount } from '@/lib/logic/minimize';
import { runLatch } from '@/lib/logic/sequential';
import type { Bit } from '@/lib/logic/types';
import type { CheckResult, Question, Response } from './types';

export function questionVariables(q: { expr: string; variables?: string[]; parseVariables?: string[] }): string[] {
  return q.variables ?? variablesOf(parseExpression(q.expr, { variables: q.parseVariables }));
}

const parse = (src: string, multi?: string[]) => parseExpression(src, { variables: multi });

/** Rows of a truth-table question, with the value of every column to fill. */
export function truthTableModel(q: Extract<Question, { type: 'truth-table' }>) {
  const vars = questionVariables(q);
  const out = parse(q.expr, q.parseVariables);
  const cols = (q.columns ?? []).map((c, i) => ({ key: `c${i}`, label: c.label, expr: parse(c.expr, q.parseVariables) }));
  const rows = allCombinations(vars.length).map((bits, index) => {
    const env: Env = Object.fromEntries(vars.map((n, k) => [n, bits[k] as Bit]));
    const values: Record<string, Bit> = {};
    for (const c of cols) values[c.key] = evaluateExpr(c.expr, env);
    values.out = evaluateExpr(out, env);
    return { index, icn: index + 1, inputs: bits, values };
  });
  return { vars, cols, rows, outputLabel: q.outputLabel ?? 'F' };
}

export function intermediateModel(q: Extract<Question, { type: 'intermediate' }>) {
  const expr = parse(q.expr, q.parseVariables);
  const built = exprToCircuit(expr, { fuseNegations: q.fuse ?? false });
  const result = evaluateCircuit(built.circuit, q.assignment);
  if (!result.ok) throw new Error(`Question ${q.id}: circuit is invalid`);
  return { ...built, result };
}

export function kmapModel(q: Extract<Question, { type: 'kmap-fill' }>) {
  const layout = kmapLayout(q.variables);
  const outs = outputsOf(parse(q.expr, q.parseVariables), q.variables);
  return { layout, outs };
}

function isProductOfLiterals(e: Expr): boolean {
  const lit = (x: Expr) => x.type === 'var' || x.type === 'const' || (x.type === 'not' && x.operand.type === 'var');
  return lit(e) || (e.type === 'and' && e.operands.every(lit));
}

function isSumOfLiterals(e: Expr): boolean {
  const lit = (x: Expr) => x.type === 'var' || x.type === 'const' || (x.type === 'not' && x.operand.type === 'var');
  return lit(e) || (e.type === 'or' && e.operands.every(lit));
}

export function isSOP(e: Expr): boolean {
  return isProductOfLiterals(e) || (e.type === 'or' && e.operands.every(isProductOfLiterals));
}

export function isPOS(e: Expr): boolean {
  return isSumOfLiterals(e) || (e.type === 'and' && e.operands.every(isSumOfLiterals));
}

function gridResult(wrong: string[], missing: number, total: number, noun: string, misconception?: string): CheckResult {
  if (missing > 0) return { correct: false, invalid: true, feedback: `Fill in every ${noun} first — ${missing} still empty.` };
  if (wrong.length === 0) return { correct: true, feedback: `All ${total} ${noun}s are correct.` };
  return {
    correct: false,
    wrongCells: wrong,
    misconception,
    feedback: `${wrong.length} of ${total} ${noun}s ${wrong.length === 1 ? 'is' : 'are'} not right yet. They are marked — check those first.`,
  };
}

export function checkAnswer(q: Question, r: Response): CheckResult {
  switch (q.type) {
    case 'mcq': {
      if (r.type !== 'mcq') break;
      const chosen = q.options.find((o) => o.id === r.choice);
      if (!chosen) return { correct: false, invalid: true, feedback: 'Choose an answer first.' };
      if (chosen.id === q.answer) return { correct: true, feedback: 'Correct.' };
      return { correct: false, misconception: chosen.misconception, feedback: 'Not quite.' };
    }
    case 'binary': {
      if (r.type !== 'binary') break;
      const expected = evaluateExpr(parse(q.expr, q.parseVariables), q.assignment);
      return r.value === expected
        ? { correct: true, feedback: `Yes — the output is ${expected}.` }
        : { correct: false, misconception: q.wrongMisconception, feedback: `The output is not ${r.value}.` };
    }
    case 'numeric': {
      if (r.type !== 'numeric') break;
      if (!Number.isFinite(r.value)) return { correct: false, invalid: true, feedback: 'Enter a number.' };
      return r.value === q.answer
        ? { correct: true, feedback: 'Correct.' }
        : { correct: false, misconception: q.wrongMisconception, feedback: `${r.value} is not right.` };
    }
    case 'truth-table': {
      if (r.type !== 'truth-table') break;
      const model = truthTableModel(q);
      const keys = ['out', ...model.cols.map((c) => c.key)];
      const wrong: string[] = [];
      let missing = 0;
      let total = 0;
      for (const row of model.rows) {
        if (q.givenRows?.includes(row.index)) continue;
        for (const k of keys) {
          total++;
          const cell = `${row.index}:${k}`;
          const given = r.cells[cell];
          if (given === null || given === undefined) missing++;
          else if (given !== row.values[k]) wrong.push(cell);
        }
      }
      return gridResult(wrong, missing, total, 'cell', q.wrongMisconception);
    }
    case 'intermediate': {
      if (r.type !== 'intermediate') break;
      const model = intermediateModel(q);
      const wrong: string[] = [];
      let missing = 0;
      const steps = model.result.steps;
      for (const step of steps) {
        const given = r.values[step.nodeId];
        if (given === null || given === undefined) missing++;
        else if (given !== step.output) wrong.push(step.nodeId);
      }
      return gridResult(wrong, missing, steps.length, 'gate value', 'skip-intermediate');
    }
    case 'kmap-fill': {
      if (r.type !== 'kmap-fill') break;
      const { layout, outs } = kmapModel(q);
      const wrong: string[] = [];
      let missing = 0;
      const cells = allCells(layout);
      for (const cell of cells) {
        const given = r.cells[cellKey(cell)];
        if (given === null || given === undefined) missing++;
        else if (given !== outs[cellIndex(layout, cell)]) wrong.push(cellKey(cell));
      }
      return gridResult(wrong, missing, cells.length, 'cell', wrong.length > 0 ? 'kmap-binary-order' : undefined);
    }
    case 'latch-sequence': {
      if (r.type !== 'latch-sequence') break;
      const steps = runLatch(q.latch, q.steps);
      const wrong: string[] = [];
      let missing = 0;
      steps.forEach((s, i) => {
        const given = r.values[i];
        if (given === null || given === undefined) missing++;
        else if (given !== s.after.q) wrong.push(String(i));
      });
      return gridResult(wrong, missing, steps.length, 'Q value');
    }
    case 'expression': {
      if (r.type !== 'expression') break;
      const parsed = tryParse(r.text, { variables: q.parseVariables });
      if (!parsed.ok) return { correct: false, invalid: true, feedback: `Can't read that expression: ${parsed.error.message}.` };
      const target = parse(q.answer, q.parseVariables);
      const allowed = q.variables ?? variablesOf(target);
      const extra = variablesOf(parsed.expr).filter((n) => !allowed.includes(n));
      if (extra.length > 0) {
        return { correct: false, invalid: true, feedback: `This question only uses ${allowed.join(', ')}. Remove ${extra.join(', ')}.` };
      }
      const eq = equivalent(parsed.expr, target);
      if (!eq.equivalent) {
        const where = Object.entries(eq.counterexample)
          .filter(([n]) => allowed.includes(n))
          .map(([n, b]) => `${n} = ${b}`)
          .join(', ');
        return {
          correct: false,
          feedback: `Your expression gives ${eq.left} when ${where || 'the inputs are as shown'}, but the correct output there is ${eq.right}.`,
        };
      }
      if (q.require === 'simplest') {
        const best = minimalLiteralCount(outputsOf(target, allowed), allowed);
        const mine = literalCount(parsed.expr);
        if (mine > best) {
          return {
            correct: false,
            feedback: `It is equivalent — well done — but not fully simplified: it uses ${mine} variable occurrences and ${best} is possible. Keep going.`,
          };
        }
        const left = leftoverStep(parsed.expr);
        if (left) {
          return {
            correct: false,
            feedback: `It is equivalent — well done — but not fully simplified: ${toText(left.at)} can still be simplified${left.law ? ` with the ${left.law}` : ''} (${left.rule}).`,
          };
        }
      }
      if (q.require === 'sop' && !isSOP(parsed.expr)) {
        return { correct: false, feedback: 'Equivalent, but not in sum-of-products form (OR of AND terms, bars only on single variables).' };
      }
      if (q.require === 'pos' && !isPOS(parsed.expr)) {
        return { correct: false, feedback: 'Equivalent, but not in product-of-sums form (AND of OR terms, bars only on single variables).' };
      }
      return { correct: true, feedback: `Correct: ${toText(parsed.expr)}.` };
    }
  }
  return { correct: false, invalid: true, feedback: 'This answer does not match the question type.' };
}
