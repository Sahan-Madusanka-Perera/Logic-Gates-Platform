import { Link } from 'react-router';
import { useTitle } from '@/app/useTitle';
import { IconArrowRight, IconSpark, IconWarn } from '@/components/icons';
import { MODULES } from '@/content/curriculum';
import { MISCONCEPTIONS, misconceptionById } from '@/content/misconceptions';
import { QUESTIONS, questionsForMisconception, questionsForModule } from '@/data/questions';
import { LEVEL_NAMES } from '@/lib/assessment/types';
import { attemptsToday, recentMisconceptions } from '@/lib/progress/analytics';
import { localDay, useProgress } from '@/lib/progress/store';

function ModeCard({ to, title, text, tag }: { to: string; title: string; text: string; tag?: string }) {
  return (
    <Link to={to} className="card flex flex-col gap-2 p-5 hover:border-line-strong">
      <span className="flex items-center justify-between gap-2">
        <span className="font-display text-xl">{title}</span>
        {tag && <span className="chip">{tag}</span>}
      </span>
      <span className="text-sm text-ink-2">{text}</span>
      <span className="mt-auto inline-flex items-center gap-1 pt-1 text-sm font-semibold text-accent">
        Start <IconArrowRight size={16} />
      </span>
    </Link>
  );
}

export default function PracticePage() {
  useTitle('Practice');
  const progress = useProgress();
  const flagged = recentMisconceptions(progress).filter((m) => misconceptionById(m.id));
  const today = attemptsToday(progress, localDay());
  const goal = progress.settings.dailyGoal;

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-6 sm:px-6 md:pt-10">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <p className="eyebrow">Practice</p>
          <h1 className="font-display text-3xl sm:text-4xl">Practise until it is automatic</h1>
          <p className="text-ink-2">{QUESTIONS.length} original questions. You get hints when you ask, and a worked solution whenever you need it.</p>
        </div>
        <div className="rounded-xl border border-line bg-surface px-4 py-3 text-sm" aria-label="Today's goal">
          <p className="font-semibold">
            Today: {today} / {goal} questions
          </p>
          <div className="mt-1.5 h-2 w-40 overflow-hidden rounded-full bg-surface-3" role="progressbar" aria-valuemin={0} aria-valuemax={goal} aria-valuenow={Math.min(today, goal)} aria-label="Daily goal progress">
            <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, (today / goal) * 100)}%` }} />
          </div>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Practice modes">
        <ModeCard to="/practice/session?mode=rapid" title="Rapid fire" text="10 quick questions from every topic — gates, outputs and recall." tag="~5 min" />
        <ModeCard to="/practice/session?mode=mixed" title="Mixed practice" text="10 questions across all topics and levels, easier first." tag="~12 min" />
        <ModeCard to="/practice/session?mode=detective" title="Mistake detective" text="Spot what went wrong in another student’s working." tag="7 questions" />
      </section>

      {flagged.length > 0 && (
        <section className="mt-10 space-y-3" aria-labelledby="flagged">
          <h2 id="flagged" className="flex items-center gap-2 font-display text-2xl">
            <IconWarn size={22} className="text-hi-strong" /> Mistakes you have been making
          </h2>
          <p className="text-sm text-ink-2">Found in your last 30 answers. Each session uses questions where that mistake usually shows up.</p>
          <ul className="grid gap-3 sm:grid-cols-2">
            {flagged.map((f) => {
              const m = misconceptionById(f.id);
              if (!m) return null;
              return (
                <li key={f.id}>
                  <Link to={`/practice/session?misconception=${m.id}`} className="card flex items-center gap-3 p-4 hover:border-line-strong">
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{m.title}</span>
                      <span className="text-sm text-ink-2">
                        Seen {f.count} time{f.count === 1 ? '' : 's'} recently
                      </span>
                    </span>
                    <IconArrowRight size={18} className="text-ink-3" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="mt-10 space-y-3" aria-labelledby="by-topic">
        <h2 id="by-topic" className="font-display text-2xl">
          By topic
        </h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          {MODULES.filter((m) => m.id !== 'common-mistakes').map((m) => (
            <li key={m.id}>
              <Link to={`/practice/session?module=${m.id}`} className="flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 hover:border-line-strong">
                <span className="font-mono text-sm text-ink-3">{String(m.number).padStart(2, '0')}</span>
                <span className="min-w-0 flex-1 font-semibold">{m.title}</span>
                <span className="text-xs text-ink-3">{questionsForModule(m.id).length} questions</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10 space-y-3" aria-labelledby="by-level">
        <h2 id="by-level" className="font-display text-2xl">
          By level
        </h2>
        <p className="text-sm text-ink-2">These are the lab’s own learning levels, not official exam categories.</p>
        <ul className="grid gap-2 sm:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((l) => (
            <li key={l}>
              <Link to={`/practice/session?mode=level&level=${l}`} className="flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 hover:border-line-strong">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-surface-2 font-mono font-semibold">{l}</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{LEVEL_NAMES[l]}</span>
                  <span className="text-xs text-ink-3">{QUESTIONS.filter((q) => q.level === l).length} questions</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10 space-y-3" aria-labelledby="by-mistake">
        <h2 id="by-mistake" className="flex items-center gap-2 font-display text-2xl">
          <IconSpark size={22} className="text-accent" /> Target a common mistake
        </h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          {MISCONCEPTIONS.map((m) => (
            <li key={m.id}>
              <Link to={`/practice/session?misconception=${m.id}`} className="flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 hover:border-line-strong">
                <span className="min-w-0 flex-1 text-sm font-semibold">{m.title}</span>
                <span className="text-xs text-ink-3">{questionsForMisconception(m.id).length} questions</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
