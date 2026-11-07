import * as THREE from 'three';
import { colorize, flatMaterial, merge, mulberry } from '../core/geometry';
import { DECK_OUTER, ENTRANCE_ANGLES, WATER_RADIUS } from '../pond/constants';

/** Grass island with gentle low-poly relief, dirt paths and a ring of background hills. */
export class Terrain {
  readonly group = new THREE.Group();
  readonly background = new THREE.Group();

  constructor() {
    const rnd = mulberry(11);
    const ground = new THREE.RingGeometry(WATER_RADIUS + 0.15, 95, 72, 18);
    ground.rotateX(-Math.PI / 2);
    const pos = ground.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    const c = new THREE.Color();
    const grassA = new THREE.Color('#79c44f');
    const grassB = new THREE.Color('#5fae3e');
    const dirt = new THREE.Color('#d9b27a');
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const r = Math.hypot(x, z);
      const a = Math.atan2(z, x);
      // Height: flat around the deck, rolling further out.
      const t = THREE.MathUtils.smoothstep(r, 16, 40);
      const h = t * (Math.sin(x * 0.18) * Math.cos(z * 0.15) * 1.6 + Math.sin(x * 0.05 + z * 0.07) * 2.2 + rnd() * 0.5);
      pos.setY(i, r < DECK_OUTER + 2 ? 0.08 : 0.08 + Math.max(0, h));
      c.copy(grassA).lerp(grassB, rnd() * 0.6 + Math.sin(x * 0.3) * 0.2);
      // Dirt paths at entrances.
      for (const ea of ENTRANCE_ANGLES) {
        let d = Math.abs(a - Math.atan2(Math.sin(ea), Math.cos(ea)));
        d = Math.min(d, Math.PI * 2 - d);
        const lateral = Math.sin(d) * r;
        if (r > DECK_OUTER && r < 26 && lateral < 1.4 && d < Math.PI / 2) c.lerp(dirt, 0.85 - lateral * 0.3);
      }
      if (r < WATER_RADIUS + 0.9) c.lerp(new THREE.Color('#e6cf96'), 0.7); // sandy shore
      colors.set([c.r, c.g, c.b], i * 3);
    }
    ground.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    ground.computeVertexNormals();
    const groundMesh = new THREE.Mesh(ground, flatMaterial('ground'));
    groundMesh.receiveShadow = true;
    this.group.add(groundMesh);

    // Background hills & mountains (merged → one draw call).
    const hills: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 46; i++) {
      const a = (i / 46) * Math.PI * 2 + rnd() * 0.1;
      const r = 70 + rnd() * 25;
      const big = rnd() > 0.65;
      const hgt = big ? 22 + rnd() * 20 : 8 + rnd() * 9;
      const g = big ? new THREE.ConeGeometry(14 + rnd() * 8, hgt, 6, 2) : new THREE.IcosahedronGeometry(10 + rnd() * 6, 1);
      if (!big) g.scale(1.4, 0.55, 1);
      g.translate(Math.cos(a) * r, big ? hgt / 2 - 1 : 1, Math.sin(a) * r);
      const col = big ? (rnd() > 0.5 ? '#7aa3c7' : '#8fb4d6') : rnd() > 0.5 ? '#5aa646' : '#6cba52';
      hills.push(colorize(g, col));
      if (big && rnd() > 0.35) {
        const cap = new THREE.ConeGeometry(5.5, hgt * 0.3, 6);
        cap.translate(Math.cos(a) * r, hgt * 0.85 - 1, Math.sin(a) * r);
        hills.push(colorize(cap, '#f4f8ff'));
      }
    }
    this.background.add(new THREE.Mesh(merge(hills), flatMaterial('hills')));
    this.group.add(this.background);
  }
}
