import { type ReactNode, useRef } from 'react';
import { useScrollable } from './useScrollable';

/**
 * A `.table-scroll` wrapper for content with nothing focusable inside (a
 * diagram or a plain table). When it overflows on a narrow screen it becomes a
 * labelled, focusable region so keyboard users can scroll it (WCAG 2.1.1).
 */
export function ScrollRegion({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const scrollable = useScrollable(ref);
  return (
    <div ref={ref} tabIndex={scrollable ? 0 : undefined} role={scrollable ? 'region' : undefined} aria-label={scrollable ? `${label}, scrolls sideways` : undefined} className={`table-scroll ${className ?? ''}`.trim()}>
      {children}
    </div>
  );
}
