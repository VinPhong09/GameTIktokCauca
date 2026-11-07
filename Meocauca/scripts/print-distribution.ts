// Prints the default rarity distribution for several luck values.
// Usage (from repo root): node backend/node_modules/tsx/dist/cli.mjs scripts/print-distribution.ts
import { DEFAULT_CONFIG } from '../shared/defaults';
import { computeRarityDistribution } from '../shared/probability';

for (const luck of [1, 1.15, 1.5, 2, 2.5, 3, 5]) {
  const d = computeRarityDistribution(DEFAULT_CONFIG.rarities, { luck });
  console.log(`x${luck}`.padEnd(6), Object.entries(d).map(([k, v]) => `${k} ${(v * 100).toFixed(2)}%`).join(' | '));
}
