// Generic WebSocket bridge client (Baltik Live Bridge or any TikTok event relay).
// Accepted message formats (JSON):
//   { "event": "chat" | "gift" | "like" | "follow" | "share" | "member", "data": { ...tiktok-live-connector style } }
//   { "type": "COMMENT" | "GIFT" | ..., "user": {...}, "comment": "...", "gift": {...} }   (normalized format)
//   [ ...array of the above ]
import WebSocket from 'ws';
import { BaseConnector, type ConnectorOptions } from './BaseConnector';
import { normalizeProviderEvent } from './normalize';
import { Logger } from '../services/Logger';

/* eslint-disable @typescript-eslint/no-explicit-any */
export class BaltikBridgeConnector extends BaseConnector {
  readonly id = 'baltik' as const;
  private ws: WebSocket | null = null;
  private url = '';
  private reconnectMs = 5000;
  private stopped = true;
  private timer: NodeJS.Timeout | null = null;

  async connect(options: ConnectorOptions) {
    this.url = String(options.url ?? '').trim();
    if (!/^wss?:\/\//.test(this.url)) throw new Error('Bridge URL must start with ws:// or wss://');
    this.reconnectMs = Number(options.reconnectMs ?? 5000) || 5000;
    this.stopped = false;
    await this.open();
  }

  private open(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.host.setStatus('connecting', `Connecting to bridge ${this.url}`, this.url);
      const ws = new WebSocket(this.url);
      this.ws = ws;
      let settled = false;
      ws.on('open', () => {
        settled = true;
        this.host.setStatus('connected', `Bridge connected: ${this.url}`, this.url);
        resolve();
      });
      ws.on('message', (raw) => this.onMessage(String(raw)));
      ws.on('error', (err) => {
        Logger.warn(`Bridge error: ${err.message}`);
        if (!settled) {
          settled = true;
          reject(err);
        }
      });
      ws.on('close', () => {
        if (this.stopped) return;
        this.host.setStatus('connecting', `Bridge closed – retrying in ${this.reconnectMs / 1000}s`, this.url);
        this.timer = setTimeout(() => this.open().catch(() => {}), this.reconnectMs);
      });
    });
  }

  private onMessage(text: string) {
    let msg: any;
    try {
      msg = JSON.parse(text);
    } catch {
      return;
    }
    const items = Array.isArray(msg) ? msg : [msg];
    for (const m of items) {
      const name = m?.event ?? m?.type ?? m?.eventType;
      if (!name) continue;
      const data = m?.data ?? m;
      // Normalized format may carry gift as an object already.
      if (data?.gift && typeof data.gift === 'object' && !data.giftName) {
        data.giftName = data.gift.name;
        data.diamondCount = data.gift.diamonds;
        data.repeatCount = data.gift.repeatCount;
      }
      const e = normalizeProviderEvent('baltik', String(name), data);
      if (e) this.host.publish(e);
    }
  }

  async disconnect() {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    this.ws?.close();
    this.ws = null;
    this.host.setStatus('disconnected', 'Bridge disconnected');
  }
}
