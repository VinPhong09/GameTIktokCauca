import type { Leaderboard, LeaderboardCategory, LeaderboardEntry } from '@shared/types';
import { LEADERBOARD_CATEGORIES } from '@shared/types';
import type { PlayerRecord } from '../database/repository';
import type { GameContext } from './context';

const VALUE: Record<LeaderboardCategory, (r: PlayerRecord) => number> = {
  weight: (r) => r.stats.totalWeight,
  largest: (r) => r.stats.largestWeight,
  count: (r) => r.stats.fishCount,
  rare: (r) => r.stats.rareCount,
  epic: (r) => r.stats.epicCount,
  legendary: (r) => r.stats.legendaryCount,
};

/** Real-time rankings (primary = total fish weight). Broadcasts are throttled. */
export class LeaderboardService {
  private cache: Leaderboard | null = null;
  private ranks = new Map<string, number>();
  private timer: NodeJS.Timeout | null = null;
  size = 10;

  constructor(private ctx: GameContext) {}

  private compute(): Leaderboard {
    const records = [...this.ctx.players.records.values()];
    const lb = {} as Leaderboard;
    for (const cat of LEADERBOARD_CATEGORIES) {
      const fn = VALUE[cat];
      const sorted = records
        .filter((r) => fn(r) > 0)
        .sort((a, b) => fn(b) - fn(a) || b.stats.totalWeight - a.stats.totalWeight || a.createdAt - b.createdAt);
      if (cat === 'weight') {
        this.ranks.clear();
        sorted.forEach((r, i) => this.ranks.set(r.id, i + 1));
      }
      lb[cat] = sorted.slice(0, this.size).map<LeaderboardEntry>((r, i) => ({
        playerId: r.id,
        nickname: r.nickname,
        avatarUrl: r.avatarUrl,
        catId: r.catId,
        value: fn(r),
        totalWeight: r.stats.totalWeight,
        fishCount: r.stats.fishCount,
        rank: i + 1,
      }));
    }
    return lb;
  }

  get(): Leaderboard {
    if (!this.cache) this.cache = this.compute();
    return this.cache;
  }

  rankOf(id: string): number {
    this.get();
    return this.ranks.get(id) ?? 0;
  }

  markDirty(broadcast = true) {
    this.cache = null;
    if (!broadcast || this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.ctx.broadcast({ type: 'leaderboard', leaderboard: this.get() });
    }, 300);
  }
}
