import type { Bit } from '@/lib/logic/types';
import type { Question, Response } from './types';

/** An answer being entered: like a Response, but parts may still be empty. */
export type Draft =
  | { type: 'mcq'; choice: string | null }
  | { type: 'binary'; value: Bit | null }
  | { type: 'truth-table'; cells: Record<string, Bit | null> }
  | { type: 'expression'; text: string }
  | { type: 'numeric'; text: string }
  | { type: 'intermediate'; values: Record<string, Bit | null> }
  | { type: 'kmap-fill'; cells: Record<string, Bit | null> }
  | { type: 'latch-sequence'; values: (Bit | null)[] };

export function emptyDraft(q: Question): Draft {
  switch (q.type) {
    case 'mcq':
      return { type: 'mcq', choice: null };
    case 'binary':
      return { type: 'binary', value: null };
    case 'truth-table':
      return { type: 'truth-table', cells: {} };
    case 'expression':
      return { type: 'expression', text: '' };
    case 'numeric':
      return { type: 'numeric', text: '' };
    case 'intermediate':
      return { type: 'intermediate', values: {} };
    case 'kmap-fill':
      return { type: 'kmap-fill', cells: {} };
    case 'latch-sequence':
      return { type: 'latch-sequence', values: q.steps.map(() => null) };
  }
}

/** True when nothing has been entered yet. */
export function isBlank(d: Draft): boolean {
  switch (d.type) {
    case 'mcq':
      return d.choice === null;
    case 'binary':
      return d.value === null;
    case 'expression':
    case 'numeric':
      return d.text.trim() === '';
    case 'truth-table':
    case 'kmap-fill':
      return Object.values(d.cells).every((v) => v === null);
    case 'intermediate':
      return Object.values(d.values).every((v) => v === null);
    case 'latch-sequence':
      return d.values.every((v) => v === null);
  }
}

/** Convert to a Response for marking. Blank drafts become null. */
export function toResponse(d: Draft): Response | null {
  if (isBlank(d)) return null;
  switch (d.type) {
    case 'mcq':
      return { type: 'mcq', choice: d.choice ?? '' };
    case 'binary':
      return d.value === null ? null : { type: 'binary', value: d.value };
    case 'expression':
      return { type: 'expression', text: d.text };
    case 'numeric': {
      const t = d.text.trim();
      return { type: 'numeric', value: /^-?\d+$/.test(t) ? Number(t) : Number.NaN };
    }
    case 'truth-table':
      return { type: 'truth-table', cells: d.cells };
    case 'kmap-fill':
      return { type: 'kmap-fill', cells: d.cells };
    case 'intermediate':
      return { type: 'intermediate', values: d.values };
    case 'latch-sequence':
      return { type: 'latch-sequence', values: d.values };
  }
}

/** Small deterministic PRNG so shuffles are stable for a given seed. */
export function seededRandom(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffled<T>(items: readonly T[], seed: string): T[] {
  const rnd = seededRandom(seed);
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}
