import type { WorkedStep } from '@/components/lab/SimplifyChecker';
import type { ModuleId } from '@/content/curriculum';
import type { Figure, RichText } from '@/lib/assessment/types';
import type { LatchKind } from '@/lib/logic/sequential';
import type { ContactNet } from '@/lib/logic/switches';
import type { GateType } from '@/lib/logic/types';

/**
 * Lesson content blocks. Interactive blocks carry an `id`; using one records a
 * lesson activity in local progress.
 */
export type LessonBlock =
  | { kind: 'text'; md: RichText }
  | { kind: 'callout'; tone: 'tip' | 'warn' | 'exam' | 'note'; title: string; md: RichText }
  | { kind: 'figure'; figure: Figure; caption?: RichText }
  | { kind: 'gate-sim'; id: string; gate: GateType; venn?: boolean; allowThree?: boolean }
  | { kind: 'switch'; id: string; net: ContactNet; lamp: 'series' | 'shunt'; caption?: string }
  | { kind: 'explorer'; id: string; expr?: string; preset?: string; fuse?: boolean; multi?: string[]; showGateColumns?: boolean }
  | { kind: 'quiz'; id: string; title?: string; questions: string[] }
  | { kind: 'worked'; id: string; title: string; steps: RichText[] }
  | { kind: 'peel'; id: string; expr: string }
  | { kind: 'simplify'; id: string; start: string; worked?: WorkedStep[] }
  | { kind: 'kmap'; id: string; expr: string; variables: string[]; group?: 1 | 0 }
  | { kind: 'latch'; id: string; latch: LatchKind }
  | { kind: 'ripple'; id: string; bits?: number }
  | { kind: 'ic'; id: string; chips?: string[] }
  | { kind: 'misconceptions' };

export interface LessonSection {
  id: string;
  title: string;
  /** Printed page numbers in the supplied notes, or "Supplementary". */
  source?: string;
  blocks: LessonBlock[];
}

export interface Lesson {
  module: ModuleId;
  intro: RichText;
  sections: LessonSection[];
  recap: RichText[];
  /** Multi-letter variable names used in this lesson's expressions (e.g. Cin). */
  multi?: string[];
}
