import type { CatchDTO, PlayerStats } from '@shared/types';
import type { Db, Row } from './db';

export interface PlayerRecord {
  id: string;
  uniqueId: string;
  nickname: string;
  avatarUrl?: string;
  catId: string;
  stats: PlayerStats;
  createdAt: number;
  lastSeen: number;
  /** Admin-fixed personal luck, applied every time this viewer joins (null = random roll). */
  luckOverride: number | null;
}

export function emptyStats(): PlayerStats {
  return {
    totalWeight: 0, fishCount: 0, largestWeight: 0, largestFishId: null,
    commonCount: 0, uncommonCount: 0, rareCount: 0, epicCount: 0, legendaryCount: 0,
    totalGifts: 0, totalDiamonds: 0, score: 0,
  };
}

function rowToPlayer(r: Row): PlayerRecord {
  return {
    id: String(r.id),
    uniqueId: String(r.unique_id),
    nickname: String(r.nickname),
    avatarUrl: r.avatar_url ? String(r.avatar_url) : undefined,
    catId: String(r.cat_id),
    createdAt: Number(r.created_at),
    lastSeen: Number(r.last_seen),
    luckOverride: r.luck_override === null || r.luck_override === undefined ? null : Number(r.luck_override),
    stats: {
      totalWeight: Number(r.total_weight),
      fishCount: Number(r.fish_count),
      largestWeight: Number(r.largest_weight),
      largestFishId: r.largest_fish_id ? String(r.largest_fish_id) : null,
      commonCount: Number(r.common_count),
      uncommonCount: Number(r.uncommon_count),
      rareCount: Number(r.rare_count),
      epicCount: Number(r.epic_count),
      legendaryCount: Number(r.legendary_count),
      totalGifts: Number(r.total_gifts),
      totalDiamonds: Number(r.total_diamonds),
      score: Number(r.score),
    },
  };
}

/** Thin data-access layer. All game state lives in memory; this persists it. */
export class Repository {
  constructor(private db: Db) {}

  loadPlayers(): PlayerRecord[] {
    return this.db.all('SELECT * FROM players').map(rowToPlayer);
  }

  savePlayer(p: PlayerRecord) {
    const s = p.stats;
    this.db.run(
      `INSERT INTO players (id, unique_id, nickname, avatar_url, cat_id, total_weight, fish_count, largest_weight, largest_fish_id,
        common_count, uncommon_count, rare_count, epic_count, legendary_count, total_gifts, total_diamonds, score, created_at, last_seen, luck_override)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
       ON CONFLICT(id) DO UPDATE SET unique_id=excluded.unique_id, nickname=excluded.nickname, avatar_url=excluded.avatar_url,
        cat_id=excluded.cat_id, total_weight=excluded.total_weight, fish_count=excluded.fish_count, largest_weight=excluded.largest_weight,
        largest_fish_id=excluded.largest_fish_id, common_count=excluded.common_count, uncommon_count=excluded.uncommon_count,
        rare_count=excluded.rare_count, epic_count=excluded.epic_count, legendary_count=excluded.legendary_count,
        total_gifts=excluded.total_gifts, total_diamonds=excluded.total_diamonds, score=excluded.score, last_seen=excluded.last_seen,
        luck_override=excluded.luck_override`,
      [p.id, p.uniqueId, p.nickname, p.avatarUrl ?? null, p.catId, s.totalWeight, s.fishCount, s.largestWeight, s.largestFishId,
        s.commonCount, s.uncommonCount, s.rareCount, s.epicCount, s.legendaryCount, s.totalGifts, s.totalDiamonds, s.score, p.createdAt, p.lastSeen, p.luckOverride ?? null],
    );
  }

  insertCatch(c: CatchDTO, sessionId: string) {
    this.db.run('INSERT INTO catches (id, player_id, fish_id, rarity, weight, score, luck, session_id, created_at) VALUES (?,?,?,?,?,?,?,?,?)',
      [c.id, c.playerId, c.fishId, c.rarity, c.weight, c.score, c.luck, sessionId, c.createdAt]);
  }

  recentCatches(playerId: string, limit = 20) {
    return this.db.all('SELECT * FROM catches WHERE player_id = ? ORDER BY created_at DESC LIMIT ?', [playerId, limit]);
  }

  insertGift(id: string, playerId: string | null, giftName: string, diamonds: number, count: number) {
    this.db.run('INSERT INTO gifts (id, player_id, gift_name, diamonds, count, created_at) VALUES (?,?,?,?,?,?)',
      [id, playerId, giftName, diamonds, count, Date.now()]);
  }

  giftTotals(): { gifts: number; diamonds: number } {
    const r = this.db.get('SELECT COALESCE(SUM(count),0) AS g, COALESCE(SUM(diamonds*count),0) AS d FROM gifts');
    return { gifts: Number(r?.g ?? 0), diamonds: Number(r?.d ?? 0) };
  }

  catchTotals(): { count: number; weight: number; byRarity: Record<string, number> } {
    const t = this.db.get('SELECT COUNT(*) AS c, COALESCE(SUM(weight),0) AS w FROM catches');
    const rows = this.db.all('SELECT rarity, COUNT(*) AS c FROM catches GROUP BY rarity');
    const byRarity: Record<string, number> = {};
    for (const r of rows) byRarity[String(r.rarity)] = Number(r.c);
    return { count: Number(t?.c ?? 0), weight: Number(t?.w ?? 0), byRarity };
  }

  getConfig(key: string): unknown | undefined {
    const r = this.db.get('SELECT value FROM config WHERE key = ?', [key]);
    if (!r) return undefined;
    try { return JSON.parse(String(r.value)); } catch { return undefined; }
  }

  setConfig(key: string, value: unknown) {
    this.db.run('INSERT INTO config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [key, JSON.stringify(value)]);
  }

  deleteConfig(key: string) {
    this.db.run('DELETE FROM config WHERE key = ?', [key]);
  }

  getCounter(key: string): number {
    return Number(this.db.get('SELECT value FROM counters WHERE key = ?', [key])?.value ?? 0);
  }

  addCounter(key: string, delta: number) {
    this.db.run('INSERT INTO counters (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = value + excluded.value', [key, delta]);
  }

  startSession(id: string) {
    this.db.run('INSERT INTO sessions (id, started_at) VALUES (?, ?)', [id, Date.now()]);
  }

  endSession(id: string) {
    this.db.run('UPDATE sessions SET ended_at = ? WHERE id = ?', [Date.now(), id]);
  }

  resetLeaderboard() {
    this.db.transaction(() => {
      this.db.run(`UPDATE players SET total_weight=0, fish_count=0, largest_weight=0, largest_fish_id=NULL, common_count=0, uncommon_count=0,
        rare_count=0, epic_count=0, legendary_count=0, score=0`);
      this.db.run('DELETE FROM catches');
    });
  }

  resetPlayer(id: string) {
    this.db.run(`UPDATE players SET total_weight=0, fish_count=0, largest_weight=0, largest_fish_id=NULL, common_count=0, uncommon_count=0,
      rare_count=0, epic_count=0, legendary_count=0, score=0 WHERE id = ?`, [id]);
    this.db.run('DELETE FROM catches WHERE player_id = ?', [id]);
  }

  deletePlayer(id: string) {
    this.db.run('DELETE FROM players WHERE id = ?', [id]);
    this.db.run('DELETE FROM catches WHERE player_id = ?', [id]);
  }
}
