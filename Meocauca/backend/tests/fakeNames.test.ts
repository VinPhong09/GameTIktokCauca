import { describe, expect, it } from 'vitest';
import { randomViewer } from '../src/services/fakeNames';

describe('simulated viewer names', () => {
  const viewers = Array.from({ length: 600 }, () => randomViewer());

  it('look like real TikTok accounts', () => {
    for (const v of viewers) {
      expect(v.nickname.trim().length).toBeGreaterThan(0);
      expect([...v.nickname].length).toBeLessThanOrEqual(30);
      expect(v.uniqueId).toMatch(/^[a-z0-9._]{1,24}$/);
      expect(v.userId).toMatch(/^7\d{18}$/);
      expect(v.bot).toBe(true);
    }
  });

  it('are varied (no obvious bot pattern)', () => {
    expect(new Set(viewers.map((v) => v.nickname)).size).toBeGreaterThan(300);
    expect(new Set(viewers.map((v) => v.userId)).size).toBe(viewers.length);
    expect(viewers.some((v) => /^user\d{10}$/.test(v.nickname))).toBe(true);
    expect(viewers.some((v) => /[À-ỹ]/.test(v.nickname))).toBe(true);
  });
});
