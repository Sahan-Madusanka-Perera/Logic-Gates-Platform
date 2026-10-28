# Content sources and originality

## Sources used

| ID | Source | How it was used |
|----|--------|-----------------|
| **N** | `notes/50036_…pdf`: *Logic Gates*, bilingual (English/Sinhala) teacher notes, ictfromabc.com, February 2025, 77 pages | The order of topics, notation, law names, K-map grouping rules 1–9, the peeling method, latch and IC facts. Every lesson section lists the printed pages it follows (for example "N p.32–33"). |
| **P** | `notes/50002_…pdf`: GCE A/L ICT logic-gates past questions 2011–2026 (MCQ and structured), compiled by ictfromabc.com | Used only to see which skills are examined and how. **No past-paper question is reproduced.** |
| **S** | [itguru.lk: A/L ICT syllabus, unit 4](https://itguru.lk/a-l-ict-syllabus/unit/4), retrieved 2026-10-28 | A public outline of the NIE syllabus. It lists competency level 4.1 (basic, combinational and universal gates) and 4.2 (Boolean laws, SOP/POS, Karnaugh maps). |

The official NIE syllabus PDF was **not** available. The app does not claim to match it line by
line and does not use official numbering. See `docs/logic-gates-curriculum-map.md` §1.1.

## Status labels

Every learning objective has one of these labels (shown in lessons and on the About page):

* **Core:** in the syllabus outline (S) and the notes.
* **Core (notes and past papers):** not in the outline shown by S, but taught in N and examined
  repeatedly in P (circuit design from scenarios, adders, latches and flip-flops, ICs).
* **Supplementary:** extra help that is not examined, for example telling logical `+` apart from
  arithmetic `+`.

Don't-care conditions in K-maps are marked "NOT IN SYLLABUS" in the notes (N p.33). The app does
not use them.

## Originality rules

* All 148 practice questions, 8 build challenges, lesson text, worked examples and mistake examples
  were written for this app. Each question shows an **"Original question"** label.
* Where a question practises the same skill as a past-paper question, it says "Practises the same
  skill as 2014 MCQ 13", so learners can find the real question themselves. Only references
  checked against P (and recorded in the curriculum map) are used.
* The "Level 1–6" labels are the app's own learning levels (Foundation, Application, Circuit
  analysis, Multi-step, Exam challenge, Mastery), not official examination categories.
* Scenarios (for example the majority-vote light) are invented and labelled "Original scenario".

## Accuracy

* Answers, truth tables, K-map cells, minimal forms, latch states and builder targets are computed
  by the engine, not typed by hand. `tests/integration/question-bank.test.ts` checks every question
  (458 tests) and `tests/integration/lessons.test.ts` checks every lesson.
* Multiple-choice options that are expressions are checked for equivalence: the answer option must
  equal the stated function, and the distractors must not.
* IC pinouts (7400, 7402, 7404, 7408, 7432, 7486, CD4001, CD4011) follow the standard published
  pinouts. The chip-family facts (TTL 5 V and fast; CMOS 3–15 V, low power, slower) follow N p.72–73.

* The simplification checker uses the notes' law names and forms (N p.21), including both
  Redundancy forms A + A.B = A and A + A'.B = A + B. It adds one name the notes do not use,
  the **NOT/XOR rule**, for steps that only use the NOT or XOR truth table (0' = 1, A ⊕ 0 = A,
  A ⊕ B = A.B' + A'.B).

## Notation

The app follows the notes: an overbar for NOT, a dot for AND (or no symbol, as a setting), `+` for
OR and `⊕` for XOR. Truth tables count rows in binary with the first variable as the most
significant bit, and show the 1-based ICN. Minterm and maxterm numbers are 0-based. K-maps put AB
across the top (00 01 11 10) and C, or CD, down the side. Typed answers also accept `A'`, `~A`,
`!A`, `A*B`, `A&B`, `A|B`, `A^B` and the words AND, OR, NOT and XOR.
