import { MODULE_IDS } from '@/content/curriculum';
import type { ProgressState } from './types';

export interface BadgeDef {
  id: string;
  title: string;
  description: string;
  earned: (s: ProgressState) => boolean;
}

const correct = (s: ProgressState) => s.attempts.filter((a) => a.correct && !a.revealed);

export const BADGES: BadgeDef[] = [
  { id: 'first-light', title: 'First Light', description: 'Answer your first question correctly.', earned: (s) => correct(s).length >= 1 },
  {
    id: 'comeback',
    title: 'Comeback',
    description: 'Get a question right after getting it wrong earlier. Mistakes are how you learn.',
    earned: (s) => {
      const wrong = new Set<string>();
      for (const a of s.attempts) {
        if (!a.correct) wrong.add(a.qid);
        else if (wrong.has(a.qid) && !a.revealed) return true;
      }
      return false;
    },
  },
  {
    id: 'gate-keeper',
    title: 'Gate Keeper',
    description: 'Complete both gate lessons (basic and combinational gates).',
    earned: (s) => Boolean(s.lessons['basic-gates']?.completedAt && s.lessons['combinational-gates']?.completedAt),
  },
  {
    id: 'truth-teller',
    title: 'Truth Teller',
    description: 'Answer 10 truth-table questions correctly.',
    earned: (s) => correct(s).filter((a) => a.objective === 'F4' || a.objective === 'C1' || a.objective === 'B3').length >= 10,
  },
  {
    id: 'circuit-tracer',
    title: 'Circuit Tracer',
    description: 'Answer 10 circuit-reading questions correctly.',
    earned: (s) => correct(s).filter((a) => a.objective === 'C2' || a.objective === 'C4').length >= 10,
  },
  {
    id: 'steady-hand',
    title: 'Steady Hand',
    description: 'Answer 10 level-3-or-harder questions correctly without hints.',
    earned: (s) => correct(s).filter((a) => a.level >= 3 && a.hints === 0).length >= 10,
  },
  { id: 'law-maker', title: 'Law Maker', description: 'Pass the Boolean algebra mastery check.', earned: (s) => s.lessons['boolean-laws']?.mastery?.passed === true },
  { id: 'map-reader', title: 'Map Reader', description: 'Pass the Karnaugh map mastery check.', earned: (s) => s.lessons['karnaugh-maps']?.mastery?.passed === true },
  { id: 'designer', title: 'Designer', description: 'Pass the circuit design mastery check.', earned: (s) => s.lessons['designing-circuits']?.mastery?.passed === true },
  { id: 'memory-keeper', title: 'Memory Keeper', description: 'Pass the latches and flip-flops mastery check.', earned: (s) => s.lessons['storing-bits']?.mastery?.passed === true },
  { id: 'five-days', title: 'Regular', description: 'Practise on 5 different days (they do not need to be in a row).', earned: (s) => s.activeDays.length >= 5 },
  { id: 'paper-done', title: 'Paper Done', description: 'Finish a timed practice paper.', earned: (s) => s.exams.some((e) => e.durationSec !== null) },
  {
    id: 'full-circuit',
    title: 'Full Circuit',
    description: 'Complete every lesson in the learning path.',
    earned: (s) => MODULE_IDS.every((m) => Boolean(s.lessons[m]?.completedAt)),
  },
];

export function evaluateBadges(s: ProgressState): string[] {
  return BADGES.filter((b) => b.earned(s)).map((b) => b.id);
}

export const badgeById = (id: string) => BADGES.find((b) => b.id === id);
