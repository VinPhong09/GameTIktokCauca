import type { CommunityState } from '@shared/types';
import type { GameContext } from './context';
import { Logger } from './Logger';

/** Likes → community energy bar; shares + global gifts → community luck. */
export class CommunityService {
  likeEnergy = 0;
  totalLikes = 0;
  shareBonus = 0;
  shareBonusEndsAt = 0;
  globalBoosts: { source: string; luck: number; endsAt: number }[] = [];
  private broadcastTimer: NodeJS.Timeout | null = null;

  constructor(private ctx: GameContext) {}

  multiplier(): number {
    const now = this.ctx.now();
    const share = this.shareBonusEndsAt > now ? this.shareBonus : 0;
    const global = this.globalBoosts.filter((g) => g.endsAt > now).reduce((m, g) => Math.max(m, g.luck), 1);
    return (1 + share) * global;
  }

  addLikes(count: number) {
    const L = this.ctx.config().luck.community;
    this.likeEnergy += Math.max(0, count);
    this.totalLikes += Math.max(0, count);
    let triggered = false;
    while (this.likeEnergy >= L.likeThreshold) {
      this.likeEnergy -= L.likeThreshold;
      triggered = true;
    }
    if (triggered) this.triggerCommunityEvent();
    this.scheduleBroadcast();
  }

  triggerCommunityEvent() {
    const L = this.ctx.config().luck.community;
    Logger.event('Community like threshold reached → community fishing challenge');
    const def = this.ctx.config().events.find((e) => e.id === L.eventId);
    if (def) this.ctx.events.start(def.id, 'community', L.durationSec);
    else this.addGlobalBoost('Cộng đồng', L.luckMultiplier, L.durationSec);
    if (L.autoCastAll) {
      for (const p of this.ctx.players.seated()) {
        if (p.status === 'idle') this.ctx.fishing.requestCast(p.record.id, 'community');
      }
    }
  }

  addShare() {
    const S = this.ctx.config().luck.shareBonus;
    const now = this.ctx.now();
    if (this.shareBonusEndsAt <= now) this.shareBonus = 0;
    this.shareBonus = Math.min(S.max, this.shareBonus + S.perShare);
    this.shareBonusEndsAt = now + S.durationSec * 1000;
    this.scheduleBroadcast();
  }

  addGlobalBoost(source: string, luck: number, durationSec: number) {
    const now = this.ctx.now();
    const existing = this.globalBoosts.find((g) => g.source === source && g.endsAt > now);
    if (existing) existing.endsAt = Math.max(existing.endsAt, now) + durationSec * 1000;
    else this.globalBoosts.push({ source, luck, endsAt: now + durationSec * 1000 });
    this.scheduleBroadcast();
  }

  tick(now: number) {
    const before = this.globalBoosts.length;
    this.globalBoosts = this.globalBoosts.filter((g) => g.endsAt > now);
    let changed = before !== this.globalBoosts.length;
    if (this.shareBonus > 0 && this.shareBonusEndsAt <= now) {
      this.shareBonus = 0;
      changed = true;
    }
    if (changed) this.scheduleBroadcast();
  }

  reset() {
    this.likeEnergy = 0;
    this.totalLikes = 0;
    this.shareBonus = 0;
    this.shareBonusEndsAt = 0;
    this.globalBoosts = [];
    this.scheduleBroadcast();
  }

  state(): CommunityState {
    const now = this.ctx.now();
    return {
      likeEnergy: this.likeEnergy,
      likeThreshold: this.ctx.config().luck.community.likeThreshold,
      totalLikes: this.totalLikes,
      shareBonus: this.shareBonusEndsAt > now ? this.shareBonus : 0,
      shareBonusEndsAt: this.shareBonusEndsAt,
      globalBoosts: this.globalBoosts.filter((g) => g.endsAt > now),
      communityLuck: Math.round(this.multiplier() * 100) / 100,
    };
  }

  scheduleBroadcast() {
    if (this.broadcastTimer) return;
    this.broadcastTimer = setTimeout(() => {
      this.broadcastTimer = null;
      this.ctx.broadcast({ type: 'community', community: this.state() });
    }, 250);
  }
}
