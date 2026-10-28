import type { Bit, GateType } from '@/lib/logic/types';
import { gateGeometry } from './geometry';

export function signalStroke(value: Bit | null | undefined): { stroke: string; dash?: string; width: number } {
  if (value === 1) return { stroke: 'var(--hi)', width: 3 };
  if (value === 0) return { stroke: 'var(--lo)', dash: '5 4', width: 2 };
  return { stroke: 'var(--line-strong)', width: 2 };
}

interface GateShapeProps {
  gate: GateType;
  inputs?: number;
  x?: number;
  y?: number;
  inputValues?: (Bit | null)[];
  output?: Bit | null;
  highlight?: boolean;
  dim?: boolean;
  label?: string;
}

/** A gate drawn in SVG user space, including its input and output stubs. */
export function GateShape({ gate, inputs = 2, x = 0, y = 0, inputValues, output, highlight, dim, label }: GateShapeProps) {
  const g = gateGeometry(gate, inputs);
  const outStroke = signalStroke(output);
  return (
    <g transform={`translate(${x} ${y})`} opacity={dim ? 0.45 : 1}>
      {g.inputPins.map((p, i) => {
        const s = signalStroke(inputValues?.[i]);
        const end = g.inputBody[i] ?? p;
        return <line key={i} x1={p.x} y1={p.y} x2={end.x} y2={end.y} stroke={s.stroke} strokeWidth={s.width} strokeDasharray={s.dash} />;
      })}
      <line
        x1={g.bubble ? g.bubble.cx + g.bubble.r : g.outputPin.x - 10}
        y1={g.outputPin.y}
        x2={g.outputPin.x}
        y2={g.outputPin.y}
        stroke={outStroke.stroke}
        strokeWidth={outStroke.width}
        strokeDasharray={outStroke.dash}
      />
      {highlight && <rect x={-4} y={-6} width={g.width + 8} height={g.height + 12} rx={10} fill="var(--accent-soft)" stroke="var(--accent)" strokeWidth={1.5} />}
      <path d={g.body} fill="var(--surface)" stroke="var(--ink)" strokeWidth={2} strokeLinejoin="round" />
      {g.extra && <path d={g.extra} fill="none" stroke="var(--ink)" strokeWidth={2} />}
      {g.bubble && <circle cx={g.bubble.cx} cy={g.bubble.cy} r={g.bubble.r} fill="var(--surface)" stroke="var(--ink)" strokeWidth={2} />}
      {label && (
        <text x={g.width / 2 - 4} y={-5} textAnchor="middle" fontSize={10.5} fontWeight={600} fill="var(--ink-3)" fontFamily="var(--font-mono)">
          {label}
        </text>
      )}
    </g>
  );
}

/** Standalone gate symbol for cards and option lists. */
export function GateIcon({ gate, inputs = 2, size = 72, title }: { gate: GateType; inputs?: number; size?: number; title?: string }) {
  const g = gateGeometry(gate, inputs);
  const pad = 6;
  return (
    <svg
      width={size}
      height={(size * (g.height + pad * 2)) / (g.width + pad * 2)}
      viewBox={`${-pad} ${-pad} ${g.width + pad * 2} ${g.height + pad * 2}`}
      {...(title === '' ? { 'aria-hidden': true } : { role: 'img', 'aria-label': title ?? `${gate} gate symbol` })}
    >
      <GateShape gate={gate} inputs={inputs} />
    </svg>
  );
}
