import type { GateType, Point } from '@/lib/logic/types';

export const PIN_SPACING = 18;
export const BODY_W = 52;
const BUBBLE_R = 4.5;
const PIN_STUB = 10;

export interface GateGeometry {
  width: number;
  height: number;
  /** Outline path(s) in local coordinates (origin top-left of the gate box). */
  body: string;
  /** Extra back curve of XOR/XNOR. */
  extra?: string;
  bubble?: { cx: number; cy: number; r: number };
  /** Where each input wire ends (left of the body). */
  inputPins: Point[];
  /** Where each input stub meets the body. */
  inputBody: Point[];
  outputPin: Point;
}

function bodyHeight(n: number): number {
  return Math.max(36, n * PIN_SPACING + 6);
}

function pinYs(n: number, h: number): number[] {
  if (n === 1) return [h / 2];
  const span = (n - 1) * PIN_SPACING;
  const start = (h - span) / 2;
  return Array.from({ length: n }, (_, i) => start + i * PIN_SPACING);
}

/** Distinctive-shape (ANSI) gate symbols, as used in the notes. */
export function gateGeometry(gate: GateType, nInputs: number): GateGeometry {
  const n = gate === 'NOT' || gate === 'BUFFER' ? 1 : Math.max(2, nInputs);
  const h = bodyHeight(n);
  const x0 = PIN_STUB; // body starts after the input stubs
  const W = BODY_W;
  const ys = pinYs(n, h);
  const inverted = gate === 'NOT' || gate === 'NAND' || gate === 'NOR' || gate === 'XNOR';
  let body = '';
  let extra: string | undefined;
  let bodyRight = x0 + W;
  let backX: (y: number) => number = () => x0;

  switch (gate) {
    case 'AND':
    case 'NAND': {
      const r = h / 2;
      body = `M${x0} 0 H${x0 + W - r} A${r} ${r} 0 0 1 ${x0 + W - r} ${h} H${x0} Z`;
      break;
    }
    case 'OR':
    case 'NOR':
    case 'XOR':
    case 'XNOR': {
      const bulge = W * 0.22;
      body = `M${x0} 0 Q${x0 + W * 0.55} 0 ${x0 + W} ${h / 2} Q${x0 + W * 0.55} ${h} ${x0} ${h} Q${x0 + bulge} ${h / 2} ${x0} 0 Z`;
      // Point on the concave back: quadratic from (x0,h) via (x0+bulge,h/2) to (x0,0).
      backX = (y: number) => {
        const t = 1 - y / h;
        return x0 + 2 * t * (1 - t) * bulge;
      };
      if (gate === 'XOR' || gate === 'XNOR') {
        const off = 7;
        extra = `M${x0 - off} ${h} Q${x0 - off + bulge} ${h / 2} ${x0 - off} 0`;
        const inner = backX;
        backX = (y: number) => inner(y) - off;
      }
      break;
    }
    case 'NOT':
    case 'BUFFER': {
      const tw = W - 12;
      body = `M${x0} 2 L${x0 + tw} ${h / 2} L${x0} ${h - 2} Z`;
      bodyRight = x0 + tw;
      break;
    }
  }
  const bubble = inverted ? { cx: bodyRight + BUBBLE_R, cy: h / 2, r: BUBBLE_R } : undefined;
  const outX = bodyRight + (inverted ? BUBBLE_R * 2 : 0) + PIN_STUB;
  return {
    width: outX,
    height: h,
    body,
    extra,
    bubble,
    inputPins: ys.map((y) => ({ x: 0, y })),
    inputBody: ys.map((y) => ({ x: backX(y), y })),
    outputPin: { x: outX, y: h / 2 },
  };
}
