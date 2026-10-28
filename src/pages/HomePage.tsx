import { useState } from 'react';
import { Link } from 'react-router';
import { useTitle } from '@/app/useTitle';
import { GateShape } from '@/components/gates/GateSymbol';
import { gateGeometry } from '@/components/gates/geometry';
import { IconArrowRight, IconCheck, IconExam, IconLab, IconPractice } from '@/components/icons';
import { Lamp, SignalToggle } from '@/components/signals';
import { MODULES } from '@/content/curriculum';
import { QUESTIONS } from '@/data/questions';
import { evaluateGate } from '@/lib/logic/gates';
import { gateReason } from '@/lib/logic/explain';
import type { Bit, GateType } from '@/lib/logic/types';
import { allModuleStats, MASTERY_LABEL, overallProgress, recommendations } from '@/lib/progress/analytics';
import { useProgress } from '@/lib/progress/store';

const HERO_GATES: GateType[] = ['AND', 'OR', 'XOR', 'NAND'];

/** The first thing on the page is a working gate, not a picture of one. */
function HeroBench() {
  const [gate, setGate] = useState<GateType>('XOR');
  const [a, setA] = useState<Bit>(1);
  const [b, setB] = useState<Bit>(0);
  const out = evaluateGate(gate, [a, b]);
  const geo = gateGeometry(gate, 2);
  return (
    <div className="card bench-grid space-y-4 p-4 sm:p-5" aria-label="Try a logic gate">
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Gate">
        {HERO_GATES.map((g) => (
          <button key={g} type="button" role="radio" aria-checked={g === gate} onClick={() => setGate(g)} className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${g === gate ? 'bg-ink text-paper' : 'border border-line-strong bg-surface text-ink-2'}`}>
            {g}
          </button>
        ))}
      </div>
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-2">
          <SignalToggle label="A" value={a} onChange={setA} size="sm" />
          <SignalToggle label="B" value={b} onChange={setB} size="sm" />
        </div>
        <svg viewBox={`-14 -8 ${geo.width + 22} ${geo.height + 16}`} width={150} role="img" aria-label={`${gate} gate: A = ${a}, B = ${b}, output ${out}`}>
          <g transform="translate(-10 0)">
            {[a, b].map((v, k) => (
              <line key={k} x1={0} x2={10} y1={geo.inputPins[k]?.y} y2={geo.inputPins[k]?.y} stroke={v === 1 ? 'var(--hi)' : 'var(--lo)'} strokeWidth={v === 1 ? 3 : 2} strokeDasharray={v === 1 ? undefined : '5 4'} />
            ))}
          </g>
          <GateShape gate={gate} inputValues={[a, b]} output={out} />
        </svg>
        <Lamp value={out} size={56} />
      </div>
      <p className="text-sm text-ink-2" aria-live="polite">
        {gateReason(gate, [a, b], out)}
      </p>
    </div>
  );
}

export default function HomePage() {
  useTitle('');
  const progress = useProgress();
  const stats = allModuleStats(progress);
  const overall = overallProgress(progress);
  const started = progress.attempts.length > 0 || Object.keys(progress.lessons).length > 0;
  const recs = recommendations(progress, 3);
  const firstOpen = stats.find((s) => !s.completed);
  const continueTo = firstOpen ? `/learn/${firstOpen.module}` : '/practice';
  const stages = [...new Set(MODULES.map((m) => m.stage))];

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-8 sm:px-6 md:pt-14">
      <section className="grid items-center gap-8 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="space-y-5">
          <p className="eyebrow">GCE A/L ICT · Unit 4 · Logic gates</p>
          <h1 className="font-display text-4xl leading-[1.08] sm:text-5xl">Understand logic gates by switching them on.</h1>
          <p className="max-w-xl text-lg text-ink-2">
            Fourteen short lessons, a circuit lab and {QUESTIONS.length} original practice questions — from your first truth table to adders, latches and K-maps. Free, no account, and it works offline.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link to={started ? continueTo : '/learn/foundations'} className="btn btn-primary">
              {started ? 'Continue learning' : 'Start learning'} <IconArrowRight size={18} />
            </Link>
            <Link to="/diagnostic" className="btn btn-secondary">
              Test my knowledge
            </Link>
          </div>
          <p className="text-sm text-ink-3">Not sure where to start? The 12-question diagnostic suggests a starting lesson.</p>
        </div>
        <HeroBench />
      </section>

      {started && (
        <section className="mt-12 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]" aria-labelledby="your-progress">
          <div className="card space-y-3 p-5">
            <h2 id="your-progress" className="font-display text-xl">
              Your progress
            </h2>
            <dl className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-xl bg-surface-2 p-3">
                <dt className="text-xs text-ink-2">Lessons done</dt>
                <dd className="font-mono text-2xl font-semibold">
                  {overall.completed}/{overall.total}
                </dd>
              </div>
              <div className="rounded-xl bg-surface-2 p-3">
                <dt className="text-xs text-ink-2">Mastered</dt>
                <dd className="font-mono text-2xl font-semibold">{overall.mastered}</dd>
              </div>
              <div className="rounded-xl bg-surface-2 p-3">
                <dt className="text-xs text-ink-2">XP</dt>
                <dd className="font-mono text-2xl font-semibold">{progress.xp}</dd>
              </div>
            </dl>
            <Link to="/progress" className="inline-flex items-center gap-1 text-sm font-semibold text-accent underline-offset-2 hover:underline">
              See details <IconArrowRight size={16} />
            </Link>
          </div>
          <div className="card space-y-3 p-5">
            <h2 className="font-display text-xl">Suggested next</h2>
            <ul className="space-y-2">
              {recs.map((r) => (
                <li key={r.id} className="rounded-xl border border-line p-3">
                  <Link to={r.to} className="font-semibold text-accent underline-offset-2 hover:underline">
                    {r.title}
                  </Link>
                  <p className="text-sm text-ink-2">Why: {r.reason}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <section className="mt-14 space-y-6" aria-labelledby="path-title">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow">The learning path</p>
            <h2 id="path-title" className="font-display text-3xl">
              From 0 and 1 to memory
            </h2>
          </div>
          <Link to="/learn" className="btn btn-secondary btn-sm">
            All lessons
          </Link>
        </div>
        <ol className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {stages.map((stage) => (
            <li key={stage} className="space-y-2">
              <p className="text-sm font-semibold text-ink-2">{stage}</p>
              <ul className="space-y-1.5">
                {MODULES.filter((m) => m.stage === stage).map((m) => {
                  const st = stats.find((s) => s.module === m.id);
                  return (
                    <li key={m.id}>
                      <Link to={`/learn/${m.id}`} className="flex items-start gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm hover:border-line-strong">
                        <span className="mt-0.5 font-mono text-xs text-ink-3">{String(m.number).padStart(2, '0')}</span>
                        <span className="min-w-0 flex-1 font-semibold">{m.title}</span>
                        {st?.completed && <IconCheck size={16} className="mt-0.5 shrink-0 text-ok" aria-label="completed" />}
                        {st && st.level !== 'not-started' && !st.completed && <span className="sr-only">{MASTERY_LABEL[st.level]}</span>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-14 grid gap-4 md:grid-cols-3" aria-label="Other ways to learn">
        <Link to="/lab" className="card group space-y-2 p-5 hover:border-line-strong">
          <IconLab size={26} className="text-accent" />
          <h3 className="font-display text-xl">Circuit Lab</h3>
          <p className="text-sm text-ink-2">Build circuits gate by gate, type an expression to see its circuit and simplest form, or group cells on a K-map.</p>
        </Link>
        <Link to="/practice" className="card group space-y-2 p-5 hover:border-line-strong">
          <IconPractice size={26} className="text-accent" />
          <h3 className="font-display text-xl">Practice</h3>
          <p className="text-sm text-ink-2">Rapid-fire rounds, practice by topic or level, and sessions that target the mistakes you actually make.</p>
        </Link>
        <Link to="/exam" className="card group space-y-2 p-5 hover:border-line-strong">
          <IconExam size={26} className="text-accent" />
          <h3 className="font-display text-xl">Exam practice</h3>
          <p className="text-sm text-ink-2">A mixed paper with an optional timer, flags and a full review with worked solutions afterwards.</p>
        </Link>
      </section>

      <section className="mt-14 rounded-2xl border border-line bg-surface-2 p-5 text-sm text-ink-2 sm:p-6">
        <h2 className="font-display text-lg text-ink">Built from the teacher notes, checked by an engine</h2>
        <p className="mt-2 max-w-3xl">
          The lessons follow a 77-page set of bilingual teacher notes for this unit. Every truth table, circuit value and answer check is computed by one tested logic engine. Questions are original practice written for this lab — no past-paper question is reproduced, but questions note the past papers that test the same skill.{' '}
          <Link to="/about" className="font-semibold text-accent underline underline-offset-2">
            Sources and coverage
          </Link>
        </p>
      </section>
    </div>
  );
}
