import { MODULE_IDS, type ModuleId, moduleById } from '@/content/curriculum';
import { misconceptionById } from '@/content/misconceptions';
import { buildPaper, QUESTIONS, QUICK_TYPES, questionsForMisconception, questionsForModule } from '@/data/questions';
import { shuffled } from './draft';
import type { Question } from './types';

export type SessionMode = 'rapid' | 'mixed' | 'topic' | 'level' | 'mistakes' | 'detective';

export interface SessionSpec {
  mode: SessionMode;
  module?: ModuleId;
  level?: number;
  misconception?: string;
  count: number;
}

export interface Session {
  title: string;
  description: string;
  questions: Question[];
  attemptMode: 'practice' | 'mistakes';
}

/** Read a practice session from URL search parameters (unknown values fall back to a mixed session). */
export function parseSessionSpec(params: URLSearchParams): SessionSpec {
  const raw = params.get('mode');
  const module = params.get('module') as ModuleId | null;
  const misconception = params.get('misconception') ?? undefined;
  const level = Number(params.get('level'));
  const count = Math.min(Math.max(Number(params.get('count')) || 10, 3), 30);
  if (misconception) return { mode: 'mistakes', misconception, count };
  if (module && MODULE_IDS.includes(module)) return { mode: raw === 'detective' ? 'detective' : 'topic', module, count };
  if (raw === 'level' && level >= 1 && level <= 6) return { mode: 'level', level, count };
  if (raw === 'rapid' || raw === 'detective' || raw === 'mixed') return { mode: raw, count };
  return { mode: 'mixed', count };
}

export function buildSession(spec: SessionSpec, seed: string): Session {
  switch (spec.mode) {
    case 'rapid': {
      const pool = QUESTIONS.filter((q) => q.level <= 3 && QUICK_TYPES.has(q.type) && q.module !== 'common-mistakes');
      return {
        title: 'Rapid fire',
        description: 'Quick questions from every topic. Aim for accuracy first, then speed.',
        questions: shuffled(pool, seed).slice(0, spec.count),
        attemptMode: 'practice',
      };
    }
    case 'topic': {
      const m = spec.module as ModuleId;
      const pool = questionsForModule(m);
      return {
        title: moduleById(m).title,
        description: `Practice for lesson ${moduleById(m).number}, from easier to harder.`,
        questions: shuffled(pool, seed)
          .slice(0, spec.count)
          .sort((a, b) => a.level - b.level),
        attemptMode: 'practice',
      };
    }
    case 'level': {
      const pool = QUESTIONS.filter((q) => q.level === spec.level);
      return {
        title: `Level ${spec.level} questions`,
        description: 'Questions from every topic at one learning level.',
        questions: shuffled(pool, seed).slice(0, spec.count),
        attemptMode: 'practice',
      };
    }
    case 'mistakes': {
      const m = misconceptionById(spec.misconception ?? '');
      const pool = m ? questionsForMisconception(m.id) : [];
      return {
        title: m ? `Fix it: ${m.title}` : 'Fix a mistake',
        description: m ? `Questions where this mistake usually shows up: ${m.signal}` : 'That mistake was not found.',
        questions: shuffled(pool, seed)
          .slice(0, spec.count)
          .sort((a, b) => a.level - b.level),
        attemptMode: 'mistakes',
      };
    }
    case 'detective':
      return {
        title: 'Mistake detective',
        description: 'Each question shows a student’s answer. Work out what went wrong.',
        questions: shuffled(questionsForModule('common-mistakes'), seed).slice(0, spec.count),
        attemptMode: 'mistakes',
      };
    case 'mixed':
      return {
        title: 'Mixed practice',
        description: 'A mix of topics and levels, easier questions first.',
        questions: buildPaper({ count: spec.count, seed }),
        attemptMode: 'practice',
      };
  }
}
