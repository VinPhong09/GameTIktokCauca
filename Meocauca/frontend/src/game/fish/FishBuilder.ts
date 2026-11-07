import * as THREE from 'three';
import type { FishDef, FishShape, FishVisual } from '@shared/types';
import { colorize, merge, part, toonGradient } from '../core/geometry';

interface ShapeSpec {
  body: [number, number, number];
  taper: number;
  tail: number;
  dorsal: number;
  head?: number;
}

const SHAPES: Record<FishShape, ShapeSpec> = {
  carp: { body: [1.0, 0.5, 0.3], taper: 0.45, tail: 0.6, dorsal: 0.4 },
  slim: { body: [1.15, 0.32, 0.22], taper: 0.5, tail: 0.5, dorsal: 0.3 },
  round: { body: [0.8, 0.62, 0.3], taper: 0.35, tail: 0.55, dorsal: 0.45 },
  catfish: { body: [1.1, 0.36, 0.38], taper: 0.55, tail: 0.5, dorsal: 0.25, head: 1.25 },
  koi: { body: [1.05, 0.45, 0.34], taper: 0.45, tail: 0.75, dorsal: 0.35 },
  trout: { body: [1.15, 0.4, 0.27], taper: 0.5, tail: 0.6, dorsal: 0.35 },
  crystal: { body: [1.0, 0.55, 0.35], taper: 0.4, tail: 0.7, dorsal: 0.5 },
  dragon: { body: [1.3, 0.38, 0.32], taper: 0.55, tail: 0.85, dorsal: 0.3 },
  emperor: { body: [0.95, 0.7, 0.32], taper: 0.35, tail: 0.75, dorsal: 0.55 },
  phoenix: { body: [1.0, 0.45, 0.3], taper: 0.45, tail: 1.1, dorsal: 0.5 },
  moon: { body: [0.75, 0.75, 0.22], taper: 0.25, tail: 0.6, dorsal: 0.5 },
  butterfly: { body: [0.95, 0.45, 0.3], taper: 0.45, tail: 0.95, dorsal: 0.55 },
  spirit: { body: [1.1, 0.45, 0.32], taper: 0.55, tail: 0.9, dorsal: 0.4 },
};

function hash3(x: number, y: number, z: number) {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return s - Math.floor(s);
}

/** Paint the body with vertex colors according to the pattern. */
function paintBody(geo: THREE.BufferGeometry, v: FishVisual, spec: ShapeSpec) {
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const body = new THREE.Color(v.bodyColor);
  const belly = new THREE.Color(v.bellyColor);
  const accent = new THREE.Color(v.accentColor);
  const c = new THREE.Color();
  const hsl = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) / spec.body[0];
    const y = pos.getY(i) / spec.body[1];
    const z = pos.getZ(i) / spec.body[2];
    c.copy(body);
    switch (v.pattern) {
      case 'spots':
        if (hash3(Math.floor(x * 6), Math.floor(y * 5), Math.floor(z * 4)) > 0.72 && y > -0.2) c.copy(accent);
        break;
      case 'stripes':
        if (Math.sin(x * 9.5) > 0.45 && y > -0.35) c.copy(accent);
        break;
      case 'koi':
        if (y > -0.15 && Math.sin(x * 4.2 + 1.3) * Math.sin(y * 4.5 + z * 3.2 + 0.7) > 0.18) c.copy(accent);
        break;
      case 'rainbow':
        hsl.setHSL(((x + 1) / 2) * 0.85, 0.85, 0.6);
        c.lerp(hsl, 0.65);
        break;
      case 'gradient':
        c.lerp(accent, (x + 1) / 2);
        break;
      case 'scales':
        if ((Math.floor(x * 10) + Math.floor(y * 8)) % 2 === 0) c.multiplyScalar(0.86);
        break;
    }
    if (y < -0.2) c.lerp(belly, THREE.MathUtils.smoothstep(-y, 0.2, 0.75));
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}

function finShape(points: [number, number][]): THREE.ShapeGeometry {
  const s = new THREE.Shape();
  s.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) s.lineTo(points[i][0], points[i][1]);
  s.closePath();
  return new THREE.ShapeGeometry(s);
}

function rainbowFin(geo: THREE.BufferGeometry) {
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    c.setHSL((pos.getY(i) + 1.2) * 0.35 + pos.getX(i) * 0.2, 0.9, 0.6);
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geo;
}

const geoCache = new Map<string, THREE.BufferGeometry>();
const matCache = new Map<string, THREE.MeshToonMaterial>();

export function fishGeometry(def: FishDef): THREE.BufferGeometry {
  const key = def.id + JSON.stringify(def.visual);
  const cached = geoCache.get(key);
  if (cached) return cached;
  const v = def.visual;
  const spec = SHAPES[v.shape] ?? SHAPES.carp;
  const [bx, by, bz] = spec.body;
  const parts: THREE.BufferGeometry[] = [];
  const rainbow = v.pattern === 'rainbow';

  // Body
  const bodyGeo = v.shape === 'crystal' ? new THREE.IcosahedronGeometry(1, 1) : new THREE.SphereGeometry(1, 22, 14);
  const p = bodyGeo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    // taper toward the tail, slightly bulbous head
    const k = x < 0 ? 1 + x * spec.taper : 1 + x * 0.08;
    const head = spec.head && x > 0.4 ? spec.head : 1;
    p.setXYZ(i, x * bx, p.getY(i) * by * k * (head > 1 ? 0.9 : 1), p.getZ(i) * bz * k * head);
  }
  bodyGeo.computeVertexNormals();
  paintBody(bodyGeo, v, spec);
  parts.push(bodyGeo);

  // Tail fin
  const t = spec.tail;
  const tailPts: [number, number][] = v.extras?.includes('longFins') || v.shape === 'phoenix' || v.shape === 'butterfly'
    ? [[0, 0], [-t * 0.7, t * 0.75], [-t * 1.15, t * 0.55], [-t * 0.7, 0], [-t * 1.15, -t * 0.55], [-t * 0.7, -t * 0.75]]
    : [[0, 0], [-t * 0.75, t * 0.6], [-t * 0.55, 0], [-t * 0.75, -t * 0.6]];
  const tail = finShape(tailPts);
  tail.translate(-bx * 0.92, 0, 0);
  parts.push(rainbow ? rainbowFin(tail) : colorize(tail, v.finColor));

  // Dorsal fin
  const d = spec.dorsal;
  const dorsal = finShape([[-0.45 * bx, 0], [0.25 * bx, 0], [-0.35 * bx, d]]);
  dorsal.translate(0, by * 0.85, 0);
  parts.push(rainbow ? rainbowFin(dorsal) : colorize(dorsal, v.finColor));
  // Belly fin
  const ventral = finShape([[-0.1 * bx, 0], [0.25 * bx, 0], [-0.05 * bx, -d * 0.5]]);
  ventral.translate(0, -by * 0.85, 0);
  parts.push(colorize(ventral, v.finColor));

  // Pectoral fins (angled out from the sides)
  const pecSize = v.extras?.includes('longFins') ? 0.55 : 0.32;
  for (const side of [1, -1]) {
    const pec = finShape([[0, 0], [-pecSize, pecSize * 0.45], [-pecSize * 0.8, -pecSize * 0.3]]);
    pec.rotateX(side * 1.1);
    pec.translate(bx * 0.3, -by * 0.3, side * bz * 0.75);
    parts.push(rainbow ? rainbowFin(pec) : colorize(pec, v.finColor));
  }

  // Eyes
  for (const side of [1, -1]) {
    parts.push(part(new THREE.SphereGeometry(0.11, 10, 8), '#ffffff', { pos: [bx * 0.66, by * 0.22, side * bz * 0.72] }));
    parts.push(part(new THREE.SphereGeometry(0.068, 8, 6), '#111111', { pos: [bx * 0.7, by * 0.24, side * bz * 0.8] }));
    parts.push(part(new THREE.SphereGeometry(0.025, 5, 4), '#ffffff', { pos: [bx * 0.72, by * 0.3, side * bz * 0.86] }));
  }
  // Mouth
  parts.push(part(new THREE.TorusGeometry(0.06, 0.02, 4, 8), '#c2185b', { pos: [bx * 0.98, -by * 0.1, 0], rot: [0, Math.PI / 2, 0] }));

  const extras = v.extras ?? [];
  if (extras.includes('whiskers')) {
    for (const side of [1, -1]) {
      for (const k of [0, 1]) {
        const w = new THREE.CylinderGeometry(0.015, 0.008, 0.6, 3);
        w.rotateZ(Math.PI / 2 + 0.5 + k * 0.4);
        w.rotateY(side * 0.5);
        w.translate(bx * 1.05, -by * 0.15 - k * 0.05, side * bz * 0.35);
        parts.push(colorize(w, v.accentColor));
      }
    }
  }
  if (extras.includes('horns')) {
    for (const side of [1, -1]) {
      const h = new THREE.ConeGeometry(0.07, 0.42, 5);
      h.rotateZ(0.9);
      h.translate(bx * 0.55, by * 1.05, side * bz * 0.35);
      parts.push(colorize(h, v.accentColor));
    }
  }
  if (extras.includes('mane')) {
    for (let i = 0; i < 7; i++) {
      const x = bx * (0.4 - i * 0.18);
      const m = new THREE.ConeGeometry(0.08, 0.3 - i * 0.02, 4);
      m.rotateZ(0.6);
      m.translate(x, by * (0.95 - Math.abs(i - 2) * 0.05), 0);
      parts.push(colorize(m, i % 2 ? v.accentColor : v.finColor));
    }
  }
  if (extras.includes('crown')) {
    parts.push(part(new THREE.CylinderGeometry(0.2, 0.22, 0.12, 10, 1, true), '#ffd700', { pos: [bx * 0.35, by * 1.05, 0] }));
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      parts.push(part(new THREE.ConeGeometry(0.05, 0.18, 4), '#ffd700', { pos: [bx * 0.35 + Math.cos(a) * 0.19, by * 1.05 + 0.13, Math.sin(a) * 0.19] }));
    }
    parts.push(part(new THREE.SphereGeometry(0.05, 6, 5), '#ff2e63', { pos: [bx * 0.35, by * 1.05, 0.21] }));
  }
  if (extras.includes('wings')) {
    for (const side of [1, -1]) {
      const wing = finShape([[0, 0], [-0.5, 0.75], [-0.95, 0.55], [-0.7, 0.1]]);
      wing.rotateX(side * 0.75);
      wing.translate(bx * 0.15, by * 0.4, side * bz * 0.5);
      parts.push(rainbowFin(wing));
    }
  }
  if (extras.includes('crescent')) {
    parts.push(part(new THREE.TorusGeometry(bx * 1.25, 0.05, 6, 30, Math.PI * 1.1), '#fff7c2', { rot: [0, 0, Math.PI * 0.45] }));
  }
  if (extras.includes('crystalSpikes')) {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      parts.push(part(new THREE.ConeGeometry(0.06, 0.28, 4), v.accentColor, { pos: [bx * (0.3 - (i % 3) * 0.3), Math.cos(a) * by * 0.9, Math.sin(a) * bz * 0.9], rot: [a, 0, 0] }));
    }
  }
  if (extras.includes('halo')) {
    parts.push(part(new THREE.TorusGeometry(0.35, 0.03, 6, 24), '#fffbe0', { pos: [bx * 0.2, by * 1.6, 0], rot: [Math.PI / 2, 0, 0] }));
  }

  const geo = merge(parts);
  geo.scale(0.5, 0.5, 0.5); // Normalized length ≈ 1.3 units.
  geoCache.set(key, geo);
  return geo;
}

export function fishMaterial(def: FishDef): THREE.MeshToonMaterial {
  const v = def.visual;
  const key = `${v.emissive}|${v.emissiveIntensity}|${v.opacity}|${v.shape}`;
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshToonMaterial({
      vertexColors: true,
      gradientMap: toonGradient(),
      side: THREE.DoubleSide,
      emissive: new THREE.Color(v.emissive ?? '#000000'),
      emissiveIntensity: v.emissiveIntensity ?? 0,
      transparent: (v.opacity ?? 1) < 1,
      opacity: v.opacity ?? 1,
    });
    matCache.set(key, m);
  }
  return m;
}

export function buildFishMesh(def: FishDef): THREE.Mesh {
  const mesh = new THREE.Mesh(fishGeometry(def), fishMaterial(def));
  mesh.castShadow = true;
  const s = def.visual.scale ?? 1;
  mesh.scale.setScalar(s);
  return mesh;
}

export function clearFishCache() {
  geoCache.forEach((g) => g.dispose());
  geoCache.clear();
}
