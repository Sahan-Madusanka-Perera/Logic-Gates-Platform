# Architecture

Logic Gates Learning Lab is a static single-page app (Vite + React 19 + TypeScript + Tailwind v4).
There is no server, no account and no network API: everything runs in the browser, and progress is
kept in `localStorage` on the learner's device.

## Principles

1. **One logic engine.** Every truth table, circuit value, K-map cell, latch state, equivalence check
   and mark comes from `src/lib/logic`. Components never compute logic themselves, and question
   answers are never typed in by hand where they can be computed.
2. **Content is data.** Lessons, questions, misconceptions and build challenges are typed TypeScript
   data, checked by tests against the engine.
3. **Explainable progress.** Mastery levels and recommendations come from plain rules
   (`src/lib/progress/analytics.ts`), and the UI shows the rule next to the result.
4. **Works offline, degrades gracefully.** A generated service worker precaches the whole build.
   If storage is blocked, the app still works and says that progress will not be kept.

## Layers

```
src/
  lib/logic/        Pure engine (no React, no content)
    types.ts          Bit, Circuit (input/const/gate/output nodes), issues, eval steps
    gates.ts          Gate functions (n-input XOR = odd parity), arity rules, combinations
    circuit.ts        Validation, topological evaluation, describeIssue()
    truthTable.ts     Truth tables from circuits (ICN 1-based, first input = MSB)
    expression.ts     Parser (A', ~A, A.B, AB, +, ⊕, words), evaluation, equivalence, printing
    convert.ts        Expression ↔ circuit, the notes' "peeling" steps
    canonical.ts      Minterms/maxterms, standard SOP/POS
    minimize.ts       Prime implicants and minimum cover (Quine–McCluskey style), leftover-law check
    laws.ts           Law names and forms; checks that one simplification line follows from the
                      last by the law named (search over single-law rewrites, both directions)
    kmap.ts           Gray-code layouts, group rule checks (notes' rules 1–9), cover analysis
    sequential.ts     NOR / NAND / OR-AND latches
    switches.ts       Switch-and-bulb circuits
    explain.ts        Plain-language reasons for gate outputs and steps
  lib/assessment/   Questions: types, marking (check.ts), hints and worked solutions (solve.ts),
                    drafts, grading without hints (grade.ts), practice sessions (sessions.ts),
                    builder challenge checking (buildCheck.ts)
  lib/progress/     Local progress store (useSyncExternalStore), XP, badges, analytics
  content/          Curriculum (modules, objectives, statuses), lessons, misconceptions,
                    preset circuits, build challenges
  data/questions/   The original question bank and paper/diagnostic/mastery selection
  components/       UI building blocks (circuits, gates, truth tables, K-maps, latches,
                    adders, IC pinouts, questions, lesson blocks, builder, labs)
  pages/            Route screens
  app/              Router, layout (theme, motion, service worker, badges), error boundary
```

Dependencies only point downwards: `pages → components → content/data → lib/assessment →
lib/logic`. `lib/logic` imports nothing from the rest of the app.

## Routes

| Path | Screen |
|------|--------|
| `/` | Home: a working gate, progress, explained recommendations, learning path |
| `/learn`, `/learn/:moduleId` | Learning path and the 14 lessons (each with a confidence check and mastery check) |
| `/lab`, `/lab/builder`, `/lab/expression`, `/lab/kmap` | Circuit explorer (step mode), circuit builder, expression lab, K-map lab |
| `/practice`, `/practice/session?…` | Practice hub; sessions by `mode` (rapid, mixed, detective, level), `module` or `misconception` |
| `/exam` | Timed or untimed practice paper with navigator, flags, review |
| `/diagnostic` | 12-question placement quiz without hints |
| `/progress` | Stats, mastery, confidence vs results, badges, papers, settings, export/import/reset |
| `/about` | Sources, originality, privacy, offline use, accessibility, limitations |

Pages are lazy-loaded, and the lab tools are lazy-loaded inside the lab page.

## State and storage

| Key (`localStorage`) | Owner | Contents |
|----------------------|-------|----------|
| `lgll.progress.v1` | `lib/progress/store.ts` | Lessons, attempts (last 2000), confidence, XP, badges, active days, diagnostic, papers, settings |
| `lgll.exam.v1` | `pages/ExamPage.tsx` | An unfinished practice paper, so a refresh can resume it |
| `lgll.builder.v1` | `components/builder/CircuitBuilder.tsx` | The circuit on the builder canvas and solved challenges |

Every read is wrapped in `try/catch` and passed through a sanitiser, so corrupted or old data
falls back to an empty state instead of crashing. Imports go through the same sanitiser.

## Marking flow

1. A question's input component edits a **draft** (`lib/assessment/draft.ts`).
2. `toResponse()` turns a complete draft into a **response**; blank drafts are not marked.
3. `checkAnswer()` marks it with the engine, returning feedback, wrong cells and the misconception
   a distractor represents.
4. Practice (`QuestionCard`) records the first real answer or revealed solution once
   (`recordAttempt`). Diagnostic and exam answers are marked together at the end by `gradeDraft()`.
   XP is given once per question, and never when the solution was shown first.

## Service worker

`vite.config.ts` contains a small plugin that writes `sw.js` after the build with a precache list
of every emitted file (all lessons and tools). It is cache-first for hashed assets, network-first
for navigations, and falls back to the cached `index.html` when offline. Matching uses
`ignoreVary` because some hosts send `Vary: Origin`, which otherwise stops module scripts matching
the cache (an e2e test caught this). A new version waits until the learner presses **Reload** in
the update bar; the page never reloads by itself on first install.

## Adding content

* **A question:** add it to a file in `src/data/questions/`. Give it a unique id, module,
  objective and level, and use `[[...]]` for expressions in rich text. Then run `npm test`: the
  question-bank tests check it parses, that the engine marks its answer correct, that hints and a
  worked solution can be generated, and that its misconception references exist.
* **A lesson block:** edit `src/content/lessons/part*.ts`. The lesson tests check quiz question ids,
  expressions and preset circuits.
* **A build challenge:** add it to `src/content/buildChallenges.ts` and a reference solution in
  `tests/unit/builder.test.ts`.
