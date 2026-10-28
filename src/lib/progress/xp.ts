import type { AttemptRecord } from './types';

export const XP_LESSON_COMPLETE = 40;
export const XP_MASTERY_PASS = 80;

/**
 * XP rewards understanding, not clicking: only a correct answer earns XP, harder
 * questions earn more, hints halve it, a revealed solution earns nothing, and each
 * question pays out once (the store enforces that).
 */
export function xpForAttempt(a: Pick<AttemptRecord, 'correct' | 'level' | 'hints' | 'revealed'>): number {
  if (!a.correct || a.revealed) return 0;
  const base = [0, 5, 8, 12, 16, 20, 25][Math.min(Math.max(a.level, 1), 6)] ?? 5;
  return a.hints > 0 ? Math.ceil(base / 2) : base;
}
