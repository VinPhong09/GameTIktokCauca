import type { LiveEvent } from '@shared/types';
import { Logger } from '../services/Logger';

type Handler = (e: LiveEvent) => void;

/**
 * Single entry point for ALL live events – real TikTok providers and the Mock
 * simulator publish here, so gameplay never knows where an event came from.
 * Drops duplicates (same event id seen within the retention window).
 */
export class EventBus {
  private seen = new Map<string, number>();
  private handlers = new Set<Handler>();
  private readonly maxSeen = 10_000;
  private readonly retentionMs = 10 * 60_000;
  onDuplicate: (e: LiveEvent) => void = () => {};

  subscribe(h: Handler) {
    this.handlers.add(h);
    return () => this.handlers.delete(h);
  }

  publish(e: LiveEvent): boolean {
    const now = Date.now();
    const key = `${e.provider}:${e.id}`;
    const prev = this.seen.get(key);
    if (prev !== undefined && now - prev < this.retentionMs) {
      this.onDuplicate(e);
      return false;
    }
    this.seen.set(key, now);
    if (this.seen.size > this.maxSeen) {
      // Map keeps insertion order → delete the oldest entries.
      const drop = this.seen.size - this.maxSeen;
      let i = 0;
      for (const k of this.seen.keys()) {
        if (i++ >= drop) break;
        this.seen.delete(k);
      }
    }
    for (const h of this.handlers) {
      try {
        h(e);
      } catch (err) {
        Logger.error(`Event handler failed for ${e.type}: ${(err as Error).stack ?? err}`);
      }
    }
    return true;
  }
}

/** Stable-ish id for providers that do not supply a message id. */
export function deriveEventId(parts: (string | number | undefined | null)[]): string {
  const s = parts.map((p) => String(p ?? '')).join('|');
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 16777619);
    h2 = Math.imul(h2 ^ c, 2246822507);
  }
  return (h1 >>> 0).toString(36) + (h2 >>> 0).toString(36);
}
