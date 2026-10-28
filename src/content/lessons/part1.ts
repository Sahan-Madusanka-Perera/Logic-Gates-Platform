import { GATE_SWITCH_CIRCUITS, nc, no, parallel, series } from '@/lib/logic/switches';
import type { Lesson } from './types';

export const LESSONS_1: Lesson[] = [
  // ------------------------------------------------------------ 1
  {
    module: 'foundations',
    intro:
      'Every digital device — your phone, a calculator, a traffic light controller — is built from tiny circuits that only understand two values. This lesson sets up the language for the whole unit: Boolean events, logic gates, input combinations and truth tables.',
    sections: [
      {
        id: 'events',
        title: 'Boolean events: only two states',
        source: 'N p.1',
        blocks: [
          {
            kind: 'text',
            md: 'A **Boolean event** is something that can be in exactly one of two states: a switch is on or off, a door is open or closed, a statement is true or false.\n\nWe write the two states as **1** and **0**:\n\n- 1 = true, on, high voltage (about 5 V in many circuits)\n- 0 = false, off, low voltage (0 V)\n\nThese two values are called *logic levels*. Because there are only two, we never get answers like 2 or 0.5 in logic.',
          },
          {
            kind: 'callout',
            tone: 'note',
            title: 'How this app shows 0 and 1',
            md: 'A wire carrying **1** is drawn as a thick, solid, amber line. A wire carrying **0** is a thinner, dashed, slate line. The value is also always written as a number, so you never have to rely on colour.',
          },
        ],
      },
      {
        id: 'gates',
        title: 'What a logic gate does',
        source: 'N p.1–2',
        blocks: [
          {
            kind: 'text',
            md: 'A **logic gate** is an electronic circuit with one or more inputs and one output. Each input is 0 or 1, and the gate follows a fixed rule to decide whether its output is 0 or 1.\n\nGates are drawn as symbols. Inputs come in on the left and the output leaves on the right. Try the AND gate below: switch the inputs and watch the output, the expression and the truth table change together.',
          },
          { kind: 'gate-sim', id: 'sim-and', gate: 'AND', allowThree: false },
        ],
      },
      {
        id: 'combinations',
        title: 'How many input combinations?',
        source: 'N p.2',
        blocks: [
          {
            kind: 'text',
            md: 'Each input has 2 possible values. Every extra input **doubles** the number of combinations:\n\n- 1 input: 2 combinations\n- 2 inputs: 2 × 2 = 4\n- 3 inputs: 2 × 2 × 2 = 8\n- n inputs: 2ⁿ combinations\n\nSo a gate with 3 inputs has 2³ = 8 input combinations, and its truth table has 8 rows.',
          },
          { kind: 'quiz', id: 'quiz-comb', questions: ['f-comb-1', 'f-comb-2'] },
        ],
      },
      {
        id: 'truth-tables',
        title: 'Truth tables in counting order',
        source: 'N p.3–4',
        blocks: [
          {
            kind: 'text',
            md: 'A **truth table** lists every input combination and the output for each one. To make sure no row is missed or repeated, write the rows in **binary counting order**: 000, 001, 010, 011, 100, …\n\n- The first input column is half 0s, then half 1s.\n- The next column halves again.\n- The last column alternates 0, 1, 0, 1.\n\nThe notes number the rows with the **ICN** (input combination number), starting at 1. Minterm numbers (lesson 8) start at 0, so row ICN 1 is m0.',
          },
          { kind: 'figure', figure: { kind: 'truth-table', expr: 'A.B.C' }, caption: 'Truth table for a 3-input AND gate, in counting order. The first column (A) is 0 0 0 0 1 1 1 1.' },
          { kind: 'quiz', id: 'quiz-order', questions: ['f-order-1', 'f-icn-1'] },
        ],
      },
      {
        id: 'not-arithmetic',
        title: 'Logic is not arithmetic',
        source: 'Supplementary',
        blocks: [
          {
            kind: 'text',
            md: 'Boolean expressions borrow the symbols + and . from arithmetic, but they mean something different:\n\n- [[A + B]] means A **OR** B. So 1 + 1 = 1.\n- [[A.B]] means A **AND** B. So 1.1 = 1 and 1.0 = 0.\n\nAdding binary numbers (where 1 + 1 = 10) is a separate job. In lesson 11 you will see how an adder circuit does it with gates.',
          },
          { kind: 'quiz', id: 'quiz-plus', questions: ['f-plus-1'] },
        ],
      },
    ],
    recap: [
      'A Boolean event has exactly two states, written 1 and 0.',
      'A logic gate turns binary inputs into one binary output by a fixed rule.',
      'n inputs give 2ⁿ combinations — 8 for three inputs, 16 for four.',
      'Write truth-table rows in binary counting order. ICN starts at 1; minterm numbers start at 0.',
      'In logic, + means OR and . means AND: 1 + 1 = 1.',
    ],
  },

  // ------------------------------------------------------------ 2
  {
    module: 'basic-gates',
    intro: 'NOT, AND and OR are the three basic gates. Every other gate and every circuit in this unit can be built from them.',
    sections: [
      {
        id: 'not',
        title: 'NOT: the inverter',
        source: 'N p.3–4',
        blocks: [
          {
            kind: 'text',
            md: 'A **NOT** gate has one input and gives the opposite value: NOT 0 = 1 and NOT 1 = 0.\n\nWe write NOT A as [[A\']] — a bar over A, read "A bar" or "NOT A". (Some books write A\' with a prime; this app accepts both when you type.) The small circle at the output of the symbol, the **bubble**, means "invert".',
          },
          { kind: 'gate-sim', id: 'sim-not', gate: 'NOT' },
        ],
      },
      {
        id: 'and',
        title: 'AND: every input must be 1',
        source: 'N p.4',
        blocks: [
          {
            kind: 'text',
            md: 'An **AND** gate outputs 1 only when **all** its inputs are 1. A single 0 makes the output 0.\n\nWe write A AND B as [[A.B]] (or simply AB). With three inputs: [[A.B.C]]. Switch to 3 inputs in the simulator and check that only the last row gives 1.',
          },
          { kind: 'gate-sim', id: 'sim-and2', gate: 'AND', venn: true },
        ],
      },
      {
        id: 'or',
        title: 'OR: at least one input is 1',
        source: 'N p.5',
        blocks: [
          {
            kind: 'text',
            md: 'An **OR** gate outputs 1 when **at least one** input is 1. It outputs 0 only when every input is 0.\n\nWe write A OR B as [[A + B]].',
          },
          { kind: 'gate-sim', id: 'sim-or', gate: 'OR', venn: true },
          {
            kind: 'callout',
            tone: 'warn',
            title: 'The most common slip',
            md: 'Swapping AND and OR. Ask: "Does it need **all** inputs (AND) or **any** input (OR)?" AND has a flat back and a round front; OR has a curved back and a pointed front.',
          },
        ],
      },
      {
        id: 'venn',
        title: 'Gates as Venn diagrams',
        source: 'N p.12',
        blocks: [
          {
            kind: 'text',
            md: 'Think of circle A as "A = 1" and circle B as "B = 1". The shaded region is where the gate outputs 1:\n\n- AND → only the overlap (intersection)\n- OR → both circles (union)\n- NOT A → everything outside circle A\n\nThe simulators above show each gate\'s Venn diagram; the dashed outline marks the region for the current inputs.',
          },
          { kind: 'quiz', id: 'quiz-basic', questions: ['g-and-1', 'g-or-2', 'mc-and-or-1', 'g-venn-1'] },
        ],
      },
    ],
    recap: [
      'NOT inverts: [[A\']] is 1 when A is 0. The bubble means "invert".',
      'AND ([[A.B]]) is 1 only when every input is 1.',
      'OR ([[A + B]]) is 0 only when every input is 0.',
      'Venn diagrams: AND = overlap, OR = both circles, NOT = outside.',
    ],
  },

  // ------------------------------------------------------------ 3
  {
    module: 'combinational-gates',
    intro: 'Four more gates appear in every past paper. NAND and NOR add a bubble to AND and OR. XOR and XNOR compare their inputs — and XOR has a trap with three inputs.',
    sections: [
      {
        id: 'nand-nor',
        title: 'NAND and NOR: add a bubble',
        source: 'N p.5–6',
        blocks: [
          {
            kind: 'text',
            md: '**NAND** = NOT AND. Work out AND, then invert: [[F = (A.B)\']]. NAND is 0 only when all inputs are 1.\n\n**NOR** = NOT OR: [[F = (A + B)\']]. NOR is 1 only when all inputs are 0.\n\nThe long bar covers the whole of [[A.B]] — it inverts the **result**, not each input.',
          },
          { kind: 'gate-sim', id: 'sim-nand', gate: 'NAND' },
          { kind: 'gate-sim', id: 'sim-nor', gate: 'NOR' },
          { kind: 'quiz', id: 'quiz-bubble', questions: ['g-nand-1', 'mc-bubble-1'] },
        ],
      },
      {
        id: 'xor',
        title: 'XOR: exclusive OR',
        source: 'N p.7',
        blocks: [
          {
            kind: 'text',
            md: 'For two inputs, **XOR** gives 1 when **exactly one** input is 1 — when the inputs are **different**. We write [[A ⊕ B]].\n\nCompare it with OR: they agree on every row except 11, where OR gives 1 and XOR gives 0.',
          },
          { kind: 'gate-sim', id: 'sim-xor', gate: 'XOR', venn: true },
          {
            kind: 'callout',
            tone: 'exam',
            title: 'XOR with three or more inputs',
            md: 'The notes define XOR by **odd parity**: the output is 1 when an **odd** number of inputs are 1. So [[A ⊕ B ⊕ C]] is 1 for 001, 010, 100 **and 111**. "Exactly one input is 1" only works for two inputs. Switch the simulator above to 3 inputs and check the last row.',
          },
          { kind: 'quiz', id: 'quiz-xor', questions: ['g-xor-1', 'g-xor3-1', 'mc-xor-1'] },
        ],
      },
      {
        id: 'xnor',
        title: 'XNOR: the equality gate',
        source: 'N p.8',
        blocks: [
          {
            kind: 'text',
            md: '**XNOR** = NOT XOR: [[F = (A ⊕ B)\']]. For two inputs it gives 1 when the inputs are the **same** (00 or 11).',
          },
          { kind: 'gate-sim', id: 'sim-xnor', gate: 'XNOR' },
        ],
      },
      {
        id: 'xor-basic',
        title: 'Building XOR from basic gates',
        source: 'N p.9–11',
        blocks: [
          {
            kind: 'text',
            md: 'XOR is 1 on rows 01 and 10. Writing a term for each of those rows (lesson 8 explains this method) gives the **sum of products**:\n\n[[A ⊕ B = A\'.B + A.B\']]\n\nXOR is 0 on rows 00 and 11, which gives the **product of sums**:\n\n[[A ⊕ B = (A + B).(A\' + B\')]]\n\nStep through the SOP circuit below and compare its truth table with XOR\'s.',
          },
          { kind: 'explorer', id: 'exp-xor-sop', preset: 'xor-sop' },
          { kind: 'quiz', id: 'quiz-xor-basic', questions: ['g-xor-sop'] },
        ],
      },
    ],
    recap: [
      'NAND = AND then NOT; NOR = OR then NOT. Find the result without the bubble, then flip it.',
      'Two-input XOR is 1 when the inputs differ; XOR(1, 1) = 0.',
      'Multi-input XOR is 1 for an **odd** number of 1s.',
      'XNOR is 1 when the inputs are equal.',
      '[[A ⊕ B = A\'.B + A.B\' = (A + B).(A\' + B\')]].',
    ],
  },

  // ------------------------------------------------------------ 4
  {
    module: 'switch-circuits',
    intro: 'Before chips, logic was built from switches and bulbs. Reading a switch circuit as a gate is a common exam question — and it makes the gate rules feel physical.',
    sections: [
      {
        id: 'series-parallel',
        title: 'Series = AND, parallel = OR',
        source: 'N p.18–19',
        blocks: [
          {
            kind: 'text',
            md: 'Let a pressed (closed) switch be 1 and a lit bulb be 1.\n\n- Switches in **series** (one after another): current flows only if A **and** B are closed → AND.\n- Switches in **parallel** (side by side): current flows if A **or** B is closed → OR.\n\nPress the switches below.',
          },
          { kind: 'switch', id: 'sw-and', net: GATE_SWITCH_CIRCUITS.AND.net, lamp: 'series', caption: 'Series: the bulb is S1 AND S2.' },
          { kind: 'switch', id: 'sw-or', net: GATE_SWITCH_CIRCUITS.OR.net, lamp: 'series', caption: 'Parallel: the bulb is S1 OR S2.' },
        ],
      },
      {
        id: 'shunt',
        title: 'Switches across the bulb: NOT, NAND, NOR',
        source: 'N p.19',
        blocks: [
          {
            kind: 'text',
            md: 'If the switch is wired **across** the bulb (with a resistor protecting the battery), closing it gives the current an easier path, so the bulb goes **out**. The bulb is now the opposite of the switch network:\n\n- one switch across the bulb → NOT\n- two switches in series across the bulb → NAND\n- two switches in parallel across the bulb → NOR',
          },
          { kind: 'switch', id: 'sw-not', net: GATE_SWITCH_CIRCUITS.NOT.net, lamp: 'shunt', caption: 'Pressing S shorts the bulb: bulb = NOT S.' },
          { kind: 'switch', id: 'sw-nor', net: GATE_SWITCH_CIRCUITS.NOR.net, lamp: 'shunt', caption: 'Parallel switches across the bulb: NOR.' },
        ],
      },
      {
        id: 'two-way',
        title: 'Two-way switches: XOR and XNOR',
        source: 'N p.19',
        blocks: [
          {
            kind: 'text',
            md: 'A **two-way switch** connects its common terminal to one of two contacts. Here position 1 = up and 0 = down; a contact marked ′ is closed when the switch is **down**.\n\nWith two two-way switches cross-wired, the bulb lights when the switches are in **different** positions: [[A.B\' + A\'.B = A ⊕ B]]. This is the staircase light: either switch can turn it on or off.',
          },
          { kind: 'switch', id: 'sw-xor', net: parallel(series(no('A'), nc('B')), series(nc('A'), no('B'))), lamp: 'series', caption: 'Staircase wiring: XOR.' },
          { kind: 'quiz', id: 'quiz-switch', questions: ['s-series-1', 's-shunt-1', 's-stair-1'] },
        ],
      },
    ],
    recap: [
      'Series switches = AND; parallel switches = OR.',
      'A switch network wired across the bulb inverts it: NOT, NAND (series), NOR (parallel).',
      'Two cross-wired two-way switches = XOR (the staircase light); straight-wired = XNOR.',
    ],
  },

  // ------------------------------------------------------------ 5
  {
    module: 'reading-circuits',
    intro: 'A circuit, its Boolean expression and its truth table are three views of the same thing. This lesson shows how to move between them — the core skill tested in almost every paper.',
    sections: [
      {
        id: 'circuit-to-expr',
        title: 'Circuit → expression: label every gate',
        source: 'N p.34',
        blocks: [
          {
            kind: 'text',
            md: 'Work from the inputs to the output. Write the output of **every** gate next to it, then use those expressions as inputs to the next gate.\n\nFor the circuit below: the OR gate gives [[A + B]], the AND gate gives [[(A + B).C]], and the NOT gate puts a bar over the whole thing: [[F = ((A + B).C)\']].',
          },
          { kind: 'explorer', id: 'exp-peel', preset: 'peeling' },
          { kind: 'quiz', id: 'quiz-c2e', questions: ['c-expr-1', 'mc-bar-1'] },
        ],
      },
      {
        id: 'precedence',
        title: 'Order of operations',
        source: 'N p.34–35',
        blocks: [
          {
            kind: 'text',
            md: 'Just as × comes before + in arithmetic, Boolean operations have an order:\n\n1. brackets, and bars over a group\n2. NOT on single letters\n3. AND (.)\n4. OR (+)\n\nSo [[A + B.C]] means A + (B.C), not (A + B).C.',
          },
          { kind: 'quiz', id: 'quiz-prec', questions: ['c-prec-1', 'mc-prec-1'] },
        ],
      },
      {
        id: 'expr-to-circuit',
        title: 'Expression → circuit: the peeling method',
        source: 'N p.35–36',
        blocks: [
          {
            kind: 'text',
            md: 'To draw a circuit, start at the **output** and peel the expression like an onion. Look at the whole expression and find its outermost operation, checking in the order **bar → plus → dot**:\n\n1. Is there a bar over everything? Draw a NOT gate; its input is what is under the bar.\n2. Otherwise, is there a + outside all brackets? Draw an OR gate; each term is an input.\n3. Otherwise, the dot outside all brackets: draw an AND gate.\n\nRepeat for each input until only letters remain.',
          },
          { kind: 'peel', id: 'peel-1', expr: "((A + B).C)'" },
          { kind: 'peel', id: 'peel-2', expr: "A.B' + (B + C)'" },
        ],
      },
      {
        id: 'truth-table',
        title: 'Circuit → truth table, and predicting outputs',
        source: 'N p.34, p.37',
        blocks: [
          {
            kind: 'text',
            md: 'Give every gate its own column in the truth table. Fill the columns from left to right — each one uses the columns before it. This is slower than guessing, but it is how you avoid the most common mistake: jumping straight to the output.\n\nIn the explorer, press **Step** to evaluate one gate at a time.',
          },
          { kind: 'explorer', id: 'exp-majority', preset: 'majority' },
          { kind: 'quiz', id: 'quiz-int', questions: ['c-int-1', 'c-out-2', 'c-tt-1'] },
        ],
      },
    ],
    recap: [
      'Circuit → expression: write the output of every gate, working from inputs to output.',
      'A NOT after a gate puts one long bar over that gate\'s whole expression.',
      'Order: brackets/bars, NOT, AND, OR. [[A + B.C]] = A + (B.C).',
      'Expression → circuit: peel from the output, bar → plus → dot.',
      'Truth tables: one column per gate, filled left to right.',
    ],
  },
];
