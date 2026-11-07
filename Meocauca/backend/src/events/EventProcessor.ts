import type { GiftRule, LiveEvent, LiveUser } from '@shared/types';
import { matchesCommand, normalizeText } from '@shared/text';
import type { GameContext } from '../services/context';
import { Logger } from '../services/Logger';
import { uid } from '../settings';
import type { ActivePlayer } from '../players/PlayerManager';

/** Maps normalized live events → gameplay actions. */
export class EventProcessor {
  private lastCommand = new Map<string, number>();
  private commentBucket = { tokens: 60, last: Date.now() };

  constructor(private ctx: GameContext) {}

  handle(e: LiveEvent) {
    this.ctx.stats.eventsProcessed++;
    switch (e.type) {
      case 'COMMENT': return this.onComment(e);
      case 'GIFT': return this.onGift(e);
      case 'LIKE': return this.onLike(e);
      case 'FOLLOW': return this.onFollow(e);
      case 'SHARE': return this.onShare(e);
      case 'VIEWER_JOIN': return this.onViewerJoin(e);
      case 'VIEWER_LEAVE': return this.onViewerLeave(e);
      case 'ROOM_USERS':
        // Viewers the platform reports as still in the room keep their cat.
        for (const u of e.users ?? []) this.ctx.players.touch(u.userId || u.uniqueId);
        return;
      case 'LIVE_START':
        Logger.event('LIVE started');
        return this.ctx.notify({ kind: 'info', title: 'LIVE', message: 'Buổi LIVE đã bắt đầu! Bình luận "câu" để câu cá 🎣' });
      case 'LIVE_END':
        Logger.event('LIVE ended');
        if (this.ctx.config().game.leaveOnLiveEnd) this.ctx.players.clearPond('live_end');
        return this.ctx.notify({ kind: 'info', title: 'LIVE', message: 'Buổi LIVE đã kết thúc. Hẹn gặp lại!' });
    }
  }

  /** Global token bucket (≈40 comments/s) + per-user cooldown. */
  private allowCommand(user: LiveUser): boolean {
    const now = Date.now();
    const b = this.commentBucket;
    b.tokens = Math.min(60, b.tokens + ((now - b.last) / 1000) * 40);
    b.last = now;
    if (b.tokens < 1) return false;
    const cd = this.ctx.config().game.commandCooldownSec * 1000;
    const last = this.lastCommand.get(user.userId) ?? 0;
    if (now - last < cd) return false;
    b.tokens -= 1;
    this.lastCommand.set(user.userId, now);
    if (this.lastCommand.size > 20000) this.lastCommand.clear();
    return true;
  }

  private onComment(e: LiveEvent) {
    if (!e.user || !e.comment) return;
    const cmds = this.ctx.config().game.commands;
    const text = e.comment;
    const isFish = matchesCommand(text, cmds.fish);
    const isJoin = matchesCommand(text, cmds.join);
    const isTop = matchesCommand(text, cmds.top);
    const isGifts = matchesCommand(text, cmds.gifts ?? []);
    const isLeave = matchesCommand(text, cmds.leave ?? []);
    if (!isFish && !isJoin && !isTop && !isGifts && !isLeave) {
      this.ctx.players.touch(e.user.userId);
      return;
    }
    if (!this.allowCommand(e.user)) {
      Logger.warn(`Command throttled: ${e.user.nickname} "${normalizeText(text)}"`);
      return;
    }
    if (isLeave) {
      if (this.ctx.players.get(e.user.userId)) this.ctx.players.leave(e.user.userId, 'command');
      return;
    }
    if (isTop) {
      this.ctx.broadcast({ type: 'show_leaderboard', category: 'weight', requestedBy: e.user.nickname });
      return;
    }
    if (isGifts) {
      this.ctx.showGiftGuide(e.user.nickname);
      return;
    }
    if (isJoin) {
      this.join(e.user, 'comment');
      return;
    }
    if (isFish) {
      let p = this.ctx.players.get(e.user.userId);
      if (!p) {
        if (!this.ctx.config().game.autoJoinOnComment) return;
        p = this.join(e.user, 'comment') ?? undefined;
      }
      if (!p) return;
      const res = this.ctx.fishing.requestCast(p.record.id, 'command');
      if (res === 'not_seated') {
        const pos = this.ctx.players.queue.indexOf(p.record.id) + 1;
        this.ctx.notify({ kind: 'queue', title: 'Hồ đã đầy', message: `${p.record.nickname} đang ở hàng chờ #${pos}`, playerId: p.record.id });
      }
    }
  }

  private join(user: LiveUser, reason: string) {
    const { player, result } = this.ctx.players.join(user, reason);
    if (result === 'joined') {
      this.ctx.notify({ kind: 'join', title: 'Mèo mới!', message: `${user.nickname} đã vào hồ câu 🐱${this.luckText(player!)}`, playerId: player!.record.id, catId: player!.record.catId, speech: { name: user.nickname, bot: !!user.bot } });
    } else if (result === 'rejected') {
      Logger.warn(`Join rejected (pond + queue full): ${user.nickname}`);
    }
    return player;
  }

  /** " · 🍀 may mắn x1.23" when the cat got a personal luck other than x1. */
  private luckText(p: ActivePlayer): string {
    const v = this.ctx.luck.personal(p).value;
    return Math.abs(v - 1) >= 0.005 ? ` · 🍀 may mắn x${v.toFixed(2)}` : '';
  }

  matchGift(name: string, diamonds: number): GiftRule | null {
    const gifts = this.ctx.config().gifts.filter((g) => g.enabled);
    const n = normalizeText(name).replace(/\s/g, '');
    const byName = gifts.find((g) => [g.giftName, ...g.aliases, g.id].some((a) => normalizeText(a).replace(/\s/g, '') === n));
    if (byName) return byName;
    const byDiamonds = gifts.filter((g) => g.minDiamonds > 0 && diamonds >= g.minDiamonds).sort((a, b) => b.minDiamonds - a.minDiamonds)[0];
    return byDiamonds ?? null;
  }

  private onGift(e: LiveEvent) {
    if (!e.user || !e.gift) return;
    const gift = e.gift;
    const count = Math.max(1, gift.repeatCount || 1);
    const rule = this.matchGift(gift.name, gift.diamonds);
    const L = this.ctx.config().luck;
    const effRule = rule ?? {
      id: 'unknown', giftName: gift.name, luck: L.unknownGift.luck, attempts: L.unknownGift.attempts, durationSec: L.unknownGift.durationSec,
      global: false, tier: 'small' as const, autoCast: true, rarityBoost: {}, aliases: [], minDiamonds: 0, enabled: true,
    };

    const player = this.ctx.players.get(e.user.userId) ?? this.join(e.user, 'gift');
    const rec = this.ctx.players.ensureRecord(e.user);
    rec.stats.totalGifts += count;
    rec.stats.totalDiamonds += Math.max(0, gift.diamonds) * count;
    this.ctx.players.markDirty(rec.id);
    this.ctx.repo.insertGift(uid('g'), rec.id, gift.name, gift.diamonds, count);
    this.ctx.stats.markDirty();

    let luck = effRule.luck;
    if (effRule.global) {
      this.ctx.community.addGlobalBoost(effRule.giftName, effRule.luck, effRule.durationSec || 60);
    } else if (player) {
      this.ctx.luck.addGiftBoost(player, effRule, count);
      luck = this.ctx.luck.effective(player).luck;
    }
    this.ctx.broadcast({
      type: 'gift_effect',
      effect: { playerId: player?.record.id ?? null, nickname: rec.nickname, giftName: gift.name, tier: effRule.tier, count, luck, global: effRule.global },
    });
    this.ctx.notify({
      kind: 'gift',
      title: `🎁 ${gift.name}${count > 1 ? ' x' + count : ''}`,
      message: effRule.global
        ? `${rec.nickname} tặng quà – cả hồ được may mắn x${effRule.luck}!`
        : `${rec.nickname} nhận may mắn x${luck.toFixed(2)} (${Math.min(L.maxAttempts, effRule.attempts * (L.repeatExtendsAttempts ? count : 1))} lượt)`,
      playerId: rec.id,
      catId: rec.catId,
      speech: { name: rec.nickname, gift: gift.name, count, bot: !!e.user.bot },
    });
    Logger.event(`Gift ${gift.name} x${count} from ${rec.nickname} → ${rule ? rule.id : 'unknown rule'}`);
    if (player) {
      this.ctx.broadcast({ type: 'player_updated', player: this.ctx.players.toDTO(player) });
      if (effRule.autoCast && player.seat !== null) this.ctx.fishing.requestCast(player.record.id, 'gift');
    }
  }

  private onLike(e: LiveEvent) {
    const n = Math.max(1, e.likeCount ?? 1);
    this.ctx.community.addLikes(n);
    this.ctx.stats.addCounter('likes', n);
    if (e.user) this.ctx.players.touch(e.user.userId);
  }

  private onFollow(e: LiveEvent) {
    if (!e.user) return;
    this.ctx.stats.addCounter('follows');
    this.ctx.players.touch(e.user.userId);
    const existing = this.ctx.players.get(e.user.userId);
    const p = existing ?? this.ctx.players.join(e.user, 'follow').player;
    this.ctx.notify({ kind: 'follow', title: '💖 Theo dõi mới', message: `Chào mừng ${e.user.nickname}! Một chú mèo mới đã đến hồ${!existing && p ? this.luckText(p) : ''}`, playerId: p?.record.id, catId: p?.record.catId, speech: { name: e.user.nickname, bot: !!e.user.bot } });
  }

  private onShare(e: LiveEvent) {
    this.ctx.community.addShare();
    if (e.user) this.ctx.players.touch(e.user.userId);
    this.ctx.stats.addCounter('shares');
    const bonus = this.ctx.community.state().shareBonus;
    this.ctx.notify({ kind: 'share', title: '📣 Chia sẻ', message: `${e.user?.nickname ?? 'Ai đó'} đã chia sẻ LIVE! May mắn cộng đồng +${Math.round(bonus * 100)}%`, speech: { name: e.user?.nickname, bot: !!e.user?.bot } });
  }

  private onViewerJoin(e: LiveEvent) {
    if (!e.user) return;
    this.ctx.players.touch(e.user.userId);
    if (this.ctx.config().game.autoJoinOnViewerJoin) this.ctx.players.join(e.user, 'viewer_join');
  }

  /** The viewer left the LIVE (only bridges that report it) → their cat leaves the pond right away. */
  private onViewerLeave(e: LiveEvent) {
    if (!e.user) return;
    const id = this.ctx.players.get(e.user.userId) ? e.user.userId : e.user.uniqueId;
    if (this.ctx.players.get(id)) this.ctx.players.leave(id, 'left_live');
  }
}
