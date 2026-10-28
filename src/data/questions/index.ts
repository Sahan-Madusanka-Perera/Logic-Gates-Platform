import { MODULE_IDS, type ModuleId } from '@/content/curriculum';
import { MISCONCEPTIONS } from '@/content/misconceptions';
import { shuffled } from '@/lib/assessment/draft';
import type { Question } from '@/lib/assessment/types';
import { CIRCUITS_ALGEBRA } from './circuits-algebra';
import { FORMS_KMAPS_DESIGN } from './forms-kmaps-design';
import { FOUNDATIONS_GATES } from './foundations-gates';
import { HARDWARE_MISTAKES } from './hardware-mistakes';

/** Every question in the bank. All are original; none is copied from a past paper. */
export const QUESTIONS: Question[] = [...FOUNDATIONS_GATES, ...CIRCUITS_ALGEBRA, ...FORMS_KMAPS_DESIGN, ...HARDWARE_MISTAKES];

const byId = new Map(QUESTIONS.map((q) => [q.id, q]));

export function questionById(id: string): Question | undefined {
  return byId.get(id);
}

export function questionsForModule(module: ModuleId): Question[] {
  return QUESTIONS.filter((q) => q.module === module);
}

/** Misconceptions a question can reveal: tagged distractors, a tagged wrong answer, or the misconception's own exercise list. */
export function misconceptionsOf(q: Question): string[] {
  const ids = new Set<string>();
  if (q.type === 'mcq') for (const o of q.options) if (o.misconception) ids.add(o.misconception);
  if ('wrongMisconception' in q && q.wrongMisconception) ids.add(q.wrongMisconception);
  for (const m of MISCONCEPTIONS) if (m.exercises.includes(q.id)) ids.add(m.id);
  return [...ids];
}

export function questionsForMisconception(id: string): Question[] {
  return QUESTIONS.filter((q) => misconceptionsOf(q).includes(id));
}

/** Quick question types for rapid-fire rounds. */
export const QUICK_TYPES = new Set<Question['type']>(['binary', 'mcq', 'numeric']);

/**
 * The lesson's mastery check: up to five questions from the module, spread
 * across its levels (lowest to highest), so a pass means more than the easy ones.
 */
export function masteryQuestions(module: ModuleId, count = 5): Question[] {
  const pool = [...questionsForModule(module)].sort((a, b) => a.level - b.level || a.id.localeCompare(b.id));
  if (pool.length <= count) return pool;
  const picked: Question[] = [];
  for (let i = 0; i < count; i++) picked.push(pool[Math.round((i * (pool.length - 1)) / (count - 1))] as Question);
  return [...new Set(picked)];
}

/** The 12-question diagnostic: one or two questions per early module, easiest first. */
export const DIAGNOSTIC_IDS = ['f-comb-1', 'g-and-1', 'g-or-2', 'g-nand-1', 'g-xor-1', 's-series-1', 'c-expr-1', 'c-out-2', 'u-not-1', 'law-dm-1', 'p-min-1', 'k-gray-1'] as const;

export function diagnosticQuestions(): Question[] {
  return DIAGNOSTIC_IDS.map((id) => byId.get(id)).filter((q): q is Question => q !== undefined);
}

export interface PaperOptions {
  count: number;
  seed: string;
  modules?: ModuleId[];
  minLevel?: number;
  maxLevel?: number;
}

/**
 * A mixed practice paper: questions are taken round-robin from each module so
 * every topic is represented, then ordered from easier to harder.
 */
export function buildPaper({ count, seed, modules, minLevel = 1, maxLevel = 6 }: PaperOptions): Question[] {
  const mods = (modules && modules.length > 0 ? modules : MODULE_IDS.filter((m) => m !== 'common-mistakes')) as ModuleId[];
  const pools = mods.map((m) => shuffled(questionsForModule(m).filter((q) => q.level >= minLevel && q.level <= maxLevel), `${seed}:${m}`));
  const out: Question[] = [];
  let round = 0;
  while (out.length < count && pools.some((p) => p.length > round)) {
    for (const p of shuffled(pools, `${seed}:r${round}`)) {
      const q = p[round];
      if (q && out.length < count) out.push(q);
    }
    round++;
  }
  return out.sort((a, b) => a.level - b.level);
}
