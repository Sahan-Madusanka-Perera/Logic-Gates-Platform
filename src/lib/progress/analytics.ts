import { MODULES, type ModuleId, moduleById } from '@/content/curriculum';
import { MISCONCEPTIONS } from '@/content/misconceptions';
import type { AttemptRecord, ProgressState } from './types';

export type MasteryLevel = 'not-started' | 'started' | 'practising' | 'secure' | 'mastered';

export const MASTERY_LABEL: Record<MasteryLevel, string> = {
  'not-started': 'Not started',
  started: 'Started',
  practising: 'Practising',
  secure: 'Secure',
  mastered: 'Mastered',
};

/** Plain-language definitions shown next to every progress indicator. */
export const MASTERY_EXPLAINED: Record<MasteryLevel, string> = {
  'not-started': 'You have not opened this lesson or answered its questions yet.',
  started: 'You have opened the lesson or answered fewer than 4 questions on it.',
  practising: 'You are answering questions, but fewer than 80% of your last 10 answers were correct, or you have tried fewer than 3 different questions.',
  secure: 'At least 80% of your last 10 answers (minimum 5) were correct, across 3 or more different questions, without showing the solution.',
  mastered: 'Secure, and you have passed the lesson\'s mastery check (80% or more).',
};

export interface ModuleStats {
  module: ModuleId;
  attempts: number;
  correct: number;
  recent: AttemptRecord[];
  recentCorrect: number;
  distinct: number;
  opened: boolean;
  completed: boolean;
  masteryPassed: boolean;
  activities: number;
  level: MasteryLevel;
}

const counts = (a: AttemptRecord) => a.correct && !a.revealed;

export function moduleStats(s: ProgressState, module: ModuleId): ModuleStats {
  const all = s.attempts.filter((a) => a.module === module);
  const recent = all.slice(-10);
  const recentCorrect = recent.filter(counts).length;
  const distinct = new Set(all.map((a) => a.qid)).size;
  const lesson = s.lessons[module];
  const masteryPassed = lesson?.mastery?.passed === true;
  const secure = recent.length >= 5 && recentCorrect / recent.length >= 0.8 && distinct >= 3;
  let level: MasteryLevel = 'not-started';
  if (lesson || all.length > 0) level = 'started';
  if (all.length >= 4) level = 'practising';
  if (secure) level = masteryPassed ? 'mastered' : 'secure';
  return {
    module,
    attempts: all.length,
    correct: all.filter(counts).length,
    recent,
    recentCorrect,
    distinct,
    opened: Boolean(lesson),
    completed: Boolean(lesson?.completedAt),
    masteryPassed,
    activities: lesson?.activities.length ?? 0,
    level,
  };
}

export function allModuleStats(s: ProgressState): ModuleStats[] {
  return MODULES.map((m) => moduleStats(s, m.id));
}

/** Misconceptions seen in the learner's recent wrong answers. */
export function recentMisconceptions(s: ProgressState, window = 30): { id: string; count: number }[] {
  const tally = new Map<string, number>();
  for (const a of s.attempts.slice(-window)) {
    if (!a.correct && a.misconception) tally.set(a.misconception, (tally.get(a.misconception) ?? 0) + 1);
  }
  return [...tally.entries()].map(([id, count]) => ({ id, count })).sort((a, b) => b.count - a.count);
}

export interface Recommendation {
  id: string;
  title: string;
  reason: string;
  to: string;
  action: string;
}

/** Explainable next steps. Every recommendation says why it was made. */
export function recommendations(s: ProgressState, limit = 3): Recommendation[] {
  const out: Recommendation[] = [];
  const stats = allModuleStats(s);

  for (const { id, count } of recentMisconceptions(s)) {
    if (count < 2) break;
    const m = MISCONCEPTIONS.find((x) => x.id === id);
    if (!m) continue;
    out.push({
      id: `mc-${id}`,
      title: `Fix a pattern: ${m.title}`,
      reason: `${count} of your recent wrong answers match this mistake: ${m.signal}`,
      to: `/learn/common-mistakes#${m.id}`,
      action: 'Review and practise',
    });
  }

  for (const st of stats) {
    if (st.recent.length >= 4 && st.recentCorrect / st.recent.length < 0.6) {
      const mod = moduleById(st.module);
      out.push({
        id: `weak-${st.module}`,
        title: `Revise: ${mod.title}`,
        reason: `You answered ${st.recentCorrect} of your last ${st.recent.length} questions on this topic correctly. Re-read the worked examples, then try again.`,
        to: `/learn/${st.module}`,
        action: 'Revise lesson',
      });
    }
  }

  for (const [module, conf] of Object.entries(s.confidence)) {
    const st = stats.find((x) => x.module === module);
    if (!st || !conf) continue;
    if (conf.value >= 3 && st.recent.length >= 4 && st.recentCorrect / st.recent.length < 0.6) {
      out.push({
        id: `conf-${module}`,
        title: `Check your confidence: ${moduleById(module as ModuleId).title}`,
        reason: `You said you felt confident about this topic, but ${st.recent.length - st.recentCorrect} of your last ${st.recent.length} answers were wrong. Confidence and results don't match yet.`,
        to: `/practice/session?module=${module}`,
        action: 'Practise this topic',
      });
    }
  }

  for (const st of stats) {
    if (st.completed && !st.masteryPassed) {
      out.push({
        id: `mastery-${st.module}`,
        title: `Take the mastery check: ${moduleById(st.module).title}`,
        reason: 'You finished this lesson but have not passed its short mastery check yet.',
        to: `/learn/${st.module}#mastery`,
        action: 'Take mastery check',
      });
      break;
    }
  }

  const next = stats.find((st) => !st.completed);
  if (next) {
    const mod = moduleById(next.module);
    out.push({
      id: `next-${next.module}`,
      title: next.opened ? `Continue: ${mod.title}` : `Next lesson: ${mod.title}`,
      reason: next.opened
        ? `You started lesson ${mod.number} but have not finished it.`
        : s.diagnostic?.recommendedStart === next.module
          ? 'Your diagnostic quiz suggested starting here.'
          : `This is the next lesson in the learning path (lesson ${mod.number} of ${MODULES.length}).`,
      to: `/learn/${next.module}`,
      action: next.opened ? 'Continue' : 'Start lesson',
    });
  }

  if (!s.diagnostic && s.attempts.length === 0) {
    out.push({
      id: 'diagnostic',
      title: 'Find your starting point',
      reason: 'A 12-question diagnostic shows which topics you already know, so you can skip ahead.',
      to: '/diagnostic',
      action: 'Take diagnostic',
    });
  }

  if (out.length === 0) {
    out.push({
      id: 'exam',
      title: 'Try a timed practice paper',
      reason: 'You have completed the learning path. Mixed, timed questions test whether you can use everything together.',
      to: '/exam',
      action: 'Start practice paper',
    });
  }

  const seen = new Set<string>();
  return out.filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true))).slice(0, limit);
}

export function overallProgress(s: ProgressState): { completed: number; total: number; mastered: number } {
  const stats = allModuleStats(s);
  return { completed: stats.filter((x) => x.completed).length, total: stats.length, mastered: stats.filter((x) => x.level === 'mastered').length };
}

export function attemptsToday(s: ProgressState, day: string): number {
  return s.attempts.filter((a) => {
    const d = new Date(a.at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return key === day;
  }).length;
}
