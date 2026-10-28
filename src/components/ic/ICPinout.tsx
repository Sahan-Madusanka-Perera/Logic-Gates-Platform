import { useState } from 'react';
import { GateIcon } from '@/components/gates/GateSymbol';
import { ScrollRegion } from '@/components/ScrollRegion';
import { Lamp, SignalToggle } from '@/components/signals';
import { evaluateGate } from '@/lib/logic/gates';
import type { Bit, GateType } from '@/lib/logic/types';

export interface ChipGate {
  inputs: number[];
  output: number;
}

export interface Chip {
  id: string;
  family: 'TTL (7400 series)' | 'CMOS (4000 series)';
  gate: GateType;
  description: string;
  gates: ChipGate[];
  power: { vcc: number; gnd: number; vccName: string; gndName: string };
}

const QUAD_A: ChipGate[] = [
  { inputs: [1, 2], output: 3 },
  { inputs: [4, 5], output: 6 },
  { inputs: [9, 10], output: 8 },
  { inputs: [12, 13], output: 11 },
];
const QUAD_NOR_7402: ChipGate[] = [
  { inputs: [2, 3], output: 1 },
  { inputs: [5, 6], output: 4 },
  { inputs: [8, 9], output: 10 },
  { inputs: [11, 12], output: 13 },
];
const QUAD_4000: ChipGate[] = [
  { inputs: [1, 2], output: 3 },
  { inputs: [5, 6], output: 4 },
  { inputs: [8, 9], output: 10 },
  { inputs: [12, 13], output: 11 },
];
const HEX: ChipGate[] = [
  { inputs: [1], output: 2 },
  { inputs: [3], output: 4 },
  { inputs: [5], output: 6 },
  { inputs: [9], output: 8 },
  { inputs: [11], output: 10 },
  { inputs: [13], output: 12 },
];
const TTL = { vcc: 14, gnd: 7, vccName: 'Vcc (+5 V)', gndName: 'GND (0 V)' };
const CMOS = { vcc: 14, gnd: 7, vccName: 'VDD (+3 V to +15 V)', gndName: 'VSS (0 V)' };

/** Standard 14-pin pin-outs (top view, pin 1 next to the notch). */
export const CHIPS: Chip[] = [
  { id: '7400', family: 'TTL (7400 series)', gate: 'NAND', description: 'Quad 2-input NAND', gates: QUAD_A, power: TTL },
  { id: '7402', family: 'TTL (7400 series)', gate: 'NOR', description: 'Quad 2-input NOR (note: outputs on pins 1, 4, 10, 13)', gates: QUAD_NOR_7402, power: TTL },
  { id: '7404', family: 'TTL (7400 series)', gate: 'NOT', description: 'Hex inverter (six NOT gates)', gates: HEX, power: TTL },
  { id: '7408', family: 'TTL (7400 series)', gate: 'AND', description: 'Quad 2-input AND', gates: QUAD_A, power: TTL },
  { id: '7432', family: 'TTL (7400 series)', gate: 'OR', description: 'Quad 2-input OR', gates: QUAD_A, power: TTL },
  { id: '7486', family: 'TTL (7400 series)', gate: 'XOR', description: 'Quad 2-input XOR', gates: QUAD_A, power: TTL },
  { id: 'CD4001', family: 'CMOS (4000 series)', gate: 'NOR', description: 'Quad 2-input NOR', gates: QUAD_4000, power: CMOS },
  { id: 'CD4011', family: 'CMOS (4000 series)', gate: 'NAND', description: 'Quad 2-input NAND', gates: QUAD_4000, power: CMOS },
];

/** Pin position in a top view with the notch on the left: pins 1–7 along the bottom, 8–14 along the top (right to left). */
function pinPos(pin: number) {
  const W = 46;
  if (pin <= 7) return { x: 40 + (pin - 1) * W, y: 150, labelY: 172, side: 'bottom' as const };
  return { x: 40 + (14 - pin) * W, y: 18, labelY: 10, side: 'top' as const };
}

export function ICPinout({ chips = CHIPS.map((c) => c.id), onInteract }: { chips?: string[]; onInteract?: () => void }) {
  const list = CHIPS.filter((c) => chips.includes(c.id));
  const [chipId, setChipId] = useState(list[0]?.id ?? '7400');
  const [gateIdx, setGateIdx] = useState(0);
  const [ins, setIns] = useState<Bit[]>([0, 0]);
  const chip = list.find((c) => c.id === chipId) ?? (list[0] as Chip);
  const g = chip.gates[Math.min(gateIdx, chip.gates.length - 1)] as ChipGate;
  const out = evaluateGate(chip.gate, g.inputs.map((_, k) => ins[k] as Bit));
  const role = (pin: number): { label: string; kind: 'in' | 'out' | 'power' } => {
    if (pin === chip.power.vcc) return { label: chip.power.vccName.split(' ')[0] as string, kind: 'power' };
    if (pin === chip.power.gnd) return { label: chip.power.gndName.split(' ')[0] as string, kind: 'power' };
    const gi = chip.gates.findIndex((x) => x.inputs.includes(pin) || x.output === pin);
    const gate = chip.gates[gi] as ChipGate;
    return gate.output === pin ? { label: `${gi + 1}Y`, kind: 'out' } : { label: `${gi + 1}${'AB'[gate.inputs.indexOf(pin)]}`, kind: 'in' };
  };
  const inGate = (pin: number) => g.inputs.includes(pin) || g.output === pin;

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap gap-1.5 border-b border-line p-3" role="radiogroup" aria-label="Choose an IC">
        {list.map((c) => (
          <button
            key={c.id}
            type="button"
            role="radio"
            aria-checked={c.id === chip.id}
            onClick={() => {
              setChipId(c.id);
              setGateIdx(0);
              setIns([0, 0]);
              onInteract?.();
            }}
            className={`rounded-lg border px-3 py-1.5 font-mono text-sm font-semibold ${c.id === chip.id ? 'border-ink bg-ink text-paper' : 'border-line-strong bg-surface text-ink-2'}`}
          >
            {c.id}
          </button>
        ))}
      </div>
      <div className="space-y-4 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <GateIcon gate={chip.gate} inputs={chip.gate === 'NOT' ? 1 : 2} size={64} />
          <div>
            <p className="font-display text-xl">
              {chip.id}: {chip.description}
            </p>
            <p className="text-sm text-ink-2">
              {chip.family} · pin {chip.power.vcc} = {chip.power.vccName}, pin {chip.power.gnd} = {chip.power.gndName}
            </p>
          </div>
        </div>
        <ScrollRegion label="Pin-out diagram">
          <svg viewBox="0 0 360 182" width={520} className="mx-auto block max-w-none sm:max-w-full" role="img" aria-label={`${chip.id} pin-out. Gate ${gateIdx + 1}: inputs on pins ${g.inputs.join(' and ')}, output on pin ${g.output}.`}>
            <rect x={14} y={30} width={332} height={108} rx={8} fill="var(--ink)" />
            <path d="M14 70 A14 14 0 0 1 14 98" fill="var(--paper)" />
            <circle cx={34} cy={122} r={4} fill="var(--ink-3)" />
            <text x={180} y={90} textAnchor="middle" fontSize={20} fontWeight={700} fill="var(--paper)" fontFamily="var(--font-mono)">
              {chip.id}
            </text>
            {Array.from({ length: 14 }, (_, k) => k + 1).map((pin) => {
              const p = pinPos(pin);
              const r = role(pin);
              const hot = inGate(pin);
              const fill = hot ? 'var(--hi)' : r.kind === 'power' ? 'var(--surface-3)' : 'var(--surface)';
              return (
                <g key={pin}>
                  <rect x={p.x - 9} y={p.side === 'top' ? 18 : 138} width={18} height={14} rx={2} fill={fill} stroke="var(--ink-2)" />
                  <text x={p.x} y={p.side === 'top' ? 44 : 130} textAnchor="middle" fontSize={9.5} fill="var(--paper)" fontFamily="var(--font-mono)">
                    {r.label}
                  </text>
                  <text x={p.x} y={p.labelY} textAnchor="middle" fontSize={11} fontWeight={hot ? 700 : 500} fill="var(--ink)" fontFamily="var(--font-mono)">
                    {pin}
                  </text>
                </g>
              );
            })}
          </svg>
        </ScrollRegion>
        <p className="text-sm text-ink-2">Top view. Pin 1 is next to the notch (and the dot); pins are numbered anticlockwise. Highlighted pins belong to the selected gate.</p>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Choose a gate on the chip">
          {chip.gates.map((x, i) => (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={i === gateIdx}
              onClick={() => {
                setGateIdx(i);
                onInteract?.();
              }}
              className={`rounded-lg border px-2.5 py-1 text-sm font-semibold ${i === gateIdx ? 'border-accent bg-accent-soft text-ink' : 'border-line-strong bg-surface text-ink-2'}`}
            >
              Gate {i + 1}: pins {x.inputs.join(', ')} → {x.output}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface-2 p-3">
          {g.inputs.map((pin, k) => (
            <SignalToggle
              key={pin}
              label={`pin ${pin}`}
              value={ins[k] as Bit}
              onChange={(v) => {
                setIns((xs) => xs.map((x, j) => (j === k ? v : x)) as Bit[]);
                onInteract?.();
              }}
              size="sm"
            />
          ))}
          <span className="text-ink-3">→</span>
          <Lamp value={out} label={`pin ${g.output}`} size={44} />
        </div>
      </div>
    </div>
  );
}
