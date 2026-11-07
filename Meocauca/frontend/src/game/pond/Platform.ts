import * as THREE from 'three';
import { colorize, flatMaterial, merge, mulberry } from '../core/geometry';
import { DECK_INNER, DECK_OUTER, DECK_Y, ENTRANCE_ANGLES, RAIL_RADIUS, SEAT_RADIUS, STOOL_HEIGHT, angleDistance, seatAngle } from './constants';

const dummy = new THREE.Object3D();

/** Wooden circular deck: radial planks, support posts, railings with entrance gaps, walkways, stools and buckets. */
export class Platform {
  readonly group = new THREE.Group();
  private stools: THREE.InstancedMesh | null = null;
  private buckets: THREE.InstancedMesh | null = null;
  private seatCount = 0;

  constructor() {
    const rnd = mulberry(3);
    // Base ring under the planks
    const base = new THREE.RingGeometry(DECK_INNER, DECK_OUTER, 96, 1);
    base.rotateX(-Math.PI / 2);
    base.translate(0, DECK_Y - 0.1, 0);
    const baseMesh = new THREE.Mesh(colorize(base, '#7a4a26'), flatMaterial('deckbase', { side: THREE.DoubleSide }));
    baseMesh.receiveShadow = true;
    this.group.add(baseMesh);

    // Radial planks (instanced)
    const n = 150;
    const len = DECK_OUTER - DECK_INNER;
    const plankW = ((Math.PI * 2 * (DECK_INNER + len / 2)) / n) * 0.93;
    const plankGeo = colorize(new THREE.BoxGeometry(len, 0.12, plankW), '#ffffff');
    const planks = new THREE.InstancedMesh(plankGeo, flatMaterial('plank'), n);
    const woods = ['#c98b52', '#b97a44', '#d39a60', '#c08349'];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      dummy.position.set(Math.cos(a) * (DECK_INNER + len / 2), DECK_Y - 0.03, Math.sin(a) * (DECK_INNER + len / 2));
      dummy.rotation.set(0, -a, 0);
      dummy.scale.set(1, 1, 1 + (len * 0.25) / DECK_INNER);
      dummy.updateMatrix();
      planks.setMatrixAt(i, dummy.matrix);
      planks.setColorAt(i, new THREE.Color(woods[Math.floor(rnd() * woods.length)]).offsetHSL(0, 0, (rnd() - 0.5) * 0.05));
    }
    planks.receiveShadow = true;
    planks.castShadow = true;
    this.group.add(planks);

    // Inner + outer edge beams
    const beams = merge([
      colorize(new THREE.TorusGeometry(DECK_INNER, 0.12, 5, 120).rotateX(Math.PI / 2).translate(0, DECK_Y - 0.02, 0), '#8f5a2f'),
      colorize(new THREE.TorusGeometry(DECK_OUTER, 0.12, 5, 120).rotateX(Math.PI / 2).translate(0, DECK_Y - 0.02, 0), '#8f5a2f'),
    ]);
    this.group.add(new THREE.Mesh(beams, flatMaterial('beam')));

    // Support posts into the water
    const postCount = 36;
    const posts = new THREE.InstancedMesh(colorize(new THREE.CylinderGeometry(0.16, 0.2, 3, 6), '#6e4423'), flatMaterial('post'), postCount);
    for (let i = 0; i < postCount; i++) {
      const a = (i / postCount) * Math.PI * 2;
      dummy.position.set(Math.cos(a) * (DECK_INNER + 0.1), DECK_Y - 1.5, Math.sin(a) * (DECK_INNER + 0.1));
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      posts.setMatrixAt(i, dummy.matrix);
    }
    this.group.add(posts);

    // Railing posts (skip entrance gaps)
    const gap = 0.16;
    const railAngles: number[] = [];
    for (let i = 0; i < 120; i++) {
      const a = (i / 120) * Math.PI * 2;
      if (ENTRANCE_ANGLES.some((e) => angleDistance(a, e) < gap)) continue;
      railAngles.push(a);
    }
    const railPosts = new THREE.InstancedMesh(
      merge([colorize(new THREE.CylinderGeometry(0.07, 0.08, 0.95, 5).translate(0, 0.47, 0), '#9b6236'), colorize(new THREE.SphereGeometry(0.1, 5, 4).translate(0, 0.98, 0), '#b8773f')]),
      flatMaterial('railpost'),
      railAngles.length,
    );
    railAngles.forEach((a, i) => {
      dummy.position.set(Math.cos(a) * RAIL_RADIUS, DECK_Y, Math.sin(a) * RAIL_RADIUS);
      dummy.updateMatrix();
      railPosts.setMatrixAt(i, dummy.matrix);
    });
    railPosts.castShadow = true;
    this.group.add(railPosts);
    // Rail segments between entrances
    const rails: THREE.BufferGeometry[] = [];
    const sorted = [...ENTRANCE_ANGLES].sort((a, b) => a - b);
    for (let i = 0; i < sorted.length; i++) {
      const start = sorted[i] + gap;
      const end = (i + 1 < sorted.length ? sorted[i + 1] : sorted[0] + Math.PI * 2) - gap;
      for (const h of [0.88, 0.5]) {
        const t = new THREE.TorusGeometry(RAIL_RADIUS, 0.05, 4, 40, end - start);
        t.rotateZ(start);
        t.rotateX(Math.PI / 2);
        t.translate(0, DECK_Y + h, 0);
        rails.push(colorize(t, '#b8773f'));
      }
    }
    this.group.add(new THREE.Mesh(merge(rails), flatMaterial('rail')));

    // Walkways out to the grass
    const walk: THREE.BufferGeometry[] = [];
    for (const a of ENTRANCE_ANGLES) {
      for (let s = 0; s < 7; s++) {
        const r = DECK_OUTER + 0.25 + s * 0.55;
        const b = new THREE.BoxGeometry(0.5, 0.1, 2.2);
        b.rotateY(-a);
        b.translate(Math.cos(a) * r, DECK_Y - 0.08 - s * 0.035, Math.sin(a) * r);
        walk.push(colorize(b, s % 2 ? '#c08349' : '#cf9459'));
      }
    }
    const walkMesh = new THREE.Mesh(merge(walk), flatMaterial('walk'));
    walkMesh.receiveShadow = true;
    this.group.add(walkMesh);
  }

  /** Rebuild stools + buckets for the configured number of seats. */
  setSeats(count: number) {
    if (count === this.seatCount) return;
    this.seatCount = count;
    if (this.stools) {
      this.group.remove(this.stools, this.buckets!);
      this.stools.dispose();
      this.buckets!.dispose();
    }
    const stoolGeo = merge([
      colorize(new THREE.CylinderGeometry(0.34, 0.3, 0.1, 10).translate(0, STOOL_HEIGHT - 0.05, 0), '#e9a15a'),
      colorize(new THREE.CylinderGeometry(0.05, 0.05, STOOL_HEIGHT - 0.1, 4).translate(0.17, (STOOL_HEIGHT - 0.1) / 2, 0.1), '#8b5a2b'),
      colorize(new THREE.CylinderGeometry(0.05, 0.05, STOOL_HEIGHT - 0.1, 4).translate(-0.17, (STOOL_HEIGHT - 0.1) / 2, 0.1), '#8b5a2b'),
      colorize(new THREE.CylinderGeometry(0.05, 0.05, STOOL_HEIGHT - 0.1, 4).translate(0, (STOOL_HEIGHT - 0.1) / 2, -0.2), '#8b5a2b'),
    ]);
    const bucketGeo = merge([
      colorize(new THREE.CylinderGeometry(0.22, 0.17, 0.34, 10, 1, true).translate(0, 0.17, 0), '#5aa9e6'),
      colorize(new THREE.CylinderGeometry(0.17, 0.17, 0.02, 10).translate(0, 0.01, 0), '#3f88c5'),
      colorize(new THREE.CylinderGeometry(0.2, 0.2, 0.02, 10).translate(0, 0.26, 0), '#8fd3ff'),
      colorize(new THREE.TorusGeometry(0.22, 0.015, 4, 12, Math.PI).translate(0, 0.34, 0), '#666666'),
    ]);
    this.stools = new THREE.InstancedMesh(stoolGeo, flatMaterial('stool'), count);
    this.buckets = new THREE.InstancedMesh(bucketGeo, flatMaterial('bucket', { side: THREE.DoubleSide }), count);
    for (let s = 0; s < count; s++) {
      const a = seatAngle(s, count);
      dummy.position.set(Math.cos(a) * SEAT_RADIUS, DECK_Y, Math.sin(a) * SEAT_RADIUS);
      dummy.rotation.set(0, -a - Math.PI / 2, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      this.stools.setMatrixAt(s, dummy.matrix);
      const side = Math.min(0.62, (Math.PI * SEAT_RADIUS) / count);
      const ba = a + side / SEAT_RADIUS;
      dummy.position.set(Math.cos(ba) * (SEAT_RADIUS + 0.25), DECK_Y, Math.sin(ba) * (SEAT_RADIUS + 0.25));
      dummy.updateMatrix();
      this.buckets.setMatrixAt(s, dummy.matrix);
    }
    this.stools.castShadow = true;
    this.stools.receiveShadow = true;
    this.buckets.castShadow = true;
    this.group.add(this.stools, this.buckets);
  }

  /** World position of a seat's bucket (fish fly into it). */
  bucketPosition(seat: number, out = new THREE.Vector3()) {
    const count = Math.max(1, this.seatCount);
    const a = seatAngle(seat, count);
    const side = Math.min(0.62, (Math.PI * SEAT_RADIUS) / count);
    const ba = a + side / SEAT_RADIUS;
    return out.set(Math.cos(ba) * (SEAT_RADIUS + 0.25), DECK_Y + 0.3, Math.sin(ba) * (SEAT_RADIUS + 0.25));
  }
}
