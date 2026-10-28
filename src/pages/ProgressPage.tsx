import { type ReactNode, useRef, useState } from 'react';
import { Link } from 'react-router';
import { useTitle } from '@/app/useTitle';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { IconArrowRight, IconDownload, IconSpark, IconTrash, IconUpload, IconWarn } from '@/components/icons';
import { CONFIDENCE } from '@/components/lesson/MasteryCheck';
import { ScrollRegion } from '@/components/ScrollRegion';
import { MODULES, moduleById, type ModuleId } from '@/content/curriculum';
import { misconceptionById } from '@/content/misconceptions';
import { allModuleStats, MASTERY_EXPLAINED, MASTERY_LABEL, type MasteryLevel, overallProgress, recentMisconceptions, recommendations } from '@/lib/progress/analytics';
import { BADGES } from '@/lib/progress/badges';
import { exportProgress, importProgress, isStorageAvailable, localDay, resetProgress, updateSettings, useProgress } from '@/lib/progress/store';
import type { Settings } from '@/lib/progress/types';

const LEVEL_ORDER: MasteryLevel[] = ['not-started', 'started', 'practising', 'secure', 'mastered'];

/** Mastery shown as filled steps plus a word, so it never relies on colour. */
function MasteryMeter({ level }: { level: MasteryLevel }) {
  const n = LEVEL_ORDER.indexOf(level);
  return (
    <span className="inline-flex items-center gap-2">
      <span className="flex gap-0.5" aria-hidden="true">
        {[1, 2, 3, 4].map((i) => (
          <span key={i} className={`h-3 w-2.5 rounded-sm border ${i <= n ? 'border-accent bg-accent' : 'border-line-strong bg-transparent'}`} />
        ))}
      </span>
      <span className="text-sm font-semibold">{MASTERY_LABEL[level]}</span>
    </span>
  );
}

function Section({ id, title, children, intro }: { id: string; title: string; children: ReactNode; intro?: ReactNode }) {
  return (
    <section className="space-y-3" aria-labelledby={id}>
      <h2 id={id} className="font-display text-2xl">
        {title}
      </h2>
      {intro && <p className="text-sm text-ink-2">{intro}</p>}
      {children}
    </section>
  );
}

function Stat({ label, value, note }: { label: string; value: ReactNode; note?: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">{label}</p>
      <p className="mt-0.5 font-display text-2xl">{value}</p>
      {note && <p className="text-xs text-ink-3">{note}</p>}
    </div>
  );
}

function Choice<T extends string | number>({ legend, name, value, options, onChange }: { legend: string; name: string; value: T; options: { v: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <fieldset className="space-y-1.5">
      <legend className="font-semibold">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <label key={String(o.v)} className={`flex cursor-pointer items-center gap-2 rounded-xl border-2 px-3 py-2 text-sm ${value === o.v ? 'border-accent bg-accent-soft' : 'border-line'}`}>
            <input type="radio" name={name} checked={value === o.v} onChange={() => onChange(o.v)} className="accent-[var(--accent)]" />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function SettingsForm({ settings }: { settings: Settings }) {
  return (
    <div className="card grid gap-5 p-5 sm:grid-cols-2">
      <Choice
        legend="Theme"
        name="theme"
        value={settings.theme}
        onChange={(theme) => updateSettings({ theme })}
        options={[
          { v: 'system', label: 'Match device' },
          { v: 'light', label: 'Light' },
          { v: 'dark', label: 'Dark' },
        ]}
      />
      <Choice
        legend="Animation"
        name="motion"
        value={settings.motion}
        onChange={(motion) => updateSettings({ motion })}
        options={[
          { v: 'system', label: 'Match device' },
          { v: 'reduce', label: 'Reduced' },
          { v: 'full', label: 'Full' },
        ]}
      />
      <Choice
        legend="Show AND as"
        name="and"
        value={settings.andNotation}
        onChange={(andNotation) => updateSettings({ andNotation })}
        options={[
          { v: 'dot', label: 'A.B (dot)' },
          { v: 'juxtapose', label: 'AB (no dot)' },
        ]}
      />
      <Choice
        legend="Daily goal"
        name="goal"
        value={settings.dailyGoal}
        onChange={(dailyGoal) => updateSettings({ dailyGoal })}
        options={[5, 10, 20].map((v) => ({ v, label: `${v} questions` }))}
      />
    </div>
  );
}

function DataTools() {
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const download = () => {
    const blob = new Blob([exportProgress()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logic-gates-progress-${localDay()}.json`;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage({ ok: true, text: 'Progress file downloaded.' });
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    const res = importProgress(await file.text());
    setMessage(res.ok ? { ok: true, text: 'Progress imported. It has replaced the progress on this device.' } : { ok: false, text: res.error });
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="card space-y-4 p-5">
      <p className="text-sm text-ink-2">Your progress is saved only in this browser. Download it to keep a copy or to move it to another device. Importing a file replaces the progress on this device.</p>
      <div className="flex flex-wrap gap-3">
        <button type="button" className="btn btn-secondary" onClick={download}>
          <IconDownload size={18} /> Download progress
        </button>
        <label className="btn btn-secondary cursor-pointer focus-within:outline focus-within:outline-2 focus-within:outline-accent">
          <IconUpload size={18} /> Import progress
          <input ref={fileRef} type="file" accept="application/json,.json" className="sr-only" onChange={(e) => void onFile(e.target.files?.[0])} />
        </label>
        <button type="button" className="btn btn-ghost text-bad" onClick={() => setConfirming(true)}>
          <IconTrash size={18} /> Delete all progress
        </button>
      </div>
      <p role="status" className={`text-sm font-semibold ${message ? (message.ok ? 'text-ok' : 'text-bad') : ''}`}>
        {message?.text}
      </p>
      <ConfirmDialog
        open={confirming}
        danger
        title="Delete all progress?"
        confirmLabel="Delete progress"
        cancelLabel="Keep it"
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          resetProgress(true);
          setConfirming(false);
          setMessage({ ok: true, text: 'All progress deleted. Your settings were kept.' });
        }}
      >
        <p>This removes your lessons, answers, XP, badges and exam history from this device. It cannot be undone, so download a copy first if you might want it back.</p>
      </ConfirmDialog>
    </div>
  );
}

export default function ProgressPage() {
  useTitle('Your progress');
  const progress = useProgress();
  const stats = allModuleStats(progress);
  const overall = overallProgress(progress);
  const recs = recommendations(progress, 5);
  const mistakes = recentMisconceptions(progress).filter((m) => misconceptionById(m.id));
  const answered = progress.attempts.length;
  const firstTry = progress.attempts.filter((a) => a.correct && !a.revealed).length;
  const confidence = Object.entries(progress.confidence) as [ModuleId, { value: 1 | 2 | 3 | 4; at: number }][];

  return (
    <div className="mx-auto max-w-5xl space-y-10 px-4 pb-16 pt-6 sm:px-6 md:pt-10">
      <header className="space-y-2">
        <p className="eyebrow">Progress</p>
        <h1 className="font-display text-3xl sm:text-4xl">Your progress</h1>
        <p className="text-ink-2">Everything here is worked out from your answers on this device. Each level and suggestion says how it was decided.</p>
        {!isStorageAvailable() && (
          <p className="flex items-start gap-2 rounded-xl border border-hi-strong bg-hi-soft p-3 text-sm font-semibold">
            <IconWarn size={18} className="mt-0.5 shrink-0" /> Your browser is not letting this site save data (for example in a private window). Your progress will be lost when you close this tab.
          </p>
        )}
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="XP" value={progress.xp} />
        <Stat label="Lessons done" value={`${overall.completed}/${overall.total}`} />
        <Stat label="Topics mastered" value={overall.mastered} />
        <Stat label="Answers" value={answered} />
        <Stat label="Correct" value={answered ? `${Math.round((firstTry / answered) * 100)}%` : '—'} note="without the solution" />
        <Stat label="Days practised" value={progress.activeDays.length} />
      </div>

      <Section id="next" title="What to do next">
        <ul className="grid gap-3 md:grid-cols-2">
          {recs.map((r) => (
            <li key={r.id} className="card flex flex-col gap-2 p-4">
              <p className="font-semibold">{r.title}</p>
              <p className="text-sm text-ink-2">
                <span className="font-semibold text-ink">Why: </span>
                {r.reason}
              </p>
              <Link to={r.to} className="mt-auto inline-flex items-center gap-1 pt-1 text-sm font-semibold text-accent">
                {r.action} <IconArrowRight size={16} />
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="topics" title="Topics" intro="Levels come from your last 10 answers on each topic and its mastery check.">
        <div className="table-scroll rounded-xl border border-line bg-surface">
          <table className="w-full min-w-[36rem] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-ink-2">
                <th scope="col" className="px-4 py-2 font-semibold">
                  Topic
                </th>
                <th scope="col" className="px-4 py-2 font-semibold">
                  Level
                </th>
                <th scope="col" className="px-4 py-2 font-semibold">
                  Recent answers
                </th>
                <th scope="col" className="px-4 py-2 font-semibold">
                  Mastery check
                </th>
              </tr>
            </thead>
            <tbody>
              {stats.map((st) => {
                const m = moduleById(st.module);
                const mc = progress.lessons[st.module]?.mastery;
                return (
                  <tr key={st.module} className="border-b border-line last:border-0">
                    <th scope="row" className="px-4 py-2.5 text-left font-normal">
                      <Link to={`/learn/${m.id}`} className="font-semibold underline-offset-2 hover:underline">
                        {m.number}. {m.title}
                      </Link>
                      {st.completed && <span className="ml-2 text-xs text-ink-3">lesson done</span>}
                    </th>
                    <td className="whitespace-nowrap px-4 py-2.5">
                      <MasteryMeter level={st.level} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 font-mono">{st.recent.length ? `${st.recentCorrect} of ${st.recent.length}` : '—'}</td>
                    <td className="whitespace-nowrap px-4 py-2.5">{mc ? (mc.passed ? 'Passed' : `${mc.score} of ${mc.total}, not passed yet`) : 'Not taken'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <details className="rounded-xl border border-line bg-surface p-4">
          <summary className="cursor-pointer font-semibold">What do the levels mean?</summary>
          <dl className="mt-3 space-y-2 text-sm">
            {LEVEL_ORDER.map((l) => (
              <div key={l}>
                <dt>
                  <MasteryMeter level={l} />
                </dt>
                <dd className="mt-0.5 text-ink-2">{MASTERY_EXPLAINED[l]}</dd>
              </div>
            ))}
          </dl>
        </details>
      </Section>

      {confidence.length > 0 && (
        <Section id="confidence" title="Confidence and results" intro="How sure you said you felt at the end of each lesson, next to your recent answers on that topic.">
          <ul className="space-y-2">
            {MODULES.filter((m) => progress.confidence[m.id]).map((m) => {
              const c = progress.confidence[m.id];
              const st = stats.find((s) => s.module === m.id);
              if (!c || !st) return null;
              const rate = st.recent.length ? st.recentCorrect / st.recent.length : null;
              const mismatch = rate !== null && st.recent.length >= 4 && ((c.value >= 3 && rate < 0.6) || (c.value <= 2 && rate >= 0.8));
              return (
                <li key={m.id} className="rounded-xl border border-line bg-surface px-4 py-3 text-sm">
                  <p className="font-semibold">{m.title}</p>
                  <p className="text-ink-2">
                    You said: <span className="text-ink">{CONFIDENCE[c.value - 1]?.label}</span> · Recent answers: <span className="text-ink">{st.recent.length ? `${st.recentCorrect} of ${st.recent.length} correct` : 'none yet'}</span>
                  </p>
                  {mismatch && (
                    <p className="mt-1 font-semibold">
                      {c.value >= 3 ? 'Your results are lower than your confidence. Try a short practice set to check.' : 'Your results are better than you think. You may be ready to move on.'}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </Section>
      )}

      {mistakes.length > 0 && (
        <Section id="mistakes" title="Mistakes you have been making" intro="Patterns found in the wrong answers among your last 30.">
          <ul className="grid gap-2 sm:grid-cols-2">
            {mistakes.map((x) => {
              const m = misconceptionById(x.id);
              if (!m) return null;
              return (
                <li key={x.id} className="rounded-xl border border-line bg-surface px-4 py-3 text-sm">
                  <p className="font-semibold">
                    {m.title} <span className="font-normal text-ink-3">· {x.count}×</span>
                  </p>
                  <p className="mt-1 flex flex-wrap gap-x-4">
                    <Link to={`/learn/common-mistakes#${m.id}`} className="text-accent underline underline-offset-2">
                      Read about it
                    </Link>
                    <Link to={`/practice/session?misconception=${m.id}`} className="text-accent underline underline-offset-2">
                      Practise it
                    </Link>
                  </p>
                </li>
              );
            })}
          </ul>
        </Section>
      )}

      {progress.diagnostic && (
        <Section id="diagnostic" title="Diagnostic">
          <p className="text-sm">
            Taken on {new Date(progress.diagnostic.at).toLocaleDateString()}. Suggested start:{' '}
            <Link to={`/learn/${progress.diagnostic.recommendedStart}`} className="font-semibold text-accent underline underline-offset-2">
              lesson {moduleById(progress.diagnostic.recommendedStart).number}, {moduleById(progress.diagnostic.recommendedStart).title}
            </Link>
            .{' '}
            <Link to="/diagnostic" className="underline underline-offset-2">
              Take it again
            </Link>
          </p>
        </Section>
      )}

      <Section id="badges" title="Badges" intro={`${Object.keys(progress.badges).length} of ${BADGES.length} earned. Badges reward steady learning, not speed.`}>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {BADGES.map((b) => {
            const at = progress.badges[b.id];
            return (
              <li key={b.id} className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${at ? 'border-accent bg-accent-soft' : 'border-dashed border-line-strong bg-surface'}`}>
                <span className={`mt-0.5 ${at ? 'text-accent' : 'text-ink-3'}`} aria-hidden="true">
                  {at ? <IconSpark size={20} /> : <span className="block h-5 w-5 rounded-full border-2 border-dashed border-line-strong" />}
                </span>
                <span className="min-w-0">
                  <span className="block font-semibold">{b.title}</span>
                  <span className="block text-sm text-ink-2">{b.description}</span>
                  <span className="mt-0.5 block text-xs font-semibold">{at ? `Earned ${new Date(at).toLocaleDateString()}` : 'Not earned yet'}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </Section>

      <Section id="papers" title="Practice papers">
        {progress.exams.length === 0 ? (
          <p className="text-sm text-ink-2">
            No papers yet.{' '}
            <Link to="/exam" className="font-semibold text-accent underline underline-offset-2">
              Try a practice paper
            </Link>
            .
          </p>
        ) : (
          <ScrollRegion label="Practice papers table" className="rounded-xl border border-line bg-surface">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-ink-2">
                  <th scope="col" className="px-4 py-2 font-semibold">
                    Date
                  </th>
                  <th scope="col" className="px-4 py-2 font-semibold">
                    Score
                  </th>
                  <th scope="col" className="px-4 py-2 font-semibold">
                    Time used
                  </th>
                </tr>
              </thead>
              <tbody>
                {[...progress.exams].reverse().map((e) => (
                  <tr key={e.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-2">{new Date(e.at).toLocaleDateString()}</td>
                    <td className="px-4 py-2 font-mono">
                      {e.score} of {e.total}
                    </td>
                    <td className="px-4 py-2">
                      {Math.max(1, Math.round(e.timeUsedSec / 60))} min{e.durationSec !== null ? ` of ${Math.round(e.durationSec / 60)}` : ' (untimed)'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollRegion>
        )}
      </Section>

      <Section id="settings" title="Settings">
        <SettingsForm settings={progress.settings} />
      </Section>

      <Section id="data" title="Your data">
        <DataTools />
      </Section>
    </div>
  );
}
