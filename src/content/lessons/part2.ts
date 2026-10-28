import type { Lesson } from './types';

export const LESSONS_2: Lesson[] = [
  // ------------------------------------------------------------ 6
  {
    module: 'universal-gates',
    intro: 'NAND and NOR are called universal gates: with enough of either one you can build any circuit at all. Factories like that — one type of chip does everything.',
    sections: [
      {
        id: 'why',
        title: 'Why universal gates?',
        source: 'N p.13',
        blocks: [
          {
            kind: 'text',
            md: 'NOT, AND and OR can each be built from NAND gates alone, or from NOR gates alone. Since every circuit can be written with NOT, AND and OR, one gate type is enough. The notes list the reasons for using them:\n\n- **Cost** — only one type of IC needs to be made and stocked.\n- **Standardisation** — designs, testing and repairs use the same part.\n- **Flexibility** — any function can be built.\n- **Reliability** — fewer kinds of component.\n\nThe drawback is **efficiency**: a NAND-only version can need more gates than the original design.',
          },
          { kind: 'quiz', id: 'quiz-why', questions: ['u-why-1', 'u-why-2'] },
        ],
      },
      {
        id: 'nand',
        title: 'Everything from NAND',
        source: 'N p.14–15',
        blocks: [
          {
            kind: 'text',
            md: '- **NOT**: join both inputs: [[(A.A)\' = A\']].\n- **AND**: NAND, then a NAND used as NOT: [[((A.B)\')\' = A.B]] — 2 gates.\n- **OR**: invert each input, then NAND: [[(A\'.B\')\' = A + B]] by De Morgan — 3 gates.\n\nXOR needs only **4** NAND gates if one gate is shared. Step through it below.',
          },
          { kind: 'explorer', id: 'exp-nand-xor', preset: 'nand-xor' },
          { kind: 'quiz', id: 'quiz-nand', questions: ['u-not-1', 'u-and-1', 'u-or-1'] },
        ],
      },
      {
        id: 'nor',
        title: 'Everything from NOR',
        source: 'N p.16–17',
        blocks: [
          {
            kind: 'text',
            md: '- **NOT**: join both inputs: [[(A + A)\' = A\']].\n- **OR**: NOR, then a NOR used as NOT: [[((A + B)\')\' = A + B]].\n- **AND**: invert each input, then NOR: [[(A\' + B\')\' = A.B]].\n\nNotice the pattern: NOR makes OR the way NAND makes AND, and the other way round.',
          },
          { kind: 'quiz', id: 'quiz-nor', questions: ['u-nor-not', 'u-nor-and'] },
        ],
      },
      {
        id: 'convert',
        title: 'Converting a circuit to NAND-only',
        source: 'N p.53–55',
        blocks: [
          {
            kind: 'worked',
            id: 'w-nand',
            title: 'Make [[F = A.B + C.D]] NAND-only',
            steps: [
              'Put a double bar over the whole expression. Two NOTs cancel (double complement), so nothing changes: [[F = ((A.B + C.D)\')\']].',
              'Break the **lower** bar with De Morgan\'s law — "break the line, change the sign": [[(A.B + C.D)\' = (A.B)\'.(C.D)\']].',
              'So [[F = ((A.B)\'.(C.D)\')\']]. Every operation is now a NAND: two NANDs make [[(A.B)\']] and [[(C.D)\']], and a third NAND combines them.',
              'Rule of thumb: an AND–OR (SOP) circuit becomes NAND–NAND. For NOR-only, start from a POS: an OR–AND circuit becomes NOR–NOR.',
            ],
          },
          { kind: 'quiz', id: 'quiz-convert', questions: ['u-convert-1'] },
        ],
      },
    ],
    recap: [
      'NAND and NOR are universal: each alone can build NOT, AND and OR.',
      'Reasons: cost, standardisation, flexibility, reliability. Drawback: possibly more gates.',
      'NOT = a NAND (or NOR) with its inputs joined.',
      'SOP → NAND–NAND; POS → NOR–NOR, using a double bar and De Morgan.',
    ],
  },

  // ------------------------------------------------------------ 7
  {
    module: 'boolean-laws',
    intro: 'Boolean algebra lets you simplify an expression on paper, so the circuit needs fewer gates. Every step uses a named law — and in the exam, naming the law earns marks.',
    sections: [
      {
        id: 'why-simplify',
        title: 'Why simplify?',
        source: 'N p.20',
        blocks: [
          {
            kind: 'text',
            md: 'A simpler expression has **the same truth table** but needs fewer gates. That makes the circuit cheaper, smaller, faster and less power-hungry, and there are fewer parts to fail.',
          },
        ],
      },
      {
        id: 'laws',
        title: 'The laws',
        source: 'N p.21',
        blocks: [
          {
            kind: 'text',
            md: 'Each law comes in an OR form and an AND form:\n\n- **Commutative**: [[A + B = B + A]], [[A.B = B.A]]\n- **Associative**: [[(A + B) + C = A + (B + C)]], [[(A.B).C = A.(B.C)]]\n- **Distributive**: [[A.(B + C) = A.B + A.C]], [[A + B.C = (A + B).(A + C)]]\n- **Identity**: [[A + 0 = A]], [[A.1 = A]], [[A + 1 = 1]], [[A.0 = 0]]\n- **Complement**: [[A + A\' = 1]], [[A.A\' = 0]]\n- **Idempotent**: [[A + A = A]], [[A.A = A]]\n- **Double complement**: [[A\'\' = A]]\n- **Redundancy** (absorption): [[A + A.B = A]], [[A + A\'.B = A + B]], [[A.(A + B) = A]]\n- **De Morgan\'s**: [[(A + B)\' = A\'.B\']], [[(A.B)\' = A\' + B\']]',
          },
          {
            kind: 'callout',
            tone: 'note',
            title: 'Names used here',
            md: 'This app uses the law names from the notes. The notes put [[A + 1 = 1]] and [[A.0 = 0]] under the Identity law and call absorption the Redundancy law; other books may say "null law" and "absorption law".',
          },
          { kind: 'quiz', id: 'quiz-names', questions: ['law-name-1', 'law-name-2', 'law-name-4'] },
        ],
      },
      {
        id: 'demorgan',
        title: 'De Morgan: break the line, change the sign',
        source: 'N p.27–28',
        blocks: [
          {
            kind: 'text',
            md: 'To remove a long bar, **break** it into short bars over each part **and change the operator** under it: dot becomes plus, plus becomes dot.\n\n[[(A.B)\' = A\' + B\']] and [[(A + B)\' = A\'.B\']]\n\nIt works for any number of variables: [[(A.B.C)\' = A\' + B\' + C\']]. Compare the two circuits in the explorer — NOT on each input followed by OR has exactly the NAND truth table.',
          },
          { kind: 'explorer', id: 'exp-demorgan', preset: 'demorgan', showGateColumns: false },
          { kind: 'quiz', id: 'quiz-dm', questions: ['law-dm-1', 'law-dm-2', 'mc-demorgan-1'] },
        ],
      },
      {
        id: 'prove',
        title: 'Proving a law with a truth table',
        source: 'N p.21–28',
        blocks: [
          {
            kind: 'text',
            md: 'Two expressions are equal when their columns match on **every** row. To prove a law, give each side its own column. The explorer below shows [[(X + Y).(X + Z)]]; its output column is the same as [[X + Y.Z]] — the second distributive law.',
          },
          { kind: 'explorer', id: 'exp-distributive', preset: 'distributive' },
          { kind: 'quiz', id: 'quiz-prove', questions: ['law-tt-1'] },
        ],
      },
      {
        id: 'simplify',
        title: 'Simplifying step by step',
        source: 'N p.14–16, p.42–51',
        blocks: [
          {
            kind: 'worked',
            id: 'w-simp',
            title: 'Simplify [[A + A\'.B]]',
            steps: [
              '[[A + A\'.B = (A + A\').(A + B)]] — Distributive law ([[X + Y.Z = (X + Y).(X + Z)]]).',
              '[[= 1.(A + B)]] — Complement law ([[A + A\' = 1]]).',
              '[[= A + B]] — Identity law ([[1.X = X]]).',
            ],
          },
          {
            kind: 'text',
            md: 'Now you try. Type each line and choose the law you used. The checker compares every line with the one before it on all input rows, and checks that the law you chose turns one into the other. As in the notes, use one law per line: you may apply it in several places at once.',
          },
          {
            kind: 'simplify',
            id: 'simp-1',
            start: "A.B + A.B'",
            worked: [
              { expr: "A.B + A.B'", law: '' },
              { expr: "A.(B + B')", law: 'Distributive law' },
              { expr: 'A.1', law: 'Complement law' },
              { expr: 'A', law: 'Identity law' },
            ],
          },
          {
            kind: 'simplify',
            id: 'simp-2',
            start: "A'.B + A.B + A.B'",
            worked: [
              { expr: "A'.B + A.B + A.B'", law: '' },
              { expr: "A'.B + A.B + A.B + A.B'", law: 'Idempotent law' },
              { expr: "(A' + A).B + A.(B + B')", law: 'Distributive law' },
              { expr: '1.B + A.1', law: 'Complement law' },
              { expr: 'B + A', law: 'Identity law' },
              { expr: 'A + B', law: 'Commutative law' },
            ],
          },
          { kind: 'quiz', id: 'quiz-simp', questions: ['law-step-1', 'law-simp-2', 'law-simp-4'] },
        ],
      },
    ],
    recap: [
      'Simplifying keeps the truth table but uses fewer gates.',
      'Learn the laws with their notes names: commutative, associative, distributive, identity, complement, idempotent, double complement, redundancy, De Morgan.',
      'De Morgan: break the line, change the sign.',
      'Two expressions are equal when their truth-table columns match on every row.',
      'Name the law on every line of a simplification.',
    ],
  },

  // ------------------------------------------------------------ 8
  {
    module: 'sop-pos',
    intro: 'Given any truth table, you can write an expression for it straight away — as a sum of products (SOP) from the 1s, or a product of sums (POS) from the 0s.',
    sections: [
      {
        id: 'minterms',
        title: 'Minterms and maxterms',
        source: 'N p.38–40',
        blocks: [
          {
            kind: 'text',
            md: 'A **minterm** is an AND of every variable that equals 1 on exactly **one** row. Bar the variables that are **0** on that row. Row A = 0, B = 1 → [[A\'.B]].\n\nA **maxterm** is an OR of every variable that equals 0 on exactly one row. Bar the variables that are **1**. Row A = 0, B = 1 → [[A + B\']].\n\nMinterms and maxterms are numbered by the row\'s binary value, **starting from 0**: row 011 is m3 (and M3), even though its ICN is 4.',
          },
          { kind: 'figure', figure: { kind: 'truth-table', expr: "A'.B", columns: [{ label: "A'.B'", expr: "A'.B'" }, { label: "A.B'", expr: "A.B'" }, { label: 'A.B', expr: 'A.B' }] }, caption: 'Each minterm column has a single 1. The output column F here is the minterm [[A\'.B]] (m1).' },
          { kind: 'quiz', id: 'quiz-min', questions: ['p-min-1', 'p-max-1', 'p-idx-1'] },
        ],
      },
      {
        id: 'sop-pos',
        title: 'Writing SOP and POS from a truth table',
        source: 'N p.40',
        blocks: [
          {
            kind: 'text',
            md: '**SOP**: OR together the minterms of the rows where F = 1.\n\n**POS**: AND together the maxterms of the rows where F = 0.\n\nExample: F is 1 on rows 01 and 10 (XOR). SOP: [[F = A\'.B + A.B\']]. F is 0 on rows 00 and 11. POS: [[F = (A + B).(A\' + B\')]]. Shorthand: F = Σm(1, 2) = ΠM(0, 3).',
          },
          { kind: 'quiz', id: 'quiz-sop', questions: ['p-sop-1', 'p-pos-1'] },
        ],
      },
      {
        id: 'standard',
        title: 'Standard and non-standard forms',
        source: 'N p.46–48',
        blocks: [
          {
            kind: 'text',
            md: 'An SOP or POS is **standard** (canonical) when every term contains **every** variable. [[A.B.C + A\'.B.C\']] is standard; [[A.B + C]] is not. To make a term standard, multiply it by [[(X + X\')]] for each missing variable X (that is 1, so nothing changes) and expand.',
          },
          { kind: 'quiz', id: 'quiz-std', questions: ['p-std-1'] },
        ],
      },
      {
        id: 'convert',
        title: 'Converting between SOP and POS',
        source: 'N p.41–45',
        blocks: [
          {
            kind: 'text',
            md: 'Every row is either a 1 or a 0, so the maxterm numbers are simply the row numbers **missing** from the minterm list. With 3 variables, Σm(0, 2, 5, 7) = ΠM(1, 3, 4, 6).',
          },
          { kind: 'quiz', id: 'quiz-conv', questions: ['p-conv-1', 'p-conv-2'] },
        ],
      },
    ],
    recap: [
      'Minterm: AND of all variables, bar the 0s. Equals 1 on one row.',
      'Maxterm: OR of all variables, bar the 1s. Equals 0 on one row.',
      'Numbers start at 0: mₖ is the row with binary value k (ICN k + 1).',
      'SOP = OR of the 1-rows\' minterms; POS = AND of the 0-rows\' maxterms.',
      'Σm and ΠM lists are complements of each other.',
    ],
  },

  // ------------------------------------------------------------ 9
  {
    module: 'karnaugh-maps',
    intro: 'A Karnaugh map (K-map) arranges a truth table so that terms which can be combined sit next to each other. Circling groups replaces pages of algebra.',
    sections: [
      {
        id: 'layout',
        title: 'Layout and Gray code',
        source: 'N p.29–31',
        blocks: [
          {
            kind: 'text',
            md: 'Each cell is one row of the truth table. The notes use these layouts:\n\n- 2 variables: A down the side, B across.\n- 3 variables: AB across the top, C down the side.\n- 4 variables: AB across the top, CD down the side.\n\nThe labels go **00, 01, 11, 10** (Gray code), so neighbouring cells differ in exactly one variable. The map also wraps around: the left edge touches the right edge, and the top touches the bottom.',
          },
          { kind: 'figure', figure: { kind: 'kmap', expr: 'A.B + C', variables: ['A', 'B', 'C'] }, caption: 'K-map for [[F = A.B + C]]. Note the column order 00, 01, 11, 10.' },
          { kind: 'quiz', id: 'quiz-gray', questions: ['k-gray-1', 'k-layout-1', 'k-fill-1'] },
        ],
      },
      {
        id: 'rules',
        title: 'Grouping rules',
        source: 'N p.32–33',
        blocks: [
          {
            kind: 'text',
            md: 'The notes\' grouping rules, in short:\n\n1. Every output of the truth table, 1s and 0s, goes into the map.\n2. Use only one type of value in groups: 1s (for SOP) or 0s (for POS).\n3. The number of cells in a group is a power of 2: 1, 2, 4, 8 or 16.\n4. Every cell of the chosen type must be in a group.\n5. Make groups as large as possible, and use as few groups as possible.\n6. A cell may be shared by more than one group (overlap).\n7. Groups cannot be diagonal.\n8. Groups can wrap around the edges — the map behaves like a ring.\n9. A group is horizontal or vertical: a square or a rectangle.\n\nAlso remove sub-groups (groups whose cells all belong to other groups): they only make the expression longer. The trainer below checks each group you make against these rules.',
          },
          { kind: 'quiz', id: 'quiz-rules', questions: ['k-rule-1', 'k-rule-2'] },
        ],
      },
      {
        id: 'read',
        title: 'Reading the answer from the groups',
        source: 'N p.51–52',
        blocks: [
          {
            kind: 'text',
            md: 'For each group of 1s, keep the variables that **stay the same** in every cell of the group and drop the ones that change. A variable that stays 1 is written plain; one that stays 0 gets a bar. OR the terms together for the SOP.\n\nGroups of **0s** give POS terms: keep the variables that stay the same, but now a variable that stays **1** gets the bar, and the terms are ORs that you AND together.\n\nA group of 2ᵏ cells removes k variables.',
          },
          { kind: 'kmap', id: 'km-1', expr: "A + B.C'", variables: ['A', 'B', 'C'] },
          { kind: 'kmap', id: 'km-2', expr: "B.D + B'.D'", variables: ['A', 'B', 'C', 'D'] },
          { kind: 'kmap', id: 'km-pos', expr: "(A + B).(B' + C)", variables: ['A', 'B', 'C'], group: 0 },
          {
            kind: 'callout',
            tone: 'note',
            title: 'Don\'t-care conditions',
            md: 'Some books also use "don\'t care" cells (X). The supplied notes mark them as **not in the syllabus**, so this app does not use them.',
          },
          { kind: 'quiz', id: 'quiz-read', questions: ['k-read-1', 'k-group-1'] },
        ],
      },
    ],
    recap: [
      'K-map labels use Gray code: 00, 01, 11, 10. The map wraps around.',
      '3 variables: AB across, C down. 4 variables: AB across, CD down.',
      'Groups: same value, 1/2/4/8/16 cells, rectangles, as large and as few as possible; overlaps and wrap-around allowed, diagonals not.',
      'Keep the variables that do not change across a group. 1s → SOP; 0s → POS.',
    ],
  },

  // ------------------------------------------------------------ 10
  {
    module: 'designing-circuits',
    intro: 'The structured-essay question usually gives a real-world situation and asks you to design the circuit. Everything from the earlier lessons comes together here.',
    sections: [
      {
        id: 'process',
        title: 'The design process',
        source: 'N p.34, p.49',
        blocks: [
          {
            kind: 'text',
            md: '1. **Define the inputs and outputs**, and what 1 and 0 mean for each. ("D = 1: the door is open.")\n2. **Write the truth table** from the description.\n3. **Write the expression** — SOP from the 1s, or POS from the 0s.\n4. **Simplify** with Boolean laws or a K-map.\n5. **Draw the circuit**, with basic gates or NAND/NOR only if asked.',
          },
          { kind: 'quiz', id: 'quiz-process', questions: ['d-steps-1', 'd-io-1'] },
        ],
      },
      {
        id: 'majority',
        title: 'Worked example: at least two of three',
        source: 'N p.49',
        blocks: [
          {
            kind: 'worked',
            id: 'w-majority',
            title: 'A safe opens when at least two of three keys K1, K2, K3 are turned',
            steps: [
              'Inputs: K1, K2, K3 (1 = key turned). Output: F (1 = safe opens).',
              'Truth table: F = 1 on rows 011, 101, 110 and 111 — the rows with two or more 1s.',
              'SOP: [[F = K1\'.K2.K3 + K1.K2\'.K3 + K1.K2.K3\' + K1.K2.K3]].',
              'Simplify (K-map: three overlapping pairs): [[F = K1.K2 + K2.K3 + K1.K3]].',
              'Circuit: three 2-input AND gates feeding a 3-input OR gate. Try it in the explorer below.',
            ],
          },
          { kind: 'explorer', id: 'exp-majority2', preset: 'majority' },
          { kind: 'quiz', id: 'quiz-majority', questions: ['d-maj-1', 'd-maj-tt'] },
        ],
      },
      {
        id: 'practice',
        title: 'Your turn',
        blocks: [
          {
            kind: 'text',
            md: 'Read the scenario carefully: words like "and", "or", "not", "at least", "exactly" and "either" decide the gates. Put brackets where a condition applies to everything after it.',
          },
          { kind: 'quiz', id: 'quiz-design', questions: ['d-design-1', 'd-design-4', 'd-design-3'] },
        ],
      },
    ],
    recap: [
      'Define inputs and outputs → truth table → SOP/POS → simplify → circuit.',
      '"At least two of three" is the majority function [[A.B + B.C + A.C]].',
      'Watch for "not", "either…or" and "exactly" in the scenario — and use brackets.',
    ],
  },
];
