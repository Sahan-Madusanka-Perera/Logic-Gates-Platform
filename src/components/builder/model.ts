import { gateGeometry } from '@/components/gates/geometry';
import { isGateType } from '@/lib/logic/gates';
import type { Circuit, CircuitNode, GateNode, GateType, Point } from '@/lib/logic/types';

/** Pure editing operations for the circuit builder. Every function returns a new circuit. */

export const CANVAS_W = 800;
export const MIN_CANVAS_H = 440;
export const TERM_W = 64;
export const TERM_H = 36;
export const GRID = 10;

const snap = (n: number) => Math.round(n / GRID) * GRID;

export type PlaceKind = 'input' | 'output' | GateType;

export function emptyCircuit(): Circuit {
  return {
    nodes: [
      { kind: 'input', id: 'in1', label: 'A' },
      { kind: 'input', id: 'in2', label: 'B' },
      { kind: 'output', id: 'out1', label: 'F', source: null },
    ],
    layout: { in1: { x: 30, y: 60 }, in2: { x: 30, y: 160 }, out1: { x: 690, y: 110 } },
  };
}

export function challengeCircuit(inputs: string[], outputs: string[]): Circuit {
  const nodes: CircuitNode[] = [
    ...inputs.map((label, i): CircuitNode => ({ kind: 'input', id: `in${i + 1}`, label })),
    ...outputs.map((label, i): CircuitNode => ({ kind: 'output', id: `out${i + 1}`, label, source: null })),
  ];
  const layout: Record<string, Point> = {};
  inputs.forEach((_, i) => (layout[`in${i + 1}`] = { x: 30, y: 50 + i * 100 }));
  outputs.forEach((_, i) => (layout[`out${i + 1}`] = { x: 690, y: 80 + i * 140 }));
  return { nodes, layout };
}

export function nodeSize(node: CircuitNode): { w: number; h: number } {
  if (node.kind === 'gate') {
    const g = gateGeometry(node.gate, node.inputs.length);
    return { w: g.width, h: g.height };
  }
  return { w: TERM_W, h: TERM_H };
}

export function posOf(c: Circuit, id: string): Point {
  return c.layout?.[id] ?? { x: 0, y: 0 };
}

/** Where a wire leaves this node. */
export function outPort(c: Circuit, node: CircuitNode): Point {
  const p = posOf(c, node.id);
  if (node.kind === 'gate') {
    const g = gateGeometry(node.gate, node.inputs.length);
    return { x: p.x + g.outputPin.x, y: p.y + g.outputPin.y };
  }
  return { x: p.x + TERM_W, y: p.y + TERM_H / 2 };
}

/** Where wires arrive at this node, one point per input pin. */
export function inPorts(c: Circuit, node: CircuitNode): Point[] {
  const p = posOf(c, node.id);
  if (node.kind === 'gate') {
    const g = gateGeometry(node.gate, node.inputs.length);
    return g.inputPins.map((q) => ({ x: p.x + q.x, y: p.y + q.y }));
  }
  if (node.kind === 'output') return [{ x: p.x, y: p.y + TERM_H / 2 }];
  return [];
}

export function canvasHeight(c: Circuit): number {
  const bottoms = c.nodes.map((n) => posOf(c, n.id).y + nodeSize(n).h);
  return Math.max(MIN_CANVAS_H, ...bottoms.map((b) => b + 60));
}

function nextNumber(c: Circuit, prefix: string): number {
  const used = c.nodes.map((n) => (n.id.startsWith(prefix) ? Number(n.id.slice(prefix.length)) : 0)).filter(Number.isFinite);
  return Math.max(0, ...used) + 1;
}

const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'.split('');
const OUT_LETTERS = ['F', 'G', 'H', 'P', 'Q', 'X', 'Y', 'Z'];

function freeLabel(c: Circuit, pool: string[]): string {
  const used = new Set(c.nodes.flatMap((n) => (n.kind === 'input' || n.kind === 'output' ? [n.label] : [])));
  return pool.find((l) => !used.has(l)) ?? `X${c.nodes.length}`;
}

/** First grid slot in the right column band that is not too close to another component. */
function freeSpot(c: Circuit, kind: PlaceKind): Point {
  const xs = kind === 'input' ? [30] : kind === 'output' ? [690] : [180, 320, 460, 560];
  const taken = c.nodes.map((n) => posOf(c, n.id));
  for (let y = 40; y < 2000; y += 70) {
    for (const x of xs) {
      if (taken.every((t) => Math.abs(t.x - x) > 90 || Math.abs(t.y - y) > 60)) return { x, y };
    }
  }
  return { x: xs[0] as number, y: 40 };
}

export function addNode(c: Circuit, kind: PlaceKind): { circuit: Circuit; id: string } {
  let node: CircuitNode;
  if (kind === 'input') node = { kind: 'input', id: `in${nextNumber(c, 'in')}`, label: freeLabel(c, LETTERS) };
  else if (kind === 'output') node = { kind: 'output', id: `out${nextNumber(c, 'out')}`, label: freeLabel(c, OUT_LETTERS), source: null };
  else {
    const n = nextNumber(c, 'g');
    node = { kind: 'gate', id: `g${n}`, gate: kind, inputs: kind === 'NOT' || kind === 'BUFFER' ? [null] : [null, null], label: `G${n}` };
  }
  return { circuit: { nodes: [...c.nodes, node], layout: { ...c.layout, [node.id]: freeSpot(c, kind) } }, id: node.id };
}

export function removeNode(c: Circuit, id: string): Circuit {
  const layout = { ...c.layout };
  delete layout[id];
  return {
    layout,
    nodes: c.nodes
      .filter((n) => n.id !== id)
      .map((n) => {
        if (n.kind === 'gate' && n.inputs.includes(id)) return { ...n, inputs: n.inputs.map((s) => (s === id ? null : s)) };
        if (n.kind === 'output' && n.source === id) return { ...n, source: null };
        return n;
      }),
  };
}

export function moveNode(c: Circuit, id: string, p: Point, height = Infinity): Circuit {
  const node = c.nodes.find((n) => n.id === id);
  if (!node) return c;
  const { w, h } = nodeSize(node);
  const x = Math.min(Math.max(0, snap(p.x)), CANVAS_W - w);
  const y = Math.min(Math.max(0, snap(p.y)), Math.max(0, height - h));
  return { ...c, layout: { ...c.layout, [id]: { x, y } } };
}

/** Wire `from`'s output into pin `pin` of `to` (replacing any wire already there). */
export function connect(c: Circuit, from: string, to: string, pin: number): Circuit {
  return {
    ...c,
    nodes: c.nodes.map((n) => {
      if (n.id !== to) return n;
      if (n.kind === 'gate') return { ...n, inputs: n.inputs.map((s, i) => (i === pin ? from : s)) };
      if (n.kind === 'output') return { ...n, source: from };
      return n;
    }),
  };
}

export function disconnect(c: Circuit, to: string, pin: number): Circuit {
  return {
    ...c,
    nodes: c.nodes.map((n) => {
      if (n.id !== to) return n;
      if (n.kind === 'gate') return { ...n, inputs: n.inputs.map((s, i) => (i === pin ? null : s)) };
      if (n.kind === 'output') return { ...n, source: null };
      return n;
    }),
  };
}

export function setGateType(c: Circuit, id: string, gate: GateType): Circuit {
  return {
    ...c,
    nodes: c.nodes.map((n) => {
      if (n.id !== id || n.kind !== 'gate') return n;
      const unary = gate === 'NOT' || gate === 'BUFFER';
      const inputs = unary ? [n.inputs[0] ?? null] : n.inputs.length < 2 ? [n.inputs[0] ?? null, null] : n.inputs;
      return { ...n, gate, inputs };
    }),
  };
}

export function setInputCount(c: Circuit, id: string, count: number): Circuit {
  return {
    ...c,
    nodes: c.nodes.map((n) => {
      if (n.id !== id || n.kind !== 'gate' || n.gate === 'NOT' || n.gate === 'BUFFER') return n;
      const inputs = Array.from({ length: count }, (_, i) => n.inputs[i] ?? null);
      return { ...n, inputs };
    }),
  };
}

export function renameTerminal(c: Circuit, id: string, label: string): Circuit {
  return { ...c, nodes: c.nodes.map((n) => (n.id === id && (n.kind === 'input' || n.kind === 'output') ? { ...n, label } : n)) };
}

/** Terminal names: 1–3 letters/digits starting with a capital letter, unique within the circuit. */
export function labelProblem(c: Circuit, id: string, label: string): string | null {
  if (!/^[A-Z][A-Za-z0-9]{0,2}$/.test(label)) return 'Use 1–3 letters or digits, starting with a capital letter.';
  const clash = c.nodes.some((n) => n.id !== id && (n.kind === 'input' || n.kind === 'output') && n.label === label);
  return clash ? 'Another input or output already has this name.' : null;
}

/** Accept a saved builder circuit only if it has the expected shape. */
export function sanitizeCircuit(raw: unknown): Circuit | null {
  if (!raw || typeof raw !== 'object' || !Array.isArray((raw as Circuit).nodes)) return null;
  const r = raw as Circuit;
  const nodes: CircuitNode[] = [];
  for (const n of r.nodes) {
    if (!n || typeof n !== 'object' || typeof n.id !== 'string') return null;
    if (n.kind === 'input' && typeof n.label === 'string') nodes.push({ kind: 'input', id: n.id, label: n.label });
    else if (n.kind === 'output' && typeof n.label === 'string') nodes.push({ kind: 'output', id: n.id, label: n.label, source: typeof n.source === 'string' ? n.source : null });
    else if (n.kind === 'gate' && typeof n.gate === 'string' && isGateType(n.gate) && Array.isArray(n.inputs) && n.inputs.length >= 1 && n.inputs.length <= 4) {
      const g: GateNode = { kind: 'gate', id: n.id, gate: n.gate, inputs: n.inputs.map((s) => (typeof s === 'string' ? s : null)), label: typeof n.label === 'string' ? n.label : n.id };
      nodes.push(g);
    } else return null;
  }
  const layout: Record<string, Point> = {};
  for (const n of nodes) {
    const p = r.layout?.[n.id];
    layout[n.id] = p && typeof p.x === 'number' && typeof p.y === 'number' ? { x: p.x, y: p.y } : { x: 300, y: 40 };
  }
  return { nodes, layout };
}
