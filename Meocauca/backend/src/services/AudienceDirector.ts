import type { AutoAudienceSettings } from '@shared/types';
import { MockConnector, type MockEventInput } from '../connectors/MockConnector';
import type { ConnectorManager } from '../connectors/ConnectorManager';
import type { ActivePlayer } from '../players/PlayerManager';
import type { ConfigStore } from './ConfigStore';
import type { Game } from './Game';
import { randomViewer } from './fakeNames';
import { Logger } from './Logger';

const GIFTS: { name: string; diamonds: number; weight: number }[] = [
  { name: 'Rose', diamonds: 1, weight: 60 },
  { name: 'Finger Heart', diamonds: 5, weight: 22 },
  { name: 'Doughnut', diamonds: 30, weight: 11 },
  { name: 'Hand Heart', diamonds: 100, weight: 6 },
  { name: 'Galaxy', diamonds: 1000, weight: 1 },
];

export interface AudienceStatus {
  enabled: boolean;
  botsSeated: number;
  botsQueued: number;
  realSeated: number;
  realQueued: number;
  freeSeats: number;
  maxPlayers: number;
  maxBots: number;
  /** Seats bots may still take right now (limit, kept-free seats, real viewers waiting). */
  roomForBots: number;
}

/**
 * Automatic simulated audience ("khán giả tự động").
 * Every second it keeps the pond lively within the admin's limits:
 *  - new bot cats join at `joinsPerMinute`, never above `maxBots`, always leaving `keepFreeSeats` free
 *    and never while a real viewer is waiting in the queue;
 *  - each bot stays a random `stayMinMin`–`stayMaxMin` minutes, then leaves the LIVE (rotation);
 *  - bots fish (`castsPerMinute` each), like, gift and share at the configured rates.
 * Every action is a normal Mock event, so it goes through the exact same pipeline as TikTok.
 */
export class AudienceDirector {
  private timer: NodeJS.Timeout | null = null;
  private acc = { join: 0, like: 0, gift: 0, share: 0 };
  private leaveAt = new Map<string, number>();
  private wasEnabled = false;

  constructor(
    private game: Game,
    private store: ConfigStore,
    private connectors: ConnectorManager,
  ) {}

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => this.tick(), 1000);
  }

  dispose() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private settings(): AutoAudienceSettings {
    return this.store.get().game.autoAudience;
  }

  private emit(input: MockEventInput) {
    this.connectors.injectMock(MockConnector.build(input));
  }

  private bots(): ActivePlayer[] {
    return [...this.game.players.active.values()].filter((p) => p.bot);
  }

  status(): AudienceStatus {
    const s = this.settings();
    const all = [...this.game.players.active.values()];
    const seated = all.filter((p) => p.seat !== null);
    const maxPlayers = this.store.get().game.maxPlayers;
    const botsSeated = seated.filter((p) => p.bot).length;
    const realQueued = all.filter((p) => p.seat === null && !p.bot).length;
    const roomForBots = realQueued > 0 ? 0 : Math.max(0, Math.min(s.maxBots - botsSeated, maxPlayers - s.keepFreeSeats - seated.length));
    return {
      enabled: s.enabled,
      botsSeated,
      botsQueued: all.filter((p) => p.seat === null && p.bot).length,
      realSeated: seated.length - botsSeated,
      realQueued,
      freeSeats: Math.max(0, maxPlayers - seated.length),
      maxPlayers,
      maxBots: s.maxBots,
      roomForBots,
    };
  }

  /** Make every bot leave the pond (e.g. right before going LIVE). */
  clearBots(): number {
    const bots = this.bots();
    for (const b of bots) this.game.players.leave(b.record.id, 'bot_clear');
    this.leaveAt.clear();
    return bots.length;
  }

  tick() {
    const s = this.settings();
    if (s.enabled !== this.wasEnabled) {
      this.wasEnabled = s.enabled;
      this.connectors.setMockAuto(s.enabled);
      Logger.info(`Auto audience ${s.enabled ? 'ON' : 'OFF'}`);
    }
    if (!s.enabled || this.game.isPaused()) {
      this.acc = { join: 0, like: 0, gift: 0, share: 0 };
      return;
    }
    const now = Date.now();
    const bots = this.bots();
    const seatedBots = bots.filter((p) => p.seat !== null);

    // Forget bots that are gone; give newcomers a stay deadline.
    const ids = new Set(bots.map((b) => b.record.id));
    for (const id of [...this.leaveAt.keys()]) if (!ids.has(id)) this.leaveAt.delete(id);
    for (const b of bots) {
      if (!this.leaveAt.has(b.record.id)) {
        const stay = s.stayMaxMin > 0 ? s.stayMinMin + Math.random() * (s.stayMaxMin - s.stayMinMin) : 0;
        this.leaveAt.set(b.record.id, stay > 0 ? now + stay * 60_000 : Infinity);
      }
    }

    // 1) Too many bots (limit lowered) → one leaves per second, idle ones first.
    if (seatedBots.length > s.maxBots) {
      const extra = [...seatedBots].sort((a, b) => Number(a.status === 'fishing') - Number(b.status === 'fishing'))[0];
      this.leave(extra);
      return;
    }

    // 2) Bots whose time is up leave the LIVE (not in the middle of a catch).
    for (const b of bots) {
      if ((this.leaveAt.get(b.record.id) ?? Infinity) <= now && b.status !== 'fishing') this.leave(b);
    }

    // 3) New bots join while there is room for them.
    this.acc.join = Math.min(3, this.acc.join + s.joinsPerMinute / 60);
    while (this.acc.join >= 1) {
      this.acc.join -= 1;
      if (this.status().roomForBots <= 0) {
        this.acc.join = 0;
        break;
      }
      this.emit({ type: 'COMMENT', user: randomViewer(), comment: Math.random() < 0.7 ? 'câu' : 'câu cá' });
    }

    const present = this.bots().filter((p) => p.seat !== null);
    if (!present.length) return;
    const pick = () => present[Math.floor(Math.random() * present.length)];
    const user = (p: ActivePlayer) => ({ userId: p.record.id, uniqueId: p.record.uniqueId, nickname: p.record.nickname, bot: true });

    // 4) Bots keep fishing.
    const castChance = s.castsPerMinute / 60;
    for (const b of present) {
      if (b.status === 'fishing' || b.pendingCasts > 0) continue;
      if (Math.random() < castChance) this.emit({ type: 'COMMENT', user: user(b), comment: Math.random() < 0.75 ? 'câu' : 'câu cá' });
    }

    // 5) Likes, gifts, shares across the whole bot audience.
    this.acc.like += s.likesPerMinute / 60;
    while (this.acc.like >= 1) {
      this.acc.like -= 1;
      this.emit({ type: 'LIKE', user: user(pick()), likeCount: 5 + Math.floor(Math.random() * 26) });
    }
    this.acc.gift += s.giftsPerMinute / 60;
    while (this.acc.gift >= 1) {
      this.acc.gift -= 1;
      let w = Math.random() * GIFTS.reduce((t, g) => t + g.weight, 0);
      const g = GIFTS.find((x) => (w -= x.weight) <= 0) ?? GIFTS[0];
      this.emit({ type: 'GIFT', user: user(pick()), giftName: g.name, diamonds: g.diamonds, repeatCount: g.diamonds < 10 ? 1 + Math.floor(Math.random() * 3) : 1 });
    }
    this.acc.share += s.sharesPerMinute / 60;
    while (this.acc.share >= 1) {
      this.acc.share -= 1;
      this.emit({ type: 'SHARE', user: user(pick()) });
    }
  }

  private leave(p: ActivePlayer) {
    this.leaveAt.delete(p.record.id);
    this.emit({ type: 'VIEWER_LEAVE', user: { userId: p.record.id, uniqueId: p.record.uniqueId, nickname: p.record.nickname, bot: true } });
  }
}
