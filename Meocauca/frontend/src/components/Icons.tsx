import { useEffect, useState } from 'react';
import type { CatAppearance, FishDef } from '@shared/types';
import { getCat } from '@shared/cats';
import { IconRenderer } from '../game/fish/IconRenderer';
import { useGameStore } from '../services/store';

function useIconTick() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const off = IconRenderer.onUpdate(() => setTick((t) => t + 1));
    return () => {
      off();
    };
  }, []);
}

export function FishIcon({ fish, size = 64, className = '' }: { fish: FishDef | undefined; size?: number; className?: string }) {
  useIconTick();
  const url = fish ? IconRenderer.fish(fish) : undefined;
  return (
    <div className={`shrink-0 ${className}`} style={{ width: size, height: size }}>
      {url ? <img src={url} width={size} height={size} alt={fish?.nameVi} draggable={false} /> : <div className="h-full w-full animate-pulse rounded-full bg-sky-200/40" />}
    </div>
  );
}

export function CatAvatar({ catId, cat, size = 64, className = '' }: { catId?: string; cat?: CatAppearance; size?: number; className?: string }) {
  useIconTick();
  const cats = useGameStore((s) => s.config?.cats);
  const appearance = cat ?? (cats && catId ? getCat(cats, catId) : undefined);
  const url = appearance ? IconRenderer.cat(appearance) : undefined;
  return (
    <div className={`shrink-0 overflow-hidden rounded-full ${className}`} style={{ width: size, height: size, background: appearance ? `radial-gradient(circle at 50% 35%, #ffffff, ${appearance.outfit.vest}55)` : '#e2e8f0' }}>
      {url && <img src={url} width={size} height={size} alt={appearance?.name} draggable={false} />}
    </div>
  );
}
