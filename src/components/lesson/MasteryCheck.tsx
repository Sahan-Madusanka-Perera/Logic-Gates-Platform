import { useMemo, useRef, useState } from 'react';
import { IconCheck, IconReset } from '@/components/icons';
import { QuestionCard } from '@/components/questions/QuestionCard';
import type { ModuleId } from '@/content/curriculum';
import { masteryQuestions } from '@/data/questions';
import { recordMasteryCheck, setConfidence, useProgress } from '@/lib/progress/store';

export const CONFIDENCE = [
  { value: 1, label: 'Not yet', detail: 'I would need to look at the lesson again.' },
  { value: 2, label: 'A little', detail: 'I can do the easy questions.' },
  { value: 3, label: 'Fairly confident', detail: 'I can do most questions.' },
  { value: 4, label: 'Very confident', detail: 'I could explain it to a friend.' },
] as const;

/** Self-rating. It is compared with real results on the Progress page, never used to unlock anything. */
export function ConfidenceCheck({ module }: { module: ModuleId }) {
  const current = useProgress().confidence[module]?.value;
  return (
    <fieldset className="card space-y-3 p-4 sm:p-5">
      <legend className="sr-only">How confident do you feel about this lesson?</legend>
      <p className="font-display text-lg" aria-hidden="true">
        How confident do you feel about this topic?
      </p>
      <div className="grid gap-2 sm:grid-cols-4">
        {CONFIDENCE.map((c) => (
          <label key={c.value} className={`flex cursor-pointer flex-col gap-0.5 rounded-xl border-2 p-3 text-sm ${current === c.value ? 'border-accent bg-accent-soft' : 'border-line hover:border-line-strong'}`}>
            <input type="radio" name={`confidence-${module}`} className="sr-only" checked={current === c.value} onChange={() => setConfidence(module, c.value)} />
            <span className="font-semibold">{c.label}</span>
            <span className="text-ink-2">{c.detail}</span>
          </label>
        ))}
      </div>
      {current && <p className="text-sm text-ink-2">Saved. Your progress page compares this with how you actually do in practice.</p>}
    </fieldset>
  );
}

/** Five questions across the lesson's levels. 80% (4 of 5) right first time is a pass. */
export function MasteryCheck({ module }: { module: ModuleId }) {
  const qs = useMemo(() => masteryQuestions(module), [module]);
  const record = useProgress().lessons[module]?.mastery;
  const [run, setRun] = useState(0);
  const [phase, setPhase] = useState<'intro' | 'running' | 'done'>('intro');
  const [index, setIndex] = useState(0);
  const score = useRef(0);
  const [final, setFinal] = useState<{ score: number; passed: boolean } | null>(null);

  const start = () => {
    score.current = 0;
    setIndex(0);
    setFinal(null);
    setRun((r) => r + 1);
    setPhase('running');
  };

  return (
    <section id="mastery" className="card scroll-mt-24 space-y-4 p-4 sm:p-6" aria-labelledby="mastery-title">
      <div>
        <p className="eyebrow">Mastery check</p>
        <h2 id="mastery-title" className="font-display text-2xl">
          Show what you know
        </h2>
        <p className="mt-1 text-ink-2">
          {qs.length} questions from easy to hard. Get at least {Math.ceil(qs.length * 0.8)} right first time (without the worked solution) to pass. Hints are allowed.
        </p>
        {record && (
          <p className="mt-2 text-sm">
            Last result: {record.score} of {record.total}
            {record.passed ? ' — passed ✓' : ''}
          </p>
        )}
      </div>
      {phase === 'intro' && (
        <button type="button" className="btn btn-primary" onClick={start}>
          {record ? 'Take it again' : 'Start the mastery check'}
        </button>
      )}
      {phase === 'running' && qs[index] && (
        <QuestionCard
          key={`${run}-${index}`}
          question={qs[index]}
          mode="lesson"
          number={index + 1}
          total={qs.length}
          seed={`mastery-${run}`}
          onRecorded={(o) => {
            if (o.correct && !o.revealed) score.current += 1;
          }}
          nextLabel={index + 1 < qs.length ? 'Next question' : 'See my result'}
          onNext={() => {
            if (index + 1 < qs.length) setIndex(index + 1);
            else {
              const passed = recordMasteryCheck(module, score.current, qs.length);
              setFinal({ score: score.current, passed });
              setPhase('done');
            }
          }}
        />
      )}
      {phase === 'done' && final && (
        <div className={`space-y-3 rounded-xl border p-4 ${final.passed ? 'border-ok bg-ok-soft' : 'border-line-strong bg-surface-2'}`} role="status">
          <p className="flex items-center gap-2 text-lg font-semibold">
            {final.passed && <IconCheck size={20} className="text-ok" />}
            {final.score} of {qs.length} right first time — {final.passed ? 'passed!' : 'not passed yet.'}
          </p>
          <p className="text-[0.95rem]">
            {final.passed
              ? 'This topic now counts towards "secure" on your progress page. Keep it fresh with mixed practice.'
              : 'Look again at the sections for the questions you missed, then try again. The questions are the same, so focus on why each answer is right.'}
          </p>
          <button type="button" className="btn btn-secondary btn-sm" onClick={start}>
            <IconReset size={16} /> Try again
          </button>
        </div>
      )}
    </section>
  );
}
