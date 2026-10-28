import type { ModuleId, ObjectiveId } from '@/content/curriculum';
import type { LatchKind } from '@/lib/logic/sequential';
import type { ContactNet } from '@/lib/logic/switches';
import type { Bit, Circuit, GateType } from '@/lib/logic/types';

/** Inline markup: [[A'.B]] = expression with overbars, **bold**, *italic*, `code`. */
export type RichText = string;

export type Figure =
  | {
      kind: 'circuit';
      /** The circuit is generated from this expression by the engine. */
      expr: string;
      fuse?: boolean;
      twoInput?: boolean;
      outputLabel?: string;
      variables?: string[];
      /** Show the expression next to the diagram? (Off when it would give the answer away.) */
      showExpr?: boolean;
    }
  | { kind: 'circuit-def'; circuit: Circuit; caption?: string }
  | { kind: 'gate'; gate: GateType; inputs?: number }
  | { kind: 'truth-table'; expr: string; variables?: string[]; outputLabel?: string; columns?: { label: string; expr: string }[] }
  | { kind: 'kmap'; expr: string; variables: string[] }
  | { kind: 'switch'; net: ContactNet; lamp: 'series' | 'shunt' }
  | { kind: 'venn'; gate: GateType }
  | { kind: 'latch'; latch: Exclude<LatchKind, 'or-and'> };

export interface QuestionBase {
  id: string;
  module: ModuleId;
  objective: ObjectiveId;
  /** Internal learning level 1–6 (not an official examination category). */
  level: 1 | 2 | 3 | 4 | 5 | 6;
  skill: string;
  prompt: RichText;
  figure?: Figure;
  /** Graduated hints. Computed question types generate hints from the engine when omitted. */
  hints?: RichText[];
  explanation: RichText;
  /** Past-paper questions that practise the same skill (the question itself is original). */
  relatedPastPapers?: string[];
  /** Multi-letter variable names used in expressions (e.g. Cin). */
  parseVariables?: string[];
}

export interface McqOption {
  id: string;
  text?: RichText;
  /** An expression option; also lets tests check equivalence automatically. */
  expr?: string;
  figure?: Figure;
  /** Misconception this distractor represents. */
  misconception?: string;
}

export interface McqQuestion extends QuestionBase {
  type: 'mcq';
  options: McqOption[];
  answer: string;
  /** Keep the option order (for "I only / I and II only" style options). */
  fixedOrder?: boolean;
  /**
   * Machine check for tests: the answer option's expression must be equivalent to
   * this expression and every other expression option must not be.
   */
  verifyEquivalentTo?: string;
}

export interface BinaryQuestion extends QuestionBase {
  type: 'binary';
  /** Expression whose value is asked for (circuit questions show it as a figure). */
  expr: string;
  assignment: Record<string, Bit>;
  /** Misconception suggested by a wrong answer. */
  wrongMisconception?: string;
}

export interface TruthTableQuestion extends QuestionBase {
  type: 'truth-table';
  expr: string;
  variables?: string[];
  outputLabel?: string;
  /** Intermediate columns the student fills in as well. */
  columns?: { label: string; expr: string }[];
  /** Rows (by index) that are given as examples, not to be filled. */
  givenRows?: number[];
  wrongMisconception?: string;
}

export interface ExpressionQuestion extends QuestionBase {
  type: 'expression';
  answer: string;
  /**
   * equivalent: any equivalent expression.
   * simplest: equivalent and no more literals than the minimal SOP/POS.
   * sop / pos: equivalent and written as a sum of products / product of sums.
   */
  require: 'equivalent' | 'simplest' | 'sop' | 'pos';
  variables?: string[];
}

export interface NumericQuestion extends QuestionBase {
  type: 'numeric';
  answer: number;
  wrongMisconception?: string;
}

export interface IntermediateQuestion extends QuestionBase {
  type: 'intermediate';
  expr: string;
  fuse?: boolean;
  assignment: Record<string, Bit>;
}

export interface KMapFillQuestion extends QuestionBase {
  type: 'kmap-fill';
  expr: string;
  variables: string[];
}

export interface LatchQuestion extends QuestionBase {
  type: 'latch-sequence';
  latch: Exclude<LatchKind, 'or-and'>;
  steps: { s: Bit; r: Bit }[];
}

export type Question =
  | McqQuestion
  | BinaryQuestion
  | TruthTableQuestion
  | ExpressionQuestion
  | NumericQuestion
  | IntermediateQuestion
  | KMapFillQuestion
  | LatchQuestion;

export type QuestionType = Question['type'];

/** What the student submitted. */
export type Response =
  | { type: 'mcq'; choice: string }
  | { type: 'binary'; value: Bit }
  | { type: 'truth-table'; cells: Record<string, Bit | null> }
  | { type: 'expression'; text: string }
  | { type: 'numeric'; value: number }
  | { type: 'intermediate'; values: Record<string, Bit | null> }
  | { type: 'kmap-fill'; cells: Record<string, Bit | null> }
  | { type: 'latch-sequence'; values: (Bit | null)[] };

export interface CheckResult {
  correct: boolean;
  /** Short, specific feedback about this response. */
  feedback: string;
  /** For grid answers: which cells were wrong. */
  wrongCells?: string[];
  misconception?: string;
  /** The response could not be marked (e.g. unparseable expression) — not counted as an attempt. */
  invalid?: boolean;
}

export const LEVEL_NAMES: Record<number, string> = {
  1: 'Foundation',
  2: 'Application',
  3: 'Circuit analysis',
  4: 'Multi-step',
  5: 'Exam challenge',
  6: 'Mastery',
};
