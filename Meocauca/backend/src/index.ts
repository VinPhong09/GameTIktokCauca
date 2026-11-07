// CAT FISHING LIVE – backend entry point.
// Serves the built frontend (/game, /admin, /overlay), REST API (/api) and WebSocket (/ws) on one port.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import express from 'express';
import { ASSETS_DIR, FRONTEND_DIST, ROOT_DIR, loadSettings } from './settings';
import { Db } from './database/db';
import { Repository } from './database/repository';
import { ConfigStore } from './services/ConfigStore';
import { Game } from './services/Game';
import { WsHub } from './websocket/WsHub';
import { ConnectorManager } from './connectors/ConnectorManager';
import { MockSimulator } from './services/MockSimulator';
import { AudienceDirector } from './services/AudienceDirector';
import { TtsService } from './tts/TtsService';
import { createApiRouter } from './api/routes';
import { Logger } from './services/Logger';

async function main() {
  const settings = loadSettings();
  const dbFile = settings.database.file === ':memory:' ? null : path.resolve(ROOT_DIR, settings.database.file);
  const db = await Db.open(dbFile, settings.database.saveIntervalMs);
  const repo = new Repository(db);
  const store = new ConfigStore(repo);
  const game = new Game(store, repo);

  const app = express();
  const server = http.createServer(app);
  const hub = new WsHub(server, () => game.snapshot());
  game.setBroadcaster((msg, opts) => hub.broadcast(msg, opts));
  Logger.onEntry((entry) => hub.broadcast({ type: 'log', entry }, { adminOnly: true }));

  const connectors = new ConnectorManager(game.bus, (status) => hub.broadcast({ type: 'connection', connection: status }));
  game.connectionStatus = () => connectors.status;
  const sim = new MockSimulator(connectors);
  const audience = new AudienceDirector(game, store, connectors);
  audience.start();
  const tts = new TtsService();

  app.disable('x-powered-by');
  app.use('/api', createApiRouter({ game, store, connectors, sim, audience, tts, settings }));
  // Optional GLB models / textures dropped into /assets are served at /models.
  app.use('/models', express.static(ASSETS_DIR, { maxAge: '1h' }));

  const hasDist = fs.existsSync(path.join(FRONTEND_DIST, 'index.html'));
  if (hasDist) {
    app.use(express.static(FRONTEND_DIST, { index: false, maxAge: '1h' }));
    const sendIndex = (_req: express.Request, res: express.Response) => res.sendFile(path.join(FRONTEND_DIST, 'index.html'));
    app.get(['/', '/game', '/admin', '/overlay', '/game/*', '/admin/*', '/overlay/*'], sendIndex);
  } else {
    app.get('/', (_req, res) =>
      res.type('html').send('<h2>Frontend not built.</h2><p>Run <code>start.bat</code> or <code>npm run build</code>, or use the Vite dev server on :5173.</p>'),
    );
  }

  // Default provider = mock so the game is always playable.
  await connectors.connect('mock', {}).catch(() => {});
  if (settings.live.autoConnect && settings.live.defaultProvider !== 'mock') {
    const p = settings.live.defaultProvider;
    connectors
      .connect(p, p === 'tiktok' ? settings.live.tiktok : settings.live.baltik)
      .catch((e) => Logger.error(`Auto-connect failed: ${(e as Error).message}`));
  }
  if (settings.mock.autoSimulateOnStart) sim.start(settings.mock.eventsPerMinute);

  // PID file lets stop.bat stop exactly this server (never other apps on the same port).
  const pidFile = path.join(ROOT_DIR, 'data', 'server.pid');
  const isTestRun = !!process.env.DB_FILE;
  server.listen(settings.server.port, settings.server.host, () => {
    if (!isTestRun) {
      try {
        fs.mkdirSync(path.dirname(pidFile), { recursive: true });
        fs.writeFileSync(pidFile, String(process.pid));
      } catch {
        /* non-fatal */
      }
    }
    const base = `http://localhost:${settings.server.port}`;
    Logger.info('==============================================');
    Logger.info(' CAT FISHING LIVE – HỒ CÂU CÁ MÈO');
    Logger.info(`  Game    : ${base}/game`);
    Logger.info(`  Admin   : ${base}/admin`);
    Logger.info(`  Overlay : ${base}/overlay`);
    Logger.info('==============================================');
    if (!hasDist) Logger.warn('frontend/dist not found – build the frontend first.');
  });
  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') Logger.error(`Port ${settings.server.port} is already in use. Run stop.bat first.`);
    else Logger.error(err.message);
    process.exit(1);
  });

  const shutdown = () => {
    Logger.info('Shutting down…');
    try {
      if (!isTestRun && fs.readFileSync(pidFile, 'utf8').trim() === String(process.pid)) fs.unlinkSync(pidFile);
    } catch {
      /* ignore */
    }
    sim.stop();
    audience.dispose();
    tts.dispose();
    connectors.disconnect().catch(() => {});
    game.shutdown();
    hub.close();
    db.close();
    server.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  process.on('uncaughtException', (e) => Logger.error(`Uncaught: ${e.stack ?? e}`));
  process.on('unhandledRejection', (e) => Logger.error(`Unhandled rejection: ${String(e)}`));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
