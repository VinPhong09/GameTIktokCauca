import type { ConnectionStatus, LiveEvent, ProviderId } from '@shared/types';

export interface ConnectorOptions {
  username?: string;
  url?: string;
  [key: string]: unknown;
}

export interface ConnectorHost {
  publish(e: LiveEvent): void;
  setStatus(state: ConnectionStatus['state'], message?: string, target?: string): void;
}

export abstract class BaseConnector {
  abstract readonly id: ProviderId;
  constructor(protected host: ConnectorHost) {}
  abstract connect(options: ConnectorOptions): Promise<void>;
  abstract disconnect(): Promise<void>;
}
