import { Link } from 'react-router';
import { useTitle } from '@/app/useTitle';
import { MODULES, OBJECTIVES, STATUS_LABEL } from '@/content/curriculum';
import { LESSONS } from '@/content/lessons';
import { MISCONCEPTIONS } from '@/content/misconceptions';
import { QUESTIONS } from '@/data/questions';

export default function AboutPage() {
  useTitle('About, sources and privacy');
  const byStatus = (s: (typeof OBJECTIVES)[number]['status']) => OBJECTIVES.filter((o) => o.status === s).length;
  return (
    <div className="mx-auto max-w-3xl px-4 pb-16 pt-6 sm:px-6 md:pt-10">
      <header className="mb-8 space-y-2">
        <p className="eyebrow">About</p>
        <h1 className="font-display text-3xl sm:text-4xl">About the Logic Gates Learning Lab</h1>
        <p className="text-lg text-ink-2">A free, interactive study aid for the logic-gates unit of GCE Advanced Level ICT in Sri Lanka.</p>
      </header>

      <div className="prose-lab space-y-8">
        <section>
          <h2>What it covers</h2>
          <p>
            {MODULES.length} lessons ({LESSONS.length} written), {OBJECTIVES.length} learning objectives, {QUESTIONS.length} original practice questions at six learning levels, and {MISCONCEPTIONS.length} common mistakes with targeted practice. Of the objectives, {byStatus('core')} are marked “{STATUS_LABEL.core}”, {byStatus('core-notes')} “{STATUS_LABEL['core-notes']}”, and {byStatus('supplementary')} “{STATUS_LABEL.supplementary}”.
          </p>
          <p>Each lesson shows which printed pages of the notes it follows, and each objective is labelled with its status.</p>
        </section>

        <section>
          <h2>Sources</h2>
          <ul>
            <li>
              <strong>Teacher notes</strong> — a 77-page bilingual (English/Sinhala) set of notes titled <em>Logic Gates</em> from ictfromabc.com (February 2025). The lessons follow its order, notation and law names.
            </li>
            <li>
              <strong>Past-paper compilation</strong> — GCE A/L ICT multiple-choice and structured questions on this unit, 2011–2026, compiled by ictfromabc.com. It was used to see which skills are examined and how. <strong>No past-paper question is reproduced here.</strong> Some questions say “practises the same skill as 2014 MCQ 13” so you can find the real question yourself.
            </li>
            <li>
              <strong>Syllabus outline</strong> — the public unit outline at{' '}
              <a href="https://itguru.lk/a-l-ict-syllabus/unit/4" rel="noopener noreferrer">
                itguru.lk (A/L ICT syllabus, unit 4)
              </a>
              , which lists competency levels 4.1 (logic gates, including universal gates) and 4.2 (Boolean laws, SOP/POS, Karnaugh maps). The official NIE syllabus document was not available while this lab was built, so the lab does not claim to match it line by line.
            </li>
          </ul>
        </section>

        <section>
          <h2>Original questions and accuracy</h2>
          <p>
            Every question was written for this lab and is labelled “Original question”. The “Level 1–6” labels are this lab’s own learning levels, not official examination categories. Answers are never typed in by hand where they can be computed: truth tables, circuit outputs, K-map cells, latch states and expression equivalence are all worked out by one logic engine, and an automated test checks every question in the bank against it.
          </p>
          <p>Notation follows the notes: a bar (shown as an overline) for NOT, a dot for AND, + for OR and ⊕ for XOR. When typing, you can use A′ or ~A for NOT and AB or A.B for AND. Don’t-care conditions in K-maps are marked “not in syllabus” in the notes, so they are not used.</p>
        </section>

        <section>
          <h2>Privacy</h2>
          <p>
            There is no account, no sign-in, no advertising and no analytics. Your progress (lessons, answers, XP, settings) is stored only in your browser’s local storage on this device. Nothing is sent to a server. You can download, import or delete it on the{' '}
            <Link to="/progress">progress page</Link>. Clearing your browser data also deletes it.
          </p>
        </section>

        <section>
          <h2>Offline use</h2>
          <p>
            After your first visit, the app saves itself on your device, so lessons, simulators and practice keep working without an internet connection. On a phone you can add it to your home screen (“Install app” or “Add to Home screen” in your browser menu). When a new version is available, a bar at the top offers to reload.
          </p>
        </section>

        <section>
          <h2>Accessibility</h2>
          <p>
            Logic values are never shown by colour alone: a 1 is a thick solid line and a 0 is a dashed line, and every value is also written as a number. Everything works with a keyboard, with screen-reader descriptions of circuits and expressions. The app follows your device’s light/dark and reduced-motion settings; you can change them on the progress page.
          </p>
        </section>

        <section>
          <h2>Limitations</h2>
          <ul>
            <li>The lab cannot mark free-hand drawings or written explanations; essay-style answers are practised through structured steps instead.</li>
            <li>In the simplification checker, each line must follow from the one before by the one law you name, as in the notes. It looks for up to 8 uses of that law in a line, so a very long line may not be recognised: split it into two. Steps that only use the NOT and XOR truth tables (such as 1′ = 0 or A ⊕ 0 = A) use the “NOT/XOR rule”, which the notes do not name.</li>
            <li>Progress is per device and per browser. Use export/import to move it.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
