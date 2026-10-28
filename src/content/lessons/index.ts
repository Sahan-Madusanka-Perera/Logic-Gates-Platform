import type { ModuleId } from '@/content/curriculum';
import { LESSONS_1 } from './part1';
import { LESSONS_2 } from './part2';
import { LESSONS_3 } from './part3';
import type { Lesson } from './types';

export type { Lesson, LessonBlock, LessonSection } from './types';

export const LESSONS: Lesson[] = [...LESSONS_1, ...LESSONS_2, ...LESSONS_3];

export function lessonFor(module: ModuleId): Lesson | undefined {
  return LESSONS.find((l) => l.module === module);
}

/** Ids of the interactive blocks in a lesson (each one records an activity when used). */
export function activityIds(lesson: Lesson): string[] {
  return lesson.sections.flatMap((s) => s.blocks.flatMap((b) => ('id' in b ? [b.id] : [])));
}
