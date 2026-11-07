import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ServerMessage } from '@shared/types';
import { Db } from '../src/database/db';
import { Repository } from '../src/database/repository';
import { ConfigStore, migrateStored } from '../src/services/ConfigStore';
import { Game } from '../src/services/Game';
import { ConnectorManager } from '../src/connectors/ConnectorManager';
import { MockConnector } from '../src/connectors/MockConnector';
import { normalizeProviderEvent } from '../src/connectors/normalize';
import { friendlyTikTokError } from '../src/connectors/TikTokLiveConnector';
import { Logger } from '../src/services/Logger';

Logger.quiet = true;

async function setup() {
  const db = await Db.open(null);
  const repo = new Repository(db);
  const store = new ConfigStore(repo);
  const game = new Game(store, repo);
  const messages: ServerMessage[] = [];
  game.setBroadcaster((m) => messages.push(m));
  const connectors = new ConnectorManager(game.bus, () => {});
  const send = (input: Parameters<typeof MockConnector.build>[0]) => connectors.injectMock(MockConnector.build(input));
  return { db, game, store, messages, send };
}

const alice = { userId: 'u1', uniqueId: 'alice', nickname: 'Alice' };
const bob = { userId: 'u2', uniqueId: 'bob', nickname: 'Bob' };

describe('event pipeline', () => {
  let ctx: Awaited<ReturnType<typeof setup>>;
  beforeEach(async () => {
    vi.useFakeTimers();
    ctx = await setup();
  });
  afterEach(() => {
    ctx.game.shutdown();
    vi.useRealTimers();
  });

  it('comment "câu" registers a cat and runs a full fishing cycle', () => {
    ctx.store.updateSection('game', { escapeChance: 0 });
    ctx.send({ type: 'COMMENT', user: alice, comment: 'Câu cá' });
    const p = ctx.game.players.get('u1');
    expect(p).toBeTruthy();
    expect(p!.seat).not.toBeNull();
    expect(p!.status).toBe('fishing');
    const cycle = ctx.messages.find((m) => m.type === 'fishing_cycle');
    expect(cycle).toBeTruthy();
    vi.advanceTimersByTime(30_000);
    expect(ctx.messages.some((m) => m.type === 'catch_result')).toBe(true);
    expect(ctx.game.players.get('u1')!.status).toBe('idle');
    expect(ctx.game.players.records.get('u1')!.stats.fishCount).toBe(1);
    expect(ctx.game.leaderboard.get().weight[0].playerId).toBe('u1');
  });

  it('drops duplicate events', () => {
    ctx.send({ type: 'FOLLOW', user: alice, id: 'dup-1' });
    ctx.send({ type: 'FOLLOW', user: alice, id: 'dup-1' });
    expect(ctx.game.stats.duplicatesDropped).toBe(1);
  });

  it('gift raises luck for a limited number of attempts', () => {
    ctx.store.updateSection('luck', { joinLuck: { enabled: false } });
    ctx.send({ type: 'COMMENT', user: alice, comment: 'join' });
    ctx.send({ type: 'GIFT', user: alice, giftName: 'Doughnut', diamonds: 30 });
    const p = ctx.game.players.get('u1')!;
    const eff = ctx.game.luck.effective(p);
    expect(eff.luck).toBeCloseTo(2, 5);
    // autoCast consumed one attempt
    expect(eff.attempts).toBe(11);
  });

  it('unknown large gifts match by diamond value', () => {
    const rule = ctx.game.processor.matchGift('Some Huge Gift', 5000);
    expect(rule?.id).toBe('large-gift');
    expect(ctx.game.processor.matchGift('Rose', 1)?.id).toBe('rose');
  });

  it('per-user command cooldown blocks spam', () => {
    ctx.store.updateSection('game', { autoContinue: false });
    ctx.send({ type: 'COMMENT', user: alice, comment: 'câu' });
    const casts = () => ctx.messages.filter((m) => m.type === 'fishing_cycle').length;
    expect(casts()).toBe(1);
    ctx.send({ type: 'COMMENT', user: alice, comment: 'câu' });
    expect(casts()).toBe(1);
  });

  it('queues players when the pond is full', () => {
    ctx.store.updateSection('game', { maxPlayers: 2 });
    for (let i = 0; i < 3; i++) ctx.send({ type: 'COMMENT', user: { userId: 'q' + i, uniqueId: 'q' + i, nickname: 'Q' + i }, comment: 'join' });
    expect(ctx.game.players.seated().length).toBe(2);
    expect(ctx.game.players.queue.length).toBe(1);
    ctx.game.players.leave('q0', 'test');
    expect(ctx.game.players.seated().length).toBe(2);
    expect(ctx.game.players.queue.length).toBe(0);
  });

  it('likes fill the community bar and trigger the community event', () => {
    ctx.store.updateSection('luck', { community: { likeThreshold: 100 } });
    ctx.send({ type: 'LIKE', user: alice, likeCount: 120 });
    expect(ctx.game.community.likeEnergy).toBe(20);
    expect(ctx.game.events.list().some((e) => e.eventId === 'community-challenge')).toBe(true);
  });

  it('shares add a community luck bonus', () => {
    ctx.send({ type: 'SHARE', user: alice });
    expect(ctx.game.community.multiplier()).toBeCloseTo(1.05, 5);
  });

  it('comment "quà" shows the gift guide (rate-limited)', () => {
    const guides = () => ctx.messages.filter((m) => m.type === 'show_gift_guide').length;
    ctx.send({ type: 'COMMENT', user: alice, comment: 'Quà' });
    expect(guides()).toBe(1);
    ctx.send({ type: 'COMMENT', user: { userId: 'u2', uniqueId: 'bob', nickname: 'Bob' }, comment: 'quà tặng' });
    expect(guides()).toBe(1);
    vi.advanceTimersByTime(21_000);
    ctx.send({ type: 'COMMENT', user: { userId: 'u3', uniqueId: 'cat', nickname: 'Cat' }, comment: 'gift' });
    expect(guides()).toBeGreaterThanOrEqual(2);
  });

  it('gift guide appears automatically on its timer', () => {
    ctx.store.updateSection('ui', { giftGuide: { enabled: true, intervalSec: 30, durationSec: 10, firstDelaySec: 5 } });
    vi.advanceTimersByTime(7_000);
    expect(ctx.messages.some((m) => m.type === 'show_gift_guide')).toBe(true);
  });

  it('paused game does not cast', () => {
    ctx.game.pause();
    ctx.send({ type: 'COMMENT', user: alice, comment: 'câu' });
    expect(ctx.messages.some((m) => m.type === 'fishing_cycle')).toBe(false);
  });

  it('every cat entering the pond rolls a personal luck inside the admin range', () => {
    ctx.store.updateSection('luck', { joinLuck: { enabled: true, min: 1.2, max: 1.8 } });
    for (let i = 0; i < 30; i++) ctx.send({ type: 'COMMENT', user: { userId: 'r' + i, uniqueId: 'r' + i, nickname: 'R' + i }, comment: 'join' });
    const rolls = [...ctx.game.players.active.values()].map((p) => ctx.game.players.toDTO(p));
    expect(rolls).toHaveLength(30);
    for (const d of rolls) {
      expect(d.personalLuckSource).toBe('random');
      expect(d.personalLuck).toBeGreaterThanOrEqual(1.2);
      expect(d.personalLuck).toBeLessThanOrEqual(1.8);
      expect(d.luck).toBeCloseTo(d.personalLuck, 5);
    }
    expect(new Set(rolls.map((d) => d.personalLuck)).size).toBeGreaterThan(5);
  });

  it('personal luck multiplies with gift luck; disabled → x1', () => {
    ctx.store.updateSection('luck', { joinLuck: { enabled: true, min: 1.3, max: 1.3 } });
    ctx.send({ type: 'COMMENT', user: alice, comment: 'join' });
    ctx.send({ type: 'GIFT', user: alice, giftName: 'Doughnut', diamonds: 30 });
    expect(ctx.game.luck.effective(ctx.game.players.get('u1')!).luck).toBeCloseTo(2.6, 5);
    ctx.store.updateSection('luck', { joinLuck: { enabled: false } });
    ctx.send({ type: 'COMMENT', user: bob, comment: 'join' });
    expect(ctx.game.players.toDTO(ctx.game.players.get('u2')!).personalLuck).toBe(1);
  });

  it('admin luck for this visit only is dropped when the cat leaves', () => {
    ctx.store.updateSection('luck', { joinLuck: { enabled: true, min: 1, max: 1 } });
    ctx.send({ type: 'COMMENT', user: alice, comment: 'join' });
    expect(ctx.game.players.setLuck('u1', 3, false)).toBe(true);
    let d = ctx.game.players.toDTO(ctx.game.players.get('u1')!);
    expect(d).toMatchObject({ personalLuck: 3, personalLuckSource: 'admin', luck: 3 });
    expect(ctx.messages.some((m) => m.type === 'player_updated' && m.player.id === 'u1' && m.player.personalLuck === 3)).toBe(true);
    ctx.game.players.leave('u1', 'removed');
    expect(ctx.game.players.setLuck('u1', 2, false)).toBe(false); // not in the pond
    vi.advanceTimersByTime(2_000);
    ctx.send({ type: 'COMMENT', user: alice, comment: 'join' });
    d = ctx.game.players.toDTO(ctx.game.players.get('u1')!);
    expect(d).toMatchObject({ personalLuck: 1, personalLuckSource: 'random' });
  });

  it('fixed admin luck is saved and applies on every visit until cleared', () => {
    ctx.send({ type: 'COMMENT', user: alice, comment: 'join' });
    expect(ctx.game.players.setLuck('u1', 2.5, true)).toBe(true);
    ctx.game.players.leave('u1', 'removed');
    expect(ctx.game.repo.loadPlayers().find((r) => r.id === 'u1')?.luckOverride).toBe(2.5);
    vi.advanceTimersByTime(2_000);
    ctx.send({ type: 'COMMENT', user: alice, comment: 'join' });
    expect(ctx.game.players.toDTO(ctx.game.players.get('u1')!)).toMatchObject({ personalLuck: 2.5, personalLuckSource: 'fixed' });
    // A one-visit value wins over the fixed one, clearing removes both.
    ctx.game.players.setLuck('u1', 4, false);
    expect(ctx.game.players.toDTO(ctx.game.players.get('u1')!).personalLuckSource).toBe('admin');
    ctx.game.players.setLuck('u1', null, false);
    expect(ctx.game.players.toDTO(ctx.game.players.get('u1')!).personalLuckSource).toBe('random');
    expect(ctx.game.repo.loadPlayers().find((r) => r.id === 'u1')?.luckOverride).toBeNull();
  });

  it('admin luck is still capped by Max Luck', () => {
    ctx.send({ type: 'COMMENT', user: alice, comment: 'join' });
    ctx.game.players.setLuck('u1', 50, false);
    const d = ctx.game.players.toDTO(ctx.game.players.get('u1')!);
    expect(d.personalLuck).toBe(50);
    expect(d.luck).toBe(ctx.store.get().luck.maxLuck);
  });

  describe('simulated cats (bots) vs real viewers', () => {
    const bot = (i: number) => ({ userId: 'b' + i, uniqueId: 'b' + i, nickname: 'Bot ' + i, bot: true });
    const real = (i: number) => ({ userId: 'v' + i, uniqueId: 'v' + i, nickname: 'Viewer ' + i });
    const seats = () => ctx.game.players.seated().map((p) => p.seat);
    const join = (u: { userId: string; uniqueId: string; nickname: string; bot?: boolean }) => ctx.send({ type: 'COMMENT', user: u, comment: 'join' });

    it('a bot gives its seat to a real viewer when the pond is full', () => {
      ctx.store.updateSection('game', { maxPlayers: 3 });
      for (let i = 0; i < 3; i++) join(bot(i));
      join(real(1));
      const v = ctx.game.players.get('v1')!;
      expect(v.seat).not.toBeNull();
      expect(v.bot).toBe(false);
      expect(ctx.game.players.seated()).toHaveLength(3);
      expect(new Set(seats()).size).toBe(3);
      expect(ctx.messages.filter((m) => m.type === 'player_left' && m.reason === 'yield')).toHaveLength(1);
      const remainingBot = ctx.game.players.seated().find((p) => p.record.id !== 'v1')!;
      expect(ctx.game.players.toDTO(remainingBot).bot).toBe(true);
    });

    it('idle bots give way before bots that are fishing', () => {
      ctx.store.updateSection('game', { maxPlayers: 2 });
      ctx.send({ type: 'COMMENT', user: bot(1), comment: 'câu' });
      join(bot(2));
      expect(ctx.game.players.get('b1')!.status).toBe('fishing');
      join(real(1));
      expect(ctx.game.players.get('b2')).toBeUndefined();
      expect(ctx.game.players.get('b1')).toBeTruthy();
    });

    it('a bot never takes the seat of a real viewer', () => {
      ctx.store.updateSection('game', { maxPlayers: 2 });
      join(real(1));
      join(real(2));
      vi.advanceTimersByTime(70_000); // idle > 60 s and never fished – a real newcomer could replace them
      join(bot(1));
      expect(ctx.game.players.get('b1')!.seat).toBeNull();
      expect(ctx.game.players.get('v1')!.seat).not.toBeNull();
      expect(ctx.game.players.get('v2')!.seat).not.toBeNull();
    });

    it('real viewers wait ahead of bots in the queue and are seated first', () => {
      ctx.store.updateSection('game', { maxPlayers: 1 });
      join(real(1));
      join(bot(1));
      join(bot(2));
      join(real(2));
      expect(ctx.game.players.queue).toEqual(['v2', 'b1', 'b2']);
      ctx.game.players.leave('v1', 'removed');
      expect(ctx.game.players.get('v2')!.seat).not.toBeNull();
      expect(ctx.game.players.queue).toEqual(['b1', 'b2']);
    });

    it('when an eviction frees a seat it goes to the newcomer, never to two cats', () => {
      ctx.store.updateSection('game', { maxPlayers: 2 });
      join(bot(1));
      join(bot(2));
      join(bot(3)); // queued
      join(real(1));
      expect(ctx.game.players.get('v1')!.seat).not.toBeNull();
      expect(new Set(seats()).size).toBe(ctx.game.players.seated().length);
      expect(ctx.game.players.seated()).toHaveLength(2);
      expect(ctx.game.players.get('b3')!.seat).toBeNull();
    });

    it('option off → real viewer waits; turning it on lets bots give way', () => {
      ctx.store.updateSection('game', { maxPlayers: 1, botsYieldToViewers: false });
      join(bot(1));
      join(real(1));
      expect(ctx.game.players.get('v1')!.seat).toBeNull();
      ctx.store.updateSection('game', { botsYieldToViewers: true });
      vi.advanceTimersByTime(1_100);
      expect(ctx.game.players.get('v1')!.seat).not.toBeNull();
      expect(ctx.game.players.get('b1')).toBeUndefined();
    });

    it('a full queue drops its last bot to make room for a real viewer', () => {
      ctx.store.updateSection('game', { maxPlayers: 1, maxQueue: 2 });
      join(real(1));
      join(bot(1));
      join(bot(2));
      join(real(2));
      expect(ctx.game.players.queue).toEqual(['v2', 'b1']);
      expect(ctx.game.players.get('b2')).toBeUndefined();
    });
  });

  describe('"Tất cả tự động câu"', () => {
    const cycles = (id: string) => ctx.messages.filter((m) => m.type === 'fishing_cycle' && m.cycle.playerId === id).length;

    it('off: a cat that only joined does not fish', () => {
      ctx.send({ type: 'COMMENT', user: alice, comment: 'join' });
      vi.advanceTimersByTime(20_000);
      expect(cycles('u1')).toBe(0);
    });

    it('on: every seated cat keeps fishing without any comment', () => {
      ctx.store.updateSection('game', { autoFishAll: true, autoFishPauseSec: 2 });
      ctx.send({ type: 'COMMENT', user: alice, comment: 'join' });
      ctx.send({ type: 'COMMENT', user: bob, comment: 'join' });
      vi.advanceTimersByTime(4_000);
      expect(cycles('u1')).toBe(1);
      expect(cycles('u2')).toBe(1);
      vi.advanceTimersByTime(56_000);
      expect(cycles('u1')).toBeGreaterThanOrEqual(3);
      expect(cycles('u2')).toBeGreaterThanOrEqual(3);
    });

    it('waits the configured pause between casts', () => {
      ctx.store.updateSection('game', { autoFishAll: true, autoFishPauseSec: 30, escapeChance: 0 });
      ctx.send({ type: 'COMMENT', user: alice, comment: 'join' });
      vi.advanceTimersByTime(3_000);
      expect(cycles('u1')).toBe(1);
      vi.advanceTimersByTime(30_000); // first cycle ends (≤ ~20 s) then rests 30 s
      expect(cycles('u1')).toBe(1);
      vi.advanceTimersByTime(25_000);
      expect(cycles('u1')).toBe(2);
    });

    it('auto casts do not keep the cat of a viewer who left', () => {
      ctx.store.updateSection('game', { autoFishAll: true, autoFishPauseSec: 5, idleTimeoutMin: 1 });
      ctx.send({ type: 'COMMENT', user: alice, comment: 'join' });
      vi.advanceTimersByTime(120_000);
      expect(ctx.game.players.get('u1')).toBeUndefined();
    });

    it('does nothing while the game is paused', () => {
      ctx.store.updateSection('game', { autoFishAll: true });
      ctx.send({ type: 'COMMENT', user: alice, comment: 'join' });
      ctx.game.pause();
      vi.advanceTimersByTime(20_000);
      expect(cycles('u1')).toBe(0);
    });
  });

  it('a viewer leaving the LIVE removes their cat right away', () => {
    ctx.send({ type: 'COMMENT', user: alice, comment: 'join' });
    expect(ctx.game.players.get('u1')).toBeTruthy();
    ctx.send({ type: 'VIEWER_LEAVE', user: alice });
    expect(ctx.game.players.get('u1')).toBeUndefined();
    expect(ctx.messages.some((m) => m.type === 'player_left' && m.playerId === 'u1' && m.reason === 'left_live')).toBe(true);
  });

  it('comment "rời hồ" leaves the pond, but the everyday word "rồi" does not', () => {
    ctx.send({ type: 'COMMENT', user: alice, comment: 'join' });
    vi.advanceTimersByTime(2_000);
    ctx.send({ type: 'COMMENT', user: alice, comment: 'rồi' });
    ctx.send({ type: 'COMMENT', user: alice, comment: 'được rồi' });
    expect(ctx.game.players.get('u1')).toBeTruthy();
    ctx.send({ type: 'COMMENT', user: alice, comment: 'Rời hồ' });
    expect(ctx.game.players.get('u1')).toBeUndefined();
  });

  it('LIVE end empties the pond', () => {
    ctx.send({ type: 'COMMENT', user: alice, comment: 'join' });
    ctx.send({ type: 'COMMENT', user: bob, comment: 'join' });
    expect(ctx.game.players.active.size).toBe(2);
    ctx.send({ type: 'LIVE_END' });
    expect(ctx.game.players.active.size).toBe(0);
  });

  it('cats of viewers who stopped interacting leave; likes keep a cat in the pond', () => {
    ctx.store.updateSection('game', { idleTimeoutMin: 1 });
    ctx.send({ type: 'COMMENT', user: alice, comment: 'join' });
    ctx.send({ type: 'COMMENT', user: bob, comment: 'join' });
    vi.advanceTimersByTime(40_000);
    ctx.send({ type: 'LIKE', user: bob, likeCount: 3 });
    vi.advanceTimersByTime(30_000);
    expect(ctx.game.players.get('u1')).toBeUndefined();
    expect(ctx.game.players.get('u2')).toBeTruthy();
    expect(ctx.messages.some((m) => m.type === 'notification' && m.notification.kind === 'leave' && m.notification.playerId === 'u1')).toBe(true);
  });

  it('automatic / community casts do not count as the viewer still watching', () => {
    ctx.store.updateSection('game', { idleTimeoutMin: 1 });
    ctx.send({ type: 'COMMENT', user: alice, comment: 'join' });
    vi.advanceTimersByTime(40_000);
    expect(ctx.game.fishing.requestCast('u1', 'community')).toBe('started');
    vi.advanceTimersByTime(30_000);
    expect(ctx.game.players.get('u1')).toBeUndefined();
  });

  it('platform room-user lists keep listed viewers in the pond', () => {
    ctx.store.updateSection('game', { idleTimeoutMin: 1 });
    ctx.send({ type: 'COMMENT', user: alice, comment: 'join' });
    vi.advanceTimersByTime(50_000);
    const e = normalizeProviderEvent('tiktok', 'roomUser', { topViewers: [{ user: { userId: 'u1', uniqueId: 'alice', nickname: 'Alice' }, coinCount: 3 }], viewerCount: 12 });
    ctx.game.bus.publish(e!);
    vi.advanceTimersByTime(20_000);
    expect(ctx.game.players.get('u1')).toBeTruthy();
  });
});

describe('tiktok connector errors', () => {
  it('explains the retired v1 sign server and strips the long URL', () => {
    const msg = friendlyTikTokError(new Error('Failed to sign request: Request failed with status code 403; URL: https://webcast.tiktok.com/x?y=1'), 'me', true);
    expect(msg).toContain('v1');
    expect(msg).not.toContain('https://');
  });
  it('reads v2 error-event objects instead of printing [object Object]', () => {
    const msg = friendlyTikTokError({ info: 'Websocket error', exception: new Error('socket hang up') }, 'me', false);
    expect(msg).toContain('socket hang up');
    expect(friendlyTikTokError({ info: 'Something odd' }, 'me', false)).toContain('Something odd');
  });
  it('explains the Euler "Business plan" restriction', () => {
    class PremiumFeatureError extends Error {}
    const msg = friendlyTikTokError(new PremiumFeatureError('[fetchWebcastSignatureFromEulerRoute] Failed to sign a request: This endpoint requires a Business plan.'), 'me', false);
    expect(msg).toContain('enableExtendedGiftInfo');
  });
  it('explains an offline account', () => {
    class UserOfflineError extends Error {}
    expect(friendlyTikTokError(new UserOfflineError("The requested user isn't online :("), 'me', false)).toContain('chưa LIVE');
  });
});

describe('provider normalization', () => {
  it('ignores unfinished gift streaks (v1 payload)', () => {
    expect(normalizeProviderEvent('tiktok', 'gift', { giftType: 1, repeatEnd: false, giftName: 'Rose', uniqueId: 'a' })).toBeNull();
    const e = normalizeProviderEvent('tiktok', 'gift', { giftType: 1, repeatEnd: true, repeatCount: 5, giftName: 'Rose', diamondCount: 1, uniqueId: 'a', userId: '1', msgId: 'x' });
    expect(e?.gift).toEqual({ giftId: undefined, name: 'Rose', diamonds: 1, repeatCount: 5 });
  });

  it('reads v2 gift name + diamonds without extended gift info', () => {
    const base = { user: { userId: '9', uniqueId: 'g', nickname: 'G' }, giftId: 5655, repeatCount: 4, common: { msgId: 'gm1' }, giftDetails: { giftName: 'Rose', diamondCount: 1, giftType: 1 } };
    expect(normalizeProviderEvent('tiktok', 'gift', { ...base, repeatEnd: 0 })).toBeNull();
    const e = normalizeProviderEvent('tiktok', 'gift', { ...base, repeatEnd: 1 });
    expect(e?.gift).toMatchObject({ name: 'Rose', diamonds: 1, repeatCount: 4 });
    expect(e?.user?.nickname).toBe('G');
  });

  it('handles v2 nested payloads', () => {
    const e = normalizeProviderEvent('tiktok', 'chat', { user: { uniqueId: 'bob', userId: '2', nickname: 'Bob' }, comment: 'câu', common: { msgId: 'm1' } });
    expect(e?.type).toBe('COMMENT');
    expect(e?.user?.nickname).toBe('Bob');
    expect(e?.id).toBe('m1');
  });
});

describe('leave / presence normalization', () => {
  it('maps bridge leave events and TikTok roomUser lists', () => {
    const leave = normalizeProviderEvent('baltik', 'member_leave', { user: { userId: '7', uniqueId: 'z', nickname: 'Z' } });
    expect(leave?.type).toBe('VIEWER_LEAVE');
    expect(leave?.user?.userId).toBe('7');
    expect(normalizeProviderEvent('baltik', 'leave', {})).toBeNull();
    const room = normalizeProviderEvent('tiktok', 'roomUser', { viewerCount: 50, topViewers: [{ user: { userId: '1', uniqueId: 'a', nickname: 'A' } }, { user: { userId: '2', uniqueId: 'b', nickname: 'B' } }] });
    expect(room?.type).toBe('ROOM_USERS');
    expect(room?.user).toBeUndefined();
    expect(room?.users?.map((u) => u.userId)).toEqual(['1', '2']);
  });
});

describe('stored config migration', () => {
  it('rev 1 → 2 resets the old camera framing and shortens the old idle timeout', () => {
    const out = migrateStored({ ui: { camera: { elevationDeg: 56, offsetZ: 1.5, zoom: 1, fov: 50, focusEnabled: false } }, game: { idleTimeoutMin: 8 } }) as any;
    expect(out.ui.camera).toEqual({ focusEnabled: false });
    expect(out.game.idleTimeoutMin).toBe(3);
    expect(out.schemaRev).toBe(2);
  });
  it('keeps custom values and already-migrated configs', () => {
    expect((migrateStored({ game: { idleTimeoutMin: 15 } }) as any).game.idleTimeoutMin).toBe(15);
    const v2 = { schemaRev: 2, ui: { camera: { elevationDeg: 70 } } };
    expect((migrateStored(v2) as any).ui.camera.elevationDeg).toBe(70);
  });
});

describe('welcome camera settings', () => {
  it('defaults on with 3 s and clamps the duration', async () => {
    const db = await Db.open(null);
    const store = new ConfigStore(new Repository(db));
    expect(store.get().ui.camera).toMatchObject({ welcomeFocus: true, welcomeSec: 3 });
    store.updateSection('ui', { camera: { welcomeSec: 99 } });
    expect(store.get().ui.camera.welcomeSec).toBe(15);
    store.updateSection('ui', { camera: { welcomeFocus: false, welcomeSec: 0 } });
    expect(store.get().ui.camera).toMatchObject({ welcomeFocus: false, welcomeSec: 1 });
    // Configs saved before this feature (rev 2, no welcome fields) get the defaults.
    const old = migrateStored({ schemaRev: 2, ui: { camera: { fov: 50, elevationDeg: 64, zoom: 1, offsetZ: 0, focusEnabled: true } } }) as any;
    expect(old.ui.camera.welcomeFocus).toBeUndefined();
  });
});
