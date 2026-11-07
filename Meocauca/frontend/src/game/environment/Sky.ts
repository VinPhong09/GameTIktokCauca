import * as THREE from 'three';
import type { Palette } from './Lighting';
import { colorize, flatMaterial, merge, mulberry } from '../core/geometry';

/** Gradient sky dome + stars + moon + drifting low-poly clouds. */
export class Sky {
  readonly group = new THREE.Group();
  private dome: THREE.Mesh;
  private uniforms = {
    uTop: { value: new THREE.Color() },
    uHorizon: { value: new THREE.Color() },
    uBottom: { value: new THREE.Color() },
  };
  private stars: THREE.Points;
  private moon: THREE.Mesh;
  private clouds = new THREE.Group();
  private cloudMat: THREE.MeshStandardMaterial;

  constructor() {
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform vec3 uTop; uniform vec3 uHorizon; uniform vec3 uBottom; varying vec3 vDir;
        void main(){ float h = vDir.y; vec3 c = h > 0.0 ? mix(uHorizon, uTop, pow(smoothstep(0.0, 0.75, h), 0.8)) : mix(uHorizon, uBottom, smoothstep(0.0, -0.3, h));
        gl_FragColor = vec4(c, 1.0); }`,
    });
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(420, 32, 16), mat);
    this.dome.renderOrder = -10;
    this.group.add(this.dome);

    // Stars
    const rnd = mulberry(7);
    const pos: number[] = [];
    for (let i = 0; i < 700; i++) {
      const th = rnd() * Math.PI * 2;
      const ph = Math.acos(rnd() * 0.85 + 0.12);
      pos.push(Math.sin(ph) * Math.cos(th) * 380, Math.cos(ph) * 380, Math.sin(ph) * Math.sin(th) * 380);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }));
    this.group.add(this.stars);

    this.moon = new THREE.Mesh(new THREE.SphereGeometry(9, 16, 12), new THREE.MeshBasicMaterial({ color: 0xfff6d8, fog: false, transparent: true, opacity: 0 }));
    this.moon.position.set(-120, 150, -260);
    this.group.add(this.moon);

    // Clouds
    this.cloudMat = flatMaterial('cloud', { roughness: 1, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0.25 });
    for (let i = 0; i < 12; i++) {
      const parts: THREE.BufferGeometry[] = [];
      const n = 3 + Math.floor(rnd() * 3);
      for (let j = 0; j < n; j++) {
        const s = 4 + rnd() * 4;
        const g = new THREE.IcosahedronGeometry(s, 1);
        g.translate(j * 5 - n * 2.5, rnd() * 2, rnd() * 3);
        parts.push(colorize(g, '#ffffff'));
      }
      const cloud = new THREE.Mesh(merge(parts), this.cloudMat);
      const a = rnd() * Math.PI * 2;
      const r = 110 + rnd() * 90;
      cloud.position.set(Math.cos(a) * r, 40 + rnd() * 35, Math.sin(a) * r);
      cloud.scale.set(1.4, 0.75, 1);
      cloud.lookAt(0, cloud.position.y, 0);
      this.clouds.add(cloud);
    }
    this.group.add(this.clouds);
  }

  applyPalette(p: Palette) {
    this.uniforms.uTop.value.copy(p.skyTop);
    this.uniforms.uHorizon.value.copy(p.skyHorizon);
    this.uniforms.uBottom.value.copy(p.skyBottom);
    (this.stars.material as THREE.PointsMaterial).opacity = p.night * 0.95;
    (this.moon.material as THREE.MeshBasicMaterial).opacity = p.night;
    this.cloudMat.emissiveIntensity = 0.25 * (1 - p.night) + 0.02;
    this.cloudMat.color.set(p.night > 0.5 ? '#8a96c8' : '#ffffff');
  }

  setBackgroundVisible(v: boolean) {
    this.dome.visible = v;
    this.stars.visible = v;
    this.moon.visible = v;
    this.clouds.visible = v;
  }

  update(dt: number) {
    this.clouds.rotation.y += dt * 0.004;
  }
}
