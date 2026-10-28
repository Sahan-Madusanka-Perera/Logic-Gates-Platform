import { describe, expect, it } from 'vitest';
import { MODULE_IDS } from '@/content/curriculum';
import { PRESET_CIRCUITS } from '@/content/circuits';
import { activityIds, LESSONS, lessonFor } from '@/content/lessons';
import { questionById } from '@/data/questions';
import { tryParse } from '@/lib/logic/expression';
import { CHIPS } from '@/components/ic/ICPinout';

function richExpressions(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/\[\[(.+?)\]\]/g)) for (const part of (m[1] as string).split('=')) if (part.trim()) out.push(part.trim());
  return out;
}

describe('lessons', () => {
  it('there is exactly one lesson per module, in order', () => {
    expect(LESSONS.map((l) => l.module)).toEqual([...MODULE_IDS]);
    for (const m of MODULE_IDS) expect(lessonFor(m)).toBeDefined();
  });

  it.each(LESSONS.map((l) => [l.module, l] as const))('%s: content is valid', (_m, lesson) => {
    const ids = activityIds(lesson);
    expect(new Set(ids).size, 'activity ids are unique').toBe(ids.length);
    expect(new Set(lesson.sections.map((s) => s.id)).size).toBe(lesson.sections.length);
    expect(lesson.recap.length).toBeGreaterThan(0);
    const texts: string[] = [lesson.intro, ...lesson.recap];
    for (const s of lesson.sections) {
      for (const b of s.blocks) {
        if (b.kind === 'text') texts.push(b.md);
        if (b.kind === 'callout') texts.push(b.md);
        if (b.kind === 'figure' && b.caption) texts.push(b.caption);
        if (b.kind === 'worked') texts.push(b.title, ...b.steps);
        if (b.kind === 'quiz') for (const id of b.questions) expect(questionById(id), `${lesson.module}: question ${id}`).toBeDefined();
        if (b.kind === 'explorer') {
          if (b.preset) expect(PRESET_CIRCUITS.some((p) => p.id === b.preset), `preset ${b.preset}`).toBe(true);
          if (b.expr) expect(tryParse(b.expr, { variables: b.multi }).ok).toBe(true);
          expect(Boolean(b.preset) !== Boolean(b.expr), 'explorer needs exactly one of preset / expr').toBe(true);
        }
        if (b.kind === 'peel' || b.kind === 'kmap') expect(tryParse(b.expr).ok, b.expr).toBe(true);
        if (b.kind === 'simplify') {
          expect(tryParse(b.start).ok).toBe(true);
          for (const w of b.worked ?? []) expect(tryParse(w.expr).ok, w.expr).toBe(true);
        }
        if (b.kind === 'ic') for (const c of b.chips ?? []) expect(CHIPS.some((x) => x.id === c)).toBe(true);
      }
    }
    for (const t of texts) for (const e of richExpressions(t)) expect(tryParse(e, { variables: lesson.multi }).ok, `${lesson.module}: "${e}"`).toBe(true);
  });
});
