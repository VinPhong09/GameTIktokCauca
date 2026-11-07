import * as THREE from 'three';
import type { TimeOfDay } from '@shared/types';

export interface Palette {
  skyTop: THREE.Color;
  skyHorizon: THREE.Color;
  skyBottom: THREE.Color;
  hemiSky: THREE.Color;
  hemiGround: THREE.Color;
  hemiIntensity: number;
  sun: THREE.Color;
  sunIntensity: number;
  sunDir: THREE.Vector3;
  ambient: number;
  fog: THREE.Color;
  waterDeep: THREE.Color;
  waterShallow: THREE.Color;
  night: number;
  exposure: number;
}

const P = (o: Record<string, string | number | number[]>): Palette => ({
  skyTop: new THREE.Color(o.skyTop as string),
  skyHorizon: new THREE.Color(o.skyHorizon as string),
  skyBottom: new THREE.Color(o.skyBottom as string),
  hemiSky: new THREE.Color(o.hemiSky as string),
  hemiGround: new THREE.Color(o.hemiGround as string),
  hemiIntensity: o.hemiIntensity as number,
  sun: new THREE.Color(o.sun as string),
  sunIntensity: o.sunIntensity as number,
  sunDir: new THREE.Vector3(...(o.sunDir as [number, number, number])).normalize(),
  ambient: o.ambient as number,
  fog: new THREE.Color(o.fog as string),
  waterDeep: new THREE.Color(o.waterDeep as string),
  waterShallow: new THREE.Color(o.waterShallow as string),
  night: o.night as number,
  exposure: o.exposure as number,
});

export const PALETTES: Record<'day' | 'sunset' | 'night', Palette> = {
  day: P({ skyTop: '#3d9cff', skyHorizon: '#c4ecff', skyBottom: '#eaf8ff', hemiSky: '#dff1ff', hemiGround: '#7dbb55', hemiIntensity: 1.25, sun: '#fff1d6', sunIntensity: 2.6, sunDir: [14, 26, 12], ambient: 0.25, fog: '#cdeeff', waterDeep: '#1478c2', waterShallow: '#46d0e6', night: 0, exposure: 1.05 }),
  sunset: P({ skyTop: '#5468d4', skyHorizon: '#ffae78', skyBottom: '#ffd9b0', hemiSky: '#ffd6b0', hemiGround: '#87804f', hemiIntensity: 1.0, sun: '#ffa060', sunIntensity: 2.0, sunDir: [-22, 9, -6], ambient: 0.22, fog: '#f6be98', waterDeep: '#2a5ea6', waterShallow: '#f2a77c', night: 0.25, exposure: 1.05 }),
  night: P({ skyTop: '#070d2b', skyHorizon: '#253872', skyBottom: '#33468a', hemiSky: '#5b70c4', hemiGround: '#1d2c3c', hemiIntensity: 0.75, sun: '#a9bcff', sunIntensity: 0.85, sunDir: [-10, 22, -12], ambient: 0.28, fog: '#1d2958', waterDeep: '#0d2b5e', waterShallow: '#2f6fb0', night: 1, exposure: 1.15 }),
};

function blend(a: Palette, b: Palette, t: number): Palette {
  const out = { ...a } as Palette;
  for (const k of Object.keys(a) as (keyof Palette)[]) {
    const va = a[k];
    const vb = b[k];
    if (va instanceof THREE.Color) (out as unknown as Record<string, unknown>)[k] = va.clone().lerp(vb as THREE.Color, t);
    else if (va instanceof THREE.Vector3) (out as unknown as Record<string, unknown>)[k] = va.clone().lerp(vb as THREE.Vector3, t).normalize();
    else (out as unknown as Record<string, unknown>)[k] = (va as number) + ((vb as number) - (va as number)) * t;
  }
  return out;
}

/** Palette for an auto day cycle phase in [0,1): day → sunset → night → dawn. */
export function paletteForPhase(phase: number): Palette {
  const p = ((phase % 1) + 1) % 1;
  if (p < 0.5) return PALETTES.day;
  if (p < 0.6) return blend(PALETTES.day, PALETTES.sunset, (p - 0.5) / 0.1);
  if (p < 0.68) return blend(PALETTES.sunset, PALETTES.night, (p - 0.6) / 0.08);
  if (p < 0.9) return PALETTES.night;
  if (p < 0.96) return blend(PALETTES.night, PALETTES.sunset, (p - 0.9) / 0.06);
  return blend(PALETTES.sunset, PALETTES.day, (p - 0.96) / 0.04);
}

export class Lighting {
  readonly hemi = new THREE.HemisphereLight(0xffffff, 0x88aa55, 1.2);
  readonly sun = new THREE.DirectionalLight(0xffffff, 2.5);
  readonly ambient = new THREE.AmbientLight(0xffffff, 0.25);
  current: Palette = PALETTES.day;
  private listeners = new Set<(p: Palette) => void>();
  private elapsed = 0;
  private lastApplied = -1;

  constructor(private scene: THREE.Scene, shadows: boolean, private renderer: THREE.WebGLRenderer) {
    scene.add(this.hemi, this.sun, this.ambient, this.sun.target);
    this.sun.castShadow = shadows;
    const s = this.sun.shadow;
    s.mapSize.set(2048, 2048);
    s.camera.left = -18;
    s.camera.right = 18;
    s.camera.top = 18;
    s.camera.bottom = -18;
    s.camera.near = 1;
    s.camera.far = 90;
    s.bias = -0.0008;
    s.normalBias = 0.03;
    scene.fog = new THREE.Fog(0xcdeeff, 70, 230);
  }

  onChange(l: (p: Palette) => void) {
    this.listeners.add(l);
    l(this.current);
  }

  apply(p: Palette) {
    this.current = p;
    this.hemi.color.copy(p.hemiSky);
    this.hemi.groundColor.copy(p.hemiGround);
    this.hemi.intensity = p.hemiIntensity;
    this.sun.color.copy(p.sun);
    this.sun.intensity = p.sunIntensity;
    this.sun.position.copy(p.sunDir).multiplyScalar(40);
    this.ambient.intensity = p.ambient;
    (this.scene.fog as THREE.Fog).color.copy(p.fog);
    this.renderer.toneMappingExposure = p.exposure;
    for (const l of this.listeners) l(p);
  }

  update(dt: number, mode: TimeOfDay, cycleMinutes: number) {
    this.elapsed += dt;
    let phaseKey: number;
    if (mode === 'auto') {
      const phase = this.elapsed / (Math.max(1, cycleMinutes) * 60) + 0.1;
      phaseKey = Math.round((phase % 1) * 2000);
      if (phaseKey === this.lastApplied) return;
      this.lastApplied = phaseKey;
      this.apply(paletteForPhase(phase));
      return;
    }
    phaseKey = mode === 'day' ? -10 : mode === 'sunset' ? -11 : -12;
    if (phaseKey === this.lastApplied) return;
    this.lastApplied = phaseKey;
    this.apply(PALETTES[mode]);
  }
}
