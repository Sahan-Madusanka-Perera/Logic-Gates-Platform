import { Link } from 'react-router';
import { useTitle } from '@/app/useTitle';
import { IconArrowRight, IconCheck } from '@/components/icons';
import { MODULES } from '@/content/curriculum';
import { lessonFor, activityIds } from '@/content/lessons';
import { allModuleStats, MASTERY_EXPLAINED, MASTERY_LABEL } from '@/lib/progress/analytics';
import { useProgress } from '@/lib/progress/store';

export default function LearnPage() {
  useTitle('Learning path');
  const progress = useProgress();
  const stats = allModuleStats(progress);
  const stages = [...new Set(MODULES.map((m) => m.stage))];
  const recommended = progress.diagnostic?.recommendedStart;

  return (
    <div className="mx-auto max-w-4xl px-4 pb-16 pt-6 sm:px-6 md:pt-10">
      <header className="mb-8 space-y-2">
        <p className="eyebrow">Learning path</p>
        <h1 className="font-display text-3xl sm:text-4xl">Fourteen lessons, in order</h1>
        <p className="text-ink-2">Each lesson builds on the one before. You can open any lesson at any time — nothing is locked.</p>
        {!progress.diagnostic && (
          <p className="text-sm">
            Already know some of this?{' '}
            <Link to="/diagnostic" className="font-semibold text-accent underline underline-offset-2">
              Take the diagnostic
            </Link>{' '}
            to find your starting point.
          </p>
        )}
      </header>
      <div className="space-y-10">
        {stages.map((stage) => (
          <section key={stage} aria-labelledby={`stage-${stage}`}>
            <h2 id={`stage-${stage}`} className="mb-3 font-display text-xl text-ink-2">
              {stage}
            </h2>
            <ol className="space-y-3">
              {MODULES.filter((m) => m.stage === stage).map((m) => {
                const st = stats.find((s) => s.module === m.id);
                const lesson = lessonFor(m.id);
                const total = lesson ? activityIds(lesson).length : 0;
                return (
                  <li key={m.id}>
                    <Link to={`/learn/${m.id}`} className="card flex items-start gap-4 p-4 hover:border-line-strong sm:p-5">
                      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl font-mono text-lg font-semibold ${st?.completed ? 'bg-ok-soft text-ok' : 'bg-surface-2 text-ink-2'}`}>
                        {st?.completed ? <IconCheck size={22} aria-label="completed" /> : m.number}
                      </span>
                      <span className="min-w-0 flex-1 space-y-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-display text-lg font-semibold">{m.title}</span>
                          {recommended === m.id && <span className="chip border-accent text-accent">Suggested start</span>}
                        </span>
                        <span className="block text-sm text-ink-2">{m.tagline}</span>
                        <span className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-3">
                          <span>About {m.minutes} min</span>
                          <span>
                            {st?.activities ?? 0}/{total} activities
                          </span>
                          {st && (
                            <span title={MASTERY_EXPLAINED[st.level]}>
                              {MASTERY_LABEL[st.level]}
                              {st.masteryPassed ? ' · mastery check passed' : ''}
                            </span>
                          )}
                        </span>
                      </span>
                      <IconArrowRight size={20} className="mt-3 shrink-0 text-ink-3" />
                    </Link>
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
      </div>
    </div>
  );
}
