import { DEFAULT_CONFIG, cloneConfig } from '@shared/defaults';
import type { GameConfig, GameSettings, Rarity } from '@shared/types';
import { RARITY_ORDER, VOICE_EVENT_KINDS } from '@shared/types';
import type { Repository } from '../database/repository';
import { Logger } from './Logger';

type Section = keyof GameConfig;
const SECTIONS: Section[] = ['rarities', 'fish', 'cats', 'gifts', 'luck', 'events', 'game', 'ui'];

function isObj(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

/** Deep merge: objects merge recursively, arrays/primitives from `over` replace `base`. */
export function deepMerge<T>(base: T, over: unknown): T {
  if (!isObj(base) || !isObj(over)) return (over === undefined ? base : (over as T));
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [k, v] of Object.entries(over)) {
    out[k] = k in out && isObj(out[k]) && isObj(v) ? deepMerge(out[k], v) : v;
  }
  return out as T;
}

/**
 * Upgrades a config saved by an older version before it is merged over the defaults.
 *  rev 2: camera now auto-fits the pond between the HUD panels (old elevation/offset values no longer apply),
 *         and cats leave the pond after 3 idle minutes instead of 8 (viewers who left the LIVE).
 */
export function migrateStored(stored: unknown): unknown {
  if (!isObj(stored)) return stored;
  const rev = Number(stored.schemaRev) || 1;
  if (rev < 2) {
    const ui = stored.ui;
    if (isObj(ui)) {
      const focus = isObj(ui.camera) ? ui.camera.focusEnabled : undefined;
      delete ui.camera;
      if (typeof focus === 'boolean') ui.camera = { focusEnabled: focus };
    }
    const game = stored.game;
    if (isObj(game) && Number(game.idleTimeoutMin) === 8) game.idleTimeoutMin = 3;
    stored.schemaRev = 2;
  }
  return stored;
}

const num = (v: unknown, d: number, min = -Infinity, max = Infinity) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d;
};

/** Repairs/clamps an incoming config so the game can never run with invalid values. */
export function sanitizeConfig(c: GameConfig): GameConfig {
  const d = DEFAULT_CONFIG;
  // Rarities – all five must exist, in order.
  c.rarities = RARITY_ORDER.map((id: Rarity) => {
    const src = c.rarities?.find((r) => r.id === id) ?? d.rarities.find((r) => r.id === id)!;
    const def = d.rarities.find((r) => r.id === id)!;
    const weightMin = num(src.weightMin, def.weightMin, 0.01);
    return {
      ...def,
      ...src,
      id,
      baseProbability: num(src.baseProbability, def.baseProbability, 0, 100),
      luckExponent: num(src.luckExponent, def.luckExponent, -5, 10),
      maxProbability: num(src.maxProbability, def.maxProbability, 0, 100),
      weightMin,
      weightMax: num(src.weightMax, def.weightMax, weightMin),
      scorePerKg: num(src.scorePerKg, def.scorePerKg, 0),
    };
  });
  if (c.rarities.every((r) => r.baseProbability <= 0)) c.rarities[0].baseProbability = 100;

  const seen = new Set<string>();
  c.fish = (Array.isArray(c.fish) ? c.fish : d.fish).filter((f) => f && f.id && !seen.has(f.id) && seen.add(f.id)).map((f) => {
    const weightMin = num(f.weightMin, 0.3, 0.01);
    return {
      ...f,
      rarity: RARITY_ORDER.includes(f.rarity) ? f.rarity : 'common',
      weightMin,
      weightMax: num(f.weightMax, weightMin, weightMin),
      baseChance: num(f.baseChance, 10, 0),
      weightMultiplier: num(f.weightMultiplier, 1, 0.01, 100),
      scorePerKg: num(f.scorePerKg, 0, 0),
      enabled: f.enabled !== false,
      visual: { ...d.fish[0].visual, ...f.visual },
    };
  });
  if (!c.cats?.length) c.cats = cloneConfig(d.cats);
  c.gifts = (Array.isArray(c.gifts) ? c.gifts : d.gifts).map((g) => ({
    ...g,
    aliases: Array.isArray(g.aliases) ? g.aliases : [],
    luck: num(g.luck, 1, 0.1, 100),
    attempts: Math.round(num(g.attempts, 1, 0, 10000)),
    durationSec: num(g.durationSec, 0, 0),
    minDiamonds: num(g.minDiamonds, 0, 0),
    rarityBoost: isObj(g.rarityBoost) ? g.rarityBoost : {},
    enabled: g.enabled !== false,
  }));
  const L = c.luck;
  L.baseLuck = num(L.baseLuck, 1, 0.1, 100);
  L.minLuck = num(L.minLuck, 0.5, 0.01, 100);
  L.maxLuck = num(L.maxLuck, 5, L.minLuck, 1000);
  if (!['max', 'additive', 'multiplicative'].includes(L.stacking)) L.stacking = 'max';
  L.maxActiveBoosts = Math.round(num(L.maxActiveBoosts, 5, 1, 50));
  const J = L.joinLuck ?? d.luck.joinLuck;
  const jMin = num(J.min, d.luck.joinLuck.min, 0.1, 100);
  L.joinLuck = { enabled: J.enabled !== false, min: jMin, max: num(J.max, Math.max(jMin, d.luck.joinLuck.max), jMin, 100) };
  L.community.likeThreshold = Math.round(num(L.community.likeThreshold, 1000, 1));
  const G = c.game;
  G.maxPlayers = Math.round(num(G.maxPlayers, 40, 1, 60));
  G.maxQueue = Math.round(num(G.maxQueue, 100, 0, 10000));
  G.fishingCooldownSec = num(G.fishingCooldownSec, 1.5, 0, 600);
  G.commandCooldownSec = num(G.commandCooldownSec, 1, 0, 600);
  G.idleTimeoutMin = num(G.idleTimeoutMin, 8, 0, 1440);
  G.escapeChance = num(G.escapeChance, 8, 0, 95);
  G.waitMinSec = num(G.waitMinSec, 2.5, 0.3, 120);
  G.waitMaxSec = num(G.waitMaxSec, 6.5, G.waitMinSec, 300);
  if (!Array.isArray(G.commands.leave)) G.commands.leave = [...d.game.commands.leave];
  G.leaveOnLiveEnd = G.leaveOnLiveEnd !== false;
  G.botsYieldToViewers = G.botsYieldToViewers !== false;
  G.autoFishAll = G.autoFishAll === true;
  G.autoFishPauseSec = num(G.autoFishPauseSec, 2, 0, 120);
  const A = (G.autoAudience ?? {}) as Partial<GameSettings['autoAudience']>;
  const dA = d.game.autoAudience;
  const stayMin = num(A.stayMinMin, dA.stayMinMin, 0, 240);
  G.autoAudience = {
    enabled: A.enabled === true,
    maxBots: Math.round(num(A.maxBots, dA.maxBots, 0, 60)),
    joinsPerMinute: num(A.joinsPerMinute, dA.joinsPerMinute, 0, 120),
    keepFreeSeats: Math.round(num(A.keepFreeSeats, dA.keepFreeSeats, 0, 60)),
    stayMinMin: stayMin,
    stayMaxMin: num(A.stayMaxMin, dA.stayMaxMin, 0, 240) === 0 ? 0 : num(A.stayMaxMin, dA.stayMaxMin, stayMin, 240),
    castsPerMinute: num(A.castsPerMinute, dA.castsPerMinute, 0, 30),
    likesPerMinute: num(A.likesPerMinute, dA.likesPerMinute, 0, 600),
    giftsPerMinute: num(A.giftsPerMinute, dA.giftsPerMinute, 0, 30),
    sharesPerMinute: num(A.sharesPerMinute, dA.sharesPerMinute, 0, 30),
  };
  const cam = c.ui.camera;
  cam.welcomeFocus = cam.welcomeFocus !== false;
  cam.welcomeSec = num(cam.welcomeSec, d.ui.camera.welcomeSec, 1, 15);
  const V = c.ui.voice;
  const dV = d.ui.voice;
  c.ui.voice = {
    enabled: V?.enabled !== false,
    engine: (['auto', 'edge', 'windows'] as const).includes(V?.engine) ? V.engine : dV.engine,
    edgeVoice: typeof V?.edgeVoice === 'string' && /^[a-z]{2}-[A-Z]{2}-\w+Neural$/.test(V.edgeVoice) ? V.edgeVoice : dV.edgeVoice,
    windowsVoice: typeof V?.windowsVoice === 'string' ? V.windowsVoice.slice(0, 80) : '',
    rate: Math.round(num(V?.rate, dV.rate, -50, 50)),
    volume: Math.round(num(V?.volume, dV.volume, 0, 100)),
    skipBots: V?.skipBots === true,
    maxQueue: Math.round(num(V?.maxQueue, dV.maxQueue, 1, 20)),
    bannedWords: Array.isArray(V?.bannedWords) ? V.bannedWords.map((w) => String(w).trim()).filter(Boolean).slice(0, 200) : [],
    events: Object.fromEntries(
      VOICE_EVENT_KINDS.map((k) => {
        const e = V?.events?.[k];
        return [k, { enabled: typeof e?.enabled === 'boolean' ? e.enabled : dV.events[k].enabled, template: typeof e?.template === 'string' ? e.template.slice(0, 200) : dV.events[k].template }];
      }),
    ) as typeof dV.events,
  };
  const M = c.ui.music;
  const dm = d.ui.music;
  c.ui.music = {
    enabled: typeof M?.enabled === 'boolean' ? M.enabled : dm.enabled,
    volume: Math.round(num(M?.volume, dm.volume, 0, 100)),
    bpm: Math.round(num(M?.bpm, dm.bpm, 55, 100)),
    ambience: typeof M?.ambience === 'boolean' ? M.ambience : dm.ambience,
    catchChimes: typeof M?.catchChimes === 'boolean' ? M.catchChimes : dm.catchChimes,
  };
  c.version = (Number(c.version) || 0) + 0;
  return c;
}

export class ConfigStore {
  private config: GameConfig;
  private listeners = new Set<(c: GameConfig, section: Section | 'all') => void>();

  constructor(private repo: Repository) {
    const stored = repo.getConfig('gameConfig');
    this.config = sanitizeConfig(deepMerge(cloneConfig(DEFAULT_CONFIG), migrateStored(stored ?? {})));
  }

  get(): GameConfig {
    return this.config;
  }

  onChange(fn: (c: GameConfig, section: Section | 'all') => void) {
    this.listeners.add(fn);
  }

  private persist(section: Section | 'all') {
    this.config.version++;
    this.repo.setConfig('gameConfig', this.config);
    for (const l of this.listeners) l(this.config, section);
  }

  replace(next: GameConfig) {
    this.config = sanitizeConfig(deepMerge(cloneConfig(DEFAULT_CONFIG), migrateStored(cloneConfig(next))));
    this.persist('all');
    Logger.info('Configuration replaced');
  }

  updateSection(section: Section, value: unknown) {
    if (!SECTIONS.includes(section)) throw new Error(`Unknown config section: ${section}`);
    const next = cloneConfig(this.config) as unknown as Record<string, unknown>;
    next[section] = Array.isArray(value) ? value : deepMerge(next[section], value);
    this.config = sanitizeConfig(next as unknown as GameConfig);
    this.persist(section);
    Logger.info(`Configuration updated: ${section}`);
  }

  reset(section?: Section) {
    if (section) {
      const next = cloneConfig(this.config) as unknown as Record<string, unknown>;
      next[section] = cloneConfig((DEFAULT_CONFIG as unknown as Record<string, unknown>)[section]);
      this.config = sanitizeConfig(next as unknown as GameConfig);
    } else {
      this.config = sanitizeConfig(cloneConfig(DEFAULT_CONFIG));
    }
    this.persist(section ?? 'all');
    Logger.info(`Configuration reset${section ? ': ' + section : ''}`);
  }
}
