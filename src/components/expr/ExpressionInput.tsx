import { useId, useRef } from 'react';
import { tryParse } from '@/lib/logic/expression';
import { ExprView } from './ExprView';

interface Props {
  value: string;
  onChange: (v: string) => void;
  variables?: string[];
  multi?: string[];
  label?: string;
  disabled?: boolean;
  onSubmit?: () => void;
  placeholder?: string;
}

/**
 * Typed expression entry with a keypad for phones. Accepts A' or ~A for NOT,
 * . or nothing for AND, + for OR. The preview shows exactly how it was read.
 */
export function ExpressionInput({ value, onChange, variables = ['A', 'B', 'C'], multi, label = 'Your expression', disabled, onSubmit, placeholder }: Props) {
  const id = useId();
  const ref = useRef<HTMLInputElement>(null);
  const parsed = value.trim() ? tryParse(value, { variables: multi }) : null;

  const insert = (text: string) => {
    const el = ref.current;
    if (!el) return onChange(value + text);
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const next = value.slice(0, start) + text + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + text.length, start + text.length);
    });
  };
  const backspace = () => {
    const el = ref.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    if (start === end && start === 0) return;
    const from = start === end ? start - 1 : start;
    onChange(value.slice(0, from) + value.slice(end));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(from, from);
    });
  };

  const keys: { k: string; label: string; aria: string }[] = [
    ...variables.map((v) => ({ k: v, label: v, aria: v })),
    { k: "'", label: 'NOT ′', aria: 'NOT (prime)' },
    { k: '.', label: 'AND ·', aria: 'AND' },
    { k: ' + ', label: 'OR +', aria: 'OR' },
    { k: ' ⊕ ', label: 'XOR ⊕', aria: 'XOR' },
    { k: '(', label: '(', aria: 'open bracket' },
    { k: ')', label: ')', aria: 'close bracket' },
    { k: '0', label: '0', aria: 'zero' },
    { k: '1', label: '1', aria: 'one' },
  ];

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-semibold">
        {label}
      </label>
      <input
        id={id}
        ref={ref}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && onSubmit) {
            e.preventDefault();
            onSubmit();
          }
        }}
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        placeholder={placeholder ?? "e.g. A'.B + A.B'"}
        aria-describedby={`${id}-preview`}
        className="w-full rounded-xl border-2 border-line-strong bg-surface px-4 py-3 font-mono text-lg tracking-wide outline-none focus:border-accent"
      />
      <div className="flex flex-wrap gap-1.5" aria-label="Expression keypad">
        {keys.map((key) => (
          <button
            key={key.label}
            type="button"
            disabled={disabled}
            onClick={() => insert(key.k)}
            aria-label={`Insert ${key.aria}`}
            className="h-10 min-w-10 rounded-lg border border-line-strong bg-surface px-2.5 font-mono text-sm font-semibold hover:bg-surface-2"
          >
            {key.label}
          </button>
        ))}
        <button type="button" disabled={disabled} onClick={backspace} aria-label="Delete" className="h-10 rounded-lg border border-line-strong bg-surface-2 px-3 text-sm font-semibold">
          ⌫
        </button>
      </div>
      <div id={`${id}-preview`} className="min-h-8 text-sm" aria-live="polite">
        {parsed === null ? (
          <span className="text-ink-3">Type A&apos; (or ~A) for NOT A, A.B (or AB) for A AND B, A + B for OR.</span>
        ) : parsed.ok ? (
          <span className="flex flex-wrap items-baseline gap-2">
            <span className="text-ink-3">Read as:</span>
            <ExprView expr={parsed.expr} className="text-xl" />
          </span>
        ) : (
          <span className="text-bad">
            {parsed.error.message} (at character {parsed.error.position + 1})
          </span>
        )}
      </div>
    </div>
  );
}
