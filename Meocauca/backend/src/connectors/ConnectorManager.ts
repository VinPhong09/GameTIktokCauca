import type { ConnectionStatus, LiveEvent, ProviderId } from '@shared/types';
import type { EventBus } from '../events/EventBus';
import type { BaseConnector, ConnectorHost, ConnectorOptions } from './BaseConnector';
import { MockConnector } from './MockConnector';
import { TikTokLiveConnector } from './TikTokLiveConnector';
import { BaltikBridgeConnector } from './BaltikBridgeConnector';
import { Logger } from '../services/Logger';

/** Owns the active live provider. Mock events are always accepted (testing during LIVE). */
export class ConnectorManager implements ConnectorHost {
  private current: BaseConnector | null = null;
  status: ConnectionStatus = { provider: null, state: 'disconnected', since: Date.now(), mockAuto: false };

  constructor(private bus: EventBus, private onStatus: (s: ConnectionStatus) => void) {}

  publish(e: LiveEvent) {
    if (e.type !== 'LIKE') Logger.event(`[${e.provider}] ${e.type} ${e.user?.nickname ?? ''} ${e.comment ?? e.gift?.name ?? ''}`.trim());
    this.bus.publish(e);
  }

  setStatus(state: ConnectionStatus['state'], message?: string, target?: string) {
    this.status = { ...this.status, provider: this.current?.id ?? this.status.provider, state, message, target: target ?? this.status.target, since: Date.now() };
    this.onStatus(this.status);
  }

  setMockAuto(on: boolean) {
    this.status = { ...this.status, mockAuto: on };
    this.onStatus(this.status);
  }

  private create(provider: ProviderId): BaseConnector {
    switch (provider) {
      case 'tiktok': return new TikTokLiveConnector(this);
      case 'baltik': return new BaltikBridgeConnector(this);
      case 'mock':
      default: return new MockConnector(this);
    }
  }

  async connect(provider: ProviderId, options: ConnectorOptions) {
    await this.disconnect();
    this.current = this.create(provider);
    this.status = { ...this.status, provider, target: options.username ?? options.url };
    try {
      await this.current.connect(options);
      Logger.info(`Live provider connected: ${provider}`);
    } catch (err) {
      const msg = (err as Error).message;
      Logger.error(`Live provider ${provider} failed: ${msg}`);
      this.setStatus('error', msg);
      this.current = null;
      throw err;
    }
  }

  async disconnect() {
    if (!this.current) return;
    const c = this.current;
    this.current = null;
    await c.disconnect().catch(() => {});
    this.status = { ...this.status, state: 'disconnected', message: 'Disconnected', since: Date.now() };
    this.onStatus(this.status);
  }

  /** Mock events always flow through the same pipeline as live ones. */
  injectMock(e: LiveEvent) {
    this.publish(e);
  }
}
