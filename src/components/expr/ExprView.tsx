import { Fragment, type ReactNode, useMemo } from 'react';
import { type Expr, toText, tryParse } from '@/lib/logic/expression';
import { useProgress } from '@/lib/progress/store';

const PREC: Record<Expr['type'], number> = { or: 1, xor: 2, and: 3, not: 4, var: 5, const: 5 };

function Var({ name }: { name: string }) {
  const m = /^([A-Za-z]+)(\d+)$/.exec(name);
  if (m) {
    return (
      <span>
        {m[1]}
        <sub className="text-[0.7em]">{m[2]}</sub>
      </span>
    );
  }
  return <span>{name}</span>;
}

function render(e: Expr, andStyle: 'dot' | 'juxtapose', parentPrec = 0): ReactNode {
  const wrap = (node: ReactNode, prec: number, explicit?: boolean) =>
    prec < parentPrec || (explicit && prec < 4) ? (
      <>
        <span className="expr-paren">(</span>
        {node}
        <span className="expr-paren">)</span>
      </>
    ) : (
      node
    );
  switch (e.type) {
    case 'var':
      return <Var name={e.name} />;
    case 'const':
      return <span>{e.value}</span>;
    case 'not':
      // A bar groups whatever is under it, so no brackets are needed inside.
      return <span className="expr-bar">{render(e.operand, andStyle, 0)}</span>;
    case 'and': {
      const multi = e.operands.some((o) => o.type === 'var' && o.name.length > 1);
      const sep = andStyle === 'juxtapose' && !multi ? null : <span className="expr-dot">.</span>;
      return wrap(
        e.operands.map((o, i) => (
          <Fragment key={i}>
            {i > 0 && sep}
            {render(o, andStyle, PREC.and + (o.type === 'and' ? 1 : 0))}
          </Fragment>
        )),
        PREC.and,
        e.paren,
      );
    }
    case 'or':
    case 'xor':
      return wrap(
        e.operands.map((o, i) => (
          <Fragment key={i}>
            {i > 0 && <span className="expr-op">{e.type === 'or' ? '+' : '⊕'}</span>}
            {render(o, andStyle, PREC[e.type] + 1)}
          </Fragment>
        )),
        PREC[e.type],
        e.paren,
      );
  }
}

interface ExprViewProps {
  expr: Expr | string;
  multi?: string[];
  className?: string;
  /** Override the user's AND notation preference. */
  andStyle?: 'dot' | 'juxtapose';
}

/**
 * Renders an expression with overbars (nested bars stack). Screen readers get a
 * spoken form, e.g. "NOT (A OR B) AND C".
 */
export function ExprView({ expr, multi, className, andStyle }: ExprViewProps) {
  const pref = useProgress().settings.andNotation;
  const parsed = useMemo(() => {
    if (typeof expr !== 'string') return expr;
    const r = tryParse(expr, { variables: multi });
    return r.ok ? r.expr : null;
  }, [expr, multi]);
  if (!parsed) return <span className={className}>{String(expr)}</span>;
  // Equations like "F = A.B" are handled by RichText; here we render one expression.
  return (
    <span className={`expr ${className ?? ''}`}>
      <span aria-hidden="true">{render(parsed, andStyle ?? pref)}</span>
      <span className="sr-only">{speak(parsed)}</span>
    </span>
  );
}

export function speak(e: Expr): string {
  switch (e.type) {
    case 'var':
      return e.name;
    case 'const':
      return String(e.value);
    case 'not':
      return e.operand.type === 'var' || e.operand.type === 'const' ? `NOT ${speak(e.operand)}` : `NOT (${speak(e.operand)})`;
    case 'and':
    case 'or':
    case 'xor': {
      const word = e.type.toUpperCase();
      return e.operands.map((o) => (o.type === 'var' || o.type === 'const' || o.type === 'not' ? speak(o) : `(${speak(o)})`)).join(` ${word} `);
    }
  }
}

/** Plain text form for copy/paste and inputs. */
export function exprText(e: Expr): string {
  return toText(e);
}
