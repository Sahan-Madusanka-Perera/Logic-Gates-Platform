import { describe, expect, it } from 'vitest';
import { MODULE_IDS } from '@/content/curriculum';
import { MISCONCEPTIONS } from '@/content/misconceptions';
import { buildPaper, diagnosticQuestions, QUESTIONS } from '@/data/questions';
import { checkAnswer } from '@/lib/assessment/check';
import { emptyDraft } from '@/lib/assessment/draft';
import { attemptFor, diagnosticStart, gradeDraft, tallyByModule, tallyRows } from '@/lib/assessment/grade';
import { buildSession, parseSessionSpec } from '@/lib/assessment/sessions';
import type { ExpressionQuestion, McqQuestion } from '@/lib/assessment/types';

const spec = (q: string) => parseSessionSpec(new URLSearchParams(q));

describe('practice sessions', () => {
  it('reads session settings from the URL, with safe fallbacks', () => {
    expect(spec('mode=rapid')).toMatchObject({ mode: 'rapid', count: 10 });
    expect(spec('module=karnaugh-maps')).toMatchObject({ mode: 'topic', module: 'karnaugh-maps' });
    expect(spec('mode=level&level=4')).toMatchObject({ mode: 'level', level: 4 });
    expect(spec('mode=level&level=9')).toMatchObject({ mode: 'mixed' });
    expect(spec('misconception=xor-or')).toMatchObject({ mode: 'mistakes', misconception: 'xor-or' });
    expect(spec('module=not-a-module')).toMatchObject({ mode: 'mixed' });
    expect(spec('count=999')).toMatchObject({ count: 30 });
    expect(spec('')).toMatchObject({ mode: 'mixed' });
  });

  it('every practice mode, topic, level and mistake produces questions', () => {
    for (const mode of ['rapid', 'mixed', 'detective']) expect(buildSession(spec(`mode=${mode}`), 's').questions.length, mode).toBeGreaterThan(0);
    for (const m of MODULE_IDS) expect(buildSession(spec(`module=${m}`), 's').questions.length, m).toBeGreaterThan(0);
    for (let l = 1; l <= 6; l++) expect(buildSession(spec(`mode=level&level=${l}`), 's').questions.length, `level ${l}`).toBeGreaterThan(0);
    for (const m of MISCONCEPTIONS) expect(buildSession(spec(`misconception=${m.id}`), 's').questions.length, m.id).toBeGreaterThan(0);
  });

  it('sessions have no repeated questions and are reproducible from the seed', () => {
    const a = buildSession(spec('mode=mixed&count=20'), 'seed-1').questions.map((q) => q.id);
    const b = buildSession(spec('mode=mixed&count=20'), 'seed-1').questions.map((q) => q.id);
    expect(a).toEqual(b);
    expect(new Set(a).size).toBe(a.length);
  });

  it('rapid fire uses only quick, easier question types', () => {
    const qs = buildSession(spec('mode=rapid&count=30'), 'r').questions;
    for (const q of qs) {
      expect(['binary', 'mcq', 'numeric']).toContain(q.type);
      expect(q.level).toBeLessThanOrEqual(3);
    }
  });

  it('an unknown mistake gives an empty, clearly named session', () => {
    const s = buildSession(spec('misconception=nope'), 's');
    expect(s.questions).toEqual([]);
    expect(s.description).toMatch(/not found/);
  });
});

describe('grading without hints (diagnostic and exam)', () => {
  const mcq = diagnosticQuestions().find((q): q is McqQuestion => q.type === 'mcq') as McqQuestion;

  it('blank answers score 0 and are not stored as attempts', () => {
    const g = gradeDraft(mcq, emptyDraft(mcq));
    expect(g).toMatchObject({ answered: false, result: { correct: false } });
  });

  it('marks correct and wrong answers with the engine', () => {
    const wrong = mcq.options.find((o) => o.id !== mcq.answer);
    expect(gradeDraft(mcq, { type: 'mcq', choice: mcq.answer }).result.correct).toBe(true);
    const w = gradeDraft(mcq, { type: 'mcq', choice: wrong?.id ?? '' });
    expect(w.result.correct).toBe(false);
    expect(attemptFor(w, 'exam')).toMatchObject({ qid: mcq.id, correct: false, hints: 0, revealed: false, mode: 'exam' });
  });

  it('an unreadable expression counts as wrong, not as a crash', () => {
    const q = diagnosticQuestions().find((x) => x.type === 'expression');
    if (!q) return;
    expect(gradeDraft(q, { type: 'expression', text: '((A+' }).result.correct).toBe(false);
  });

  it('the diagnostic covers modules in path order and suggests the first gap', () => {
    const qs = diagnosticQuestions();
    expect(qs).toHaveLength(12);
    const allBlank = qs.map((q) => gradeDraft(q, emptyDraft(q)));
    const tally = tallyByModule(allBlank);
    expect(diagnosticStart(tally)).toBe('foundations');
    const rows = tallyRows(tally);
    expect(rows.map((r) => r.module.number)).toEqual([...rows.map((r) => r.module.number)].sort((a, b) => a - b));
    // All correct → start at circuit design.
    const allRight = Object.fromEntries(rows.map((r) => [r.module.id, { correct: r.total, total: r.total }]));
    expect(diagnosticStart(allRight)).toBe('designing-circuits');
    // Only the K-map question wrong → start at Karnaugh maps.
    expect(diagnosticStart({ ...allRight, 'karnaugh-maps': { correct: 0, total: 1 } })).toBe('karnaugh-maps');
  });

  it('exam papers respect the chosen topics and length', () => {
    const p = buildPaper({ count: 20, seed: 'x', modules: ['boolean-laws', 'karnaugh-maps'] });
    expect(p.length).toBeGreaterThan(0);
    expect(p.length).toBeLessThanOrEqual(20);
    for (const q of p) expect(['boolean-laws', 'karnaugh-maps']).toContain(q.module);
    expect(buildPaper({ count: 10, seed: 'y' })).toHaveLength(10);
  });

  it('"simplify fully" questions reject an answer that still contains a constant, such as B.1', () => {
    const simplest = QUESTIONS.filter((q): q is ExpressionQuestion => q.type === 'expression' && q.require === 'simplest');
    expect(simplest.length).toBeGreaterThan(0);
    for (const q of simplest) {
      expect(checkAnswer(q, { type: 'expression', text: q.answer }).correct, q.id).toBe(true);
      const padded = checkAnswer(q, { type: 'expression', text: `(${q.answer}).1` });
      expect(padded.correct, q.id).toBe(false);
      expect(padded.feedback, q.id).toContain('Identity law');
    }
  });
});
