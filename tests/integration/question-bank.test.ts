import { describe, expect, it } from 'vitest';
import { MODULE_IDS, moduleOfObjective, OBJECTIVES } from '@/content/curriculum';
import { MISCONCEPTIONS } from '@/content/misconceptions';
import { buildPaper, diagnosticQuestions, masteryQuestions, misconceptionsOf, QUESTIONS, questionById } from '@/data/questions';
import { checkAnswer, intermediateModel, kmapModel, truthTableModel } from '@/lib/assessment/check';
import { hintsFor, workedSolution } from '@/lib/assessment/solve';
import type { Figure, Question, Response } from '@/lib/assessment/types';
import { cellKey, allCells, cellIndex } from '@/lib/logic/kmap';
import { exprToCircuit } from '@/lib/logic/convert';
import { evaluateCircuit } from '@/lib/logic/circuit';
import { evaluateExpr, isEquivalent, parseExpression, tryParse } from '@/lib/logic/expression';
import { runLatch } from '@/lib/logic/sequential';
import { conducts } from '@/lib/logic/switches';
import type { Bit } from '@/lib/logic/types';

const multi = (q: Question) => q.parseVariables;

/** Every [[...]] in rich text must parse (each side of an equation or chain). */
function richExpressions(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/\[\[(.+?)\]\]/g)) {
    for (const part of (m[1] as string).split('=')) if (part.trim()) out.push(part.trim());
  }
  return out;
}

function textsOf(q: Question): string[] {
  const t = [q.prompt, q.explanation, ...(q.hints ?? [])];
  if (q.type === 'mcq') for (const o of q.options) if (o.text) t.push(o.text);
  return t;
}

function figureExprs(f: Figure | undefined): string[] {
  if (!f) return [];
  if (f.kind === 'circuit' || f.kind === 'kmap') return [f.expr];
  if (f.kind === 'truth-table') return [f.expr, ...(f.columns ?? []).map((c) => c.expr)];
  return [];
}

/** The correct response, built from the engine, to prove every question can be answered. */
function correctResponse(q: Question): Response {
  switch (q.type) {
    case 'mcq':
      return { type: 'mcq', choice: q.answer };
    case 'binary':
      return { type: 'binary', value: evaluateExpr(parseExpression(q.expr, { variables: multi(q) }), q.assignment) };
    case 'numeric':
      return { type: 'numeric', value: q.answer };
    case 'expression':
      return { type: 'expression', text: q.answer };
    case 'truth-table': {
      const m = truthTableModel(q);
      const cells: Record<string, Bit> = {};
      for (const row of m.rows) for (const [k, v] of Object.entries(row.values)) cells[`${row.index}:${k}`] = v;
      return { type: 'truth-table', cells };
    }
    case 'intermediate': {
      const m = intermediateModel(q);
      return { type: 'intermediate', values: Object.fromEntries(m.result.steps.map((s) => [s.nodeId, s.output])) };
    }
    case 'kmap-fill': {
      const { layout, outs } = kmapModel(q);
      return { type: 'kmap-fill', cells: Object.fromEntries(allCells(layout).map((c) => [cellKey(c), outs[cellIndex(layout, c)] as Bit])) };
    }
    case 'latch-sequence':
      return { type: 'latch-sequence', values: runLatch(q.latch, q.steps).map((s) => s.after.q) };
  }
}

describe('question bank', () => {
  it('has a healthy number of questions, with unique ids', () => {
    expect(QUESTIONS.length).toBeGreaterThanOrEqual(100);
    const ids = QUESTIONS.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('covers every module and every learning level', () => {
    for (const m of MODULE_IDS) expect(QUESTIONS.filter((q) => q.module === m).length, m).toBeGreaterThanOrEqual(5);
    for (const level of [1, 2, 3, 4, 5, 6]) expect(QUESTIONS.some((q) => q.level === level), `level ${level}`).toBe(true);
  });

  it('covers every objective that is in scope', () => {
    for (const o of OBJECTIVES) expect(QUESTIONS.some((q) => q.objective === o.id), o.id).toBe(true);
  });

  it('files each question under the module its objective belongs to', () => {
    for (const q of QUESTIONS) {
      if (q.module === 'common-mistakes') continue;
      expect(moduleOfObjective(q.objective), q.id).toBe(q.module);
    }
  });

  it.each(QUESTIONS.map((q) => [q.id, q] as const))('%s: every expression parses', (_id, q) => {
    const exprs: string[] = [...figureExprs(q.figure)];
    if ('expr' in q) exprs.push(q.expr);
    if (q.type === 'expression') exprs.push(q.answer);
    if (q.type === 'truth-table') exprs.push(...(q.columns ?? []).map((c) => c.expr));
    if (q.type === 'mcq') for (const o of q.options) exprs.push(...(o.expr ? [o.expr] : []), ...figureExprs(o.figure));
    for (const t of textsOf(q)) exprs.push(...richExpressions(t));
    for (const e of exprs) {
      const r = tryParse(e, { variables: multi(q) });
      expect(r.ok, `${q.id}: "${e}" ${r.ok ? '' : r.error.message}`).toBe(true);
    }
  });

  it.each(QUESTIONS.map((q) => [q.id, q] as const))('%s: the correct answer is marked correct', (_id, q) => {
    const result = checkAnswer(q, correctResponse(q));
    expect(result.invalid, `${q.id}: ${result.feedback}`).toBeFalsy();
    expect(result.correct, `${q.id}: ${result.feedback}`).toBe(true);
  });

  it.each(QUESTIONS.map((q) => [q.id, q] as const))('%s: hints and a worked solution can be generated', (_id, q) => {
    const hints = hintsFor(q);
    if (q.type !== 'mcq' && q.type !== 'numeric' && q.type !== 'expression') expect(hints.length, q.id).toBeGreaterThan(0);
    const sol = workedSolution(q);
    expect(sol.answer.length, q.id).toBeGreaterThan(0);
    for (const t of [...hints, sol.answer, ...sol.steps]) for (const e of richExpressions(t)) expect(tryParse(e, { variables: multi(q) }).ok, `${q.id}: ${e}`).toBe(true);
  });

  it('MCQs have unique option ids, an answer that exists, and at least 3 options', () => {
    for (const q of QUESTIONS) {
      if (q.type !== 'mcq') continue;
      const ids = q.options.map((o) => o.id);
      expect(new Set(ids).size, q.id).toBe(ids.length);
      expect(ids, q.id).toContain(q.answer);
      expect(q.options.length, q.id).toBeGreaterThanOrEqual(3);
      expect(q.options.find((o) => o.id === q.answer)?.misconception, `${q.id}: the answer must not be tagged as a misconception`).toBeUndefined();
    }
  });

  it('engine-verified MCQs: the answer is equivalent to the target and no distractor is', () => {
    const verified = QUESTIONS.filter((q): q is Extract<Question, { type: 'mcq' }> => q.type === 'mcq' && q.verifyEquivalentTo !== undefined);
    expect(verified.length).toBeGreaterThanOrEqual(15);
    for (const q of verified) {
      for (const o of q.options) {
        const e = o.expr ?? (o.figure?.kind === 'circuit' ? o.figure.expr : undefined);
        expect(e, `${q.id}/${o.id} needs an expression`).toBeDefined();
        const same = isEquivalent(e as string, q.verifyEquivalentTo as string, { variables: multi(q) });
        expect(same, `${q.id}/${o.id}: ${e}`).toBe(o.id === q.answer);
      }
    }
  });

  it('expression-option MCQs never offer two options with the same truth table', () => {
    for (const q of QUESTIONS) {
      if (q.type !== 'mcq' || q.verifyEquivalentTo) continue;
      const withExpr = q.options.filter((o) => o.expr);
      if (withExpr.length < 2) continue;
      const answer = q.options.find((o) => o.id === q.answer);
      if (!answer?.expr) continue;
      for (const o of withExpr) if (o.id !== q.answer) expect(isEquivalent(o.expr as string, answer.expr, { variables: multi(q) }), `${q.id}/${o.id}`).toBe(false);
    }
  });

  it('every misconception tag refers to a real misconception, and every misconception exercise exists', () => {
    const ids = new Set(MISCONCEPTIONS.map((m) => m.id));
    for (const q of QUESTIONS) for (const m of misconceptionsOf(q)) expect(ids.has(m), `${q.id}: ${m}`).toBe(true);
    for (const m of MISCONCEPTIONS) {
      expect(m.exercises.length, m.id).toBeGreaterThan(0);
      for (const ex of m.exercises) expect(questionById(ex), `${m.id} → ${ex}`).toBeDefined();
    }
  });

  it('misconception text renders: every expression in it parses', () => {
    for (const m of MISCONCEPTIONS) for (const t of [m.wrong, m.problem, m.correct, m.plausible]) for (const e of richExpressions(t)) expect(tryParse(e).ok, `${m.id}: ${e}`).toBe(true);
  });

  it('wrong answers to binary questions produce a different value (so they are markable)', () => {
    for (const q of QUESTIONS) {
      if (q.type !== 'binary') continue;
      const right = evaluateExpr(parseExpression(q.expr, { variables: multi(q) }), q.assignment);
      const wrong = checkAnswer(q, { type: 'binary', value: right === 1 ? 0 : 1 });
      expect(wrong.correct, q.id).toBe(false);
    }
  });

  it('binary questions with a switch figure ask about the circuit that is drawn', () => {
    for (const q of QUESTIONS) {
      if (q.type !== 'binary' || q.figure?.kind !== 'switch') continue;
      const lamp = conducts(q.figure.net, q.assignment);
      const expected = q.figure.lamp === 'series' ? lamp : lamp === 1 ? 0 : 1;
      expect(evaluateExpr(parseExpression(q.expr), q.assignment), q.id).toBe(expected);
    }
  });

  it('assignments give a value to every variable of the expression', () => {
    for (const q of QUESTIONS) {
      if (q.type !== 'binary' && q.type !== 'intermediate') continue;
      const built = exprToCircuit(parseExpression(q.expr, { variables: multi(q) }));
      expect(evaluateCircuit(built.circuit, q.assignment).ok, q.id).toBe(true);
    }
  });

  it('latch sequences never enter the unpredictable state', () => {
    for (const q of QUESTIONS) {
      if (q.type !== 'latch-sequence') continue;
      for (const s of runLatch(q.latch, q.steps)) expect(s.after.q, q.id).not.toBeNull();
    }
  });

  it('expression questions that require the simplest form accept the stated answer and reject an unsimplified one', () => {
    const q = questionById('law-simp-1');
    expect(q?.type).toBe('expression');
    if (q?.type !== 'expression') return;
    expect(checkAnswer(q, { type: 'expression', text: "A.B + A.B'" }).correct).toBe(false);
    expect(checkAnswer(q, { type: 'expression', text: 'A' }).correct).toBe(true);
  });

  it('the diagnostic has 12 questions from at least 8 modules', () => {
    const d = diagnosticQuestions();
    expect(d).toHaveLength(12);
    expect(new Set(d.map((q) => q.module)).size).toBeGreaterThanOrEqual(8);
  });

  it('every module has a mastery check of 5 distinct questions', () => {
    for (const m of MODULE_IDS) {
      const qs = masteryQuestions(m);
      expect(qs.length, m).toBe(5);
      expect(new Set(qs.map((q) => q.id)).size, m).toBe(5);
    }
  });

  it('papers are deterministic for a seed, sized as asked, and cover many modules', () => {
    const a = buildPaper({ count: 20, seed: 'x' });
    const b = buildPaper({ count: 20, seed: 'x' });
    expect(a.map((q) => q.id)).toEqual(b.map((q) => q.id));
    expect(a).toHaveLength(20);
    expect(new Set(a.map((q) => q.id)).size).toBe(20);
    expect(new Set(a.map((q) => q.module)).size).toBeGreaterThanOrEqual(10);
  });
});
