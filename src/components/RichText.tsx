import { Fragment, type ReactNode } from 'react';
import { ExprView } from './expr/ExprView';

/**
 * Tiny markup used by lesson and question content:
 *   [[A'.B]]            expression with overbars
 *   [[F = A + B]]       equation or chain: each side rendered as an expression
 *   **bold**, *italic*, `code`
 *   Blank line = new paragraph. Lines starting "- " = bullet list, "1. " = numbered list.
 */
function inline(text: string, multi?: string[]): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\[\[(.+?)\]\]|\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1] !== undefined) {
      // Equations and chains ("F = A.B", "X = Y = Z", "= A.1") render each side as an expression.
      const parts = m[1].split('=');
      if (parts.length > 1) {
        out.push(
          <span key={k++} className="expr">
            {parts.map((p, i) => (
              <Fragment key={i}>
                {i > 0 && ' = '}
                {p.trim() && <ExprView expr={p.trim()} multi={multi} />}
              </Fragment>
            ))}
          </span>,
        );
      } else out.push(<ExprView key={k++} expr={m[1]} multi={multi} />);
    } else if (m[2] !== undefined) out.push(<strong key={k++}>{inline(m[2], multi)}</strong>);
    else if (m[3] !== undefined) out.push(<em key={k++}>{inline(m[3], multi)}</em>);
    else if (m[4] !== undefined)
      out.push(
        <code key={k++} className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[0.88em]">
          {m[4]}
        </code>,
      );
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function RichInline({ text, multi }: { text: string; multi?: string[] }) {
  return <>{inline(text, multi)}</>;
}

export function RichText({ text, className, multi }: { text: string; className?: string; multi?: string[] }) {
  const blocks = text.trim().split(/\n\s*\n/);
  return (
    <div className={`prose-lab ${className ?? ''}`}>
      {blocks.map((block, i) => {
        const lines = block.split('\n').map((l) => l.trim());
        if (lines.every((l) => l.startsWith('- '))) {
          return (
            <ul key={i}>
              {lines.map((l, j) => (
                <li key={j}>{inline(l.slice(2), multi)}</li>
              ))}
            </ul>
          );
        }
        if (lines.every((l) => /^\d+\.\s/.test(l))) {
          return (
            <ol key={i}>
              {lines.map((l, j) => (
                <li key={j}>{inline(l.replace(/^\d+\.\s/, ''), multi)}</li>
              ))}
            </ol>
          );
        }
        if (lines[0]?.startsWith('### ')) {
          return (
            <Fragment key={i}>
              <h3>{inline(lines[0].slice(4), multi)}</h3>
              {lines.length > 1 && <p>{inline(lines.slice(1).join(' '), multi)}</p>}
            </Fragment>
          );
        }
        return <p key={i}>{inline(lines.join(' '), multi)}</p>;
      })}
    </div>
  );
}
