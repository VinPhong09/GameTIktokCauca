import * as THREE from 'three';
import type { CatAppearance, FishDef, FishingCycleDTO, GiftTier, PlayerDTO, RarityConfig } from '@shared/types';
import { buildCatGeometry, CAT, rodTipLocal } from './CatBuilder';
import { NameTag, emoteTexture } from './NameTag';
import { FishingRig } from '../fishing/FishingRig';
import { FishingStateMachine, type FishingState } from '../fishing/FishingStateMachine';
import { buildFishMesh } from '../fish/FishBuilder';
import { sharedToonMaterial } from '../core/geometry';
import { getModel } from '../core/models';
import { Ease, damp, lerp, segment } from '../core/Tween';
import type { Effects } from '../effects/Effects';
import { RARITY_FX } from '../effects/Effects';
import type { Water } from '../pond/Water';
import type { Platform } from '../pond/Platform';
import type { CameraDirector } from '../camera/CameraDirector';
import { SEAT_RADIUS, STOOL_HEIGHT, seatPosition } from '../pond/constants';

export interface World {
  root: THREE.Group;
  effects: Effects;
  water: Water;
  platform: Platform;
  camera: CameraDirector;
  fish(id: string): FishDef | undefined;
  rarity(id: string): RarityConfig | undefined;
  focusEnabled(): boolean;
  isOverlay: boolean;
}

const whiskerMats = new Map<string, THREE.LineBasicMaterial>();
function whiskerMaterial(color: string) {
  let m = whiskerMats.get(color);
  if (!m) {
    m = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.85 });
    whiskerMats.set(color, m);
  }
  return m;
}

const RARITY_SCALE = { common: 0.8, uncommon: 0.95, rare: 1.1, epic: 1.3, legendary: 1.6 } as const;

const tmp = new THREE.Vector3();
const tmp2 = new THREE.Vector3();

/** One viewer's cat: model, pose animation, fishing rig, caught fish and per-cat effects. */
export class CatActor {
  readonly root = new THREE.Group();
  private body = new THREE.Group();
  private head = new THREE.Group();
  private tailPivot = new THREE.Group();
  private rigPivot = new THREE.Group();
  private rodTip = new THREE.Object3D();
  private meshes: THREE.Object3D[] = [];
  private eyes: THREE.Mesh | null = null;
  readonly tag = new NameTag();
  private emote: THREE.Sprite;
  private emoteT = 0;
  readonly rig = new FishingRig();
  readonly fsm = new FishingStateMachine();
  private fish: THREE.Object3D | null = null;
  private fishDef: FishDef | null = null;
  private fishScale = 1;

  private castTarget = new THREE.Vector3();
  private releasePos = new THREE.Vector3();
  private bobberPos = new THREE.Vector3();
  private fishFrom = new THREE.Vector3();
  private displayPos = new THREE.Vector3();
  private bucketPos = new THREE.Vector3();
  private tipWorld = new THREE.Vector3();

  private pose = { rod: -0.55, lean: 0, bodyY: 0, headX: 0, headY: 0, spin: 0 };
  private phase = Math.random() * 10;
  private blinkIn = 2 + Math.random() * 3;
  private reactT = 0;
  private fxAcc = 0;
  private spawn = 0;
  private leaving = false;
  private leaveDone: (() => void) | null = null;
  private seatTarget = new THREE.Vector3();
  seat: number | null = null;
  player: PlayerDTO;

  constructor(player: PlayerDTO, cat: CatAppearance, private world: World) {
    this.player = player;
    this.root.add(this.body);
    this.body.add(this.head, this.tailPivot, this.rigPivot);
    this.head.position.copy(CAT.headPivot);
    this.tailPivot.position.copy(CAT.tailPivot);
    this.rigPivot.position.copy(CAT.rigPivot);
    this.rigPivot.add(this.rodTip);
    rodTipLocal(this.rodTip.position);
    this.body.position.y = STOOL_HEIGHT;

    this.tag.sprite.position.set(0, STOOL_HEIGHT + CAT.height + 0.55, 0);
    this.root.add(this.tag.sprite);
    this.emote = new THREE.Sprite(new THREE.SpriteMaterial({ map: emoteTexture('!', '#ff3b3b'), transparent: true, depthTest: false }));
    this.emote.scale.setScalar(0.85);
    this.emote.position.set(0.75, STOOL_HEIGHT + CAT.height + 0.05, 0);
    this.emote.visible = false;
    this.emote.renderOrder = 21;
    this.root.add(this.emote);

    world.root.add(this.root, this.rig.line, this.rig.bobber);
    this.setAppearance(cat);
    this.updateTag(player);
    this.fsm.onEnter = (s, silent) => this.onEnter(s, silent);
    this.root.scale.setScalar(0.001);
  }

  setAppearance(cat: CatAppearance) {
    for (const m of this.meshes) m.parent?.remove(m);
    this.meshes = [];
    const g = buildCatGeometry(cat);
    const mat = sharedToonMaterial();
    const add = (parent: THREE.Object3D, geo: THREE.BufferGeometry) => {
      const m = new THREE.Mesh(geo, mat);
      m.castShadow = true;
      parent.add(m);
      this.meshes.push(m);
      return m;
    };
    add(this.body, g.torso);
    add(this.head, g.head);
    this.eyes = add(this.head, g.eyes);
    this.eyes.position.set(0, 0.36, 0.39);
    this.eyes.castShadow = false;
    add(this.tailPivot, g.tail);
    add(this.rigPivot, g.arms);
    add(this.rigPivot, g.rod);
    const wh = new THREE.LineSegments(g.whiskers, whiskerMaterial(g.whiskerColor));
    this.head.add(wh);
    this.meshes.push(wh);
  }

  updateTag(p: PlayerDTO) {
    this.player = p;
    this.tag.set({ name: p.nickname, luck: p.luck, rank: p.rank });
  }

  /** Place (or move) the cat to a seat around the pond. */
  setSeat(seat: number, maxSeats: number, instant: boolean) {
    this.seat = seat;
    seatPosition(seat, maxSeats, SEAT_RADIUS, this.seatTarget);
    // Alternate tag heights so neighbouring names never sit on the same line.
    this.tag.sprite.position.y = STOOL_HEIGHT + CAT.height + 0.5 + (seat % 2 === 1 ? 0.62 : 0);
    if (instant || this.spawn < 1) this.root.position.copy(this.seatTarget);
    this.bucketPos.copy(this.world.platform.bucketPosition(seat));
  }

  private worldPos(out: THREE.Vector3) {
    return out.copy(this.root.position);
  }

  /** Direction from the cat toward the pond center (XZ). */
  private inward(out: THREE.Vector3) {
    return out.set(-this.root.position.x, 0, -this.root.position.z).normalize();
  }

  startCycle(cycle: FishingCycleDTO) {
    this.clearFish();
    this.fishDef = cycle.catch ? this.world.fish(cycle.catch.fishId) ?? null : null;
    const inward = this.inward(tmp);
    const side = tmp2.set(-inward.z, 0, inward.x);
    const dist = 3.7 + Math.random() * 0.9;
    this.castTarget.copy(this.root.position).addScaledVector(inward, dist).addScaledVector(side, (Math.random() - 0.5) * 0.9).setY(0.02);
    this.fsm.start(cycle);
  }

  private clearFish() {
    if (this.fish) {
      this.world.root.remove(this.fish);
      this.fish = null;
    }
  }

  private showEmote(symbol: string, color: string, seconds: number) {
    (this.emote.material as THREE.SpriteMaterial).map = emoteTexture(symbol, color);
    (this.emote.material as THREE.SpriteMaterial).needsUpdate = true;
    this.emote.visible = true;
    this.emoteT = seconds;
  }

  private onEnter(state: FishingState, silent: boolean) {
    const fx = this.world.effects;
    const cycle = this.fsm.cycle;
    const rarity = cycle?.catch?.rarity ?? 'common';
    const rcfg = this.world.rarity(rarity);
    switch (state) {
      case 'WAITING':
        this.bobberPos.copy(this.castTarget);
        if (!silent) fx.splash(this.castTarget, 0.5);
        break;
      case 'BITE':
        if (!silent) this.showEmote('!', '#ff3b3b', this.fsm.dur);
        break;
      case 'PULL':
        if (!silent && cycle?.success && rcfg?.cameraFocus && this.world.focusEnabled()) {
          const tl = cycle.timeline;
          const hold = (tl.pullMs + tl.resultMs + tl.celebrateMs * 0.6) / 1000;
          this.world.camera.focus(this.root.position, hold, rarity === 'legendary' ? 3 : rarity === 'epic' ? 2 : 1, rarity === 'legendary' ? 0.72 : rarity === 'epic' ? 0.82 : 0.92);
        }
        if (!silent && cycle?.success && (rarity === 'legendary' || rarity === 'epic')) {
          fx.beam(this.bobberPos, rcfg?.color ?? '#ffe066', (cycle.timeline.pullMs + 800) / 1000);
        }
        break;
      case 'CATCH': {
        if (!this.fishDef || !cycle?.catch) break;
        const glb = getModel(this.fishDef.model);
        this.fish = glb ? new THREE.Group().add(glb) : buildFishMesh(this.fishDef);
        const wr = (cycle.catch.weight - this.fishDef.weightMin) / Math.max(0.01, this.fishDef.weightMax - this.fishDef.weightMin);
        this.fishScale = (this.fishDef.visual.scale ?? 1) * RARITY_SCALE[rarity] * (0.85 + Math.min(1, Math.max(0, wr)) * 0.4);
        this.fish.scale.setScalar(this.fishScale);
        this.world.root.add(this.fish);
        this.fishFrom.copy(this.bobberPos).setY(-0.2);
        this.inward(tmp);
        this.displayPos.copy(this.root.position).addScaledVector(tmp, 0.8).setY(this.root.position.y + (STOOL_HEIGHT + CAT.height) * CAT.scale + 1.1);
        this.fish.position.copy(this.fishFrom);
        if (!silent) {
          const power = rarity === 'legendary' ? 2.6 : rarity === 'epic' ? 1.9 : rarity === 'rare' ? 1.4 : 1;
          fx.splash(this.bobberPos, power);
          fx.burst(this.bobberPos.clone().setY(0.5), rarity);
          const aura = RARITY_FX[rarity].aura;
          if (aura > 0) fx.aura(this.fish, this.fish.position, rcfg?.color ?? '#ffffff', aura * (0.7 + this.fishScale * 0.25), (cycle.timeline.resultMs + cycle.timeline.celebrateMs) / 1000);
          if (rarity === 'legendary') {
            fx.aura(this.fish, this.fish.position, '#ffffff', 1.3, (cycle.timeline.resultMs + cycle.timeline.celebrateMs) / 1000);
            for (let i = 0; i < 4; i++) setTimeout(() => fx.ripple(this.bobberPos.x, this.bobberPos.z, 3 + i * 1.5, 1.8, '#ffe066', 0.6), i * 180);
          }
        }
        break;
      }
      case 'RESULT':
        if (!silent && (rarity === 'rare' || rarity === 'epic' || rarity === 'legendary')) this.showEmote('★', rcfg?.color ?? '#fbbf24', 2.5);
        break;
      case 'CELEBRATE':
        if (!silent && this.fish && rarity !== 'common') fx.burst(this.displayPos, rarity);
        break;
      case 'FAIL':
        if (!silent) {
          fx.splash(this.bobberPos, 1.1);
          this.showEmote('…', '#64748b', 1.6);
        }
        this.releasePos.copy(this.bobberPos);
        break;
      case 'IDLE':
        this.clearFish();
        break;
    }
  }

  giftReact(tier: GiftTier) {
    this.reactT = tier === 'mega' ? 2.2 : tier === 'large' ? 1.6 : 1.1;
    this.showEmote('♥', '#ff4d8d', 1.4);
    const p = tmp.copy(this.root.position).setY(this.root.position.y + 1.6);
    this.world.effects.hearts(p);
    if (tier === 'large' || tier === 'mega') this.world.effects.sparkle(p, tier === 'mega' ? 'legendary' : 'epic', 30);
  }

  /** Happy jump + star emote when the cat enters the pond. */
  celebrateJoin() {
    this.reactT = 1.6;
    this.showEmote('★', '#ffb703', 1.8);
  }

  leave(onDone: () => void) {
    this.leaving = true;
    this.leaveDone = onDone;
    this.world.effects.sparkle(tmp.copy(this.root.position).setY(1.5), 'uncommon', 12);
  }

  dispose() {
    this.clearFish();
    this.world.root.remove(this.root, this.rig.line, this.rig.bobber);
    this.tag.dispose();
    this.rig.dispose();
    (this.emote.material as THREE.SpriteMaterial).dispose();
  }

  update(dt: number, time: number) {
    // Spawn / leave pop animation
    if (this.leaving) {
      this.spawn -= dt * 2.5;
      if (this.spawn <= 0) {
        this.leaveDone?.();
        this.leaveDone = null;
        return;
      }
    } else if (this.spawn < 1) {
      this.spawn = Math.min(1, this.spawn + dt * 2.2);
    }
    this.root.scale.setScalar(Math.max(0.001, (this.leaving ? this.spawn : Ease.outBack(this.spawn)) * CAT.scale));
    this.root.position.lerp(this.seatTarget, 1 - Math.exp(-dt * 4));
    this.root.position.y = this.seatTarget.y;
    this.root.lookAt(0, this.root.position.y, 0);

    this.fsm.update(performance.now());
    const s = this.fsm.state;
    const p = this.fsm.progress;
    const st = this.fsm.t;
    const P = this.pose;
    let rod = -0.55 + Math.sin(time * 1.3 + this.phase) * 0.04;
    let lean = 0;
    let bodyY = Math.sin(time * 2 + this.phase) * 0.012;
    let headX = Math.sin(time * 0.7 + this.phase) * 0.05;
    let headY = Math.sin(time * 0.4 + this.phase * 2) * 0.25;
    let spin = 0;
    let shake = 0;

    switch (s) {
      case 'CAST':
        if (p < 0.45) rod = lerp(-0.55, -1.95, Ease.outQuad(p / 0.45));
        else if (p < 0.7) rod = lerp(-1.95, -0.15, Ease.inQuad(segment(p, 0.45, 0.7)));
        else rod = lerp(-0.15, -0.4, segment(p, 0.7, 1));
        lean = p < 0.45 ? -0.12 * (p / 0.45) : 0.1 * (1 - p);
        headY = 0;
        break;
      case 'WAITING':
        rod = -0.4 + Math.sin(time * 1.1 + this.phase) * 0.03;
        headX = 0.12;
        headY = Math.sin(time * 0.5 + this.phase) * 0.15;
        break;
      case 'BITE':
        rod = -0.35;
        shake = 0.05;
        headX = 0.22;
        headY = 0;
        lean = 0.06;
        break;
      case 'PULL':
        rod = lerp(-0.4, -1.35, Ease.outCubic(p));
        shake = 0.07 * (1 - p * 0.4);
        lean = -0.2 * Ease.outQuad(p);
        headX = -0.05;
        headY = 0;
        bodyY = Math.abs(Math.sin(st * 16)) * 0.02;
        break;
      case 'CATCH':
        rod = -1.35;
        lean = -0.15;
        headX = -0.3;
        headY = 0;
        break;
      case 'RESULT':
        rod = -0.95;
        headX = -0.35;
        headY = Math.sin(st * 2) * 0.1;
        break;
      case 'CELEBRATE':
        rod = -1.7 + Math.sin(st * 14) * 0.1;
        bodyY = Math.abs(Math.sin(st * 7)) * 0.4;
        spin = Math.sin(st * 9) * 0.3;
        headX = -0.25;
        headY = 0;
        break;
      case 'RETURN':
        rod = lerp(-1.0, -0.55, p);
        break;
      case 'FAIL':
        rod = -0.75 + Math.sin(st * 22) * 0.3 * Math.exp(-st * 3);
        headX = 0.38;
        headY = Math.sin(st * 3) * 0.2;
        lean = 0.12;
        break;
    }
    if (this.reactT > 0) {
      this.reactT -= dt;
      bodyY += Math.abs(Math.sin(this.reactT * 9)) * 0.3;
      spin += Math.sin(this.reactT * 12) * 0.15;
    }
    const k = s === 'CAST' ? 30 : 9;
    P.rod = damp(P.rod, rod, k, dt) + (shake ? Math.sin(time * 38) * shake : 0);
    P.lean = damp(P.lean, lean, 8, dt);
    P.bodyY = damp(P.bodyY, bodyY, 18, dt);
    P.headX = damp(P.headX, headX, 6, dt);
    P.headY = damp(P.headY, headY, 4, dt);
    P.spin = damp(P.spin, spin, 10, dt);
    this.rigPivot.rotation.x = P.rod;
    this.body.rotation.x = P.lean;
    this.body.position.y = STOOL_HEIGHT + P.bodyY;
    this.body.rotation.y = P.spin;
    this.head.rotation.set(P.headX, P.headY, Math.sin(time * 0.9 + this.phase) * 0.04);
    this.tailPivot.rotation.set(Math.sin(time * 1.6 + this.phase) * 0.1, Math.sin(time * 2.2 + this.phase) * 0.45, 0);

    // Blink
    this.blinkIn -= dt;
    if (this.eyes) this.eyes.scale.y = this.blinkIn < 0.12 ? 0.15 : 1;
    if (this.blinkIn < 0) this.blinkIn = 2 + Math.random() * 4;

    // Emote bubble
    if (this.emote.visible) {
      this.emoteT -= dt;
      this.emote.scale.setScalar(0.85 + Math.sin(time * 10) * 0.06);
      if (this.emoteT <= 0) this.emote.visible = false;
    }

    this.root.updateMatrixWorld(true);
    this.rodTip.getWorldPosition(this.tipWorld);
    this.updateRig(s, p, st, time, dt);
  }

  private updateRig(s: FishingState, p: number, st: number, time: number, dt: number) {
    const rig = this.rig;
    const tip = this.tipWorld;
    const water = this.world.water;
    const bob = rig.bobber;
    const fx = this.world.effects;
    const rarity = this.fsm.cycle?.catch?.rarity ?? 'common';
    bob.visible = this.spawn > 0.5;
    switch (s) {
      case 'IDLE':
      case 'RETURN': {
        bob.position.copy(tip).add(tmp.set(0, -0.55, 0));
        rig.setLine(tip, bob.position, 0);
        if (s === 'RETURN' && this.fish) {
          const k = Ease.inOutQuad(p);
          this.fish.position.lerpVectors(this.displayPos, this.bucketPos, k);
          this.fish.position.y += Math.sin(k * Math.PI) * 0.8;
          this.fish.scale.setScalar(this.fishScale * (1 - k * 0.75));
          this.fish.rotation.y += dt * 6;
          if (k > 0.97) this.clearFish();
        }
        break;
      }
      case 'CAST': {
        if (p < 0.55) {
          bob.position.copy(tip).add(tmp.set(0, -0.45, 0));
          this.releasePos.copy(bob.position);
        } else {
          const k = segment(p, 0.55, 1);
          bob.position.lerpVectors(this.releasePos, this.castTarget, Ease.outQuad(k));
          bob.position.y += Math.sin(k * Math.PI) * 2.2;
        }
        rig.setLine(tip, bob.position, p < 0.55 ? 0 : 0.2);
        break;
      }
      case 'WAITING': {
        const h = water.heightAt(this.castTarget.x, this.castTarget.z, time);
        bob.position.copy(this.castTarget).setY(h + Math.sin(time * 3 + this.phase) * 0.025);
        this.bobberPos.copy(bob.position);
        rig.setLine(tip, bob.position, 0.45);
        if (Math.random() < dt * 0.25) fx.ripple(bob.position.x, bob.position.z, 0.5, 1.2, '#ffffff', 0.35);
        break;
      }
      case 'BITE': {
        const dip = -0.08 - Math.abs(Math.sin(st * 17)) * 0.12;
        bob.position.copy(this.castTarget).add(tmp.set(Math.sin(st * 23) * 0.05, dip, Math.cos(st * 19) * 0.05));
        this.bobberPos.copy(bob.position);
        rig.setLine(tip, bob.position, 0.15, 0.02, time);
        this.fxAcc += dt;
        if (this.fxAcc > 0.28) {
          this.fxAcc = 0;
          fx.ripple(bob.position.x, bob.position.z, 0.9, 0.8);
        }
        break;
      }
      case 'PULL': {
        const inward = this.inward(tmp2);
        const drag = Ease.inQuad(p) * 1.2;
        const thrash = 0.25 + (rarity === 'legendary' ? 0.25 : 0);
        bob.position.copy(this.castTarget).addScaledVector(inward, -drag).add(tmp.set(Math.sin(st * 9) * thrash, -0.1 + Math.sin(st * 21) * 0.05, Math.cos(st * 7) * thrash));
        this.bobberPos.copy(bob.position).setY(0.02);
        rig.setLine(tip, bob.position, 0, 0.035, time);
        this.fxAcc += dt;
        if (this.fxAcc > (rarity === 'legendary' ? 0.08 : 0.16)) {
          this.fxAcc = 0;
          fx.splash(this.bobberPos, rarity === 'legendary' ? 0.9 : 0.45);
          if (this.fsm.cycle?.success && rarity !== 'common') fx.sparkle(this.bobberPos.clone().setY(0.3), rarity, 3);
        }
        break;
      }
      case 'CATCH': {
        bob.visible = false;
        if (this.fish) {
          const k = Ease.outQuad(p);
          this.fish.position.lerpVectors(this.fishFrom, this.displayPos, k);
          this.fish.position.y += Math.sin(k * Math.PI) * 2.2;
          this.fish.rotation.set(0, time * 3, Math.sin(time * 18) * 0.5 + (1 - k) * 1.2);
          rig.setLine(tip, this.fish.position, 0);
          fx.drops.emit(this.fish.position, { count: 1, colors: ['#e0f7ff'], speed: [0.2, 0.8], gravity: -9, life: [0.4, 0.7], size: [0.08, 0.14] });
        } else rig.hideLine();
        break;
      }
      case 'RESULT':
      case 'CELEBRATE': {
        bob.visible = false;
        if (this.fish) {
          this.fish.position.copy(this.displayPos);
          this.fish.position.y += Math.sin(time * 2.5) * 0.12;
          this.fish.rotation.set(0, this.fish.rotation.y + dt * 1.6, Math.sin(time * 5) * 0.25);
          rig.setLine(tip, this.fish.position, 0.15);
          this.fxAcc += dt;
          const every = rarity === 'legendary' ? 0.06 : rarity === 'epic' ? 0.1 : rarity === 'rare' ? 0.16 : 0.35;
          if (this.fxAcc > every && rarity !== 'common') {
            this.fxAcc = 0;
            fx.sparkle(this.fish.position, rarity, rarity === 'legendary' ? 5 : 2);
            if (rarity === 'rare' || rarity === 'epic' || rarity === 'legendary') {
              fx.glow.emit(this.fish.position, { count: 2, colors: RARITY_FX[rarity].colors, speed: [0.4, 1.2], gravity: 0.8, life: [0.6, 1.1], size: [0.15, 0.3], drag: 1, radius: 0.5 });
            }
          }
        } else rig.hideLine();
        break;
      }
      case 'FAIL': {
        const k = segment(p, 0, 0.4);
        bob.position.lerpVectors(this.releasePos, tmp.copy(tip).add(tmp2.set(0, -0.55, 0)), Ease.outQuad(k));
        bob.position.y += Math.sin(k * Math.PI) * 1.2;
        rig.setLine(tip, bob.position, 0.3 * (1 - k));
        break;
      }
    }
  }
}
