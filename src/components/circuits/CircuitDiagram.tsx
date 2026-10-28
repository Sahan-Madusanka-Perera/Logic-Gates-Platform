import { useMemo, useRef } from 'react';
import { GateShape, signalStroke } from '@/components/gates/GateSymbol';
import { circuitToExpr } from '@/lib/logic/convert';
import { toText } from '@/lib/logic/expression';
import type { Bit, Circuit } from '@/lib/logic/types';
import { useScrollable } from '@/components/useScrollable';
import { layoutCircuit } from './layout';

interface Props {
  circuit: Circuit;
  /** Value of every node (from the engine). Omit to draw a neutral diagram. */
  values?: Record<string, Bit | undefined>;
  /** Nodes whose values should be shown (step mode). Defaults to all. */
  known?: Set<string>;
  highlight?: string | null;
  showGateLabels?: boolean;
  showValues?: boolean;
  /** Scale relative to natural size; the diagram never shrinks below minScale of its width on small screens. */
  minScale?: number;
  title?: string;
  className?: string;
  animate?: boolean;
}

function ValueBadge({ x, y, value }: { x: number; y: number; value: Bit }) {
  const on = value === 1;
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x={-9} y={-9} width={18} height={18} rx={5} fill={on ? 'var(--hi)' : 'var(--surface)'} stroke={on ? 'var(--hi-strong)' : 'var(--lo)'} strokeWidth={1.5} />
      <text x={0} y={4.5} textAnchor="middle" fontSize={12} fontWeight={700} fontFamily="var(--font-mono)" fill={on ? '#1d1400' : 'var(--lo-ink)'}>
        {value}
      </text>
    </g>
  );
}

/** Read-only circuit diagram with live signal values. All values come from the engine. */
export function CircuitDiagram({ circuit, values, known, highlight, showGateLabels = true, showValues = true, minScale = 0.85, title, className, animate = true }: Props) {
  const layout = useMemo(() => layoutCircuit(circuit), [circuit]);
  const description = useMemo(() => {
    try {
      return `Circuit diagram. Output ${circuit.nodes.find((n) => n.kind === 'output')?.label ?? ''} = ${toText(circuitToExpr(circuit))}.`;
    } catch {
      return 'Circuit diagram.';
    }
  }, [circuit]);
  const v = (id: string): Bit | undefined => (known && !known.has(id) ? undefined : values?.[id]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollable = useScrollable(scrollRef);

  return (
    <div ref={scrollRef} tabIndex={scrollable ? 0 : undefined} aria-label={scrollable ? 'Circuit diagram, scrolls sideways' : undefined} role={scrollable ? 'region' : undefined} className={`table-scroll ${className ?? ''}`}>
      <svg
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        width="100%"
        style={{ minWidth: Math.min(layout.width * minScale, 900), maxWidth: layout.width * 1.5, display: 'block', margin: '0 auto' }}
        role="img"
        aria-label={title ?? description}
      >
        {layout.rails.map((r) => {
          const s = signalStroke(v(r.id));
          return (
            <g key={r.id}>
              <line x1={r.x} y1={r.y1 + 12} x2={r.x} y2={r.y2} stroke={s.stroke} strokeWidth={s.width} strokeDasharray={s.dash} />
              <text x={r.x} y={r.y1 - 2} textAnchor="middle" fontSize={15} fontWeight={600} fill="var(--ink)" fontFamily="var(--font-display)">
                {r.label}
              </text>
              <circle cx={r.x} cy={r.y1 + 10} r={3} fill="var(--ink)" />
            </g>
          );
        })}
        {layout.nets.map((net) => {
          const value = v(net.source);
          const s = signalStroke(value);
          return (
            <g key={net.source}>
              {net.segments.map((seg, i) => (
                <line
                  key={i}
                  x1={seg.x1}
                  y1={seg.y1}
                  x2={seg.x2}
                  y2={seg.y2}
                  stroke={s.stroke}
                  strokeWidth={s.width}
                  strokeDasharray={s.dash}
                  strokeLinecap="round"
                  className={animate && value === 1 ? 'wire-hi-flow' : undefined}
                />
              ))}
              {net.junctions.map((j, i) => (
                <circle key={`j${i}`} cx={j.x} cy={j.y} r={3.5} fill={value === 1 ? 'var(--hi-strong)' : 'var(--ink-2)'} />
              ))}
            </g>
          );
        })}
        {layout.gates.map((pg) => (
          <GateShape
            key={pg.node.id}
            gate={pg.node.gate}
            inputs={pg.node.inputs.length}
            x={pg.x}
            y={pg.y}
            inputValues={pg.node.inputs.map((s) => (s ? (v(s) ?? null) : null))}
            output={v(pg.node.id) ?? null}
            highlight={highlight === pg.node.id}
            label={showGateLabels ? (pg.node.label ?? pg.node.id) : undefined}
          />
        ))}
        {showValues &&
          layout.gates.map((pg) => {
            const value = v(pg.node.id);
            if (value === undefined) return null;
            return <ValueBadge key={`b${pg.node.id}`} x={pg.x + pg.geo.outputPin.x + 2} y={pg.y + pg.geo.outputPin.y - 14} value={value} />;
          })}
        {layout.outputs.map((o) => {
          const value = v(o.id) ?? (o.source ? v(o.source) : undefined);
          return (
            <g key={o.id}>
              <circle cx={o.x} cy={o.y} r={4} fill="var(--surface)" stroke="var(--ink)" strokeWidth={2} />
              <text x={o.x + 10} y={o.y + 5} fontSize={15} fontWeight={600} fill="var(--ink)" fontFamily="var(--font-display)">
                {o.label}
              </text>
              {showValues && value !== undefined && <ValueBadge x={o.x + 34} y={o.y} value={value} />}
            </g>
          );
        })}
        {showValues &&
          layout.rails.map((r) => {
            const value = v(r.id);
            return value === undefined ? null : <ValueBadge key={`rb${r.id}`} x={r.x + 13} y={r.y1 + 10} value={value} />;
          })}
      </svg>
    </div>
  );
}
