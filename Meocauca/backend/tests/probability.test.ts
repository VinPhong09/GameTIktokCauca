import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, cloneConfig } from '@shared/defaults';
import { combineLuck, computeRarityDistribution, pickFish, rollRarity, rollWeight } from '@shared/probability';
import { RARITY_ORDER } from '@shared/types';

const R = DEFAULT_CONFIG.rarities;
const sum = (d: Record<string, number>) => Object.values(d).reduce((a, b) => a + b, 0);

function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('rarity distribution', () => {
  it('matches the default base probabilities at luck 1', () => {
    const d = computeRarityDistribution(R, { luck: 1 });
    expect(d.common).toBeCloseTo(0.7, 6);
    expect(d.uncommon).toBeCloseTo(0.2, 6);
    expect(d.rare).toBeCloseTo(0.08, 6);
    expect(d.epic).toBeCloseTo(0.018, 6);
    expect(d.legendary).toBeCloseTo(0.002, 6);
  });

  it('always sums to 100% with no negative values for any luck', () => {
    for (const luck of [0.01, 0.5, 1, 1.15, 1.5, 2, 2.5, 3, 5, 10, 100, 1e6]) {
      const d = computeRarityDistribution(R, { luck, rarityMultipliers: { epic: 2, legendary: 3 } });
      expect(sum(d)).toBeCloseTo(1, 9);
      for (const id of RARITY_ORDER) expect(d[id]).toBeGreaterThanOrEqual(0);
    }
  });

  it('raises rare tiers and lowers common as luck grows', () => {
    let prev = computeRarityDistribution(R, { luck: 1 });
    for (const luck of [1.15, 1.5, 2, 2.5, 3]) {
      const d = computeRarityDistribution(R, { luck });
      expect(d.common).toBeLessThan(prev.common);
      expect(d.rare).toBeGreaterThan(prev.rare);
      expect(d.legendary).toBeGreaterThan(prev.legendary);
      prev = d;
    }
  });

  it('respects rarity caps so nothing is guaranteed', () => {
    const d = computeRarityDistribution(R, { luck: 1e6, rarityMultipliers: { legendary: 1000 } });
    expect(d.legendary).toBeLessThanOrEqual(0.03 + 1e-9);
    expect(d.epic).toBeLessThanOrEqual(0.12 + 1e-9);
    expect(d.common).toBeGreaterThan(0);
  });

  it('normalizes base probabilities that do not add to 100', () => {
    const r = cloneConfig(R).map((x) => ({ ...x, baseProbability: x.baseProbability * 2 }));
    const d = computeRarityDistribution(r, { luck: 1 });
    expect(d.common).toBeCloseTo(0.7, 6);
  });

  it('keeps a legendary chance for non-gifting players', () => {
    const d = computeRarityDistribution(R, { luck: 1 });
    expect(d.legendary).toBeGreaterThan(0);
  });

  it('Monte Carlo rolls follow the distribution', () => {
    const rng = seeded(42);
    const d = computeRarityDistribution(R, { luck: 1 });
    const counts: Record<string, number> = { common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0 };
    const N = 200_000;
    for (let i = 0; i < N; i++) counts[rollRarity(d, rng)]++;
    expect(counts.common / N).toBeCloseTo(0.7, 2);
    expect(counts.uncommon / N).toBeCloseTo(0.2, 2);
    expect(counts.rare / N).toBeCloseTo(0.08, 2);
    expect(counts.legendary).toBeGreaterThan(0);
  });
});

describe('luck stacking', () => {
  const boosts = [{ luck: 1.5 }, { luck: 2 }];
  it('max', () => expect(combineLuck(1, boosts, 'max')).toBe(2));
  it('additive', () => expect(combineLuck(1, boosts, 'additive')).toBe(2.5));
  it('multiplicative', () => expect(combineLuck(1, boosts, 'multiplicative')).toBe(3));
  it('no boosts = base', () => expect(combineLuck(1.2, [], 'max')).toBe(1.2));
});

describe('fish & weight', () => {
  it('picks a fish of the requested rarity', () => {
    const rng = seeded(7);
    for (const r of RARITY_ORDER) {
      const f = pickFish(DEFAULT_CONFIG.fish, r, rng);
      expect(f?.rarity).toBe(r);
    }
  });

  it('respects event fish boost', () => {
    const rng = seeded(9);
    let golden = 0;
    for (let i = 0; i < 5000; i++) if (pickFish(DEFAULT_CONFIG.fish, 'rare', rng, { fishBoost: { 'golden-koi': 50 } })?.id === 'golden-koi') golden++;
    expect(golden / 5000).toBeGreaterThan(0.8);
  });

  it('falls back to lower rarity if a group is empty', () => {
    const fish = DEFAULT_CONFIG.fish.map((f) => ({ ...f, enabled: f.rarity !== 'legendary' }));
    expect(pickFish(fish, 'legendary', seeded(1))?.rarity).toBe('epic');
  });

  it('weights stay inside the configured range', () => {
    const rng = seeded(3);
    for (const f of DEFAULT_CONFIG.fish) {
      const rc = R.find((r) => r.id === f.rarity);
      for (let i = 0; i < 200; i++) {
        const w = rollWeight(f, rc, 1 + (i % 4), 0.15, rng);
        expect(w).toBeGreaterThanOrEqual(f.weightMin - 0.01);
        expect(w).toBeLessThanOrEqual(f.weightMax + 0.01);
      }
    }
  });
});
