import { useMemo, useState } from 'react';
import { ExprView } from '@/components/expr/ExprView';
import { IconArrowLeft, IconArrowRight, IconReset, IconStep } from '@/components/icons';
import { RichText } from '@/components/RichText';
import { Lamp, SignalToggle } from '@/components/signals';
import { TruthTable, type TTColumn } from '@/components/truth-tables/TruthTable';
import { evaluateCircuit, inputNodes, outputNodes } from '@/lib/logic/circuit';
import { circuitToExpr, gateExpressions } from '@/lib/logic/convert';
import { describeCircuit, describeStep, nodeLabel } from '@/lib/logic/explain';
import { indexToBits } from '@/lib/logic/gates';
import { circuitTruthTable } from '@/lib/logic/truthTable';
import type { Assignment, Bit, Circuit } from '@/lib/logic/types';
import { CircuitDiagram } from './CircuitDiagram';

interface Props {
  circuit: Circuit;
  /** Show intermediate (gate) columns in the truth table. */
  showGateColumns?: boolean;
  showTruthTable?: boolean;
  showExpression?: boolean;
  onInteract?: () => void;
  initial?: Assignment;
  multi?: string[];
}

/**
 * Interactive circuit: toggle inputs, watch values propagate, step through the
 * evaluation gate by gate, and see the truth table — all from one engine call.
 */
export function CircuitExplorer({ circuit, showGateColumns = true, showTruthTable = true, showExpression = true, onInteract, initial, multi }: Props) {
  const inputs = useMemo(() => inputNodes(circuit), [circuit]);
  const outputs = useMemo(() => outputNodes(circuit), [circuit]);
  const [assignment, setAssignment] = useState<Assignment>(() => initial ?? Object.fromEntries(inputs.map((n) => [n.id, 0 as Bit])));
  const [step, setStep] = useState<number | null>(null);
  const [showDescription, setShowDescription] = useState(false);

  const result = useMemo(() => evaluateCircuit(circuit, assignment), [circuit, assignment]);
  const table = useMemo(() => circuitTruthTable(circuit), [circuit]);
  const exprs = useMemo(() => gateExpressions(circuit), [circuit]);
  const outputExprs = useMemo(() => {
    try {
      return outputs.map((o) => ({ id: o.id, label: o.label, expr: circuitToExpr(circuit, o.id) }));
    } catch {
      return [];
    }
  }, [circuit, outputs]);

  if (!result.ok || !table.ok) {
    return <div className="rounded-xl border border-bad bg-bad-soft p-4 text-sm">This circuit is incomplete, so it can't be evaluated.</div>;
  }

  const steps = result.steps;
  const known = step === null ? undefined : new Set<string>([...inputs.map((i) => i.id), ...steps.slice(0, step).map((s) => s.nodeId)]);
  if (known && step === steps.length) outputs.forEach((o) => known.add(o.id));
  const current = step !== null && step > 0 ? steps[step - 1] : undefined;
  const rowIndex = inputs.reduce((acc, n) => acc * 2 + (assignment[n.id] ?? 0), 0);

  const setInput = (id: string, v: Bit) => {
    setAssignment((a) => ({ ...a, [id]: v }));
    onInteract?.();
  };
  const selectRow = (idx: number) => {
    const bits = indexToBits(idx, inputs.length);
    setAssignment(Object.fromEntries(inputs.map((n, k) => [n.id, bits[k] as Bit])));
    onInteract?.();
  };

  const columns: TTColumn[] = [
    ...inputs.map((n) => ({ key: n.id, header: <ExprView expr={n.label} multi={multi} />, name: n.label, kind: 'input' as const })),
    ...(showGateColumns
      ? steps.map((s) => ({
          key: s.nodeId,
          header: (
            <span className="flex flex-col items-center gap-0.5 text-xs">
              <span className="font-mono text-ink-3">{nodeLabel(circuit, s.nodeId)}</span>
              {exprs[s.nodeId] && <ExprView expr={exprs[s.nodeId] as never} className="text-sm" />}
            </span>
          ),
          name: nodeLabel(circuit, s.nodeId),
          kind: 'mid' as const,
        }))
      : []),
    ...outputs.map((o) => ({ key: o.id, header: <span className="font-display">{o.label}</span>, name: o.label, kind: 'output' as const })),
  ];
  const rows = table.table.rows.map((r) => ({
    icn: r.icn,
    cells: {
      ...Object.fromEntries(table.table.inputIds.map((id, k) => [id, r.inputs[k] as Bit])),
      ...r.gates,
      ...Object.fromEntries(table.table.outputIds.map((id, k) => [id, r.outputs[k] as Bit])),
    },
  }));

  return (
    <div className="space-y-4">
      <div className="card bench-grid overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface/90 p-3">
          {inputs.map((n) => (
            <SignalToggle key={n.id} label={n.label} value={assignment[n.id] ?? 0} onChange={(v) => setInput(n.id, v)} size="sm" />
          ))}
          <div className="ml-auto flex flex-wrap gap-2">
            {step === null ? (
              <button className="btn btn-secondary btn-sm" onClick={() => setStep(0)}>
                <IconStep size={16} /> Step through
              </button>
            ) : (
              <button className="btn btn-ghost btn-sm" onClick={() => setStep(null)}>
                <IconReset size={16} /> Show all
              </button>
            )}
          </div>
        </div>
        <div className="p-3 sm:p-4">
          <CircuitDiagram circuit={circuit} values={result.values} known={known} highlight={current?.nodeId ?? null} />
        </div>
        <div className="flex flex-wrap items-end justify-between gap-4 border-t border-line bg-surface/90 p-3">
          {showExpression && (
            <div className="min-w-0 space-y-1 text-lg">
              {outputExprs.map((o) => (
                <div key={o.id} className="flex flex-wrap items-baseline gap-2">
                  <span className="font-display">{o.label} =</span>
                  <ExprView expr={o.expr} />
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-4">
            {outputs.map((o) => (
              <Lamp key={o.id} label={o.label} value={known && !known.has(o.id) ? null : (result.outputs[o.id] ?? null)} size={52} />
            ))}
          </div>
        </div>
      </div>

      {step !== null && (
        <div className="card p-4" aria-live="polite">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="eyebrow">
              Step {step} of {steps.length}
            </span>
            <div className="flex gap-2">
              <button className="btn btn-secondary btn-sm" disabled={step === 0} onClick={() => setStep(step - 1)} aria-label="Previous step">
                <IconArrowLeft size={16} />
              </button>
              <button className="btn btn-primary btn-sm" disabled={step === steps.length} onClick={() => setStep(step + 1)}>
                Next gate <IconArrowRight size={16} />
              </button>
            </div>
          </div>
          {step === 0 ? (
            <RichText
              text={`Read the inputs: ${inputs.map((n) => `${n.label} = ${assignment[n.id]}`).join(', ')}. No gate has been worked out yet. Press **Next gate** to evaluate the gate nearest the inputs.`}
            />
          ) : (
            current && <RichText text={describeStep(circuit, current, exprs)} />
          )}
          {step === steps.length && (
            <p className="mt-2 rounded-lg bg-accent-soft px-3 py-2 text-sm font-semibold">
              Done: {outputs.map((o) => `${o.label} = ${result.outputs[o.id]}`).join(', ')}. Every gate was worked out in order, each using the outputs before it.
            </p>
          )}
        </div>
      )}

      {showTruthTable && (
        <div>
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-lg">Truth table</h3>
            <span className="text-xs text-ink-3">Generated from this circuit. Tap a row to set the inputs.</span>
          </div>
          <TruthTable columns={columns} rows={rows} highlight={rowIndex} onRowSelect={selectRow} compact={columns.length > 6} />
        </div>
      )}

      <div>
        <button className="text-sm font-semibold text-accent underline-offset-4 hover:underline" aria-expanded={showDescription} onClick={() => setShowDescription((x) => !x)}>
          {showDescription ? 'Hide' : 'Describe'} the connections in words
        </button>
        {showDescription && (
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-2">
            {describeCircuit(circuit).map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
