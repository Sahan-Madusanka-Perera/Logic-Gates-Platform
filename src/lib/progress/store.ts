import { useSyncExternalStore } from 'react';
import { MODULE_IDS, type ModuleId } from '@/content/curriculum';
import { evaluateBadges } from './badges';
import { xpForAttempt, XP_LESSON_COMPLETE, XP_MASTERY_PASS } from './xp';
import {
  type AttemptRecord,
  type DiagnosticRecord,
  type ExamRecord,
  type ProgressState,
  type Settings,
  DEFAULT_SETTINGS,
  emptyProgress,
} from './types';

const KEY = 'lgll.progress.v1';
const MAX_ATTEMPTS = 2000;

let storageWorks = true;

function readStorage(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    storageWorks = false;
    return null;
  }
}

function writeStorage(value: string): void {
  try {
    window.localStorage.setItem(KEY, value);
    storageWorks = true;
  } catch {
    storageWorks = false;
  }
}

/** Accept saved data only if it has the expected shape; never crash on corrupted storage. */
export function sanitize(raw: unknown): ProgressState {
  const base = emptyProgress();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<ProgressState>;
  if (r.version !== 1) return base;
  const validModule = (m: unknown): m is ModuleId => typeof m === 'string' && (MODULE_IDS as readonly string[]).includes(m);
  const lessons: ProgressState['lessons'] = {};
  for (const [k, l] of Object.entries(r.lessons ?? {})) {
    if (validModule(k) && l && typeof l === 'object') {
      lessons[k] = { ...l, activities: Array.isArray(l.activities) ? l.activities.filter((a) => typeof a === 'string') : [] };
    }
  }
  return {
    ...base,
    createdAt: typeof r.createdAt === 'number' ? r.createdAt : base.createdAt,
    lessons,
    attempts: Array.isArray(r.attempts) ? r.attempts.filter((a) => a && typeof a.qid === 'string' && validModule(a.module)).slice(-MAX_ATTEMPTS) : [],
    confidence: r.confidence && typeof r.confidence === 'object' ? r.confidence : {},
    xp: typeof r.xp === 'number' && r.xp >= 0 ? r.xp : 0,
    rewarded: Array.isArray(r.rewarded) ? r.rewarded.filter((x) => typeof x === 'string') : [],
    badges: r.badges && typeof r.badges === 'object' ? r.badges : {},
    activeDays: Array.isArray(r.activeDays) ? r.activeDays.filter((d) => typeof d === 'string').slice(-120) : [],
    diagnostic: r.diagnostic && validModule(r.diagnostic.recommendedStart) ? r.diagnostic : undefined,
    exams: Array.isArray(r.exams) ? r.exams.slice(-30) : [],
    settings: { ...DEFAULT_SETTINGS, ...(r.settings ?? {}) },
  };
}

function load(): ProgressState {
  if (typeof window === 'undefined') return emptyProgress();
  const raw = readStorage();
  if (!raw) return emptyProgress();
  try {
    return sanitize(JSON.parse(raw));
  } catch {
    return emptyProgress();
  }
}

let state: ProgressState = load();
const listeners = new Set<() => void>();
/** Badges earned by the most recent update, for celebration toasts. */
let freshBadges: string[] = [];

function emit() {
  for (const l of listeners) l();
}

function commit(next: ProgressState) {
  const earned = evaluateBadges(next);
  const newly = earned.filter((b) => !(b in next.badges));
  if (newly.length > 0) {
    const now = Date.now();
    next = { ...next, badges: { ...next.badges, ...Object.fromEntries(newly.map((b) => [b, now])) } };
    freshBadges = [...freshBadges, ...newly];
  }
  state = next;
  writeStorage(JSON.stringify(state));
  emit();
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) {
      state = load();
      emit();
    }
  });
}

export function getProgress(): ProgressState {
  return state;
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useProgress(): ProgressState {
  return useSyncExternalStore(subscribe, getProgress, getProgress);
}

export function isStorageAvailable(): boolean {
  return storageWorks;
}

export function takeFreshBadges(): string[] {
  const out = freshBadges;
  freshBadges = [];
  return out;
}

export function localDay(ts = Date.now()): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function touchDay(s: ProgressState): ProgressState {
  const today = localDay();
  return s.activeDays.includes(today) ? s : { ...s, activeDays: [...s.activeDays, today].slice(-120) };
}

// ------------------------------------------------------------------ actions

export function recordLessonOpened(module: ModuleId): void {
  const now = Date.now();
  const prev = state.lessons[module];
  commit({
    ...state,
    lessons: { ...state.lessons, [module]: prev ? { ...prev, lastOpenedAt: now } : { openedAt: now, lastOpenedAt: now, activities: [] } },
  });
}

export function recordActivity(module: ModuleId, activityId: string): void {
  const now = Date.now();
  const prev = state.lessons[module] ?? { openedAt: now, lastOpenedAt: now, activities: [] };
  if (prev.activities.includes(activityId)) return;
  commit(touchDay({ ...state, lessons: { ...state.lessons, [module]: { ...prev, activities: [...prev.activities, activityId] } } }));
}

export function markLessonComplete(module: ModuleId): void {
  const now = Date.now();
  const prev = state.lessons[module] ?? { openedAt: now, lastOpenedAt: now, activities: [] };
  if (prev.completedAt) return;
  commit({ ...state, xp: state.xp + XP_LESSON_COMPLETE, lessons: { ...state.lessons, [module]: { ...prev, completedAt: now } } });
}

export function recordMasteryCheck(module: ModuleId, score: number, total: number): boolean {
  const now = Date.now();
  const passed = total > 0 && score / total >= 0.8;
  const prev = state.lessons[module] ?? { openedAt: now, lastOpenedAt: now, activities: [] };
  const firstPass = passed && !prev.mastery?.passed;
  commit({
    ...state,
    xp: state.xp + (firstPass ? XP_MASTERY_PASS : 0),
    lessons: {
      ...state.lessons,
      [module]: { ...prev, mastery: { score, total, at: now, passed: passed || prev.mastery?.passed === true } },
    },
  });
  return passed;
}

/** Record an answer. Returns the XP earned (0 for repeats, revealed solutions or wrong answers). */
export function recordAttempt(attempt: Omit<AttemptRecord, 'at'>): number {
  const at = Date.now();
  const gained = state.rewarded.includes(attempt.qid) ? 0 : xpForAttempt(attempt);
  commit(
    touchDay({
      ...state,
      xp: state.xp + gained,
      rewarded: gained > 0 ? [...state.rewarded, attempt.qid] : state.rewarded,
      attempts: [...state.attempts, { ...attempt, at }].slice(-MAX_ATTEMPTS),
    }),
  );
  return gained;
}

export function setConfidence(module: ModuleId, value: 1 | 2 | 3 | 4): void {
  commit({ ...state, confidence: { ...state.confidence, [module]: { value, at: Date.now() } } });
}

export function recordDiagnostic(record: DiagnosticRecord): void {
  commit(touchDay({ ...state, diagnostic: record }));
}

export function recordExam(record: ExamRecord): void {
  commit(touchDay({ ...state, exams: [...state.exams, record].slice(-30) }));
}

export function updateSettings(patch: Partial<Settings>): void {
  commit({ ...state, settings: { ...state.settings, ...patch } });
}

export function resetProgress(keepSettings = true): void {
  const fresh = emptyProgress();
  commit(keepSettings ? { ...fresh, settings: state.settings } : fresh);
}

export function exportProgress(): string {
  return JSON.stringify(state, null, 2);
}

export function importProgress(json: string): { ok: true } | { ok: false; error: string } {
  try {
    const parsed = JSON.parse(json) as unknown;
    if (!parsed || typeof parsed !== 'object' || (parsed as { version?: unknown }).version !== 1) {
      return { ok: false, error: 'This file is not a Logic Gates Learning Lab progress file.' };
    }
    commit(sanitize(parsed));
    return { ok: true };
  } catch {
    return { ok: false, error: 'The file could not be read. Make sure it is the .json file you downloaded.' };
  }
}

/** Test-only: replace state without touching storage listeners. */
export function __setProgressForTests(next: ProgressState): void {
  state = next;
}
