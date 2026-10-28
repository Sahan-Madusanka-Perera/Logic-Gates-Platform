# Logic Gates Learning Lab

A free, interactive study aid for the **logic gates** unit of **GCE Advanced Level ICT (Sri Lanka)**.
There's no account, no ads and no tracking. It works on phones and offline after the first visit.

* **14 lessons** that follow the order and notation of the teacher notes, from 0s and 1s to
  universal gates, Boolean laws, SOP/POS, Karnaugh maps, circuit design, adders, latches and ICs.
  Each lesson ends with a confidence check and a 5-question mastery check.
* **Circuit Lab:** a circuit explorer with step-by-step evaluation; a circuit builder (tap or drag,
  undo/redo, live validation, truth table, 8 build challenges such as "OR from NAND"); an
  expression lab (truth table, circuit, standard and simplest SOP/POS, equivalence with a
  counterexample, the notes' "peeling" method, step-by-step simplification where each step's law
  is checked); and a K-map lab
  with rule-by-rule grouping feedback.
* **148 original practice questions** at six learning levels, with graduated hints, worked
  solutions and targeted practice for 15 common mistakes.
* **Diagnostic quiz**, **timed practice papers** (navigator, flags, auto-submit, review) and a
  **progress page** that explains every level and recommendation.

Logic values are never shown by colour alone: a 1 is a thick solid line and a 0 a dashed line, and
the value is always written as a number. The app supports light and dark themes, reduced motion
and keyboard use.

## Run it

Requires Node.js 20.19+ or 22.12+ (needed by Vite 8).

```bash
npm install
npm run dev        # http://localhost:5173
```

Other scripts:

```bash
npm run build      # production build in dist/ (includes the service worker)
npm run preview    # serve dist/ on http://localhost:4173
npm test           # unit + integration tests (Vitest)
npm run test:e2e   # end-to-end tests (Playwright; run `npx playwright install chromium` once)
npm run verify     # typecheck + lint + tests + build
```

The service worker is only registered in production builds, so use `npm run build && npm run preview`
to try offline mode.

## Deploy

The build is a static site in `dist/`, so any static host works. The app uses client-side routes
(`/learn/karnaugh-maps`), so the host must serve `index.html` for unknown paths.

* **Netlify / Cloudflare Pages:** build command `npm run build`, publish directory `dist`.
  `public/_redirects` (copied into `dist/`) already contains the fallback rule.
* **Vercel:** same build settings; add a rewrite of `/(.*)` to `/index.html`.
* **GitHub Pages or any sub-folder:** set the base path when building, and copy `index.html` to
  `404.html` so deep links work:

  ```bash
  BASE_PATH=/your-repo-name/ npm run build
  cp dist/index.html dist/404.html
  ```

  The router, manifest and service worker all follow `BASE_PATH`.

Serve over HTTPS (all the hosts above do) so the service worker can register.

## Privacy

Progress is stored only in the browser's `localStorage` on the learner's device. Nothing is sent
anywhere: there are no analytics, cookies, external fonts or API calls. Learners can download,
import or delete their progress on the progress page.

## Documentation

* [`docs/logic-gates-curriculum-map.md`](docs/logic-gates-curriculum-map.md): the curriculum audit,
  notation, topic map, objectives and past-paper evidence.
* [`docs/architecture.md`](docs/architecture.md): code structure, engine, storage, service worker,
  and how to add content.
* [`docs/content-sources.md`](docs/content-sources.md): sources, originality rules and accuracy checks.
* [`docs/testing.md`](docs/testing.md): what is tested and how to run it.

## Sources

The content follows the *Logic Gates* teacher notes (ictfromabc.com, 2025) and was checked against
a compilation of GCE A/L ICT past questions (2011–2026) to see which skills are examined. No
past-paper question is reproduced. Syllabus scope was cross-checked with the public outline at
[itguru.lk: A/L ICT syllabus, unit 4](https://itguru.lk/a-l-ict-syllabus/unit/4). The official NIE
syllabus document was not available, so the app does not claim to match it line by line.
