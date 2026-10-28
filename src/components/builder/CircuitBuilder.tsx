import { type KeyboardEvent, type PointerEvent, useEffect, useMemo, useRef, useState } from 'react';
import { ExprView } from '@/components/expr/ExprView';
import { GateIcon, GateShape, signalStroke } from '@/components/gates/GateSymbol';
import { IconCheck, IconHint, IconPlus, IconRedo, IconTrash, IconUndo, IconWarn, IconX, IconZoomIn, IconZoomOut } from '@/components/icons';
import { RichText } from '@/components/RichText';
import { SignalToggle } from '@/components/signals';
import { TruthTable, type TTColumn } from '@/components/truth-tables/TruthTable';
import { BUILD_CHALLENGES, type BuildChallenge } from '@/content/buildChallenges';
import { builderLabel, type BuildCheck, checkBuild, issueLabel } from '@/lib/assessment/buildCheck';
import { describeIssue, evaluateCircuit, inputNodes, outputNodes, validateCircuit } from '@/lib/logic/circuit';
import { circuitToExpr } from '@/lib/logic/convert';
import { circuitTruthTable } from '@/lib/logic/truthTable';
import type { Assignment, Bit, Circuit, CircuitNode, GateType, Point } from '@/lib/logic/types';
import {
  addNode,
  CANVAS_W,
  canvasHeight,
  challengeCircuit,
  connect,
  disconnect,
  emptyCircuit,
  inPorts,
  labelProblem,
  moveNode,
  outPort,
  type PlaceKind,
  posOf,
  removeNode,
  renameTerminal,
  sanitizeCircuit,
  setGateType,
  setInputCount,
  TERM_H,
  TERM_W,
} from './model';

const SAVE_KEY = 'lgll.builder.v1';
const PALETTE_GATES: GateType[] = ['NOT', 'AND', 'OR', 'NAND', 'NOR', 'XOR', 'XNOR'];
const ZOOMS = [0.75, 1, 1.25, 1.5];
const MAX_TABLE = 6;

type Selection = { kind: 'node'; id: string } | { kind: 'wire'; to: string; pin: number } | null;
type Pending = { kind: 'from'; id: string } | { kind: 'to'; id: string; pin: number } | null;

interface Saved {
  circuit: Circuit;
  solved: string[];
}

function loadSaved(): Saved {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (raw) {
      const s = JSON.parse(raw) as { circuit?: unknown; solved?: unknown };
      return { circuit: sanitizeCircuit(s.circuit) ?? emptyCircuit(), solved: Array.isArray(s.solved) ? s.solved.filter((x): x is string => typeof x === 'string') : [] };
    }
  } catch {
    // Unreadable or blocked storage: start fresh.
  }
  return { circuit: emptyCircuit(), solved: [] };
}

function save(s: Saved) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(s));
  } catch {
    // The builder still works without storage.
  }
}

/** Undo/redo history. `preview` changes the present without a history entry (used while dragging). */
function useHistory(initial: Circuit) {
  const [h, setH] = useState({ past: [] as Circuit[], present: initial, future: [] as Circuit[] });
  return {
    present: h.present,
    canUndo: h.past.length > 0,
    canRedo: h.future.length > 0,
    commit: (fn: (c: Circuit) => Circuit) => setH((s) => ({ past: [...s.past, s.present].slice(-100), present: fn(s.present), future: [] })),
    preview: (fn: (c: Circuit) => Circuit) => setH((s) => ({ ...s, present: fn(s.present) })),
    /** Record a finished preview (e.g. a drag) as one undoable change. */
    settle: (before: Circuit) => setH((s) => ({ past: [...s.past, before].slice(-100), present: s.present, future: [] })),
    undo: () => setH((s) => (s.past.length ? { past: s.past.slice(0, -1), present: s.past[s.past.length - 1] as Circuit, future: [s.present, ...s.future] } : s)),
    redo: () => setH((s) => (s.future.length ? { past: [...s.past, s.present], present: s.future[0] as Circuit, future: s.future.slice(1) } : s)),
  };
}

function wirePath(a: Point, b: Point): string {
  const dx = Math.max(30, Math.abs(b.x - a.x) / 2);
  return `M${a.x} ${a.y} C${a.x + dx} ${a.y} ${b.x - dx} ${b.y} ${b.x} ${b.y}`;
}

function wireSource(node: CircuitNode | undefined, pin: number): string | null {
  if (node?.kind === 'gate') return node.inputs[pin] ?? null;
  if (node?.kind === 'output') return node.source;
  return null;
}

function isTyping(e: KeyboardEvent) {
  const t = e.target as HTMLElement;
  return t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA';
}

// ------------------------------------------------------------------ inspector

function SourceSelect({ circuit, node, pin, value, onChange }: { circuit: Circuit; node: CircuitNode; pin: number; value: string | null; onChange: (v: string | null) => void }) {
  const sources = circuit.nodes.filter((n) => n.kind !== 'output' && n.id !== node.id);
  const label = node.kind === 'output' ? `Source of output ${node.label}` : `Input ${pin + 1}`;
  return (
    <label className="flex items-center justify-between gap-3 text-sm">
      <span>{label}</span>
      <select aria-label={label} value={value ?? ''} onChange={(e) => onChange(e.target.value || null)} className="min-w-0 max-w-[60%] rounded-lg border border-line-strong bg-surface px-2 py-1.5">
        <option value="">Not connected</option>
        {sources.map((s) => (
          <option key={s.id} value={s.id}>
            {builderLabel(s)}
          </option>
        ))}
      </select>
    </label>
  );
}

function LabelField({ circuit, node, onRename }: { circuit: Circuit; node: Extract<CircuitNode, { kind: 'input' | 'output' }>; onRename: (l: string) => void }) {
  const [text, setText] = useState(node.label);
  useEffect(() => setText(node.label), [node.label, node.id]);
  const problem = text === node.label ? null : labelProblem(circuit, node.id, text);
  return (
    <div className="space-y-1">
      <label className="flex items-center justify-between gap-3 text-sm">
        <span>Name</span>
        <input
          aria-label="Name"
          value={text}
          maxLength={3}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => (problem ? setText(node.label) : text !== node.label && onRename(text))}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !problem && text !== node.label) onRename(text);
          }}
          aria-invalid={problem ? true : undefined}
          className="w-20 rounded-lg border border-line-strong bg-surface px-2 py-1.5 font-mono"
        />
      </label>
      {problem && <p className="text-xs font-semibold text-bad">{problem}</p>}
    </div>
  );
}

// ------------------------------------------------------------------ builder

export default function CircuitBuilder() {
  const initial = useMemo(loadSaved, []);
  const history = useHistory(initial.circuit);
  const circuit = history.present;
  const [solved, setSolved] = useState<string[]>(initial.solved);
  const [assignment, setAssignment] = useState<Assignment>({});
  const [selection, setSelection] = useState<Selection>(null);
  const [pending, setPending] = useState<Pending>(null);
  const [zoom, setZoom] = useState(() => (typeof window !== 'undefined' && window.innerWidth < 640 ? 0.75 : 1));
  const [announce, setAnnounce] = useState('');
  const [challenge, setChallenge] = useState<BuildChallenge | null>(null);
  const [check, setCheck] = useState<BuildCheck | null>(null);
  const [showHint, setShowHint] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ id: string; dx: number; dy: number; sx: number; sy: number; moved: boolean; before: Circuit } | null>(null);

  useEffect(() => save({ circuit, solved }), [circuit, solved]);

  const byId = useMemo(() => new Map(circuit.nodes.map((n) => [n.id, n])), [circuit]);
  const label = (id: string) => builderLabel(byId.get(id));
  const inputs = inputNodes(circuit);
  const outputs = outputNodes(circuit);
  const issues = useMemo(() => validateCircuit(circuit), [circuit]);
  const errors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity === 'warning');
  const fullAssignment = useMemo(() => Object.fromEntries(inputs.map((n) => [n.id, assignment[n.id] ?? 0])) as Assignment, [inputs, assignment]);
  const result = useMemo(() => evaluateCircuit(circuit, fullAssignment), [circuit, fullAssignment]);
  const values: Record<string, Bit> = result.ok ? result.values : {};
  const height = canvasHeight(circuit);

  const change = (fn: (c: Circuit) => Circuit, message?: string) => {
    history.commit(fn);
    setCheck(null);
    if (message) setAnnounce(message);
  };

  const place = (kind: PlaceKind) => {
    const { circuit: next, id } = addNode(circuit, kind);
    change(() => next, `Added ${builderLabel(next.nodes.find((n) => n.id === id))}.`);
    setSelection({ kind: 'node', id });
    setPending(null);
  };

  const deleteSelection = () => {
    if (!selection) return;
    if (selection.kind === 'node') {
      change((c) => removeNode(c, selection.id), `Deleted ${label(selection.id)}.`);
    } else {
      change((c) => disconnect(c, selection.to, selection.pin), 'Wire removed.');
    }
    setSelection(null);
  };

  const wire = (from: string, to: string, pin: number) => {
    setPending(null);
    if (from === to) {
      setAnnounce('A gate cannot take its own output as an input.');
      return;
    }
    change((c) => connect(c, from, to, pin), `Connected ${label(from)} to ${byId.get(to)?.kind === 'output' ? label(to) : `input ${pin + 1} of ${label(to)}`}.`);
  };

  const tapOut = (id: string) => {
    if (pending?.kind === 'to') wire(id, pending.id, pending.pin);
    else if (pending?.kind === 'from' && pending.id === id) setPending(null);
    else {
      setPending({ kind: 'from', id });
      setAnnounce(`Wiring from ${label(id)}. Now tap an input pin.`);
    }
  };

  const tapIn = (id: string, pin: number) => {
    if (pending?.kind === 'from') wire(pending.id, id, pin);
    else if (pending?.kind === 'to' && pending.id === id && pending.pin === pin) setPending(null);
    else {
      setPending({ kind: 'to', id, pin });
      setAnnounce(`Choose the output that feeds input ${pin + 1} of ${label(id)}.`);
    }
  };

  const toSvg = (e: PointerEvent): Point => {
    const svg = svgRef.current;
    const m = svg?.getScreenCTM();
    if (!svg || !m) return { x: 0, y: 0 };
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return { x: p.x, y: p.y };
  };

  const onNodeDown = (e: PointerEvent<SVGGElement>, id: string) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = toSvg(e);
    const pos = posOf(circuit, id);
    drag.current = { id, dx: p.x - pos.x, dy: p.y - pos.y, sx: p.x, sy: p.y, moved: false, before: circuit };
  };
  const onNodeMove = (e: PointerEvent<SVGGElement>) => {
    const d = drag.current;
    if (!d) return;
    const p = toSvg(e);
    if (!d.moved && Math.hypot(p.x - d.sx, p.y - d.sy) < 5) return;
    d.moved = true;
    history.preview((c) => moveNode(c, d.id, { x: p.x - d.dx, y: p.y - d.dy }, height + 200));
  };
  const onNodeUp = (id: string) => {
    const d = drag.current;
    drag.current = null;
    if (d?.moved) history.settle(d.before);
    else setSelection({ kind: 'node', id });
  };

  const onNodeKey = (e: KeyboardEvent<SVGGElement>, id: string) => {
    const step = e.shiftKey ? 40 : 10;
    const moves: Record<string, Point> = { ArrowLeft: { x: -step, y: 0 }, ArrowRight: { x: step, y: 0 }, ArrowUp: { x: 0, y: -step }, ArrowDown: { x: 0, y: step } };
    const m = moves[e.key];
    if (m) {
      e.preventDefault();
      const p = posOf(circuit, id);
      change((c) => moveNode(c, id, { x: p.x + m.x, y: p.y + m.y }, height + 200));
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setSelection({ kind: 'node', id });
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      change((c) => removeNode(c, id), `Deleted ${label(id)}.`);
      setSelection(null);
    }
  };

  const onBuilderKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (isTyping(e)) return;
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey) history.redo();
      else history.undo();
    } else if (mod && e.key.toLowerCase() === 'y') {
      e.preventDefault();
      history.redo();
    } else if (e.key === 'Escape') {
      setPending(null);
      setSelection(null);
    }
  };

  const startChallenge = (ch: BuildChallenge) => {
    setChallenge(ch);
    setCheck(null);
    setShowHint(false);
    setSelection(null);
    setPending(null);
    change(() => challengeCircuit(ch.inputs, Object.keys(ch.targets)), `Challenge: ${ch.title}. Inputs and outputs placed. Undo brings back your previous circuit.`);
  };

  const runCheck = () => {
    if (!challenge) return;
    const r = checkBuild(challenge, circuit);
    setCheck(r);
    if (r.ok && !solved.includes(challenge.id)) setSolved((s) => [...s, challenge.id]);
  };

  // ---------------------------------------------------------------- derived views
  const selectedNode = selection?.kind === 'node' ? byId.get(selection.id) : undefined;
  const table = useMemo(() => {
    if (errors.length > 0 || inputs.length === 0 || inputs.length > MAX_TABLE) return null;
    const t = circuitTruthTable(circuit);
    return t.ok ? t.table : null;
  }, [circuit, errors.length, inputs.length]);
  const exprs = useMemo(() => {
    if (errors.length > 0) return [];
    try {
      return outputs.map((o) => ({ id: o.id, label: o.label, expr: circuitToExpr(circuit, o.id) }));
    } catch {
      return [];
    }
  }, [circuit, errors.length, outputs]);

  const palette: GateType[] = challenge ? PALETTE_GATES.filter((g) => challenge.allowed.includes(g)) : PALETTE_GATES;
  const pendingText =
    pending?.kind === 'from' ? `Wiring from ${label(pending.id)}: tap a gate input pin (left side) or an output.` : pending?.kind === 'to' ? `Wiring into ${label(pending.id)}: tap an output pin (right side of an input or gate).` : null;

  return (
    <div className="space-y-5" onKeyDown={onBuilderKey}>
      <p className="sr-only" role="status" aria-live="polite">
        {announce}
      </p>

      {/* Challenge picker */}
      <section className="card space-y-3 p-4" aria-labelledby="challenges">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="challenges" className="font-display text-xl">
            Build challenges
          </h2>
          {challenge && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setChallenge(null)}>
              Free build
            </button>
          )}
        </div>
        <div className="table-scroll -mx-1 px-1">
          <ul className="flex min-w-max gap-2 pb-1">
            {BUILD_CHALLENGES.map((ch) => (
              <li key={ch.id}>
                <button
                  type="button"
                  onClick={() => startChallenge(ch)}
                  aria-pressed={challenge?.id === ch.id}
                  className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold ${challenge?.id === ch.id ? 'border-ink bg-ink text-paper' : 'border-line-strong bg-surface hover:bg-surface-2'}`}
                >
                  {solved.includes(ch.id) && <IconCheck size={16} aria-label="solved" />}
                  {ch.title}
                </button>
              </li>
            ))}
          </ul>
        </div>
        {challenge && (
          <div className="space-y-3 border-t border-line pt-3">
            <RichText text={challenge.brief} />
            <p className="text-sm text-ink-2">
              Allowed gates: {challenge.allowed.join(', ')}. Based on: {challenge.source}.
            </p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn btn-primary btn-sm" onClick={runCheck}>
                <IconCheck size={16} /> Check my circuit
              </button>
              <button type="button" className="btn btn-secondary btn-sm" aria-expanded={showHint} onClick={() => setShowHint((h) => !h)}>
                <IconHint size={16} /> {showHint ? 'Hide hint' : 'Hint'}
              </button>
            </div>
            {showHint && <p className="rounded-lg bg-surface-2 p-3 text-sm">{challenge.hint}</p>}
            {check && (
              <p role="status" className={`flex items-start gap-2 rounded-lg border p-3 text-sm font-semibold ${check.ok ? 'border-ok bg-ok-soft' : 'border-bad bg-bad-soft'}`}>
                {check.ok ? <IconCheck size={18} className="mt-0.5 shrink-0 text-ok" /> : <IconX size={18} className="mt-0.5 shrink-0 text-bad" />}
                {check.message}
              </p>
            )}
          </div>
        )}
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-3">
          {/* Palette and tools */}
          <div className="card flex flex-wrap items-center gap-2 p-2.5" role="toolbar" aria-label="Add components">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => place('input')}>
              <IconPlus size={16} /> Input
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => place('output')}>
              <IconPlus size={16} /> Output
            </button>
            <span className="mx-1 hidden h-6 w-px bg-line sm:block" aria-hidden="true" />
            {palette.map((g) => (
              <button key={g} type="button" className="btn btn-secondary btn-sm gap-1 px-2" onClick={() => place(g)} aria-label={`Add ${g} gate`}>
                <GateIcon gate={g} size={30} title="" />
                <span className="font-mono text-xs">{g}</span>
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1" role="toolbar" aria-label="Edit and view">
            <button type="button" className="btn btn-ghost btn-sm" onClick={history.undo} disabled={!history.canUndo} aria-label="Undo">
              <IconUndo size={18} />
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={history.redo} disabled={!history.canRedo} aria-label="Redo">
              <IconRedo size={18} />
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setZoom((z) => ZOOMS[Math.max(0, ZOOMS.indexOf(z) - 1)] ?? z)} disabled={zoom === ZOOMS[0]} aria-label="Zoom out">
              <IconZoomOut size={18} />
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setZoom((z) => ZOOMS[Math.min(ZOOMS.length - 1, ZOOMS.indexOf(z) + 1)] ?? z)} disabled={zoom === ZOOMS[ZOOMS.length - 1]} aria-label="Zoom in">
              <IconZoomIn size={18} />
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                change(() => (challenge ? challengeCircuit(challenge.inputs, Object.keys(challenge.targets)) : emptyCircuit()), 'Canvas cleared. Undo brings it back.');
                setSelection(null);
              }}
            >
              <IconTrash size={16} /> Clear
            </button>
          </div>

          {/* Input switches */}
          {inputs.length > 0 && (
            <div className="flex flex-wrap gap-2" aria-label="Test the inputs">
              {inputs.map((n) => (
                <SignalToggle key={n.id} label={n.label} value={fullAssignment[n.id] ?? 0} onChange={(v) => setAssignment((a) => ({ ...a, [n.id]: v }))} size="sm" />
              ))}
            </div>
          )}

          <p className="min-h-[1.5rem] text-sm text-ink-2" aria-hidden="true">
            {pendingText ?? 'Tap a pin to start a wire, then tap the pin it should connect to. Drag components to move them.'}
          </p>

          {/* Canvas */}
          <div className="card bench-grid table-scroll" onPointerDown={(e) => e.target === e.currentTarget && setSelection(null)}>
            <svg
              ref={svgRef}
              viewBox={`0 0 ${CANVAS_W} ${height}`}
              style={{ width: CANVAS_W * zoom, minWidth: CANVAS_W * zoom * 0.8, maxWidth: 'none', display: 'block' }}
              className="select-none"
              role="group"
              aria-label="Circuit canvas. Use the panel beside it to connect components with the keyboard."
              onPointerDown={(e) => {
                if (e.target === e.currentTarget) {
                  setSelection(null);
                  setPending(null);
                }
              }}
            >
              {/* wires */}
              {circuit.nodes.flatMap((n) => {
                const sources = n.kind === 'gate' ? n.inputs : n.kind === 'output' ? [n.source] : [];
                const ports = inPorts(circuit, n);
                return sources.map((src, pin) => {
                  const from = src ? byId.get(src) : undefined;
                  const to = ports[pin];
                  if (!from || !to || from.kind === 'output') return null;
                  const s = signalStroke(result.ok ? values[from.id] : undefined);
                  const d = wirePath(outPort(circuit, from), to);
                  const sel = selection?.kind === 'wire' && selection.to === n.id && selection.pin === pin;
                  return (
                    <g key={`${n.id}:${pin}`}>
                      {sel && <path d={d} fill="none" stroke="var(--accent)" strokeWidth={s.width + 6} strokeOpacity={0.35} />}
                      <path d={d} fill="none" stroke={s.stroke} strokeWidth={s.width} strokeDasharray={s.dash} />
                      <path
                        d={d}
                        fill="none"
                        stroke="transparent"
                        strokeWidth={16}
                        className="cursor-pointer"
                        onClick={() => {
                          setSelection({ kind: 'wire', to: n.id, pin });
                          setPending(null);
                        }}
                      >
                        <title>{`Wire from ${label(from.id)} to ${n.kind === 'output' ? label(n.id) : `input ${pin + 1} of ${label(n.id)}`}`}</title>
                      </path>
                    </g>
                  );
                });
              })}

              {/* components */}
              {circuit.nodes.map((n) => {
                const p = posOf(circuit, n.id);
                const sel = selection?.kind === 'node' && selection.id === n.id;
                const v = result.ok ? values[n.id] : undefined;
                const common = {
                  tabIndex: 0,
                  role: 'button',
                  'aria-pressed': sel,
                  style: { touchAction: 'none' as const, cursor: 'grab' },
                  onPointerDown: (e: PointerEvent<SVGGElement>) => onNodeDown(e, n.id),
                  onPointerMove: onNodeMove,
                  onPointerUp: () => onNodeUp(n.id),
                  onPointerCancel: () => (drag.current = null),
                  onKeyDown: (e: KeyboardEvent<SVGGElement>) => onNodeKey(e, n.id),
                  className: 'outline-none [&:focus-visible>.focus-ring]:opacity-100',
                };
                if (n.kind === 'gate') {
                  const ins = n.inputs.map((s) => (s && result.ok ? (values[s] ?? null) : null));
                  return (
                    <g key={n.id} {...common} aria-label={`${builderLabel(n)}, ${n.inputs.length} input${n.inputs.length > 1 ? 's' : ''}${v !== undefined ? `, output ${v}` : ''}`}>
                      <rect className="focus-ring opacity-0" x={p.x - 8} y={p.y - 18} width={90} height={60 + n.inputs.length * 6} rx={10} fill="none" stroke="var(--accent)" strokeWidth={2} strokeDasharray="4 3" />
                      <GateShape gate={n.gate} inputs={n.inputs.length} x={p.x} y={p.y} inputValues={ins} output={v ?? null} highlight={sel} label={n.label} />
                    </g>
                  );
                }
                if (n.kind === 'input' || n.kind === 'output') {
                  const shown = n.kind === 'input' ? (fullAssignment[n.id] ?? 0) : v;
                  const on = shown === 1;
                  return (
                    <g key={n.id} {...common} aria-label={`${builderLabel(n)}${shown !== undefined ? `, value ${shown}` : ''}`}>
                      <rect className="focus-ring opacity-0" x={p.x - 5} y={p.y - 5} width={TERM_W + 10} height={TERM_H + 10} rx={12} fill="none" stroke="var(--accent)" strokeWidth={2} strokeDasharray="4 3" />
                      <rect
                        x={p.x}
                        y={p.y}
                        width={TERM_W}
                        height={TERM_H}
                        rx={n.kind === 'output' ? 18 : 8}
                        fill={sel ? 'var(--accent-soft)' : on ? 'var(--hi-soft)' : 'var(--surface)'}
                        stroke={sel ? 'var(--accent)' : 'var(--ink)'}
                        strokeWidth={sel ? 2.5 : 1.5}
                      />
                      <text x={p.x + 12} y={p.y + 23} fontSize={16} fontWeight={700} fill="var(--ink)" fontFamily="var(--font-display)">
                        {n.label}
                      </text>
                      <text x={p.x + TERM_W - 12} y={p.y + 23} textAnchor="end" fontSize={15} fontWeight={700} fill="var(--ink-2)" fontFamily="var(--font-mono)">
                        {shown ?? '?'}
                      </text>
                    </g>
                  );
                }
                return null;
              })}

              {/* ports (pointer only; the panel offers the same wiring by keyboard) */}
              {circuit.nodes.map((n) => {
                const els = [];
                if (n.kind !== 'output') {
                  const o = outPort(circuit, n);
                  const active = pending?.kind === 'from' && pending.id === n.id;
                  els.push(
                    <g key={`${n.id}:out`} onClick={() => tapOut(n.id)} className="cursor-crosshair" aria-hidden="true">
                      <circle cx={o.x} cy={o.y} r={15} fill="transparent" />
                      <circle cx={o.x} cy={o.y} r={active ? 7 : 5} fill={active ? 'var(--accent)' : 'var(--surface)'} stroke={pending?.kind === 'to' ? 'var(--accent)' : 'var(--ink-2)'} strokeWidth={2} />
                    </g>,
                  );
                }
                inPorts(circuit, n).forEach((q, pin) => {
                  const active = pending?.kind === 'to' && pending.id === n.id && pending.pin === pin;
                  els.push(
                    <g key={`${n.id}:in${pin}`} onClick={() => tapIn(n.id, pin)} className="cursor-crosshair" aria-hidden="true">
                      <circle cx={q.x} cy={q.y} r={13} fill="transparent" />
                      <rect x={q.x - 5} y={q.y - 5} width={10} height={10} rx={2} fill={active ? 'var(--accent)' : 'var(--surface)'} stroke={pending?.kind === 'from' ? 'var(--accent)' : 'var(--ink-2)'} strokeWidth={2} />
                    </g>,
                  );
                });
                return els;
              })}
            </svg>
          </div>
        </div>

        {/* Inspector */}
        <aside className="card space-y-4 self-start p-4" aria-labelledby="inspector">
          <h2 id="inspector" className="font-display text-xl">
            {selectedNode ? builderLabel(selectedNode).replace(/^./, (ch) => ch.toUpperCase()) : selection?.kind === 'wire' ? 'Wire' : 'Components'}
          </h2>
          {!selection && (
            <div className="space-y-3 text-sm">
              <p className="text-ink-2">Select a component on the canvas, or choose one here to change its wiring with the keyboard.</p>
              <ul className="space-y-1">
                {circuit.nodes.map((n) => (
                  <li key={n.id}>
                    <button type="button" className="w-full rounded-lg px-2 py-1.5 text-left hover:bg-surface-2" onClick={() => setSelection({ kind: 'node', id: n.id })}>
                      {builderLabel(n)}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {selection?.kind === 'wire' && (
            <div className="space-y-3 text-sm">
              <p>
                From {label(wireSource(byId.get(selection.to), selection.pin) ?? '')} to {byId.get(selection.to)?.kind === 'output' ? label(selection.to) : `input ${selection.pin + 1} of ${label(selection.to)}`}.
              </p>
              <button type="button" className="btn btn-secondary btn-sm" onClick={deleteSelection}>
                <IconTrash size={16} /> Remove wire
              </button>
            </div>
          )}
          {selectedNode && (
            <div className="space-y-3">
              {(selectedNode.kind === 'input' || selectedNode.kind === 'output') && <LabelField circuit={circuit} node={selectedNode} onRename={(l) => change((c) => renameTerminal(c, selectedNode.id, l), `Renamed to ${l}.`)} />}
              {selectedNode.kind === 'gate' && (
                <>
                  <label className="flex items-center justify-between gap-3 text-sm">
                    <span>Gate type</span>
                    <select aria-label="Gate type" value={selectedNode.gate} onChange={(e) => change((c) => setGateType(c, selectedNode.id, e.target.value as GateType))} className="rounded-lg border border-line-strong bg-surface px-2 py-1.5">
                      {PALETTE_GATES.map((g) => (
                        <option key={g} value={g}>
                          {g}
                        </option>
                      ))}
                    </select>
                  </label>
                  {selectedNode.gate !== 'NOT' && selectedNode.gate !== 'BUFFER' && (
                    <label className="flex items-center justify-between gap-3 text-sm">
                      <span>Number of inputs</span>
                      <select aria-label="Number of inputs" value={selectedNode.inputs.length} onChange={(e) => change((c) => setInputCount(c, selectedNode.id, Number(e.target.value)))} className="rounded-lg border border-line-strong bg-surface px-2 py-1.5">
                        {[2, 3, 4].map((k) => (
                          <option key={k} value={k}>
                            {k}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  {selectedNode.inputs.map((src, pin) => (
                    <SourceSelect key={pin} circuit={circuit} node={selectedNode} pin={pin} value={src} onChange={(v) => change((c) => (v ? connect(c, v, selectedNode.id, pin) : disconnect(c, selectedNode.id, pin)))} />
                  ))}
                </>
              )}
              {selectedNode.kind === 'output' && <SourceSelect circuit={circuit} node={selectedNode} pin={0} value={selectedNode.source} onChange={(v) => change((c) => (v ? connect(c, v, selectedNode.id, 0) : disconnect(c, selectedNode.id, 0)))} />}
              <div className="flex flex-wrap gap-2 border-t border-line pt-3">
                <button type="button" className="btn btn-secondary btn-sm" onClick={deleteSelection}>
                  <IconTrash size={16} /> Delete
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelection(null)}>
                  Done
                </button>
              </div>
            </div>
          )}
          <p className="border-t border-line pt-3 text-xs text-ink-3">Keyboard: Tab to a component, arrow keys move it, Delete removes it. Ctrl+Z undoes, Ctrl+Y redoes.</p>
        </aside>
      </div>

      {/* Results */}
      <section className="grid gap-5 lg:grid-cols-2" aria-label="Circuit results">
        <div className="space-y-3">
          <h2 className="font-display text-xl">Check</h2>
          {issues.length === 0 ? (
            <p className="flex items-center gap-2 text-sm font-semibold text-ok">
              <IconCheck size={18} /> The circuit is complete.
            </p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {[...errors, ...warnings].map((i, k) => (
                <li key={k} className="flex items-start gap-2">
                  {i.severity === 'error' ? <IconX size={16} className="mt-0.5 shrink-0 text-bad" aria-label="Problem" /> : <IconWarn size={16} className="mt-0.5 shrink-0 text-hi-strong" aria-label="Warning" />}
                  <span>{describeIssue(i, (id) => issueLabel(byId.get(id)))}</span>
                </li>
              ))}
            </ul>
          )}
          {exprs.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-sm font-semibold text-ink-2">Expression read from your circuit</p>
              {exprs.map((x) => (
                <p key={x.id} className="text-lg">
                  <span className="font-display">{x.label} = </span>
                  <ExprView expr={x.expr} />
                </p>
              ))}
            </div>
          )}
        </div>
        <div className="min-w-0 space-y-3">
          <h2 className="font-display text-xl">Truth table</h2>
          {table ? (
            <TruthTable
              compact
              columns={[
                ...table.inputIds.map((id, k): TTColumn => ({ key: id, header: table.inputLabels[k], name: table.inputLabels[k] ?? id, kind: 'input' })),
                ...table.outputIds.map((id, k): TTColumn => ({ key: id, header: table.outputLabels[k], name: table.outputLabels[k] ?? id, kind: 'output' })),
              ]}
              rows={table.rows.map((r) => ({
                icn: r.icn,
                cells: {
                  ...Object.fromEntries(table.inputIds.map((id, k) => [id, r.inputs[k] as Bit])),
                  ...Object.fromEntries(table.outputIds.map((id, k) => [id, r.outputs[k] as Bit])),
                },
              }))}
              highlight={inputs.reduce((acc, n) => acc * 2 + (fullAssignment[n.id] ?? 0), 0)}
              onRowSelect={(idx) => setAssignment(Object.fromEntries(inputs.map((n, k) => [n.id, ((idx >> (inputs.length - 1 - k)) & 1) as Bit])))}
            />
          ) : (
            <p className="text-sm text-ink-2">{inputs.length > MAX_TABLE ? `Truth tables are shown for up to ${MAX_TABLE} inputs.` : 'Finish the circuit to see its truth table.'}</p>
          )}
        </div>
      </section>
    </div>
  );
}
