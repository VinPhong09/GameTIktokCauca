import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const tmpColor = new THREE.Color();

/** Adds a uniform vertex color attribute (and strips nothing else) so parts can be merged. */
export function colorize(geo: THREE.BufferGeometry, color: THREE.ColorRepresentation): THREE.BufferGeometry {
  const g = geo.index ? geo : geo;
  tmpColor.set(color);
  const count = g.attributes.position.count;
  const arr = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    arr[i * 3] = tmpColor.r;
    arr[i * 3 + 1] = tmpColor.g;
    arr[i * 3 + 2] = tmpColor.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}

/** Normalize a geometry to indexed form with position/normal/uv/color so mergeGeometries works. */
function normalizeAttrs(g: THREE.BufferGeometry): THREE.BufferGeometry {
  let geo = g;
  if (!geo.index) {
    const count = geo.attributes.position.count;
    const idx: number[] = [];
    for (let i = 0; i < count; i++) idx.push(i);
    geo.setIndex(idx);
  }
  if (!geo.attributes.normal) geo.computeVertexNormals();
  if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
  if (!geo.attributes.color) colorize(geo, '#ffffff');
  for (const name of Object.keys(geo.attributes)) {
    if (!['position', 'normal', 'uv', 'color'].includes(name)) geo.deleteAttribute(name);
  }
  geo.morphAttributes = {};
  geo.clearGroups();
  return geo;
}

export function merge(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const ready = parts.map(normalizeAttrs);
  const merged = mergeGeometries(ready, false);
  if (!merged) throw new Error('mergeGeometries failed');
  ready.forEach((p) => p.dispose());
  merged.computeBoundingSphere();
  return merged;
}

export interface PartOpts {
  pos?: [number, number, number];
  rot?: [number, number, number];
  scale?: [number, number, number] | number;
}

/** Applies scale → rotation → translation to a geometry and colors it. */
export function part(geo: THREE.BufferGeometry, color: THREE.ColorRepresentation, o: PartOpts = {}): THREE.BufferGeometry {
  const m = new THREE.Matrix4();
  const s = typeof o.scale === 'number' ? [o.scale, o.scale, o.scale] : o.scale ?? [1, 1, 1];
  m.compose(
    new THREE.Vector3(...(o.pos ?? [0, 0, 0])),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...(o.rot ?? [0, 0, 0]))),
    new THREE.Vector3(s[0], s[1], s[2]),
  );
  geo.applyMatrix4(m);
  return colorize(geo, color);
}

/** Capsule-like limb between two points. */
export function limb(from: THREE.Vector3, to: THREE.Vector3, radius: number, color: THREE.ColorRepresentation, segments = 8): THREE.BufferGeometry {
  const dir = new THREE.Vector3().subVectors(to, from);
  const len = dir.length();
  const geo = new THREE.CapsuleGeometry(radius, Math.max(0.001, len), 3, segments);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  const m = new THREE.Matrix4().compose(new THREE.Vector3().addVectors(from, to).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1));
  geo.applyMatrix4(m);
  return colorize(geo, color);
}

/** 3-step toon gradient for the cute cel-shaded look. */
let gradient: THREE.DataTexture | null = null;
export function toonGradient(): THREE.DataTexture {
  if (gradient) return gradient;
  const data = new Uint8Array([90, 90, 90, 255, 170, 170, 170, 255, 235, 235, 235, 255, 255, 255, 255, 255]);
  gradient = new THREE.DataTexture(data, 4, 1, THREE.RGBAFormat);
  gradient.minFilter = THREE.NearestFilter;
  gradient.magFilter = THREE.NearestFilter;
  gradient.needsUpdate = true;
  return gradient;
}

/** Shared vertex-colored materials (one material for all cats → fewer state changes). */
let catMat: THREE.MeshToonMaterial | null = null;
export function sharedToonMaterial(): THREE.MeshToonMaterial {
  if (!catMat) catMat = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toonGradient() });
  return catMat;
}

const flatMats = new Map<string, THREE.MeshStandardMaterial>();
export function flatMaterial(key = 'default', opts: THREE.MeshStandardMaterialParameters = {}): THREE.MeshStandardMaterial {
  let m = flatMats.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.85, metalness: 0, ...opts });
    flatMats.set(key, m);
  }
  return m;
}

/** Deterministic pseudo-random generator for procedural placement. */
export function mulberry(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Canvas texture helper. */
export function canvasTexture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  draw(ctx);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

let glowTex: THREE.Texture | null = null;
export function radialGlowTexture(): THREE.Texture {
  if (glowTex) return glowTex;
  glowTex = canvasTexture(128, 128, (ctx) => {
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.25, 'rgba(255,255,255,0.65)');
    g.addColorStop(0.6, 'rgba(255,255,255,0.18)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
  });
  return glowTex;
}
