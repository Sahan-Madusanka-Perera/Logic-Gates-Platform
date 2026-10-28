import { useState } from 'react';
import { IconCheck, IconFlag, IconX } from '@/components/icons';
import type { Graded } from '@/lib/assessment/grade';
import { AnswerInput } from './AnswerInput';
import { QuestionPrompt, SolutionPanel } from './QuestionCard';

/** One marked answer in a diagnostic or exam review: the student's answer, the marking, then the worked solution. */
export function ReviewItem({ graded: g, number, total, seed, flagged }: { graded: Graded; number: number; total: number; seed: string; flagged?: boolean }) {
  const [open, setOpen] = useState(!g.result.correct);
  const status = g.result.correct ? 'Correct' : g.answered ? 'Incorrect' : 'Not answered';
  return (
    <article className="card space-y-4 p-4 sm:p-5" aria-label={`Question ${number}: ${status}`}>
      <p className={`flex flex-wrap items-center gap-2 text-sm font-semibold ${g.result.correct ? 'text-ok' : 'text-bad'}`}>
        {g.result.correct ? <IconCheck size={18} /> : <IconX size={18} />}
        {status}
        {flagged && (
          <span className="chip">
            <IconFlag size={14} /> Flagged
          </span>
        )}
      </p>
      <QuestionPrompt question={g.question} number={number} total={total} />
      {g.answered && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-ink-2">Your answer</p>
          <AnswerInput
            question={g.question}
            draft={g.draft}
            onChange={() => {}}
            disabled
            seed={seed}
            marking={{ correct: g.result.correct, revealAnswer: true, wrongCells: new Set(g.result.wrongCells ?? []) }}
          />
          {!g.result.correct && <p className="text-[0.95rem]">{g.result.feedback}</p>}
        </div>
      )}
      <button type="button" className="btn btn-secondary btn-sm" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {open ? 'Hide worked solution' : 'Show worked solution'}
      </button>
      {open && <SolutionPanel question={g.question} />}
    </article>
  );
}
