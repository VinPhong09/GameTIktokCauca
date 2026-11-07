import { catchScore, computeRarityDistribution, pickFish, rollRarity, rollWeight } from '@shared/probability';
import type { CatchDTO, FishingCycleDTO, FishingTimeline, Rarity } from '@shared/types';
import type { GameContext } from '../services/context';
import type { ActivePlayer } from '../players/PlayerManager';
import { Logger } from '../services/Logger';
import { uid } from '../settings';

export type CastSource = 'command' | 'gift' | 'community' | 'admin' | 'auto';
export type CastResult = 'started' | 'queued' | 'cooldown' | 'busy' | 'paused' | 'not_seated' | 'unknown_player';

interface ActiveCycle {
  dto: FishingCycleDTO;
  startedAt: number;
  timers: NodeJS.Timeout[];
}

const DRAMA: Record<Rarity, { pull: number; result: number; celebrate: number }> = {
  common: { pull: 1300, result: 2200, celebrate: 1300 },
  uncommon: { pull: 1400, result: 2400, celebrate: 1400 },
  rare: { pull: 1700, result: 2800, celebrate: 1700 },
  epic: { pull: 2200, result: 3400, celebrate: 2000 },
  legendary: { pull: 3000, result: 4800, celebrate: 2600 },
};

export function timelineTotal(t: FishingTimeline) {
  return t.castMs + t.waitMs + t.biteMs + t.pullMs + t.resultMs + t.celebrateMs + t.returnMs;
}
export function revealOffset(t: FishingTimeline) {
  return t.castMs + t.waitMs + t.biteMs + t.pullMs;
}

/**
 * Authoritative fishing loop. The full result (escape or fish/rarity/weight) is rolled
 * by the probability system when the cast starts; the client animates a state machine
 * driven by the returned timeline, and the catch is committed at the reveal moment.
 */
export class FishingService {
  private cycles = new Map<string, ActiveCycle>();
  totalCasts = 0;

  constructor(private ctx: GameContext) {}

  isFishing(playerId: string) {
    return this.cycles.has(playerId);
  }

  requestCast(playerId: string, source: CastSource): CastResult {
    const p = this.ctx.players.get(playerId);
    if (!p) return 'unknown_player';
    if (p.seat === null) return 'not_seated';
    if (this.ctx.isPaused()) return 'paused';
    const cfg = this.ctx.config().game;
    // Only the viewer's own action proves they are still watching (auto / community casts do not).
    if (source === 'command') p.lastActive = this.ctx.now();
    if (this.cycles.has(playerId)) {
      if (cfg.autoContinue && p.pendingCasts < 1) {
        p.pendingCasts = 1;
        return 'queued';
      }
      return 'busy';
    }
    const since = this.ctx.now() - p.lastCycleEndAt;
    if (since < cfg.fishingCooldownSec * 1000) {
      if (cfg.autoContinue && p.pendingCasts < 1) {
        p.pendingCasts = 1;
        this.schedulePending(p, cfg.fishingCooldownSec * 1000 - since);
        return 'queued';
      }
      return 'cooldown';
    }
    this.startCycle(p, source);
    return 'started';
  }

  private schedulePending(p: ActivePlayer, delay: number) {
    setTimeout(() => {
      const cur = this.ctx.players.get(p.record.id);
      if (!cur || cur.pendingCasts <= 0 || this.cycles.has(cur.record.id)) return;
      cur.pendingCasts = 0;
      this.requestCast(cur.record.id, 'auto');
    }, Math.max(50, delay));
  }

  private startCycle(p: ActivePlayer, source: CastSource) {
    const cfg = this.ctx.config();
    const now = this.ctx.now();
    const eff = this.ctx.luck.effective(p);
    const eventMods = this.ctx.events.modifiers();
    const dist = computeRarityDistribution(cfg.rarities, { luck: eff.luck, rarityMultipliers: eff.rarityMultipliers });

    const escaped = this.ctx.rng() * 100 < cfg.game.escapeChance;
    let catchDto: CatchDTO | null = null;
    if (!escaped) {
      const rarity = rollRarity(dist, this.ctx.rng);
      const fish = pickFish(cfg.fish, rarity, this.ctx.rng, { fishBoost: eventMods.fishBoost, unlocked: eventMods.unlocked });
      if (fish) {
        const rarityCfg = cfg.rarities.find((r) => r.id === fish.rarity);
        const weight = rollWeight(fish, rarityCfg, eff.luck, cfg.luck.weightLuckInfluence, this.ctx.rng);
        catchDto = {
          id: uid('c'),
          playerId: p.record.id,
          fishId: fish.id,
          fishName: fish.nameVi || fish.name,
          rarity: fish.rarity,
          weight,
          score: catchScore(fish, rarityCfg, weight),
          luck: Math.round(eff.luck * 100) / 100,
          createdAt: 0,
        };
      }
    }
    this.ctx.luck.consume(p);

    const g = cfg.game;
    const waitBase = g.waitMinSec + this.ctx.rng() * Math.max(0, g.waitMaxSec - g.waitMinSec);
    const waitMs = Math.round((waitBase * 1000) / (1 + Math.max(0, eff.luck - 1) * 0.08));
    const drama = catchDto ? DRAMA[catchDto.rarity] : { pull: 1200, result: 1500, celebrate: 0 };
    const timeline: FishingTimeline = {
      castMs: 1000,
      waitMs,
      biteMs: 1100,
      pullMs: drama.pull,
      resultMs: drama.result,
      celebrateMs: drama.celebrate,
      returnMs: 800,
    };
    const dto: FishingCycleDTO = {
      cycleId: uid('f'),
      playerId: p.record.id,
      elapsedMs: 0,
      timeline,
      success: !!catchDto,
      catch: catchDto,
      luck: Math.round(eff.luck * 100) / 100,
      distribution: dist,
    };
    const cycle: ActiveCycle = { dto, startedAt: now, timers: [] };
    this.cycles.set(p.record.id, cycle);
    p.status = 'fishing';
    p.hasFished = true;
    this.totalCasts++;
    cycle.timers.push(setTimeout(() => this.reveal(p.record.id, dto.cycleId), revealOffset(timeline)));
    cycle.timers.push(setTimeout(() => this.finish(p.record.id, dto.cycleId), timelineTotal(timeline)));
    this.ctx.broadcast({ type: 'fishing_cycle', cycle: dto });
    this.ctx.broadcast({ type: 'player_updated', player: this.ctx.players.toDTO(p) });
    Logger.event(`Cast ${p.record.nickname} [${source}] luck=${dto.luck} → ${catchDto ? `${catchDto.rarity}/${catchDto.fishId} ${catchDto.weight}kg` : 'escaped'}`);
  }

  private reveal(playerId: string, cycleId: string) {
    const cycle = this.cycles.get(playerId);
    const p = this.ctx.players.get(playerId);
    if (!cycle || cycle.dto.cycleId !== cycleId || !p) return;
    const c = cycle.dto.catch;
    if (!c) {
      this.ctx.broadcast({ type: 'fishing_failed', playerId, cycleId });
      this.ctx.notify({ kind: 'fail', title: 'Hụt rồi!', message: `Cá đã thoát khỏi lưỡi câu của ${p.record.nickname}`, playerId, catId: p.record.catId, speech: { name: p.record.nickname, bot: p.bot } });
      return;
    }
    c.createdAt = this.ctx.now();
    const s = p.record.stats;
    s.totalWeight = Math.round((s.totalWeight + c.weight) * 100) / 100;
    s.fishCount += 1;
    s.score += c.score;
    if (c.weight > s.largestWeight) {
      s.largestWeight = c.weight;
      s.largestFishId = c.fishId;
    }
    const key = `${c.rarity}Count` as 'commonCount';
    s[key] += 1;
    this.ctx.repo.insertCatch(c, this.ctx.sessionId());
    this.ctx.players.markDirty(playerId);
    this.ctx.leaderboard.markDirty(true);
    this.ctx.stats.markDirty();
    this.ctx.stats.recordCatch(c.rarity, c.weight);
    const fish = this.ctx.config().fish.find((f) => f.id === c.fishId);
    const rarityCfg = this.ctx.config().rarities.find((r) => r.id === c.rarity);
    const kind = c.rarity === 'legendary' ? 'legendary' : c.rarity === 'epic' ? 'epic' : c.rarity === 'rare' ? 'rare' : 'catch';
    this.ctx.broadcast({ type: 'catch_result', result: c, player: this.ctx.players.toDTO(p) });
    this.ctx.notify({
      kind,
      title: kind === 'legendary' ? '🌟 CÁ HUYỀN THOẠI! 🌟' : kind === 'epic' ? '✨ Cá Sử Thi!' : kind === 'rare' ? '💎 Cá Hiếm!' : 'Câu được cá!',
      message: `${p.record.nickname} câu được ${fish?.nameVi ?? c.fishName} • ${c.weight} kg`,
      playerId,
      catId: p.record.catId,
      fishId: c.fishId,
      rarity: c.rarity,
      color: rarityCfg?.color,
      speech: { name: p.record.nickname, fish: fish?.nameVi ?? c.fishName, kg: c.weight, bot: p.bot },
    });
  }

  private finish(playerId: string, cycleId: string) {
    const cycle = this.cycles.get(playerId);
    if (!cycle || cycle.dto.cycleId !== cycleId) return;
    this.cycles.delete(playerId);
    const p = this.ctx.players.get(playerId);
    if (!p) return;
    p.status = p.seat === null ? 'queued' : 'idle';
    p.lastCycleEndAt = this.ctx.now();
    this.ctx.broadcast({ type: 'player_updated', player: this.ctx.players.toDTO(p) });
    if (p.pendingCasts > 0) {
      this.schedulePending(p, this.ctx.config().game.fishingCooldownSec * 1000);
    }
  }

  /** When the next automatic cast is due for each resting cat ("Tất cả tự động câu"). */
  private nextAuto = new Map<string, number>();

  /**
   * "Tất cả tự động câu": every seated cat that has rested long enough casts again by itself.
   * Uses the 'auto' source, so it never counts as the viewer still watching (absent viewers still leave).
   */
  autoFishTick(now: number) {
    const g = this.ctx.config().game;
    if (!g.autoFishAll || this.ctx.isPaused()) {
      this.nextAuto.clear();
      return;
    }
    const restMs = Math.max(g.fishingCooldownSec, g.autoFishPauseSec) * 1000;
    const seated = this.ctx.players.seated();
    const ids = new Set(seated.map((p) => p.record.id));
    for (const id of [...this.nextAuto.keys()]) if (!ids.has(id)) this.nextAuto.delete(id);
    for (const p of seated) {
      const id = p.record.id;
      if (this.cycles.has(id) || p.pendingCasts > 0) {
        this.nextAuto.delete(id);
        continue;
      }
      let due = this.nextAuto.get(id);
      if (due === undefined) {
        // A little random jitter so the whole pond doesn't cast in the same second.
        due = Math.max(p.lastCycleEndAt + restMs, now) + this.ctx.rng() * 2000;
        this.nextAuto.set(id, due);
      }
      if (now >= due) {
        this.nextAuto.delete(id);
        this.requestCast(id, 'auto');
      }
    }
  }

  cancel(playerId: string) {
    const c = this.cycles.get(playerId);
    if (!c) return;
    c.timers.forEach(clearTimeout);
    this.cycles.delete(playerId);
    const p = this.ctx.players.get(playerId);
    if (p) {
      p.status = p.seat === null ? 'queued' : 'idle';
      p.pendingCasts = 0;
    }
  }

  cancelAll() {
    for (const id of [...this.cycles.keys()]) this.cancel(id);
  }

  activeCount() {
    return this.cycles.size;
  }

  snapshot(): FishingCycleDTO[] {
    const now = this.ctx.now();
    return [...this.cycles.values()].map((c) => ({ ...c.dto, elapsedMs: now - c.startedAt }));
  }
}
