import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { useTitle } from '@/app/useTitle';
import { IconArrowLeft, IconArrowRight, IconCheck, IconX } from '@/components/icons';
import { AnswerInput } from '@/components/questions/AnswerInput';
import { QuestionPrompt } from '@/components/questions/QuestionCard';
import { ReviewItem } from '@/components/questions/ReviewItem';
import { moduleById } from '@/content/curriculum';
import { diagnosticQuestions } from '@/data/questions';
import { type Draft, emptyDraft } from '@/lib/assessment/draft';
import { attemptFor, diagnosticStart, type Graded, gradeDraft, tallyByModule, tallyRows } from '@/lib/assessment/grade';
import { recordAttempt, recordDiagnostic, useProgress } from '@/lib/progress/store';

const SEED = 'diagnostic';

type Phase = 'intro' | 'answering' | 'results';

export default function DiagnosticPage() {
  useTitle('Diagnostic quiz');
  const questions = useMemo(() => diagnosticQuestions(), []);
  const previous = useProgress().diagnostic;
  const [phase, setPhase] = useState<Phase>('intro');
  const [index, setIndex] = useState(0);
  const [drafts, setDrafts] = useState<Draft[]>(() => questions.map(emptyDraft));
  const [graded, setGraded] = useState<Graded[]>([]);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const focusTop = () => requestAnimationFrame(() => headingRef.current?.focus());

  const start = () => {
    setDrafts(questions.map(emptyDraft));
    setIndex(0);
    setGraded([]);
    setPhase('answering');
    focusTop();
  };

  const finish = (final: Draft[]) => {
    const marked = questions.map((q, i) => gradeDraft(q, final[i] ?? emptyDraft(q)));
    for (const g of marked) if (g.answered) recordAttempt(attemptFor(g, 'diagnostic'));
    const byModule = tallyByModule(marked);
    recordDiagnostic({ at: Date.now(), byModule, recommendedStart: diagnosticStart(byModule) });
    setGraded(marked);
    setPhase('results');
    window.scrollTo({ top: 0 });
    focusTop();
  };

  const go = (i: number) => {
    setIndex(i);
    focusTop();
  };

  if (phase === 'intro') {
    const start_ = previous ? moduleById(previous.recommendedStart) : null;
    return (
      <div className="mx-auto max-w-2xl px-4 pb-16 pt-6 sm:px-6 md:pt-10">
        <p className="eyebrow">Diagnostic</p>
        <h1 className="mt-2 font-display text-3xl sm:text-4xl">Find your starting point</h1>
        <div className="prose-lab mt-4">
          <p>
            {questions.length} short questions, one from each early topic. It takes about 10 minutes. There are no hints during the quiz, and it is not a test: if you do not know an answer, choose <strong>I don’t know yet</strong> and move on.
          </p>
          <p>At the end you will see what you already know, a suggested lesson to start with, and a worked solution for every question.</p>
        </div>
        {previous && start_ && (
          <p className="mt-4 rounded-xl border border-line bg-surface-2 p-4 text-sm">
            You took the diagnostic on {new Date(previous.at).toLocaleDateString()}. It suggested starting at{' '}
            <Link to={`/learn/${start_.id}`} className="font-semibold text-accent underline underline-offset-2">
              lesson {start_.number}: {start_.title}
            </Link>
            . Taking it again replaces that result.
          </p>
        )}
        <button type="button" className="btn btn-primary mt-6" onClick={start}>
          {previous ? 'Take it again' : 'Start the diagnostic'} <IconArrowRight size={18} />
        </button>
      </div>
    );
  }

  if (phase === 'results') {
    const tally = tallyByModule(graded);
    const rows = tallyRows(tally);
    const startAt = moduleById(diagnosticStart(tally));
    const correct = graded.filter((g) => g.result.correct).length;
    const allRight = rows.every((r) => r.correct === r.total);
    return (
      <div className="mx-auto max-w-3xl px-4 pb-16 pt-6 sm:px-6 md:pt-10">
        <p className="eyebrow">Diagnostic results</p>
        <h1 ref={headingRef} tabIndex={-1} className="mt-2 font-display text-3xl outline-none sm:text-4xl">
          {correct} of {graded.length} correct
        </h1>
        <section className="card mt-6 space-y-3 p-5" aria-labelledby="suggested">
          <h2 id="suggested" className="font-display text-2xl">
            Suggested start: lesson {startAt.number}
          </h2>
          <p className="text-ink-2">
            {allRight
              ? 'You answered every diagnostic question correctly, so the early topics look secure. Start with circuit design, and use the earlier lessons for revision.'
              : `This is the first topic in the learning path where you did not get every question right. The lessons before it look secure — you can still open them at any time.`}
          </p>
          <Link to={`/learn/${startAt.id}`} className="btn btn-primary">
            Start {startAt.title} <IconArrowRight size={18} />
          </Link>
        </section>

        <section className="mt-8 space-y-3" aria-labelledby="by-topic">
          <h2 id="by-topic" className="font-display text-2xl">
            By topic
          </h2>
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
            {rows.map((r) => {
              const ok = r.correct === r.total;
              return (
                <li key={r.module.id} className="flex items-center gap-3 px-4 py-3">
                  <span className={ok ? 'text-ok' : 'text-bad'} aria-hidden="true">
                    {ok ? <IconCheck size={18} /> : <IconX size={18} />}
                  </span>
                  <Link to={`/learn/${r.module.id}`} className="min-w-0 flex-1 font-semibold underline-offset-2 hover:underline">
                    {r.module.number}. {r.module.title}
                  </Link>
                  <span className="font-mono text-sm">
                    {r.correct} of {r.total}
                  </span>
                  <span className="sr-only">{ok ? 'all correct' : 'needs work'}</span>
                </li>
              );
            })}
          </ul>
          <p className="text-sm text-ink-2">Designing circuits, adders, latches and integrated circuits are not in the diagnostic. Work through them in order.</p>
        </section>

        <section className="mt-8 space-y-4" aria-labelledby="review">
          <h2 id="review" className="font-display text-2xl">
            Review your answers
          </h2>
          {graded.map((g, i) => (
            <ReviewItem key={g.question.id} graded={g} number={i + 1} total={graded.length} seed={SEED} />
          ))}
        </section>

        <div className="mt-8 flex flex-wrap gap-3">
          <button type="button" className="btn btn-secondary" onClick={start}>
            Take it again
          </button>
          <Link to="/learn" className="btn btn-secondary">
            See the learning path
          </Link>
        </div>
      </div>
    );
  }

  const q = questions[index];
  const draft = drafts[index];
  if (!q || !draft) return null;
  const last = index === questions.length - 1;
  const advance = (final = drafts) => (last ? finish(final) : go(index + 1));
  return (
    <div className="mx-auto max-w-3xl px-4 pb-16 pt-6 sm:px-6">
      <header className="mb-5 space-y-2">
        <p className="eyebrow">Diagnostic</p>
        <h1 ref={headingRef} tabIndex={-1} className="font-display text-2xl outline-none">
          Question {index + 1} of {questions.length}
        </h1>
        <div className="h-2 overflow-hidden rounded-full bg-surface-3" role="progressbar" aria-label="Diagnostic progress" aria-valuemin={0} aria-valuemax={questions.length} aria-valuenow={index}>
          <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${(index / questions.length) * 100}%` }} />
        </div>
      </header>
      <section className="card space-y-5 p-4 sm:p-6">
        <QuestionPrompt question={q} />
        <AnswerInput question={q} draft={draft} onChange={(d) => setDrafts((ds) => ds.map((x, i) => (i === index ? d : x)))} seed={SEED} onSubmit={() => advance()} />
        <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
          <button type="button" className="btn btn-ghost" onClick={() => go(index - 1)} disabled={index === 0}>
            <IconArrowLeft size={18} /> Back
          </button>
          <span className="flex-1" />
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              const cleared = drafts.map((x, i) => (i === index ? emptyDraft(q) : x));
              setDrafts(cleared);
              advance(cleared);
            }}
          >
            I don’t know yet
          </button>
          <button type="button" className="btn btn-primary" onClick={() => advance()}>
            {last ? 'Finish and see results' : 'Next'} <IconArrowRight size={18} />
          </button>
        </div>
      </section>
    </div>
  );
}
