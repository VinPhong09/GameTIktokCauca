import * as THREE from 'three';
import { Ease } from '../core/Tween';
import { roundRect } from './NameTag';
import type { CatManager } from './CatManager';
import type { World } from './CatActor';

/** Below rare/epic/legendary catch focus (1–3): a catch always wins the camera. */
const WELCOME_PRIORITY = 0.5;
/** During a burst of joins only the most recent ones get the camera. */
const MAX_PENDING = 3;
/** A welcome that waited longer than this (camera busy with catches) is skipped. */
const MAX_WAIT_SEC = 15;
const GAP_SEC = 0.5;
const now = () => performance.now() / 1000;

export interface WelcomeSettings {
  enabled: boolean;
  seconds: number;
}

/**
 * Greets every cat that enters the pond: the camera flies to it, a "🎉 Chào mừng …!" bubble
 * pops above its head, confetti bursts and the cat jumps for joy. Joins are played one at a time.
 */
export class WelcomeDirector {
  private queue: { id: string; at: number }[] = [];
  private current: { id: string; start: number; dur: number } | null = null;
  /** Wall-clock (s) before which the next welcome may not start. */
  private nextAt = 0;
  private bubble = new WelcomeBubble();

  constructor(private world: World, private cats: CatManager, private settings: () => WelcomeSettings) {
    world.root.add(this.bubble.sprite);
  }

  /** A cat just took a seat in the pond. */
  welcome(id: string) {
    const actor = this.cats.actors.get(id);
    if (!actor) return;
    actor.celebrateJoin();
    if (!this.settings().enabled) {
      this.world.effects.welcome(actor.root.position.clone().setY(2.6));
      return;
    }
    this.queue = this.queue.filter((q) => q.id !== id);
    this.queue.push({ id, at: now() });
    if (this.queue.length > MAX_PENDING) this.queue.splice(0, this.queue.length - MAX_PENDING);
  }

  clear() {
    this.queue = [];
    this.current = null;
    this.bubble.hide();
  }

  /** Timing uses the wall clock so it stays correct when the page renders slowly (OBS / background tab). */
  update(dt: number) {
    const t = now();
    this.bubble.update(dt);
    if (this.current) {
      const c = this.current;
      const actor = this.cats.actors.get(c.id);
      if (!actor || t - c.start >= c.dur) {
        this.current = null;
        this.nextAt = t + GAP_SEC;
        this.bubble.hide();
        this.world.camera.release(WELCOME_PRIORITY);
      } else {
        this.bubble.follow(actor.root.position);
      }
      return;
    }
    if (t < this.nextAt) return;
    if (!this.queue.length) return;
    // Wait while a rare / epic / legendary catch owns the camera.
    if (this.world.camera.isBusy(WELCOME_PRIORITY)) return;
    while (this.queue.length) {
      const next = this.queue.shift()!;
      const actor = this.cats.actors.get(next.id);
      if (!actor || t - next.at > MAX_WAIT_SEC) continue;
      const dur = Math.max(1, this.settings().seconds);
      this.world.camera.focus(actor.root.position, dur, WELCOME_PRIORITY, 0.78, 1);
      this.bubble.show(actor.player.nickname, actor.root.position);
      actor.celebrateJoin();
      this.world.effects.welcome(actor.root.position.clone().setY(2.6));
      this.current = { id: next.id, start: t, dur };
      return;
    }
  }

  dispose() {
    this.world.root.remove(this.bubble.sprite);
    this.bubble.dispose();
  }
}

/** Canvas-sprite speech bubble shown above the welcomed cat. */
class WelcomeBubble {
  readonly sprite: THREE.Sprite;
  private canvas = document.createElement('canvas');
  private texture: THREE.CanvasTexture;
  private t = 0;
  private visible = false;
  private hiding = false;
  private hideT = 0;
  private shownAt = 0;
  private hideAt = 0;
  private static readonly W = 6;

  constructor() {
    this.canvas.width = 1024;
    this.canvas.height = 220;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.minFilter = THREE.LinearFilter;
    this.sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.texture, transparent: true, depthTest: false, depthWrite: false }));
    this.sprite.renderOrder = 30;
    this.sprite.visible = false;
  }

  show(name: string, pos: THREE.Vector3) {
    const chars = [...name];
    const short = chars.length > 14 ? chars.slice(0, 13).join('') + '…' : name;
    const ctx = this.canvas.getContext('2d')!;
    ctx.clearRect(0, 0, 1024, 220);
    const label = `🎉 Chào mừng ${short}!`;
    ctx.font = 'bold 74px "Baloo 2", "Segoe UI Emoji", system-ui, sans-serif';
    const w = Math.min(1000, ctx.measureText(label).width + 80);
    const x = 512 - w / 2;
    const g = ctx.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, '#ff7ab6');
    g.addColorStop(0.5, '#ffb347');
    g.addColorStop(1, '#ffd23f');
    ctx.fillStyle = g;
    roundRect(ctx, x, 14, w, 150, 75);
    ctx.fill();
    ctx.lineWidth = 10;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
    // Tail pointing at the cat.
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(490, 168);
    ctx.lineTo(512, 210);
    ctx.lineTo(534, 168);
    ctx.fill();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 12;
    ctx.strokeStyle = 'rgba(120, 40, 0, 0.75)';
    ctx.strokeText(label, 512, 92);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(label, 512, 92);
    this.texture.needsUpdate = true;
    this.t = 0;
    // Pop in once the camera has mostly turned toward the cat.
    this.shownAt = now() + 0.45;
    this.visible = true;
    this.hiding = false;
    this.sprite.visible = true;
    this.follow(pos);
    this.apply();
  }

  follow(pos: THREE.Vector3) {
    this.sprite.position.set(pos.x, pos.y + 7.0 + Math.sin(this.t * 3) * 0.12, pos.z);
  }

  hide() {
    if (!this.visible || this.hiding) return;
    this.hiding = true;
    this.hideT = 0;
    this.hideAt = now();
  }

  update(_dt: number) {
    if (!this.visible) return;
    this.t = now() - this.shownAt;
    if (this.hiding) {
      this.hideT = now() - this.hideAt;
      if (this.hideT >= 0.3) {
        this.visible = false;
        this.hiding = false;
        this.sprite.visible = false;
        return;
      }
    }
    this.apply();
  }

  private apply() {
    const pop = this.t <= 0 ? 0 : Ease.outBack(Math.min(1, this.t / 0.35));
    const fade = this.hiding ? 1 - this.hideT / 0.3 : 1;
    const s = WelcomeBubble.W * Math.max(0.01, pop) * (this.hiding ? 0.85 + 0.15 * fade : 1);
    this.sprite.scale.set(s, (s * 220) / 1024, 1);
    (this.sprite.material as THREE.SpriteMaterial).opacity = fade;
  }

  dispose() {
    this.texture.dispose();
    (this.sprite.material as THREE.SpriteMaterial).dispose();
  }
}
