import * as THREE from 'three';
import { WATER_RADIUS } from './constants';

/** Stylized animated water: gentle waves, depth gradient, caustic shimmer, sparkles and edge foam. */
export class Water {
  readonly mesh: THREE.Mesh;
  readonly uniforms = {
    uTime: { value: 0 },
    uDeep: { value: new THREE.Color('#1478c2') },
    uShallow: { value: new THREE.Color('#46d0e6') },
    uFoam: { value: new THREE.Color('#ffffff') },
    uRadius: { value: WATER_RADIUS + 0.3 },
    uOpacity: { value: 0.78 },
    uNight: { value: 0 },
    uEventColor: { value: new THREE.Color('#ffd700') },
    uEvent: { value: 0 },
  };
  private eventTarget = 0;

  constructor() {
    const geo = new THREE.RingGeometry(0.01, WATER_RADIUS + 0.3, 120, 28);
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      vertexShader: /* glsl */ `
        uniform float uTime;
        varying vec2 vPos;
        varying float vWave;
        void main() {
          vec3 p = position;
          float w = sin(p.x * 0.9 + uTime * 1.3) * 0.045 + sin(p.y * 1.25 - uTime * 1.05) * 0.04 + sin((p.x + p.y) * 2.3 + uTime * 2.1) * 0.015;
          p.z += w;
          vWave = w;
          vPos = p.xy;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform float uTime, uRadius, uOpacity, uNight, uEvent;
        uniform vec3 uDeep, uShallow, uFoam, uEventColor;
        varying vec2 vPos;
        varying float vWave;
        void main() {
          float r = length(vPos) / uRadius;
          vec3 col = mix(uDeep, uShallow, smoothstep(0.05, 1.0, r));
          float c = sin(vPos.x * 2.6 + uTime * 1.4) * sin(vPos.y * 2.9 - uTime * 1.15) + sin((vPos.x - vPos.y) * 1.9 + uTime * 0.9);
          col += smoothstep(1.15, 1.9, c) * 0.16;
          float s = sin(vPos.x * 10.0 + uTime * 2.7) * sin(vPos.y * 12.0 - uTime * 2.3) * sin((vPos.x + vPos.y) * 7.0 + uTime);
          col += pow(max(s, 0.0), 14.0) * (0.75 - uNight * 0.45);
          col = mix(col, uEventColor, uEvent * (0.18 + 0.12 * sin(uTime * 2.0 + r * 8.0)));
          col += vWave * 1.4;
          float foam = smoothstep(0.92, 0.985, r) + smoothstep(0.86, 0.9, r) * (0.5 + 0.5 * sin(atan(vPos.y, vPos.x) * 24.0 + uTime * 1.5)) * 0.35;
          col = mix(col, uFoam, clamp(foam, 0.0, 1.0) * 0.75);
          gl_FragColor = vec4(col, mix(uOpacity, 0.95, clamp(foam, 0.0, 1.0)));
        }`,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.position.y = 0;
    this.mesh.renderOrder = 2;
  }

  setPalette(deep: THREE.Color, shallow: THREE.Color, night: number) {
    this.uniforms.uDeep.value.copy(deep);
    this.uniforms.uShallow.value.copy(shallow);
    this.uniforms.uNight.value = night;
  }

  setEventTint(color: string | null) {
    if (color) this.uniforms.uEventColor.value.set(color);
    this.eventTarget = color ? 1 : 0;
  }

  /** Height of the water surface at a world point (matches the vertex shader). */
  heightAt(x: number, z: number, t: number) {
    const px = x;
    const py = -z;
    return Math.sin(px * 0.9 + t * 1.3) * 0.045 + Math.sin(py * 1.25 - t * 1.05) * 0.04 + Math.sin((px + py) * 2.3 + t * 2.1) * 0.015;
  }

  update(dt: number, t: number) {
    this.uniforms.uTime.value = t;
    const u = this.uniforms.uEvent;
    u.value += (this.eventTarget - u.value) * Math.min(1, dt * 1.5);
  }
}
