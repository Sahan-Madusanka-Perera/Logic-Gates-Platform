import { inputNodes, nodeById, nodeDepths, outputNodes } from '@/lib/logic/circuit';
import type { Circuit, CircuitNode, GateNode, Point } from '@/lib/logic/types';
import { gateGeometry, type GateGeometry } from '../gates/geometry';

/**
 * Automatic layout for read-only circuit diagrams.
 *
 *  - Inputs are vertical rails on the left, labelled at the top (as in past papers).
 *  - Gates sit in columns by their longest distance from the inputs.
 *  - Working back from each output, every gate input pin gets its own horizontal
 *    band. A pin fed by a gate placed for it shares the band with that gate's
 *    subtree; any other pin (an input rail or a gate already drawn elsewhere) gets
 *    a narrow band of its own. Because a band only ever contains the subtree that
 *    feeds that pin, horizontal wires never pass through a gate.
 *  - Each net drops vertically in the channel just right of its source column.
 */

const TOP = 34;
const RAIL_GAP = 30;
const LEFT = 18;
const COL_GAP = 58;
const PIN_BAND = 30;
const GATE_GAP = 14;

export interface PlacedGate {
  node: GateNode;
  x: number;
  y: number;
  geo: GateGeometry;
  column: number;
}

export interface Segment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface Net {
  /** Source node id; the net carries this node's value. */
  source: string;
  segments: Segment[];
  junctions: Point[];
}

export interface CircuitLayout {
  width: number;
  height: number;
  rails: { id: string; label: string; x: number; y1: number; y2: number }[];
  gates: PlacedGate[];
  outputs: { id: string; label: string; x: number; y: number; source: string }[];
  nets: Net[];
}

export function layoutCircuit(circuit: Circuit): CircuitLayout {
  const byId = nodeById(circuit);
  const depth = nodeDepths(circuit);
  const inputs = inputNodes(circuit);
  const consts = circuit.nodes.filter((n) => n.kind === 'const');
  const railNodes: CircuitNode[] = [...inputs, ...consts];
  const railX = new Map(railNodes.map((n, i) => [n.id, LEFT + i * RAIL_GAP]));
  const railsRight = LEFT + Math.max(0, railNodes.length - 1) * RAIL_GAP;

  const gates = circuit.nodes.filter((n): n is GateNode => n.kind === 'gate');
  const maxCol = Math.max(0, ...gates.map((g) => depth[g.id] ?? 0));
  const colWidth = gates.reduce((w, g) => Math.max(w, gateGeometry(g.gate, g.inputs.length).width), 60);
  const colX = (c: number) => railsRight + COL_GAP + (c - 1) * (colWidth + COL_GAP);

  const placed = new Map<string, PlacedGate>();
  /** y of each gate input pin, keyed `${gateId}:${pin}`. */
  const pinY = new Map<string, number>();
  /** Centre of the exclusive band reserved for each pin — long horizontal runs use this y. */
  const pinBand = new Map<string, number>();

  // Place a gate and its unplaced source subtrees in the band starting at `top`. Returns band height.
  const place = (g: GateNode, top: number): number => {
    const geo = gateGeometry(g.gate, g.inputs.length);
    const column = depth[g.id] ?? 1;
    const bands: { top: number; height: number; center: number; sourceGate?: PlacedGate }[] = [];
    // Reserve the gate first so shared references found during recursion are not re-placed.
    placed.set(g.id, { node: g, x: colX(column) + (colWidth - geo.width) / 2, y: 0, geo, column });
    let cursor = top;
    for (const src of g.inputs) {
      const s = src ? byId.get(src) : undefined;
      if (s && s.kind === 'gate' && !placed.has(s.id)) {
        const h = place(s, cursor);
        const sg = placed.get(s.id) as PlacedGate;
        bands.push({ top: cursor, height: h, center: sg.y + sg.geo.outputPin.y, sourceGate: sg });
        cursor += h;
      } else {
        bands.push({ top: cursor, height: PIN_BAND, center: cursor + PIN_BAND / 2 });
        cursor += PIN_BAND;
      }
    }
    let span = cursor - top;
    const minSpan = geo.height + GATE_GAP * 2;
    if (span < minSpan) {
      // Grow the last direct band so the body fits.
      span = minSpan;
    }
    // Centre the body on its input bands, clamped inside the span.
    const firstC = bands[0]?.center ?? top + span / 2;
    const lastC = bands[bands.length - 1]?.center ?? top + span / 2;
    let bodyTop = (firstC + lastC) / 2 - geo.height / 2;
    bodyTop = Math.max(top + GATE_GAP / 2, Math.min(bodyTop, top + span - geo.height - GATE_GAP / 2));
    const self = placed.get(g.id) as PlacedGate;
    self.y = bodyTop;
    g.inputs.forEach((_, i) => {
      const p = geo.inputPins[i] as Point;
      pinY.set(`${g.id}:${i}`, bodyTop + p.y);
      pinBand.set(`${g.id}:${i}`, bands[i]?.center ?? bodyTop + p.y);
    });
    return span;
  };

  let cursor = TOP + 16;
  const outs = outputNodes(circuit);
  const outputPos: CircuitLayout['outputs'] = [];
  for (const o of outs) {
    const src = o.source ? byId.get(o.source) : undefined;
    if (src && src.kind === 'gate' && !placed.has(src.id)) {
      const h = place(src, cursor);
      const pg = placed.get(src.id) as PlacedGate;
      outputPos.push({ id: o.id, label: o.label, x: 0, y: pg.y + pg.geo.outputPin.y, source: src.id });
      cursor += h + 10;
    } else {
      outputPos.push({ id: o.id, label: o.label, x: 0, y: cursor + PIN_BAND / 2, source: o.source ?? '' });
      cursor += PIN_BAND + 10;
    }
  }
  // Any gate not reachable from an output (unused) goes at the bottom.
  for (const g of gates) {
    if (!placed.has(g.id)) {
      const h = place(g, cursor);
      cursor += h;
    }
  }
  const bottom = cursor + 6;
  const outX = colX(maxCol + 1) - COL_GAP / 2 + 10;
  for (const o of outputPos) o.x = outX;

  // ---- wires
  type Sink = { x: number; y: number; band: number; pin: number };
  const sinks = new Map<string, Sink[]>();
  const addSink = (src: string, sink: Sink) => sinks.set(src, [...(sinks.get(src) ?? []), sink]);
  for (const pg of placed.values()) {
    pg.node.inputs.forEach((src, i) => {
      if (!src) return;
      const key = `${pg.node.id}:${i}`;
      addSink(src, { x: pg.x + (pg.geo.inputPins[i]?.x ?? 0), y: pinY.get(key) ?? 0, band: pinBand.get(key) ?? 0, pin: i });
    });
  }
  for (const o of outputPos) if (o.source) addSink(o.source, { x: o.x, y: o.y, band: o.y, pin: 0 });

  const nets: Net[] = [];
  const railYMax = new Map<string, number>();
  const channelUse = new Map<number, number>();
  const path = (pts: Point[]): Segment[] => {
    const out: Segment[] = [];
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1] as Point;
      const b = pts[i] as Point;
      if (Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5) continue;
      out.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y });
    }
    return out;
  };
  for (const [src, list] of sinks) {
    const segments: Segment[] = [];
    const junctions: Point[] = [];
    // Each pin gets its own jog column just left of its gate, so vertical jogs never overlap.
    const jogX = (sink: Sink) => sink.x - 8 - sink.pin * 6;
    const rx = railX.get(src);
    if (rx !== undefined) {
      for (const sink of list) {
        const jx = jogX(sink);
        segments.push(...path([{ x: rx, y: sink.band }, { x: jx, y: sink.band }, { x: jx, y: sink.y }, { x: sink.x, y: sink.y }]));
        junctions.push({ x: rx, y: sink.band });
      }
      railYMax.set(src, Math.max(...list.map((sink) => sink.band)));
      nets.push({ source: src, segments, junctions });
      continue;
    }
    const pg = placed.get(src);
    if (!pg) continue;
    const sp = { x: pg.x + pg.geo.outputPin.x, y: pg.y + pg.geo.outputPin.y };
    const used = channelUse.get(pg.column) ?? 0;
    channelUse.set(pg.column, used + 1);
    const trunkX = colX(pg.column) + colWidth + 10 + (used % 3) * 7;
    for (const sink of list) {
      const isOutput = outputPos.some((o) => o.x === sink.x && o.y === sink.y && o.source === src);
      const jx = isOutput ? sink.x : jogX(sink);
      if (Math.abs(sink.band - sp.y) < 0.5) {
        segments.push(...path([sp, { x: jx, y: sp.y }, { x: jx, y: sink.y }, { x: sink.x, y: sink.y }]));
      } else {
        segments.push(...path([sp, { x: trunkX, y: sp.y }, { x: trunkX, y: sink.band }, { x: jx, y: sink.band }, { x: jx, y: sink.y }, { x: sink.x, y: sink.y }]));
        if (list.length > 1) junctions.push({ x: trunkX, y: sink.band });
      }
    }
    if (list.length > 1) junctions.push({ x: trunkX, y: sp.y });
    nets.push({ source: src, segments, junctions });
  }

  const rails = railNodes.map((n) => ({
    id: n.id,
    label: n.kind === 'input' ? n.label : n.kind === 'const' ? String(n.value) : n.id,
    x: railX.get(n.id) as number,
    y1: TOP,
    y2: railYMax.get(n.id) ?? TOP + 20,
  }));

  return { width: outX + 56, height: Math.max(bottom, TOP + 60), rails, gates: [...placed.values()], outputs: outputPos, nets };
}
