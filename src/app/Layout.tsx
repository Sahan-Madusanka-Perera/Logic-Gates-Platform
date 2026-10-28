import { type ReactNode, Suspense, useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { IconExam, IconLab, IconLearn, IconMoon, IconOffline, IconPractice, IconProgress, IconSun, LogoMark } from '@/components/icons';
import { badgeById } from '@/lib/progress/badges';
import { subscribe, takeFreshBadges, updateSettings, useProgress } from '@/lib/progress/store';

const NAV = [
  { to: '/learn', label: 'Learn', icon: IconLearn },
  { to: '/lab', label: 'Circuit Lab', short: 'Lab', icon: IconLab },
  { to: '/practice', label: 'Practice', icon: IconPractice },
  { to: '/exam', label: 'Exam Practice', short: 'Exam', icon: IconExam },
  { to: '/progress', label: 'My Progress', short: 'Progress', icon: IconProgress },
];

function useResolvedTheme(): 'light' | 'dark' {
  const { theme, motion } = useProgress().settings;
  const [systemDark, setSystemDark] = useState(() => typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const on = () => setSystemDark(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  const resolved = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;
  useEffect(() => {
    document.documentElement.dataset.theme = resolved;
    if (motion === 'system') delete document.documentElement.dataset.motion;
    else document.documentElement.dataset.motion = motion;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', resolved === 'dark' ? '#0d1015' : '#f4f2eb');
  }, [resolved, motion]);
  return resolved;
}

function useOnline(): boolean {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);
  return online;
}

function useServiceWorkerUpdate(): { ready: boolean; apply: () => void } {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const accepted = useRef(false);
  useEffect(() => {
    if (!('serviceWorker' in navigator) || import.meta.env.DEV) return;
    let reloading = false;
    // Reload only for an update the learner accepted. The first install also changes
    // the controller (clients.claim), and reloading then could lose an answer in progress.
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloading || !accepted.current) return;
      reloading = true;
      window.location.reload();
    });
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`)
      .then((reg) => {
        if (reg.waiting && navigator.serviceWorker.controller) setWaiting(reg.waiting);
        reg.addEventListener('updatefound', () => {
          const sw = reg.installing;
          sw?.addEventListener('statechange', () => {
            if (sw.state === 'installed' && navigator.serviceWorker.controller) setWaiting(sw);
          });
        });
      })
      .catch(() => {
        /* Offline support is optional; the app works without it. */
      });
  }, []);
  return {
    ready: waiting !== null,
    apply: () => {
      accepted.current = true;
      waiting?.postMessage('SKIP_WAITING');
    },
  };
}

function BadgeToasts() {
  const [items, setItems] = useState<string[]>([]);
  useEffect(
    () =>
      subscribe(() => {
        const fresh = takeFreshBadges();
        if (fresh.length > 0) setItems((x) => [...x, ...fresh]);
      }),
    [],
  );
  useEffect(() => {
    if (items.length === 0) return;
    const t = window.setTimeout(() => setItems((x) => x.slice(1)), 5000);
    return () => window.clearTimeout(t);
  }, [items]);
  const id = items[0];
  const badge = id ? badgeById(id) : undefined;
  if (!badge) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center px-4 md:bottom-8" role="status" aria-live="polite">
      <div className="pop-in pointer-events-auto flex max-w-sm items-center gap-3 rounded-2xl border border-hi-strong bg-surface px-4 py-3 shadow-card">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-hi font-mono text-lg font-bold text-[#1d1400]">1</span>
        <div className="text-sm">
          <div className="font-semibold">Badge earned: {badge.title}</div>
          <div className="text-ink-2">{badge.description}</div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => setItems((x) => x.slice(1))} aria-label="Dismiss">
          OK
        </button>
      </div>
    </div>
  );
}

export function PageLoading() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center" role="status">
      <div className="flex items-center gap-3 text-ink-2">
        <span className="h-3 w-3 animate-pulse rounded-full bg-hi" />
        Loading…
      </div>
    </div>
  );
}

export function Layout({ children }: { children?: ReactNode }) {
  const theme = useResolvedTheme();
  const online = useOnline();
  const update = useServiceWorkerUpdate();
  const { pathname } = useLocation();
  const settings = useProgress().settings;

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pathname]);

  const toggleTheme = () => updateSettings({ theme: theme === 'dark' ? 'light' : 'dark' });

  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2 focus:shadow-card">
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b border-line bg-paper/90 backdrop-blur supports-[backdrop-filter]:bg-paper/80">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4 md:h-16">
          <Link to="/" className="flex items-center gap-2.5 rounded-lg" aria-label="Logic Gates Learning Lab — home">
            <LogoMark />
            <span className="font-display text-[1.05rem] font-semibold leading-tight tracking-tight">
              Logic Gates <span className="text-ink-3">Learning Lab</span>
            </span>
          </Link>
          <nav aria-label="Main" className="ml-auto hidden items-center gap-1 md:flex">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${isActive ? 'bg-ink text-paper' : 'text-ink-2 hover:bg-surface-2 hover:text-ink'}`
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
          <button
            onClick={toggleTheme}
            className="btn btn-ghost ml-auto h-10 min-h-10 w-10 px-0 md:ml-1"
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            title={settings.theme === 'system' ? 'Following your device theme' : undefined}
          >
            {theme === 'dark' ? <IconSun /> : <IconMoon />}
          </button>
        </div>
        {!online && (
          <div className="flex items-center justify-center gap-2 bg-ink px-4 py-1.5 text-center text-xs font-semibold text-paper" role="status">
            <IconOffline size={16} /> You are offline. Lessons, simulators and practice still work; progress is saved on this device.
          </div>
        )}
        {update.ready && (
          <div className="flex items-center justify-center gap-3 bg-accent px-4 py-1.5 text-xs font-semibold text-accent-ink" role="status">
            A new version of the lab is ready.
            <button className="rounded-md bg-accent-ink/15 px-2 py-0.5 underline" onClick={update.apply}>
              Reload now
            </button>
          </div>
        )}
      </header>

      <main id="main" className="flex-1 pb-24 md:pb-10">
        <Suspense fallback={<PageLoading />}>{children ?? <Outlet />}</Suspense>
      </main>

      <footer className="no-print hidden border-t border-line py-6 text-sm text-ink-3 md:block">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4">
          <span>Free for every student. No account, no ads, no tracking.</span>
          <Link to="/about" className="underline-offset-4 hover:underline">
            About, sources &amp; privacy
          </Link>
          <Link to="/diagnostic" className="underline-offset-4 hover:underline">
            Diagnostic quiz
          </Link>
        </div>
      </footer>

      <nav aria-label="Main" className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        <ul className="grid grid-cols-5">
          {NAV.map((n) => (
            <li key={n.to}>
              <NavLink
                to={n.to}
                className={({ isActive }) =>
                  `flex h-16 flex-col items-center justify-center gap-1 text-[0.7rem] font-semibold ${isActive ? 'text-accent' : 'text-ink-3'}`
                }
              >
                {({ isActive }) => (
                  <>
                    <span className={`flex h-7 w-12 items-center justify-center rounded-full ${isActive ? 'bg-accent-soft' : ''}`}>
                      <n.icon size={20} />
                    </span>
                    {n.short ?? n.label}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <BadgeToasts />
    </div>
  );
}
