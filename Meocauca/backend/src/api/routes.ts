import express, { type Request, type Response, type NextFunction } from 'express';
import type { GameConfig, LiveEventType, ProviderId } from '@shared/types';
import { computeRarityDistribution, fishProbabilityTable } from '@shared/probability';
import type { Game } from '../services/Game';
import type { ConfigStore } from '../services/ConfigStore';
import type { ConnectorManager } from '../connectors/ConnectorManager';
import type { MockSimulator } from '../services/MockSimulator';
import type { AudienceDirector } from '../services/AudienceDirector';
import type { TtsService } from '../tts/TtsService';
import { randomViewer } from '../services/MockSimulator';
import type { ServerSettings } from '../settings';
import { Logger } from '../services/Logger';

type Handler = (req: Request, res: Response) => unknown | Promise<unknown>;
const wrap = (fn: Handler) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res)).catch(next);
};

const EVENT_TYPES: LiveEventType[] = ['COMMENT', 'GIFT', 'LIKE', 'FOLLOW', 'SHARE', 'VIEWER_JOIN', 'VIEWER_LEAVE', 'LIVE_START', 'LIVE_END'];

export function createApiRouter(deps: {
  game: Game;
  store: ConfigStore;
  connectors: ConnectorManager;
  sim: MockSimulator;
  audience: AudienceDirector;
  tts: TtsService;
  settings: ServerSettings;
}) {
  const { game, store, connectors, sim, audience, tts, settings } = deps;
  const r = express.Router();
  r.use(express.json({ limit: '2mb' }));

  r.get('/health', (_req, res) => res.json({ ok: true, time: Date.now() }));
  r.get('/state', (_req, res) => res.json(game.snapshot()));

  // ---------------------------------------------------------------- config
  r.get('/config', (_req, res) => res.json(store.get()));
  r.put('/config', wrap((req, res) => {
    store.replace(req.body as GameConfig);
    res.json(store.get());
  }));
  r.patch('/config/:section', wrap((req, res) => {
    store.updateSection(req.params.section as keyof GameConfig, req.body);
    res.json(store.get());
  }));
  r.post('/config/reset', wrap((req, res) => {
    store.reset(req.body?.section);
    res.json(store.get());
  }));
  r.get('/probability', (req, res) => {
    const luck = Number(req.query.luck ?? 1) || 1;
    const cfg = store.get();
    const mods = game.events.modifiers();
    res.json({
      luck,
      distribution: computeRarityDistribution(cfg.rarities, { luck, rarityMultipliers: mods.rarityMultipliers }),
      fish: fishProbabilityTable(cfg, { luck, rarityMultipliers: mods.rarityMultipliers }, { fishBoost: mods.fishBoost, unlocked: mods.unlocked }).rows.map((x) => ({ id: x.fish.id, name: x.fish.nameVi, rarity: x.fish.rarity, probability: x.probability })),
    });
  });

  // ---------------------------------------------------------------- players
  r.get('/players', (_req, res) => {
    res.json({ active: game.players.allDTO(), queue: game.players.queue, known: game.players.records.size });
  });
  r.get('/players/:id/catches', (req, res) => res.json(game.repo.recentCatches(req.params.id, 50)));
  r.post('/players/:id/appearance', wrap((req, res) => {
    const ok = game.players.setCat(req.params.id, String(req.body?.catId ?? ''));
    res.status(ok ? 200 : 400).json({ ok });
  }));
  r.post('/players/:id/reset', wrap((req, res) => {
    const ok = game.players.resetStats(req.params.id);
    game.leaderboard.markDirty(true);
    res.status(ok ? 200 : 404).json({ ok });
  }));
  r.post('/players/:id/luck', wrap((req, res) => {
    const raw = req.body?.luck;
    const luck = raw === null || raw === undefined || raw === '' ? null : Number(raw);
    if (luck !== null && (!Number.isFinite(luck) || luck <= 0)) return res.status(400).json({ error: 'luck must be a positive number or null' });
    const ok = game.players.setLuck(req.params.id, luck, req.body?.persist === true);
    res.status(ok ? 200 : 404).json({ ok });
  }));
  r.post('/players/:id/cast', wrap((req, res) => {
    res.json({ result: game.fishing.requestCast(req.params.id, 'admin') });
  }));
  r.delete('/players/:id', wrap((req, res) => {
    game.players.leave(req.params.id, 'removed');
    if (req.query.forget === '1') {
      game.players.records.delete(req.params.id);
      game.repo.deletePlayer(req.params.id);
      game.leaderboard.markDirty(true);
    }
    res.json({ ok: true });
  }));

  // ---------------------------------------------------------------- game control
  r.post('/game/:action', wrap((req, res) => {
    switch (req.params.action) {
      case 'start': game.startSession(); break;
      case 'pause': game.pause(); break;
      case 'resume': game.resume(); break;
      case 'restart': game.restart(); break;
      case 'reset-leaderboard': game.resetLeaderboard(); break;
      case 'cast-all':
        for (const p of game.players.seated()) game.fishing.requestCast(p.record.id, 'admin');
        break;
      case 'show-gift-guide':
        game.showGiftGuide();
        break;
      case 'show-leaderboard':
        game.broadcast({ type: 'show_leaderboard', category: req.body?.category ?? 'weight' });
        break;
      default:
        return res.status(400).json({ error: 'Unknown action' });
    }
    res.json(game.gameState());
  }));
  r.get('/stats', (_req, res) => res.json(game.stats.compute()));
  r.get('/leaderboard', (_req, res) => res.json(game.leaderboard.get()));
  r.get('/logs', (_req, res) => res.json(Logger.recent(300)));

  // ---------------------------------------------------------------- fishing events
  r.get('/events', (_req, res) => res.json({ active: game.events.list(), next: game.events.nextScheduled() }));
  r.post('/events/:id/start', wrap((req, res) => {
    const a = game.events.start(req.params.id, 'manual', req.body?.durationSec ? Number(req.body.durationSec) : undefined);
    res.status(a ? 200 : 404).json(a ?? { error: 'Unknown event' });
  }));
  r.post('/events/:id/stop', wrap((req, res) => res.json({ ok: game.events.stop(req.params.id) })));

  // ---------------------------------------------------------------- live connection
  r.get('/connection', (_req, res) => res.json(connectors.status));
  r.post('/connect', wrap(async (req, res) => {
    const provider = (req.body?.provider ?? 'mock') as ProviderId;
    const opts = {
      ...(provider === 'tiktok' ? settings.live.tiktok : {}),
      ...(provider === 'baltik' ? settings.live.baltik : {}),
      ...(req.body?.options ?? {}),
    };
    try {
      await connectors.connect(provider, opts);
      res.json(connectors.status);
    } catch (e) {
      res.status(400).json({ ...connectors.status, error: (e as Error).message });
    }
  }));
  r.post('/disconnect', wrap(async (_req, res) => {
    await connectors.disconnect();
    res.json(connectors.status);
  }));

  // ---------------------------------------------------------------- mock simulator
  r.post('/mock/event', wrap((req, res) => {
    const body = req.body ?? {};
    const type = String(body.type ?? '').toUpperCase() as LiveEventType;
    if (!EVENT_TYPES.includes(type)) return res.status(400).json({ error: 'Invalid event type' });
    const user = body.user?.uniqueId || body.user?.userId ? body.user : randomViewer();
    const e = sim.emit({ ...body, type, user });
    res.json({ ok: true, event: e });
  }));
  r.post('/mock/spawn', wrap((req, res) => {
    const n = Math.max(1, Math.min(60, Number(req.body?.count ?? 10)));
    sim.spawn(n, req.body?.fish !== false);
    res.json({ ok: true, count: n });
  }));
  r.post('/mock/auto', wrap((req, res) => {
    if (req.body?.enabled) sim.start(Number(req.body?.eventsPerMinute ?? sim.rate));
    else sim.stop();
    res.json({ running: sim.running, rate: sim.rate });
  }));
  r.get('/mock/auto', (_req, res) => res.json({ running: sim.running, rate: sim.rate }));

  // ---------------------------------------------------------------- voice announcer (TTS)
  const sendAudio = async (res: Response, text: string) => {
    try {
      const a = await tts.synthesize(text, store.get().ui.voice);
      res.setHeader('Content-Type', a.mime);
      res.setHeader('Cache-Control', 'private, max-age=600');
      res.setHeader('X-TTS-Engine', a.engine);
      res.end(a.buf);
    } catch (e) {
      res.status(503).json({ error: (e as Error).message });
    }
  };
  r.get('/tts/status', wrap(async (req, res) => {
    res.json(await tts.status(req.query.probe === '1', store.get().ui.voice));
  }));
  r.get('/tts/preview', wrap(async (req, res) => {
    const text = String(req.query.text ?? '').slice(0, 220);
    if (!text.trim()) return res.status(400).json({ error: 'text is required' });
    await sendAudio(res, text);
  }));
  r.get('/tts/:id', wrap(async (req, res) => {
    const text = game.announcer.get(req.params.id);
    if (!text) return res.status(404).json({ error: 'unknown speech id' });
    await sendAudio(res, text);
  }));

  // ---------------------------------------------------------------- auto audience (bots)
  r.get('/audience/status', (_req, res) => res.json(audience.status()));
  r.post('/audience/clear', wrap((_req, res) => {
    res.json({ removed: audience.clearBots() });
  }));

  r.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    Logger.error(`API error: ${err.message}`);
    res.status(400).json({ error: err.message });
  });
  return r;
}
