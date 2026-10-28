import { GateShape, signalStroke } from '@/components/gates/GateSymbol';
import { gateGeometry } from '@/components/gates/geometry';
import type { LatchKind } from '@/lib/logic/sequential';
import type { Bit } from '@/lib/logic/types';

interface Props {
  kind: LatchKind;
  s?: Bit | null;
  r?: Bit | null;
  q?: Bit | null;
  qBar?: Bit | null;
  /** Hide values (question figures). */
  neutral?: boolean;
}

function Wire({ pts, value }: { pts: [number, number][]; value: Bit | null | undefined }) {
  const st = signalStroke(value);
  return <polyline points={pts.map((p) => p.join(',')).join(' ')} fill="none" stroke={st.stroke} strokeWidth={st.width} strokeDasharray={st.dash} strokeLinejoin="round" />;
}

function Tag({ x, y, name, value, anchor = 'end' }: { x: number; y: number; name: string; value?: Bit | null; anchor?: 'start' | 'end' }) {
  return (
    <text x={x} y={y + 4.5} textAnchor={anchor} fontSize={13} fontWeight={600} fill="var(--ink)" fontFamily="var(--font-display)">
      {name}
      {value !== undefined && value !== null && <tspan fontFamily="var(--font-mono)" fill="var(--ink-2)">{` = ${value}`}</tspan>}
    </text>
  );
}

const Dot = ({ x, y }: { x: number; y: number }) => <circle cx={x} cy={y} r={3} fill="var(--ink)" />;

/** Cross-coupled latch (N p.64–70), drawn from the same equations the engine uses. */
export function LatchDiagram({ kind, s, r, q, qBar, neutral }: Props) {
  const v = (b: Bit | null | undefined) => (neutral ? undefined : b);
  if (kind === 'or-and') {
    const or = gateGeometry('OR', 2);
    const and = gateGeometry('AND', 2);
    const not = gateGeometry('NOT', 1);
    const orX = 70;
    const orY = 20;
    const andX = 200;
    const andY = orY + (or.outputPin.y - (and.inputPins[0]?.y ?? 0));
    const notX = 96;
    const notY = 80;
    const orOut = { x: orX + or.outputPin.x, y: orY + or.outputPin.y };
    const andOut = { x: andX + and.outputPin.x, y: andY + and.outputPin.y };
    const andIn1 = { x: andX + (and.inputPins[1]?.x ?? 0), y: andY + (and.inputPins[1]?.y ?? 0) };
    const notOut = { x: notX + not.outputPin.x, y: notY + not.outputPin.y };
    const notIn = { x: notX + (not.inputPins[0]?.x ?? 0), y: notY + (not.inputPins[0]?.y ?? 0) };
    const orIn0 = { x: orX + (or.inputPins[0]?.x ?? 0), y: orY + (or.inputPins[0]?.y ?? 0) };
    const orIn1 = { x: orX + (or.inputPins[1]?.x ?? 0), y: orY + (or.inputPins[1]?.y ?? 0) };
    const tap = andOut.x + 16;
    const orV = neutral ? undefined : s === 1 || q === 1 ? 1 : s === null || q === null ? null : 0;
    const rBar = neutral || r === null || r === undefined ? undefined : r === 1 ? 0 : 1;
    const W = tap + 60;
    return (
      <svg viewBox={`0 0 ${W} 130`} width={W * 1.4} className="max-w-full" role="img" aria-label={`Feedback loop: Q = (S + Q) AND NOT R.${neutral ? '' : ` S = ${s}, R = ${r}, Q = ${q ?? 'unknown'}.`}`}>
        <Wire pts={[[tap, andOut.y], [tap, 6], [orX - 18, 6], [orX - 18, orIn0.y], [orIn0.x, orIn0.y]]} value={v(q)} />
        <Wire pts={[[34, orIn1.y], [orIn1.x, orIn1.y]]} value={v(s)} />
        <Wire pts={[[orOut.x, orOut.y], [andX + (and.inputPins[0]?.x ?? 0), orOut.y]]} value={orV} />
        <Wire pts={[[34, notIn.y], [notIn.x, notIn.y]]} value={v(r)} />
        <Wire pts={[[notOut.x, notOut.y], [andX - 14, notOut.y], [andX - 14, andIn1.y], [andIn1.x, andIn1.y]]} value={rBar} />
        <Wire pts={[[andOut.x, andOut.y], [W - 34, andOut.y]]} value={v(q)} />
        <Dot x={tap} y={andOut.y} />
        <GateShape gate="OR" x={orX} y={orY} inputValues={neutral ? undefined : [q ?? null, s ?? null]} output={orV} />
        <GateShape gate="NOT" inputs={1} x={notX} y={notY} inputValues={[v(r) ?? null]} output={rBar} />
        <GateShape gate="AND" x={andX} y={andY} inputValues={[orV ?? null, rBar ?? null]} output={v(q)} />
        <Tag x={30} y={orIn1.y} name="S" value={v(s)} />
        <Tag x={30} y={notIn.y} name="R" value={v(r)} />
        <Tag x={W - 30} y={andOut.y} name="Q" value={v(q)} anchor="start" />
      </svg>
    );
  }

  const gate = kind === 'nor' ? 'NOR' : 'NAND';
  const g = gateGeometry(gate, 2);
  const gx = 92;
  const topY = 16;
  const botY = 116;
  const pin = (y0: number, i: number) => ({ x: gx + (g.inputPins[i]?.x ?? 0), y: y0 + (g.inputPins[i]?.y ?? 0) });
  const outT = { x: gx + g.outputPin.x, y: topY + g.outputPin.y };
  const outB = { x: gx + g.outputPin.x, y: botY + g.outputPin.y };
  const tapX = outT.x + 14;
  const W = tapX + 70;
  // NOR: top gate takes R and makes Q; bottom takes S and makes Q̄. NAND: top takes S (active-low) and makes Q.
  const topExt = kind === 'nor' ? 'R' : 'S';
  const botExt = kind === 'nor' ? 'S' : 'R';
  const topExtV = kind === 'nor' ? r : s;
  const botExtV = kind === 'nor' ? s : r;
  const tIn0 = pin(topY, 0);
  const tIn1 = pin(topY, 1);
  const bIn0 = pin(botY, 0);
  const bIn1 = pin(botY, 1);
  return (
    <svg
      viewBox={`0 0 ${W} ${botY + g.height + 14}`}
      width={W * 1.35}
      className="max-w-full"
      role="img"
      aria-label={`${gate} SR latch. Q = ${gate}(${topExt}, Q̄), Q̄ = ${gate}(${botExt}, Q).${neutral ? '' : ` S = ${s}, R = ${r}, Q = ${q ?? 'unknown'}, Q̄ = ${qBar ?? 'unknown'}.`}`}
    >
      <Wire pts={[[36, tIn0.y], [tIn0.x, tIn0.y]]} value={v(topExtV)} />
      <Wire pts={[[36, bIn1.y], [bIn1.x, bIn1.y]]} value={v(botExtV)} />
      {/* Q feeds the bottom gate */}
      <Wire pts={[[tapX, outT.y], [tapX, 74], [gx - 14, 92], [gx - 14, bIn0.y], [bIn0.x, bIn0.y]]} value={v(q)} />
      {/* Q̄ feeds the top gate */}
      <Wire pts={[[tapX, outB.y], [tapX, 98], [gx - 26, 66], [gx - 26, tIn1.y], [tIn1.x, tIn1.y]]} value={v(qBar)} />
      <Wire pts={[[outT.x, outT.y], [W - 40, outT.y]]} value={v(q)} />
      <Wire pts={[[outB.x, outB.y], [W - 40, outB.y]]} value={v(qBar)} />
      <Dot x={tapX} y={outT.y} />
      <Dot x={tapX} y={outB.y} />
      <GateShape gate={gate} x={gx} y={topY} inputValues={neutral ? undefined : [topExtV ?? null, qBar ?? null]} output={v(q)} />
      <GateShape gate={gate} x={gx} y={botY} inputValues={neutral ? undefined : [q ?? null, botExtV ?? null]} output={v(qBar)} />
      <Tag x={32} y={tIn0.y} name={topExt} value={v(topExtV)} />
      <Tag x={32} y={bIn1.y} name={botExt} value={v(botExtV)} />
      <Tag x={W - 36} y={outT.y} name="Q" value={v(q)} anchor="start" />
      <Tag x={W - 36} y={outB.y} name="Q̄" value={v(qBar)} anchor="start" />
    </svg>
  );
}
