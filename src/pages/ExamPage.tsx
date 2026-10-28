import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { useTitle } from '@/app/useTitle';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { IconArrowLeft, IconArrowRight, IconCheck, IconExam, IconFlag } from '@/components/icons';
import { AnswerInput } from '@/components/questions/AnswerInput';
import { QuestionPrompt } from '@/components/questions/QuestionCard';
import { ReviewItem } from '@/components/questions/ReviewItem';
import { ScrollRegion } from '@/components/ScrollRegion';
import { MODULES, type ModuleId } from '@/content/curriculum';
import { misconceptionById } from '@/content/misconceptions';
import { buildPaper, questionById, questionsForModule } from '@/data/questions';
import { type Draft, emptyDraft, isBlank } from '@/lib/assessment/draft';
import { attemptFor, type Graded, gradeDraft, tallyByModule, tallyRows } from '@/lib/assessment/grade';
import type { Question } from '@/lib/assessment/types';
import { recordAttempt, recordExam, useProgress } from '@/lib/progress/store';

const SAVE_KEY = 'lgll.exam.v1';
const TOPICS = MODULES.filter((m) => m.id !== 'common-mistakes');

interface ExamRun {
  id: string;
  seed: string;
  questions: Question[];
  drafts: Draft[];
  flagged: boolean[];
  index: number;
  startedAt: number;
  durationSec: number | null;
}

interface SavedRun extends Omit<ExamRun, 'questions'> {
  ids: string[];
}

interface ExamResult {
  run: ExamRun;
  graded: Graded[];
  timeUsedSec: number;
  autoSubmitted: boolean;
}

// The unfinished paper is kept in this browser only, so a refresh or a closed tab does not lose it.
function saveRun(run: ExamRun | null) {
  try {
    if (!run) window.localStorage.removeItem(SAVE_KEY);
    else {
      const { questions, ...rest } = run;
      const saved: SavedRun = { ...rest, ids: questions.map((q) => q.id) };
      window.localStorage.setItem(SAVE_KEY, JSON.stringify(saved));
    }
  } catch {
    // Storage blocked: the paper still works, it just cannot be resumed.
  }
}

function loadRun(): ExamRun | null {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as SavedRun;
    if (!Array.isArray(s.ids) || typeof s.startedAt !== 'number') return null;
    const questions = s.ids.map((id) => questionById(id));
    if (questions.length === 0 || questions.some((q) => !q)) return null;
    const qs = questions as Question[];
    return {
      id: String(s.id),
      seed: String(s.seed),
      questions: qs,
      drafts: qs.map((q, i) => (s.drafts?.[i]?.type === q.type ? (s.drafts[i] as Draft) : emptyDraft(q))),
      flagged: qs.map((_, i) => s.flagged?.[i] === true),
      index: Math.min(Math.max(0, Number(s.index) || 0), qs.length - 1),
      startedAt: s.startedAt,
      durationSec: typeof s.durationSec === 'number' ? s.durationSec : null,
    };
  } catch {
    return null;
  }
}

const remainingSec = (run: ExamRun, now: number) => (run.durationSec === null ? null : Math.max(0, run.durationSec - Math.floor((now - run.startedAt) / 1000)));

function clock(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function minutes(sec: number) {
  const m = Math.round(sec / 60);
  return m < 1 ? 'under a minute' : `${m} minute${m === 1 ? '' : 's'}`;
}

// ------------------------------------------------------------------ setup

function Setup({ onStart, saved, onResume, onDiscard }: { onStart: (count: number, timer: number | null, modules: ModuleId[]) => void; saved: ExamRun | null; onResume: () => void; onDiscard: () => void }) {
  const exams = useProgress().exams;
  const [count, setCount] = useState(10);
  const [timer, setTimer] = useState<number | null>(30 * 60);
  const [all, setAll] = useState(true);
  const [picked, setPicked] = useState<ModuleId[]>([]);
  const modules = all ? [] : picked;
  const available = (all ? TOPICS.map((t) => t.id) : picked).reduce((n, m) => n + questionsForModule(m).length, 0);
  const willHave = Math.min(count, available);

  const toggle = (id: ModuleId) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <div className="mx-auto max-w-3xl px-4 pb-16 pt-6 sm:px-6 md:pt-10">
      <header className="mb-6 space-y-2">
        <p className="eyebrow">Mock exam</p>
        <h1 className="font-display text-3xl sm:text-4xl">Practice paper</h1>
        <p className="text-ink-2">
          Original questions in an exam style, from easier to harder. They are <strong>not</strong> real past-paper questions. There are no hints or solutions until you submit; then you can review every answer.
        </p>
      </header>

      {saved && (
        <section className="card mb-6 space-y-3 border-accent p-5" aria-labelledby="resume">
          <h2 id="resume" className="font-display text-xl">
            You have an unfinished paper
          </h2>
          <p className="text-sm text-ink-2">
            {saved.drafts.filter((d) => !isBlank(d)).length} of {saved.questions.length} answered
            {saved.durationSec !== null ? `, ${minutes(remainingSec(saved, Date.now()) ?? 0)} left` : ', no time limit'}.
          </p>
          <div className="flex flex-wrap gap-3">
            <button type="button" className="btn btn-primary" onClick={onResume}>
              Resume paper
            </button>
            <button type="button" className="btn btn-secondary" onClick={onDiscard}>
              Discard it
            </button>
          </div>
        </section>
      )}

      <form
        className="card space-y-6 p-5 sm:p-6"
        onSubmit={(e) => {
          e.preventDefault();
          if (willHave > 0) onStart(count, timer, modules);
        }}
      >
        <fieldset className="space-y-2">
          <legend className="mb-1 font-semibold">Length</legend>
          <div className="flex flex-wrap gap-2">
            {[10, 20].map((n) => (
              <label key={n} className={`flex cursor-pointer items-center gap-2 rounded-xl border-2 px-4 py-2.5 ${count === n ? 'border-accent bg-accent-soft' : 'border-line'}`}>
                <input type="radio" name="count" checked={count === n} onChange={() => setCount(n)} className="accent-[var(--accent)]" />
                {n} questions
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className="space-y-2">
          <legend className="mb-1 font-semibold">Timer</legend>
          <div className="flex flex-wrap gap-2">
            {[
              { v: null, label: 'No timer' },
              { v: 15 * 60, label: '15 minutes' },
              { v: 30 * 60, label: '30 minutes' },
              { v: 45 * 60, label: '45 minutes' },
            ].map((t) => (
              <label key={t.label} className={`flex cursor-pointer items-center gap-2 rounded-xl border-2 px-4 py-2.5 ${timer === t.v ? 'border-accent bg-accent-soft' : 'border-line'}`}>
                <input type="radio" name="timer" checked={timer === t.v} onChange={() => setTimer(t.v)} className="accent-[var(--accent)]" />
                {t.label}
              </label>
            ))}
          </div>
          <p className="text-sm text-ink-2">When the time runs out, the paper is submitted automatically.</p>
        </fieldset>
        <fieldset className="space-y-2">
          <legend className="mb-1 font-semibold">Topics</legend>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} className="h-5 w-5 accent-[var(--accent)]" />
            All topics
          </label>
          {!all && (
            <div className="grid gap-1.5 pt-1 sm:grid-cols-2">
              {TOPICS.map((t) => (
                <label key={t.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={picked.includes(t.id)} onChange={() => toggle(t.id)} className="h-5 w-5 accent-[var(--accent)]" />
                  {t.number}. {t.title}
                </label>
              ))}
            </div>
          )}
        </fieldset>
        <div className="flex flex-wrap items-center gap-3 border-t border-line pt-5">
          <button type="submit" className="btn btn-primary" disabled={willHave === 0}>
            <IconExam size={18} /> Start paper
          </button>
          <span className="text-sm text-ink-2" aria-live="polite">
            {willHave === 0 ? 'Choose at least one topic.' : willHave < count ? `These topics have only ${willHave} questions, so the paper will be shorter.` : `${willHave} questions.`}
          </span>
        </div>
      </form>

      {exams.length > 0 && (
        <section className="mt-8 space-y-2" aria-labelledby="recent">
          <h2 id="recent" className="font-display text-xl">
            Recent papers
          </h2>
          <ul className="space-y-1 text-sm">
            {exams
              .slice(-3)
              .reverse()
              .map((e) => (
                <li key={e.id}>
                  {new Date(e.at).toLocaleDateString()}: {e.score} of {e.total} in {minutes(e.timeUsedSec)}
                </li>
              ))}
          </ul>
          <Link to="/progress" className="text-sm font-semibold text-accent underline underline-offset-2">
            Full history on the progress page
          </Link>
        </section>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ running

function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [active]);
  return now;
}

function Running({ run, onChange, onSubmit }: { run: ExamRun; onChange: (r: ExamRun) => void; onSubmit: (auto: boolean) => void }) {
  const now = useNow(run.durationSec !== null);
  const left = remainingSec(run, now);
  const [confirming, setConfirming] = useState(false);
  const [announce, setAnnounce] = useState('');
  const announced = useRef(new Set<number>());
  const headingRef = useRef<HTMLHeadingElement>(null);
  const submitted = useRef(false);
  const q = run.questions[run.index];
  const draft = run.drafts[run.index];
  const total = run.questions.length;
  const answered = run.drafts.filter((d) => !isBlank(d)).length;
  const flaggedCount = run.flagged.filter(Boolean).length;

  useEffect(() => {
    if (left === null) return;
    if (left <= 0 && !submitted.current) {
      submitted.current = true;
      onSubmit(true);
      return;
    }
    for (const mark of [300, 60]) {
      if (left <= mark && !announced.current.has(mark)) {
        announced.current.add(mark);
        setAnnounce(mark === 300 ? '5 minutes left.' : '1 minute left.');
      }
    }
  }, [left, onSubmit]);

  const go = (i: number) => {
    onChange({ ...run, index: i });
    requestAnimationFrame(() => headingRef.current?.focus());
  };

  if (!q || !draft) return null;
  const last = run.index === total - 1;

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-4 sm:px-6">
      <div className="sticky top-14 z-20 -mx-4 md:top-16 mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line bg-paper/95 px-4 py-2.5 backdrop-blur sm:-mx-6 sm:px-6">
        <span className="font-semibold">Practice paper</span>
        <span className="text-sm text-ink-2">
          {answered} of {total} answered
        </span>
        <span className="flex-1" />
        {left !== null && (
          <span role="timer" aria-label={`Time left: ${minutes(left)}`} className={`rounded-lg border px-2.5 py-1 font-mono text-lg font-semibold tabular-nums ${left <= 60 ? 'border-bad text-bad' : left <= 300 ? 'border-hi-strong' : 'border-line'}`}>
            {clock(left)}
          </span>
        )}
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setConfirming(true)}>
          Finish paper
        </button>
      </div>
      <p className="sr-only" aria-live="assertive">
        {announce}
      </p>

      <div className="grid gap-6 lg:grid-cols-[1fr_15rem]">
        <section className="card min-w-0 space-y-5 p-4 sm:p-6" aria-labelledby="exam-q">
          <h1 id="exam-q" ref={headingRef} tabIndex={-1} className="sr-only">
            Question {run.index + 1} of {total}
          </h1>
          <QuestionPrompt question={q} number={run.index + 1} total={total} />
          <AnswerInput question={q} draft={draft} onChange={(d) => onChange({ ...run, drafts: run.drafts.map((x, i) => (i === run.index ? d : x)) })} seed={run.seed} onSubmit={() => !last && go(run.index + 1)} />
          <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
            <button type="button" className="btn btn-ghost" onClick={() => go(run.index - 1)} disabled={run.index === 0}>
              <IconArrowLeft size={18} /> Previous
            </button>
            <button type="button" className="btn btn-secondary" aria-pressed={run.flagged[run.index]} onClick={() => onChange({ ...run, flagged: run.flagged.map((f, i) => (i === run.index ? !f : f)) })}>
              <IconFlag size={18} /> {run.flagged[run.index] ? 'Flagged' : 'Flag for review'}
            </button>
            <span className="flex-1" />
            {last ? (
              <button type="button" className="btn btn-primary" onClick={() => setConfirming(true)}>
                Finish paper
              </button>
            ) : (
              <button type="button" className="btn btn-primary" onClick={() => go(run.index + 1)}>
                Next <IconArrowRight size={18} />
              </button>
            )}
          </div>
        </section>

        <nav aria-label="Questions" className="space-y-2 lg:sticky lg:top-36 lg:self-start">
          <p className="text-sm font-semibold">Questions</p>
          <ol className="grid grid-cols-5 gap-2 sm:grid-cols-10 lg:grid-cols-5">
            {run.questions.map((qq, i) => {
              const done = !isBlank(run.drafts[i] ?? emptyDraft(qq));
              const flag = run.flagged[i];
              const current = i === run.index;
              return (
                <li key={qq.id}>
                  <button
                    type="button"
                    onClick={() => go(i)}
                    aria-current={current ? 'step' : undefined}
                    aria-label={`Question ${i + 1}: ${done ? 'answered' : 'not answered'}${flag ? ', flagged' : ''}`}
                    className={`relative flex h-11 w-full items-center justify-center rounded-lg border-2 font-mono text-sm font-semibold ${done ? 'border-solid border-ink-2 bg-surface-3' : 'border-dashed border-line-strong bg-surface'} ${current ? 'outline outline-2 outline-offset-2 outline-accent' : ''}`}
                  >
                    {i + 1}
                    {done && <IconCheck size={12} className="absolute bottom-0.5 right-0.5" />}
                    {flag && <IconFlag size={12} className="absolute right-0.5 top-0.5 text-hi-strong" />}
                  </button>
                </li>
              );
            })}
          </ol>
          <p className="text-xs text-ink-3">Solid box with a tick: answered. Dashed box: not answered. Flag: marked for review.</p>
        </nav>
      </div>

      <ConfirmDialog
        open={confirming}
        title="Submit your paper?"
        confirmLabel="Submit paper"
        cancelLabel="Keep working"
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          submitted.current = true;
          onSubmit(false);
        }}
      >
        <p>
          You have answered {answered} of {total} questions.
        </p>
        {answered < total && <p>{total - answered} unanswered question{total - answered === 1 ? '' : 's'} will score 0.</p>}
        {flaggedCount > 0 && (
          <p>
            {flaggedCount} question{flaggedCount === 1 ? ' is' : 's are'} flagged for review.
          </p>
        )}
      </ConfirmDialog>
    </div>
  );
}

// ------------------------------------------------------------------ results

type Filter = 'all' | 'wrong' | 'flagged';

function Results({ result, onNew }: { result: ExamResult; onNew: () => void }) {
  const { run, graded, timeUsedSec, autoSubmitted } = result;
  const [filter, setFilter] = useState<Filter>('all');
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => headingRef.current?.focus(), []);
  const score = graded.filter((g) => g.result.correct).length;
  const rows = tallyRows(tallyByModule(graded));
  const mistakes = [...new Set(graded.flatMap((g) => (!g.result.correct && g.result.misconception ? [g.result.misconception] : [])))];
  const shown = graded.map((g, i) => ({ g, i })).filter(({ g, i }) => filter === 'all' || (filter === 'wrong' ? !g.result.correct : run.flagged[i]));

  return (
    <div className="mx-auto max-w-3xl px-4 pb-16 pt-6 sm:px-6 md:pt-10">
      <p className="eyebrow">Paper submitted</p>
      <h1 ref={headingRef} tabIndex={-1} className="mt-2 font-display text-3xl outline-none sm:text-4xl">
        {score} of {graded.length} correct ({Math.round((score / graded.length) * 100)}%)
      </h1>
      <p className="mt-2 text-ink-2">
        Time used: {minutes(timeUsedSec)}
        {run.durationSec !== null ? ` of ${minutes(run.durationSec)}` : ' (no time limit)'}.
      </p>
      {autoSubmitted && <p className="mt-3 rounded-xl border border-hi-strong bg-hi-soft p-3 text-sm font-semibold">Time ran out, so your paper was submitted automatically.</p>}

      <section className="mt-8 space-y-3" aria-labelledby="topics">
        <h2 id="topics" className="font-display text-2xl">
          By topic
        </h2>
        <ScrollRegion label="Results by topic" className="rounded-xl border border-line bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-ink-2">
                <th scope="col" className="px-4 py-2 font-semibold">
                  Topic
                </th>
                <th scope="col" className="px-4 py-2 text-right font-semibold">
                  Correct
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.module.id} className="border-b border-line last:border-0">
                  <th scope="row" className="px-4 py-2 text-left font-normal">
                    <Link to={`/learn/${r.module.id}`} className="underline-offset-2 hover:underline">
                      {r.module.number}. {r.module.title}
                    </Link>
                  </th>
                  <td className="whitespace-nowrap px-4 py-2 text-right font-mono">
                    {r.correct} of {r.total}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollRegion>
      </section>

      {mistakes.length > 0 && (
        <section className="mt-8 space-y-2" aria-labelledby="mistakes">
          <h2 id="mistakes" className="font-display text-2xl">
            Mistakes to work on
          </h2>
          <ul className="space-y-1">
            {mistakes.map((id) => {
              const m = misconceptionById(id);
              return m ? (
                <li key={id}>
                  <Link to={`/practice/session?misconception=${m.id}`} className="font-semibold text-accent underline underline-offset-2">
                    {m.title}
                  </Link>
                </li>
              ) : null;
            })}
          </ul>
        </section>
      )}

      <section className="mt-8 space-y-4" aria-labelledby="review">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="review" className="font-display text-2xl">
            Review
          </h2>
          <div role="group" aria-label="Show questions" className="flex gap-1 rounded-xl border border-line bg-surface p-1">
            {(
              [
                ['all', 'All'],
                ['wrong', 'Wrong or blank'],
                ['flagged', 'Flagged'],
              ] as const
            ).map(([f, label]) => (
              <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)} className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${filter === f ? 'bg-surface-3 text-ink' : 'text-ink-2'}`}>
                {label}
              </button>
            ))}
          </div>
        </div>
        {shown.length === 0 && <p className="text-ink-2">{filter === 'wrong' ? 'Nothing here: every answer was correct.' : 'You did not flag any questions.'}</p>}
        {shown.map(({ g, i }) => (
          <ReviewItem key={g.question.id} graded={g} number={i + 1} total={graded.length} seed={run.seed} flagged={run.flagged[i]} />
        ))}
      </section>

      <div className="mt-8 flex flex-wrap gap-3">
        <button type="button" className="btn btn-primary" onClick={onNew}>
          New paper
        </button>
        <Link to="/progress" className="btn btn-secondary">
          See your progress
        </Link>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ page

export default function ExamPage() {
  useTitle('Practice paper');
  const [saved, setSaved] = useState<ExamRun | null>(() => loadRun());
  const [run, setRun] = useState<ExamRun | null>(null);
  const [result, setResult] = useState<ExamResult | null>(null);

  const runRef = useRef<ExamRun | null>(null);

  const update = useCallback((r: ExamRun | null) => {
    runRef.current = r;
    setRun(r);
    saveRun(r);
  }, []);

  const start = (count: number, timer: number | null, modules: ModuleId[]) => {
    const at = Date.now();
    const seed = `exam:${at}`;
    const questions = buildPaper({ count, seed, modules });
    setSaved(null);
    update({ id: `exam-${at}`, seed, questions, drafts: questions.map(emptyDraft), flagged: questions.map(() => false), index: 0, startedAt: at, durationSec: timer });
    window.scrollTo({ top: 0 });
  };

  const submit = useCallback(
    (auto: boolean) => {
      const current = runRef.current;
      if (!current) return;
      const graded = current.questions.map((q, i) => gradeDraft(q, current.drafts[i] ?? emptyDraft(q)));
      const elapsed = Math.floor((Date.now() - current.startedAt) / 1000);
      const timeUsedSec = current.durationSec === null ? elapsed : Math.min(elapsed, current.durationSec);
      for (const g of graded) if (g.answered) recordAttempt(attemptFor(g, 'exam'));
      recordExam({
        id: current.id,
        at: Date.now(),
        durationSec: current.durationSec,
        timeUsedSec,
        score: graded.filter((g) => g.result.correct).length,
        total: graded.length,
        byModule: tallyByModule(graded),
      });
      update(null);
      setResult({ run: current, graded, timeUsedSec, autoSubmitted: auto });
      window.scrollTo({ top: 0 });
    },
    [update],
  );

  // A paper whose time ran out while the tab was closed is submitted as it was saved.
  const resume = () => {
    if (!saved) return;
    setSaved(null);
    update(saved);
  };

  if (result) return <Results result={result} onNew={() => setResult(null)} />;
  if (run) return <Running run={run} onChange={update} onSubmit={submit} />;
  return (
    <Setup
      onStart={start}
      saved={saved}
      onResume={resume}
      onDiscard={() => {
        saveRun(null);
        setSaved(null);
      }}
    />
  );
}
