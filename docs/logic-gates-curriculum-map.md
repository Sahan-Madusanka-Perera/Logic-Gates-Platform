# Logic Gates Learning Lab — Curriculum Map

This document drives the implementation. Every lesson, activity and question in the app is
traceable to an entry below.

## 1. Source inventory

| ID | File | What it actually is | Pages |
|----|------|---------------------|-------|
| **N** | `notes/50036_2026-10-05_11-19-05.pdf` | Bilingual (English / Sinhala) teacher notes, *"Logic Gates"*, ictfromabc.com, author metadata "Yohan Padmasiri", Feb 2025. | 77 PDF pages, printed pages 0–76 |
| **P** | `notes/50002_2026-09-19_21-11-56-9-28.pdf` | *"LOGIC GATES PAST PAPERS"* — a compilation (ictfromabc.com) of GCE A/L ICT MCQ (2011–2026) and structured/essay questions (2011–2026) on this unit. | 20 PDF pages, printed pages 9–28 |

Page references below use the **printed page number** at the bottom of each page
(`N p.13` = notes, printed page 13; `P 2014–13` = past paper, year 2014, question 13).

### 1.1 Important gap: no official syllabus document was supplied

The brief says the directory contains the syllabus. It does not: the file that looks like a
syllabus is a past-paper compilation. Consequences:

* Syllabus alignment is inferred from (a) the notes, which repeatedly say "according to the
  syllabus" and mark one item **"NOT IN SYLLABUS"** (`N p.33`, don't-care conditions), and
  (b) the past papers, which show what has actually been examined.
* A third-party index of the NIE syllabus (itguru.lk, *A/L ICT Syllabus — Unit 4*, retrieved
  2026-10-28) lists **Competency level 4.1** "Analyzes basic digital logic gates in terms of their
  unique functionalities" (basic, combinational and universal gates) and **Competency level 4.2**
  "Simplifies logic expressions using laws of Boolean algebra and Karnaugh maps" (postulates and
  theorems, SOP/POS, K-maps). It shows only these two levels. The official NIE PDF was not
  available to verify the wording or to check for further levels.
* Design of circuits from scenarios, adders, flip-flops and ICs are **not** listed in that index,
  but they are covered by the notes and have been examined repeatedly (see §3). The app treats
  them as **core (examined)** and labels the evidence as "past papers", not "syllabus".
* The app never claims official syllabus numbering. It uses its own module numbers.

**Action for maintainers:** if the official NIE syllabus PDF is added to `notes/`, re-check §2
and the "Status" column.

## 2. Notation and conventions (preserve these)

Taken from N and P. The app follows them everywhere.

| Convention | Source | App behaviour |
|-----------|--------|---------------|
| NOT shown with an **overbar** (Ā, (A + B) with a bar over the whole). | N p.4–8, P throughout | Rendered as real overbars, nested bars stacked. Typed input accepts `A'`, `~A`, `!A`, `¬A`, and `NOT`. |
| P 2013–02 also uses the prime form **A'** (e.g. `A'.B'`). | P 2013–02 | Prime accepted as input and explained as an alternative notation. |
| AND written with a **dot**: `A.B`, also juxtaposed `AB` in later papers. | N p.4, P 2019–39, 2022–10 | Default display `A.B`; option to show `AB`. Both accepted as input. |
| OR written `+`. XOR written `⊕`. | N p.5, p.7 | Same. `^` and `XOR` accepted as input. |
| Truth tables have an **ICN** (Input Combination Number) column numbered from **1**. | N p.4, p.37 | Truth tables show ICN 1…2ⁿ. |
| Row order: binary counting, **first variable is the most significant bit** (000, 001, 010 …). | N p.4–8 | All generated tables use this order. |
| Minterm / maxterm indices are **0-based decimal values** (m3, m5 …; M0, M1 …) even though ICN is 1-based. | N p.40 | Explained explicitly; app shows both ICN and mᵢ/Mᵢ. |
| K-map layout: 3 variables with **AB across the top (00 01 11 10) and C down the side**; 4 variables with AB across and CD down. Gray-code ordering. | N p.30–31, P 2019–39, 2021–09 | Default layout matches. |
| The notes group the **Null/Annulment** results (A.0 = 0, A + 1 = 1) under **"Identity law"** and use **"Redundancy law"** for A + A.B = A and A + Ā.B = A + B (elsewhere called absorption). | N p.21–25 | App uses the notes' names and mentions the alternative textbook names ("also called Null law / Absorption law"). |
| Steps in a simplification are labelled with the law used. | N p.14–16, p.42–51, P essays 2013–2014 | Worked solutions label every step. |
| Precedence for drawing circuits from expressions: **bar (NOT) → plus (OR) → dot (AND)**, peeled from the outside in; bracketed sub-expressions treated as atomic until isolated. | N p.35–36 | Expression→circuit tutor follows exactly this "peeling" procedure. Evaluation precedence (NOT > AND > OR) is explained separately so students don't confuse the two ideas. |
| Gate symbols: distinctive-shape (ANSI) symbols. | N p.3–8 | SVG symbols in that style. |
| "Positive/True/Yes = 1, Negative/False/No = 0". | N p.1 | Used in Foundations. |
| XOR/XNOR definition for 3 inputs: output 1 when the number of 1-inputs is **odd** (XOR); XNOR is its inverse. 2-input definition ("only one input is 1") does not generalise. | N p.7–8 | Engine implements parity for n ≥ 2 and the lesson explains the trap. |

## 3. Topic map

Status key — **Core**: in the notes and examined in P. **Core (notes)**: in the notes, not seen in
P. **Supplementary**: explanatory material the app adds; clearly labelled in the UI. **Out of
scope**: the notes say it is not in the syllabus.

### M1 Foundations — `foundations`
| Objective | Source | Status | Skills | Question types |
|---|---|---|---|---|
| F1 Explain a Boolean event (two opposite outcomes) and 1/0 ↔ true/false. | N p.1 | Core (notes) | Classify situations as Boolean or not. | MCQ |
| F2 Define a logic gate (inputs → processing → single output). | N p.1–2 | Core (notes) | Identify inputs/outputs. | MCQ |
| F3 Count input combinations: 2ⁿ. | N p.2 | Core | Compute 2ⁿ, list combinations in order. | Numeric, ordering |
| F4 Read and write a truth table with ICN. | N p.3–4 | Core | Fill rows in correct order. | Truth-table completion |
| F5 Digital vs continuous values; logical vs arithmetic operations (1 + 1 = 1 in OR). | — | Supplementary | Avoid arithmetic misreading. | MCQ |

Diagrams to recreate: input → processing → output block (N p.1).

### M2 Basic gates (NOT, AND, OR) — `basic-gates`
| Objective | Source | Status | Skills | Question types |
|---|---|---|---|---|
| G1 NOT: symbol, expression Ā, truth table; only one-input gate. | N p.3–4 | Core | Evaluate, identify symbol. | MCQ, binary output |
| G2 AND: 2- and 3-input, A.B, "1 only if all inputs 1". | N p.4 | Core | Evaluate any n. | Binary, truth table |
| G3 OR: 2- and 3-input, A + B, "0 only if all inputs 0". | N p.5 | Core | Evaluate any n. | Binary, truth table |
| G4 Venn-diagram view of gates. | N p.12 | Core (notes) | Match Venn to gate. | Matching |

### M3 Combinational gates (NAND, NOR, XOR, XNOR) — `combinational-gates`
| Objective | Source | Status | Skills | Question types |
|---|---|---|---|---|
| G5 NAND = AND followed by NOT; 2- and 3-input tables; intermediate K column. | N p.5–6 | Core | Evaluate, explain. | Binary, truth table |
| G6 NOR = OR followed by NOT. | N p.6 | Core | Evaluate. | Binary, truth table |
| G7 XOR: 2-input "only one input is 1"; n-input "odd number of 1s". | N p.7 | Core | Evaluate, avoid OR confusion. | Binary, MCQ, P 2026–10 |
| G8 XNOR = XOR followed by NOT; 3-input rule. | N p.8 | Core | Evaluate. | Binary, truth table |
| G9 XOR via basic gates: A.B̄ + Ā.B (SOP) and (A + B).(Ā + B̄) (POS); 3-input SOP/POS. | N p.9–11 | Core | Build and verify by truth table. | Equivalence, circuit build |

### M4 Switch circuits that model gates — `switch-circuits`
| Objective | Source | Status | Skills | Question types |
|---|---|---|---|---|
| S1 Series switches = AND, parallel = OR, switch shorting the bulb = NOT; NAND/NOR/XOR/XNOR switch arrangements (two-way switches for XOR/XNOR). | N p.18–19 | Core | Read a switch circuit as an expression. | MCQ — P 2014–13 type |
| S2 Staircase two-way switch = XOR. | P 2015 essay 01 | Core | Derive table/expression from wiring. | Truth table, expression |

Diagrams: the seven switch circuits of N p.19 and the push-button circuit type in P 2014–13.

### M5 Circuits, expressions and truth tables — `reading-circuits`
| Objective | Source | Status | Skills | Question types |
|---|---|---|---|---|
| C1 Obtain the truth table for a given circuit / expression, with intermediate columns. | N p.34, p.37 | Core | Evaluate gate by gate. | Truth-table completion, intermediate values |
| C2 Derive the Boolean expression of a given circuit. | N p.34, P 2011–28, 2012–27, 2013–02, 2024–12 | Core | Write the output of each gate. | MCQ, expression entry |
| C3 Draw the circuit for a given expression (peeling method). | N p.35–36 | Core | Identify outermost operator. | Ordering, circuit build |
| C4 Find the output for given inputs / when an input is fixed. | P 2022–09, 2023–12 | Core | Predict outputs. | Binary output, MCQ |

Diagrams: circuits from N p.36–37 (NOT of (A+B).C; X, Y, Z example).

### M6 Universal gates — `universal-gates`
| Objective | Source | Status | Skills | Question types |
|---|---|---|---|---|
| U1 Definition and reasons (cost, standardisation, flexibility, reliability) and the efficiency concern. | N p.13 | Core | Evaluate statements. | MCQ — P 2017–47 type |
| U2 Build NOT, AND, OR, NAND/NOR, buffer, XOR, XNOR from NOR only and NAND only, with proofs. | N p.14–17 | Core | Recognise and build. | MCQ — P 2015–11, 2016–11 type, circuit build |
| U3 Convert an AND-OR / OR-AND circuit into NAND-only / NOR-only form (removing double NOTs). | N p.53–55, P 2018 essay, 2019 essay, 2023 essay | Core | Apply De Morgan, double inverse. | Circuit build, MCQ |

### M7 Boolean algebra — `boolean-laws`
| Objective | Source | Status | Skills | Question types |
|---|---|---|---|---|
| B1 Purpose of simplification (complexity, cost, speed, power, reliability, space); postulates vs laws. | N p.20, p.28 | Core (notes) | — | MCQ |
| B2 Laws: double complement, idempotent, identity (incl. A.0, A+1), inverse/complement, commutative, associative, distributive (both forms), De Morgan, redundancy. | N p.21 | Core | Name and apply each law. | MCQ, matching |
| B3 Prove laws with truth tables. | N p.21–28, P 2026 essay (a) | Core | Compare columns. | Truth-table completion |
| B4 Simplify expressions step by step, naming laws. | N p.14–16, p.42–51; P 2011–27, 2012–26, 2013–01, 2018–21, 2020–09, 2022–10, 2023–13, 2024–13, 2026–11; essays 2013, 2014, 2022, 2023, 2025, 2026 | Core | Multi-step simplification. | MCQ, expression entry with per-step equivalence check |

### M8 SOP, POS, minterms, maxterms — `sop-pos`
| Objective | Source | Status | Skills | Question types |
|---|---|---|---|---|
| P1 Minterms (rows with output 1, product terms) and maxterms (rows with output 0, sum terms); m/M index notation. | N p.38–40 | Core | Write a minterm/maxterm for a row. | MCQ, expression entry |
| P2 Write canonical SOP and POS from a truth table. | N p.40, P 2011 essay, 2018 essay | Core | Read table → expression. | Expression entry |
| P3 Standard vs non-standard expressions; expanding to standard form. | N p.46–48 | Core (notes) | Expand with X + X̄ = 1. | MCQ, expression entry |
| P4 SOP ↔ POS conversion. | N p.41–45 | Core (notes) | Use De Morgan/distributive. | Expression entry |

### M9 Karnaugh maps — `karnaugh-maps`
| Objective | Source | Status | Skills | Question types |
|---|---|---|---|---|
| K1 Gray code; 2-, 3- and 4-variable layouts; which layouts are valid. | N p.29–31, P 2013–09, 2022–11 | Core | Order cells. | MCQ |
| K2 Fill a K-map from a truth table. | P 2021 essay, 2022 essay, 2022–11 | Core | Place values. | K-map fill |
| K3 Grouping rules 1–9 (one type only, powers of 2, as large and as few as possible, overlapping allowed, no diagonals, wrap-around/torus, rectangles). Remove redundant subgroups. | N p.32–33 | Core | Draw valid groups. | K-map grouping (validated) |
| K4 Read SOP from groups of 1s and POS from groups of 0s. | N p.51–52, P 2019–39, 2021–09, 2024–14, 2025–14, essays 2020–2025 | Core | Group → term. | MCQ, expression entry |
| K5 Don't-care conditions. | N p.33 | **Out of scope** ("NOT IN SYLLABUS") | — | Mentioned only as out of scope. |

### M10 Designing circuits for scenarios — `designing-circuits`
| Objective | Source | Status | Skills | Question types |
|---|---|---|---|---|
| D1 Define inputs/outputs and their 1/0 meanings from a scenario. | N p.49 | Core | Model a scenario. | MCQ |
| D2 Scenario → truth table → SOP/POS → simplify (laws or K-map) → circuit (basic gates, NAND-only, NOR-only). | N p.49–55, P essays 2011–2026 | Core | Full design process. | Guided multi-step, circuit build |
| D3 Majority / "at least two of three" function. | N p.49, P 2013 essay, 2016 essay, 2019 essay, 2024 essay | Core | Classic pattern. | All of the above |

### M11 Adders — `adders`
| Objective | Source | Status | Skills | Question types |
|---|---|---|---|---|
| A1 Half adder: Sum = A ⊕ B, Carry = A.B; with and without XOR. | N p.56–57, P 2024 essay (d)(i) | Core | Truth table, circuit. | Truth table, MCQ |
| A2 Full adder: S = A ⊕ B ⊕ Cin, Cout = A.B + B.Cin + A.Cin = A.B + Cin.(A ⊕ B); built from two half adders and an OR gate. | N p.58–60, P 2019–37/38, 2024 essay (d)(iii) | Core | Truth table, identify. | MCQ, truth table |
| A3 8-bit (ripple) adder: chain of adders, first stage can be a half adder. | N p.61–62 | Core (notes) | Trace carries. | Binary output |

### M12 Storing bits — `storing-bits`
| Objective | Source | Status | Skills | Question types |
|---|---|---|---|---|
| L1 Combinational vs sequential circuits (memory, clock, examples). | N p.63, P 2020–10, 2024 essay (d)(ii) | Core | Classify. | MCQ |
| L2 Feedback loop (alarm example) and the OR-AND-NOT set/reset loop. | N p.64–65 | Core (notes) | Trace states. | Binary output |
| L3 SR latch with NOR gates and with NAND gates; 4 states; truth tables; invalid input combination. | N p.66–70, P 2023 essay (c), 2025–13 | Core | Predict Q, Q̄ over a sequence. | Sequence prediction, MCQ |
| L4 Data latch; registers = collection of flip-flops (n-bit register needs n flip-flops). | N p.71, P 2023 essay 10(a)(iii) | Core | Recall. | MCQ, numeric |

### M13 Integrated circuits — `integrated-circuits`
| Objective | Source | Status | Skills | Question types |
|---|---|---|---|---|
| I1 What an IC is; 4000 (CMOS) vs 7400 (TTL) series characteristics; CD4001 (quad 2-input NOR), CD4011 (quad 2-input NAND). | N p.72–76 | Core (notes) | Compare families. | MCQ |
| I2 Read a 14-pin gate IC pin-out. | N p.74–76, P 2016 essay | Core | Map gates to pins. | MCQ |

### M14 Common mistakes — `common-mistakes`
Supplementary synthesis of misconceptions that the questions above target (AND/OR confusion,
NOT forgotten, NAND/NOR inverted wrongly, XOR vs OR, 3-input XOR, reading right-to-left, skipping
intermediate gates, missing truth-table rows, bar over a group vs bars over each variable,
evaluation order, ICN vs minterm index, diagonal or non-power-of-2 K-map groups, arithmetic 1+1).
Each misconception is mapped to the objective it undermines.

## 4. Past-paper question types → app activities

| Past-paper pattern | Examples | App activity |
|---|---|---|
| Simplify an expression (MCQ) | 2011–27, 2012–26, 2013–01, 2020–09, 2022–10, 2023–13, 2026–11 | Practice MCQ + expression entry with step checker |
| Which expression represents this circuit? | 2011–28, 2012–27, 2013–02, 2024–12 | Circuit → expression MCQ with SVG circuits |
| Equivalent / simplified circuit | 2014–12, 2018–22 | Equivalence MCQ (engine-checked) |
| Switch circuit → expression | 2014–13 | Switch-circuit MCQ |
| Universal-gate circuit equivalent to? | 2015–11, 2016–11 | NAND/NOR identification MCQ |
| Statements about universal gates | 2017–47 | Statement MCQ |
| De Morgan equivalents | 2018–21, 2024–13 | MCQ (engine-checked) |
| K-map → expression, valid layouts | 2013–09, 2019–39, 2021–09, 2022–11, 2024–14, 2025–14 | K-map MCQs and the grouping trainer |
| Full/half adder statements | 2019–37, 2019–38 | Adder MCQ |
| Sequential block diagram, flip-flop behaviour | 2020–10, 2025–13, 2023 essay (c) | Latch simulator + sequence questions |
| Scenario design (essay) | 2011–2026 essays | Guided design studio (truth table → SOP/POS → simplify → circuit → NAND/NOR) |

## 5. Question authenticity policy

* The past-paper compilation's reuse permissions are unknown. **The app does not reproduce
  past-paper questions.** All questions are original and labelled *"Original exam-style question"*.
* Where an original question practises the same skill as a past-paper question, it carries a
  `relatedPastPapers` reference (e.g. "Same skill as 2014 MCQ 13") so students can find and
  attempt the official paper themselves. That reference never claims the question *is* the
  past-paper question.
* Difficulty levels 1–6 are the app's internal learning levels, not official categories.

## 6. Unresolved ambiguities

1. **Official syllabus not supplied** (see §1.1). Scope of adders, flip-flops and ICs inferred from
   notes + past papers.
2. **Law names differ between sources.** The notes call A + A.B = A and A + Ā.B = A + B the
   *Redundancy law*; many textbooks call the first *Absorption*. The notes put A.0 = 0 and
   A + 1 = 1 under *Identity law*; textbooks often call these *Null/Annulment*. The app uses
   the notes' names and shows the alternative.
3. **POS→SOP conversion notes (N p.43–45)** contain extraction-damaged bars in the PDF text; the
   app derives its own worked examples with the engine rather than copying those lines.
4. **Expression → circuit precedence.** The notes' drawing procedure peels NOT, then OR, then AND
   (outermost first). This is the reverse order of *evaluation* precedence (NOT, AND, OR). The app
   teaches both and explains why they are consistent (the operator evaluated last is the gate
   drawn nearest the output).
5. **Gray-code spelling**: notes write "Grey code"; the app uses "Gray code (also spelt Grey)".
6. **XOR with more than two inputs**: the notes define it as odd parity. Some textbooks avoid
   n-input XOR. The app follows the notes.
7. **Flip-flop vs latch terminology**: the notes call the SR latch a flip-flop in places; past
   papers say "flip-flop". The app says "SR latch (a basic flip-flop)".

## 7. Completion checklist (verified at the end of the build — see `docs/testing.md`)

- [ ] Every objective F1–L4, I1–I2 has a lesson section with explanation, visual, interaction and practice.
- [ ] Out-of-scope K5 is labelled as such and not examined.
- [ ] Every gate in G1–G8 has a live simulator with truth table generated by the engine.
- [ ] Switch circuits S1 interactive.
- [ ] Circuit explorer with step-by-step evaluation (C1, C4).
- [ ] Expression ↔ circuit ↔ truth table tool (C2, C3, P2).
- [ ] Universal gate constructions shown and verified by engine tests (U2).
- [ ] Boolean law truth-table proofs generated by the engine (B3).
- [ ] Step-checked simplification (B4).
- [ ] K-map fill + grouping trainer with rule validation (K1–K4).
- [ ] Guided scenario design (D1–D3).
- [ ] Half/full/ripple adder simulators (A1–A3).
- [ ] SR latch simulator for NOR and NAND (L3).
- [ ] IC pin-out viewer (I2).
- [ ] Question bank: every objective has questions at ≥ 2 levels; every question tested.
- [ ] Notation conventions in §2 honoured in rendering and input parsing.
- [ ] No question claims to be an authentic past-paper question.
