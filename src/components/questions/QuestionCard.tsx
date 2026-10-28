import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { IconArrowRight, IconCheck, IconHint, IconReset, IconWarn, IconX } from '@/components/icons';
import { RichInline, RichText } from '@/components/RichText';
import { misconceptionById } from '@/content/misconceptions';
import { checkAnswer } from '@/lib/assessment/check';
import { type Draft, emptyDraft, toResponse } from '@/lib/assessment/draft';
import { hintsFor, workedSolution } from '@/lib/assessment/solve';
import { type CheckResult, LEVEL_NAMES, type Question } from '@/lib/assessment/types';
import { recordAttempt } from '@/lib/progress/store';
import type { AttemptMode } from '@/lib/progress/types';
import { AnswerInput, type Marking } from './AnswerInput';
import { FigureView } from './FigureView';

export interface QuestionOutcome {
  question: Question;
  correct: boolean;
  hints: number;
  revealed: boolean;
  misconception?: string;
}

/** Prompt, figure and level label — shared by practice, exam and review screens. */
export function QuestionPrompt({ question: q, number, total }: { question: Question; number?: number; total?: number }) {
  const showFigureSeparately = q.type !== 'intermediate';
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {number !== undefined && (
          <span className="eyebrow">
            Question {number}
            {total ? ` of ${total}` : ''}
          </span>
        )}
        <span className="chip" title="Internal learning level — not an official exam category">
          Level {q.level} · {LEVEL_NAMES[q.level]}
        </span>
        <span className="chip">Original question</span>
      </div>
      <RichText text={q.prompt} className="text-[1.05rem]" multi={q.parseVariables} />
      {showFigureSeparately && q.figure && <FigureView figure={q.figure} multi={q.parseVariables} />}
    </div>
  );
}

/** Worked solution and explanation (never shown before the student answers or asks for it). */
export function SolutionPanel({ question: q }: { question: Question }) {
  const sol = useMemo(() => workedSolution(q), [q]);
  return (
    <div className="space-y-2 rounded-xl border border-info bg-info-soft p-4">
      <p className="font-semibold">
        Answer: <RichInline text={sol.answer} multi={q.parseVariables} />
      </p>
      {sol.steps.length > 0 && (
        <ol className="list-decimal space-y-1 pl-5 text-[0.95rem]">
          {sol.steps.map((s, i) => (
            <li key={i}>
              <RichInline text={s} multi={q.parseVariables} />
            </li>
          ))}
        </ol>
      )}
      <RichText text={q.explanation} multi={q.parseVariables} />
      {q.relatedPastPapers && q.relatedPastPapers.length > 0 && (
        <p className="text-sm text-ink-2">Practises the same skill as past-paper question{q.relatedPastPapers.length > 1 ? 's' : ''} {q.relatedPastPapers.join(', ')}.</p>
      )}
    </div>
  );
}

function MisconceptionNote({ id }: { id: string }) {
  const m = misconceptionById(id);
  if (!m) return null;
  return (
    <div className="rounded-xl border border-hi-strong bg-hi-soft p-4 text-[0.95rem]">
      <p className="flex items-center gap-2 font-semibold">
        <IconWarn width={18} height={18} /> Common mistake: {m.title}
      </p>
      <p className="mt-1">
        <RichInline text={m.problem} />
      </p>
      <p className="mt-1">
        <RichInline text={m.correct} />
      </p>
      <Link to={`/learn/common-mistakes#${m.id}`} className="mt-2 inline-block font-semibold text-accent underline underline-offset-2">
        Read more about this mistake
      </Link>
    </div>
  );
}

interface Props {
  question: Question;
  mode: AttemptMode;
  /** Called once, when the first real answer (or a revealed solution) is recorded. */
  onRecorded?: (o: QuestionOutcome) => void;
  /** Shown as the "Next" button after the question is finished. */
  onNext?: (o: QuestionOutcome) => void;
  nextLabel?: string;
  number?: number;
  total?: number;
  seed?: string;
  /** Lesson checks record attempts too; set false for purely illustrative questions. */
  record?: boolean;
}

/**
 * One practice question: answer, check, graduated hints, retry, then the worked
 * solution. Marking always comes from the logic engine via checkAnswer().
 */
export function QuestionCard({ question: q, mode, onRecorded, onNext, nextLabel = 'Next question', number, total, seed, record = true }: Props) {
  const [draft, setDraft] = useState<Draft>(() => emptyDraft(q));
  const [result, setResult] = useState<CheckResult | null>(null);
  const [locked, setLocked] = useState(false);
  const [hints, setHints] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [wrongTries, setWrongTries] = useState(0);
  const [xp, setXp] = useState<number | null>(null);
  const outcome = useRef<QuestionOutcome | null>(null);
  const feedbackRef = useRef<HTMLDivElement>(null);
  const allHints = useMemo(() => hintsFor(q), [q]);
  const done = revealed || result?.correct === true;

  const finish = (o: QuestionOutcome) => {
    if (outcome.current) return;
    outcome.current = o;
    if (record) setXp(recordAttempt({ qid: q.id, objective: q.objective, module: q.module, level: q.level, correct: o.correct, hints: o.hints, revealed: o.revealed, mode, misconception: o.misconception }));
    onRecorded?.(o);
  };

  const focusFeedback = () => requestAnimationFrame(() => feedbackRef.current?.focus());

  const check = () => {
    if (locked || done) return;
    const response = toResponse(draft);
    if (!response) {
      setResult({ correct: false, invalid: true, feedback: 'Enter an answer first.' });
      focusFeedback();
      return;
    }
    const r = checkAnswer(q, response);
    setResult(r);
    focusFeedback();
    if (r.invalid) return;
    if (!r.correct) {
      setWrongTries((n) => n + 1);
      setLocked(true);
    }
    finish({ question: q, correct: r.correct, hints, revealed: false, misconception: r.correct ? undefined : r.misconception });
  };

  const retry = () => {
    setLocked(false);
    setResult(null);
  };

  const reveal = () => {
    setRevealed(true);
    setLocked(true);
    finish({ question: q, correct: false, hints, revealed: true });
    focusFeedback();
  };

  const marking: Marking | null =
    result && !result.invalid ? { correct: result.correct, revealAnswer: done, wrongCells: result.wrongCells ? new Set(result.wrongCells) : undefined } : revealed ? { correct: false, revealAnswer: true } : null;
  const canReveal = !done && (wrongTries > 0 || hints >= allHints.length);

  return (
    <article className="card space-y-5 p-4 sm:p-6" aria-labelledby={`q-${q.id}`}>
      <h3 id={`q-${q.id}`} className="sr-only">
        Question{number !== undefined ? ` ${number}` : ''}
      </h3>
      <QuestionPrompt question={q} number={number} total={total} />

      <AnswerInput question={q} draft={draft} onChange={setDraft} disabled={locked || done} marking={marking} seed={seed} onSubmit={check} />

      {hints > 0 && (
        <div className="space-y-2" aria-live="polite">
          {allHints.slice(0, hints).map((h, i) => (
            <div key={i} className="flex gap-2 rounded-xl border border-line bg-surface-2 p-3 text-[0.95rem]">
              <IconHint width={18} height={18} className="mt-0.5 shrink-0 text-accent" />
              <span>
                <span className="font-semibold">Hint {i + 1}: </span>
                <RichInline text={h} multi={q.parseVariables} />
              </span>
            </div>
          ))}
        </div>
      )}

      <div ref={feedbackRef} tabIndex={-1} aria-live="polite" className="space-y-3 outline-none">
        {result && !revealed && (
          <div
            className={`flex items-start gap-2 rounded-xl border p-3 font-semibold ${
              result.invalid ? 'border-line-strong bg-surface-2' : result.correct ? 'border-ok bg-ok-soft text-ok' : 'border-bad bg-bad-soft text-bad'
            }`}
          >
            {result.invalid ? <IconWarn width={20} height={20} className="shrink-0" /> : result.correct ? <IconCheck width={20} height={20} className="shrink-0" /> : <IconX width={20} height={20} className="shrink-0" />}
            <span className="text-ink">
              <span className={result.invalid ? '' : result.correct ? 'text-ok' : 'text-bad'}>{result.invalid ? '' : result.correct ? 'Correct. ' : 'Not yet. '}</span>
              <span className="font-normal">{result.feedback}</span>
              {result.correct && xp !== null && xp > 0 && <span className="ml-2 chip">+{xp} XP</span>}
            </span>
          </div>
        )}
        {result && !result.correct && !result.invalid && result.misconception && <MisconceptionNote id={result.misconception} />}
        {done && <SolutionPanel question={q} />}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {!done && !locked && (
          <button type="button" className="btn btn-primary" onClick={check}>
            Check answer
          </button>
        )}
        {!done && locked && (
          <button type="button" className="btn btn-primary" onClick={retry}>
            <IconReset width={18} height={18} /> Try again
          </button>
        )}
        {!done && hints < allHints.length && (
          <button type="button" className="btn btn-secondary" onClick={() => setHints((h) => h + 1)}>
            <IconHint width={18} height={18} /> {hints === 0 ? 'Show a hint' : 'Next hint'} <span className="text-ink-3">({hints + 1} of {allHints.length})</span>
          </button>
        )}
        {canReveal && (
          <button type="button" className="btn btn-ghost" onClick={reveal}>
            Show worked solution
          </button>
        )}
        {done && onNext && outcome.current && (
          <button type="button" className="btn btn-primary" onClick={() => outcome.current && onNext(outcome.current)}>
            {nextLabel} <IconArrowRight width={18} height={18} />
          </button>
        )}
      </div>
    </article>
  );
}
