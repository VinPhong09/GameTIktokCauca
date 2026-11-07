import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT_DIR = path.resolve(here, '..', '..');
export const FRONTEND_DIST = path.join(ROOT_DIR, 'frontend', 'dist');
export const ASSETS_DIR = path.join(ROOT_DIR, 'assets');

export interface ServerSettings {
  server: { host: string; port: number };
  database: { file: string; saveIntervalMs: number };
  live: {
    defaultProvider: 'mock' | 'tiktok' | 'baltik';
    autoConnect: boolean;
    tiktok: { username: string; processInitialData: boolean; enableExtendedGiftInfo: boolean; signApiKey?: string };
    baltik: { url: string; reconnectMs: number };
  };
  mock: { autoSimulateOnStart: boolean; eventsPerMinute: number };
}

const FALLBACK: ServerSettings = {
  server: { host: '127.0.0.1', port: 3000 },
  database: { file: 'data/cat-fishing.sqlite', saveIntervalMs: 3000 },
  live: {
    defaultProvider: 'mock',
    autoConnect: false,
    tiktok: { username: '', processInitialData: false, enableExtendedGiftInfo: false },
    baltik: { url: 'ws://127.0.0.1:21213/', reconnectMs: 5000 },
  },
  mock: { autoSimulateOnStart: false, eventsPerMinute: 40 },
};

export function loadSettings(): ServerSettings {
  const file = path.join(ROOT_DIR, 'config', 'settings.json');
  let parsed: Partial<ServerSettings> = {};
  try {
    parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    /* use defaults */
  }
  const s: ServerSettings = {
    server: { ...FALLBACK.server, ...parsed.server },
    database: { ...FALLBACK.database, ...parsed.database },
    live: {
      ...FALLBACK.live,
      ...parsed.live,
      tiktok: { ...FALLBACK.live.tiktok, ...parsed.live?.tiktok },
      baltik: { ...FALLBACK.live.baltik, ...parsed.live?.baltik },
    },
    mock: { ...FALLBACK.mock, ...parsed.mock },
  };
  if (process.env.PORT) s.server.port = Number(process.env.PORT);
  if (process.env.HOST) s.server.host = process.env.HOST;
  if (process.env.DB_FILE) s.database.file = process.env.DB_FILE;
  return s;
}

let counter = 0;
export function uid(prefix = ''): string {
  counter = (counter + 1) % 1e6;
  return prefix + Date.now().toString(36) + counter.toString(36) + Math.random().toString(36).slice(2, 6);
}
