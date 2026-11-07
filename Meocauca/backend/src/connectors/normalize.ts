// Converts provider-specific payloads into the common LiveEvent shape.
// Handles tiktok-live-connector v1 (flat) and v2 (nested `user`, `giftDetails`) payloads,
// plus generic bridge JSON.
import type { LiveEvent, LiveEventType, LiveUser, ProviderId } from '@shared/types';
import { deriveEventId } from '../events/EventBus';

/* eslint-disable @typescript-eslint/no-explicit-any */
export function extractUser(data: any): LiveUser | undefined {
  if (!data) return undefined;
  const u = data.user ?? data;
  const uniqueId = String(u.uniqueId ?? u.unique_id ?? u.username ?? u.displayId ?? '').trim();
  const userId = String(u.userId ?? u.user_id ?? u.id ?? uniqueId ?? '').trim();
  if (!userId && !uniqueId) return undefined;
  const avatar =
    u.profilePictureUrl ?? u.profilePicture?.url?.[0] ?? u.profilePicture?.urls?.[0] ?? u.avatarThumb?.urlList?.[0] ?? u.avatarUrl ?? u.avatar ?? undefined;
  return {
    userId: userId || uniqueId,
    uniqueId: uniqueId || userId,
    nickname: String(u.nickname ?? u.displayName ?? u.name ?? uniqueId ?? 'Viewer'),
    avatarUrl: typeof avatar === 'string' ? avatar : undefined,
  };
}

export const EVENT_NAME_MAP: Record<string, LiveEventType> = {
  chat: 'COMMENT', comment: 'COMMENT',
  gift: 'GIFT',
  like: 'LIKE',
  follow: 'FOLLOW',
  share: 'SHARE',
  member: 'VIEWER_JOIN', join: 'VIEWER_JOIN', viewer_join: 'VIEWER_JOIN', viewerjoin: 'VIEWER_JOIN',
  // TikTok itself does not announce leaving viewers; bridges/relays that do can send any of these.
  leave: 'VIEWER_LEAVE', viewer_leave: 'VIEWER_LEAVE', viewerleave: 'VIEWER_LEAVE', member_leave: 'VIEWER_LEAVE', memberleave: 'VIEWER_LEAVE', left: 'VIEWER_LEAVE', user_left: 'VIEWER_LEAVE',
  // tiktok-live-connector "roomUser": periodic list of (top) viewers currently in the room.
  roomuser: 'ROOM_USERS', room_user: 'ROOM_USERS', room_users: 'ROOM_USERS', viewers: 'ROOM_USERS',
  streamend: 'LIVE_END', live_end: 'LIVE_END', liveend: 'LIVE_END',
  connected: 'LIVE_START', live_start: 'LIVE_START', livestart: 'LIVE_START',
};

/**
 * Returns null when the payload should be ignored (e.g. a gift streak that has not ended yet).
 */
export function normalizeProviderEvent(provider: ProviderId, eventName: string, data: any): LiveEvent | null {
  const type = EVENT_NAME_MAP[String(eventName).toLowerCase()] ?? (String(eventName).toUpperCase() as LiveEventType);
  if (!['COMMENT', 'GIFT', 'LIKE', 'FOLLOW', 'SHARE', 'VIEWER_JOIN', 'VIEWER_LEAVE', 'ROOM_USERS', 'LIVE_START', 'LIVE_END'].includes(type)) return null;
  const user = type === 'ROOM_USERS' ? undefined : extractUser(data);
  const msgId = data?.msgId ?? data?.common?.msgId ?? data?.id ?? data?.eventId;
  const ts = Number(data?.createTime ?? data?.common?.createTime ?? data?.timestamp ?? Date.now()) || Date.now();
  const base: LiveEvent = { id: '', type, provider, timestamp: ts > 1e12 ? ts : Date.now(), user };

  switch (type) {
    case 'COMMENT':
      base.comment = String(data?.comment ?? data?.content ?? data?.text ?? '');
      if (!base.comment) return null;
      break;
    case 'GIFT': {
      const giftType = Number(data?.giftType ?? data?.giftDetails?.giftType ?? 0);
      const repeatEnd = data?.repeatEnd === undefined ? true : Boolean(data.repeatEnd);
      // Streakable gifts (giftType 1) fire repeatedly; only process the final event.
      if (giftType === 1 && !repeatEnd) return null;
      base.gift = {
        giftId: data?.giftId ?? data?.gift?.id,
        name: String(data?.giftName ?? data?.giftDetails?.giftName ?? data?.extendedGiftInfo?.name ?? data?.gift?.name ?? data?.name ?? 'Gift'),
        diamonds: Number(data?.diamondCount ?? data?.giftDetails?.diamondCount ?? data?.extendedGiftInfo?.diamond_count ?? data?.gift?.diamonds ?? data?.diamonds ?? 1) || 0,
        repeatCount: Math.max(1, Number(data?.repeatCount ?? data?.count ?? 1) || 1),
      };
      break;
    }
    case 'LIKE':
      base.likeCount = Math.max(1, Number(data?.likeCount ?? data?.count ?? 1) || 1);
      break;
    case 'VIEWER_LEAVE':
      if (!user) return null;
      break;
    case 'ROOM_USERS': {
      const list: any[] = data?.topViewers ?? data?.ranksList ?? data?.users ?? data?.viewers ?? [];
      base.users = (Array.isArray(list) ? list : []).map((v) => extractUser(v?.user ?? v)).filter((u): u is LiveUser => !!u);
      if (!base.users.length) return null;
      break;
    }
  }
  base.id = msgId
    ? String(msgId) + (type === 'GIFT' ? ':' + base.gift?.repeatCount : '')
    : deriveEventId([type, user?.userId, base.comment, base.gift?.name, base.gift?.repeatCount, base.likeCount, base.users?.map((u) => u.userId).join(','), Math.floor(base.timestamp / 1000)]);
  base.raw = undefined;
  return base;
}
