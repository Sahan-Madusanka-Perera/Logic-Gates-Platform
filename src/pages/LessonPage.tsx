import { useEffect } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import { IconArrowLeft, IconArrowRight, IconCheck } from '@/components/icons';
import { BlockView } from '@/components/lesson/LessonBlocks';
import { ConfidenceCheck, MasteryCheck } from '@/components/lesson/MasteryCheck';
import { RichInline, RichText } from '@/components/RichText';
import { MODULE_IDS, type ModuleId, moduleById, nextModule, objectivesOf, previousModule, STATUS_LABEL } from '@/content/curriculum';
import { activityIds, lessonFor } from '@/content/lessons';
import { markLessonComplete, recordLessonOpened, useProgress } from '@/lib/progress/store';
import NotFoundPage from './NotFoundPage';

export default function LessonPage() {
  const { moduleId } = useParams();
  const valid = MODULE_IDS.includes(moduleId as ModuleId);
  const id = (valid ? moduleId : 'foundations') as ModuleId;
  const lesson = lessonFor(id);
  const progress = useProgress();
  const location = useLocation();

  useEffect(() => {
    if (valid) recordLessonOpened(id);
  }, [id, valid]);

  useEffect(() => {
    const hash = decodeURIComponent(location.hash.slice(1));
    if (!hash) {
      window.scrollTo(0, 0);
      return;
    }
    // Wait a frame so lazy content has rendered before scrolling to it.
    const t = window.setTimeout(() => document.getElementById(hash)?.scrollIntoView({ block: 'start' }), 60);
    return () => window.clearTimeout(t);
  }, [location.hash, id]);

  useEffect(() => {
    if (lesson) document.title = `${moduleById(id).title} · Logic Gates Learning Lab`;
  }, [id, lesson]);

  if (!valid || !lesson) return <NotFoundPage />;

  const mod = moduleById(id);
  const record = progress.lessons[id];
  const done = new Set(record?.activities ?? []);
  const activities = activityIds(lesson);
  const tried = activities.filter((a) => done.has(a)).length;
  const prev = previousModule(id);
  const next = nextModule(id);

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-ink-2">
        <Link to="/learn" className="underline-offset-2 hover:underline">
          Learning path
        </Link>{' '}
        / Lesson {mod.number}
      </nav>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <article className="min-w-0 space-y-10">
          <header className="space-y-3">
            <p className="eyebrow">
              Lesson {mod.number} of {MODULE_IDS.length} · {mod.stage}
            </p>
            <h1 className="font-display text-3xl leading-tight sm:text-4xl">{mod.title}</h1>
            <RichText text={lesson.intro} className="text-lg text-ink-2" multi={lesson.multi} />
            <div className="flex flex-wrap gap-2 text-sm">
              <span className="chip">About {mod.minutes} min</span>
              <span className="chip">Source: notes {mod.source.replace(/^N /, '')}</span>
              {record?.completedAt && (
                <span className="chip border-ok text-ok">
                  <IconCheck size={14} /> Completed
                </span>
              )}
            </div>
            <details className="rounded-xl border border-line bg-surface p-3 text-[0.95rem]">
              <summary className="cursor-pointer font-semibold">What you will learn ({objectivesOf(id).length} objectives)</summary>
              <ul className="mt-2 space-y-1.5">
                {objectivesOf(id).map((o) => (
                  <li key={o.id} className="flex flex-wrap gap-x-2">
                    <span className="font-mono text-sm text-ink-3">{o.id}</span>
                    <span>{o.text}</span>
                    <span className="text-xs text-ink-3">{STATUS_LABEL[o.status]}</span>
                  </li>
                ))}
              </ul>
            </details>
          </header>

          {lesson.sections.map((s, i) => (
            <section key={s.id} id={s.id} className="scroll-mt-24 space-y-5" aria-labelledby={`h-${s.id}`}>
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-line pb-2">
                <h2 id={`h-${s.id}`} className="font-display text-2xl">
                  <span className="mr-2 font-mono text-base text-ink-3">{i + 1}</span>
                  {s.title}
                </h2>
                {s.source && <span className="text-xs text-ink-3">{s.source === 'Supplementary' ? 'Supplementary (not in the notes)' : `Notes ${s.source.replace(/^N /, '')}`}</span>}
              </div>
              {s.blocks.map((b, j) => (
                <BlockView key={j} block={b} module={id} multi={lesson.multi} />
              ))}
            </section>
          ))}

          <section id="recap" className="card scroll-mt-24 space-y-3 p-4 sm:p-6" aria-labelledby="recap-title">
            <h2 id="recap-title" className="font-display text-2xl">
              Recap
            </h2>
            <ul className="space-y-2">
              {lesson.recap.map((r, i) => (
                <li key={i} className="flex gap-2">
                  <IconCheck size={18} className="mt-0.5 shrink-0 text-ok" />
                  <span>
                    <RichInline text={r} multi={lesson.multi} />
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <ConfidenceCheck module={id} />

          <div className="card flex flex-wrap items-center gap-3 p-4 sm:p-5">
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{record?.completedAt ? 'Lesson completed' : 'Finished reading?'}</p>
              <p className="text-sm text-ink-2">
                You have tried {tried} of {activities.length} activities in this lesson.
              </p>
            </div>
            {record?.completedAt ? (
              <span className="inline-flex items-center gap-1.5 font-semibold text-ok">
                <IconCheck size={18} /> Marked complete
              </span>
            ) : (
              <button type="button" className="btn btn-primary" onClick={() => markLessonComplete(id)}>
                Mark lesson complete
              </button>
            )}
          </div>

          <MasteryCheck module={id} />

          <nav className="flex flex-wrap justify-between gap-3" aria-label="Lessons">
            {prev ? (
              <Link to={`/learn/${prev.id}`} className="btn btn-secondary">
                <IconArrowLeft size={18} /> {prev.number}. {prev.title}
              </Link>
            ) : (
              <span />
            )}
            {next && (
              <Link to={`/learn/${next.id}`} className="btn btn-primary">
                {next.number}. {next.title} <IconArrowRight size={18} />
              </Link>
            )}
          </nav>
        </article>

        <aside className="hidden lg:block">
          <nav className="sticky top-24 space-y-1 text-sm" aria-label="On this page">
            <p className="eyebrow mb-2">On this page</p>
            {lesson.sections.map((s, i) => (
              <a key={s.id} href={`#${s.id}`} className="block rounded-md px-2 py-1.5 text-ink-2 hover:bg-surface-2 hover:text-ink">
                {i + 1}. {s.title}
              </a>
            ))}
            <a href="#recap" className="block rounded-md px-2 py-1.5 text-ink-2 hover:bg-surface-2 hover:text-ink">
              Recap
            </a>
            <a href="#mastery" className="block rounded-md px-2 py-1.5 text-ink-2 hover:bg-surface-2 hover:text-ink">
              Mastery check
            </a>
          </nav>
        </aside>
      </div>
    </div>
  );
}
