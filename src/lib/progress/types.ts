import type { ModuleId, ObjectiveId } from '@/content/curriculum';

export type AttemptMode = 'lesson' | 'practice' | 'exam' | 'diagnostic' | 'mistakes';

export interface AttemptRecord {
  qid: string;
  objective: ObjectiveId;
  module: ModuleId;
  level: number;
  correct: boolean;
  /** Number of hints opened before answering. */
  hints: number;
  /** The full solution was shown before a correct answer. */
  revealed: boolean;
  mode: AttemptMode;
  /** Misconception suggested by the chosen wrong answer, if any. */
  misconception?: string;
  at: number;
}

export interface LessonRecord {
  openedAt: number;
  lastOpenedAt: number;
  activities: string[];
  completedAt?: number;
  mastery?: { score: number; total: number; at: number; passed: boolean };
}

export interface ExamRecord {
  id: string;
  at: number;
  durationSec: number | null;
  timeUsedSec: number;
  score: number;
  total: number;
  byModule: Partial<Record<ModuleId, { correct: number; total: number }>>;
}

export interface DiagnosticRecord {
  at: number;
  byModule: Partial<Record<ModuleId, { correct: number; total: number }>>;
  recommendedStart: ModuleId;
}

export interface Settings {
  theme: 'system' | 'light' | 'dark';
  motion: 'system' | 'reduce' | 'full';
  andNotation: 'dot' | 'juxtapose';
  dailyGoal: number;
}

export interface ProgressState {
  version: 1;
  createdAt: number;
  lessons: Partial<Record<ModuleId, LessonRecord>>;
  attempts: AttemptRecord[];
  confidence: Partial<Record<ModuleId, { value: 1 | 2 | 3 | 4; at: number }>>;
  xp: number;
  /** Question ids that have already earned XP (XP is awarded once per question). */
  rewarded: string[];
  badges: Record<string, number>;
  /** Local dates (YYYY-MM-DD) on which the learner practised. */
  activeDays: string[];
  diagnostic?: DiagnosticRecord;
  exams: ExamRecord[];
  settings: Settings;
}

export const DEFAULT_SETTINGS: Settings = { theme: 'system', motion: 'system', andNotation: 'dot', dailyGoal: 10 };

export function emptyProgress(now = Date.now()): ProgressState {
  return {
    version: 1,
    createdAt: now,
    lessons: {},
    attempts: [],
    confidence: {},
    xp: 0,
    rewarded: [],
    badges: {},
    activeDays: [],
    exams: [],
    settings: { ...DEFAULT_SETTINGS },
  };
}
