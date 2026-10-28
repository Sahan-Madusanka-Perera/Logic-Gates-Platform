/// <reference types="vitest/config" />
import { createHash } from 'node:crypto';
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

const root = fileURLToPath(new URL('.', import.meta.url));
const base = process.env.BASE_PATH ?? '/';

function listPublicFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name.startsWith('.') || name === 'sw.js') continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...listPublicFiles(full));
    else out.push(relative(join(root, 'public'), full).split('\\').join('/'));
  }
  return out;
}

/**
 * Emits sw.js with a precache list of every built file, so the whole app
 * (all lessons and simulators) works offline after the first visit.
 */
function serviceWorker(): Plugin {
  return {
    name: 'lgll-service-worker',
    apply: 'build',
    generateBundle(_options, bundle) {
      const files = [
        ...Object.keys(bundle),
        ...listPublicFiles(join(root, 'public')),
      ].filter((f) => !f.endsWith('.map') && f !== '_redirects');
      const version = createHash('sha256').update(files.sort().join('|')).digest('hex').slice(0, 12);
      const precache = ['./', ...files.filter((f) => f !== 'index.html'), 'index.html'];
      const source = `/* Logic Gates Learning Lab service worker — generated at build time */
const VERSION = ${JSON.stringify(version)};
const CACHE = 'lgll-' + VERSION;
const PRECACHE = ${JSON.stringify(precache)};

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)));
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('lgll-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Built files are content-hashed, so Vary (e.g. "Vary: Origin" from some hosts) can be ignored;
  // without ignoreVary, module scripts requested with an Origin header never match the cache.
  const match = { ignoreSearch: true, ignoreVary: true };

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('index.html', match).then((r) => r || caches.match('./', match))),
    );
    return;
  }

  event.respondWith(
    caches.match(request, match).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok && response.type === 'basic') {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    }),
  );
});
`;
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

export default defineConfig({
  base,
  plugins: [react(), tailwindcss(), serviceWorker()],
  resolve: { alias: { '@': join(root, 'src') } },
  build: { target: 'es2020', sourcemap: false, chunkSizeWarningLimit: 600 },
  test: {
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],
    environment: 'node',
  },
});
