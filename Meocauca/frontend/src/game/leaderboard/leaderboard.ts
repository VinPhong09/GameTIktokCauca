import type { LeaderboardCategory } from '@shared/types';
import { formatKg } from '@shared/text';

export const CATEGORY_LABEL: Record<LeaderboardCategory, string> = {
  weight: 'Tổng cân nặng',
  largest: 'Cá to nhất',
  count: 'Nhiều cá nhất',
  rare: 'Cá Hiếm',
  epic: 'Cá Sử Thi',
  legendary: 'Cá Huyền Thoại',
};

export const CATEGORY_ICON: Record<LeaderboardCategory, string> = {
  weight: '⚖️',
  largest: '🐋',
  count: '🐟',
  rare: '💎',
  epic: '✨',
  legendary: '🌟',
};

export function formatValue(cat: LeaderboardCategory, v: number): string {
  if (cat === 'weight' || cat === 'largest') return formatKg(v);
  return `${v} con`;
}

export const MEDAL = ['🥇', '🥈', '🥉'];
