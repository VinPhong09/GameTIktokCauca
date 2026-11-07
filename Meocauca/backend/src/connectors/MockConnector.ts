import type { LiveEvent, LiveEventType, LiveUser } from '@shared/types';
import { BaseConnector, type ConnectorOptions } from './BaseConnector';
import { uid } from '../settings';

export interface MockEventInput {
  type: LiveEventType;
  user?: Partial<LiveUser>;
  comment?: string;
  giftName?: string;
  diamonds?: number;
  repeatCount?: number;
  likeCount?: number;
  /** Optional explicit id – lets you test duplicate detection. */
  id?: string;
}

/** Mock TikTok provider – events go through the exact same EventBus as real providers. */
export class MockConnector extends BaseConnector {
  readonly id = 'mock' as const;

  async connect(_options: ConnectorOptions) {
    this.host.setStatus('connected', 'Mock provider ready', 'simulator');
    this.host.publish({ id: uid('m'), type: 'LIVE_START', provider: 'mock', timestamp: Date.now() });
  }

  async disconnect() {
    this.host.setStatus('disconnected', 'Mock provider stopped');
  }

  /** Build a normalized event from simple admin input. */
  static build(input: MockEventInput): LiveEvent {
    const uniqueId = input.user?.uniqueId || input.user?.userId || 'viewer_' + Math.random().toString(36).slice(2, 7);
    const user: LiveUser = {
      userId: input.user?.userId || uniqueId,
      uniqueId,
      nickname: input.user?.nickname || uniqueId,
      avatarUrl: input.user?.avatarUrl,
      ...(input.user?.bot ? { bot: true } : {}),
    };
    const e: LiveEvent = { id: input.id || uid('m'), type: input.type, provider: 'mock', timestamp: Date.now(), user };
    if (input.type === 'COMMENT') e.comment = input.comment ?? 'câu';
    if (input.type === 'GIFT') e.gift = { name: input.giftName ?? 'Rose', diamonds: input.diamonds ?? 1, repeatCount: Math.max(1, input.repeatCount ?? 1) };
    if (input.type === 'LIKE') e.likeCount = Math.max(1, input.likeCount ?? 15);
    if (input.type === 'LIVE_START' || input.type === 'LIVE_END') delete e.user;
    return e;
  }
}
