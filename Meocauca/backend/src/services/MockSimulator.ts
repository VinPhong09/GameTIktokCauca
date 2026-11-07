import type { LiveUser } from '@shared/types';
import { MockConnector, type MockEventInput } from '../connectors/MockConnector';
import type { ConnectorManager } from '../connectors/ConnectorManager';
import { randomViewer } from './fakeNames';

// Realistic viewer names live in fakeNames.ts (re-exported for the API routes).
export { randomViewer } from './fakeNames';

const GIFTS: { name: string; diamonds: number; weight: number }[] = [
  { name: 'Rose', diamonds: 1, weight: 55 },
  { name: 'Finger Heart', diamonds: 5, weight: 20 },
  { name: 'Doughnut', diamonds: 30, weight: 12 },
  { name: 'Hand Heart', diamonds: 100, weight: 9 },
  { name: 'Galaxy', diamonds: 1000, weight: 4 },
];

/** Background "bot audience" for testing the full pipeline without TikTok. */
export class MockSimulator {
  private timer: NodeJS.Timeout | null = null;
  private viewers: LiveUser[] = [];
  rate = 40;

  constructor(private connectors: ConnectorManager) {}

  get running() {
    return !!this.timer;
  }

  emit(input: MockEventInput) {
    const e = MockConnector.build(input);
    this.connectors.injectMock(e);
    return e;
  }

  spawn(count: number, fish = true) {
    for (let i = 0; i < count; i++) {
      const v = randomViewer();
      this.viewers.push(v);
      this.emit({ type: fish ? 'COMMENT' : 'FOLLOW', user: v, comment: 'câu' });
    }
    if (this.viewers.length > 300) this.viewers = this.viewers.slice(-300);
  }

  private pickViewer(): LiveUser {
    if (!this.viewers.length || Math.random() < 0.08) {
      const v = randomViewer();
      this.viewers.push(v);
      return v;
    }
    return this.viewers[Math.floor(Math.random() * this.viewers.length)];
  }

  private step() {
    const r = Math.random() * 100;
    const user = this.pickViewer();
    if (r < 55) this.emit({ type: 'COMMENT', user, comment: Math.random() < 0.5 ? 'câu' : 'câu cá' });
    else if (r < 78) this.emit({ type: 'LIKE', user, likeCount: 5 + Math.floor(Math.random() * 30) });
    else if (r < 88) {
      let w = Math.random() * GIFTS.reduce((s, g) => s + g.weight, 0);
      const gift = GIFTS.find((g) => (w -= g.weight) <= 0) ?? GIFTS[0];
      this.emit({ type: 'GIFT', user, giftName: gift.name, diamonds: gift.diamonds, repeatCount: gift.diamonds < 10 ? 1 + Math.floor(Math.random() * 3) : 1 });
    } else if (r < 94) this.emit({ type: 'FOLLOW', user });
    else if (r < 98) this.emit({ type: 'SHARE', user });
    else this.emit({ type: 'COMMENT', user, comment: 'top' });
  }

  start(eventsPerMinute = this.rate) {
    this.stop();
    this.rate = Math.max(1, Math.min(600, eventsPerMinute));
    const interval = 60_000 / this.rate;
    this.timer = setInterval(() => this.step(), interval);
    this.connectors.setMockAuto(true);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.connectors.setMockAuto(false);
  }
}
