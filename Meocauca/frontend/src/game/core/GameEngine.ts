import * as THREE from 'three';
import { TweenManager } from './Tween';

export type Updater = (dt: number, time: number) => void;

export interface EngineOptions {
  transparent?: boolean;
  fpsCap?: 30 | 60;
  quality?: 'low' | 'medium' | 'high';
}

/**
 * Owns the WebGL renderer + render loop. Fixed logical size (1080x1920 for TikTok),
 * adaptive pixel ratio and an FPS fallback (60 → 30) when the machine struggles.
 */
export class GameEngine {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly tweens = new TweenManager();
  private updaters = new Set<Updater>();
  private resizeListeners = new Set<(w: number, h: number) => void>();
  private raf = 0;
  private last = 0;
  private time = 0;
  private acc = 0;
  private fpsCap: number;
  private basePixelRatio = 1;
  private pixelScale = 1;
  private perf = { frames: 0, elapsed: 0, lowStreak: 0, highStreak: 0 };
  fps = 60;
  width = 1080;
  height = 1920;

  constructor(readonly canvas: HTMLCanvasElement, private opts: EngineOptions = {}) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: opts.quality !== 'low',
      alpha: !!opts.transparent,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: false,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = opts.quality !== 'low';
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    if (opts.transparent) this.renderer.setClearColor(0x000000, 0);
    this.camera = new THREE.PerspectiveCamera(50, 9 / 16, 0.5, 900);
    this.fpsCap = opts.fpsCap ?? 60;
  }

  setFpsCap(cap: 30 | 60) {
    this.fpsCap = cap;
  }

  /** Logical size in CSS px + device pixel ratio budget. */
  setSize(width: number, height: number, pixelRatio: number) {
    this.width = width;
    this.height = height;
    this.basePixelRatio = Math.min(2, Math.max(0.5, pixelRatio));
    this.renderer.setPixelRatio(this.basePixelRatio * this.pixelScale);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    for (const l of this.resizeListeners) l(width, height);
  }

  onResize(l: (w: number, h: number) => void) {
    this.resizeListeners.add(l);
    l(this.width, this.height);
    return () => this.resizeListeners.delete(l);
  }

  add(u: Updater) {
    this.updaters.add(u);
    return () => this.updaters.delete(u);
  }

  start() {
    this.last = performance.now();
    const frame = (now: number) => {
      this.raf = requestAnimationFrame(frame);
      const rawDt = Math.min(0.1, (now - this.last) / 1000);
      this.last = now;
      this.acc += rawDt;
      const minStep = 1 / this.fpsCap - 0.002;
      if (this.acc < minStep) return;
      const dt = Math.min(0.1, this.acc);
      this.acc = 0;
      this.time += dt;
      this.trackPerformance(dt);
      this.tweens.update(dt);
      for (const u of this.updaters) u(dt, this.time);
      this.renderer.render(this.scene, this.camera);
    };
    this.raf = requestAnimationFrame(frame);
  }

  /** Lower resolution, then cap at 30 FPS if frames stay slow; recover when fast again. */
  private trackPerformance(dt: number) {
    const p = this.perf;
    p.frames++;
    p.elapsed += dt;
    if (p.elapsed < 2) return;
    this.fps = p.frames / p.elapsed;
    p.frames = 0;
    p.elapsed = 0;
    const target = this.fpsCap;
    if (this.fps < target * 0.75) {
      p.lowStreak++;
      p.highStreak = 0;
      if (p.lowStreak >= 2) {
        p.lowStreak = 0;
        if (this.pixelScale > 0.6) {
          this.pixelScale = Math.max(0.6, this.pixelScale - 0.15);
          this.renderer.setPixelRatio(this.basePixelRatio * this.pixelScale);
          this.renderer.setSize(this.width, this.height, false);
        } else if (this.fpsCap === 60) {
          this.fpsCap = 30;
          console.info('[engine] falling back to 30 FPS');
        }
      }
    } else if (this.fps > target * 0.95) {
      p.highStreak++;
      p.lowStreak = 0;
      if (p.highStreak >= 5 && this.pixelScale < 1) {
        p.highStreak = 0;
        this.pixelScale = Math.min(1, this.pixelScale + 0.1);
        this.renderer.setPixelRatio(this.basePixelRatio * this.pixelScale);
        this.renderer.setSize(this.width, this.height, false);
      }
    }
  }

  stop() {
    cancelAnimationFrame(this.raf);
  }

  dispose() {
    this.stop();
    this.updaters.clear();
    this.renderer.dispose();
  }
}
