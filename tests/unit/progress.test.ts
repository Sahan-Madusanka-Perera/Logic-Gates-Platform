import { beforeEach, describe, expect, it } from 'vitest';
import { moduleStats, recentMisconceptions, recommendations } from '@/lib/progress/analytics';
import {
  __setProgressForTests,
  exportProgress,
  getProgress,
  importProgress,
  markLessonComplete,
  recordAttempt,
  recordMasteryCheck,
  resetProgress,
  sanitize,
  setConfidence,
  updateSettings,
} from '@/lib/progress/store';
import { emptyProgress } from '@/lib/progress/types';

const attempt = (qid: string, correct: boolean, extra: Partial<Parameters<typeof recordAttempt>[0]> = {}) =>
  recordAttempt({ qid, objective: 'G2', module: 'basic-gates', level: 2, correct, hints: 0, revealed: false, mode: 'practice', ...extra });

beforeEach(() => __setProgressForTests(emptyProgress()));

describe('progress store', () => {
  it('awards XP once per question, and never for a revealed solution', () => {
    const first = attempt('q1', true);
    expect(first).toBeGreaterThan(0);
    expect(attempt('q1', true)).toBe(0);
    expect(attempt('q2', true, { revealed: true })).toBe(0);
    expect(attempt('q3', false)).toBe(0);
    expect(getProgress().xp).toBe(first);
    expect(getProgress().attempts).toHaveLength(4);
  });

  it('mastery levels follow their written definitions', () => {
    expect(moduleStats(getProgress(), 'basic-gates').level).toBe('not-started');
    attempt('a', true);
    expect(moduleStats(getProgress(), 'basic-gates').level).toBe('started');
    for (const id of ['b', 'c', 'd', 'e']) attempt(id, true);
    expect(moduleStats(getProgress(), 'basic-gates').level).toBe('secure');
    recordMasteryCheck('basic-gates', 4, 5);
    expect(moduleStats(getProgress(), 'basic-gates').level).toBe('mastered');
  });

  it('repeating one question cannot make a topic secure', () => {
    for (let i = 0; i < 8; i++) attempt('same', true);
    expect(moduleStats(getProgress(), 'basic-gates').level).toBe('practising');
  });

  it('a mastery check passes at 80%', () => {
    expect(recordMasteryCheck('karnaugh-maps', 3, 5)).toBe(false);
    expect(recordMasteryCheck('karnaugh-maps', 4, 5)).toBe(true);
  });

  it('every recommendation explains why it was made', () => {
    for (let i = 0; i < 5; i++) attempt(`w${i}`, false, { misconception: 'xor-as-or' });
    setConfidence('basic-gates', 4);
    markLessonComplete('foundations');
    const recs = recommendations(getProgress(), 10);
    expect(recs.length).toBeGreaterThan(0);
    for (const r of recs) expect(r.reason.length).toBeGreaterThan(20);
    expect(recs.map((r) => r.id)).toContain('mc-xor-as-or');
    expect(recs.map((r) => r.id)).toContain('weak-basic-gates');
    expect(recs.map((r) => r.id)).toContain('conf-basic-gates');
    expect(recs.map((r) => r.id)).toContain('mastery-foundations');
    expect(recentMisconceptions(getProgress())[0]).toEqual({ id: 'xor-as-or', count: 5 });
  });

  it('a new learner is offered the diagnostic', () => {
    expect(recommendations(getProgress()).map((r) => r.id)).toContain('diagnostic');
  });

  it('export and import round-trip, and bad files are rejected with a message', () => {
    attempt('q1', true);
    updateSettings({ theme: 'dark' });
    const saved = exportProgress();
    resetProgress(false);
    expect(getProgress().attempts).toHaveLength(0);
    expect(importProgress(saved)).toEqual({ ok: true });
    expect(getProgress().attempts).toHaveLength(1);
    expect(getProgress().settings.theme).toBe('dark');
    expect(importProgress('not json')).toMatchObject({ ok: false });
    expect(importProgress('{"version":2}')).toMatchObject({ ok: false });
  });

  it('reset keeps settings unless asked not to', () => {
    updateSettings({ dailyGoal: 20 });
    attempt('q1', true);
    resetProgress(true);
    expect(getProgress().settings.dailyGoal).toBe(20);
    expect(getProgress().xp).toBe(0);
  });

  it('sanitize survives corrupted data', () => {
    expect(sanitize(null).version).toBe(1);
    expect(sanitize({ version: 1, attempts: [{ qid: 5 }, { qid: 'x', module: 'nope' }], xp: -5, lessons: { bogus: {} } })).toMatchObject({ attempts: [], xp: 0, lessons: {} });
  });
});
