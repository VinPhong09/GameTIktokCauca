// Adapter for the community `tiktok-live-connector` npm package (v2 preferred, v1 legacy supported).
// This is NOT an official TikTok API – it may break when TikTok changes things.
// v1.x signs through an Euler Stream route that no longer exists → always "Failed to sign request".
import { BaseConnector, type ConnectorOptions } from './BaseConnector';
import { normalizeProviderEvent } from './normalize';
import { Logger } from '../services/Logger';

/* eslint-disable @typescript-eslint/no-explicit-any */
const EVENTS = ['chat', 'gift', 'like', 'follow', 'share', 'member', 'roomUser', 'streamEnd'];

/** Turn library errors into short, actionable messages (and drop the huge signed URLs). */
export function friendlyTikTokError(input: any, username: string, isV1: boolean): string {
  // v2 'error' events are { info, exception }; connect() rejections are Error instances.
  const err = input?.exception ?? input;
  const name = String(err?.constructor?.name ?? err?.name ?? '');
  let raw = String(err?.message ?? input?.info ?? '');
  if (!raw) {
    try {
      raw = JSON.stringify(input).slice(0, 300);
    } catch {
      raw = String(input);
    }
  }
  raw = raw.split('; URL:')[0].trim();
  if (/UserOffline/i.test(name) || /isn't online|is offline|not online|LIVE has ended/i.test(raw)) {
    return `@${username} chưa LIVE (hoặc LIVE đã kết thúc). Hãy bắt đầu LIVE trên TikTok rồi bấm Kết nối lại.`;
  }
  if (/PremiumFeature/i.test(name) || /Business plan|requires a .*plan|premium/i.test(raw)) {
    return 'Euler Stream yêu cầu gói trả phí cho tính năng này. Hãy tắt "enableExtendedGiftInfo" trong config/settings.json (mặc định đã tắt) rồi kết nối lại.';
  }
  if (/RateLimit/i.test(name) || /rate.?limit|429/i.test(raw)) {
    return 'Máy chủ ký Euler Stream đang giới hạn lượt dùng miễn phí. Thử lại sau ít phút, hoặc nhập Euler Stream API key (eulerstream.com).';
  }
  if (/sign/i.test(raw) || /Sign/i.test(name)) {
    if (isV1) return 'tiktok-live-connector v1 không còn dùng được (máy chủ ký cũ đã ngừng). Chạy: npm --prefix backend install tiktok-live-connector@2';
    return `Không ký được yêu cầu tới TikTok (${raw.slice(0, 160)}). Thử lại sau, hoặc nhập Euler Stream API key.`;
  }
  if (/InvalidUniqueId|user.*not.*found|unique.?id/i.test(name + raw)) {
    return `Không tìm thấy tài khoản @${username}. Kiểm tra lại username (không có @).`;
  }
  return raw.slice(0, 300) || 'Kết nối TikTok thất bại';
}

export class TikTokLiveConnector extends BaseConnector {
  readonly id = 'tiktok' as const;
  private conn: any = null;

  async connect(options: ConnectorOptions) {
    const username = String(options.username ?? '').replace(/^@/, '').trim();
    if (!username) throw new Error('Cần nhập TikTok username');
    let mod: any;
    try {
      const name = 'tiktok-live-connector';
      mod = await import(name);
    } catch {
      throw new Error('Chưa cài "tiktok-live-connector". Chạy: npm --prefix backend install tiktok-live-connector@2');
    }
    const V2 = mod.TikTokLiveConnection ?? mod.default?.TikTokLiveConnection;
    const V1 = mod.WebcastPushConnection ?? mod.default?.WebcastPushConnection;
    const Ctor = V2 ?? V1;
    const isV1 = !V2;
    if (!Ctor) throw new Error('Phiên bản tiktok-live-connector không được hỗ trợ');
    if (isV1) Logger.warn('tiktok-live-connector v1 detected – its signing server is retired; upgrade to v2.');
    const signApiKey = String(options.signApiKey ?? '').trim();
    // Extended gift info downloads the gift list through Euler's paid ("Business plan") signing route.
    // Gift events already carry name + diamond value, so it stays off unless explicitly enabled.
    const extendedGifts = options.enableExtendedGiftInfo === true;
    this.host.setStatus('connecting', `Đang kết nối @${username}…`, username);
    try {
      await this.open(Ctor, username, isV1, signApiKey, extendedGifts);
    } catch (err: any) {
      const premium = /PremiumFeature/i.test(String(err?.constructor?.name)) || /Business plan|premium/i.test(String(err?.message));
      if (!extendedGifts || !premium) throw new Error(friendlyTikTokError(err, username, isV1));
      Logger.warn('Extended gift info needs a paid Euler plan – retrying without it');
      try {
        await this.open(Ctor, username, isV1, signApiKey, false);
      } catch (err2: any) {
        throw new Error(friendlyTikTokError(err2, username, isV1));
      }
    }
  }

  private async open(Ctor: any, username: string, isV1: boolean, signApiKey: string, extendedGifts: boolean) {
    const conn = new Ctor(username, {
      processInitialData: false,
      enableExtendedGiftInfo: extendedGifts,
      ...(signApiKey && !isV1 ? { signApiKey } : {}),
    });
    for (const ev of EVENTS) {
      conn.on(ev, (data: any) => {
        const e = normalizeProviderEvent('tiktok', ev, data);
        if (e) this.host.publish(e);
      });
    }
    conn.on('disconnected', () => {
      if (this.conn !== conn) return;
      Logger.warn('TikTok connection closed');
      this.host.setStatus('disconnected', 'TikTok đã đóng kết nối (LIVE kết thúc hoặc mạng lỗi)', username);
    });
    conn.on('error', (err: any) => Logger.warn(`TikTok connector error: ${friendlyTikTokError(err, username, isV1)}`));
    this.conn = conn;
    try {
      const state = await conn.connect();
      const roomId = state?.roomId ?? conn.roomId ?? '';
      this.host.setStatus('connected', `Đã kết nối @${username}${roomId ? ' (room ' + roomId + ')' : ''}`, username);
      this.host.publish({ id: 'live-start-' + Date.now(), type: 'LIVE_START', provider: 'tiktok', timestamp: Date.now() });
    } catch (err: any) {
      this.conn = null;
      try {
        conn.disconnect?.();
      } catch {
        /* ignore */
      }
      throw err; // original error – connect() decides whether to retry and formats the message
    }
  }

  async disconnect() {
    const c = this.conn;
    this.conn = null;
    try {
      await c?.disconnect?.();
    } catch {
      /* ignore */
    }
    this.host.setStatus('disconnected', 'Đã ngắt kết nối');
  }
}
