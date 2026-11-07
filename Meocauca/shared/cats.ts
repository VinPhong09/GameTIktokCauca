import type { CatAppearance, CatPattern, HatType } from './types';

interface CatSeed {
  id: string;
  name: string;
  breed: string;
  pattern: CatPattern;
  body: string;
  belly: string;
  muzzle?: string;
  ear?: string;
  paw?: string;
  tail?: string;
  tailTip?: string;
  eye: string;
  a?: string;
  b?: string;
  folded?: boolean;
  fluffy?: boolean;
  vest: string;
  trim: string;
  hat: HatType;
  hatColor: string;
  rod: string;
  whisker?: string;
}

function cat(s: CatSeed): CatAppearance {
  return {
    id: s.id,
    name: s.name,
    breed: s.breed,
    pattern: s.pattern,
    colors: {
      body: s.body,
      belly: s.belly,
      muzzle: s.muzzle ?? s.belly,
      ear: s.ear ?? s.body,
      earInner: '#ffb3c1',
      paw: s.paw ?? s.belly,
      tail: s.tail ?? s.body,
      tailTip: s.tailTip ?? s.tail ?? s.body,
      eye: s.eye,
      nose: '#ff8fa3',
      patternA: s.a ?? s.body,
      patternB: s.b ?? s.body,
      whisker: s.whisker ?? '#ffffff',
    },
    foldedEars: s.folded,
    fluffy: s.fluffy,
    outfit: { vest: s.vest, trim: s.trim, hat: s.hat, hatColor: s.hatColor, rod: s.rod },
    model: null,
  };
}

/** 24 cute cat appearances (10 breeds + outfit variants). */
export const DEFAULT_CATS: CatAppearance[] = [
  cat({ id: 'orange-tabby', name: 'Cam Mập', breed: 'Orange tabby', pattern: 'tabby', body: '#f39a3d', belly: '#ffe3c2', a: '#c9661a', eye: '#3fae5a', vest: '#2f8f5b', trim: '#f6d365', hat: 'bucket', hatColor: '#f6d365', rod: '#b5733c' }),
  cat({ id: 'white', name: 'Bông Tuyết', breed: 'White', pattern: 'solid', body: '#fbfbfb', belly: '#ffffff', ear: '#f4f4f4', eye: '#4aa3df', vest: '#e85d75', trim: '#ffffff', hat: 'straw', hatColor: '#e9c46a', rod: '#8d5524', whisker: '#c9c9c9' }),
  cat({ id: 'black', name: 'Mực', breed: 'Black', pattern: 'solid', body: '#2b2b33', belly: '#3a3a44', muzzle: '#3a3a44', eye: '#f4d03f', vest: '#f28c28', trim: '#ffe08a', hat: 'cap', hatColor: '#f28c28', rod: '#4b8bbe' }),
  cat({ id: 'british-gray', name: 'Xám Bự', breed: 'British Shorthair', pattern: 'solid', body: '#8e99a8', belly: '#b7c0cc', eye: '#f39c12', fluffy: true, vest: '#3d5a80', trim: '#e0fbfc', hat: 'beanie', hatColor: '#ee6c4d', rod: '#6d4c41' }),
  cat({ id: 'calico', name: 'Tam Thể', breed: 'Calico', pattern: 'calico', body: '#fffaf2', belly: '#ffffff', a: '#e3892f', b: '#3b3434', eye: '#58b368', vest: '#7b6cf6', trim: '#fff1a8', hat: 'bucket', hatColor: '#ffd6e0', rod: '#a0522d', whisker: '#bbbbbb' }),
  cat({ id: 'siamese', name: 'Xiêm', breed: 'Siamese', pattern: 'points', body: '#f3e6d0', belly: '#fbf4e8', muzzle: '#5a4337', ear: '#5a4337', paw: '#5a4337', tail: '#5a4337', eye: '#3b82f6', vest: '#14b8a6', trim: '#fef3c7', hat: 'none', hatColor: '#ffffff', rod: '#7c4a2d' }),
  cat({ id: 'scottish-fold', name: 'Tai Cụp', breed: 'Scottish Fold', pattern: 'solid', body: '#c9b8a6', belly: '#efe3d4', eye: '#d97706', folded: true, fluffy: true, vest: '#ef476f', trim: '#ffd166', hat: 'cap', hatColor: '#118ab2', rod: '#8b5e3c' }),
  cat({ id: 'ragdoll', name: 'Búp Bê', breed: 'Ragdoll', pattern: 'points', body: '#f7f1e8', belly: '#ffffff', muzzle: '#8a7a6c', ear: '#7b6a5c', paw: '#ffffff', tail: '#8a7a6c', eye: '#2563eb', fluffy: true, vest: '#a78bfa', trim: '#fde68a', hat: 'straw', hatColor: '#f4d58d', rod: '#9c6644' }),
  cat({ id: 'tuxedo', name: 'Lịch Lãm', breed: 'Tuxedo', pattern: 'tuxedo', body: '#26262e', belly: '#ffffff', muzzle: '#ffffff', paw: '#ffffff', eye: '#84cc16', vest: '#dc2626', trim: '#fde047', hat: 'cap', hatColor: '#111827', rod: '#64748b' }),
  cat({ id: 'cream', name: 'Kem Sữa', breed: 'Cream', pattern: 'tabby', body: '#f6dcb0', belly: '#fff4e0', a: '#e5bd85', eye: '#c27c0e', vest: '#06b6d4', trim: '#fff', hat: 'bucket', hatColor: '#fda4af', rod: '#b07d4f' }),
  // ---- variants ----
  cat({ id: 'ginger-sailor', name: 'Gừng Thủy Thủ', breed: 'Orange tabby', pattern: 'tabby', body: '#ee8a2c', belly: '#fff0dc', a: '#b85c13', eye: '#16a34a', vest: '#1d4ed8', trim: '#ffffff', hat: 'cap', hatColor: '#ffffff', rod: '#ca8a04' }),
  cat({ id: 'snow-princess', name: 'Công Chúa Tuyết', breed: 'White', pattern: 'solid', body: '#ffffff', belly: '#fff7fb', eye: '#e879f9', fluffy: true, vest: '#f9a8d4', trim: '#fdf4ff', hat: 'beanie', hatColor: '#f472b6', rod: '#c084fc', whisker: '#d4d4d4' }),
  cat({ id: 'shadow-ninja', name: 'Ninja Đêm', breed: 'Black', pattern: 'solid', body: '#1f1f27', belly: '#2d2d38', muzzle: '#2d2d38', eye: '#22d3ee', vest: '#6d28d9', trim: '#a78bfa', hat: 'beanie', hatColor: '#111827', rod: '#0ea5e9' }),
  cat({ id: 'silver-tabby', name: 'Bạc Vằn', breed: 'Silver tabby', pattern: 'tabby', body: '#b9c2cc', belly: '#eef2f6', a: '#4b5563', eye: '#65a30d', vest: '#ea580c', trim: '#fed7aa', hat: 'straw', hatColor: '#eab308', rod: '#78350f' }),
  cat({ id: 'calico-chef', name: 'Tam Thể Nhỏ', breed: 'Calico', pattern: 'calico', body: '#ffffff', belly: '#ffffff', a: '#d97736', b: '#2f2a2a', eye: '#ca8a04', vest: '#10b981', trim: '#ecfccb', hat: 'cap', hatColor: '#f43f5e', rod: '#92400e', whisker: '#bdbdbd' }),
  cat({ id: 'blue-siamese', name: 'Xiêm Xanh', breed: 'Siamese', pattern: 'points', body: '#e8ebf2', belly: '#f8fafc', muzzle: '#5b6b86', ear: '#5b6b86', paw: '#5b6b86', tail: '#5b6b86', eye: '#60a5fa', vest: '#f59e0b', trim: '#fff7ed', hat: 'bucket', hatColor: '#93c5fd', rod: '#57534e' }),
  cat({ id: 'fold-latte', name: 'Latte Cụp', breed: 'Scottish Fold', pattern: 'tabby', body: '#d6b48a', belly: '#f5e6cf', a: '#9c7346', eye: '#b45309', folded: true, vest: '#8b5cf6', trim: '#ede9fe', hat: 'none', hatColor: '#fff', rod: '#a16207' }),
  cat({ id: 'ragdoll-blue', name: 'Mây Xanh', breed: 'Ragdoll', pattern: 'points', body: '#f1f3f7', belly: '#ffffff', muzzle: '#7d8aa3', ear: '#6b7891', paw: '#ffffff', tail: '#7d8aa3', eye: '#1d4ed8', fluffy: true, vest: '#fb7185', trim: '#ffe4e6', hat: 'beanie', hatColor: '#60a5fa', rod: '#7c2d12' }),
  cat({ id: 'tuxedo-captain', name: 'Thuyền Trưởng', breed: 'Tuxedo', pattern: 'tuxedo', body: '#2a2a33', belly: '#ffffff', muzzle: '#ffffff', paw: '#ffffff', eye: '#facc15', vest: '#0f766e', trim: '#fde68a', hat: 'bucket', hatColor: '#f8fafc', rod: '#a3a3a3' }),
  cat({ id: 'cream-puff', name: 'Bánh Su', breed: 'Cream', pattern: 'solid', body: '#fbe7c6', belly: '#fffaf0', eye: '#0891b2', fluffy: true, vest: '#f472b6', trim: '#fff', hat: 'straw', hatColor: '#facc15', rod: '#be9b7b' }),
  cat({ id: 'tortie', name: 'Đồi Mồi', breed: 'Tortoiseshell', pattern: 'calico', body: '#4a3530', belly: '#6b4b3e', a: '#d9822b', b: '#2a1d1a', eye: '#eab308', vest: '#38bdf8', trim: '#e0f2fe', hat: 'cap', hatColor: '#fbbf24', rod: '#6b4423' }),
  cat({ id: 'bengal', name: 'Báo Gấm', breed: 'Bengal', pattern: 'spotted', body: '#e0a85a', belly: '#fff1d6', a: '#6b3f1d', eye: '#16a34a', vest: '#166534', trim: '#bbf7d0', hat: 'bucket', hatColor: '#a3e635', rod: '#854d0e' }),
  cat({ id: 'cow-cat', name: 'Bò Sữa', breed: 'Bicolor', pattern: 'bicolor', body: '#ffffff', belly: '#ffffff', a: '#2b2b2b', eye: '#84cc16', vest: '#e11d48', trim: '#fecdd3', hat: 'straw', hatColor: '#fcd34d', rod: '#78716c', whisker: '#bbbbbb' }),
  cat({ id: 'russian-blue', name: 'Lam Nga', breed: 'Russian Blue', pattern: 'solid', body: '#6f7f99', belly: '#8b9ab3', eye: '#22c55e', vest: '#fbbf24', trim: '#fffbeb', hat: 'beanie', hatColor: '#f97316', rod: '#57534e' }),
];

export function getCat(cats: CatAppearance[], id: string): CatAppearance {
  return cats.find((c) => c.id === id) ?? cats[0] ?? DEFAULT_CATS[0];
}
