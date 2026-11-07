import * as THREE from 'three';
import type { GameConfig, ServerMessage } from '@shared/types';
import { GameEngine } from '../core/GameEngine';
import { Lighting } from '../environment/Lighting';
import { Sky } from '../environment/Sky';
import { Terrain } from '../environment/Terrain';
import { Vegetation } from '../environment/Vegetation';
import { Decorations } from '../environment/Decorations';
import { Water } from '../pond/Water';
import { PondBasin } from '../pond/PondBasin';
import { Platform } from '../pond/Platform';
import { Effects } from '../effects/Effects';
import { CameraDirector } from '../camera/CameraDirector';
import { CatManager } from '../cats/CatManager';
import { WelcomeDirector } from '../cats/WelcomeDirector';
import { fishingLineMaterial } from '../fishing/FishingRig';
import type { World } from '../cats/CatActor';
import { getModel } from '../core/models';

export interface PondSceneOptions {
  overlay?: boolean;
  transparent?: boolean;
  quality?: 'low' | 'medium' | 'high';
}

/** The whole 3D world. Receives server messages and updates incrementally. */
export class PondScene {
  readonly engine: GameEngine;
  private config: GameConfig | null = null;
  private lighting: Lighting;
  private sky: Sky;
  private terrain: Terrain;
  private vegetation: Vegetation;
  private decorations: Decorations;
  private water = new Water();
  private basin = new PondBasin();
  private platform = new Platform();
  private effects = new Effects();
  readonly cameraDirector: CameraDirector;
  readonly cats: CatManager;
  private welcome: WelcomeDirector;
  private worldRoot = new THREE.Group();

  constructor(canvas: HTMLCanvasElement, private opts: PondSceneOptions = {}) {
    const quality = opts.quality ?? 'high';
    this.engine = new GameEngine(canvas, { transparent: opts.transparent, quality });
    const scene = this.engine.scene;
    this.lighting = new Lighting(scene, quality !== 'low', this.engine.renderer);
    this.sky = new Sky();
    this.terrain = new Terrain();
    this.vegetation = new Vegetation(quality === 'low' ? 0.5 : quality === 'medium' ? 0.8 : 1);
    this.decorations = new Decorations('HỒ CÂU CÁ MÈO');
    scene.add(this.sky.group, this.terrain.group, this.vegetation.group, this.decorations.group, this.basin.group, this.water.mesh, this.platform.group, this.worldRoot, this.effects.group);
    if (opts.transparent) {
      this.sky.setBackgroundVisible(false);
      this.terrain.background.visible = false;
      scene.fog = null;
    }
    this.platform.setSeats(40);
    this.cameraDirector = new CameraDirector(this.engine.camera);

    this.lighting.onChange((p) => {
      this.sky.applyPalette(p);
      this.water.setPalette(p.waterDeep, p.waterShallow, p.night);
      this.decorations.setNight(p.night);
    });

    const world: World = {
      root: this.worldRoot,
      effects: this.effects,
      water: this.water,
      platform: this.platform,
      camera: this.cameraDirector,
      fish: (id) => this.config?.fish.find((f) => f.id === id),
      rarity: (id) => this.config?.rarities.find((r) => r.id === id),
      focusEnabled: () => this.config?.ui.camera.focusEnabled ?? true,
      isOverlay: !!opts.overlay,
    };
    this.cats = new CatManager(world, () => this.config);
    this.welcome = new WelcomeDirector(world, this.cats, () => ({
      enabled: this.config?.ui.camera.welcomeFocus ?? true,
      seconds: this.config?.ui.camera.welcomeSec ?? 3,
    }));

    this.engine.onResize((w, h) => {
      this.cameraDirector.recompute();
      fishingLineMaterial().resolution.set(w, h);
      this.effects.setViewportHeight(h);
    });
    this.engine.add((dt, t) => {
      const g = this.config?.game;
      this.lighting.update(dt, g?.timeOfDay ?? 'day', g?.dayCycleMinutes ?? 20);
      this.sky.update(dt);
      this.water.update(dt, t);
      this.basin.update(dt, t);
      this.decorations.update(dt, t);
      this.cats.update(dt, t);
      this.welcome.update(dt);
      this.effects.update(dt, t);
      this.cameraDirector.update(dt);
    });
    this.engine.start();
  }

  setSize(w: number, h: number, pixelRatio: number) {
    this.engine.setSize(w, h, pixelRatio);
  }

  private applyConfig(cfg: GameConfig) {
    const prev = this.config;
    this.config = cfg;
    this.platform.setSeats(cfg.game.maxPlayers);
    this.cats.setMaxSeats(cfg.game.maxPlayers);
    this.cameraDirector.configure(cfg.ui.camera);
    this.engine.setFpsCap(cfg.ui.fpsCap);
    for (const f of cfg.fish) if (f.model) getModel(f.model); // preload optional GLB overrides
    if (prev && JSON.stringify(prev.cats) !== JSON.stringify(cfg.cats)) this.cats.refreshAppearances();
  }

  handle(msg: ServerMessage) {
    switch (msg.type) {
      case 'snapshot':
        this.applyConfig(msg.data.config);
        this.cats.sync(msg.data.players, msg.data.cycles);
        this.applyEvents(msg.data.events);
        break;
      case 'config':
        this.applyConfig(msg.config);
        break;
      case 'player_joined':
        // A seat was just taken (new viewer, or promoted from the queue) → welcome it.
        if (this.cats.upsert(msg.player)) this.welcome.welcome(msg.player.id);
        break;
      case 'player_updated':
        this.cats.upsert(msg.player);
        break;
      case 'catch_result':
        this.cats.upsert(msg.player);
        break;
      case 'player_left':
        this.cats.remove(msg.playerId);
        break;
      case 'fishing_cycle':
        this.cats.cycle(msg.cycle);
        break;
      case 'gift_effect': {
        this.cats.gift(msg.effect);
        if (msg.effect.tier === 'mega' || msg.effect.global) {
          this.effects.fireworks(new THREE.Vector3(0, 0, 0), ['#ff5d8f', '#ffd23f', '#7dd3fc', '#c084fc', '#ffffff']);
        }
        break;
      }
      case 'events_state':
        this.applyEvents(msg.events);
        break;
      case 'clear':
        this.welcome.clear();
        this.cats.clear();
        break;
    }
  }

  private applyEvents(events: { color: string; endsAt: number }[]) {
    const active = events.filter((e) => e.endsAt > Date.now() - 5000);
    this.water.setEventTint(active.length ? active[0].color : null);
  }

  dispose() {
    this.engine.dispose();
  }
}
