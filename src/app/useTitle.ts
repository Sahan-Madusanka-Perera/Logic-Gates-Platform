import { useEffect } from 'react';

/** Set the document title for the current page. */
export function useTitle(title: string): void {
  useEffect(() => {
    document.title = title ? `${title} · Logic Gates Learning Lab` : 'Logic Gates Learning Lab';
  }, [title]);
}
