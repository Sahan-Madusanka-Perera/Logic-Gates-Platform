import type { Lesson } from './types';

export const LESSONS_3: Lesson[] = [
  // ------------------------------------------------------------ 11
  {
    module: 'adders',
    multi: ['Cin', 'Cout'],
    intro: 'A CPU adds numbers with nothing but logic gates. Here you will see exactly how — starting with two bits, then three, then whole numbers.',
    sections: [
      {
        id: 'half',
        title: 'The half adder',
        source: 'N p.56–57',
        blocks: [
          {
            kind: 'text',
            md: 'Adding two bits has four cases: 0 + 0 = 0, 0 + 1 = 1, 1 + 0 = 1 and 1 + 1 = **10** (two). The answer needs two outputs: a **Sum** bit and a **Carry** bit.\n\n- Sum is 1 when exactly one bit is 1: [[S = A ⊕ B]].\n- Carry is 1 only for 1 + 1: [[C = A.B]].\n\nSo a half adder is one XOR gate and one AND gate. It is "half" because it cannot accept a carry from a previous column.',
          },
          { kind: 'explorer', id: 'exp-half', preset: 'half-adder' },
          { kind: 'quiz', id: 'quiz-half', questions: ['a-half-1', 'a-half-3', 'a-plus-2'] },
        ],
      },
      {
        id: 'full',
        title: 'The full adder',
        source: 'N p.58–60',
        blocks: [
          {
            kind: 'text',
            md: 'A **full adder** adds three bits: A, B and a carry in, Cin. The total can be 0, 1, 2 or 3, so the outputs are again a sum and a carry out:\n\n- [[S = A ⊕ B ⊕ Cin]] — 1 when an odd number of inputs are 1.\n- [[Cout = A.B + B.Cin + A.Cin]] — 1 when at least two inputs are 1. This can also be written [[Cout = A.B + Cin.(A ⊕ B)]].\n\nIt is built from **two half adders and an OR gate**: the first half adder adds A and B, the second adds Cin to that sum, and the OR combines the two carries.',
          },
          { kind: 'explorer', id: 'exp-full', preset: 'full-adder', multi: ['Cin'] },
          { kind: 'quiz', id: 'quiz-full', questions: ['a-full-1', 'a-full-2', 'a-count-1'] },
        ],
      },
      {
        id: 'ripple',
        title: 'Adding whole numbers: the ripple-carry adder',
        source: 'N p.61–62',
        blocks: [
          {
            kind: 'text',
            md: 'To add two 4-bit numbers, chain adders together: a half adder for bit 0 (there is no carry in) and a full adder for each higher bit. Each carry out feeds the next adder\'s carry in, so the carry **ripples** from right to left.\n\nChange the bits below and follow the carries.',
          },
          { kind: 'ripple', id: 'ripple-4', bits: 4 },
          { kind: 'quiz', id: 'quiz-ripple', questions: ['a-ripple-1', 'a-ripple-2'] },
        ],
      },
    ],
    recap: [
      'Half adder: [[S = A ⊕ B]], [[C = A.B]].',
      'Full adder: [[S = A ⊕ B ⊕ Cin]], [[Cout = A.B + Cin.(A ⊕ B)]]; two half adders and an OR gate.',
      'A ripple-carry adder chains adders; each carry out is the next carry in.',
    ],
  },

  // ------------------------------------------------------------ 12
  {
    module: 'storing-bits',
    intro: 'Every circuit so far forgets: change the inputs and the old output is gone. To build memory, a circuit must feed its own output back into itself.',
    sections: [
      {
        id: 'comb-seq',
        title: 'Combinational and sequential circuits',
        source: 'N p.63',
        blocks: [
          {
            kind: 'text',
            md: '- **Combinational**: the output depends **only on the current inputs**. No memory. Examples: logic gates, adders.\n- **Sequential**: the output depends on the current inputs **and past states**. Has memory (latches or flip-flops) and usually a clock signal. Examples: counters, registers.',
          },
          { kind: 'quiz', id: 'quiz-comb-seq', questions: ['l-comb-1'] },
        ],
      },
      {
        id: 'feedback',
        title: 'Feedback: the burglar alarm',
        source: 'N p.64–65',
        blocks: [
          {
            kind: 'text',
            md: 'An alarm driven by a door sensor stops as soon as the door is closed again. To make it **remember** that the door was opened, feed the output back into the OR gate. Now one pulse on S keeps Q at 1.\n\nTo be able to switch it off, add a **Reset**: AND the loop with NOT R. This gives [[Q = (S + Q).R\']]. Try it: set, release S, then reset.',
          },
          { kind: 'latch', id: 'latch-loop', latch: 'or-and' },
          { kind: 'quiz', id: 'quiz-feedback', questions: ['l-feedback-1'] },
        ],
      },
      {
        id: 'nor-latch',
        title: 'The SR latch with NOR gates',
        source: 'N p.66–68',
        blocks: [
          {
            kind: 'text',
            md: 'Two cross-coupled NOR gates make an **SR latch** with outputs Q and Q̄ (always opposite in normal use):\n\n- S = 1, R = 0 → **set**: Q = 1.\n- S = 0, R = 1 → **reset**: Q = 0.\n- S = 0, R = 0 → **memory**: Q keeps its value.\n- S = 1, R = 1 → **not allowed**: Q and Q̄ are both forced to 0.\n\nTry the sequence set → memory → reset → memory and watch the history table.',
          },
          { kind: 'latch', id: 'latch-nor', latch: 'nor' },
          { kind: 'quiz', id: 'quiz-nor', questions: ['l-mode-1', 'l-forbid-1', 'l-nor-seq-1'] },
        ],
      },
      {
        id: 'nand-latch',
        title: 'The SR latch with NAND gates',
        source: 'N p.69–70',
        blocks: [
          {
            kind: 'text',
            md: 'A NAND latch works "upside down": its inputs are **active-low**.\n\n- S = 0, R = 1 → set: Q = 1.\n- S = 1, R = 0 → reset: Q = 0.\n- S = 1, R = 1 → memory.\n- S = 0, R = 0 → not allowed (both outputs forced to 1).',
          },
          { kind: 'latch', id: 'latch-nand', latch: 'nand' },
          { kind: 'quiz', id: 'quiz-nand', questions: ['l-nand-1', 'l-nand-seq-1'] },
        ],
      },
      {
        id: 'registers',
        title: 'From latches to registers and memory',
        source: 'N p.65, p.71',
        blocks: [
          {
            kind: 'text',
            md: 'A latch or flip-flop stores **one bit**. A **data latch** adds gates so that a single data input is stored when an enable signal allows it. Put several side by side and you have a **register**: an n-bit register needs n flip-flops. Flip-flops are also the basic memory elements of RAM.',
          },
          { kind: 'quiz', id: 'quiz-reg', questions: ['l-reg-1'] },
        ],
      },
    ],
    recap: [
      'Combinational: output from current inputs only. Sequential: also depends on past states (memory).',
      'Feedback lets a circuit hold its own output; [[Q = (S + Q).R\']] remembers until reset.',
      'NOR latch: S = 1 sets, R = 1 resets, 00 holds, 11 not allowed.',
      'NAND latch: active-low — 0 sets/resets, 11 holds, 00 not allowed.',
      'An n-bit register is n flip-flops.',
    ],
  },

  // ------------------------------------------------------------ 13
  {
    module: 'integrated-circuits',
    intro: 'Real gates come packaged in integrated circuits (ICs). Knowing the two main families and how to read a pin-out lets you build any circuit from this unit on a breadboard.',
    sections: [
      {
        id: 'families',
        title: '4000 series (CMOS) and 7400 series (TTL)',
        source: 'N p.72–73',
        blocks: [
          {
            kind: 'text',
            md: 'An **IC** is a small semiconductor chip containing many components (transistors, resistors…) connected to do a job.\n\n- **4000 series — CMOS** (Complementary Metal–Oxide–Semiconductor): low power use and high noise immunity, works from about 3 V to 15 V, but slower (delays of tens of nanoseconds). Good for battery-powered devices. Examples: CD4001 (quad 2-input NOR), CD4011 (quad 2-input NAND).\n- **7400 series — TTL** (Transistor–Transistor Logic): fast (delays of a few nanoseconds), runs at a fixed 5 V, but uses more power and has lower noise immunity.',
          },
          { kind: 'quiz', id: 'quiz-families', questions: ['i-ttl-1'] },
        ],
      },
      {
        id: 'pinouts',
        title: 'Reading a pin-out',
        source: 'N p.74–76',
        blocks: [
          {
            kind: 'text',
            md: 'Common gate ICs have 14 pins. Pin 1 is next to the notch (or dot), and pins are numbered anticlockwise when viewed from the top. On the 74-series chips here, pin 14 is the supply and pin 7 is ground. Pick a chip and a gate, then try its inputs.',
          },
          { kind: 'ic', id: 'ic-viewer' },
          {
            kind: 'callout',
            tone: 'warn',
            title: 'Not every chip has the same layout',
            md: 'The 7402 (NOR) has its outputs on pins 1, 4, 10 and 13 — different from the 7400, 7408 and 7432. Always check the pin-out before wiring.',
          },
          { kind: 'quiz', id: 'quiz-pins', questions: ['i-id-1', 'i-id-3', 'i-pins-1', 'i-count-1'] },
        ],
      },
    ],
    recap: [
      '4000 series = CMOS: low power, 3–15 V, slower. 7400 series = TTL: fast, 5 V, more power.',
      'Pin 1 is beside the notch; count anticlockwise from the top.',
      'Quad = four gates per chip; hex = six. Check each chip\'s own pin-out.',
    ],
  },

  // ------------------------------------------------------------ 14
  {
    module: 'common-mistakes',
    intro: 'These are the mistakes that cost the most marks. Each one shows the wrong idea, why it seems right, why it fails, and the fix — then lets you practise it.',
    sections: [
      {
        id: 'catalogue',
        title: 'The mistakes, one by one',
        source: 'Synthesis of N and P',
        blocks: [
          { kind: 'misconceptions' },
        ],
      },
      {
        id: 'detective',
        title: 'Mistake detective',
        blocks: [
          { kind: 'text', md: 'Each question shows a student\'s answer. Find what went wrong.' },
          { kind: 'quiz', id: 'quiz-detective', questions: ['cm-detect-1', 'cm-detect-3', 'cm-detect-6', 'cm-detect-7'] },
        ],
      },
    ],
    recap: [
      'Check every bubble and every bar — and whether a bar covers a group or a single letter.',
      'AND before OR; brackets and bars first.',
      'XOR = odd number of 1s. 1 + 1 = 1 in logic.',
      '2ⁿ rows in counting order; minterm numbers start at 0.',
      'K-maps: Gray code, power-of-2 rectangles, no diagonals.',
      'Never use the forbidden latch input.',
    ],
  },
];
