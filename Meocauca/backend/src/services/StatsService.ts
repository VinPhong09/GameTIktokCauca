import type { Rarity, StatsDTO } from '@shared/types';
import type { GameContext } from './context';

export class StatsService {
  eventsProcessed = 0;
  duplicatesDropped = 0;
  private dirty = true;
  private timer: NodeJS.Timeout;

  constructor(private ctx: GameContext) {
    this.timer = setInterval(() => {
      if (!this.dirty) return;
      this.dirty = false;
      this.ctx.broadcast({ type: 'stats', stats: this.compute() });
    }, 2000);
  }

  markDirty() {
    this.dirty = true;
  }

  recordCatch(_rarity: Rarity, _weight: number) {
    this.dirty = true;
  }

  addCounter(key: 'likes' | 'shares' | 'follows', n = 1) {
    this.ctx.repo.addCounter(key, n);
    this.dirty = true;
  }

  compute(): StatsDTO {
    const byRarity: Record<Rarity, number> = { common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0 };
    let totalCatches = 0;
    let totalWeight = 0;
    let totalGifts = 0;
    let totalDiamonds = 0;
    for (const r of this.ctx.players.records.values()) {
      const s = r.stats;
      totalCatches += s.fishCount;
      totalWeight += s.totalWeight;
      totalGifts += s.totalGifts;
      totalDiamonds += s.totalDiamonds;
      byRarity.common += s.commonCount;
      byRarity.uncommon += s.uncommonCount;
      byRarity.rare += s.rareCount;
      byRarity.epic += s.epicCount;
      byRarity.legendary += s.legendaryCount;
    }
    return {
      totalPlayers: this.ctx.players.records.size,
      activePlayers: this.ctx.players.seated().length,
      totalCatches,
      totalWeight: Math.round(totalWeight * 100) / 100,
      totalGifts,
      totalDiamonds,
      totalLikes: this.ctx.repo.getCounter('likes'),
      totalShares: this.ctx.repo.getCounter('shares'),
      totalFollows: this.ctx.repo.getCounter('follows'),
      byRarity,
      eventsProcessed: this.eventsProcessed,
      duplicatesDropped: this.duplicatesDropped,
    };
  }

  stop() {
    clearInterval(this.timer);
  }
}
