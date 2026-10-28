import { useMemo, useState } from 'react';
import { ExprView } from '@/components/expr/ExprView';
import { Lamp, SignalToggle } from '@/components/signals';
import { TruthTable } from '@/components/truth-tables/TruthTable';
import { evaluateCircuit } from '@/lib/logic/circuit';
import { gateReason } from '@/lib/logic/explain';
import { indexToBits } from '@/lib/logic/gates';
import { circuitTruthTable } from '@/lib/logic/truthTable';
import type { Bit, Circuit, GateType } from '@/lib/logic/types';
import { GateShape } from './GateSymbol';
import { gateGeometry } from './geometry';
import { VennDiagram } from './VennDiagram';

const NAMES = ['A', 'B', 'C', 'D'];

export function gateExpression(gate: GateType, n: number): string {
  const vars = NAMES.slice(0, n);
  switch (gate) {
    case 'NOT':
      return "A'";
    case 'BUFFER':
      return 'A';
    case 'AND':
      return vars.join('.');
    case 'OR':
      return vars.join(' + ');
    case 'NAND':
      return `(${vars.join('.')})'`;
    case 'NOR':
      return `(${vars.join(' + ')})'`;
    case 'XOR':
      return vars.join(' ⊕ ');
    case 'XNOR':
      return `(${vars.join(' ⊕ ')})'`;
  }
}

export function singleGateCircuit(gate: GateType, n: number): Circuit {
  const count = gate === 'NOT' || gate === 'BUFFER' ? 1 : n;
  const ids = NAMES.slice(0, count);
  return {
    nodes: [
      ...ids.map((id) => ({ kind: 'input' as const, id, label: id })),
      { kind: 'gate', id: 'G', gate, inputs: ids },
      { kind: 'output', id: 'F', label: 'F', source: 'G' },
    ],
  };
}

interface Props {
  gate: GateType;
  /** Allow switching between 2 and 3 inputs. */
  allowThree?: boolean;
  showVenn?: boolean;
  onInteract?: () => void;
}

/** Live single-gate simulator: symbol, expression, lamp and truth table stay in sync via the engine. */
export function GateSimulator({ gate, allowThree = true, showVenn = false, onInteract }: Props) {
  const unary = gate === 'NOT' || gate === 'BUFFER';
  const [n, setN] = useState(unary ? 1 : 2);
  const [bits, setBits] = useState<Bit[]>([0, 0, 0]);
  const circuit = useMemo(() => singleGateCircuit(gate, n), [gate, n]);
  const ids = NAMES.slice(0, unary ? 1 : n);
  const assignment = Object.fromEntries(ids.map((id, k) => [id, bits[k] as Bit]));
  const result = evaluateCircuit(circuit, assignment);
  const table = useMemo(() => circuitTruthTable(circuit), [circuit]);
  if (!result.ok || !table.ok) return null;
  const out = result.outputs.F as Bit;
  const ins = ids.map((_, k) => bits[k] as Bit);
  const row = ins.reduce<number>((a, b) => a * 2 + b, 0);
  const geo = gateGeometry(gate, ids.length);
  const scale = 2.1;
  const expr = gateExpression(gate, ids.length);

  const set = (k: number, v: Bit) => {
    setBits((b) => b.map((x, i) => (i === k ? v : x)) as Bit[]);
    onInteract?.();
  };

  return (
    <div className="card overflow-hidden">
      <div className="grid gap-0 md:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
        <div className="bench-grid flex flex-col gap-4 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2" role="group" aria-label="Inputs">
              {ids.map((id, k) => (
                <SignalToggle key={id} label={id} value={bits[k] as Bit} onChange={(v) => set(k, v)} />
              ))}
            </div>
            {!unary && allowThree && (
              <div className="inline-flex rounded-lg border border-line-strong bg-surface p-0.5 text-sm" role="radiogroup" aria-label="Number of inputs">
                {[2, 3].map((k) => (
                  <button
                    key={k}
                    role="radio"
                    aria-checked={n === k}
                    onClick={() => setN(k)}
                    className={`rounded-md px-3 py-1.5 font-semibold ${n === k ? 'bg-ink text-paper' : 'text-ink-2'}`}
                  >
                    {k} inputs
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center justify-center gap-4 py-2">
            <svg
              viewBox={`-30 -12 ${geo.width + 40} ${geo.height + 24}`}
              width={(geo.width + 40) * scale * 0.8}
              className="max-w-full"
              role="img"
              aria-label={`${gate} gate with inputs ${ids.map((id, k) => `${id} = ${bits[k]}`).join(', ')} and output F = ${out}`}
            >
              {ids.map((id, k) => (
                <text key={id} x={-24} y={(geo.inputPins[k]?.y ?? 0) + 4} fontSize={11} fontWeight={600} fill="var(--ink)" fontFamily="var(--font-display)">
                  {id}
                </text>
              ))}
              <g transform="translate(-12 0)">
                {ids.map((_, k) => (
                  <line key={k} x1={0} x2={12} y1={geo.inputPins[k]?.y} y2={geo.inputPins[k]?.y} stroke={bits[k] === 1 ? 'var(--hi)' : 'var(--lo)'} strokeWidth={bits[k] === 1 ? 3 : 2} strokeDasharray={bits[k] === 1 ? undefined : '5 4'} />
                ))}
              </g>
              <GateShape gate={gate} inputs={ids.length} inputValues={ins} output={out} />
            </svg>
            <Lamp value={out} />
          </div>
          <div className="rounded-xl border border-line bg-surface px-4 py-3">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xl">
              <span className="font-display">F =</span>
              <ExprView expr={expr} />
              <span className="text-ink-3">→</span>
              <span className="font-mono text-base text-ink-2">{ids.map((id, k) => `${id}=${bits[k]}`).join(', ')}</span>
              <span className="text-ink-3">→</span>
              <span className="font-mono font-semibold">F = {out}</span>
            </div>
            <p className="mt-1 text-sm text-ink-2" aria-live="polite">
              {gateReason(gate, ins, out)}
            </p>
          </div>
        </div>
        <div className="border-t border-line p-4 sm:p-5 md:border-l md:border-t-0">
          <div className="mb-2 flex items-baseline justify-between">
            <h4 className="font-display text-lg">Truth table</h4>
            <span className="text-xs text-ink-3">Tap a row to try it</span>
          </div>
          <TruthTable
            compact
            columns={[
              ...ids.map((id) => ({ key: id, header: id, name: id, kind: 'input' as const })),
              { key: 'F', header: 'F', name: 'F', kind: 'output' as const },
            ]}
            rows={table.table.rows.map((r) => ({ icn: r.icn, cells: { ...Object.fromEntries(ids.map((id, k) => [id, r.inputs[k] as Bit])), F: r.outputs[0] as Bit } }))}
            highlight={row}
            onRowSelect={(idx) => {
              const b = indexToBits(idx, ids.length);
              setBits([0, 1, 2].map((k) => (b[k] ?? 0) as Bit));
              onInteract?.();
            }}
          />
          {showVenn && !unary && n === 2 && (
            <div className="mt-4">
              <VennDiagram gate={gate} a={bits[0] as Bit} b={bits[1] as Bit} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
