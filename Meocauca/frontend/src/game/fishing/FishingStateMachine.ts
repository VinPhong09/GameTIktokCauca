import type { FishingCycleDTO } from '@shared/types';

export type FishingState = 'IDLE' | 'CAST' | 'WAITING' | 'BITE' | 'PULL' | 'CATCH' | 'RESULT' | 'CELEBRATE' | 'RETURN' | 'FAIL';

interface Segment {
  state: FishingState;
  start: number;
  dur: number;
}

/**
 * Deterministic state machine driven by the server's timeline – animations always
 * reflect the real, pre-rolled result (no random, disconnected animations).
 *
 *   IDLE → CAST → WAITING → BITE → PULL → CATCH → RESULT → CELEBRATE → RETURN → IDLE
 *                                        ↘ FAIL ──────────────────────→ RETURN
 *
 * Time is wall-clock based, so the animation stays in sync with the server even when the
 * browser throttles frames (hidden OBS source, background tab).
 */
export class FishingStateMachine {
  state: FishingState = 'IDLE';
  /** Seconds spent in the current state. */
  t = 0;
  dur = Infinity;
  cycle: FishingCycleDTO | null = null;
  private segments: Segment[] = [];
  private idx = -1;
  private startedAt = 0;
  /** Called on every state entry; `silent` = skipped over (no one-shot effects). */
  onEnter: (state: FishingState, silent: boolean) => void = () => {};

  get progress() {
    return this.dur === Infinity ? 0 : Math.min(1, this.t / this.dur);
  }

  get active() {
    return this.state !== 'IDLE';
  }

  start(cycle: FishingCycleDTO, now = performance.now()) {
    const tl = cycle.timeline;
    const s = (v: number) => Math.max(0, v) / 1000;
    this.cycle = cycle;
    const list: { state: FishingState; dur: number }[] = cycle.success
      ? (() => {
          const catchDur = Math.min(1.3, s(tl.resultMs) * 0.4);
          return [
            { state: 'CAST', dur: s(tl.castMs) },
            { state: 'WAITING', dur: s(tl.waitMs) },
            { state: 'BITE', dur: s(tl.biteMs) },
            { state: 'PULL', dur: s(tl.pullMs) },
            { state: 'CATCH', dur: catchDur },
            { state: 'RESULT', dur: s(tl.resultMs) - catchDur },
            { state: 'CELEBRATE', dur: s(tl.celebrateMs) },
            { state: 'RETURN', dur: s(tl.returnMs) },
          ];
        })()
      : [
          { state: 'CAST', dur: s(tl.castMs) },
          { state: 'WAITING', dur: s(tl.waitMs) },
          { state: 'BITE', dur: s(tl.biteMs) },
          { state: 'PULL', dur: s(tl.pullMs) },
          { state: 'FAIL', dur: s(tl.resultMs) + s(tl.celebrateMs) },
          { state: 'RETURN', dur: s(tl.returnMs) },
        ];
    let acc = 0;
    this.segments = list
      .filter((x) => x.dur > 0)
      .map((x) => {
        const seg = { ...x, start: acc };
        acc += x.dur;
        return seg;
      });
    this.idx = -1;
    this.startedAt = now - cycle.elapsedMs;
    this.advance(now, cycle.elapsedMs > 250);
  }

  private advance(now: number, catchUpSilently: boolean) {
    const el = (now - this.startedAt) / 1000;
    let target = this.segments.findIndex((seg) => el < seg.start + seg.dur);
    if (target === -1) {
      // Past the end: run the remaining entries silently, then go idle.
      for (let i = this.idx + 1; i < this.segments.length; i++) this.onEnter(this.segments[i].state, true);
      this.reset();
      return;
    }
    if (target < this.idx) target = this.idx;
    for (let i = this.idx + 1; i <= target; i++) {
      const seg = this.segments[i];
      this.idx = i;
      this.state = seg.state;
      this.dur = seg.dur;
      // Intermediate states we jumped over are silent; the current one plays its effects
      // unless we are restoring a snapshot that is already well into this state.
      const isCurrent = i === target;
      const lateIntoState = el - seg.start > 0.4;
      this.onEnter(seg.state, !isCurrent || (catchUpSilently && lateIntoState));
    }
    const seg = this.segments[this.idx];
    this.t = el - seg.start;
  }

  reset() {
    this.state = 'IDLE';
    this.dur = Infinity;
    this.t = 0;
    this.idx = -1;
    this.cycle = null;
    this.segments = [];
    this.onEnter('IDLE', false);
  }

  update(now = performance.now()) {
    if (!this.segments.length) return;
    this.advance(now, false);
  }
}
