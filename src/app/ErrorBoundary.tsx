import { Component, type ErrorInfo, type ReactNode } from 'react';

interface State {
  error: Error | null;
}

/** Last line of defence: never leave the student facing a blank screen. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Logic Gates Learning Lab error', error, info.componentStack);
  }

  override render() {
    if (!this.state.error) return this.props.children;
    const chunk = /Loading chunk|dynamically imported module|Failed to fetch/i.test(this.state.error.message);
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <h1 className="text-3xl">Something went wrong</h1>
        <p className="mt-3 text-ink-2">
          {chunk
            ? 'Part of the app could not be loaded. If you are offline, reconnect once so the lab can save itself for offline use, then try again.'
            : 'This page hit an unexpected problem. Your saved progress is safe.'}
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <button className="btn btn-primary" onClick={() => window.location.reload()}>
            Reload the page
          </button>
          <a className="btn btn-secondary" href={import.meta.env.BASE_URL}>
            Go to home
          </a>
        </div>
      </div>
    );
  }
}
