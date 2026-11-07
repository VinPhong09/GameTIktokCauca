import type { LiveUser, PlayerDTO, PlayerStatus, Rarity } from '@shared/types';
import { emptyStats, type PlayerRecord } from '../database/repository';
import type { GameContext } from '../services/context';
import { Logger } from '../services/Logger';

export interface Boost {
  id: string;
  source: string;
  luck: number;
  rarityBoost: Partial<Record<Rarity, number>>;
  attemptsLeft: number;
  expiresAt: number | null;
}

export interface ActivePlayer {
  record: PlayerRecord;
  seat: number | null;
  status: PlayerStatus;
  joinedAt: number;
  lastActive: number;
  boosts: Boost[];
  pendingCasts: number;
  lastCommandAt: number;
  lastCycleEndAt: number;
  hasFished: boolean;
  /** Personal luck rolled when the cat entered the pond. */
  joinLuck: number;
  /** Luck set by the admin for this visit only (null = not set). */
  adminLuck: number | null;
  /** Simulated audience member – gives its seat to real viewers. */
  bot: boolean;
}

export type JoinResult = 'joined' | 'already' | 'queued' | 'rejected';

/** Leave reasons that are announced in the feed ("👋 … đã rời hồ"). */
const LEAVE_MESSAGES: Record<string, string> = {
  idle: 'đã rời hồ (không còn tương tác)',
  left_live: 'đã rời LIVE và rời hồ',
  command: 'đã rời hồ. Hẹn gặp lại!',
};

const isBot = (p: ActivePlayer | undefined) => !!p?.bot;

/** Registration, seats around the pond, waiting queue and idle timeouts. */
export class PlayerManager {
  readonly records = new Map<string, PlayerRecord>();
  readonly active = new Map<string, ActivePlayer>();
  queue: string[] = [];
  private saveQueue = new Set<string>();

  constructor(private ctx: GameContext) {
    for (const r of ctx.repo.loadPlayers()) this.records.set(r.id, r);
    Logger.info(`Loaded ${this.records.size} known players`);
  }

  get(id: string) {
    return this.active.get(id);
  }

  seated(): ActivePlayer[] {
    return [...this.active.values()].filter((p) => p.seat !== null);
  }

  /** Create or refresh the persistent record for a TikTok user. */
  ensureRecord(user: LiveUser): PlayerRecord {
    const id = user.userId || user.uniqueId;
    let rec = this.records.get(id);
    const now = this.ctx.now();
    if (!rec) {
      rec = {
        id,
        uniqueId: user.uniqueId || id,
        nickname: user.nickname || user.uniqueId || 'Mèo',
        avatarUrl: user.avatarUrl,
        catId: this.pickCatId(),
        stats: emptyStats(),
        createdAt: now,
        lastSeen: now,
        luckOverride: null,
      };
      this.records.set(id, rec);
    } else {
      if (user.nickname) rec.nickname = user.nickname;
      if (user.uniqueId) rec.uniqueId = user.uniqueId;
      if (user.avatarUrl) rec.avatarUrl = user.avatarUrl;
      rec.lastSeen = now;
    }
    this.markDirty(rec.id);
    return rec;
  }

  /** Least-used appearance among current players, random tie-break. */
  private pickCatId(): string {
    const cats = this.ctx.config().cats;
    const used = new Map<string, number>();
    for (const p of this.active.values()) used.set(p.record.catId, (used.get(p.record.catId) ?? 0) + 1);
    const min = Math.min(...cats.map((c) => used.get(c.id) ?? 0));
    const options = cats.filter((c) => (used.get(c.id) ?? 0) === min);
    return options[Math.floor(this.ctx.rng() * options.length)]?.id ?? cats[0].id;
  }

  /** Free seat that is furthest away from occupied seats → cats spread evenly around the pond. */
  private findSeat(): number | null {
    const max = this.ctx.config().game.maxPlayers;
    const taken = new Set(this.seated().map((p) => p.seat as number));
    if (taken.size >= max) return null;
    if (!taken.size) return Math.floor(max * 0.5);
    let best: number | null = null;
    let bestDist = -1;
    for (let s = 0; s < max; s++) {
      if (taken.has(s)) continue;
      let d = Infinity;
      for (const t of taken) {
        const diff = Math.abs(s - t);
        d = Math.min(d, Math.min(diff, max - diff));
      }
      // Slight preference for back-row seats (cats there face the camera). Seat 0 = front-center.
      const frontBias = -Math.cos((s / max) * Math.PI * 2) * 0.01;
      if (d + frontBias > bestDist) {
        bestDist = d + frontBias;
        best = s;
      }
    }
    return best;
  }

  /**
   * Make room by replacing a long-idle player who never fished.
   * A simulated newcomer may only replace other simulated cats – never a real viewer.
   */
  private evictForNewcomer(newcomerIsBot: boolean): number | null {
    const now = this.ctx.now();
    const candidates = this.seated()
      .filter((p) => p.status === 'idle' && now - p.lastActive > 60_000 && (!newcomerIsBot || p.bot))
      .sort((a, b) => Number(a.hasFished) - Number(b.hasFished) || a.lastActive - b.lastActive);
    const victim = candidates[0];
    if (!victim) return null;
    const seat = victim.seat;
    this.leave(victim.record.id, 'replaced', false);
    return seat;
  }

  /** Pond full → a simulated cat gives its seat to a real viewer (idle bots first, then the least active). */
  private evictBotFor(nickname: string): number | null {
    const victim = this.seated()
      .filter((p) => p.bot)
      .sort((a, b) => Number(a.status === 'fishing') - Number(b.status === 'fishing') || a.lastActive - b.lastActive)[0];
    if (!victim) return null;
    const seat = victim.seat;
    Logger.info(`Bot ${victim.record.nickname} gives seat ${seat} to viewer ${nickname}`);
    this.leave(victim.record.id, 'yield', false);
    return seat;
  }

  join(user: LiveUser, reason: string): { player: ActivePlayer | null; result: JoinResult } {
    const rec = this.ensureRecord(user);
    const existing = this.active.get(rec.id);
    const now = this.ctx.now();
    if (existing) {
      existing.lastActive = now;
      return { player: existing, result: 'already' };
    }
    const cfg = this.ctx.config().game;
    const bot = !!user.bot;
    const yieldOn = cfg.botsYieldToViewers;
    let seat = this.findSeat();
    if (seat === null && !bot && yieldOn) seat = this.evictBotFor(rec.nickname);
    if (seat === null && reason !== 'viewer_join') seat = this.evictForNewcomer(bot);
    const player: ActivePlayer = {
      record: rec, seat, status: seat === null ? 'queued' : 'idle', joinedAt: now, lastActive: now,
      boosts: [], pendingCasts: 0, lastCommandAt: 0, lastCycleEndAt: 0, hasFished: false,
      joinLuck: this.ctx.luck.rollJoinLuck(), adminLuck: null, bot,
    };
    if (seat === null) {
      if (!cfg.queueEnabled || reason === 'viewer_join') return { player: null, result: 'rejected' };
      if (this.queue.length >= cfg.maxQueue) {
        // Full queue: a real viewer bumps the last simulated cat in line.
        const lastBot = !bot && yieldOn ? [...this.queue].reverse().find((id) => isBot(this.active.get(id))) : undefined;
        if (!lastBot) return { player: null, result: 'rejected' };
        this.leave(lastBot, 'yield', false);
      }
      this.active.set(rec.id, player);
      // Real viewers wait in front of every simulated cat.
      const firstBot = !bot && yieldOn ? this.queue.findIndex((id) => isBot(this.active.get(id))) : -1;
      if (firstBot >= 0) this.queue.splice(firstBot, 0, rec.id);
      else this.queue.push(rec.id);
      const pos = this.queue.indexOf(rec.id) + 1;
      this.ctx.broadcast({ type: 'player_joined', player: this.toDTO(player) });
      this.ctx.notify({ kind: 'queue', title: 'Hàng chờ', message: `${rec.nickname} đang chờ chỗ ngồi (#${pos})`, playerId: rec.id, catId: rec.catId });
      Logger.info(`Player queued: ${rec.nickname} (#${pos})`);
      return { player, result: 'queued' };
    }
    this.active.set(rec.id, player);
    this.ctx.broadcast({ type: 'player_joined', player: this.toDTO(player) });
    Logger.info(`Player joined: ${rec.nickname} seat ${seat} (${reason})`);
    this.ctx.stats.markDirty();
    return { player, result: 'joined' };
  }

  /** promote = false when the freed seat is handed to a newcomer right away (eviction). */
  leave(id: string, reason: string, promote = true) {
    const p = this.active.get(id);
    if (!p) return;
    this.ctx.fishing.cancel(id);
    this.active.delete(id);
    this.queue = this.queue.filter((q) => q !== id);
    this.ctx.broadcast({ type: 'player_left', playerId: id, reason });
    Logger.info(`Player left: ${p.record.nickname} (${reason})`);
    const msg = LEAVE_MESSAGES[reason];
    if (msg) this.ctx.notify({ kind: 'leave', title: '👋 Tạm biệt', message: `${p.record.nickname} ${msg}`, playerId: id, catId: p.record.catId, speech: { name: p.record.nickname, bot: p.bot } });
    this.flushOne(id);
    if (p.seat !== null && promote) this.promoteQueue();
    this.ctx.stats.markDirty();
  }

  promoteQueue() {
    const yieldOn = this.ctx.config().game.botsYieldToViewers;
    while (this.queue.length) {
      const seat = this.findSeat();
      if (seat === null) return;
      // Real viewers are always seated before simulated cats.
      let idx = yieldOn ? this.queue.findIndex((q) => !isBot(this.active.get(q))) : 0;
      if (idx < 0) idx = 0;
      const id = this.queue.splice(idx, 1)[0];
      const p = this.active.get(id);
      if (!p) continue;
      p.seat = seat;
      p.status = 'idle';
      p.lastActive = this.ctx.now();
      this.ctx.broadcast({ type: 'player_joined', player: this.toDTO(p) });
      this.ctx.notify({ kind: 'join', title: 'Vào hồ', message: `${p.record.nickname} đã có chỗ câu!`, playerId: id, catId: p.record.catId, speech: { name: p.record.nickname, bot: p.bot } });
    }
  }

  /** When maxPlayers shrinks, overflow seats go back to the front of the queue. */
  reflowSeats() {
    const max = this.ctx.config().game.maxPlayers;
    const overflow = this.seated().filter((p) => (p.seat as number) >= max);
    for (const p of overflow) {
      this.ctx.fishing.cancel(p.record.id);
      p.seat = null;
      p.status = 'queued';
      this.queue.unshift(p.record.id);
      this.ctx.broadcast({ type: 'player_left', playerId: p.record.id, reason: 'reflow' });
    }
    this.promoteQueue();
  }

  touch(id: string) {
    const p = this.active.get(id);
    if (p) p.lastActive = this.ctx.now();
  }

  setCat(id: string, catId: string) {
    const rec = this.records.get(id);
    if (!rec || !this.ctx.config().cats.some((c) => c.id === catId)) return false;
    rec.catId = catId;
    this.markDirty(id);
    const p = this.active.get(id);
    if (p) this.ctx.broadcast({ type: 'player_updated', player: this.toDTO(p) });
    return true;
  }

  /**
   * Admin: set a viewer's personal luck. `luck = null` clears it (back to the random join roll).
   * persist = true saves it on the player so it applies on every future visit too.
   */
  setLuck(id: string, luck: number | null, persist: boolean): boolean {
    const rec = this.records.get(id);
    if (!rec) return false;
    const value = luck === null ? null : Math.round(Math.min(100, Math.max(0.1, luck)) * 100) / 100;
    const p = this.active.get(id);
    if (value === null) {
      rec.luckOverride = null;
      if (p) p.adminLuck = null;
    } else if (persist) {
      rec.luckOverride = value;
      if (p) p.adminLuck = null;
    } else {
      if (!p) return false; // a one-visit luck needs the cat to be in the pond
      p.adminLuck = value;
    }
    this.markDirty(id);
    this.flushOne(id);
    if (p) this.ctx.broadcast({ type: 'player_updated', player: this.toDTO(p) });
    Logger.info(`Luck for ${rec.nickname}: ${value === null ? 'random' : 'x' + value + (persist ? ' (fixed)' : ' (this visit)')}`);
    return true;
  }

  resetStats(id: string) {
    const rec = this.records.get(id);
    if (!rec) return false;
    const gifts = { totalGifts: rec.stats.totalGifts, totalDiamonds: rec.stats.totalDiamonds };
    rec.stats = { ...emptyStats(), ...gifts };
    this.ctx.repo.resetPlayer(id);
    this.markDirty(id);
    const p = this.active.get(id);
    if (p) this.ctx.broadcast({ type: 'player_updated', player: this.toDTO(p) });
    return true;
  }

  resetAllStats() {
    for (const rec of this.records.values()) {
      rec.stats = { ...emptyStats(), totalGifts: rec.stats.totalGifts, totalDiamonds: rec.stats.totalDiamonds };
    }
    this.ctx.repo.resetLeaderboard();
    for (const p of this.active.values()) this.ctx.broadcast({ type: 'player_updated', player: this.toDTO(p) });
  }

  clearPond(reason: string) {
    for (const id of [...this.active.keys()]) this.leave(id, reason);
    this.queue = [];
  }

  /** Real viewers still waiting while bots sit in the pond (e.g. the option was just turned on) → bots give way. */
  private yieldBotsToQueue() {
    if (!this.ctx.config().game.botsYieldToViewers) return;
    for (let guard = 0; guard < 100; guard++) {
      const waiting = this.queue.find((id) => { const p = this.active.get(id); return !!p && !p.bot; });
      if (!waiting) return;
      const bot = this.seated()
        .filter((p) => p.bot)
        .sort((a, b) => Number(a.status === 'fishing') - Number(b.status === 'fishing') || a.lastActive - b.lastActive)[0];
      if (!bot) return;
      this.leave(bot.record.id, 'yield'); // promotes the first real viewer in the queue
    }
  }

  tick(now: number) {
    this.yieldBotsToQueue();
    const timeout = this.ctx.config().game.idleTimeoutMin * 60_000;
    if (timeout > 0) {
      for (const p of [...this.active.values()]) {
        if (p.status !== 'fishing' && now - p.lastActive > timeout) this.leave(p.record.id, 'idle');
      }
    }
    this.flush();
  }

  markDirty(id: string) {
    this.saveQueue.add(id);
  }

  private flushOne(id: string) {
    const rec = this.records.get(id);
    if (rec) this.ctx.repo.savePlayer(rec);
    this.saveQueue.delete(id);
  }

  flush() {
    for (const id of [...this.saveQueue]) this.flushOne(id);
  }

  toDTO(p: ActivePlayer): PlayerDTO {
    const eff = this.ctx.luck.effective(p);
    return {
      id: p.record.id,
      uniqueId: p.record.uniqueId,
      nickname: p.record.nickname,
      avatarUrl: p.record.avatarUrl,
      catId: p.record.catId,
      seat: p.seat,
      status: p.status,
      luck: Math.round(eff.luck * 100) / 100,
      personalLuck: eff.personalLuck,
      personalLuckSource: this.ctx.luck.personal(p).source,
      bot: p.bot,
      boostAttempts: eff.attempts,
      rank: this.ctx.leaderboard.rankOf(p.record.id),
      stats: { ...p.record.stats },
      joinedAt: p.joinedAt,
      lastActive: p.lastActive,
    };
  }

  allDTO(): PlayerDTO[] {
    return [...this.active.values()].map((p) => this.toDTO(p));
  }
}
