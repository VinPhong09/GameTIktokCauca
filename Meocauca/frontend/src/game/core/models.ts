import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * Optional GLB/GLTF overrides. Drop a model in /assets (served at /models) and set the
 * fish's `model` field in the admin dashboard (e.g. "fish/golden-koi.glb").
 * Until the file is loaded (or if it fails) the procedural model is used.
 */
const loader = new GLTFLoader();
const cache = new Map<string, THREE.Object3D | null>();
const pending = new Set<string>();

function url(path: string) {
  if (/^https?:\/\//.test(path) || path.startsWith('/')) return path;
  return '/models/' + path.replace(/^\.?\/*/, '');
}

export function getModel(path: string | null | undefined): THREE.Object3D | null {
  if (!path) return null;
  const hit = cache.get(path);
  if (hit) return hit.clone(true);
  if (hit === null || pending.has(path)) return null;
  pending.add(path);
  loader.load(
    url(path),
    (gltf) => {
      pending.delete(path);
      const root = gltf.scene;
      // Normalize: center + fit into ~1.3 units long, facing +X.
      const box = new THREE.Box3().setFromObject(root);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const wrapper = new THREE.Group();
      root.position.sub(center);
      wrapper.add(root);
      wrapper.scale.setScalar(1.3 / Math.max(0.001, size.x, size.y, size.z));
      wrapper.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) o.castShadow = true;
      });
      cache.set(path, wrapper);
    },
    undefined,
    (err) => {
      pending.delete(path);
      cache.set(path, null);
      console.warn('[models] failed to load', path, err);
    },
  );
  return null;
}
