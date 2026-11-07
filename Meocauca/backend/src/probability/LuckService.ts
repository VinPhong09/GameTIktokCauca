import { clamp, combineLuck } from '@shared/probability';
import type { GiftRule, PersonalLuckSource, Rarity } from '@shared/types';
import { RARITY_ORDER } from '@shared/types';
import type { ActivePlayer, Boost } from '../players/PlayerManager';
import type { GameContext } from '../services/context';
import { uid } from '../settings';

export interface EffectiveLuck {
  luck: number;
  playerLuck: number;
  personalLuck: number;
  communityLuck: number;
  eventLuck: number;
  rarityMultipliers: Partial<Record<Rarity, number>>;
  attempts: number;
  sources: string[];
}

/**
 * Player luck = combine(baseLuck, gift boosts by stacking rule)
 *             × personal luck (random roll on joining the pond, or set by the admin)
 *             × community multiplier (shares / global gifts / like challenge)
 *             × active event multipliers,
 * clamped to [minLuck, maxLuck].
 */
export class LuckService {
  constructor(private ctx: GameContext) {}

  /** Random personal multiplier for a cat entering the pond (1 when the feature is off). */
  rollJoinLuck(): number {
    const J = this.ctx.config().luck.joinLuck;
    if (!J.enabled) return 1;
    const v = J.min + this.ctx.rng() * Math.max(0, J.max - J.min);
    return Math.round(v * 100) / 100;
  }

  personal(p: ActivePlayer): { value: number; source: PersonalLuckSource } {
    if (p.adminLuck !== null) return { value: p.adminLuck, source: 'admin' };
    if (p.record.luckOverride !== null && p.record.luckOverride !== undefined) return { value: p.record.luckOverride, source: 'fixed' };
    return { value: p.joinLuck, source: 'random' };
  }

  private activeBoosts(p: ActivePlayer): Boost[] {
    const now = this.ctx.now();
    p.boosts = p.boosts.filter((b) => b.attemptsLeft > 0 && (b.expiresAt === null || b.expiresAt > now));
    return p.boosts;
  }

  addGiftBoost(p: ActivePlayer, rule: Pick<GiftRule, 'giftName' | 'luck' | 'attempts' | 'durationSec' | 'rarityBoost'>, repeatCount: number): Boost {
    const L = this.ctx.config().luck;
    const now = this.ctx.now();
    const count = Math.max(1, repeatCount);
    const attempts = Math.min(L.maxAttempts, rule.attempts * (L.repeatExtendsAttempts ? count : 1));
    const boosts = this.activeBoosts(p);
    // Same gift again → refresh/extend the existing boost instead of adding a new entry.
    const same = boosts.find((b) => b.source === rule.giftName);
    if (same) {
      same.attemptsLeft = Math.min(L.maxAttempts, same.attemptsLeft + attempts);
      same.expiresAt = rule.durationSec > 0 ? now + rule.durationSec * 1000 : null;
      return same;
    }
    const boost: Boost = {
      id: uid('b'),
      source: rule.giftName,
      luck: rule.luck,
      rarityBoost: { ...(rule.rarityBoost ?? {}) },
      attemptsLeft: attempts,
      expiresAt: rule.durationSec > 0 ? now + rule.durationSec * 1000 : null,
    };
    boosts.push(boost);
    // Keep only the strongest N boosts.
    boosts.sort((a, b) => b.luck - a.luck);
    p.boosts = boosts.slice(0, L.maxActiveBoosts);
    return boost;
  }

  effective(p: ActivePlayer | null): EffectiveLuck {
    const L = this.ctx.config().luck;
    const boosts = p ? this.activeBoosts(p) : [];
    const personalLuck = p ? this.personal(p).value : 1;
    const playerLuck = combineLuck(L.baseLuck, boosts, L.stacking) * personalLuck;
    const communityLuck = this.ctx.community.multiplier();
    const mods = this.ctx.events.modifiers();
    const rarityMultipliers: Partial<Record<Rarity, number>> = {};
    for (const r of RARITY_ORDER) {
      let m = mods.rarityMultipliers[r] ?? 1;
      for (const b of boosts) m *= b.rarityBoost[r] ?? 1;
      if (m !== 1) rarityMultipliers[r] = m;
    }
    const luck = clamp(playerLuck * communityLuck * mods.luckMultiplier, L.minLuck, L.maxLuck);
    return {
      luck,
      playerLuck,
      personalLuck,
      communityLuck,
      eventLuck: mods.luckMultiplier,
      rarityMultipliers,
      attempts: boosts.reduce((m, b) => Math.max(m, b.attemptsLeft), 0),
      sources: boosts.map((b) => b.source),
    };
  }

  /** One fishing attempt consumes one charge of every active boost. */
  consume(p: ActivePlayer) {
    for (const b of this.activeBoosts(p)) b.attemptsLeft -= 1;
    this.activeBoosts(p);
  }
}
