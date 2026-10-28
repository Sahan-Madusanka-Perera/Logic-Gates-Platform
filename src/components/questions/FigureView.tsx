import { useMemo } from 'react';
import { CircuitDiagram } from '@/components/circuits/CircuitDiagram';
import { ExprView } from '@/components/expr/ExprView';
import { GateIcon } from '@/components/gates/GateSymbol';
import { SwitchCircuit } from '@/components/gates/SwitchCircuit';
import { VennDiagram } from '@/components/gates/VennDiagram';
import { KMapGrid } from '@/components/kmap/KMapGrid';
import { LatchDiagram } from '@/components/latch/LatchDiagram';
import { TruthTable } from '@/components/truth-tables/TruthTable';
import { circuitFromExpr } from '@/content/circuits';
import type { Figure } from '@/lib/assessment/types';
import { evaluateExpr, outputsOf, parseExpression, variablesOf } from '@/lib/logic/expression';
import { allCombinations } from '@/lib/logic/gates';
import { kmapLayout } from '@/lib/logic/kmap';
import type { Bit } from '@/lib/logic/types';

/** Renders a question or lesson figure. Every value shown is computed by the engine. */
export function FigureView({ figure, multi }: { figure: Figure; multi?: string[] }) {
  switch (figure.kind) {
    case 'circuit':
      return <ExprCircuitFigure figure={figure} multi={multi} />;
    case 'circuit-def':
      return (
        <figure className="m-0 rounded-xl border border-line bg-surface p-2">
          <CircuitDiagram circuit={figure.circuit} showValues={false} animate={false} />
          {figure.caption && <figcaption className="px-2 pb-1 text-sm text-ink-2">{figure.caption}</figcaption>}
        </figure>
      );
    case 'gate':
      return (
        <div className="flex justify-center rounded-xl border border-line bg-surface p-3">
          <GateIcon gate={figure.gate} inputs={figure.inputs ?? 2} size={150} title="A logic gate symbol (name hidden)" />
        </div>
      );
    case 'truth-table':
      return <TruthTableFigure figure={figure} multi={multi} />;
    case 'kmap': {
      const layout = kmapLayout(figure.variables);
      const outs = outputsOf(parseExpression(figure.expr, { variables: multi }), figure.variables);
      return <KMapGrid layout={layout} values={outs} />;
    }
    case 'switch':
      return <SwitchCircuit net={figure.net} lamp={figure.lamp} interactive={false} />;
    case 'venn':
      return (
        <div className="flex justify-center rounded-xl border border-line bg-surface p-3">
          <VennDiagram gate={figure.gate} />
        </div>
      );
    case 'latch':
      return (
        <div className="flex justify-center rounded-xl border border-line bg-surface p-3">
          <LatchDiagram kind={figure.latch} neutral />
        </div>
      );
  }
}

function ExprCircuitFigure({ figure, multi }: { figure: Extract<Figure, { kind: 'circuit' }>; multi?: string[] }) {
  const circuit = useMemo(
    () =>
      circuitFromExpr(figure.expr, {
        fuseNegations: figure.fuse ?? false,
        twoInputOnly: figure.twoInput ?? false,
        outputLabel: figure.outputLabel ?? 'F',
        multi: figure.variables ?? multi,
      }),
    [figure, multi],
  );
  return (
    <figure className="m-0 rounded-xl border border-line bg-surface p-2">
      <CircuitDiagram circuit={circuit} showValues={false} animate={false} />
      {figure.showExpr && (
        <figcaption className="px-2 pb-1 text-base">
          {figure.outputLabel ?? 'F'} = <ExprView expr={figure.expr} multi={figure.variables ?? multi} />
        </figcaption>
      )}
    </figure>
  );
}

function TruthTableFigure({ figure, multi }: { figure: Extract<Figure, { kind: 'truth-table' }>; multi?: string[] }) {
  const parsed = parseExpression(figure.expr, { variables: multi });
  const vars = figure.variables ?? variablesOf(parsed);
  const cols = (figure.columns ?? []).map((c, i) => ({ key: `c${i}`, label: c.label, expr: parseExpression(c.expr, { variables: multi }) }));
  const out = figure.outputLabel ?? 'F';
  const rows = allCombinations(vars.length).map((bits, i) => {
    const env = Object.fromEntries(vars.map((v, k) => [v, bits[k] as Bit]));
    return {
      icn: i + 1,
      cells: {
        ...Object.fromEntries(vars.map((v, k) => [v, bits[k] as Bit])),
        ...Object.fromEntries(cols.map((c) => [c.key, evaluateExpr(c.expr, env)])),
        __out: evaluateExpr(parsed, env),
      },
    };
  });
  return (
    <TruthTable
      compact
      columns={[
        ...vars.map((v) => ({ key: v, header: v, name: v, kind: 'input' as const })),
        ...cols.map((c) => ({ key: c.key, header: <ExprView expr={c.label} multi={multi} />, name: c.label, kind: 'mid' as const })),
        { key: '__out', header: out, name: out, kind: 'output' as const },
      ]}
      rows={rows}
    />
  );
}
