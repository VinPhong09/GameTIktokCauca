import type { ServerMessage } from '@shared/types';

type Listener = (msg: ServerMessage) => void;

/** Auto-reconnecting WebSocket client shared by game, overlay and admin pages. */
export class GameSocket {
  private ws: WebSocket | null = null;
  private listeners = new Set<Listener>();
  private statusListeners = new Set<(connected: boolean) => void>();
  private retry = 0;
  private closed = false;
  private timer: number | null = null;

  constructor(private role: 'game' | 'overlay' | 'admin') {}

  connect() {
    this.closed = false;
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${location.host}/ws?role=${this.role}`);
    this.ws = ws;
    ws.onopen = () => {
      this.retry = 0;
      this.statusListeners.forEach((l) => l(true));
    };
    ws.onmessage = (ev) => {
      let msg: ServerMessage;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }
      for (const l of this.listeners) {
        try {
          l(msg);
        } catch (e) {
          console.error('[socket] listener error', e);
        }
      }
    };
    ws.onclose = () => {
      this.statusListeners.forEach((l) => l(false));
      if (this.closed) return;
      const delay = Math.min(10000, 500 * 2 ** this.retry++);
      this.timer = window.setTimeout(() => this.connect(), delay);
    };
    ws.onerror = () => ws.close();
  }

  on(l: Listener) {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  onStatus(l: (connected: boolean) => void) {
    this.statusListeners.add(l);
    return () => this.statusListeners.delete(l);
  }

  resync() {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ type: 'resync' }));
  }

  close() {
    this.closed = true;
    if (this.timer) clearTimeout(this.timer);
    this.ws?.close();
  }
}
