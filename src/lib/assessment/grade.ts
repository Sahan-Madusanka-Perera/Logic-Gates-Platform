import { MODULES, type ModuleId } from '@/content/curriculum';
import type { AttemptMode } from '@/lib/progress/types';
import { checkAnswer } from './check';
import { type Draft, toResponse } from './draft';
import type { CheckResult, Question } from './types';

export interface Graded {
  question: Question;
  draft: Draft;
  answered: boolean;
  result: CheckResult;
}

/** Mark a draft without hints or retries (diagnostic and exam). Blank answers score 0. */
export function gradeDraft(question: Question, draft: Draft): Graded {
  const response = toResponse(draft);
  if (!response) return { question, draft, answered: false, result: { correct: false, feedback: 'Not answered.' } };
  const result = checkAnswer(question, response);
  return { question, draft, answered: true, result: result.invalid ? { ...result, correct: false } : result };
}

export type ModuleTally = Partial<Record<ModuleId, { correct: number; total: number }>>;

export function tallyByModule(graded: Graded[]): ModuleTally {
  const out: ModuleTally = {};
  for (const g of graded) {
    const t = out[g.question.module] ?? { correct: 0, total: 0 };
    t.total += 1;
    if (g.result.correct) t.correct += 1;
    out[g.question.module] = t;
  }
  return out;
}

/** Tally entries in learning-path order. */
export function tallyRows(tally: ModuleTally): { module: (typeof MODULES)[number]; correct: number; total: number }[] {
  return MODULES.flatMap((m) => {
    const t = tally[m.id];
    return t ? [{ module: m, ...t }] : [];
  });
}

/** The attempt to store for a graded answer (blank answers are not stored). */
export function attemptFor(g: Graded, mode: AttemptMode) {
  return {
    qid: g.question.id,
    objective: g.question.objective,
    module: g.question.module,
    level: g.question.level,
    correct: g.result.correct,
    hints: 0,
    revealed: false,
    mode,
    misconception: g.result.correct ? undefined : g.result.misconception,
  };
}

/** Diagnostic: start at the first topic (in path order) that was not fully correct. */
export function diagnosticStart(tally: ModuleTally): ModuleId {
  for (const row of tallyRows(tally)) {
    if (row.correct < row.total) return row.module.id;
  }
  return 'designing-circuits';
}
