// Minimal tween / easing toolkit used by camera, cats, fish and effects.
export const Ease = {
  linear: (t: number) => t,
  inQuad: (t: number) => t * t,
  outQuad: (t: number) => t * (2 - t),
  inOutQuad: (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
  outCubic: (t: number) => 1 - Math.pow(1 - t, 3),
  inOutCubic: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outBack: (t: number) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  outElastic: (t: number) => (t === 0 || t === 1 ? t : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1),
  outBounce: (t: number) => {
    const n1 = 7.5625;
    const d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
    if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  },
};

export const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** Frame-rate independent exponential smoothing. */
export const damp = (current: number, target: number, lambda: number, dt: number) => lerp(current, target, 1 - Math.exp(-lambda * dt));
/** Map t from [a,b] to [0,1] clamped. */
export const segment = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));

interface TweenItem {
  elapsed: number;
  duration: number;
  ease: (t: number) => number;
  onUpdate: (v: number) => void;
  onComplete?: () => void;
}

export class TweenManager {
  private items: TweenItem[] = [];

  add(duration: number, onUpdate: (v: number) => void, opts: { ease?: (t: number) => number; onComplete?: () => void } = {}) {
    const item: TweenItem = { elapsed: 0, duration: Math.max(0.001, duration), ease: opts.ease ?? Ease.outCubic, onUpdate, onComplete: opts.onComplete };
    this.items.push(item);
    onUpdate(item.ease(0));
    return () => {
      this.items = this.items.filter((i) => i !== item);
    };
  }

  update(dt: number) {
    if (!this.items.length) return;
    const done: TweenItem[] = [];
    for (const it of this.items) {
      it.elapsed += dt;
      const t = clamp01(it.elapsed / it.duration);
      it.onUpdate(it.ease(t));
      if (t >= 1) done.push(it);
    }
    if (done.length) {
      this.items = this.items.filter((i) => !done.includes(i));
      for (const d of done) d.onComplete?.();
    }
  }
}
