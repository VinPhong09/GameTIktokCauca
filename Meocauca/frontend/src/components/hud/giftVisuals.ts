import type { GiftRule, GiftTier } from '@shared/types';
import { normalizeText } from '@shared/text';

const BY_ID: Record<string, string> = {
  rose: '🌹',
  'finger-heart': '🫰',
  doughnut: '🍩',
  'hand-heart': '🫶',
  'large-gift': '🎁',
};

const BY_NAME: [RegExp, string][] = [
  [/rose|hoa hong/, '🌹'],
  [/finger|ngon tay/, '🫰'],
  [/donut|doughnut/, '🍩'],
  [/hand heart|trai tim tay/, '🫶'],
  [/galaxy|universe|nebula/, '🌌'],
  [/lion/, '🦁'],
  [/rocket/, '🚀'],
  [/whale/, '🐋'],
  [/car/, '🏎️'],
  [/heart|tim/, '💖'],
];

/** Emoji shown for a gift rule (by id, then by name keywords). */
export function giftEmoji(g: Pick<GiftRule, 'id' | 'giftName'>): string {
  if (BY_ID[g.id]) return BY_ID[g.id];
  const n = normalizeText(g.giftName);
  return BY_NAME.find(([re]) => re.test(n))?.[1] ?? '🎁';
}

export const TIER_STYLE: Record<GiftTier, { ring: string; label: string }> = {
  small: { ring: 'linear-gradient(135deg,#fecdd3,#fb7185)', label: 'Nhỏ' },
  medium: { ring: 'linear-gradient(135deg,#bae6fd,#38bdf8)', label: 'Vừa' },
  large: { ring: 'linear-gradient(135deg,#ddd6fe,#a855f7)', label: 'Lớn' },
  mega: { ring: 'linear-gradient(135deg,#fde68a,#f59e0b,#ef4444)', label: 'Siêu lớn' },
};

export function formatLuck(v: number): string {
  return 'x' + (Math.round(v * 100) / 100).toString();
}

export function formatDuration(sec: number): string {
  if (sec <= 0) return '';
  if (sec < 60) return `${Math.round(sec)} giây`;
  return `${Math.round(sec / 60)} phút`;
}
