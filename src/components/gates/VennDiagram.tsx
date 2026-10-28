import { useId } from 'react';
import { evaluateGate } from '@/lib/logic/gates';
import type { Bit, GateType } from '@/lib/logic/types';

/**
 * Venn view of a 2-input gate (N p.12). A region is shaded when the gate outputs 1
 * for that region's inputs — computed by the engine, not drawn by hand.
 */
export function VennDiagram({ gate, a, b, size = 260 }: { gate: GateType; a?: Bit; b?: Bit; size?: number }) {
  const id = useId().replace(/:/g, '');
  const out = (x: Bit, y: Bit) => evaluateGate(gate, gate === 'NOT' || gate === 'BUFFER' ? [x] : [x, y]);
  const regions: { key: string; x: Bit; y: Bit; label: string }[] = [
    { key: 'none', x: 0, y: 0, label: 'neither A nor B' },
    { key: 'a', x: 1, y: 0, label: 'A only' },
    { key: 'b', x: 0, y: 1, label: 'B only' },
    { key: 'ab', x: 1, y: 1, label: 'A and B' },
  ];
  const shaded = regions.filter((r) => out(r.x, r.y) === 1).map((r) => r.label);
  const current = a !== undefined && b !== undefined ? regions.find((r) => r.x === a && r.y === b)?.key : undefined;
  const fill = (x: Bit, y: Bit) => (out(x, y) === 1 ? `url(#hatch-${id})` : 'transparent');
  const W = 220;
  const H = 130;
  const ca = { cx: 85, cy: 65, r: 46 };
  const cb = { cx: 135, cy: 65, r: 46 };
  return (
    <figure className="m-0">
      <svg viewBox={`0 0 ${W} ${H}`} width={size} className="max-w-full" role="img" aria-label={`Venn diagram for ${gate}: shaded regions are ${shaded.join(', ') || 'none'}.`}>
        <defs>
          <pattern id={`hatch-${id}`} width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="7" height="7" fill="var(--hi-soft)" />
            <line x1="0" y1="0" x2="0" y2="7" stroke="var(--hi-strong)" strokeWidth="2.4" />
          </pattern>
          <clipPath id={`ca-${id}`}>
            <circle {...ca} />
          </clipPath>
          <clipPath id={`cb-${id}`}>
            <circle {...cb} />
          </clipPath>
          <mask id={`notA-${id}`}>
            <rect width={W} height={H} fill="white" />
            <circle {...ca} fill="black" />
          </mask>
          <mask id={`notB-${id}`}>
            <rect width={W} height={H} fill="white" />
            <circle {...cb} fill="black" />
          </mask>
        </defs>
        <rect x="1" y="1" width={W - 2} height={H - 2} rx="8" fill="var(--surface)" stroke="var(--line-strong)" />
        <g mask={`url(#notA-${id})`}>
          <rect x="1" y="1" width={W - 2} height={H - 2} rx="8" fill={fill(0, 0)} mask={`url(#notB-${id})`} />
        </g>
        <circle {...ca} fill={fill(1, 0)} mask={`url(#notB-${id})`} />
        <circle {...cb} fill={fill(0, 1)} mask={`url(#notA-${id})`} />
        <circle {...cb} fill={fill(1, 1)} clipPath={`url(#ca-${id})`} />
        <circle {...ca} fill="none" stroke="var(--ink)" strokeWidth="1.8" />
        <circle {...cb} fill="none" stroke="var(--ink)" strokeWidth="1.8" />
        {current === 'none' && <rect x="4" y="4" width={W - 8} height={H - 8} rx="6" fill="none" stroke="var(--accent)" strokeWidth="3" strokeDasharray="6 4" />}
        {current === 'a' && <circle {...ca} fill="none" stroke="var(--accent)" strokeWidth="3" strokeDasharray="6 4" mask={`url(#notB-${id})`} />}
        {current === 'b' && <circle {...cb} fill="none" stroke="var(--accent)" strokeWidth="3" strokeDasharray="6 4" mask={`url(#notA-${id})`} />}
        {current === 'ab' && <circle {...cb} fill="none" stroke="var(--accent)" strokeWidth="3" strokeDasharray="6 4" clipPath={`url(#ca-${id})`} />}
        <text x="58" y="24" fontSize="14" fontWeight="600" fill="var(--ink)" fontFamily="var(--font-display)">A</text>
        <text x="154" y="24" fontSize="14" fontWeight="600" fill="var(--ink)" fontFamily="var(--font-display)">B</text>
      </svg>
      <figcaption className="mt-1 text-xs text-ink-2">
        Shaded (striped) = output 1: {shaded.join(', ') || 'no region'}.{current && ' The dashed outline shows the region for the current inputs.'}
      </figcaption>
    </figure>
  );
}
