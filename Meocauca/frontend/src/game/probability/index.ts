// The probability system lives in /shared so the backend (authoritative rolls) and the
// admin dashboard (live preview) use exactly the same algorithm.
export {
  computeRarityDistribution,
  fishProbabilityTable,
  baseProbabilityTotal,
  combineLuck,
} from '@shared/probability';

export function pct(v: number, digits = 2): string {
  const p = v * 100;
  if (p > 0 && p < 0.01) return '<0.01%';
  return p.toFixed(p >= 10 ? 1 : digits) + '%';
}
