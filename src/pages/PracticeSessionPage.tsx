import { useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useTitle } from '@/app/useTitle';
import { IconCheck, IconReset } from '@/components/icons';
import { type QuestionOutcome, QuestionCard } from '@/components/questions/QuestionCard';
import { misconceptionById } from '@/content/misconceptions';
import { buildSession, parseSessionSpec } from '@/lib/assessment/sessions';
import { getProgress } from '@/lib/progress/store';

export default function PracticeSessionPage() {
  const [params] = useSearchParams();
  const key = params.toString();
  const spec = useMemo(() => parseSessionSpec(new URLSearchParams(key)), [key]);
  const [round, setRound] = useState(0);
  // A new seed for every round, fixed for the round itself.
  const seed = useMemo(() => `${key}:${round}:${Date.now()}`, [key, round]);
  const session = useMemo(() => buildSession(spec, seed), [spec, seed]);
  const [index, setIndex] = useState(0);
  const [outcomes, setOutcomes] = useState<QuestionOutcome[]>([]);
  const xpStart = useRef(getProgress().xp);
  useTitle(session.title);

  const restart = () => {
    setRound((r) => r + 1);
    setIndex(0);
    setOutcomes([]);
    xpStart.current = getProgress().xp;
  };

  const total = session.questions.length;
  const finished = index >= total;
  const q = session.questions[index];
  const correct = outcomes.filter((o) => o.correct).length;
  const missed = [...new Set(outcomes.filter((o) => !o.correct && o.misconception).map((o) => o.misconception as string))];

  if (total === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <h1 className="font-display text-3xl">No questions found</h1>
        <p className="mt-2 text-ink-2">That practice set does not exist. Choose another one.</p>
        <Link to="/practice" className="btn btn-primary mt-6">
          Back to practice
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pb-16 pt-6 sm:px-6">
      <header className="mb-5 space-y-2">
        <Link to="/practice" className="text-sm text-ink-2 underline-offset-2 hover:underline">
          ← Practice
        </Link>
        <h1 className="font-display text-2xl sm:text-3xl">{session.title}</h1>
        <p className="text-sm text-ink-2">{session.description}</p>
        <div className="flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-3" role="progressbar" aria-label="Session progress" aria-valuemin={0} aria-valuemax={total} aria-valuenow={Math.min(index, total)}>
            <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${(Math.min(index, total) / total) * 100}%` }} />
          </div>
          <span className="font-mono text-sm text-ink-2">
            {Math.min(index + (finished ? 0 : 1), total)}/{total}
          </span>
        </div>
      </header>

      {!finished && q && (
        <QuestionCard
          key={`${round}-${index}-${q.id}`}
          question={q}
          mode={session.attemptMode}
          number={index + 1}
          total={total}
          seed={seed}
          onRecorded={(o) => setOutcomes((xs) => [...xs, o])}
          nextLabel={index + 1 < total ? 'Next question' : 'See results'}
          onNext={() => setIndex((i) => i + 1)}
        />
      )}

      {finished && (
        <section className="card space-y-5 p-5 sm:p-6" aria-labelledby="results">
          <div>
            <p className="eyebrow">Session complete</p>
            <h2 id="results" className="font-display text-3xl">
              {correct} of {total} right first time
            </h2>
            <p className="mt-1 text-ink-2">+{Math.max(0, getProgress().xp - xpStart.current)} XP. XP is only given the first time you answer a question correctly without the worked solution.</p>
          </div>
          <ol className="space-y-1.5">
            {outcomes.map((o, i) => (
              <li key={i} className="flex items-center gap-2 text-sm">
                <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full font-mono text-xs font-semibold ${o.correct ? 'bg-ok-soft text-ok' : 'bg-bad-soft text-bad'}`}>{i + 1}</span>
                <span>
                  {o.correct ? 'Right first time' : o.revealed ? 'Solution shown' : 'Wrong first time'}
                  {o.hints > 0 ? ` · ${o.hints} hint${o.hints === 1 ? '' : 's'}` : ''}
                </span>
                <span className="text-ink-3">— {o.question.skill}</span>
              </li>
            ))}
          </ol>
          {missed.length > 0 && (
            <div className="space-y-2 rounded-xl border border-hi-strong bg-hi-soft p-4">
              <p className="font-semibold">Mistakes to work on</p>
              <ul className="space-y-1 text-sm">
                {missed.map((id) => {
                  const m = misconceptionById(id);
                  return m ? (
                    <li key={id}>
                      <Link to={`/learn/common-mistakes#${m.id}`} className="font-semibold text-accent underline underline-offset-2">
                        {m.title}
                      </Link>{' '}
                      —{' '}
                      <Link to={`/practice/session?misconception=${m.id}`} className="underline underline-offset-2">
                        practise it
                      </Link>
                    </li>
                  ) : null;
                })}
              </ul>
            </div>
          )}
          <div className="flex flex-wrap gap-3">
            <button type="button" className="btn btn-primary" onClick={restart}>
              <IconReset size={18} /> New round
            </button>
            <Link to="/practice" className="btn btn-secondary">
              Choose another set
            </Link>
            {correct === total && (
              <span className="inline-flex items-center gap-1.5 font-semibold text-ok">
                <IconCheck size={18} /> Perfect round
              </span>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
