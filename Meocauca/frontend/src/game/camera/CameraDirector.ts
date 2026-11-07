import * as THREE from 'three';
import type { UiSettings } from '@shared/types';
import { damp } from '../core/Tween';
import { SEAT_RADIUS } from '../pond/constants';

/** Points that must stay on screen: cat bodies around the ring and the name tags above them. */
const FIT_POINTS: THREE.Vector3[] = (() => {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    const c = Math.cos(a);
    const z = Math.sin(a);
    pts.push(new THREE.Vector3(c * (SEAT_RADIUS + 0.7), 0.3, z * (SEAT_RADIUS + 0.7)));
    // Cats are drawn at 1.3× scale; the higher (staggered) name pill tops out at ≈5.2 m.
    pts.push(new THREE.Vector3(c * (SEAT_RADIUS + 0.4), 5.3, z * (SEAT_RADIUS + 0.4)));
  }
  return pts;
})();

interface Focus {
  target: THREE.Vector3;
  until: number;
  priority: number;
  /** 0..1 – how close we move toward the target (smaller = closer). */
  closeness: number;
  /** 0..1 – how far the view turns toward the target (1 = target dead center). */
  lookBlend: number;
}

/**
 * Elevated overview that always fits the whole pond in a 9:16 frame, with gentle idle drift.
 * focus() smoothly moves toward a cat (rare/epic/legendary catch) and returns to the overview.
 */
export class CameraDirector {
  private pos = new THREE.Vector3();
  private look = new THREE.Vector3();
  private basePos = new THREE.Vector3();
  private baseLook = new THREE.Vector3();
  private focusState: Focus | null = null;
  private clock = 0;
  private settings: UiSettings['camera'] = { fov: 50, elevationDeg: 64, zoom: 1, offsetZ: 0, focusEnabled: true, welcomeFocus: true, welcomeSec: 3 };
  /**
   * Free vertical band of the screen (fractions from the top) between the top HUD and the bottom HUD.
   * The pond ring + cats + name tags are fitted inside it so the HUD never covers a cat.
   */
  private band = { top: 0.02, bottom: 0.98 };

  constructor(private camera: THREE.PerspectiveCamera) {
    this.configure(this.settings);
    this.pos.copy(this.basePos);
    this.look.copy(this.baseLook);
  }

  configure(s: UiSettings['camera']) {
    this.settings = { ...s };
    this.camera.fov = s.fov;
    this.camera.updateProjectionMatrix();
    this.recompute();
  }

  setBand(top: number, bottom: number) {
    const t = THREE.MathUtils.clamp(top, 0, 0.8);
    const b = THREE.MathUtils.clamp(bottom, t + 0.15, 1);
    if (Math.abs(t - this.band.top) < 0.002 && Math.abs(b - this.band.bottom) < 0.002) return;
    this.band = { top: t, bottom: b };
    this.recompute();
  }

  /**
   * Finds the camera distance that fits every cat (and its name tag) inside the free band,
   * then shifts the projection (view offset) so the pond is centered in that band.
   */
  recompute() {
    const s = this.settings;
    const cam = this.camera;
    const el = THREE.MathUtils.degToRad(THREE.MathUtils.clamp(s.elevationDeg, 25, 88));
    const dir = new THREE.Vector3(0, Math.sin(el), Math.cos(el));
    const look = new THREE.Vector3(0, 0, s.offsetZ);
    cam.clearViewOffset();
    cam.updateProjectionMatrix();

    const targetW = 2 * 0.95;
    const targetH = 2 * (this.band.bottom - this.band.top) * 0.97;
    const v = new THREE.Vector3();
    const box = { minX: 0, maxX: 0, minY: 0, maxY: 0 };
    const measure = (d: number) => {
      cam.position.copy(look).addScaledVector(dir, d);
      cam.lookAt(look);
      cam.updateMatrixWorld(true);
      box.minX = box.minY = Infinity;
      box.maxX = box.maxY = -Infinity;
      for (const p of FIT_POINTS) {
        v.copy(p).project(cam);
        box.minX = Math.min(box.minX, v.x);
        box.maxX = Math.max(box.maxX, v.x);
        box.minY = Math.min(box.minY, v.y);
        box.maxY = Math.max(box.maxY, v.y);
      }
    };
    let d = 30;
    for (let i = 0; i < 14; i++) {
      measure(d);
      const f = Math.max((box.maxX - box.minX) / targetW, (box.maxY - box.minY) / targetH);
      if (Math.abs(f - 1) < 0.002) break;
      d *= f;
    }
    d /= Math.max(0.3, s.zoom);
    measure(d);
    this.baseLook.copy(look);
    this.basePos.copy(look).addScaledVector(dir, d);

    // Center the fitted ring inside the band (NDC y is +1 at the top of the screen).
    const bandCenter = 1 - (this.band.top + this.band.bottom);
    const shift = bandCenter - (box.minY + box.maxY) / 2;
    const H = 1000;
    const W = H * cam.aspect;
    cam.setViewOffset(W, H, 0, (shift * H) / 2, W, H);
    cam.updateProjectionMatrix();
  }

  focus(target: THREE.Vector3, seconds: number, priority: number, closeness = 0.7, lookBlend = 0.8) {
    this.clock = performance.now() / 1000;
    if (this.focusState && this.focusState.priority > priority && this.focusState.until > this.clock) return;
    this.focusState = { target: target.clone(), until: this.clock + seconds, priority, closeness, lookBlend };
  }

  /** True while a focus with a higher priority than this still owns the camera. */
  isBusy(priority: number) {
    const f = this.focusState;
    return !!f && f.until > this.clock && f.priority > priority;
  }

  /** Ends the current focus early if it was made with this priority (e.g. a finished welcome). */
  release(priority: number) {
    if (this.focusState && this.focusState.priority === priority) this.focusState = null;
  }

  clearFocus() {
    this.focusState = null;
  }

  update(dt: number) {
    // Wall clock: focus durations stay correct even when the page renders slowly (OBS throttling).
    this.clock = performance.now() / 1000;
    const desiredPos = new THREE.Vector3().copy(this.basePos);
    const desiredLook = new THREE.Vector3().copy(this.baseLook);
    // Idle drift (very subtle so the pond overview stays stable).
    desiredPos.x += Math.sin(this.clock * 0.13) * 0.35;
    desiredPos.y += Math.sin(this.clock * 0.09) * 0.25;
    let lambda = 1.4;
    const f = this.focusState;
    if (f && f.until > this.clock) {
      // Aim between the cat and the fish displayed above its head.
      const look = f.target.clone().setY(3.2);
      desiredLook.lerpVectors(this.baseLook, look, f.lookBlend);
      // Move along the overview direction, closer to the cat (keeps the pond context).
      const dir = new THREE.Vector3().subVectors(this.basePos, this.baseLook);
      desiredPos.copy(desiredLook).addScaledVector(dir, f.closeness * 0.6);
      lambda = 1.8;
    } else if (f) {
      this.focusState = null;
    }
    this.pos.x = damp(this.pos.x, desiredPos.x, lambda, dt);
    this.pos.y = damp(this.pos.y, desiredPos.y, lambda, dt);
    this.pos.z = damp(this.pos.z, desiredPos.z, lambda, dt);
    this.look.x = damp(this.look.x, desiredLook.x, lambda * 1.2, dt);
    this.look.y = damp(this.look.y, desiredLook.y, lambda * 1.2, dt);
    this.look.z = damp(this.look.z, desiredLook.z, lambda * 1.2, dt);
    this.camera.position.copy(this.pos);
    this.camera.lookAt(this.look);
  }
}
