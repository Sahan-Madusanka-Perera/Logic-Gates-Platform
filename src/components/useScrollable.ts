import { type RefObject, useEffect, useState } from 'react';

/**
 * True when the element scrolls sideways. Scrolling regions get tabIndex 0 so
 * keyboard users can scroll them (WCAG 2.1.1); regions that fit stay out of the tab order.
 */
export function useScrollable(ref: RefObject<HTMLElement | null>): boolean {
  const [scrollable, setScrollable] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const measure = () => setScrollable(el.scrollWidth > el.clientWidth + 1);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => ro.disconnect();
  }, [ref]);
  return scrollable;
}
