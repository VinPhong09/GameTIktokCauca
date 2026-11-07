// ============================================================================
// Fishing probability system – pure, deterministic given an RNG.
// Shared by the backend (authoritative rolls) and the admin dashboard (preview).
// ============================================================================
import type { FishDef, GameConfig, Rarity, RarityConfig, StackingMode } from './types';
import { RARITY_ORDER } from './types';

export type Rng = () => number;

export interface RarityModifiers {
  /** Final, already-combined luck multiplier. */
  luck: number;
  /** Extra per-rarity weight multipliers (gifts like Hand Heart, events). */
  rarityMultipliers?: Partial<Record<Rarity, number>>;
}

export type Distribution = Record<Rarity, number>;

const EPS = 1e-12;

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/**
 * Luck → rarity distribution.
 *  1. Normalize base probabilities (in case admins entered values not summing to 100).
 *  2. weight_i = base_i * luck^exponent_i * rarityMultiplier_i  (always ≥ 0)
 *  3. Normalize to 1.
 *  4. Apply per-rarity caps (no guaranteed rare fish); excess flows back to the lowest rarity.
 * Result: fractions in [0,1] summing to exactly 1.
 */
export function computeRarityDistribution(rarities: RarityConfig[], mods: RarityModifiers): Distribution {
  const luck = Math.max(EPS, Number.isFinite(mods.luck) ? mods.luck : 1);
  const ordered = RARITY_ORDER.map((id) => rarities.find((r) => r.id === id)).filter(Boolean) as RarityConfig[];
  const baseSum = ordered.reduce((s, r) => s + Math.max(0, r.baseProbability), 0) || 1;

  const weights: Distribution = { common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0 };
  for (const r of ordered) {
    const base = Math.max(0, r.baseProbability) / baseSum;
    const mult = Math.max(0, mods.rarityMultipliers?.[r.id] ?? 1);
    weights[r.id] = base * Math.pow(luck, r.luckExponent) * mult;
  }
  let total = RARITY_ORDER.reduce((s, id) => s + weights[id], 0);
  if (total <= EPS) {
    weights.common = 1;
    total = 1;
  }
  const dist: Distribution = { common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0 };
  for (const id of RARITY_ORDER) dist[id] = weights[id] / total;

  // Caps – iterate from the top rarity down, redistributing into the floor rarity.
  const floor = ordered[0]?.id ?? 'common';
  for (let pass = 0; pass < 3; pass++) {
    for (const r of [...ordered].reverse()) {
      if (r.id === floor) continue;
      const cap = clamp(r.maxProbability, 0, 100) / 100;
      if (dist[r.id] > cap) {
        dist[floor] += dist[r.id] - cap;
        dist[r.id] = cap;
      }
    }
  }
  // Final renormalization guards against floating drift.
  const sum = RARITY_ORDER.reduce((s, id) => s + dist[id], 0);
  for (const id of RARITY_ORDER) dist[id] = Math.max(0, dist[id] / sum);
  return dist;
}

export function rollRarity(dist: Distribution, rng: Rng): Rarity {
  const r = rng();
  let acc = 0;
  for (const id of RARITY_ORDER) {
    acc += dist[id];
    if (r < acc) return id;
  }
  // Floating point edge – return highest rarity with non-zero chance.
  for (const id of [...RARITY_ORDER].reverse()) if (dist[id] > 0) return id;
  return 'common';
}

export interface FishPickModifiers {
  fishBoost?: Record<string, number>;
  unlocked?: Set<string>;
}

export function availableFish(fish: FishDef[], rarity: Rarity, mods: FishPickModifiers = {}): FishDef[] {
  return fish.filter(
    (f) => f.enabled && f.rarity === rarity && f.baseChance > 0 && (!f.eventOnly || mods.unlocked?.has(f.id) || mods.unlocked?.has(f.eventOnly)),
  );
}

export function fishWeightInGroup(f: FishDef, mods: FishPickModifiers): number {
  return Math.max(0, f.baseChance) * Math.max(0, mods.fishBoost?.[f.id] ?? 1);
}

/** Pick a fish inside the rolled rarity. Falls back to lower rarities if a group is empty. */
export function pickFish(fish: FishDef[], rarity: Rarity, rng: Rng, mods: FishPickModifiers = {}): FishDef | null {
  const idx = RARITY_ORDER.indexOf(rarity);
  for (let i = idx; i >= 0; i--) {
    const group = availableFish(fish, RARITY_ORDER[i], mods);
    if (!group.length) continue;
    const total = group.reduce((s, f) => s + fishWeightInGroup(f, mods), 0);
    if (total <= 0) return group[Math.floor(rng() * group.length)];
    let r = rng() * total;
    for (const f of group) {
      r -= fishWeightInGroup(f, mods);
      if (r <= 0) return f;
    }
    return group[group.length - 1];
  }
  return fish.find((f) => f.enabled) ?? null;
}

/** Weight roll skewed toward lighter fish; luck nudges it upward. */
export function rollWeight(f: FishDef, rarity: RarityConfig | undefined, luck: number, influence: number, rng: Rng): number {
  const min = f.weightMin > 0 ? f.weightMin : rarity?.weightMin ?? 0.3;
  const max = Math.max(min, f.weightMax > 0 ? f.weightMax : rarity?.weightMax ?? min);
  const skew = 1.8 / (1 + Math.max(0, luck - 1) * Math.max(0, influence));
  const w = (min + (max - min) * Math.pow(rng(), skew)) * (f.weightMultiplier > 0 ? f.weightMultiplier : 1);
  return Math.round(w * 100) / 100;
}

export function catchScore(f: FishDef, rarity: RarityConfig | undefined, weight: number): number {
  const perKg = f.scorePerKg > 0 ? f.scorePerKg : rarity?.scorePerKg ?? 1;
  return Math.round(weight * perKg);
}

export interface LuckSource {
  luck: number;
}

/** Combine base luck with active boosts according to the configured stacking rule. */
export function combineLuck(base: number, boosts: LuckSource[], mode: StackingMode): number {
  if (!boosts.length) return base;
  switch (mode) {
    case 'additive':
      return base + boosts.reduce((s, b) => s + Math.max(0, b.luck - 1), 0);
    case 'multiplicative':
      return boosts.reduce((s, b) => s * Math.max(0.01, b.luck), base);
    case 'max':
    default:
      return Math.max(base, ...boosts.map((b) => b.luck * base));
  }
}

/** Per-fish probability table (for the admin dashboard). */
export function fishProbabilityTable(config: GameConfig, mods: RarityModifiers, pick: FishPickModifiers = {}) {
  const dist = computeRarityDistribution(config.rarities, mods);
  const rows: { fish: FishDef; probability: number }[] = [];
  for (const rarity of RARITY_ORDER) {
    const group = availableFish(config.fish, rarity, pick);
    const total = group.reduce((s, f) => s + fishWeightInGroup(f, pick), 0);
    for (const f of group) rows.push({ fish: f, probability: total > 0 ? (dist[rarity] * fishWeightInGroup(f, pick)) / total : 0 });
  }
  return { dist, rows };
}

export function baseProbabilityTotal(rarities: RarityConfig[]): number {
  return Math.round(rarities.reduce((s, r) => s + r.baseProbability, 0) * 1000) / 1000;
}
