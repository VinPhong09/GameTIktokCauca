import * as THREE from 'three';
import { colorize, flatMaterial, merge, mulberry } from '../core/geometry';
import { DECK_OUTER, ENTRANCE_ANGLES, angleDistance } from '../pond/constants';

const dummy = new THREE.Object3D();
const tint = new THREE.Color();

function instanced(geo: THREE.BufferGeometry, count: number, key: string, place: (i: number, d: THREE.Object3D, c: THREE.Color) => boolean, shadow = true) {
  const mesh = new THREE.InstancedMesh(geo, flatMaterial(key), count);
  let n = 0;
  for (let i = 0; i < count * 4 && n < count; i++) {
    dummy.position.set(0, 0, 0);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    tint.set(1, 1, 1);
    if (!place(i, dummy, tint)) continue;
    dummy.updateMatrix();
    mesh.setMatrixAt(n, dummy.matrix);
    mesh.setColorAt(n, tint);
    n++;
  }
  mesh.count = n;
  mesh.castShadow = shadow;
  mesh.receiveShadow = true;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  return mesh;
}

function nearEntrance(a: number, r: number) {
  return ENTRANCE_ANGLES.some((e) => angleDistance(a, e) * r < 2.4 && r < 30);
}

/** Front sector (toward the camera) stays low so trees never hide the pond. */
function inFrontSector(x: number, z: number) {
  return z > 9 && Math.abs(x) < 16 && Math.hypot(x, z) < 30;
}

export class Vegetation {
  readonly group = new THREE.Group();
  private sway: { mesh: THREE.InstancedMesh; base: THREE.Matrix4[] } | null = null;

  constructor(density = 1) {
    const rnd = mulberry(23);

    // ---- Trees (3 styles) ---------------------------------------------------
    const pine = merge([
      colorize(new THREE.CylinderGeometry(0.18, 0.26, 1.2, 6).translate(0, 0.6, 0), '#8b5a2b'),
      colorize(new THREE.ConeGeometry(1.4, 1.8, 7).translate(0, 1.8, 0), '#3f9b4a'),
      colorize(new THREE.ConeGeometry(1.1, 1.5, 7).translate(0, 2.7, 0), '#4cad55'),
      colorize(new THREE.ConeGeometry(0.75, 1.2, 7).translate(0, 3.5, 0), '#5cbd60'),
    ]);
    const round = merge([
      colorize(new THREE.CylinderGeometry(0.2, 0.3, 1.6, 6).translate(0, 0.8, 0), '#94603a'),
      colorize(new THREE.IcosahedronGeometry(1.35, 0).translate(0, 2.4, 0), '#66bb44'),
      colorize(new THREE.IcosahedronGeometry(0.95, 0).translate(0.7, 2.0, 0.3), '#77c94f'),
      colorize(new THREE.IcosahedronGeometry(0.85, 0).translate(-0.6, 2.9, -0.2), '#5aae3b'),
    ]);
    const blossom = merge([
      colorize(new THREE.CylinderGeometry(0.18, 0.28, 1.5, 6).translate(0, 0.75, 0), '#7d4f35'),
      colorize(new THREE.IcosahedronGeometry(1.3, 0).translate(0, 2.3, 0), '#ffb3cf'),
      colorize(new THREE.IcosahedronGeometry(0.9, 0).translate(0.75, 2.0, 0.2), '#ffc7dc'),
      colorize(new THREE.IcosahedronGeometry(0.8, 0).translate(-0.6, 2.8, 0.1), '#ff9fc2'),
    ]);
    const placeTree = (minR: number, maxR: number) => (_i: number, d: THREE.Object3D, c: THREE.Color) => {
      const a = rnd() * Math.PI * 2;
      const r = minR + Math.pow(rnd(), 0.8) * (maxR - minR);
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      if (nearEntrance(a, r) || inFrontSector(x, z)) return false;
      d.position.set(x, 0.05, z);
      const s = 0.9 + rnd() * 0.9 + (r > 30 ? 0.5 : 0);
      d.scale.set(s, s * (0.9 + rnd() * 0.3), s);
      d.rotation.y = rnd() * Math.PI * 2;
      c.setHSL(0.28 + rnd() * 0.06, 0.25, 0.85 + rnd() * 0.15);
      return true;
    };
    this.group.add(instanced(pine, Math.round(40 * density), 'pine', placeTree(15, 55)));
    this.group.add(instanced(round, Math.round(38 * density), 'round', placeTree(15.5, 50)));
    this.group.add(instanced(blossom, Math.round(14 * density), 'blossom', placeTree(16, 34)));

    // ---- Bushes ---------------------------------------------------------------
    const bush = merge([
      colorize(new THREE.IcosahedronGeometry(0.7, 0), '#5fb546'),
      colorize(new THREE.IcosahedronGeometry(0.5, 0).translate(0.55, -0.1, 0.1), '#6cc451'),
      colorize(new THREE.IcosahedronGeometry(0.45, 0).translate(-0.5, -0.15, -0.1), '#52a83c'),
    ]);
    this.group.add(instanced(bush, Math.round(60 * density), 'bush', (_i, d, c) => {
      const a = rnd() * Math.PI * 2;
      const r = DECK_OUTER + 1.2 + rnd() * 20;
      if (nearEntrance(a, r)) return false;
      d.position.set(Math.cos(a) * r, 0.35, Math.sin(a) * r);
      d.scale.setScalar(0.6 + rnd() * 0.7);
      d.rotation.y = rnd() * 6;
      c.setHSL(0.3, 0.2, 0.85 + rnd() * 0.2);
      return true;
    }));

    // ---- Rocks ------------------------------------------------------------------
    const rock = colorize(new THREE.DodecahedronGeometry(0.6, 0), '#a7a9b4');
    this.group.add(instanced(rock, Math.round(50 * density), 'rock', (_i, d, c) => {
      const a = rnd() * Math.PI * 2;
      const r = rnd() < 0.45 ? DECK_OUTER + 0.6 + rnd() * 3 : 16 + rnd() * 30;
      if (nearEntrance(a, r)) return false;
      d.position.set(Math.cos(a) * r, 0.15, Math.sin(a) * r);
      d.scale.set(0.5 + rnd() * 1.2, 0.4 + rnd() * 0.7, 0.5 + rnd() * 1.1);
      d.rotation.set(rnd(), rnd() * 6, rnd());
      c.setHSL(0.6, 0.06, 0.75 + rnd() * 0.25);
      return true;
    }));

    // ---- Flowers -------------------------------------------------------------------
    const petals: THREE.BufferGeometry[] = [colorize(new THREE.CylinderGeometry(0.025, 0.025, 0.45, 4).translate(0, 0.22, 0), '#3f9b3f')];
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      petals.push(colorize(new THREE.SphereGeometry(0.09, 5, 4).scale(1, 0.4, 1).translate(Math.cos(a) * 0.1, 0.46, Math.sin(a) * 0.1), '#ffffff'));
    }
    petals.push(colorize(new THREE.SphereGeometry(0.06, 5, 4).translate(0, 0.48, 0), '#ffe066'));
    const flower = merge(petals);
    const flowerColors = ['#ff7eb6', '#ffd23f', '#ff8a5b', '#b388ff', '#ffffff', '#7ad3ff', '#ff5d73'];
    this.group.add(instanced(flower, Math.round(320 * density), 'flower', (_i, d, c) => {
      const a = rnd() * Math.PI * 2;
      const r = DECK_OUTER + 0.6 + Math.pow(rnd(), 1.4) * 24;
      if (nearEntrance(a, r)) return false;
      d.position.set(Math.cos(a) * r, 0.06, Math.sin(a) * r);
      d.scale.setScalar(0.8 + rnd() * 0.8);
      d.rotation.y = rnd() * 6;
      c.set(flowerColors[Math.floor(rnd() * flowerColors.length)]);
      return true;
    }, false));

    // ---- Grass tufts ---------------------------------------------------------------
    const tuft = merge([
      colorize(new THREE.ConeGeometry(0.06, 0.45, 3).translate(0, 0.22, 0), '#5eb544'),
      colorize(new THREE.ConeGeometry(0.05, 0.35, 3).rotateZ(0.35).translate(0.08, 0.16, 0), '#6fc552'),
      colorize(new THREE.ConeGeometry(0.05, 0.38, 3).rotateZ(-0.35).translate(-0.08, 0.17, 0.02), '#4fa53a'),
    ]);
    const grass = instanced(tuft, Math.round(800 * density), 'tuft', (_i, d, c) => {
      const a = rnd() * Math.PI * 2;
      const r = DECK_OUTER + 0.3 + Math.pow(rnd(), 1.2) * 30;
      d.position.set(Math.cos(a) * r, 0.06, Math.sin(a) * r);
      d.scale.setScalar(0.7 + rnd() * 1.1);
      d.rotation.y = rnd() * 6;
      c.setHSL(0.3, 0.2, 0.8 + rnd() * 0.3);
      return true;
    }, false);
    this.group.add(grass);
  }

  update(_dt: number, _t: number) {
    // Static instancing – kept for future wind effects.
    void this.sway;
  }
}
