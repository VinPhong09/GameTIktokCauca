import * as THREE from 'three';
import type { CatAppearance } from '@shared/types';
import { colorize, limb, merge, part } from '../core/geometry';

export interface CatGeometry {
  torso: THREE.BufferGeometry;
  head: THREE.BufferGeometry;
  eyes: THREE.BufferGeometry;
  tail: THREE.BufferGeometry;
  arms: THREE.BufferGeometry;
  rod: THREE.BufferGeometry;
  whiskers: THREE.BufferGeometry;
  whiskerColor: string;
}

/** Layout constants shared with CatActor (local cat space, +Z = facing direction). */
export const CAT = {
  headPivot: new THREE.Vector3(0, 0.92, 0.02),
  tailPivot: new THREE.Vector3(0, 0.22, -0.36),
  rigPivot: new THREE.Vector3(0, 0.6, 0.24),
  rodLength: 2.5,
  height: 1.85,
  /** Overall model scale in the world (bigger = more readable on phones). */
  scale: 1.3,
};

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

function patches(cat: CatAppearance, target: 'body' | 'head'): THREE.BufferGeometry[] {
  const out: THREE.BufferGeometry[] = [];
  const A = cat.colors.patternA;
  const B = cat.colors.patternB;
  switch (cat.pattern) {
    case 'tabby':
      if (target === 'head') {
        for (const x of [-0.11, 0, 0.11]) out.push(part(new THREE.SphereGeometry(0.1, 6, 5), A, { pos: [x, 0.62, 0.2], scale: [0.28, 0.12, 0.9], rot: [-0.6, 0, 0] }));
        for (const s of [1, -1]) out.push(part(new THREE.SphereGeometry(0.1, 6, 5), A, { pos: [s * 0.37, 0.3, 0.12], scale: [0.2, 0.15, 0.8], rot: [0, s * 0.9, 0] }));
      } else {
        for (const y of [0.78, 0.6, 0.42]) out.push(part(new THREE.SphereGeometry(0.2, 8, 6), A, { pos: [0, y, -0.32], scale: [1.9, 0.22, 0.6] }));
      }
      break;
    case 'calico':
      if (target === 'head') {
        out.push(part(new THREE.SphereGeometry(0.2, 8, 6), A, { pos: [0.2, 0.5, 0.12], scale: [1, 0.8, 0.9] }));
        out.push(part(new THREE.SphereGeometry(0.16, 8, 6), B, { pos: [-0.24, 0.48, 0.0], scale: [1, 0.8, 1] }));
      } else {
        out.push(part(new THREE.SphereGeometry(0.24, 8, 6), A, { pos: [-0.22, 0.62, -0.24], scale: [1, 0.85, 0.7] }));
        out.push(part(new THREE.SphereGeometry(0.2, 8, 6), B, { pos: [0.24, 0.38, -0.26], scale: [1, 0.85, 0.7] }));
        out.push(part(new THREE.SphereGeometry(0.15, 8, 6), A, { pos: [0.18, 0.8, -0.18], scale: [1, 0.7, 0.8] }));
      }
      break;
    case 'bicolor':
      if (target === 'head') out.push(part(new THREE.SphereGeometry(0.24, 8, 6), A, { pos: [-0.18, 0.5, 0.06], scale: [1, 0.85, 1] }));
      else {
        out.push(part(new THREE.SphereGeometry(0.28, 8, 6), A, { pos: [0.2, 0.62, -0.22], scale: [1, 0.9, 0.7] }));
        out.push(part(new THREE.SphereGeometry(0.2, 8, 6), A, { pos: [-0.25, 0.34, -0.22], scale: [1, 0.8, 0.7] }));
      }
      break;
    case 'spotted': {
      const spots = target === 'head'
        ? [[0.16, 0.55, 0.22], [-0.2, 0.5, 0.18], [0.3, 0.32, 0.18], [-0.32, 0.28, 0.14]]
        : [[0.2, 0.7, -0.3], [-0.2, 0.62, -0.3], [0, 0.45, -0.36], [0.33, 0.4, -0.15], [-0.34, 0.45, -0.12], [0.1, 0.85, -0.22]];
      for (const s of spots) out.push(part(new THREE.SphereGeometry(0.07, 6, 5), A, { pos: s as [number, number, number], scale: [1, 0.8, 0.5] }));
      break;
    }
  }
  return out;
}

function hat(cat: CatAppearance): THREE.BufferGeometry[] {
  const c = cat.outfit.hatColor;
  const trim = cat.outfit.trim;
  switch (cat.outfit.hat) {
    case 'bucket':
      return [
        part(new THREE.CylinderGeometry(0.3, 0.36, 0.24, 14), c, { pos: [0, 0.7, 0.02] }),
        part(new THREE.CylinderGeometry(0.55, 0.55, 0.035, 18), c, { pos: [0, 0.58, 0.02], rot: [0.08, 0, 0] }),
        part(new THREE.CylinderGeometry(0.365, 0.365, 0.06, 14, 1, true), trim, { pos: [0, 0.62, 0.02] }),
      ];
    case 'cap':
      return [
        part(new THREE.SphereGeometry(0.4, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), c, { pos: [0, 0.5, 0.02], scale: [1.08, 0.75, 1.05] }),
        part(new THREE.CylinderGeometry(0.28, 0.28, 0.03, 12, 1, false, -Math.PI / 2, Math.PI), c, { pos: [0, 0.53, 0.3], scale: [1, 1, 1.25], rot: [0.12, 0, 0] }),
        part(new THREE.SphereGeometry(0.05, 6, 5), trim, { pos: [0, 0.81, 0.02] }),
      ];
    case 'straw':
      return [
        part(new THREE.CylinderGeometry(0.27, 0.32, 0.2, 12), c, { pos: [0, 0.7, 0.02] }),
        part(new THREE.CylinderGeometry(0.7, 0.72, 0.03, 20), c, { pos: [0, 0.6, 0.02] }),
        part(new THREE.CylinderGeometry(0.325, 0.325, 0.06, 12, 1, true), '#e63946', { pos: [0, 0.64, 0.02] }),
      ];
    case 'beanie':
      return [
        part(new THREE.SphereGeometry(0.42, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), c, { pos: [0, 0.48, 0.02], scale: [1.05, 0.85, 1.05] }),
        part(new THREE.TorusGeometry(0.42, 0.06, 6, 18), trim, { pos: [0, 0.5, 0.02], rot: [Math.PI / 2, 0, 0], scale: [1.05, 1.05, 1] }),
        part(new THREE.SphereGeometry(0.1, 8, 6), trim, { pos: [0, 0.86, 0.02] }),
      ];
    default:
      return [];
  }
}

const cache = new Map<string, CatGeometry>();

export function buildCatGeometry(cat: CatAppearance): CatGeometry {
  const key = cat.id + JSON.stringify(cat.colors) + JSON.stringify(cat.outfit) + cat.pattern + cat.foldedEars + cat.fluffy;
  const hit = cache.get(key);
  if (hit) return hit;
  const C = cat.colors;
  const fluff = cat.fluffy ? 1.08 : 1;

  // ---- Torso (pivot = stool top) ----------------------------------------
  const torso = merge([
    part(new THREE.SphereGeometry(0.42, 16, 12), C.body, { pos: [0, 0.48, 0], scale: [1 * fluff, 1.12, 0.95 * fluff] }),
    part(new THREE.SphereGeometry(0.3, 12, 10), C.belly, { pos: [0, 0.44, 0.2], scale: [1, 1.15, 0.7] }),
    // Fishing vest band
    part(new THREE.SphereGeometry(0.44, 16, 10, 0, Math.PI * 2, 0.95, 1.05), cat.outfit.vest, { pos: [0, 0.48, 0], scale: [1.01 * fluff, 1.12, 0.96 * fluff] }),
    part(new THREE.BoxGeometry(0.14, 0.12, 0.05), cat.outfit.trim, { pos: [0.18, 0.5, 0.39], rot: [0.1, 0.35, 0] }),
    part(new THREE.BoxGeometry(0.14, 0.12, 0.05), cat.outfit.trim, { pos: [-0.18, 0.5, 0.39], rot: [0.1, -0.35, 0] }),
    // Hind legs + feet
    part(new THREE.SphereGeometry(0.22, 10, 8), C.body, { pos: [0.27, 0.17, 0.06], scale: [0.9, 0.75, 1.25] }),
    part(new THREE.SphereGeometry(0.22, 10, 8), C.body, { pos: [-0.27, 0.17, 0.06], scale: [0.9, 0.75, 1.25] }),
    part(new THREE.SphereGeometry(0.11, 8, 6), C.paw, { pos: [0.24, 0.06, 0.34], scale: [1, 0.6, 1.5] }),
    part(new THREE.SphereGeometry(0.11, 8, 6), C.paw, { pos: [-0.24, 0.06, 0.34], scale: [1, 0.6, 1.5] }),
    ...patches(cat, 'body'),
  ]);

  // ---- Head (pivot at neck) ----------------------------------------------
  const hasHat = cat.outfit.hat !== 'none';
  const earX = hasHat ? 0.29 : 0.24;
  const earY = hasHat ? 0.6 : 0.64;
  const ears: THREE.BufferGeometry[] = [];
  for (const s of [1, -1]) {
    if (cat.foldedEars) {
      ears.push(part(new THREE.ConeGeometry(0.13, 0.18, 4), C.ear, { pos: [s * (earX - 0.02), earY - 0.04, 0.08], rot: [1.1, 0, -s * 0.5] }));
    } else {
      ears.push(part(new THREE.ConeGeometry(0.15, 0.3, 4), C.ear, { pos: [s * earX, earY, 0.0], rot: [-0.1, s * 0.25, -s * 0.38] }));
      ears.push(part(new THREE.ConeGeometry(0.09, 0.2, 4), C.earInner, { pos: [s * earX * 0.97, earY - 0.03, 0.05], rot: [-0.1, s * 0.25, -s * 0.38] }));
    }
  }
  const head = merge([
    part(new THREE.SphereGeometry(0.4, 18, 14), C.body, { pos: [0, 0.3, 0.04], scale: [1.12 * fluff, 0.95, 1] }),
    part(new THREE.SphereGeometry(0.17, 12, 8), C.muzzle, { pos: [0, 0.2, 0.36], scale: [1.35, 0.8, 0.8] }),
    part(new THREE.SphereGeometry(0.045, 8, 6), C.nose, { pos: [0, 0.27, 0.49], scale: [1.3, 0.9, 1] }),
    part(new THREE.TorusGeometry(0.035, 0.012, 4, 8, Math.PI), '#5a3a3a', { pos: [0.033, 0.19, 0.48], rot: [0, 0, Math.PI] }),
    part(new THREE.TorusGeometry(0.035, 0.012, 4, 8, Math.PI), '#5a3a3a', { pos: [-0.033, 0.19, 0.48], rot: [0, 0, Math.PI] }),
    part(new THREE.SphereGeometry(0.07, 8, 6), '#ff9eb5', { pos: [0.27, 0.18, 0.3], scale: [1, 0.6, 0.4] }),
    part(new THREE.SphereGeometry(0.07, 8, 6), '#ff9eb5', { pos: [-0.27, 0.18, 0.3], scale: [1, 0.6, 0.4] }),
    ...(cat.fluffy ? [part(new THREE.SphereGeometry(0.2, 8, 6), C.belly, { pos: [0, 0.0, 0.2], scale: [1.4, 0.6, 0.8] })] : []),
    ...ears,
    ...patches(cat, 'head'),
    ...hat(cat),
  ]);

  // ---- Eyes (separate mesh for blinking) -----------------------------------
  const eyeParts: THREE.BufferGeometry[] = [];
  for (const s of [1, -1]) {
    eyeParts.push(part(new THREE.SphereGeometry(0.085, 10, 8), C.eye, { pos: [s * 0.15, 0, 0], scale: [1, 1.15, 0.5] }));
    eyeParts.push(part(new THREE.SphereGeometry(0.055, 8, 6), '#141414', { pos: [s * 0.15, -0.005, 0.03], scale: [1, 1.2, 0.5] }));
    eyeParts.push(part(new THREE.SphereGeometry(0.022, 6, 4), '#ffffff', { pos: [s * 0.15 + 0.025, 0.035, 0.055] }));
  }
  const eyes = merge(eyeParts);

  // ---- Tail -----------------------------------------------------------------
  const curve = new THREE.CatmullRomCurve3([V(0, 0, 0), V(0, 0.05, -0.3), V(0, 0.4, -0.52), V(0.08, 0.8, -0.44), V(0.18, 0.98, -0.3)]);
  const tailR = cat.fluffy ? 0.1 : 0.075;
  const tailParts = [
    colorize(new THREE.TubeGeometry(curve, 16, tailR, 7, false), C.tail),
    part(new THREE.SphereGeometry(tailR * 1.05, 8, 6), C.tailTip, { pos: [0.18, 0.98, -0.3] }),
  ];
  if (cat.pattern === 'tabby') {
    for (const t of [0.35, 0.55, 0.75]) {
      const p = curve.getPoint(t);
      const tan = curve.getTangent(t);
      const ring = new THREE.TorusGeometry(tailR * 1.02, 0.025, 4, 10);
      ring.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), tan));
      ring.translate(p.x, p.y, p.z);
      tailParts.push(colorize(ring, C.patternA));
    }
  }
  const tail = merge(tailParts);

  // ---- Arms (in rig space; rig pivot at chest) -------------------------------
  const arms = merge([
    limb(V(0.3, 0.12, -0.12), V(0.08, -0.02, 0.22), 0.085, C.body),
    limb(V(-0.3, 0.12, -0.12), V(-0.08, -0.02, 0.22), 0.085, C.body),
    part(new THREE.SphereGeometry(0.1, 8, 6), C.paw, { pos: [0.07, -0.02, 0.25] }),
    part(new THREE.SphereGeometry(0.1, 8, 6), C.paw, { pos: [-0.07, -0.02, 0.25] }),
    // vest sleeves
    part(new THREE.SphereGeometry(0.11, 8, 6), cat.outfit.vest, { pos: [0.28, 0.1, -0.1], scale: [1, 1, 1.1] }),
    part(new THREE.SphereGeometry(0.11, 8, 6), cat.outfit.vest, { pos: [-0.28, 0.1, -0.1], scale: [1, 1, 1.1] }),
  ]);

  // ---- Rod (along +Z in rig space) -------------------------------------------
  const L = CAT.rodLength;
  const rod = merge([
    part(new THREE.CylinderGeometry(0.035, 0.045, 0.5, 6), '#3b2a1a', { pos: [0, -0.02, 0.15], rot: [Math.PI / 2, 0, 0] }),
    part(new THREE.CylinderGeometry(0.012, 0.03, L, 6), cat.outfit.rod, { pos: [0, -0.02, 0.4 + L / 2], rot: [Math.PI / 2, 0, 0] }),
    part(new THREE.CylinderGeometry(0.06, 0.06, 0.05, 10), '#c0c0c0', { pos: [0.07, -0.08, 0.32], rot: [0, 0, Math.PI / 2] }),
    part(new THREE.TorusGeometry(0.02, 0.006, 4, 8), '#dddddd', { pos: [0, -0.04, 0.4 + L * 0.5] }),
    part(new THREE.TorusGeometry(0.016, 0.005, 4, 8), '#dddddd', { pos: [0, -0.03, 0.4 + L * 0.85] }),
  ]);

  // ---- Whiskers ----------------------------------------------------------------
  const w: number[] = [];
  for (const s of [1, -1]) {
    for (const dy of [0.05, 0, -0.05]) {
      w.push(s * 0.12, 0.22, 0.46, s * 0.5, 0.24 + dy * 1.8, 0.42 - Math.abs(dy));
    }
  }
  const whiskers = new THREE.BufferGeometry();
  whiskers.setAttribute('position', new THREE.Float32BufferAttribute(w, 3));

  const result: CatGeometry = { torso, head, eyes, tail, arms, rod, whiskers, whiskerColor: C.whisker };
  cache.set(key, result);
  return result;
}

/** Rod tip in rig space. */
export function rodTipLocal(out = new THREE.Vector3()) {
  return out.set(0, -0.02, 0.4 + CAT.rodLength);
}
