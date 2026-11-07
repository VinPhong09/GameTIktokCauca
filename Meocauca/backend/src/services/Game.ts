import crypto from 'node:crypto';
import { Announcer } from './Announcer';
import type { GameConfig, GameStateDTO, NotificationDTO, ServerMessage, Snapshot } from '@shared/types';
import type { Rng } from '@shared/probability';
import type { Repository } from '../database/repository';
import { PlayerManager } from '../players/PlayerManager';
import { LuckService } from '../probability/LuckService';
import { CommunityService } from './CommunityService';
import { FishingEventService } from './FishingEventService';
import { FishingService } from '../fishing/FishingService';
import { LeaderboardService } from './LeaderboardService';
import { StatsService } from './StatsService';
import type { ConfigStore } from './ConfigStore';
import type { GameContext, NotifyInput } from './context';
import { EventBus } from '../events/EventBus';
import { EventProcessor } from '../events/EventProcessor';
import { Logger } from './Logger';
import { uid } from '../settings';

/** Cryptographically strong uniform RNG in [0, 1). */
export const secureRng: Rng = () => crypto.randomInt(0, 2 ** 32) / 2 ** 32;

type Broadcaster = (msg: ServerMessage, opts?: { adminOnly?: boolean }) => void;

/** Composition root + game control (start / pause / resume / restart). */
export class Game implements GameContext {
  readonly players: PlayerManager;
  readonly luck: LuckService;
  readonly community: CommunityService;
  readonly events: FishingEventService;
  readonly fishing: FishingService;
  readonly leaderboard: LeaderboardService;
  readonly stats: StatsService;
  readonly bus = new EventBus();
  readonly processor: EventProcessor;
  readonly announcer: Announcer;
  rng: Rng = secureRng;

  private status: GameStateDTO['status'] = 'running';
  private session = { id: uid('s'), startedAt: Date.now() };
  private recent: NotificationDTO[] = [];
  private tickTimer: NodeJS.Timeout;
  private broadcaster: Broadcaster = () => {};

  constructor(private store: ConfigStore, readonly repo: Repository) {
    this.announcer = new Announcer(() => this.store.get().ui.voice, (speech) => this.broadcast({ type: 'speak', speech }));
    this.leaderboard = new LeaderboardService(this);
    this.players = new PlayerManager(this);
    this.luck = new LuckService(this);
    this.community = new CommunityService(this);
    this.events = new FishingEventService(this);
    this.fishing = new FishingService(this);
    this.stats = new StatsService(this);
    this.processor = new EventProcessor(this);
    this.bus.subscribe((e) => this.processor.handle(e));
    this.bus.onDuplicate = (e) => {
      this.stats.duplicatesDropped++;
      Logger.warn(`Duplicate event dropped: ${e.type} ${e.id}`);
    };
    repo.startSession(this.session.id);
    store.onChange((cfg, section) => {
      this.broadcast({ type: 'config', config: cfg });
      if (section === 'game' || section === 'all') this.players.reflowSeats();
      this.community.scheduleBroadcast();
    });
    this.tickTimer = setInterval(() => this.tick(), 1000);
  }

  setBroadcaster(b: Broadcaster) {
    this.broadcaster = b;
  }

  // ---- GameContext ---------------------------------------------------------
  config(): GameConfig {
    return this.store.get();
  }
  now() {
    return Date.now();
  }
  broadcast(msg: ServerMessage, opts?: { adminOnly?: boolean }) {
    this.broadcaster(msg, opts);
  }
  notify(n: NotifyInput) {
    const full: NotificationDTO = { ...n, id: uid('n'), createdAt: Date.now() };
    this.recent.push(full);
    if (this.recent.length > 40) this.recent.shift();
    this.broadcast({ type: 'notification', notification: full });
    this.announcer.handle(full);
  }
  isPaused() {
    return this.status !== 'running';
  }
  sessionId() {
    return this.session.id;
  }

  // ---- loop ----------------------------------------------------------------
  private tick() {
    const now = Date.now();
    this.players.tick(now);
    this.fishing.autoFishTick(now);
    this.community.tick(now);
    this.events.tick(now);
    this.tickGiftGuide(now);
  }

  // ---- gift guide popup ------------------------------------------------------
  private nextGiftGuideAt = 0;
  private lastGiftGuideAt = 0;

  private tickGiftGuide(now: number) {
    const g = this.config().ui.giftGuide;
    if (!this.nextGiftGuideAt) this.nextGiftGuideAt = now + Math.max(0, g.firstDelaySec) * 1000;
    if (!g.enabled || g.intervalSec <= 0 || this.isPaused()) return;
    if (now >= this.nextGiftGuideAt) this.showGiftGuide();
  }

  /** Broadcast the gift guide. Viewer requests are rate-limited (20 s); admin/timer are not. */
  showGiftGuide(requestedBy?: string): boolean {
    const now = Date.now();
    const g = this.config().ui.giftGuide;
    if (requestedBy && now - this.lastGiftGuideAt < 20_000) return false;
    this.lastGiftGuideAt = now;
    this.nextGiftGuideAt = now + Math.max(15, g.intervalSec) * 1000;
    this.broadcast({ type: 'show_gift_guide', durationSec: Math.max(3, g.durationSec), requestedBy });
    return true;
  }

  // ---- control -------------------------------------------------------------
  gameState(): GameStateDTO {
    return {
      status: this.status,
      sessionId: this.session.id,
      sessionStartedAt: this.session.startedAt,
      totalCatches: this.stats.compute().totalCatches,
      queue: [...this.players.queue],
    };
  }

  private pushState() {
    this.broadcast({ type: 'game_state', game: this.gameState() });
  }

  startSession() {
    this.repo.endSession(this.session.id);
    this.session = { id: uid('s'), startedAt: Date.now() };
    this.repo.startSession(this.session.id);
    this.status = 'running';
    Logger.info(`New fishing session ${this.session.id}`);
    this.notify({ kind: 'info', title: 'Phiên câu mới', message: 'Phiên câu cá mới đã bắt đầu! Bình luận "câu" để tham gia 🎣' });
    this.pushState();
  }

  pause() {
    this.status = 'paused';
    Logger.info('Game paused');
    this.notify({ kind: 'info', title: 'Tạm dừng', message: 'Hồ câu tạm dừng trong giây lát…' });
    this.pushState();
  }

  resume() {
    this.status = 'running';
    Logger.info('Game resumed');
    this.notify({ kind: 'info', title: 'Tiếp tục', message: 'Hồ câu đã mở lại! 🎣' });
    this.pushState();
  }

  restart() {
    this.fishing.cancelAll();
    this.players.clearPond('restart');
    this.community.reset();
    this.events.stopAll();
    this.recent = [];
    this.broadcast({ type: 'clear' });
    this.startSession();
    this.broadcast({ type: 'snapshot', data: this.snapshot() });
  }

  resetLeaderboard() {
    this.players.resetAllStats();
    this.leaderboard.markDirty(true);
    this.stats.markDirty();
    Logger.info('Leaderboard reset');
    this.notify({ kind: 'info', title: 'Bảng xếp hạng', message: 'Bảng xếp hạng đã được làm mới!' });
    this.pushState();
  }

  snapshot(connection = this.connectionStatus()): Snapshot {
    return {
      serverTime: Date.now(),
      config: this.config(),
      players: this.players.allDTO(),
      cycles: this.fishing.snapshot(),
      leaderboard: this.leaderboard.get(),
      community: this.community.state(),
      events: this.events.list(),
      game: this.gameState(),
      connection,
      stats: this.stats.compute(),
      recent: this.recent.slice(-15),
    };
  }

  connectionStatus: () => Snapshot['connection'] = () => ({ provider: null, state: 'disconnected', since: Date.now(), mockAuto: false });

  shutdown() {
    clearInterval(this.tickTimer);
    this.stats.stop();
    this.fishing.cancelAll();
    this.players.flush();
    this.repo.endSession(this.session.id);
  }
}
