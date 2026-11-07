import * as THREE from 'three';
import type { Rarity } from '@shared/types';
import { ParticleSystem } from './ParticleSystem';
import { radialGlowTexture } from '../core/geometry';

interface Ripple {
  mesh: THREE.Mesh;
  t: number;
  dur: number;
  maxScale: number;
  active: boolean;
}

interface Aura {
  sprite: THREE.Sprite;
  target: THREE.Object3D | null;
  offset: THREE.Vector3;
  t: number;
  dur: number;
  size: number;
  pulse: number;
  active: boolean;
}

interface Beam {
  mesh: THREE.Mesh;
  t: number;
  dur: number;
  active: boolean;
}

export const RARITY_FX: Record<Rarity, { colors: string[]; aura: number; sparkle: number }> = {
  common: { colors: ['#ffffff', '#d7f3ff'], aura: 0, sparkle: 0 },
  uncommon: { colors: ['#b9ffcf', '#ffffff', '#7ef0a0'], aura: 0, sparkle: 6 },
  rare: { colors: ['#7dd3fc', '#e0f2fe', '#38bdf8'], aura: 2.2, sparkle: 12 },
  epic: { colors: ['#e879f9', '#c084fc', '#f0abfc', '#a78bfa'], aura: 3.2, sparkle: 20 },
  legendary: { colors: ['#fde047', '#fbbf24', '#ffffff', '#f97316', '#f472b6', '#60a5fa'], aura: 4.6, sparkle: 34 },
};

/** Central pooled effects: particles, ripples, auras, light beams. */
export class Effects {
  readonly group = new THREE.Group();
  readonly glow = new ParticleSystem(4000, THREE.AdditiveBlending, 'soft');
  readonly stars = new ParticleSystem(1500, THREE.AdditiveBlending, 'star');
  readonly drops = new ParticleSystem(2500, THREE.NormalBlending, 'soft');
  readonly confetti = new ParticleSystem(2000, THREE.NormalBlending, 'square');
  private ripples: Ripple[] = [];
  private auras: Aura[] = [];
  private beams: Beam[] = [];

  constructor() {
    this.group.add(this.glow.points, this.stars.points, this.drops.points, this.confetti.points);
    const rippleGeo = new THREE.RingGeometry(0.82, 1, 40);
    rippleGeo.rotateX(-Math.PI / 2);
    for (let i = 0; i < 48; i++) {
      const mesh = new THREE.Mesh(rippleGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }));
      mesh.visible = false;
      mesh.renderOrder = 3;
      this.group.add(mesh);
      this.ripples.push({ mesh, t: 0, dur: 1, maxScale: 1, active: false });
    }
    const tex = radialGlowTexture();
    for (let i = 0; i < 16; i++) {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }));
      sprite.visible = false;
      sprite.renderOrder = 9;
      this.group.add(sprite);
      this.auras.push({ sprite, target: null, offset: new THREE.Vector3(), t: 0, dur: 1, size: 1, pulse: 0, active: false });
    }
    const beamTex = new THREE.CanvasTexture((() => {
      const c = document.createElement('canvas');
      c.width = 4;
      c.height = 128;
      const ctx = c.getContext('2d')!;
      const g = ctx.createLinearGradient(0, 0, 0, 128);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(0.6, 'rgba(255,255,255,0.55)');
      g.addColorStop(1, 'rgba(255,255,255,0.95)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 4, 128);
      return c;
    })());
    for (let i = 0; i < 4; i++) {
      const mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.45, 0.85, 24, 20, 1, true).translate(0, 12, 0),
        new THREE.MeshBasicMaterial({ map: beamTex, color: '#ffe066', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, opacity: 0 }),
      );
      mesh.visible = false;
      mesh.renderOrder = 8;
      this.group.add(mesh);
      this.beams.push({ mesh, t: 0, dur: 1, active: false });
    }
  }

  setViewportHeight(h: number) {
    for (const p of [this.glow, this.stars, this.drops, this.confetti]) p.setViewportHeight(h);
  }

  ripple(x: number, z: number, maxScale = 1.4, dur = 1.1, color = '#ffffff', opacity = 0.7) {
    const r = this.ripples.find((q) => !q.active) ?? this.ripples[0];
    r.active = true;
    r.t = 0;
    r.dur = dur;
    r.maxScale = maxScale;
    r.mesh.position.set(x, 0.06, z);
    (r.mesh.material as THREE.MeshBasicMaterial).color.set(color);
    r.mesh.userData.opacity = opacity;
    r.mesh.visible = true;
  }

  splash(pos: THREE.Vector3, power = 1) {
    this.drops.emit(pos, { count: Math.round(26 * power), colors: ['#e0f7ff', '#ffffff', '#9fdcff'], speed: [1.5 * power, 4 * power], spread: 0.6, gravity: -11, life: [0.5, 1.0], size: [0.12, 0.26], drag: 0.3, radius: 0.15 });
    this.ripple(pos.x, pos.z, 1.2 * power, 0.9);
    if (power > 1.2) this.ripple(pos.x, pos.z, 2.4 * power, 1.6, '#ffffff', 0.5);
  }

  sparkle(pos: THREE.Vector3, rarity: Rarity, n?: number) {
    const fx = RARITY_FX[rarity];
    const count = n ?? fx.sparkle;
    if (!count) return;
    this.stars.emit(pos, { count, colors: fx.colors, speed: [0.3, 1.4], spread: Math.PI, gravity: 0.3, life: [0.6, 1.4], size: [0.12, 0.3], drag: 1.2, radius: 0.6 });
  }

  burst(pos: THREE.Vector3, rarity: Rarity) {
    const fx = RARITY_FX[rarity];
    const scale = rarity === 'legendary' ? 3 : rarity === 'epic' ? 2 : rarity === 'rare' ? 1.4 : 1;
    this.glow.emit(pos, { count: Math.round(40 * scale), colors: fx.colors, speed: [1.5, 4 * scale], spread: Math.PI, gravity: -0.6, life: [0.6, 1.6], size: [0.15, 0.4], drag: 1.6 });
    if (rarity === 'epic' || rarity === 'legendary') {
      this.confetti.emit(pos.clone().add(new THREE.Vector3(0, 1, 0)), { count: rarity === 'legendary' ? 220 : 90, colors: fx.colors, speed: [3, 7], spread: 0.9, gravity: -4, life: [1.5, 3.0], size: [0.12, 0.22], drag: 1.1 });
    }
  }

  hearts(pos: THREE.Vector3, colors = ['#ff5d8f', '#ff8fab', '#ffc2d4']) {
    this.stars.emit(pos, { count: 18, colors, speed: [1, 2.5], spread: 0.7, gravity: 0.8, life: [0.9, 1.6], size: [0.2, 0.38], drag: 1.2, radius: 0.3 });
  }

  /** Colourful confetti pop for a cat that just joined the pond. */
  welcome(pos: THREE.Vector3) {
    const colors = ['#ff5d8f', '#ffd23f', '#7dd3fc', '#86efac', '#c084fc', '#ffffff'];
    this.confetti.emit(pos, { count: 70, colors, speed: [2.5, 5.5], spread: 0.8, gravity: -4, life: [1.2, 2.2], size: [0.12, 0.2], drag: 1.1 });
    this.stars.emit(pos, { count: 22, colors: ['#ffe066', '#ffffff'], speed: [0.6, 2], spread: Math.PI, gravity: 0.2, life: [0.8, 1.5], size: [0.16, 0.32], drag: 1.2, radius: 0.5 });
  }

  fireworks(center: THREE.Vector3, colors: string[]) {
    for (let i = 0; i < 4; i++) {
      const p = center.clone().add(new THREE.Vector3((Math.random() - 0.5) * 12, 7 + Math.random() * 5, (Math.random() - 0.5) * 8));
      setTimeout(() => {
        this.glow.emit(p, { count: 90, colors, speed: [3, 6], spread: Math.PI, gravity: -2, life: [0.9, 1.8], size: [0.2, 0.4], drag: 1.4 });
        this.stars.emit(p, { count: 30, colors: ['#ffffff'], speed: [1, 3], spread: Math.PI, gravity: -1, life: [0.8, 1.4], size: [0.15, 0.3], drag: 1.4 });
      }, i * 260);
    }
  }

  aura(target: THREE.Object3D | null, pos: THREE.Vector3, color: string, size: number, dur: number) {
    const a = this.auras.find((q) => !q.active) ?? this.auras[0];
    a.active = true;
    a.target = target;
    a.offset.copy(pos);
    a.t = 0;
    a.dur = dur;
    a.size = size;
    a.pulse = Math.random() * 6;
    (a.sprite.material as THREE.SpriteMaterial).color.set(color);
    a.sprite.visible = true;
    return a;
  }

  beam(pos: THREE.Vector3, color: string, dur: number) {
    const b = this.beams.find((q) => !q.active) ?? this.beams[0];
    b.active = true;
    b.t = 0;
    b.dur = dur;
    b.mesh.position.copy(pos).setY(-0.5);
    (b.mesh.material as THREE.MeshBasicMaterial).color.set(color);
    b.mesh.visible = true;
  }

  update(dt: number, time: number) {
    this.glow.update(dt);
    this.stars.update(dt);
    this.drops.update(dt);
    this.confetti.update(dt);
    for (const r of this.ripples) {
      if (!r.active) continue;
      r.t += dt;
      const k = Math.min(1, r.t / r.dur);
      const s = 0.2 + k * r.maxScale;
      r.mesh.scale.set(s, 1, s);
      (r.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - k) * (r.mesh.userData.opacity ?? 0.7);
      if (k >= 1) {
        r.active = false;
        r.mesh.visible = false;
      }
    }
    const wp = new THREE.Vector3();
    for (const a of this.auras) {
      if (!a.active) continue;
      a.t += dt;
      const k = a.t / a.dur;
      if (a.target) a.sprite.position.copy(a.target.getWorldPosition(wp));
      else a.sprite.position.copy(a.offset);
      const fadeIn = Math.min(1, a.t * 3);
      const fadeOut = Math.min(1, (a.dur - a.t) * 2);
      const pulse = 1 + Math.sin(time * 5 + a.pulse) * 0.12;
      a.sprite.scale.setScalar(a.size * pulse);
      (a.sprite.material as THREE.SpriteMaterial).opacity = Math.max(0, Math.min(fadeIn, fadeOut)) * 0.5;
      if (k >= 1) {
        a.active = false;
        a.sprite.visible = false;
        a.target = null;
      }
    }
    for (const b of this.beams) {
      if (!b.active) continue;
      b.t += dt;
      const fadeIn = Math.min(1, b.t * 2);
      const fadeOut = Math.min(1, (b.dur - b.t) * 1.5);
      (b.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, Math.min(fadeIn, fadeOut)) * 0.5;
      b.mesh.rotation.y += dt * 0.8;
      b.mesh.scale.set(1 + Math.sin(time * 6) * 0.06, 1, 1 + Math.sin(time * 6) * 0.06);
      if (b.t >= b.dur) {
        b.active = false;
        b.mesh.visible = false;
      }
    }
  }
}
