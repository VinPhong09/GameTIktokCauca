import * as THREE from 'three';

export interface TagInfo {
  name: string;
  luck: number;
  rank: number;
  queued?: boolean;
}

const MEDALS = ['', '🥇', '🥈', '🥉'];

/** Canvas-sprite name tag above each cat (redrawn only when the content changes). */
export class NameTag {
  readonly sprite: THREE.Sprite;
  private canvas = document.createElement('canvas');
  private ctx: CanvasRenderingContext2D;
  private texture: THREE.CanvasTexture;
  private key = '';

  constructor() {
    this.canvas.width = 512;
    this.canvas.height = 176;
    this.ctx = this.canvas.getContext('2d')!;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.minFilter = THREE.LinearFilter;
    this.sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.texture, transparent: true, depthTest: false, depthWrite: false }));
    this.sprite.scale.set(2.3, (2.3 * 176) / 512, 1);
    this.sprite.renderOrder = 20;
  }

  set(info: TagInfo) {
    const chars = [...info.name];
    const name = chars.length > 11 ? chars.slice(0, 10).join('') + '…' : info.name;
    const boosted = info.luck > 1.01;
    const key = `${name}|${boosted ? info.luck.toFixed(2) : ''}|${info.rank <= 3 ? info.rank : 0}`;
    if (key === this.key) return;
    this.key = key;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, 512, 176);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const label = (info.rank >= 1 && info.rank <= 3 ? MEDALS[info.rank] + ' ' : '') + name;
    ctx.font = 'bold 56px "Baloo 2", "Segoe UI Emoji", system-ui, sans-serif';
    const w = Math.min(504, ctx.measureText(label).width + 40);
    // Pill background
    ctx.fillStyle = info.rank >= 1 && info.rank <= 3 ? 'rgba(120, 70, 0, 0.72)' : 'rgba(20, 30, 60, 0.62)';
    roundRect(ctx, 256 - w / 2, 8, w, 76, 38);
    ctx.fill();
    ctx.lineWidth = 8;
    ctx.strokeStyle = 'rgba(0,0,0,0.65)';
    ctx.strokeText(label, 256, 48);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(label, 256, 48);
    if (boosted) {
      const t = `🍀 x${info.luck.toFixed(info.luck >= 10 ? 0 : 2).replace(/\.?0+$/, '')}`;
      ctx.font = 'bold 48px "Baloo 2", "Segoe UI Emoji", system-ui, sans-serif';
      const lw = ctx.measureText(t).width + 36;
      const g = ctx.createLinearGradient(0, 100, 0, 164);
      g.addColorStop(0, '#ffe066');
      g.addColorStop(1, '#ff9f1c');
      ctx.fillStyle = g;
      roundRect(ctx, 256 - lw / 2, 100, lw, 64, 32);
      ctx.fill();
      ctx.fillStyle = '#5a2d00';
      ctx.fillText(t, 256, 134);
    }
    this.texture.needsUpdate = true;
  }

  dispose() {
    this.texture.dispose();
    (this.sprite.material as THREE.SpriteMaterial).dispose();
  }
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const emoteCache = new Map<string, THREE.Texture>();
/** Speech-bubble emote texture ('!' bite, '♥' gift, '…' fail, '★' catch). */
export function emoteTexture(symbol: string, color: string): THREE.Texture {
  const key = symbol + color;
  const hit = emoteCache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(64, 58, 50, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(50, 100);
  ctx.lineTo(64, 124);
  ctx.lineTo(78, 100);
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.arc(64, 58, 50, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.font = 'bold 80px "Baloo 2", "Segoe UI Symbol", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(symbol, 64, 62);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  emoteCache.set(key, t);
  return t;
}
