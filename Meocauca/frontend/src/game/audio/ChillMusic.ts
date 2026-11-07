import type { Rarity } from '@shared/types';

/**
 * Procedural lo-fi / chill background music, generated live with the Web Audio API.
 *
 * Every note is synthesized in the browser (electric piano, warm pad, soft bass,
 * brushed drums, kalimba melody, vinyl crackle + pond water ambience) – there are no
 * audio files, so the music is 100% original and free of any copyright claim.
 * Chord progressions, sections, key and melody are re-chosen as it plays, so the
 * stream never hears the same loop twice.
 */

const midiToFreq = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const chance = (p: number) => Math.random() < p;
const pick = <T>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

const QUALITY = {
  maj7: [0, 4, 7, 11],
  maj9: [0, 4, 7, 11, 14],
  add9: [0, 4, 7, 14],
  m7: [0, 3, 7, 10],
  m9: [0, 3, 7, 10, 14],
  m11: [0, 3, 7, 10, 14, 17],
  dom9: [0, 4, 10, 14],
  sus: [0, 5, 7, 10, 14],
} as const;
type Quality = keyof typeof QUALITY;
/** [root offset from the key tonic, chord quality] */
type Chord = [number, Quality];

const PROGRESSIONS: Chord[][] = [
  [[0, 'maj9'], [9, 'm9'], [2, 'm9'], [7, 'sus']],
  [[5, 'maj7'], [4, 'm7'], [2, 'm9'], [0, 'maj9']],
  [[2, 'm9'], [7, 'dom9'], [0, 'maj9'], [9, 'm7']],
  [[0, 'maj7'], [5, 'maj9'], [0, 'add9'], [5, 'maj7']],
  [[9, 'm9'], [5, 'maj7'], [0, 'maj9'], [7, 'sus']],
  [[4, 'm7'], [9, 'm9'], [2, 'm11'], [7, 'sus']],
  [[5, 'maj9'], [7, 'sus'], [4, 'm7'], [9, 'm9']],
];
/** Tonic MIDI notes: F, D, G, E♭, E. */
const KEYS = [53, 50, 55, 51, 52];
const PENTATONIC = [0, 2, 4, 7, 9];

interface Section {
  drums: boolean;
  melody: boolean;
  bass: boolean;
  pad: boolean;
}
const INTRO: Section = { drums: false, melody: false, bass: true, pad: true };
const FORM: Section[] = [
  { drums: true, melody: false, bass: true, pad: true },
  { drums: true, melody: true, bass: true, pad: true },
  { drums: false, melody: true, bass: true, pad: true }, // breakdown
  { drums: true, melody: true, bass: true, pad: false },
  { drums: true, melody: false, bass: true, pad: true },
];
const BARS_PER_SECTION = 8;
const LOOKAHEAD = 1.6; // seconds scheduled ahead (survives timer throttling in background tabs)
const TIMER_MS = 200;

export interface MusicOptions {
  volume: number; // 0..1
  bpm: number;
  ambience: boolean;
}

type Listener = (locked: boolean) => void;

export class ChillMusic {
  private static instance: ChillMusic | null = null;
  static get(): ChillMusic {
    if (!ChillMusic.instance) ChillMusic.instance = new ChillMusic();
    return ChillMusic.instance;
  }

  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private bus!: GainNode;
  private warmth!: BiquadFilterNode;
  private reverbSend!: GainNode;
  private delaySend!: GainNode;
  private ambienceGain!: GainNode;
  private wobble!: GainNode;
  private delay!: DelayNode;
  private output!: DynamicsCompressorNode;
  private noise!: AudioBuffer;
  private timer: number | null = null;
  private stopToken = 0;

  private opts: MusicOptions = { volume: 0.35, bpm: 72, ambience: true };
  private playing = false;
  private muted = false;
  private ducked = false;
  private listeners = new Set<Listener>();

  // Composition state.
  private step = 0;
  private nextTime = 0;
  private key = KEYS[0];
  private progression = PROGRESSIONS[0];
  private section: Section = INTRO;
  private sectionIndex = -1;
  private keysPattern = 0;
  private melodyIdx = 7;

  // ----------------------------------------------------------------- public API
  isPlaying() {
    return this.playing;
  }

  /** True when playback was requested but the browser blocks audio until a click/tap. */
  isLocked() {
    return this.playing && !!this.ctx && this.ctx.state !== 'running';
  }

  onLockChange(fn: Listener) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  setOptions(o: Partial<MusicOptions>) {
    this.opts = { ...this.opts, ...o };
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    if (this.playing) this.glideMaster(0.3);
    this.ambienceGain.gain.setTargetAtTime(this.opts.ambience ? 1 : 0, t, 0.5);
    this.delay.delayTime.setTargetAtTime((60 / this.opts.bpm) * 0.75, t, 0.2);
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.ctx && this.playing) this.glideMaster(0.15);
  }

  /** Smoothly move the master volume to its target, replacing any pending fade. */
  private glideMaster(timeConstant: number) {
    const g = this.master.gain;
    const t = this.ctx!.currentTime;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.setTargetAtTime(this.targetGain(), t, timeConstant);
  }

  isMuted() {
    return this.muted;
  }

  start() {
    if (this.playing) return;
    this.ensureContext();
    const ctx = this.ctx!;
    this.playing = true;
    this.stopToken++;
    void ctx.resume().catch(() => undefined);
    const t = ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setValueAtTime(this.master.gain.value, t);
    this.master.gain.linearRampToValueAtTime(this.targetGain(), t + 3);
    if (this.timer === null) {
      this.resetComposition();
      this.nextTime = ctx.currentTime + 0.15;
      this.timer = window.setInterval(() => this.tick(), TIMER_MS);
      this.tick();
    }
    this.emitLock();
  }

  stop() {
    if (!this.playing || !this.ctx) return;
    this.playing = false;
    const ctx = this.ctx;
    const token = ++this.stopToken;
    const t = ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setValueAtTime(this.master.gain.value, t);
    this.master.gain.linearRampToValueAtTime(0, t + 1.5);
    window.setTimeout(() => {
      if (token !== this.stopToken) return; // restarted meanwhile
      if (this.timer !== null) window.clearInterval(this.timer);
      this.timer = null;
      void ctx.suspend().catch(() => undefined);
    }, 1700);
    this.emitLock();
  }

  /** Call from a user gesture (click / key) to satisfy the browser autoplay policy. */
  unlock() {
    if (this.ctx && this.playing && this.ctx.state !== 'running') void this.ctx.resume().catch(() => undefined);
  }

  /** Little sparkle on top of the music when a rare+ fish is caught. */
  chime(rarity: Rarity) {
    if (!this.ctx || !this.playing || this.ctx.state !== 'running') return;
    const count = rarity === 'legendary' ? 9 : rarity === 'epic' ? 6 : rarity === 'rare' ? 4 : 0;
    if (!count) return;
    const t = this.ctx.currentTime + 0.05;
    const base = this.key + 24;
    for (let i = 0; i < count; i++) {
      const deg = PENTATONIC[i % 5] + 12 * Math.floor(i / 5);
      this.bell(t + i * (rarity === 'legendary' ? 0.11 : 0.09), base + deg, 0.22, 1.6);
    }
    if (rarity === 'legendary') {
      const top = base + 24;
      this.bell(t + count * 0.11 + 0.1, top, 0.2, 2.5);
      this.bell(t + count * 0.11 + 0.1, top + 7, 0.14, 2.5);
    }
  }

  // ----------------------------------------------------------------- audio graph
  private targetGain() {
    if (this.muted) return 0;
    const v = Math.min(1, Math.max(0, this.opts.volume));
    return Math.pow(v, 1.6) * 1.0 * (this.ducked ? 0.3 : 1);
  }

  /** Lower the music while a voice announcement is playing. */
  duck(on: boolean) {
    if (this.ducked === on) return;
    this.ducked = on;
    if (this.ctx && this.playing) this.glideMaster(on ? 0.08 : 0.4);
  }

  private emitLock() {
    const locked = this.isLocked();
    for (const l of this.listeners) l(locked);
  }

  private ensureContext() {
    if (this.ctx) return;
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctor({ latencyHint: 'playback' });
    this.ctx = ctx;
    ctx.onstatechange = () => this.emitLock();

    this.master = ctx.createGain();
    this.master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -20;
    comp.ratio.value = 3;
    comp.attack.value = 0.02;
    comp.release.value = 0.25;
    this.warmth = ctx.createBiquadFilter();
    this.warmth.type = 'lowpass';
    this.warmth.frequency.value = 4200;
    this.warmth.Q.value = 0.4;
    this.bus = ctx.createGain();
    this.bus.gain.value = 0.9;
    // Final brick-wall-ish limiter so no volume setting can ever clip the stream audio.
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -3;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.002;
    limiter.release.value = 0.1;
    this.output = limiter;
    this.bus.connect(this.warmth).connect(comp).connect(this.master).connect(limiter).connect(ctx.destination);

    // Reverb (generated impulse response).
    const reverb = ctx.createConvolver();
    reverb.buffer = this.makeImpulse(2.8);
    this.reverbSend = ctx.createGain();
    this.reverbSend.gain.value = 0.55;
    this.reverbSend.connect(reverb).connect(this.bus);

    // Tape-ish echo with a darkening feedback loop.
    const delay = ctx.createDelay(2);
    this.delay = delay;
    delay.delayTime.value = (60 / this.opts.bpm) * 0.75;
    const fb = ctx.createGain();
    fb.gain.value = 0.32;
    const fbFilter = ctx.createBiquadFilter();
    fbFilter.type = 'lowpass';
    fbFilter.frequency.value = 2200;
    this.delaySend = ctx.createGain();
    this.delaySend.gain.value = 0.4;
    this.delaySend.connect(delay);
    delay.connect(fbFilter).connect(fb).connect(delay);
    fbFilter.connect(this.bus);

    // Slow pitch wobble (tape wow) shared by tonal voices.
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.35;
    this.wobble = ctx.createGain();
    this.wobble.gain.value = 5; // cents
    lfo.connect(this.wobble);
    lfo.start();

    this.noise = this.makeNoise(2);
    this.buildAmbience();
  }

  private makeImpulse(seconds: number) {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
    }
    return buf;
  }

  private makeNoise(seconds: number) {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  /** Vinyl crackle + soft pond water, looped forever (very quiet). */
  private buildAmbience() {
    const ctx = this.ctx!;
    const sr = ctx.sampleRate;
    this.ambienceGain = ctx.createGain();
    this.ambienceGain.gain.value = this.opts.ambience ? 1 : 0;
    this.ambienceGain.connect(this.master);

    // Vinyl: faint hiss + random dust pops.
    const vLen = sr * 5;
    const vinyl = ctx.createBuffer(1, vLen, sr);
    const v = vinyl.getChannelData(0);
    for (let i = 0; i < vLen; i++) v[i] = (Math.random() * 2 - 1) * 0.01;
    for (let i = 0; i < vLen - 64; i++) {
      if (Math.random() < 0.00035) {
        const amp = rand(0.15, 0.6) * (chance(0.5) ? 1 : -1);
        for (let k = 0; k < 48; k++) v[i + k] += amp * Math.exp(-k / 6);
      }
    }
    const vSrc = ctx.createBufferSource();
    vSrc.buffer = vinyl;
    vSrc.loop = true;
    const vBand = ctx.createBiquadFilter();
    vBand.type = 'bandpass';
    vBand.frequency.value = 2500;
    vBand.Q.value = 0.5;
    const vGain = ctx.createGain();
    vGain.gain.value = 0.22;
    vSrc.connect(vBand).connect(vGain).connect(this.ambienceGain);
    vSrc.start();

    // Pond water: brown noise, low-passed, gently swelling.
    const wLen = sr * 7;
    const water = ctx.createBuffer(1, wLen, sr);
    const w = water.getChannelData(0);
    let last = 0;
    for (let i = 0; i < wLen; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      w[i] = last * 3.2;
    }
    const wSrc = ctx.createBufferSource();
    wSrc.buffer = water;
    wSrc.loop = true;
    const wLp = ctx.createBiquadFilter();
    wLp.type = 'lowpass';
    wLp.frequency.value = 520;
    const wGain = ctx.createGain();
    wGain.gain.value = 0.09;
    const swell = ctx.createOscillator();
    swell.frequency.value = 0.07;
    const swellDepth = ctx.createGain();
    swellDepth.gain.value = 0.04;
    swell.connect(swellDepth).connect(wGain.gain);
    swell.start();
    wSrc.connect(wLp).connect(wGain).connect(this.ambienceGain);
    wSrc.start();
  }

  // ----------------------------------------------------------------- composition
  private resetComposition() {
    this.step = 0;
    this.sectionIndex = -1;
    this.section = INTRO;
    this.key = pick(KEYS);
    this.progression = pick(PROGRESSIONS);
  }

  private stepDur() {
    return 60 / this.opts.bpm / 4;
  }

  private tick() {
    const ctx = this.ctx;
    if (!ctx) return;
    // The tab was frozen: skip ahead instead of firing a burst of late notes.
    if (this.nextTime < ctx.currentTime - 0.25) this.nextTime = ctx.currentTime + 0.05;
    while (this.nextTime < ctx.currentTime + LOOKAHEAD) {
      this.scheduleStep(this.step, this.nextTime);
      this.nextTime += this.stepDur();
      this.step++;
    }
  }

  private newSection() {
    this.sectionIndex++;
    const formPos = (this.sectionIndex - 1) % FORM.length;
    // After each full loop of the form → move to a new key.
    if (this.sectionIndex > 1 && formPos === 0) this.key = pick(KEYS.filter((k) => k !== this.key));
    this.section = this.sectionIndex === 0 ? INTRO : FORM[formPos];
    const prev = this.progression;
    this.progression = pick(PROGRESSIONS.filter((p) => p !== prev));
    this.keysPattern = Math.floor(Math.random() * 3);
  }

  private chordNotes(chord: Chord) {
    const [root, q] = chord;
    const tones = QUALITY[q];
    const center = 66;
    const notes = tones
      .filter((_, i) => !(tones.length >= 5 && i === 0)) // drop the root in rich chords (bass has it)
      .map((t) => {
        let n = this.key + root + t;
        while (n > center + 7) n -= 12;
        while (n < center - 6) n += 12;
        return n;
      });
    return [...new Set(notes)].sort((a, b) => a - b);
  }

  private bassNote(chord: Chord) {
    let n = this.key - 12 + chord[0];
    while (n > 47) n -= 12;
    while (n < 36) n += 12;
    return n;
  }

  private scheduleStep(step: number, time: number) {
    const s16 = step % 16;
    const bar = Math.floor(step / 16);
    const barInSection = bar % BARS_PER_SECTION;
    if (s16 === 0 && barInSection === 0) this.newSection();
    const sd = this.stepDur();
    const beat = sd * 4;
    // Swing: delay off-beat 8ths, nudge 16ths.
    let t = time;
    if (s16 % 4 === 2) t += sd * 0.32;
    else if (s16 % 2 === 1) t += sd * 0.12;

    const chord = this.progression[barInSection % this.progression.length];
    const notes = this.chordNotes(chord);
    const sec = this.section;
    const lastBar = barInSection === BARS_PER_SECTION - 1;

    // Electric piano comping.
    if (s16 === 0) {
      notes.forEach((n, i) => this.epiano(t + i * 0.022 + rand(0, 0.006), n, 0.16 * rand(0.85, 1), beat * (this.keysPattern === 0 ? 3.8 : 2.4)));
    }
    if (this.keysPattern === 1 && s16 === 10 && chance(0.7)) {
      notes.forEach((n, i) => this.epiano(t + i * 0.015, n, 0.09, beat * 1.4));
    }
    if (this.keysPattern === 2 && (s16 === 6 || s16 === 12) && chance(0.55)) {
      const n = notes[Math.floor(Math.random() * notes.length)];
      this.epiano(t, n + 12, 0.07, beat);
    }

    // Pad.
    if (sec.pad && s16 === 0) notes.forEach((n) => this.pad(t, n - 12 + (n < 60 ? 12 : 0), beat * 4.3));

    // Bass.
    if (sec.bass) {
      const b = this.bassNote(chord);
      if (s16 === 0) this.bass(t, b, 0.42, beat * 1.6);
      if (s16 === 10 && chance(0.6)) this.bass(t, b, 0.3, beat * 0.45);
      if (s16 === 14 && chance(0.25)) this.bass(t, b + 7, 0.24, beat * 0.4);
    }

    // Drums.
    if (sec.drums) {
      if (s16 === 0 || (s16 === 10 && !lastBar) || (s16 === 7 && chance(0.25))) this.kick(t, s16 === 0 ? 0.8 : 0.6);
      if (s16 === 4 || s16 === 12) this.snare(t, 0.5);
      if (lastBar && s16 === 15 && chance(0.6)) this.snare(t, 0.25);
      if (s16 % 2 === 0) this.hat(t, s16 % 4 === 0 ? 0.55 : 0.32);
      else if (chance(0.12)) this.hat(t, 0.18);
    }

    // Kalimba melody (call on even bars, mostly rest on odd bars).
    if (sec.melody && s16 % 2 === 0) {
      const p = bar % 2 === 0 ? (s16 === 0 ? 0.45 : 0.3) : 0.08;
      if (chance(p)) {
        this.melodyIdx = Math.max(0, Math.min(11, this.melodyIdx + pick([-2, -1, -1, 1, 1, 2, 0])));
        const deg = PENTATONIC[this.melodyIdx % 5] + 12 * Math.floor(this.melodyIdx / 5);
        this.bell(t, this.key + 12 + deg, 0.13 * rand(0.8, 1.1), 1.2);
      }
    }
  }

  // ----------------------------------------------------------------- voices
  private osc(type: OscillatorType, freq: number, t: number, end: number, wobble = true) {
    const o = this.ctx!.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (wobble) {
      this.wobble.connect(o.detune);
      o.onended = () => {
        try {
          this.wobble.disconnect(o.detune);
        } catch {
          /* already disconnected */
        }
      };
    }
    o.start(t);
    o.stop(end);
    return o;
  }

  private epiano(t: number, midi: number, vel: number, dur: number) {
    const ctx = this.ctx!;
    const f = midiToFreq(midi);
    const end = t + dur + 1.2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vel, t + 0.012);
    g.gain.setTargetAtTime(vel * 0.32, t + 0.012, 0.45);
    g.gain.setTargetAtTime(0, t + dur, 0.28);
    g.connect(this.bus);
    g.connect(this.reverbSend);
    this.osc('sine', f, t, end).connect(g);
    const body = ctx.createGain();
    body.gain.value = 0.22;
    this.osc('triangle', f * 1.002, t, end).connect(body).connect(g);
    // Tine "ping" on the attack.
    const tine = ctx.createGain();
    tine.gain.setValueAtTime(vel * 0.5, t);
    tine.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    tine.connect(this.bus);
    this.osc('sine', f * 4, t, t + 0.25, false).connect(tine);
  }

  private pad(t: number, midi: number, dur: number) {
    const ctx = this.ctx!;
    const f = midiToFreq(midi);
    const end = t + dur + 2;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 750;
    lp.Q.value = 0.3;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.022, t + 1.1);
    g.gain.setTargetAtTime(0, t + dur, 0.6);
    lp.connect(g);
    g.connect(this.bus);
    g.connect(this.reverbSend);
    const a = this.osc('sawtooth', f, t, end);
    a.detune.value = -8;
    a.connect(lp);
    const b = this.osc('sawtooth', f, t, end);
    b.detune.value = 8;
    b.connect(lp);
  }

  private bass(t: number, midi: number, vel: number, dur: number) {
    const ctx = this.ctx!;
    const f = midiToFreq(midi);
    const end = t + dur + 0.6;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vel, t + 0.015);
    g.gain.setTargetAtTime(vel * 0.55, t + 0.015, 0.3);
    g.gain.setTargetAtTime(0, t + dur, 0.12);
    g.connect(this.bus);
    this.osc('sine', f, t, end, false).connect(g);
    const h = ctx.createGain();
    h.gain.value = 0.18;
    this.osc('triangle', f * 2, t, end, false).connect(h).connect(g);
  }

  private kick(t: number, vel: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(115, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.13);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vel * 0.9, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);
    o.connect(g).connect(this.bus);
    o.start(t);
    o.stop(t + 0.4);
  }

  private noiseHit(t: number, filter: BiquadFilterType, freq: number, q: number, vel: number, decay: number, reverb: number) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = filter;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vel, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    src.connect(f).connect(g).connect(this.bus);
    if (reverb > 0) {
      const r = ctx.createGain();
      r.gain.value = reverb;
      g.connect(r).connect(this.reverbSend);
    }
    src.start(t, Math.random() * 1.5);
    src.stop(t + decay + 0.05);
  }

  private snare(t: number, vel: number) {
    this.noiseHit(t, 'bandpass', 1900, 0.7, vel * 0.32, 0.2, 0.5);
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(190, t);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vel * 0.16, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    o.connect(g).connect(this.bus);
    o.start(t);
    o.stop(t + 0.1);
  }

  private hat(t: number, vel: number) {
    this.noiseHit(t, 'highpass', 7500, 0.5, vel * 0.075, 0.045, 0);
  }

  private bell(t: number, midi: number, vel: number, decay: number) {
    const ctx = this.ctx!;
    const f = midiToFreq(midi);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vel, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    g.connect(this.bus);
    g.connect(this.delaySend);
    g.connect(this.reverbSend);
    this.osc('sine', f, t, t + decay + 0.05).connect(g);
    const over = ctx.createGain();
    over.gain.setValueAtTime(vel * 0.35, t);
    over.gain.exponentialRampToValueAtTime(0.0001, t + decay * 0.25);
    over.connect(this.bus);
    this.osc('sine', f * 5.4, t, t + decay * 0.3, false).connect(over);
  }
}
