import * as THREE from 'three';
import type { CatAppearance, FishDef } from '@shared/types';
import { buildFishMesh } from './FishBuilder';
import { buildCatGeometry, CAT } from '../cats/CatBuilder';
import { sharedToonMaterial } from '../core/geometry';

/**
 * Renders 3D fish and cat-head icons into data URLs (collection icons, leaderboard avatars).
 * Uses one small offscreen renderer shared by the whole page.
 */
class IconRendererImpl {
  private renderer: THREE.WebGLRenderer | null = null;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  private cache = new Map<string, string>();
  private queue: (() => void)[] = [];
  private busy = false;
  private listeners = new Set<() => void>();

  private ensure() {
    if (this.renderer) return this.renderer;
    const canvas = document.createElement('canvas');
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
    this.renderer.setSize(192, 192, false);
    this.renderer.setPixelRatio(1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.setClearColor(0x000000, 0);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x8899aa, 2.2));
    const d = new THREE.DirectionalLight(0xffffff, 2.2);
    d.position.set(2, 4, 5);
    this.scene.add(d);
    return this.renderer;
  }

  onUpdate(l: () => void) {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  get(key: string) {
    return this.cache.get(key);
  }

  private schedule(job: () => void) {
    this.queue.push(job);
    if (this.busy) return;
    this.busy = true;
    const run = () => {
      const batch = this.queue.splice(0, 4);
      batch.forEach((j) => j());
      if (batch.length) this.listeners.forEach((l) => l());
      if (this.queue.length) setTimeout(run, 16);
      else this.busy = false;
    };
    setTimeout(run, 0);
  }

  private render(obj: THREE.Object3D, camPos: THREE.Vector3, look: THREE.Vector3): string {
    const r = this.ensure();
    this.scene.add(obj);
    this.camera.position.copy(camPos);
    this.camera.lookAt(look);
    r.render(this.scene, this.camera);
    const url = r.domElement.toDataURL('image/png');
    this.scene.remove(obj);
    return url;
  }

  fish(def: FishDef): string | undefined {
    const key = 'fish:' + def.id + JSON.stringify(def.visual);
    const hit = this.cache.get(key);
    if (hit !== undefined) return hit || undefined;
    this.cache.set(key, '');
    this.schedule(() => {
      const mesh = buildFishMesh(def);
      mesh.scale.setScalar(1);
      mesh.rotation.set(0.15, -0.35, 0.12);
      this.cache.set(key, this.render(mesh, new THREE.Vector3(0, 0.1, 3.1), new THREE.Vector3(-0.1, 0, 0)));
    });
    return undefined;
  }

  cat(cat: CatAppearance): string | undefined {
    const key = 'cat:' + cat.id + JSON.stringify(cat.colors) + JSON.stringify(cat.outfit);
    const hit = this.cache.get(key);
    if (hit !== undefined) return hit || undefined;
    this.cache.set(key, '');
    this.schedule(() => {
      const g = buildCatGeometry(cat);
      const mat = sharedToonMaterial();
      const group = new THREE.Group();
      const torso = new THREE.Mesh(g.torso, mat);
      const head = new THREE.Group();
      head.position.copy(CAT.headPivot);
      head.add(new THREE.Mesh(g.head, mat));
      const eyes = new THREE.Mesh(g.eyes, mat);
      eyes.position.set(0, 0.36, 0.39);
      head.add(eyes, new THREE.LineSegments(g.whiskers, new THREE.LineBasicMaterial({ color: g.whiskerColor })));
      group.add(torso, head);
      group.rotation.y = 0.35;
      this.cache.set(key, this.render(group, new THREE.Vector3(0.2, 1.35, 3.2), new THREE.Vector3(0, 1.15, 0)));
    });
    return undefined;
  }
}

export const IconRenderer = new IconRendererImpl();
