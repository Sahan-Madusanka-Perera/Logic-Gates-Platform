import { GATE_INFO } from '@/lib/logic/gates';
import { evaluateCircuit } from '@/lib/logic/circuit';
import { exprToCircuit } from '@/lib/logic/convert';
import { parseExpression, toText } from '@/lib/logic/expression';
import { cellBits, cellIndex, kmapLayout } from '@/lib/logic/kmap';
import { runLatch } from '@/lib/logic/sequential';
import type { Bit } from '@/lib/logic/types';
import { intermediateModel, kmapModel, truthTableModel } from './check';
import type { Question, RichText } from './types';

const fmtAssign = (a: Record<string, Bit>) =>
  Object.entries(a)
    .map(([k, b]) => `${k} = ${b}`)
    .join(', ');

/** Gate-by-gate working for an expression and inputs, generated from the circuit engine. */
export function gateWorking(expr: string, assignment: Record<string, Bit>, opts: { fuse?: boolean; multi?: string[] } = {}): RichText[] {
  const built = exprToCircuit(parseExpression(expr, { variables: opts.multi }), { fuseNegations: opts.fuse ?? false });
  const r = evaluateCircuit(built.circuit, assignment);
  if (!r.ok) return [];
  return r.steps.map((s) => {
    const node = built.circuit.nodes.find((n) => n.id === s.nodeId);
    const label = node?.kind === 'gate' ? (node.label ?? s.nodeId) : s.nodeId;
    const name = GATE_INFO[s.gate].name;
    const article = /^(AND|OR|XOR|XNOR)$/.test(name) ? 'an' : 'a';
    const sub = built.gateExpr[s.nodeId];
    const plural = s.inputValues.length > 1;
    return `${label} is ${article} ${name} gate computing [[${sub ? toText(sub) : ''}]]. Its input${plural ? 's are' : ' is'} ${s.inputValues.join(', ')}, so its output is **${s.output}**.`;
  });
}

/** Binary questions reuse the figure's gate options so hint labels (G1, G2…) match the diagram. */
function figureFuse(q: Question): boolean {
  return q.figure?.kind === 'circuit' && q.figure.expr === (q as { expr?: string }).expr ? q.figure.fuse === true : false;
}

/** Gate-by-gate working only makes sense when the figure (if any) is the circuit drawn from the expression. */
function workingMatchesFigure(q: Question): boolean {
  return !q.figure || (q.figure.kind === 'circuit' && q.figure.expr === (q as { expr?: string }).expr);
}

/** Hints to show one by one. Uses the author's hints, or generates them from the engine. */
export function hintsFor(q: Question): RichText[] {
  if (q.hints && q.hints.length > 0) return q.hints;
  switch (q.type) {
    case 'binary': {
      const steps = workingMatchesFigure(q) ? gateWorking(q.expr, q.assignment, { fuse: figureFuse(q), multi: q.parseVariables }) : [];
      const first = steps[0];
      return [
        `Substitute the inputs: ${fmtAssign(q.assignment)}. Start with the gate(s) nearest the inputs.`,
        ...(first ? [first] : []),
        'Use each gate\'s output as an input to the next gate, until you reach the output.',
      ];
    }
    case 'intermediate': {
      const m = intermediateModel(q);
      const s = m.result.steps[0];
      return [
        'Work from the inputs towards the output. A gate can only be worked out once all its inputs are known.',
        s ? `Start with ${(m.circuit.nodes.find((n) => n.id === s.nodeId) as { label?: string }).label}: its inputs are ${s.inputValues.join(' and ')}.` : 'Start at the inputs.',
      ];
    }
    case 'truth-table': {
      const m = truthTableModel(q);
      return [
        `There are ${m.vars.length} input${m.vars.length > 1 ? 's' : ''}, so ${2 ** m.vars.length} rows, in counting order.`,
        m.cols.length > 0
          ? `Fill the column ${m.cols[0]?.label} first — the later columns use it.`
          : 'For each row, substitute the inputs and work out the brackets and bars first, then AND, then OR.',
        `Example — row ICN 1 (${m.vars.map((v) => `${v} = 0`).join(', ')}): the output is ${m.rows[0]?.values.out}.`,
      ];
    }
    case 'kmap-fill':
      return [
        'Each cell is one row of the truth table. Read the column label for the first variables and the row label for the rest.',
        'Columns go 00, 01, 11, 10 — not 00, 01, 10, 11. That is the Gray code order.',
      ];
    case 'latch-sequence':
      return [
        q.latch === 'nor'
          ? 'NOR latch: S = 1 sets Q to 1, R = 1 resets Q to 0, S = R = 0 keeps the previous Q.'
          : 'NAND latch inputs are active-low: S = 0 sets Q to 1, R = 0 resets Q to 0, S = R = 1 keeps the previous Q.',
        'Go one step at a time. In a "keep" step, copy Q from the step before.',
      ];
    default:
      return [];
  }
}

/** A worked solution: the correct answer plus the reasoning, for review screens. */
export function workedSolution(q: Question): { answer: RichText; steps: RichText[] } {
  switch (q.type) {
    case 'mcq': {
      const o = q.options.find((x) => x.id === q.answer);
      if (o?.expr) return { answer: `[[${o.expr}]]`, steps: [] };
      if (o?.text) return { answer: o.text, steps: [] };
      if (o?.figure?.kind === 'circuit') return { answer: `the circuit for [[${o.figure.expr}]] (marked above)`, steps: [] };
      return { answer: 'the option marked above', steps: [] };
    }
    case 'binary': {
      const steps = workingMatchesFigure(q) ? gateWorking(q.expr, q.assignment, { fuse: figureFuse(q), multi: q.parseVariables }) : [];
      const built = exprToCircuit(parseExpression(q.expr, { variables: q.parseVariables }));
      const r = evaluateCircuit(built.circuit, q.assignment);
      return { answer: r.ok ? String(r.outputs[built.outputId]) : '?', steps: [`Inputs: ${fmtAssign(q.assignment)}.`, ...steps] };
    }
    case 'intermediate': {
      const m = intermediateModel(q);
      return {
        answer: m.result.steps.map((s) => `${(m.circuit.nodes.find((n) => n.id === s.nodeId) as { label?: string }).label} = ${s.output}`).join(', '),
        steps: gateWorking(q.expr, q.assignment, { fuse: q.fuse, multi: q.parseVariables }),
      };
    }
    case 'truth-table': {
      const m = truthTableModel(q);
      const ones = m.rows.filter((r) => r.values.out === 1).map((r) => r.icn);
      return {
        answer: `Output column (ICN 1–${m.rows.length}): ${m.rows.map((r) => r.values.out).join(', ')}`,
        steps: [`[[${m.outputLabel} = ${q.expr}]] is 1 on rows ICN ${ones.join(', ') || '— none'} and 0 elsewhere.`],
      };
    }
    case 'kmap-fill': {
      const { layout, outs } = kmapModel(q);
      const L = kmapLayout(q.variables);
      const ones: string[] = [];
      for (let r = 0; r < L.rows; r++)
        for (let c = 0; c < L.cols; c++) if (outs[cellIndex(layout, { r, c })] === 1) ones.push(cellBits(layout, { r, c }).join(''));
      return { answer: `1s in cells ${ones.join(', ')}`, steps: [] };
    }
    case 'latch-sequence': {
      const steps = runLatch(q.latch, q.steps);
      return {
        answer: steps.map((s) => (s.after.q === null ? '?' : String(s.after.q))).join(', '),
        steps: steps.map((s, i) => `Step ${i + 1}: S = ${s.s}, R = ${s.r} → ${s.mode} → Q = ${s.after.q ?? '?'}`),
      };
    }
    case 'expression':
      return { answer: `[[${q.answer}]]`, steps: [] };
    case 'numeric':
      return { answer: String(q.answer), steps: [] };
  }
}
