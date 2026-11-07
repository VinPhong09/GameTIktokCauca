import type { ActiveEventDTO, Rarity } from '@shared/types';
import type { GameContext } from './context';
import { Logger } from './Logger';

export interface EventModifiers {
  luckMultiplier: number;
  rarityMultipliers: Partial<Record<Rarity, number>>;
  fishBoost: Record<string, number>;
  unlocked: Set<string>;
}

/** Scheduled + manual + community fishing events (Golden Fish Hour, Double Luck…). */
export class FishingEventService {
  private active = new Map<string, ActiveEventDTO>();
  private nextRun = new Map<string, number>();

  constructor(private ctx: GameContext) {}

  list(): ActiveEventDTO[] {
    return [...this.active.values()];
  }

  start(eventId: string, source: ActiveEventDTO['source'], durationSec?: number): ActiveEventDTO | null {
    const def = this.ctx.config().events.find((e) => e.id === eventId);
    if (!def) return null;
    const now = this.ctx.now();
    const dur = (durationSec ?? def.durationSec) * 1000;
    const existing = this.active.get(eventId);
    if (existing) {
      existing.endsAt = Math.max(existing.endsAt, now + dur);
    } else {
      this.active.set(eventId, { eventId, name: def.name, nameVi: def.nameVi, color: def.color, startedAt: now, endsAt: now + dur, source });
      this.ctx.notify({ kind: 'event', title: `🎉 ${def.nameVi}`, message: def.description, color: def.color, speech: { event: def.nameVi } });
      Logger.event(`Fishing event started: ${def.name} (${source}, ${Math.round(dur / 1000)}s)`);
    }
    this.broadcast();
    return this.active.get(eventId)!;
  }

  stop(eventId: string) {
    if (!this.active.delete(eventId)) return false;
    Logger.event(`Fishing event ended: ${eventId}`);
    this.broadcast();
    return true;
  }

  stopAll() {
    this.active.clear();
    this.broadcast();
  }

  modifiers(): EventModifiers {
    const mods: EventModifiers = { luckMultiplier: 1, rarityMultipliers: {}, fishBoost: {}, unlocked: new Set() };
    const now = this.ctx.now();
    for (const a of this.active.values()) {
      if (a.endsAt <= now) continue;
      const def = this.ctx.config().events.find((e) => e.id === a.eventId);
      if (!def) continue;
      mods.luckMultiplier *= def.luckMultiplier || 1;
      for (const [r, m] of Object.entries(def.rarityMultipliers ?? {})) {
        mods.rarityMultipliers[r as Rarity] = (mods.rarityMultipliers[r as Rarity] ?? 1) * (m ?? 1);
      }
      for (const id of def.fishBoost?.fishIds ?? []) mods.fishBoost[id] = (mods.fishBoost[id] ?? 1) * (def.fishBoost.multiplier || 1);
      for (const id of def.unlockFishIds ?? []) mods.unlocked.add(id);
      mods.unlocked.add(def.id);
    }
    return mods;
  }

  tick(now: number) {
    let changed = false;
    for (const [id, a] of this.active) {
      if (a.endsAt <= now) {
        this.active.delete(id);
        Logger.event(`Fishing event ended: ${a.name}`);
        changed = true;
      }
    }
    for (const def of this.ctx.config().events) {
      if (!def.enabled || def.intervalMin <= 0) {
        this.nextRun.delete(def.id);
        continue;
      }
      const next = this.nextRun.get(def.id);
      if (next === undefined) {
        this.nextRun.set(def.id, now + def.intervalMin * 60_000);
      } else if (now >= next) {
        this.nextRun.set(def.id, now + def.intervalMin * 60_000);
        if (!this.ctx.isPaused()) this.start(def.id, 'schedule');
      }
    }
    if (changed) this.broadcast();
  }

  nextScheduled(): Record<string, number> {
    return Object.fromEntries(this.nextRun);
  }

  private broadcast() {
    this.ctx.broadcast({ type: 'events_state', events: this.list() });
    this.ctx.community.scheduleBroadcast();
  }
}
