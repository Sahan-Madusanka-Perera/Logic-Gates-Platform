import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { RippleAdder } from '@/components/adders/RippleAdder';
import { CircuitExplorer } from '@/components/circuits/CircuitExplorer';
import { GateSimulator } from '@/components/gates/GateSimulator';
import { SwitchCircuit } from '@/components/gates/SwitchCircuit';
import { ICPinout } from '@/components/ic/ICPinout';
import { IconArrowRight, IconCheck, IconHint, IconWarn } from '@/components/icons';
import { KMapTrainer } from '@/components/kmap/KMapTrainer';
import { PeelTutor } from '@/components/lab/PeelTutor';
import { SimplifyChecker } from '@/components/lab/SimplifyChecker';
import { LatchSimulator } from '@/components/latch/LatchSimulator';
import { FigureView } from '@/components/questions/FigureView';
import { QuestionCard } from '@/components/questions/QuestionCard';
import { RichInline, RichText } from '@/components/RichText';
import { circuitFromExpr, PRESET_CIRCUITS } from '@/content/circuits';
import type { ModuleId } from '@/content/curriculum';
import type { LessonBlock } from '@/content/lessons';
import { MISCONCEPTIONS } from '@/content/misconceptions';
import { questionById } from '@/data/questions';
import { outputsOf, parseExpression } from '@/lib/logic/expression';
import type { Bit } from '@/lib/logic/types';
import { recordActivity } from '@/lib/progress/store';

const TONES = {
  tip: { cls: 'border-ok bg-ok-soft', label: 'Tip' },
  warn: { cls: 'border-hi-strong bg-hi-soft', label: 'Watch out' },
  exam: { cls: 'border-info bg-info-soft', label: 'Exam focus' },
  note: { cls: 'border-line-strong bg-surface-2', label: 'Note' },
} as const;

function QuizBlock({ module, id, title, questions }: { module: ModuleId; id: string; title?: string; questions: string[] }) {
  const qs = useMemo(() => questions.map((q) => questionById(q)).filter((q) => q !== undefined), [questions]);
  const [index, setIndex] = useState(0);
  const [finished, setFinished] = useState(false);
  const [correct, setCorrect] = useState(0);
  const q = qs[index];
  return (
    <section className="space-y-3" aria-label={title ?? 'Check your understanding'}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="flex items-center gap-2 font-display text-lg">
          <IconHint size={18} className="text-accent" /> {title ?? 'Check your understanding'}
        </h4>
        <span className="text-sm text-ink-3">
          {finished ? `${correct} of ${qs.length} right first time` : `Question ${index + 1} of ${qs.length}`}
        </span>
      </div>
      {finished ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface p-4">
          <IconCheck size={20} className="text-ok" />
          <span>
            Done — {correct} of {qs.length} right first time.
          </span>
          <button
            type="button"
            className="btn btn-secondary btn-sm ml-auto"
            onClick={() => {
              setIndex(0);
              setCorrect(0);
              setFinished(false);
            }}
          >
            Try these again
          </button>
        </div>
      ) : (
        q && (
          <QuestionCard
            key={`${id}-${index}-${q.id}`}
            question={q}
            mode="lesson"
            seed={id}
            onRecorded={(o) => {
              if (o.correct) setCorrect((c) => c + 1);
              recordActivity(module, id);
            }}
            nextLabel={index + 1 < qs.length ? 'Next question' : 'Finish'}
            onNext={() => (index + 1 < qs.length ? setIndex(index + 1) : setFinished(true))}
          />
        )
      )}
    </section>
  );
}

function WorkedBlock({ module, id, title, steps, multi }: { module: ModuleId; id: string; title: string; steps: string[]; multi?: string[] }) {
  const [shown, setShown] = useState(1);
  return (
    <div className="card space-y-3 p-4 sm:p-5">
      <p className="eyebrow">Worked example</p>
      <h4 className="font-display text-lg">
        <RichInline text={title} multi={multi} />
      </h4>
      <ol className="space-y-2">
        {steps.slice(0, shown).map((s, i) => (
          <li key={i} className="flex gap-3">
            <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-soft font-mono text-xs font-bold text-accent">{i + 1}</span>
            <span className="min-w-0">
              <RichInline text={s} multi={multi} />
            </span>
          </li>
        ))}
      </ol>
      {shown < steps.length && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setShown((n) => n + 1);
              recordActivity(module, id);
            }}
          >
            Next step <IconArrowRight size={16} />
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              setShown(steps.length);
              recordActivity(module, id);
            }}
          >
            Show all steps
          </button>
        </div>
      )}
    </div>
  );
}

function KMapBlock({ module, id, expr, variables, group }: { module: ModuleId; id: string; expr: string; variables: string[]; group?: 1 | 0 }) {
  const values = useMemo(() => outputsOf(parseExpression(expr), variables) as Bit[], [expr, variables]);
  return <KMapTrainer variables={variables} values={values} initialKind={group ?? 1} onInteract={() => recordActivity(module, id)} />;
}

export function MisconceptionCatalogue() {
  return (
    <div className="space-y-4">
      {MISCONCEPTIONS.map((m) => (
        <article key={m.id} id={m.id} className="card scroll-mt-24 space-y-3 p-4 sm:p-5">
          <h3 className="flex items-start gap-2 font-display text-xl">
            <IconWarn size={20} className="mt-1 shrink-0 text-hi-strong" /> {m.title}
          </h3>
          <dl className="grid gap-3 text-[0.95rem] sm:grid-cols-2">
            <div className="rounded-xl border border-bad bg-bad-soft p-3">
              <dt className="text-sm font-semibold text-bad">The mistake</dt>
              <dd className="mt-1">
                <RichInline text={m.wrong} />
              </dd>
            </div>
            <div className="rounded-xl border border-line bg-surface-2 p-3">
              <dt className="text-sm font-semibold text-ink-2">Why it seems right</dt>
              <dd className="mt-1">
                <RichInline text={m.plausible} />
              </dd>
            </div>
            <div className="rounded-xl border border-line bg-surface-2 p-3">
              <dt className="text-sm font-semibold text-ink-2">Why it is wrong</dt>
              <dd className="mt-1">
                <RichInline text={m.problem} />
              </dd>
            </div>
            <div className="rounded-xl border border-ok bg-ok-soft p-3">
              <dt className="text-sm font-semibold text-ok">The fix</dt>
              <dd className="mt-1">
                <RichInline text={m.correct} />
              </dd>
            </div>
          </dl>
          <div className="flex flex-wrap gap-2">
            <Link to={`/practice/session?misconception=${m.id}`} className="btn btn-primary btn-sm">
              Practise this ({m.exercises.length} question{m.exercises.length === 1 ? '' : 's'})
            </Link>
            <Link to={`/learn/${m.lesson}`} className="btn btn-ghost btn-sm">
              Revise the lesson
            </Link>
          </div>
        </article>
      ))}
    </div>
  );
}

/** Renders one lesson block. Interactive blocks record a lesson activity when used. */
export function BlockView({ block: b, module, multi }: { block: LessonBlock; module: ModuleId; multi?: string[] }) {
  const touch = useCallback((id: string) => () => recordActivity(module, id), [module]);
  switch (b.kind) {
    case 'text':
      return <RichText text={b.md} multi={multi} />;
    case 'callout': {
      const t = TONES[b.tone];
      return (
        <aside className={`rounded-xl border-l-4 border p-4 ${t.cls}`}>
          <p className="text-sm font-semibold">
            {t.label}: {b.title}
          </p>
          <RichText text={b.md} multi={multi} className="mt-1 text-[0.95rem]" />
        </aside>
      );
    }
    case 'figure':
      return (
        <figure className="m-0 space-y-2">
          <FigureView figure={b.figure} multi={multi} />
          {b.caption && (
            <figcaption className="text-sm text-ink-2">
              <RichInline text={b.caption} multi={multi} />
            </figcaption>
          )}
        </figure>
      );
    case 'gate-sim':
      return <GateSimulator gate={b.gate} showVenn={b.venn} allowThree={b.allowThree ?? true} onInteract={touch(b.id)} />;
    case 'switch':
      return <SwitchCircuit net={b.net} lamp={b.lamp} caption={b.caption} onInteract={touch(b.id)} />;
    case 'explorer': {
      const preset = b.preset ? PRESET_CIRCUITS.find((p) => p.id === b.preset) : undefined;
      const m = b.multi ?? preset?.multi;
      const circuit = preset?.circuit ?? circuitFromExpr(b.expr ?? 'A', { fuseNegations: b.fuse, multi: m });
      return (
        <div className="space-y-2">
          {preset && (
            <p className="text-sm text-ink-2">
              <span className="font-semibold text-ink">{preset.title}.</span> {preset.blurb}
            </p>
          )}
          <CircuitExplorer circuit={circuit} multi={m} showGateColumns={b.showGateColumns ?? true} onInteract={touch(b.id)} />
        </div>
      );
    }
    case 'quiz':
      return <QuizBlock module={module} id={b.id} title={b.title} questions={b.questions} />;
    case 'worked':
      return <WorkedBlock module={module} id={b.id} title={b.title} steps={b.steps} multi={multi} />;
    case 'peel':
      return <PeelTutor expr={b.expr} onInteract={touch(b.id)} />;
    case 'simplify':
      return <SimplifyChecker start={b.start} worked={b.worked} onInteract={touch(b.id)} />;
    case 'kmap':
      return <KMapBlock module={module} id={b.id} expr={b.expr} variables={b.variables} group={b.group} />;
    case 'latch':
      return <LatchSimulator kind={b.latch} onInteract={touch(b.id)} />;
    case 'ripple':
      return <RippleAdder bits={b.bits} onInteract={touch(b.id)} />;
    case 'ic':
      return <ICPinout chips={b.chips} onInteract={touch(b.id)} />;
    case 'misconceptions':
      return <MisconceptionCatalogue />;
  }
}
