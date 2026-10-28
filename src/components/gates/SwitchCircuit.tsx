import { type ReactNode, useState } from 'react';
import { ScrollRegion } from '@/components/ScrollRegion';
import { Lamp, SignalToggle } from '@/components/signals';
import { conducts, type ContactNet, lampState } from '@/lib/logic/switches';
import type { Bit } from '@/lib/logic/types';

interface Box {
  w: number;
  h: number;
  /** y of the left/right terminals inside the box. */
  ty: number;
  draw: (x: number, y: number, positions: Record<string, Bit> | null) => ReactNode;
}

const CW = 74;
const CH = 40;

function contactBox(net: Extract<ContactNet, { type: 'contact' }>): Box {
  return {
    w: CW,
    h: CH,
    ty: CH / 2,
    draw: (x, y, pos) => {
      // pos = null draws each contact in its rest position, without state labels (question figures).
      const closed = pos ? pos[net.switch] === net.closedWhen : net.closedWhen === 0;
      const ty = y + CH / 2;
      const left = x + 16;
      const right = x + CW - 16;
      const pin = net.closedWhen === 1 ? '' : '′';
      return (
        <g key={`${x},${y}`}>
          <line x1={x} y1={ty} x2={left} y2={ty} stroke="var(--ink)" strokeWidth={2} />
          <line x1={right} y1={ty} x2={x + CW} y2={ty} stroke="var(--ink)" strokeWidth={2} />
          <circle cx={left} cy={ty} r={3} fill="var(--ink)" />
          <circle cx={right} cy={ty} r={3} fill="var(--surface)" stroke="var(--ink)" strokeWidth={2} />
          <line x1={left} y1={ty} x2={closed ? right : right - 6} y2={closed ? ty : ty - 16} stroke={closed ? 'var(--ok)' : 'var(--ink-2)'} strokeWidth={3} strokeLinecap="round" />
          <text x={x + CW / 2} y={ty + 18} textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--ink-2)" fontFamily="var(--font-mono)">
            {net.switch}
            {pin}
            {pos ? (closed ? ' closed' : ' open') : ''}
          </text>
        </g>
      );
    },
  };
}

function boxFor(net: ContactNet): Box {
  if (net.type === 'contact') return contactBox(net);
  const kids = net.parts.map(boxFor);
  if (net.type === 'series') {
    const ty = Math.max(...kids.map((k) => k.ty));
    const h = Math.max(...kids.map((k) => k.h - k.ty)) + ty;
    return {
      w: kids.reduce((s, k) => s + k.w, 0),
      h,
      ty,
      draw: (x, y, pos) => {
        let cx = x;
        return (
          <g key={`s${x},${y}`}>
            {kids.map((k) => {
              const el = k.draw(cx, y + ty - k.ty, pos);
              cx += k.w;
              return el;
            })}
          </g>
        );
      },
    };
  }
  const gap = 8;
  const bus = 14;
  const w = Math.max(...kids.map((k) => k.w)) + bus * 2;
  const h = kids.reduce((s, k) => s + k.h, 0) + gap * (kids.length - 1);
  const ty = kids[0]?.ty ?? 0;
  return {
    w,
    h,
    ty,
    draw: (x, y, pos) => {
      let cy = y;
      const centers: number[] = [];
      const parts = kids.map((k) => {
        const top = cy;
        centers.push(top + k.ty);
        cy += k.h + gap;
        const inner = w - bus * 2;
        return (
          <g key={`p${top}`}>
            {k.draw(x + bus + (inner - k.w) / 2, top, pos)}
            <line x1={x} y1={top + k.ty} x2={x + bus + (inner - k.w) / 2} y2={top + k.ty} stroke="var(--ink)" strokeWidth={2} />
            <line x1={x + bus + (inner + k.w) / 2} y1={top + k.ty} x2={x + w} y2={top + k.ty} stroke="var(--ink)" strokeWidth={2} />
          </g>
        );
      });
      return (
        <g key={`par${x},${y}`}>
          <line x1={x} y1={centers[0]} x2={x} y2={centers[centers.length - 1]} stroke="var(--ink)" strokeWidth={2} />
          <line x1={x + w} y1={centers[0]} x2={x + w} y2={centers[centers.length - 1]} stroke="var(--ink)" strokeWidth={2} />
          {parts}
        </g>
      );
    },
  };
}

function switchNames(net: ContactNet): string[] {
  if (net.type === 'contact') return [net.switch];
  return [...new Set(net.parts.flatMap(switchNames))].sort();
}

/**
 * A battery–switch–bulb circuit (N p.18–19). Switch position 1 = pressed/up,
 * 0 = released/down. The lamp state is computed by the switch-network model.
 */
export function SwitchCircuit({
  net,
  lamp,
  onInteract,
  caption,
  interactive = true,
}: {
  net: ContactNet;
  lamp: 'series' | 'shunt';
  onInteract?: () => void;
  caption?: string;
  /** false: a static figure with no switches to press and no lamp state. */
  interactive?: boolean;
}) {
  const names = switchNames(net);
  const [pos, setPos] = useState<Record<string, Bit>>(() => Object.fromEntries(names.map((n) => [n, 0 as Bit])));
  const box = boxFor(net);
  const on = interactive ? lampState({ lamp, net }, pos) : 0;
  const flow = interactive && conducts(net, pos) === 1;
  const hot = 'var(--hi)';
  const cold = 'var(--ink-2)';

  const pad = 24;
  const top = 26;
  const netX = lamp === 'series' ? 70 : 150;
  const netY = lamp === 'series' ? top - box.ty : top + 44;
  const W = netX + box.w + 90;
  const bottom = Math.max(netY + box.h + 30, top + 120);
  const lampX = W - 40;
  const loopLit = lamp === 'series' ? on === 1 : interactive;
  const lampLit = on === 1;
  const rungLit = lamp === 'shunt' && flow;

  return (
    <div className="card overflow-hidden">
      {interactive && (
      <div className="flex flex-wrap gap-2 border-b border-line p-3">
        {names.map((n) => (
          <SignalToggle
            key={n}
            label={n}
            value={pos[n] as Bit}
            onChange={(v) => {
              setPos((p) => ({ ...p, [n]: v }));
              onInteract?.();
            }}
            size="sm"
          />
        ))}
      </div>
      )}
      <div className="flex flex-wrap items-center justify-center gap-4 p-4">
        <ScrollRegion label="Switch circuit">
          <svg viewBox={`0 0 ${W} ${bottom + pad}`} width={Math.min(W * 1.15, 560)} style={{ minWidth: W * 0.8 }} role="img" aria-label={interactive ? `Switch circuit. Lamp is ${lampLit ? 'on' : 'off'}.` : `Switch circuit with switches ${names.join(', ')} and a bulb${lamp === 'shunt' ? ' (switches wired across the bulb, with a resistor)' : ''}.`}>
            {/* battery */}
            <line x1={20} y1={top} x2={20} y2={(top + bottom) / 2 - 10} stroke={loopLit ? hot : cold} strokeWidth={2.5} />
            <line x1={8} y1={(top + bottom) / 2 - 10} x2={32} y2={(top + bottom) / 2 - 10} stroke="var(--ink)" strokeWidth={3} />
            <line x1={13} y1={(top + bottom) / 2} x2={27} y2={(top + bottom) / 2} stroke="var(--ink)" strokeWidth={5} />
            <line x1={20} y1={(top + bottom) / 2} x2={20} y2={bottom} stroke={loopLit ? hot : cold} strokeWidth={2.5} />
            <text x={36} y={(top + bottom) / 2 - 2} fontSize={10} fill="var(--ink-3)">battery</text>
            {lamp === 'series' ? (
              <>
                <line x1={20} y1={top} x2={netX} y2={top} stroke={loopLit ? hot : cold} strokeWidth={2.5} />
                {box.draw(netX, netY, interactive ? pos : null)}
                <line x1={netX + box.w} y1={top} x2={lampX} y2={top} stroke={loopLit ? hot : cold} strokeWidth={2.5} />
              </>
            ) : (
              <>
                <line x1={20} y1={top} x2={60} y2={top} stroke={loopLit ? hot : cold} strokeWidth={2.5} />
                <rect x={60} y={top - 7} width={40} height={14} rx={2} fill="var(--surface)" stroke="var(--ink)" strokeWidth={2} />
                <text x={80} y={top - 12} textAnchor="middle" fontSize={10} fill="var(--ink-3)">resistor</text>
                <line x1={100} y1={top} x2={lampX} y2={top} stroke={loopLit ? hot : cold} strokeWidth={2.5} />
                <line x1={130} y1={top} x2={130} y2={netY + box.ty} stroke={rungLit ? hot : cold} strokeWidth={2.5} />
                <line x1={130} y1={netY + box.ty} x2={netX} y2={netY + box.ty} stroke={rungLit ? hot : cold} strokeWidth={2.5} />
                {box.draw(netX, netY, interactive ? pos : null)}
                <line x1={netX + box.w} y1={netY + box.ty} x2={netX + box.w + 20} y2={netY + box.ty} stroke={rungLit ? hot : cold} strokeWidth={2.5} />
                <line x1={netX + box.w + 20} y1={netY + box.ty} x2={netX + box.w + 20} y2={bottom} stroke={rungLit ? hot : cold} strokeWidth={2.5} />
                <circle cx={130} cy={top} r={3.5} fill="var(--ink)" />
                <circle cx={netX + box.w + 20} cy={bottom} r={3.5} fill="var(--ink)" />
              </>
            )}
            {/* lamp branch */}
            <line x1={lampX} y1={top} x2={lampX} y2={(top + bottom) / 2 - 14} stroke={lampLit ? hot : cold} strokeWidth={2.5} />
            <circle cx={lampX} cy={(top + bottom) / 2} r={14} fill={lampLit ? 'var(--hi)' : 'var(--surface-2)'} stroke="var(--ink)" strokeWidth={2} className={lampLit ? 'lamp-on' : undefined} />
            <path d={`M${lampX - 9} ${(top + bottom) / 2 - 9} L${lampX + 9} ${(top + bottom) / 2 + 9} M${lampX + 9} ${(top + bottom) / 2 - 9} L${lampX - 9} ${(top + bottom) / 2 + 9}`} stroke="var(--ink)" strokeWidth={2} />
            <line x1={lampX} y1={(top + bottom) / 2 + 14} x2={lampX} y2={bottom} stroke={lampLit ? hot : cold} strokeWidth={2.5} />
            <line x1={20} y1={bottom} x2={lampX} y2={bottom} stroke={loopLit ? hot : cold} strokeWidth={2.5} />
          </svg>
        </ScrollRegion>
        {interactive && <Lamp value={on} label="Bulb" size={52} />}
      </div>
      {caption && <p className="border-t border-line px-4 py-2 text-sm text-ink-2">{caption}</p>}
    </div>
  );
}
