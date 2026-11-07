import * as THREE from 'three';

export interface BurstOptions {
  count: number;
  colors: string[];
  speed?: [number, number];
  /** Direction bias (normalized) + cone spread in radians. */
  direction?: THREE.Vector3;
  spread?: number;
  gravity?: number;
  life?: [number, number];
  size?: [number, number];
  drag?: number;
  radius?: number;
}

const tmpColor = new THREE.Color();
const tmpDir = new THREE.Vector3();
const up = new THREE.Vector3(0, 1, 0);

/**
 * Pooled particle system – one THREE.Points draw call for thousands of particles.
 * Used for splashes, sparkles, rarity glows, confetti, hearts and fireworks.
 */
export class ParticleSystem {
  readonly points: THREE.Points;
  private capacity: number;
  private alive = 0;
  private pos: Float32Array;
  private vel: Float32Array;
  private col: Float32Array;
  private size: Float32Array;
  private baseSize: Float32Array;
  private alpha: Float32Array;
  private life: Float32Array;
  private maxLife: Float32Array;
  private gravity: Float32Array;
  private drag: Float32Array;
  private geo = new THREE.BufferGeometry();

  constructor(capacity: number, blending: THREE.Blending, shape: 'soft' | 'star' | 'square' = 'soft') {
    this.capacity = capacity;
    this.pos = new Float32Array(capacity * 3);
    this.vel = new Float32Array(capacity * 3);
    this.col = new Float32Array(capacity * 3);
    this.size = new Float32Array(capacity);
    this.baseSize = new Float32Array(capacity);
    this.alpha = new Float32Array(capacity);
    this.life = new Float32Array(capacity);
    this.maxLife = new Float32Array(capacity);
    this.gravity = new Float32Array(capacity);
    this.drag = new Float32Array(capacity);
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo.setDrawRange(0, 0);
    const shapeCode =
      shape === 'star'
        ? 'vec2 q = abs(uv); float d = min(q.x * 3.0 + q.y, q.y * 3.0 + q.x); float a = 1.0 - smoothstep(0.55, 1.0, d) ; a *= 1.0 - smoothstep(0.0, 1.0, length(uv));'
        : shape === 'square'
          ? 'float a = step(abs(uv.x), 0.7) * step(abs(uv.y), 0.45);'
          : 'float a = 1.0 - smoothstep(0.0, 1.0, length(uv)); a = a * a;';
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending,
      vertexColors: true,
      uniforms: { uScale: { value: 900 } },
      vertexShader: /* glsl */ `
        attribute float size; attribute float alpha; varying vec3 vColor; varying float vAlpha; uniform float uScale;
        void main(){ vColor = color; vAlpha = alpha; vec4 mv = modelViewMatrix * vec4(position,1.0);
          gl_PointSize = size * uScale / -mv.z; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: /* glsl */ `
        varying vec3 vColor; varying float vAlpha;
        void main(){ vec2 uv = gl_PointCoord * 2.0 - 1.0; ${shapeCode} if (a * vAlpha < 0.01) discard; gl_FragColor = vec4(vColor, a * vAlpha); }`,
    });
    this.points = new THREE.Points(this.geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 10;
  }

  setViewportHeight(h: number) {
    (this.points.material as THREE.ShaderMaterial).uniforms.uScale.value = h * 0.55;
  }

  emit(origin: THREE.Vector3, o: BurstOptions) {
    const [smin, smax] = o.speed ?? [1, 3];
    const [lmin, lmax] = o.life ?? [0.6, 1.2];
    const [zmin, zmax] = o.size ?? [0.15, 0.3];
    const spread = o.spread ?? Math.PI;
    const dir = o.direction ?? up;
    const orient = new THREE.Quaternion().setFromUnitVectors(up, dir);
    for (let n = 0; n < o.count; n++) {
      if (this.alive >= this.capacity) return;
      const i = this.alive++;
      // Random direction within a cone around `dir`.
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(1 - Math.random() * (1 - Math.cos(spread)));
      tmpDir.set(Math.sin(phi) * Math.cos(theta), Math.cos(phi), Math.sin(phi) * Math.sin(theta));
      tmpDir.applyQuaternion(orient);
      const sp = smin + Math.random() * (smax - smin);
      const r = o.radius ?? 0;
      this.pos[i * 3] = origin.x + (Math.random() - 0.5) * r * 2;
      this.pos[i * 3 + 1] = origin.y + (Math.random() - 0.5) * r;
      this.pos[i * 3 + 2] = origin.z + (Math.random() - 0.5) * r * 2;
      this.vel[i * 3] = tmpDir.x * sp;
      this.vel[i * 3 + 1] = tmpDir.y * sp;
      this.vel[i * 3 + 2] = tmpDir.z * sp;
      tmpColor.set(o.colors[Math.floor(Math.random() * o.colors.length)]);
      this.col[i * 3] = tmpColor.r;
      this.col[i * 3 + 1] = tmpColor.g;
      this.col[i * 3 + 2] = tmpColor.b;
      this.baseSize[i] = zmin + Math.random() * (zmax - zmin);
      this.size[i] = this.baseSize[i];
      this.alpha[i] = 1;
      this.maxLife[i] = lmin + Math.random() * (lmax - lmin);
      this.life[i] = this.maxLife[i];
      this.gravity[i] = o.gravity ?? -6;
      this.drag[i] = o.drag ?? 0.6;
    }
  }

  private kill(i: number) {
    const last = --this.alive;
    if (i === last) return;
    this.pos.copyWithin(i * 3, last * 3, last * 3 + 3);
    this.vel.copyWithin(i * 3, last * 3, last * 3 + 3);
    this.col.copyWithin(i * 3, last * 3, last * 3 + 3);
    this.size[i] = this.size[last];
    this.baseSize[i] = this.baseSize[last];
    this.alpha[i] = this.alpha[last];
    this.life[i] = this.life[last];
    this.maxLife[i] = this.maxLife[last];
    this.gravity[i] = this.gravity[last];
    this.drag[i] = this.drag[last];
  }

  update(dt: number) {
    for (let i = this.alive - 1; i >= 0; i--) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.kill(i);
        continue;
      }
      const k = Math.max(0, 1 - this.drag[i] * dt);
      this.vel[i * 3] *= k;
      this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * k + this.gravity[i] * dt;
      this.vel[i * 3 + 2] *= k;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      const t = this.life[i] / this.maxLife[i];
      this.alpha[i] = Math.min(1, t * 2.2);
      this.size[i] = this.baseSize[i] * (0.4 + 0.6 * t);
    }
    this.geo.setDrawRange(0, this.alive);
    if (this.alive > 0 || this.geo.drawRange.count === 0) {
      (this.geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      (this.geo.attributes.color as THREE.BufferAttribute).needsUpdate = true;
      (this.geo.attributes.size as THREE.BufferAttribute).needsUpdate = true;
      (this.geo.attributes.alpha as THREE.BufferAttribute).needsUpdate = true;
    }
  }

  get count() {
    return this.alive;
  }
}
