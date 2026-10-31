# Testing

## Commands

```bash
npm run typecheck   # TypeScript, strict, noUncheckedIndexedAccess
npm run lint        # ESLint (React hooks, TypeScript rules), zero warnings allowed
npm test            # Vitest unit + integration tests
npm run build       # typecheck + production build + service worker
npm run test:e2e    # Playwright against the production build (desktop + Pixel 7)
npm run verify      # typecheck, lint, test and build in one go
```

`npm run test:e2e` starts `vite preview` on port 4173 automatically. Run `npm run build` first so
the preview serves the current code. On a new machine, run `npx playwright install chromium`
once.

## What is tested

### Unit and integration (Vitest): 685 tests in 12 files

| File | Tests | Covers |
|------|------:|--------|
| `tests/unit/gates.test.ts` | 19 | Every gate's 2- and 3-input truth table against the notes, n-input definitions (2–6 inputs, XOR as odd parity), impossible input counts, non-bit values rejected, row order |
| `tests/unit/expression.test.ts` | 18 | Parser (all notations, multi-letter names), printing, equivalence; property-based tests with fast-check (print → parse round trip; a generated circuit computes its expression; canonical and minimal SOP/POS reproduce the truth table) |
| `tests/unit/circuit.test.ts` | 15 | Validation (missing inputs, cycles, unknown sources), evaluation order, truth tables, the notes' peeling example |
| `tests/unit/kmap-sequential-switches.test.ts` | 22 | Gray code and cell numbering as in the notes, group rule checks (mixed values, sizes, diagonals, wrap-around), cover analysis, groups of 0s, NOR/NAND/OR-AND latches, switch circuits, NAND-only and NOR-only constructions |
| `tests/unit/laws.test.ts` | 64 | Every law accepted in both directions and in several places at once (factorising, A = A.1, multiplying out); the lesson worked steps pass with the law they name; a jump straight to the answer is rejected whichever law is chosen; a wrong law is rejected and the right one named; two laws in one line rejected (De Morgan then double complement, complement then identity); property test that every single law application keeps the truth table |
| `tests/unit/lawSolver.test.ts` | 29 | The solver's lines match a teacher's for textbook cases (factorise → complement → identity, the dual, redundancy, De Morgan then double bars, the consensus case via B.C = B.C.1 = B.C.(A + A')); every line of every solution passes `checkStep` with the law it names and keeps the truth table, for the lesson exercises, every "simplify fully" question, a case that needs the standard-form method (checked in full), and a property test on random expressions; already-simplest input, `nextStep`, `simplestForm`, the time limit |
| `tests/unit/simplest.test.ts` | 12 | "Fully simplified" means the fewest variables **and** no law left to apply: B.1 → B (Identity law), A″, repeated and complementary operands, nested cases; property test that the engine's minimal SOP/POS never have a leftover step |
| `tests/unit/builder.test.ts` | 13 | Every build challenge has a passing reference solution; wrong gates, wrong function (with counterexample), missing/extra terminals; editing model (add, wire, remove, change type, move, labels, corrupted saves) |
| `tests/unit/progress.test.ts` | 9 | XP once per question, mastery levels match their written definitions, recommendations always give a reason, export/import/reset, corrupted storage |
| `tests/integration/question-bank.test.ts` | 458 | Every question: unique id, valid module/objective/level, expressions parse, the engine marks the stored answer correct, hints and a worked solution generate, MCQ validity, misconception references; diagnostic and mastery selection; paper determinism |
| `tests/integration/lessons.test.ts` | 15 | One lesson per module, quiz ids exist, expressions parse, preset circuits evaluate, IC pinouts |
| `tests/integration/assessment-flow.test.ts` | 11 | Practice session URLs and fallbacks, every mode/topic/level/mistake produces questions, grading without hints, diagnostic starting point, paper topic filters, "simplify fully" questions reject answers padded with a constant |

### End to end (Playwright): 70 tests × 2 projects = 140 runs

Projects: **desktop** (Chrome, 1366×860) and **mobile** (Pixel 7). Every test fails if the page logs
a console error or throws.

| File | Covers |
|------|--------|
| `smoke.spec.ts` | Every route and all 14 lessons render a heading without sideways scrolling; 404 page |
| `learning.spec.ts` | Completing a lesson persists after refresh; practice hints → worked solution → summary; settings (theme, AND notation) persist; download, delete (in-page confirm, cancel and confirm), import |
| `assessment.spec.ts` | Diagnostic without hints, marking and suggested lesson; exam navigator, flags, in-page confirm, review filters; **timer auto-submit** using Playwright's fake clock; resuming an unfinished paper after refresh |
| `lab.spec.ts` | Builder challenge solved with the keyboard-accessible wiring panel; wiring by tapping pins; undo/redo; persistence; expression lab forms and equivalence counterexample; B.1 is finished with the Identity law, not called "already simplest"; in "simplify with laws", typing the answer in one jump or naming the wrong law is rejected (with the right law named) and one-law steps are accepted; the solver's hint names the next law (and selects it), the next line can be shown and used, and a full solution from the current line is revealed a line at a time and can be added to the working; K-map lab fill and reveal |
| `offline-a11y.spec.ts` | **Offline:** after the first visit, the service worker controls the page; with the network switched off (`context.setOffline(true)`), a lesson, the builder and the exam page all load. **Accessibility:** axe-core (WCAG 2.0/2.1 A and AA) finds no serious or critical violations on 19 pages (including the lessons with switch circuits, the law checker, adders, latches and IC pin-outs), in both light and dark themes |

The suite was also run with `--repeat-each=2` to check for flaky tests.

### Bugs found and fixed

* (Reported by a user.) "Simplest form" was judged only by counting variables, so B.1 (one variable, like B) was called
  fully simplified in the expression lab, the step-by-step checker and "simplify fully" questions.
  A shared engine check (`leftoverStep` in `minimize.ts`) now also requires that no law can still
  remove a constant, a double bar, or a repeated or complementary operand, and names the law to use.
* (Reported by a user.) The step-by-step simplification checker only checked that each line was equivalent to the one
  before, so typing the final answer in one line, with any law chosen, was marked correct with a
  green tick next to the law. Each line must now follow from the previous one by the law named
  (`checkStep` in `laws.ts`); otherwise the checker says which law the step really uses, or that it
  needs more than one law.
* Switch-circuit diagrams, IC pin-outs, adder stages, latch history and two results tables scroll
  sideways on phones but could not be reached with the keyboard. A random mixed practice session
  found it; these now use `ScrollRegion`, and the lessons that show them were added to the axe pages.
* Offline mode failed when the host sends `Vary: Origin` (as `vite preview` does): cached module
  scripts never matched. Fixed with `ignoreVary` in the service worker.
* On first install the page reloaded itself when the service worker took control, which could lose
  an answer being typed. It now reloads only when the learner accepts an update.
* K-map cells used `aria-pressed` on `role="gridcell"` (not allowed), now `aria-selected`.
  Decorative palette icons had empty labels. Sideways-scrolling diagrams and tables were not
  keyboard-focusable on phones; they now get `tabIndex=0` only when they actually overflow.

### Manual checks

Screenshots of every new page were reviewed at 1366 px and 412 px wide, in light and dark themes,
for layout, overflow and contrast. No page scrolls sideways.

## Not covered by automated tests

* Real assistive-technology use (screen-reader walkthroughs with VoiceOver/TalkBack). Axe checks
  markup rules only.
* Browsers other than Chromium (Playwright runs Chromium for both projects).
* Dragging components with a real finger. Taps, clicks and keyboard moves are tested; drag uses
  standard pointer events with `touch-action: none` on components.
* Installing the PWA to a home screen.
