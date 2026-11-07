import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AutoAudienceSettings, ServerMessage } from '@shared/types';
import { Db } from '../src/database/db';
import { Repository } from '../src/database/repository';
import { ConfigStore } from '../src/services/ConfigStore';
import { Game } from '../src/services/Game';
import { ConnectorManager } from '../src/connectors/ConnectorManager';
import { MockConnector } from '../src/connectors/MockConnector';
import { AudienceDirector } from '../src/services/AudienceDirector';
import { Logger } from '../src/services/Logger';

Logger.quiet = true;

const QUIET: Partial<AutoAudienceSettings> = { castsPerMinute: 0, likesPerMinute: 0, giftsPerMinute: 0, sharesPerMinute: 0, stayMaxMin: 0, stayMinMin: 0, keepFreeSeats: 0 };

async function setup() {
  const db = await Db.open(null);
  const store = new ConfigStore(new Repository(db));
  const game = new Game(store, new Repository(db));
  const messages: ServerMessage[] = [];
  game.setBroadcaster((m) => messages.push(m));
  const connectors = new ConnectorManager(game.bus, () => {});
  const audience = new AudienceDirector(game, store, connectors);
  audience.start();
  const configure = (a: Partial<AutoAudienceSettings>, gameExtra: Record<string, unknown> = {}) =>
    store.updateSection('game', { ...gameExtra, autoAudience: { enabled: true, ...QUIET, ...a } });
  const bots = () => game.players.seated().filter((p) => p.bot);
  const real = (i: number) => connectors.injectMock(MockConnector.build({ type: 'COMMENT', comment: 'join', user: { userId: 'v' + i, uniqueId: 'v' + i, nickname: 'Viewer ' + i } }));
  return { game, store, messages, audience, configure, bots, real };
}

describe('auto audience (khán giả tự động)', () => {
  let ctx: Awaited<ReturnType<typeof setup>>;
  beforeEach(async () => {
    vi.useFakeTimers();
    ctx = await setup();
  });
  afterEach(() => {
    ctx.audience.dispose();
    ctx.game.shutdown();
    vi.useRealTimers();
  });

  it('does nothing while turned off', () => {
    vi.advanceTimersByTime(30_000);
    expect(ctx.game.players.active.size).toBe(0);
  });

  it('adds bots at the configured rate up to the limit', () => {
    ctx.configure({ maxBots: 5, joinsPerMinute: 60 });
    vi.advanceTimersByTime(3_000);
    expect(ctx.bots()).toHaveLength(3); // 1 per second
    vi.advanceTimersByTime(10_000);
    expect(ctx.bots()).toHaveLength(5); // capped
    expect(ctx.bots().every((p) => p.bot)).toBe(true);
  });

  it('a slow rate adds the right number per minute', () => {
    ctx.configure({ maxBots: 30, joinsPerMinute: 6 });
    vi.advanceTimersByTime(60_000);
    expect(ctx.bots().length).toBeGreaterThanOrEqual(5);
    expect(ctx.bots().length).toBeLessThanOrEqual(6);
  });

  it('always keeps seats free for real viewers', () => {
    ctx.configure({ maxBots: 10, joinsPerMinute: 120, keepFreeSeats: 2 }, { maxPlayers: 6 });
    vi.advanceTimersByTime(10_000);
    expect(ctx.bots()).toHaveLength(4);
    expect(ctx.audience.status()).toMatchObject({ freeSeats: 2, roomForBots: 0 });
  });

  it('stops adding bots while a real viewer is waiting', () => {
    ctx.configure({ maxBots: 10, joinsPerMinute: 60 }, { maxPlayers: 2, botsYieldToViewers: false });
    vi.advanceTimersByTime(3_000);
    ctx.real(1);
    expect(ctx.game.players.get('v1')!.seat).toBeNull();
    vi.advanceTimersByTime(5_000);
    expect(ctx.audience.status()).toMatchObject({ roomForBots: 0, realQueued: 1, botsQueued: 0 });
  });

  it('bots leave after their stay time and new ones take over', () => {
    ctx.configure({ maxBots: 3, joinsPerMinute: 60, stayMinMin: 1, stayMaxMin: 1 });
    vi.advanceTimersByTime(4_000);
    const first = ctx.bots().map((p) => p.record.id);
    expect(first).toHaveLength(3);
    vi.advanceTimersByTime(65_000);
    const now = ctx.bots().map((p) => p.record.id);
    expect(now.length).toBeLessThanOrEqual(3);
    expect(now.some((id) => !first.includes(id))).toBe(true);
    expect(ctx.messages.some((m) => m.type === 'player_left' && m.reason === 'left_live' && first.includes(m.playerId))).toBe(true);
  });

  it('lowering the limit sends extra bots away', () => {
    ctx.configure({ maxBots: 5, joinsPerMinute: 120 });
    vi.advanceTimersByTime(5_000);
    expect(ctx.bots()).toHaveLength(5);
    ctx.configure({ maxBots: 2, joinsPerMinute: 120 });
    vi.advanceTimersByTime(4_000);
    expect(ctx.bots()).toHaveLength(2);
  });

  it('bots fish, like, gift and share', () => {
    ctx.store.updateSection('game', { escapeChance: 0 });
    ctx.configure({ maxBots: 4, joinsPerMinute: 120, castsPerMinute: 30, likesPerMinute: 60, giftsPerMinute: 30, sharesPerMinute: 30 });
    vi.advanceTimersByTime(20_000);
    expect(ctx.messages.filter((m) => m.type === 'fishing_cycle').length).toBeGreaterThan(4);
    expect(ctx.game.community.state().likeEnergy).toBeGreaterThan(0);
    expect(ctx.messages.some((m) => m.type === 'gift_effect')).toBe(true);
    expect(ctx.game.community.state().shareBonus).toBeGreaterThan(0);
  });

  it('“Xoá hết mèo bot” removes only bots', () => {
    ctx.configure({ maxBots: 5, joinsPerMinute: 120 });
    vi.advanceTimersByTime(3_000);
    ctx.real(1);
    expect(ctx.audience.clearBots()).toBeGreaterThan(0);
    expect(ctx.bots()).toHaveLength(0);
    expect(ctx.game.players.get('v1')).toBeTruthy();
  });

  it('pauses with the game', () => {
    ctx.configure({ maxBots: 5, joinsPerMinute: 120 });
    ctx.game.pause();
    vi.advanceTimersByTime(5_000);
    expect(ctx.bots()).toHaveLength(0);
  });

  it('settings are clamped and off by default', () => {
    expect(ctx.store.get().game.autoAudience.enabled).toBe(false);
    ctx.store.updateSection('game', { autoAudience: { maxBots: 999, joinsPerMinute: -5, stayMinMin: 10, stayMaxMin: 3 } });
    expect(ctx.store.get().game.autoAudience).toMatchObject({ maxBots: 60, joinsPerMinute: 0, stayMinMin: 10, stayMaxMin: 10 });
  });
});
