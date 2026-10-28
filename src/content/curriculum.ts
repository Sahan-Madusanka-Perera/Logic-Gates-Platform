/**
 * Modules and objectives, mirroring docs/logic-gates-curriculum-map.md.
 * Source references use printed page numbers of the supplied notes (N) and
 * year–question references of the past-paper compilation (P).
 */
export const MODULE_IDS = [
  'foundations',
  'basic-gates',
  'combinational-gates',
  'switch-circuits',
  'reading-circuits',
  'universal-gates',
  'boolean-laws',
  'sop-pos',
  'karnaugh-maps',
  'designing-circuits',
  'adders',
  'storing-bits',
  'integrated-circuits',
  'common-mistakes',
] as const;

export type ModuleId = (typeof MODULE_IDS)[number];

export type ObjectiveId =
  | 'F1' | 'F2' | 'F3' | 'F4' | 'F5'
  | 'G1' | 'G2' | 'G3' | 'G4' | 'G5' | 'G6' | 'G7' | 'G8' | 'G9'
  | 'S1' | 'S2'
  | 'C1' | 'C2' | 'C3' | 'C4'
  | 'U1' | 'U2' | 'U3'
  | 'B1' | 'B2' | 'B3' | 'B4'
  | 'P1' | 'P2' | 'P3' | 'P4'
  | 'K1' | 'K2' | 'K3' | 'K4'
  | 'D1' | 'D2' | 'D3'
  | 'A1' | 'A2' | 'A3'
  | 'L1' | 'L2' | 'L3' | 'L4'
  | 'I1' | 'I2';

export type ContentStatus = 'core' | 'core-notes' | 'supplementary';

export interface Objective {
  id: ObjectiveId;
  module: ModuleId;
  text: string;
  status: ContentStatus;
  source: string;
}

export interface ModuleInfo {
  id: ModuleId;
  number: number;
  title: string;
  tagline: string;
  stage: 'Foundations' | 'Gates' | 'Circuits' | 'Algebra' | 'Design' | 'Inside the computer' | 'Review';
  minutes: number;
  source: string;
}

export const MODULES: ModuleInfo[] = [
  { id: 'foundations', number: 1, title: 'Thinking in 0s and 1s', tagline: 'Boolean events, logic gates, input combinations and truth tables.', stage: 'Foundations', minutes: 15, source: 'N p.1–3' },
  { id: 'basic-gates', number: 2, title: 'The basic gates: NOT, AND, OR', tagline: 'The three building blocks every other circuit is made from.', stage: 'Gates', minutes: 20, source: 'N p.3–5, p.12' },
  { id: 'combinational-gates', number: 3, title: 'NAND, NOR, XOR and XNOR', tagline: 'Gates built from basic gates — and the XOR trap.', stage: 'Gates', minutes: 25, source: 'N p.5–11' },
  { id: 'switch-circuits', number: 4, title: 'Gates as switch circuits', tagline: 'Batteries, switches and bulbs that behave like gates.', stage: 'Gates', minutes: 15, source: 'N p.18–19' },
  { id: 'reading-circuits', number: 5, title: 'Circuits, expressions and truth tables', tagline: 'Move between a diagram, its expression and its truth table.', stage: 'Circuits', minutes: 30, source: 'N p.34–37' },
  { id: 'universal-gates', number: 6, title: 'Universal gates', tagline: 'Build anything from only NAND — or only NOR.', stage: 'Circuits', minutes: 25, source: 'N p.13–17, p.53–55' },
  { id: 'boolean-laws', number: 7, title: 'Boolean algebra and its laws', tagline: 'Simplify expressions step by step, naming every law.', stage: 'Algebra', minutes: 35, source: 'N p.20–28' },
  { id: 'sop-pos', number: 8, title: 'Minterms, maxterms, SOP and POS', tagline: 'Turn any truth table into an expression.', stage: 'Algebra', minutes: 30, source: 'N p.38–48' },
  { id: 'karnaugh-maps', number: 9, title: 'Karnaugh maps', tagline: 'Simplify by drawing groups instead of applying laws.', stage: 'Algebra', minutes: 35, source: 'N p.29–33' },
  { id: 'designing-circuits', number: 10, title: 'Designing circuits for a scenario', tagline: 'From a real-world problem to a working circuit.', stage: 'Design', minutes: 35, source: 'N p.34, p.49–55' },
  { id: 'adders', number: 11, title: 'Half adders and full adders', tagline: 'How logic gates add binary numbers.', stage: 'Inside the computer', minutes: 25, source: 'N p.56–62' },
  { id: 'storing-bits', number: 12, title: 'Storing bits: latches and flip-flops', tagline: 'Feedback loops that remember.', stage: 'Inside the computer', minutes: 30, source: 'N p.63–71' },
  { id: 'integrated-circuits', number: 13, title: 'Integrated circuits', tagline: 'Real chips: 7400 and 4000 series.', stage: 'Inside the computer', minutes: 15, source: 'N p.72–76' },
  { id: 'common-mistakes', number: 14, title: 'Common mistakes, fixed', tagline: 'The traps that cost marks — and how to avoid them.', stage: 'Review', minutes: 20, source: 'Synthesis of N and P' },
];

export const OBJECTIVES: Objective[] = [
  { id: 'F1', module: 'foundations', text: 'Explain a Boolean event and the meaning of 1 and 0.', status: 'core-notes', source: 'N p.1' },
  { id: 'F2', module: 'foundations', text: 'Describe what a logic gate does with its inputs and output.', status: 'core-notes', source: 'N p.1–2' },
  { id: 'F3', module: 'foundations', text: 'Work out the number of input combinations (2ⁿ).', status: 'core', source: 'N p.2' },
  { id: 'F4', module: 'foundations', text: 'Read and write truth tables in the correct row order.', status: 'core', source: 'N p.3–4' },
  { id: 'F5', module: 'foundations', text: 'Tell logical operations apart from arithmetic.', status: 'supplementary', source: 'Supplementary' },
  { id: 'G1', module: 'basic-gates', text: 'Use the NOT gate.', status: 'core', source: 'N p.3–4' },
  { id: 'G2', module: 'basic-gates', text: 'Use AND gates with two or more inputs.', status: 'core', source: 'N p.4' },
  { id: 'G3', module: 'basic-gates', text: 'Use OR gates with two or more inputs.', status: 'core', source: 'N p.5' },
  { id: 'G4', module: 'basic-gates', text: 'Match gates to Venn diagrams.', status: 'core-notes', source: 'N p.12' },
  { id: 'G5', module: 'combinational-gates', text: 'Use the NAND gate.', status: 'core', source: 'N p.5–6' },
  { id: 'G6', module: 'combinational-gates', text: 'Use the NOR gate.', status: 'core', source: 'N p.6' },
  { id: 'G7', module: 'combinational-gates', text: 'Use the XOR gate, including with three inputs.', status: 'core', source: 'N p.7' },
  { id: 'G8', module: 'combinational-gates', text: 'Use the XNOR gate.', status: 'core', source: 'N p.8' },
  { id: 'G9', module: 'combinational-gates', text: 'Build XOR from basic gates (SOP and POS).', status: 'core', source: 'N p.9–11' },
  { id: 'S1', module: 'switch-circuits', text: 'Read switch circuits as logic.', status: 'core', source: 'N p.18–19' },
  { id: 'S2', module: 'switch-circuits', text: 'Explain the two-way (staircase) switch circuit.', status: 'core', source: 'N p.19' },
  { id: 'C1', module: 'reading-circuits', text: 'Build a truth table for a circuit or expression.', status: 'core', source: 'N p.34, p.37' },
  { id: 'C2', module: 'reading-circuits', text: 'Write the expression for a circuit.', status: 'core', source: 'N p.34' },
  { id: 'C3', module: 'reading-circuits', text: 'Draw the circuit for an expression.', status: 'core', source: 'N p.35–36' },
  { id: 'C4', module: 'reading-circuits', text: 'Predict a circuit\'s output for given inputs.', status: 'core', source: 'N p.37' },
  { id: 'U1', module: 'universal-gates', text: 'Explain why universal gates are used.', status: 'core', source: 'N p.13' },
  { id: 'U2', module: 'universal-gates', text: 'Build NOT, AND, OR and others from NAND or NOR only.', status: 'core', source: 'N p.14–17' },
  { id: 'U3', module: 'universal-gates', text: 'Convert circuits to NAND-only or NOR-only form.', status: 'core', source: 'N p.53–55' },
  { id: 'B1', module: 'boolean-laws', text: 'Explain why we simplify circuits.', status: 'core-notes', source: 'N p.20' },
  { id: 'B2', module: 'boolean-laws', text: 'Name and state the Boolean laws.', status: 'core', source: 'N p.21' },
  { id: 'B3', module: 'boolean-laws', text: 'Prove a law with a truth table.', status: 'core', source: 'N p.21–28' },
  { id: 'B4', module: 'boolean-laws', text: 'Simplify expressions step by step.', status: 'core', source: 'N p.14–16, p.42–51' },
  { id: 'P1', module: 'sop-pos', text: 'Write minterms and maxterms.', status: 'core', source: 'N p.38–40' },
  { id: 'P2', module: 'sop-pos', text: 'Write SOP and POS expressions from a truth table.', status: 'core', source: 'N p.40' },
  { id: 'P3', module: 'sop-pos', text: 'Tell standard from non-standard expressions.', status: 'core-notes', source: 'N p.46–48' },
  { id: 'P4', module: 'sop-pos', text: 'Convert between SOP and POS.', status: 'core-notes', source: 'N p.41–45' },
  { id: 'K1', module: 'karnaugh-maps', text: 'Lay out K-maps in Gray-code order.', status: 'core', source: 'N p.29–31' },
  { id: 'K2', module: 'karnaugh-maps', text: 'Fill a K-map from a truth table.', status: 'core', source: 'N p.30–31' },
  { id: 'K3', module: 'karnaugh-maps', text: 'Group cells using the rules.', status: 'core', source: 'N p.32–33' },
  { id: 'K4', module: 'karnaugh-maps', text: 'Read simplified SOP and POS from groups.', status: 'core', source: 'N p.51–52' },
  { id: 'D1', module: 'designing-circuits', text: 'Define inputs and outputs for a scenario.', status: 'core', source: 'N p.49' },
  { id: 'D2', module: 'designing-circuits', text: 'Design a circuit from a scenario.', status: 'core', source: 'N p.49–55' },
  { id: 'D3', module: 'designing-circuits', text: 'Recognise the majority ("at least two") function.', status: 'core', source: 'N p.49' },
  { id: 'A1', module: 'adders', text: 'Explain and build a half adder.', status: 'core', source: 'N p.56–57' },
  { id: 'A2', module: 'adders', text: 'Explain and build a full adder.', status: 'core', source: 'N p.58–60' },
  { id: 'A3', module: 'adders', text: 'Trace a multi-bit (ripple) adder.', status: 'core-notes', source: 'N p.61–62' },
  { id: 'L1', module: 'storing-bits', text: 'Compare combinational and sequential circuits.', status: 'core', source: 'N p.63' },
  { id: 'L2', module: 'storing-bits', text: 'Explain a feedback loop.', status: 'core-notes', source: 'N p.64–65' },
  { id: 'L3', module: 'storing-bits', text: 'Predict SR latch outputs (NOR and NAND).', status: 'core', source: 'N p.66–70' },
  { id: 'L4', module: 'storing-bits', text: 'Relate latches to registers and memory.', status: 'core', source: 'N p.71' },
  { id: 'I1', module: 'integrated-circuits', text: 'Compare 4000 (CMOS) and 7400 (TTL) series ICs.', status: 'core-notes', source: 'N p.72–73' },
  { id: 'I2', module: 'integrated-circuits', text: 'Read a gate IC pin-out.', status: 'core-notes', source: 'N p.74–76' },
];

export const moduleById = (id: ModuleId): ModuleInfo => MODULES.find((m) => m.id === id) as ModuleInfo;
export const objectiveById = (id: ObjectiveId): Objective => OBJECTIVES.find((o) => o.id === id) as Objective;
export const objectivesOf = (module: ModuleId): Objective[] => OBJECTIVES.filter((o) => o.module === module);
export const moduleOfObjective = (id: ObjectiveId): ModuleId => objectiveById(id).module;

export function nextModule(id: ModuleId): ModuleInfo | undefined {
  const i = MODULES.findIndex((m) => m.id === id);
  return MODULES[i + 1];
}

export function previousModule(id: ModuleId): ModuleInfo | undefined {
  const i = MODULES.findIndex((m) => m.id === id);
  return i > 0 ? MODULES[i - 1] : undefined;
}

export const STATUS_LABEL: Record<ContentStatus, string> = {
  core: 'Core — in the notes and examined in past papers',
  'core-notes': 'Core — in the notes',
  supplementary: 'Supplementary — extra help, not from the notes',
};
