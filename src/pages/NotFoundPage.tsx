import { Link } from 'react-router';
import { useTitle } from '@/app/useTitle';

export default function NotFoundPage() {
  useTitle('Page not found');
  return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center">
      <p className="font-mono text-5xl font-semibold text-ink-3">404</p>
      <h1 className="mt-3 font-display text-3xl">This page outputs 0</h1>
      <p className="mt-2 text-ink-2">We could not find that page. It may have moved, or the link may be mistyped.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link to="/" className="btn btn-primary">
          Go home
        </Link>
        <Link to="/learn" className="btn btn-secondary">
          Learning path
        </Link>
      </div>
    </div>
  );
}
