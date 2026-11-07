import * as THREE from 'three';
import { colorize, flatMaterial, merge, mulberry, sharedToonMaterial } from '../core/geometry';
import { WATER_RADIUS } from './constants';

const dummy = new THREE.Object3D();

interface Swimmer {
  radius: number;
  depth: number;
  speed: number;
  phase: number;
  scale: number;
  wobble: number;
}

/** Underwater world: sandy bowl, rocks, swaying seaweed, swimming fish and lily pads. */
export class PondBasin {
  readonly group = new THREE.Group();
  private seaweed: THREE.InstancedMesh;
  private seaweedBase: { x: number; z: number; s: number; phase: number }[] = [];
  private fish: THREE.InstancedMesh;
  private swimmers: Swimmer[] = [];
  private lilies: THREE.InstancedMesh;
  private lilyBase: { x: number; z: number; rot: number; s: number; phase: number }[] = [];

  constructor() {
    const rnd = mulberry(31);
    // Bowl
    const pts: THREE.Vector2[] = [];
    for (let i = 0; i <= 14; i++) {
      const t = i / 14;
      pts.push(new THREE.Vector2(t * (WATER_RADIUS + 0.4), -2.8 + Math.pow(t, 2.6) * 2.9));
    }
    const bowl = new THREE.LatheGeometry(pts, 64);
    const pos = bowl.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    const deep = new THREE.Color('#2f7f86');
    const sand = new THREE.Color('#e9d29a');
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      c.copy(deep).lerp(sand, THREE.MathUtils.smoothstep(y, -2.6, -0.2));
      c.offsetHSL(0, 0, (rnd() - 0.5) * 0.04);
      colors.set([c.r, c.g, c.b], i * 3);
    }
    bowl.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const bowlMesh = new THREE.Mesh(bowl, flatMaterial('bowl', { side: THREE.DoubleSide }));
    bowlMesh.receiveShadow = true;
    this.group.add(bowlMesh);

    // Underwater rocks + shells
    const rocks: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 34; i++) {
      const a = rnd() * Math.PI * 2;
      const r = 2.5 + rnd() * (WATER_RADIUS - 3);
      const depth = -2.8 + Math.pow(r / (WATER_RADIUS + 0.4), 2.6) * 2.9;
      const g = new THREE.DodecahedronGeometry(0.25 + rnd() * 0.45, 0);
      g.scale(1, 0.6, 1).rotateY(rnd() * 6).translate(Math.cos(a) * r, depth + 0.1, Math.sin(a) * r);
      rocks.push(colorize(g, rnd() > 0.5 ? '#7d8a96' : '#93a0a8'));
    }
    this.group.add(new THREE.Mesh(merge(rocks), flatMaterial('underrocks')));

    // Seaweed
    const blade = merge([
      colorize(new THREE.ConeGeometry(0.12, 1.4, 4).translate(0, 0.7, 0), '#2fa36b'),
      colorize(new THREE.ConeGeometry(0.09, 1.0, 4).rotateZ(0.25).translate(0.12, 0.5, 0), '#3cbf7a'),
    ]);
    const weeds = 46;
    this.seaweed = new THREE.InstancedMesh(blade, flatMaterial('weed'), weeds);
    for (let i = 0; i < weeds; i++) {
      const a = rnd() * Math.PI * 2;
      const r = 3 + rnd() * (WATER_RADIUS - 3.6);
      this.seaweedBase.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, s: 0.6 + rnd() * 0.9, phase: rnd() * 6 });
    }
    this.group.add(this.seaweed);

    // Ambient swimming fish (instanced, colored per instance)
    const fishGeo = merge([
      colorize(new THREE.SphereGeometry(0.3, 8, 6).scale(1.4, 0.6, 0.45), '#ffffff'),
      colorize(new THREE.ConeGeometry(0.2, 0.32, 4).rotateZ(-Math.PI / 2).scale(1, 1, 0.3).translate(-0.5, 0, 0), '#ffffff'),
    ]);
    const nFish = 26;
    this.fish = new THREE.InstancedMesh(fishGeo, sharedToonMaterial(), nFish);
    const palette = ['#ff8c42', '#ffd166', '#ef476f', '#f8f9fa', '#06d6a0', '#ffb4a2', '#8ecae6', '#c1121f'];
    for (let i = 0; i < nFish; i++) {
      this.swimmers.push({
        radius: 2.4 + rnd() * (WATER_RADIUS - 3.4),
        depth: -0.45 - rnd() * 1.2,
        speed: (0.15 + rnd() * 0.25) * (rnd() > 0.5 ? 1 : -1),
        phase: rnd() * Math.PI * 2,
        scale: 0.6 + rnd() * 0.8,
        wobble: rnd() * 6,
      });
      this.fish.setColorAt(i, new THREE.Color(palette[i % palette.length]));
    }
    this.group.add(this.fish);

    // Lily pads + lotus on the surface near the edge
    const lily = merge([
      colorize(new THREE.CylinderGeometry(0.55, 0.55, 0.04, 10, 1, false, 0.3, Math.PI * 2 - 0.6), '#4caf50'),
      colorize(new THREE.ConeGeometry(0.16, 0.25, 6).translate(0.12, 0.13, 0.05), '#ff8fb8'),
    ]);
    const nl = 16;
    this.lilies = new THREE.InstancedMesh(lily, flatMaterial('lily'), nl);
    for (let i = 0; i < nl; i++) {
      const a = (i / nl) * Math.PI * 2 + rnd() * 0.3;
      const r = 2.2 + rnd() * 2.6;
      this.lilyBase.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, rot: rnd() * 6, s: 0.7 + rnd() * 0.6, phase: rnd() * 6 });
    }
    this.lilies.receiveShadow = true;
    this.group.add(this.lilies);
  }

  update(_dt: number, t: number) {
    this.seaweedBase.forEach((w, i) => {
      dummy.position.set(w.x, -2.8 + Math.pow(Math.hypot(w.x, w.z) / (WATER_RADIUS + 0.4), 2.6) * 2.9, w.z);
      dummy.rotation.set(Math.sin(t * 0.9 + w.phase) * 0.18, w.phase, Math.cos(t * 0.7 + w.phase) * 0.18);
      dummy.scale.setScalar(w.s);
      dummy.updateMatrix();
      this.seaweed.setMatrixAt(i, dummy.matrix);
    });
    this.seaweed.instanceMatrix.needsUpdate = true;

    this.swimmers.forEach((s, i) => {
      const a = s.phase + t * s.speed;
      const r = s.radius + Math.sin(t * 0.3 + s.wobble) * 0.6;
      dummy.position.set(Math.cos(a) * r, s.depth + Math.sin(t + s.wobble) * 0.08, Math.sin(a) * r);
      // Heading = tangent of the circle.
      dummy.rotation.set(0, -a + (s.speed > 0 ? -Math.PI / 2 : Math.PI / 2), Math.sin(t * 6 + s.wobble) * 0.08);
      dummy.scale.setScalar(s.scale);
      dummy.updateMatrix();
      this.fish.setMatrixAt(i, dummy.matrix);
    });
    this.fish.instanceMatrix.needsUpdate = true;

    this.lilyBase.forEach((l, i) => {
      dummy.position.set(l.x + Math.sin(t * 0.2 + l.phase) * 0.1, 0.03 + Math.sin(t * 1.2 + l.phase) * 0.02, l.z);
      dummy.rotation.set(0, l.rot + Math.sin(t * 0.15 + l.phase) * 0.2, 0);
      dummy.scale.setScalar(l.s);
      dummy.updateMatrix();
      this.lilies.setMatrixAt(i, dummy.matrix);
    });
    this.lilies.instanceMatrix.needsUpdate = true;
  }
}
