import * as THREE from 'three';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { colorize, merge, sharedToonMaterial } from '../core/geometry';

const POINTS = 14;
let lineMaterial: LineMaterial | null = null;

export function fishingLineMaterial(): LineMaterial {
  if (!lineMaterial) {
    lineMaterial = new LineMaterial({ color: 0xf8fbff, linewidth: 2.2, transparent: true, opacity: 0.9, worldUnits: false });
  }
  return lineMaterial;
}

let bobberGeo: THREE.BufferGeometry | null = null;
function bobberGeometry() {
  if (!bobberGeo) {
    bobberGeo = merge([
      colorize(new THREE.SphereGeometry(0.12, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), '#ff3b3b'),
      colorize(new THREE.SphereGeometry(0.12, 12, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), '#ffffff'),
      colorize(new THREE.CylinderGeometry(0.018, 0.018, 0.16, 5).translate(0, 0.17, 0), '#ffdd00'),
    ]);
  }
  return bobberGeo;
}

/** Fishing line (fat Line2 with sag) + bobber. Line endpoints are recomputed every frame. */
export class FishingRig {
  readonly line: Line2;
  readonly bobber: THREE.Mesh;
  private buffer: Float32Array;
  private geo: LineGeometry;
  private a = new THREE.Vector3();
  private b = new THREE.Vector3();
  private c = new THREE.Vector3();

  constructor() {
    this.geo = new LineGeometry();
    this.geo.setPositions(new Array(POINTS * 3).fill(0));
    this.line = new Line2(this.geo, fishingLineMaterial());
    this.line.frustumCulled = false;
    this.line.renderOrder = 4;
    // Direct access to the interleaved buffer avoids allocations per frame.
    const attr = this.geo.attributes.instanceStart as THREE.InterleavedBufferAttribute;
    this.buffer = attr.data.array as Float32Array;
    this.bobber = new THREE.Mesh(bobberGeometry(), sharedToonMaterial());
    this.bobber.castShadow = true;
    this.bobber.visible = false;
  }

  /** Draw a sagging line from `from` to `to`. sag = how far the midpoint hangs down. */
  setLine(from: THREE.Vector3, to: THREE.Vector3, sag: number, wobble = 0, time = 0) {
    this.a.copy(from);
    this.b.copy(to);
    this.c.addVectors(from, to).multiplyScalar(0.5);
    this.c.y -= sag;
    const pts: number[] = [];
    for (let i = 0; i < POINTS; i++) {
      const t = i / (POINTS - 1);
      const u = 1 - t;
      const x = u * u * this.a.x + 2 * u * t * this.c.x + t * t * this.b.x;
      let y = u * u * this.a.y + 2 * u * t * this.c.y + t * t * this.b.y;
      const z = u * u * this.a.z + 2 * u * t * this.c.z + t * t * this.b.z;
      if (wobble) y += Math.sin(t * Math.PI) * Math.sin(time * 40 + t * 9) * wobble;
      pts.push(x, y, z);
    }
    // Segments layout: [p0,p1, p1,p2, ...]
    const buf = this.buffer;
    for (let i = 0; i < POINTS - 1; i++) {
      buf[i * 6] = pts[i * 3];
      buf[i * 6 + 1] = pts[i * 3 + 1];
      buf[i * 6 + 2] = pts[i * 3 + 2];
      buf[i * 6 + 3] = pts[i * 3 + 3];
      buf[i * 6 + 4] = pts[i * 3 + 4];
      buf[i * 6 + 5] = pts[i * 3 + 5];
    }
    (this.geo.attributes.instanceStart as THREE.InterleavedBufferAttribute).data.needsUpdate = true;
    this.line.visible = true;
  }

  hideLine() {
    this.line.visible = false;
  }

  dispose() {
    this.geo.dispose();
  }
}
