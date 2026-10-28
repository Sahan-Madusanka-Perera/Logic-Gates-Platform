import { lazy, Suspense, useState } from 'react';
import { NavLink, useParams } from 'react-router';
import { CircuitExplorer } from '@/components/circuits/CircuitExplorer';
import { PRESET_CIRCUITS } from '@/content/circuits';

const CircuitBuilder = lazy(() => import('@/components/builder/CircuitBuilder'));
const ExpressionLab = lazy(() => import('@/components/lab/ExpressionLab'));
const KMapLab = lazy(() => import('@/components/kmap/KMapLab'));

const TOOLS = [
  { id: undefined, to: '/lab', label: 'Circuit explorer', blurb: 'Ready-made circuits to toggle and step through.' },
  { id: 'builder', to: '/lab/builder', label: 'Build a circuit', blurb: 'Place gates, wire them and test them.' },
  { id: 'expression', to: '/lab/expression', label: 'Expression lab', blurb: 'Type an expression: get its table, circuit and simplest form.' },
  { id: 'kmap', to: '/lab/kmap', label: 'K-map lab', blurb: 'Group cells on a Karnaugh map with live rule checks.' },
];

function Explorer() {
  const [presetId, setPresetId] = useState(PRESET_CIRCUITS[0]?.id ?? '');
  const preset = PRESET_CIRCUITS.find((p) => p.id === presetId) ?? PRESET_CIRCUITS[0];
  if (!preset) return null;
  return (
    <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
      <div>
        <label htmlFor="preset" className="mb-1 block text-sm font-semibold lg:hidden">
          Choose a circuit
        </label>
        <select id="preset" className="w-full rounded-lg border border-line-strong bg-surface px-3 py-2.5 lg:hidden" value={presetId} onChange={(e) => setPresetId(e.target.value)}>
          {PRESET_CIRCUITS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>
        <ul className="hidden space-y-1 lg:block" aria-label="Circuits">
          {PRESET_CIRCUITS.map((p) => (
            <li key={p.id}>
              <button
                onClick={() => setPresetId(p.id)}
                aria-current={p.id === presetId}
                className={`w-full rounded-lg px-3 py-2.5 text-left transition-colors ${p.id === presetId ? 'bg-ink text-paper' : 'hover:bg-surface-2'}`}
              >
                <div className="text-sm font-semibold">{p.title}</div>
                <div className={`text-xs ${p.id === presetId ? 'text-paper/75' : 'text-ink-3'}`}>{p.blurb}</div>
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className="min-w-0">
        <p className="mb-3 text-ink-2 lg:hidden">{preset.blurb}</p>
        <CircuitExplorer key={preset.id} circuit={preset.circuit} multi={preset.multi} />
      </div>
    </div>
  );
}

export default function LabPage() {
  const { tool } = useParams();
  const active = TOOLS.find((t) => t.id === tool) ?? TOOLS[0];
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 md:py-10">
      <div className="mb-6 max-w-3xl">
        <div className="eyebrow">Circuit Lab</div>
        <h1 className="mt-1 text-3xl md:text-4xl">A bench for experimenting</h1>
        <p className="mt-2 text-ink-2">Everything here runs on the same tested logic engine as the lessons and questions, so the diagram, the truth table and the answer checker always agree.</p>
        {active && <p className="mt-1 text-sm text-ink-3">{active.blurb}</p>}
      </div>
      <nav aria-label="Lab tools" className="table-scroll -mx-4 mb-6 px-4">
        <ul className="flex min-w-max gap-2">
          {TOOLS.map((t) => (
            <li key={t.to}>
              <NavLink
                to={t.to}
                end
                className={() =>
                  `block rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors ${t === active ? 'border-ink bg-ink text-paper' : 'border-line-strong bg-surface hover:bg-surface-2'}`
                }
              >
                {t.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      {active?.id === undefined && <Explorer />}
      <Suspense fallback={<p className="py-10 text-center text-ink-2">Loading the tool…</p>}>
        {active?.id === 'builder' && <CircuitBuilder />}
        {active?.id === 'expression' && <ExpressionLab />}
        {active?.id === 'kmap' && <KMapLab />}
      </Suspense>
    </div>
  );
}
