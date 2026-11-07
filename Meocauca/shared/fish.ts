import type { FishDef, FishEffect, FishVisual, Rarity } from './types';

function fish(
  id: string,
  name: string,
  nameVi: string,
  rarity: Rarity,
  weight: [number, number],
  baseChance: number,
  effect: FishEffect,
  visual: FishVisual,
  extra: Partial<FishDef> = {},
): FishDef {
  return {
    id,
    name,
    nameVi,
    rarity,
    weightMin: weight[0],
    weightMax: weight[1],
    baseChance,
    weightMultiplier: 1,
    scorePerKg: 0,
    effect,
    visual,
    enabled: true,
    eventOnly: null,
    model: null,
    ...extra,
  };
}

/** 24 original fish designs across 5 rarities. */
export const DEFAULT_FISH: FishDef[] = [
  // ------------------------------------------------------------ COMMON (5)
  fish('small-carp', 'Small Carp', 'Cá Chép Nhỏ', 'common', [0.3, 2.5], 30, 'none',
    { shape: 'carp', bodyColor: '#b7a36a', bellyColor: '#efe2b8', accentColor: '#8a7a45', finColor: '#c98c4a', pattern: 'scales' }),
  fish('tilapia', 'Tilapia', 'Cá Rô Phi', 'common', [0.4, 3], 28, 'none',
    { shape: 'round', bodyColor: '#7c8a8f', bellyColor: '#d9e1e2', accentColor: '#4b5a60', finColor: '#c05b5b', pattern: 'stripes' }),
  fish('small-goldfish', 'Small Goldfish', 'Cá Vàng Nhỏ', 'common', [0.3, 1.5], 20, 'none',
    { shape: 'round', bodyColor: '#ff9d2e', bellyColor: '#ffd59a', accentColor: '#ff6a00', finColor: '#ffb35c', pattern: 'gradient', extras: ['longFins'], scale: 0.85 }),
  fish('river-minnow', 'River Minnow', 'Cá Lòng Tong', 'common', [0.3, 1.2], 25, 'none',
    { shape: 'slim', bodyColor: '#9fb7c4', bellyColor: '#f1f5f9', accentColor: '#3f6b82', finColor: '#b9c9d3', pattern: 'stripes', scale: 0.8 }),
  fish('small-catfish', 'Small Catfish', 'Cá Trê Nhỏ', 'common', [0.5, 3], 18, 'none',
    { shape: 'catfish', bodyColor: '#5d5145', bellyColor: '#b8a990', accentColor: '#3b332b', finColor: '#6e6153', pattern: 'spots', extras: ['whiskers'] }),
  // ------------------------------------------------------------ UNCOMMON (5)
  fish('large-carp', 'Large Carp', 'Cá Chép Lớn', 'uncommon', [2, 10], 26, 'sparkle',
    { shape: 'carp', bodyColor: '#c4a24a', bellyColor: '#f6e7b2', accentColor: '#8c6a1d', finColor: '#d97a2b', pattern: 'scales', scale: 1.15 }),
  fish('red-koi', 'Red Koi', 'Cá Koi Đỏ', 'uncommon', [2, 8], 22, 'sparkle',
    { shape: 'koi', bodyColor: '#ffffff', bellyColor: '#fff6f0', accentColor: '#e63946', finColor: '#ffd1d1', pattern: 'koi' }),
  fish('blue-koi', 'Blue Koi', 'Cá Koi Xanh', 'uncommon', [2, 8], 18, 'sparkle',
    { shape: 'koi', bodyColor: '#e9f3ff', bellyColor: '#ffffff', accentColor: '#2b6cb0', finColor: '#bcdcff', pattern: 'koi' }),
  fish('silver-fish', 'Silver Fish', 'Cá Bạc', 'uncommon', [2, 7], 20, 'sparkle',
    { shape: 'slim', bodyColor: '#cfd8e3', bellyColor: '#ffffff', accentColor: '#8fa3b8', finColor: '#e2e8f0', pattern: 'scales', emissive: '#99aabb', emissiveIntensity: 0.15 }),
  fish('striped-fish', 'Striped Fish', 'Cá Sọc Vằn', 'uncommon', [2, 9], 18, 'sparkle',
    { shape: 'round', bodyColor: '#ffd23f', bellyColor: '#fff3b0', accentColor: '#1f2937', finColor: '#ffb703', pattern: 'stripes' }),
  // ------------------------------------------------------------ RARE (5)
  fish('golden-koi', 'Golden Koi', 'Cá Koi Vàng Kim', 'rare', [5, 25], 22, 'glow',
    { shape: 'koi', bodyColor: '#ffd700', bellyColor: '#fff2a8', accentColor: '#ff9f1c', finColor: '#ffe680', pattern: 'koi', emissive: '#ffbf00', emissiveIntensity: 0.35, extras: ['longFins'] }),
  fish('crystal-fish', 'Crystal Fish', 'Cá Pha Lê', 'rare', [5, 20], 18, 'glow',
    { shape: 'crystal', bodyColor: '#a5f3fc', bellyColor: '#e0fbff', accentColor: '#67e8f9', finColor: '#cffafe', pattern: 'gradient', emissive: '#38bdf8', emissiveIntensity: 0.45, opacity: 0.85, extras: ['crystalSpikes'] }),
  fish('rainbow-trout', 'Rainbow Trout', 'Cá Hồi Cầu Vồng', 'rare', [5, 30], 22, 'glow',
    { shape: 'trout', bodyColor: '#9bb48a', bellyColor: '#f8e1e7', accentColor: '#ff6fa3', finColor: '#c2d6a4', pattern: 'rainbow', emissive: '#ff8fb8', emissiveIntensity: 0.2 }),
  fish('electric-blue', 'Electric Blue Fish', 'Cá Điện Xanh', 'rare', [5, 22], 20, 'glow',
    { shape: 'slim', bodyColor: '#1d4ed8', bellyColor: '#93c5fd', accentColor: '#22d3ee', finColor: '#60a5fa', pattern: 'stripes', emissive: '#3b82f6', emissiveIntensity: 0.55 }),
  fish('butterfly-koi', 'Rare Butterfly Koi', 'Cá Koi Bướm', 'rare', [5, 18], 18, 'glow',
    { shape: 'butterfly', bodyColor: '#fff7ed', bellyColor: '#ffffff', accentColor: '#f97316', finColor: '#fed7aa', pattern: 'koi', emissive: '#fb923c', emissiveIntensity: 0.25, extras: ['longFins'] }),
  // ------------------------------------------------------------ EPIC (4)
  fish('glowing-dragon-koi', 'Glowing Dragon Koi', 'Rồng Koi Phát Sáng', 'epic', [20, 80], 28, 'aura',
    { shape: 'dragon', bodyColor: '#ff4d6d', bellyColor: '#ffe5ec', accentColor: '#ffd166', finColor: '#ff8fab', pattern: 'scales', emissive: '#ff2e63', emissiveIntensity: 0.6, extras: ['horns', 'whiskers', 'mane'] }),
  fish('crystal-dragon', 'Crystal Dragon Fish', 'Cá Rồng Pha Lê', 'epic', [25, 90], 24, 'aura',
    { shape: 'crystal', bodyColor: '#c4b5fd', bellyColor: '#ede9fe', accentColor: '#8b5cf6', finColor: '#ddd6fe', pattern: 'gradient', emissive: '#8b5cf6', emissiveIntensity: 0.7, opacity: 0.88, extras: ['horns', 'crystalSpikes'], scale: 1.2 }),
  fish('magic-rainbow', 'Magical Rainbow Fish', 'Cá Cầu Vồng Phép Thuật', 'epic', [20, 70], 26, 'aura',
    { shape: 'round', bodyColor: '#f472b6', bellyColor: '#fdf2f8', accentColor: '#60a5fa', finColor: '#fde047', pattern: 'rainbow', emissive: '#e879f9', emissiveIntensity: 0.55, extras: ['longFins'] }),
  fish('golden-dragon', 'Golden Dragon Fish', 'Cá Rồng Vàng', 'epic', [30, 100], 22, 'aura',
    { shape: 'dragon', bodyColor: '#f6c344', bellyColor: '#fff4c2', accentColor: '#c47f00', finColor: '#ffe08a', pattern: 'scales', emissive: '#ffb703', emissiveIntensity: 0.65, extras: ['horns', 'whiskers', 'mane'], scale: 1.15 }),
  // ------------------------------------------------------------ LEGENDARY (5)
  fish('celestial-dragon-koi', 'Celestial Dragon Koi', 'Rồng Koi Thiên Giới', 'legendary', [80, 300], 20, 'legendary',
    { shape: 'dragon', bodyColor: '#e0f2fe', bellyColor: '#ffffff', accentColor: '#38bdf8', finColor: '#bae6fd', pattern: 'koi', emissive: '#7dd3fc', emissiveIntensity: 0.9, extras: ['horns', 'whiskers', 'mane', 'halo'], scale: 1.35 }),
  fish('rainbow-phoenix', 'Rainbow Phoenix Fish', 'Cá Phượng Hoàng Cầu Vồng', 'legendary', [60, 250], 20, 'legendary',
    { shape: 'phoenix', bodyColor: '#ff7849', bellyColor: '#fff1e6', accentColor: '#ffd23f', finColor: '#ff4d6d', pattern: 'rainbow', emissive: '#ff6b35', emissiveIntensity: 0.9, extras: ['wings', 'longFins', 'crown'], scale: 1.3 }),
  fish('golden-emperor', 'Golden Emperor Fish', 'Cá Hoàng Đế Vàng', 'legendary', [100, 300], 20, 'legendary',
    { shape: 'emperor', bodyColor: '#ffcf33', bellyColor: '#fff6cc', accentColor: '#b8860b', finColor: '#ffe066', pattern: 'scales', emissive: '#ffc300', emissiveIntensity: 1.0, extras: ['crown', 'longFins'], scale: 1.35 }),
  fish('ancient-spirit', 'Ancient Spirit Fish', 'Cá Linh Hồn Cổ Đại', 'legendary', [50, 220], 20, 'legendary',
    { shape: 'spirit', bodyColor: '#99f6e4', bellyColor: '#f0fdfa', accentColor: '#14b8a6', finColor: '#5eead4', pattern: 'gradient', emissive: '#2dd4bf', emissiveIntensity: 1.1, opacity: 0.75, extras: ['longFins', 'halo'], scale: 1.3 }),
  fish('mythical-moon', 'Mythical Moon Fish', 'Cá Mặt Trăng Huyền Thoại', 'legendary', [70, 280], 20, 'legendary',
    { shape: 'moon', bodyColor: '#f1f5f9', bellyColor: '#ffffff', accentColor: '#c7d2fe', finColor: '#e0e7ff', pattern: 'gradient', emissive: '#c7d2fe', emissiveIntensity: 1.0, extras: ['crescent', 'longFins'], scale: 1.35 }),
];

export function getFish(list: FishDef[], id: string | null | undefined): FishDef | undefined {
  if (!id) return undefined;
  return list.find((f) => f.id === id);
}
