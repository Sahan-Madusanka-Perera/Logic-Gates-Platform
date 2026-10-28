import type { Bit } from '@/lib/logic/types';

/** A 0/1 input switch. Always shows the value as text, never colour alone. */
export function SignalToggle({
  label,
  value,
  onChange,
  size = 'md',
  disabled,
  describedBy,
}: {
  label: string;
  value: Bit;
  onChange: (v: Bit) => void;
  size?: 'sm' | 'md';
  disabled?: boolean;
  describedBy?: string;
}) {
  const on = value === 1;
  const h = size === 'sm' ? 'h-10' : 'h-12';
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={`Input ${label}, currently ${value}`}
      aria-describedby={describedBy}
      disabled={disabled}
      onClick={() => onChange(on ? 0 : 1)}
      className={`group inline-flex ${h} min-w-[5.5rem] items-center gap-2 rounded-xl border-2 px-2 pr-3 font-semibold transition-colors ${
        on ? 'border-hi-strong bg-hi-soft text-hi-ink' : 'border-line-strong bg-surface text-ink-2'
      }`}
    >
      <span className={`relative inline-flex h-6 w-10 shrink-0 rounded-full transition-colors ${on ? 'bg-hi' : 'bg-lo-soft ring-1 ring-lo'}`} aria-hidden="true">
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-surface shadow transition-transform ${on ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
      </span>
      <span className="font-display text-lg leading-none">{label}</span>
      <span className="ml-auto font-mono text-lg leading-none">{value}</span>
    </button>
  );
}

/** Inline value chip. */
export function Signal({ value, className }: { value: Bit | null | undefined; className?: string }) {
  if (value === null || value === undefined) {
    return <span className={`inline-flex h-6 min-w-6 items-center justify-center rounded-md border border-dashed border-line-strong px-1 font-mono text-sm text-ink-3 ${className ?? ''}`}>?</span>;
  }
  const on = value === 1;
  return (
    <span
      className={`inline-flex h-6 min-w-6 items-center justify-center rounded-md px-1 font-mono text-sm font-semibold ${
        on ? 'bg-hi text-[#1d1400]' : 'border border-lo bg-surface text-lo-ink'
      } ${className ?? ''}`}
    >
      {value}
    </span>
  );
}

/** Output indicator: a lamp with an explicit ON/OFF and 1/0 label. */
export function Lamp({ value, label = 'F', size = 64 }: { value: Bit | null; label?: string; size?: number }) {
  const on = value === 1;
  return (
    <div className="flex flex-col items-center gap-1" role="status" aria-live="polite" aria-label={`Output ${label} is ${value ?? 'unknown'}`}>
      <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className={on ? 'lamp-on' : undefined}>
        <circle cx="32" cy="28" r="20" fill={on ? 'var(--hi)' : 'var(--surface-2)'} stroke={on ? 'var(--hi-strong)' : 'var(--lo)'} strokeWidth="3" />
        {on && <circle cx="32" cy="28" r="27" fill="none" stroke="var(--hi)" strokeOpacity="0.35" strokeWidth="4" />}
        <path d="M24 46 h16 v6 a4 4 0 0 1 -4 4 h-8 a4 4 0 0 1 -4 -4z" fill="var(--surface-3)" stroke="var(--ink-3)" strokeWidth="2" />
        <path d={on ? 'M26 30 l4 -6 l4 6 l4 -6' : 'M26 28 h12'} fill="none" stroke={on ? '#5c3c00' : 'var(--lo)'} strokeWidth="2" strokeLinecap="round" />
      </svg>
      <div className="flex items-baseline gap-1.5 text-sm font-semibold">
        <span className="font-display text-base">{label}</span>
        <span>=</span>
        <span className="font-mono text-base">{value ?? '?'}</span>
        <span className={`text-xs ${on ? 'text-hi-ink' : 'text-ink-3'}`}>{value === null ? '' : on ? 'ON' : 'OFF'}</span>
      </div>
    </div>
  );
}

/** Choose 0 or 1 (answer entry). */
export function BitPicker({
  value,
  onChange,
  label,
  disabled,
  state,
}: {
  value: Bit | null;
  onChange: (v: Bit) => void;
  label: string;
  disabled?: boolean;
  state?: 'right' | 'wrong';
}) {
  const ring = state === 'wrong' ? 'ring-2 ring-bad' : state === 'right' ? 'ring-2 ring-ok' : '';
  return (
    <div role="radiogroup" aria-label={label} className={`inline-flex rounded-lg border border-line-strong bg-surface p-0.5 ${ring}`}>
      {([0, 1] as Bit[]).map((b) => {
        const selected = value === b;
        return (
          <button
            key={b}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={`${label}: ${b}`}
            disabled={disabled}
            onClick={() => onChange(b)}
            className={`h-9 w-9 rounded-md font-mono text-base font-semibold transition-colors ${
              selected ? (b === 1 ? 'bg-hi text-[#1d1400]' : 'bg-ink text-paper') : 'text-ink-2 hover:bg-surface-2'
            }`}
          >
            {b}
          </button>
        );
      })}
    </div>
  );
}
