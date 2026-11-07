import * as THREE from 'three';
import { canvasTexture, colorize, flatMaterial, merge, mulberry } from '../core/geometry';
import { DECK_OUTER, DECK_Y, ENTRANCE_ANGLES } from '../pond/constants';

const dummy = new THREE.Object3D();
const FLAG_COLORS = ['#ff5d73', '#ffd23f', '#3ec1d3', '#7bd389', '#b388ff', '#ff9f43'];

/** Bunting flags, lanterns, signboard, crates & barrels, center island statue. */
export class Decorations {
  readonly group = new THREE.Group();
  private flags: THREE.InstancedMesh;
  private flagBase: { pos: THREE.Vector3; quat: THREE.Quaternion; phase: number }[] = [];
  private lanternMat: THREE.MeshStandardMaterial;
  private lanternLights: THREE.PointLight[] = [];
  private statue: THREE.Group;

  constructor(title: string) {
    const rnd = mulberry(5);
    const poleR = DECK_OUTER + 0.35;
    const poleAngles: number[] = [];
    for (let i = 0; i < 10; i++) poleAngles.push((i / 10) * Math.PI * 2 + Math.PI / 10);

    // Poles with lanterns
    const poleGeo = merge([
      colorize(new THREE.CylinderGeometry(0.09, 0.12, 4.2, 6).translate(0, 2.1, 0), '#8b5a2b'),
      colorize(new THREE.SphereGeometry(0.16, 6, 5).translate(0, 4.25, 0), '#ffd23f'),
    ]);
    const poles = new THREE.InstancedMesh(poleGeo, flatMaterial('pole'), poleAngles.length);
    this.lanternMat = new THREE.MeshStandardMaterial({ color: '#ffb347', emissive: '#ff8c1a', emissiveIntensity: 0.4, roughness: 0.5 });
    const lanternGeo = new THREE.SphereGeometry(0.28, 10, 8).scale(1, 1.25, 1);
    const lanterns = new THREE.InstancedMesh(lanternGeo, this.lanternMat, poleAngles.length);
    poleAngles.forEach((a, i) => {
      dummy.position.set(Math.cos(a) * poleR, 0, Math.sin(a) * poleR);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      poles.setMatrixAt(i, dummy.matrix);
      dummy.position.y = 3.55;
      dummy.position.x = Math.cos(a) * (poleR - 0.3);
      dummy.position.z = Math.sin(a) * (poleR - 0.3);
      dummy.updateMatrix();
      lanterns.setMatrixAt(i, dummy.matrix);
    });
    poles.castShadow = true;
    this.group.add(poles, lanterns);
    // A few real lights for night ambience (cheap: 4 lights).
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const l = new THREE.PointLight('#ffb15c', 0, 18, 1.6);
      l.position.set(Math.cos(a) * 11, 3.5, Math.sin(a) * 11);
      this.lanternLights.push(l);
      this.group.add(l);
    }

    // Bunting between consecutive poles
    const flagGeo = new THREE.BufferGeometry();
    flagGeo.setAttribute('position', new THREE.Float32BufferAttribute([-0.22, 0, 0, 0.22, 0, 0, 0, -0.5, 0], 3));
    flagGeo.setAttribute('color', new THREE.Float32BufferAttribute([1, 1, 1, 1, 1, 1, 1, 1, 1], 3));
    flagGeo.computeVertexNormals();
    const perString = 9;
    this.flags = new THREE.InstancedMesh(flagGeo, new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.8 }), poleAngles.length * perString);
    const ropePts: number[] = [];
    let k = 0;
    for (let i = 0; i < poleAngles.length; i++) {
      const a0 = poleAngles[i];
      const a1 = poleAngles[(i + 1) % poleAngles.length];
      const p0 = new THREE.Vector3(Math.cos(a0) * poleR, 4.0, Math.sin(a0) * poleR);
      const p1 = new THREE.Vector3(Math.cos(a1) * poleR, 4.0, Math.sin(a1) * poleR);
      const dir = p1.clone().sub(p0);
      const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir.clone().setY(0).normalize());
      let prev: THREE.Vector3 | null = null;
      for (let s = 0; s <= 16; s++) {
        const t = s / 16;
        const p = p0.clone().lerp(p1, t);
        p.y -= Math.sin(t * Math.PI) * 0.9;
        if (prev) ropePts.push(prev.x, prev.y, prev.z, p.x, p.y, p.z);
        prev = p;
      }
      for (let f = 0; f < perString; f++) {
        const t = (f + 1) / (perString + 1);
        const p = p0.clone().lerp(p1, t);
        p.y -= Math.sin(t * Math.PI) * 0.9;
        this.flagBase.push({ pos: p, quat, phase: rnd() * 6 });
        this.flags.setColorAt(k++, new THREE.Color(FLAG_COLORS[(i + f) % FLAG_COLORS.length]));
      }
    }
    const rope = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(ropePts, 3)), new THREE.LineBasicMaterial({ color: '#6b4a2b' }));
    this.group.add(this.flags, rope);

    // Signboard behind the pond
    const signTex = canvasTexture(1024, 256, (ctx) => {
      const g = ctx.createLinearGradient(0, 0, 0, 256);
      g.addColorStop(0, '#c8854a');
      g.addColorStop(1, '#94562a');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 1024, 256);
      ctx.strokeStyle = '#6b3b17';
      ctx.lineWidth = 18;
      ctx.strokeRect(9, 9, 1006, 238);
      for (let y = 60; y < 256; y += 64) {
        ctx.fillStyle = 'rgba(0,0,0,0.08)';
        ctx.fillRect(20, y, 984, 4);
      }
      ctx.font = 'bold 120px "Baloo 2", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 14;
      ctx.strokeStyle = '#5a2d0c';
      ctx.strokeText(title, 512, 136);
      ctx.fillStyle = '#ffe9a8';
      ctx.fillText(title, 512, 136);
    });
    const sign = new THREE.Group();
    const board = new THREE.Mesh(new THREE.BoxGeometry(8, 2, 0.25), [
      flatMaterial('signwood', { vertexColors: false, color: '#94562a' }),
      flatMaterial('signwood', { vertexColors: false, color: '#94562a' }),
      flatMaterial('signwood', { vertexColors: false, color: '#94562a' }),
      flatMaterial('signwood', { vertexColors: false, color: '#94562a' }),
      new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.8 }),
      flatMaterial('signwood', { vertexColors: false, color: '#94562a' }),
    ]);
    board.position.y = 3.3;
    board.castShadow = true;
    const postGeo = colorize(new THREE.CylinderGeometry(0.16, 0.2, 3.4, 6), '#7a4a22');
    const postMesh = new THREE.Mesh(merge([postGeo.clone().translate(-3.4, 1.7, 0), postGeo.translate(3.4, 1.7, 0)]), flatMaterial('pole'));
    sign.add(board, postMesh);
    sign.position.set(0, 0, -(DECK_OUTER + 2.6));
    this.group.add(sign);

    // Crates, barrels, tackle boxes and nets near entrances
    const crate = colorize(new THREE.BoxGeometry(0.8, 0.8, 0.8), '#c08a4f');
    const barrel = colorize(new THREE.CylinderGeometry(0.38, 0.38, 0.95, 10), '#a0643a');
    const tackle = merge([colorize(new THREE.BoxGeometry(0.7, 0.35, 0.4), '#e85d4a'), colorize(new THREE.BoxGeometry(0.3, 0.08, 0.08).translate(0, 0.24, 0), '#333')]);
    const props: THREE.BufferGeometry[] = [];
    ENTRANCE_ANGLES.forEach((ea, i) => {
      const r = DECK_OUTER + 1.3;
      const side = new THREE.Vector3(-Math.sin(ea), 0, Math.cos(ea));
      const base = new THREE.Vector3(Math.cos(ea) * r, 0.08, Math.sin(ea) * r);
      const a = base.clone().addScaledVector(side, 2.2);
      const b = base.clone().addScaledVector(side, -2.2);
      props.push(crate.clone().rotateY(rnd()).translate(a.x, 0.48, a.z));
      if (i % 2 === 0) props.push(crate.clone().rotateY(rnd()).scale(0.7, 0.7, 0.7).translate(a.x, 1.16, a.z));
      props.push(barrel.clone().translate(b.x, 0.55, b.z));
      props.push(tackle.clone().rotateY(rnd()).translate(b.x + side.x * -0.9, 0.26, b.z + side.z * -0.9));
    });
    const propMesh = new THREE.Mesh(merge(props), flatMaterial('props'));
    propMesh.castShadow = true;
    propMesh.receiveShadow = true;
    this.group.add(propMesh);

    // Center island with a golden fish statue
    this.statue = new THREE.Group();
    const island = new THREE.Mesh(
      merge([
        colorize(new THREE.CylinderGeometry(1.5, 1.9, 0.9, 9).translate(0, -0.2, 0), '#9a9fae'),
        colorize(new THREE.CylinderGeometry(1.25, 1.45, 0.25, 9).translate(0, 0.35, 0), '#7cc251'),
        colorize(new THREE.DodecahedronGeometry(0.45, 0).translate(1.0, 0.35, 0.5), '#b0b4c0'),
        colorize(new THREE.DodecahedronGeometry(0.35, 0).translate(-1.05, 0.3, -0.4), '#a3a7b3'),
        colorize(new THREE.CylinderGeometry(0.35, 0.45, 0.7, 8).translate(0, 0.8, 0), '#e8dcc0'),
      ]),
      flatMaterial('island'),
    );
    island.receiveShadow = true;
    island.castShadow = true;
    const fishBody = new THREE.Mesh(
      merge([
        colorize(new THREE.SphereGeometry(0.55, 12, 10).scale(1, 0.62, 0.38), '#ffd23f'),
        colorize(new THREE.ConeGeometry(0.35, 0.55, 4).rotateZ(Math.PI / 2).scale(1, 1.2, 0.3).translate(-0.7, 0, 0), '#ffb703'),
        colorize(new THREE.SphereGeometry(0.07, 6, 5).translate(0.4, 0.1, 0.17), '#222'),
        colorize(new THREE.SphereGeometry(0.07, 6, 5).translate(0.4, 0.1, -0.17), '#222'),
      ]),
      new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.6, roughness: 0.3, emissive: '#ffb703', emissiveIntensity: 0.25 }),
    );
    fishBody.position.y = 1.65;
    fishBody.rotation.z = 0.5;
    fishBody.castShadow = true;
    this.statue.add(island, fishBody);
    this.group.add(this.statue);
    void DECK_Y;
  }

  setNight(night: number) {
    this.lanternMat.emissiveIntensity = 0.35 + night * 2.2;
    for (const l of this.lanternLights) l.intensity = night * 14;
  }

  update(_dt: number, t: number) {
    const q = new THREE.Quaternion();
    const sway = new THREE.Quaternion();
    const axis = new THREE.Vector3(1, 0, 0);
    for (let i = 0; i < this.flagBase.length; i++) {
      const f = this.flagBase[i];
      sway.setFromAxisAngle(axis, Math.sin(t * 2.2 + f.phase) * 0.35);
      q.copy(f.quat).multiply(sway);
      dummy.position.copy(f.pos);
      dummy.quaternion.copy(q);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      this.flags.setMatrixAt(i, dummy.matrix);
    }
    this.flags.instanceMatrix.needsUpdate = true;
    const fish = this.statue.children[1];
    fish.rotation.y = t * 0.4;
    fish.position.y = 1.65 + Math.sin(t * 1.5) * 0.08;
  }
}
