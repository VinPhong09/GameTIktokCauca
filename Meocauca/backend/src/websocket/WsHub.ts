import type { Server } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import type { ServerMessage, Snapshot } from '@shared/types';
import { Logger } from '../services/Logger';

interface Client {
  ws: WebSocket;
  role: 'game' | 'overlay' | 'admin';
  alive: boolean;
}

/** WebSocket broadcast hub. Clients receive a full snapshot on connect, then deltas. */
export class WsHub {
  private wss: WebSocketServer;
  private clients = new Set<Client>();
  private heartbeat: NodeJS.Timeout;

  constructor(server: Server, private snapshot: () => Snapshot) {
    this.wss = new WebSocketServer({ server, path: '/ws' });
    this.wss.on('connection', (ws, req) => {
      const url = new URL(req.url ?? '/ws', 'http://localhost');
      const roleParam = url.searchParams.get('role');
      const role: Client['role'] = roleParam === 'admin' ? 'admin' : roleParam === 'overlay' ? 'overlay' : 'game';
      const client: Client = { ws, role, alive: true };
      this.clients.add(client);
      ws.on('pong', () => (client.alive = true));
      ws.on('close', () => this.clients.delete(client));
      ws.on('error', () => this.clients.delete(client));
      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(String(data));
          if (msg?.type === 'resync') this.sendTo(client, { type: 'snapshot', data: this.snapshot() });
        } catch {
          /* ignore */
        }
      });
      this.sendTo(client, { type: 'snapshot', data: this.snapshot() });
      Logger.info(`WS client connected (${role}); total ${this.clients.size}`);
    });
    this.heartbeat = setInterval(() => {
      for (const c of this.clients) {
        if (!c.alive) {
          c.ws.terminate();
          this.clients.delete(c);
          continue;
        }
        c.alive = false;
        try { c.ws.ping(); } catch { /* ignore */ }
      }
    }, 15000);
  }

  private sendTo(c: Client, msg: ServerMessage) {
    if (c.ws.readyState === WebSocket.OPEN) c.ws.send(JSON.stringify(msg));
  }

  broadcast(msg: ServerMessage, opts: { adminOnly?: boolean } = {}) {
    if (!this.clients.size) return;
    const payload = JSON.stringify(msg);
    for (const c of this.clients) {
      if (opts.adminOnly && c.role !== 'admin') continue;
      if (c.ws.readyState === WebSocket.OPEN) c.ws.send(payload);
    }
  }

  count() {
    return this.clients.size;
  }

  close() {
    clearInterval(this.heartbeat);
    for (const c of this.clients) c.ws.close();
    this.wss.close();
  }
}
