// ============================================================================
// CAT FISHING LIVE – shared type definitions (used by backend + frontend)
// Pure TypeScript only: no runtime dependencies allowed in /shared.
// ============================================================================

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
export const RARITY_ORDER: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

export interface RarityConfig {
  id: Rarity;
  label: string;
  labelVi: string;
  color: string;
  /** Base probability in percent. All rarities must add up to 100. */
  baseProbability: number;
  /** How strongly Luck scales this rarity: weight = base * luck^exponent. */
  luckExponent: number;
  /** Hard cap (percent) after luck – prevents guaranteed rare fish. */
  maxProbability: number;
  weightMin: number;
  weightMax: number;
  /** Collection score per kg. */
  scorePerKg: number;
  /** Camera focuses on the cat when this rarity is caught. */
  cameraFocus: boolean;
  /** Show a big screen-wide alert. */
  screenAlert: boolean;
}

// ---------------------------------------------------------------- Fish ------
export type FishShape =
  | 'carp' | 'slim' | 'round' | 'catfish' | 'koi' | 'trout' | 'crystal'
  | 'dragon' | 'emperor' | 'phoenix' | 'moon' | 'butterfly' | 'spirit';
export type FishPattern = 'none' | 'spots' | 'stripes' | 'koi' | 'rainbow' | 'gradient' | 'scales';
export type FishEffect = 'none' | 'sparkle' | 'glow' | 'aura' | 'legendary';
export type FishExtra =
  | 'whiskers' | 'horns' | 'crown' | 'longFins' | 'wings' | 'crescent' | 'crystalSpikes' | 'mane' | 'halo';

export interface FishVisual {
  shape: FishShape;
  bodyColor: string;
  bellyColor: string;
  accentColor: string;
  finColor: string;
  pattern: FishPattern;
  emissive?: string;
  emissiveIntensity?: number;
  extras?: FishExtra[];
  /** Visual size multiplier. */
  scale?: number;
  opacity?: number;
}

export interface FishDef {
  id: string;
  name: string;
  nameVi: string;
  rarity: Rarity;
  weightMin: number;
  weightMax: number;
  /** Relative chance inside its rarity group. */
  baseChance: number;
  /** Extra multiplier applied to the rolled weight. */
  weightMultiplier: number;
  /** Collection score per kg (overrides rarity scorePerKg when > 0). */
  scorePerKg: number;
  effect: FishEffect;
  visual: FishVisual;
  enabled: boolean;
  /** If set, only catchable while this event id is active. */
  eventOnly?: string | null;
  /** Optional GLB model path served from /models (fallback = procedural). */
  model?: string | null;
  description?: string;
}

// ---------------------------------------------------------------- Cats ------
export type CatPattern = 'solid' | 'tabby' | 'calico' | 'points' | 'tuxedo' | 'bicolor' | 'spotted';
export type HatType = 'none' | 'bucket' | 'cap' | 'straw' | 'beanie';

export interface CatAppearance {
  id: string;
  name: string;
  breed: string;
  pattern: CatPattern;
  colors: {
    body: string;
    belly: string;
    muzzle: string;
    ear: string;
    earInner: string;
    paw: string;
    tail: string;
    tailTip: string;
    eye: string;
    nose: string;
    patternA: string;
    patternB: string;
    whisker: string;
  };
  foldedEars?: boolean;
  fluffy?: boolean;
  outfit: { vest: string; trim: string; hat: HatType; hatColor: string; rod: string };
  model?: string | null;
}

// ---------------------------------------------------------------- Gifts -----
export type GiftTier = 'small' | 'medium' | 'large' | 'mega';

export interface GiftRule {
  id: string;
  giftName: string;
  aliases: string[];
  /** Used for matching unknown gifts by diamond value (0 = disabled). */
  minDiamonds: number;
  luck: number;
  attempts: number;
  durationSec: number;
  /** Applies to everyone (community bonus) instead of only the sender. */
  global: boolean;
  tier: GiftTier;
  autoCast: boolean;
  rarityBoost: Partial<Record<Rarity, number>>;
  enabled: boolean;
}

// ---------------------------------------------------------------- Luck ------
export type StackingMode = 'max' | 'additive' | 'multiplicative';

export interface LuckConfig {
  baseLuck: number;
  maxLuck: number;
  minLuck: number;
  stacking: StackingMode;
  maxActiveBoosts: number;
  /** For gift streaks (repeatCount > 1): add attempts per repeat. */
  repeatExtendsAttempts: boolean;
  maxAttempts: number;
  /** Weight roll: higher luck pushes weight towards the top of the range. */
  weightLuckInfluence: number;
  shareBonus: { perShare: number; max: number; durationSec: number };
  community: { likeThreshold: number; luckMultiplier: number; durationSec: number; autoCastAll: boolean; eventId: string };
  unknownGift: { luck: number; attempts: number; durationSec: number };
  /** Every cat entering the pond rolls a personal luck multiplier in [min, max] (kept while it stays in the pond). */
  joinLuck: { enabled: boolean; min: number; max: number };
}

// ---------------------------------------------------------------- Events ----
export interface FishingEventDef {
  id: string;
  name: string;
  nameVi: string;
  description: string;
  color: string;
  /** Allow automatic scheduling. */
  enabled: boolean;
  durationSec: number;
  luckMultiplier: number;
  rarityMultipliers: Partial<Record<Rarity, number>>;
  fishBoost: { fishIds: string[]; multiplier: number };
  /** Event-only fish that become available. */
  unlockFishIds: string[];
  /** Auto-run every N minutes (0 = manual / community only). */
  intervalMin: number;
}

export interface ActiveEventDTO {
  eventId: string;
  name: string;
  nameVi: string;
  color: string;
  startedAt: number;
  endsAt: number;
  source: 'manual' | 'schedule' | 'community' | 'gift';
}

// ---------------------------------------------------------------- Game ------
export type TimeOfDay = 'auto' | 'day' | 'sunset' | 'night';

export interface GameSettings {
  maxPlayers: number;
  queueEnabled: boolean;
  maxQueue: number;
  fishingCooldownSec: number;
  commandCooldownSec: number;
  idleTimeoutMin: number;
  autoJoinOnViewerJoin: boolean;
  autoJoinOnComment: boolean;
  /** Percent chance the fish escapes (fail animation). */
  escapeChance: number;
  waitMinSec: number;
  waitMaxSec: number;
  /** Queue one extra cast while fishing so the cat keeps going. */
  autoContinue: boolean;
  /** Every seated cat keeps fishing by itself – no comment needed. */
  autoFishAll: boolean;
  /** Rest between two automatic casts (seconds, plus a little random jitter). */
  autoFishPauseSec: number;
  timeOfDay: TimeOfDay;
  dayCycleMinutes: number;
  commands: { fish: string[]; join: string[]; top: string[]; gifts: string[]; leave: string[] };
  /** Remove every cat from the pond when the LIVE ends. */
  leaveOnLiveEnd: boolean;
  /** When the pond is full, simulated (bot) cats give their seat to real viewers. */
  botsYieldToViewers: boolean;
  /** Automatic simulated audience ("khán giả tự động"). */
  autoAudience: AutoAudienceSettings;
}

export interface AutoAudienceSettings {
  enabled: boolean;
  /** Max bot cats seated in the pond at once. */
  maxBots: number;
  /** New bot cats joining per minute (while there is room). */
  joinsPerMinute: number;
  /** Seats always left free for real viewers. */
  keepFreeSeats: number;
  /** Each bot stays a random time in [stayMinMin, stayMaxMin] minutes, then leaves (0 = stays). */
  stayMinMin: number;
  stayMaxMin: number;
  /** Casts per minute for each bot cat. */
  castsPerMinute: number;
  /** Like events / gifts / shares per minute for the whole bot audience. */
  likesPerMinute: number;
  giftsPerMinute: number;
  sharesPerMinute: number;
}

export interface UiSettings {
  title: string;
  safeZone: { top: number; bottom: number; left: number; right: number };
  showSafeZone: boolean;
  rankingSize: number;
  showRules: boolean;
  notificationSec: number;
  camera: {
    fov: number;
    elevationDeg: number;
    zoom: number;
    offsetZ: number;
    focusEnabled: boolean;
    /** Camera flies to every cat that joins the pond with a "Chào mừng" bubble. */
    welcomeFocus: boolean;
    /** Seconds the camera stays on a newly joined cat. */
    welcomeSec: number;
  };
  /** Popup that explains gifts → luck to viewers. Shown on a timer, on "quà" comments, or from the admin. */
  giftGuide: { enabled: boolean; intervalSec: number; durationSec: number; firstDelaySec: number };
  fpsCap: 30 | 60;
  quality: 'low' | 'medium' | 'high';
  /** Procedural, copyright-free lo-fi background music (generated in the browser). */
  music: MusicSettings;
  /** Automatic voice announcements (text-to-speech). */
  voice: VoiceSettings;
}

/** Events that can be read aloud. */
export type VoiceEventKind = 'join' | 'follow' | 'gift' | 'share' | 'catch' | 'rare' | 'epic' | 'legendary' | 'fail' | 'leave' | 'event';
export const VOICE_EVENT_KINDS: VoiceEventKind[] = ['join', 'follow', 'gift', 'share', 'catch', 'rare', 'epic', 'legendary', 'fail', 'leave', 'event'];

export type VoiceEngine = 'auto' | 'edge' | 'windows';

export interface VoiceSettings {
  enabled: boolean;
  /** auto = Edge Online, falls back to Windows offline when Edge fails. */
  engine: VoiceEngine;
  /** Edge neural voice, e.g. vi-VN-HoaiMyNeural (female) / vi-VN-NamMinhNeural (male). */
  edgeVoice: string;
  /** Windows OneCore voice display name ('' = first Vietnamese voice). */
  windowsVoice: string;
  /** Speaking speed in percent (-50 … +50). */
  rate: number;
  /** 0–100 */
  volume: number;
  /** Don't read events from simulated (bot) viewers. */
  skipBots: boolean;
  /** Max announcements waiting; extra low-priority ones are dropped. */
  maxQueue: number;
  /** Names containing one of these words are never read aloud. */
  bannedWords: string[];
  /** Per event: on/off + sentence template ({name} {fish} {kg} {gift} {event}). */
  events: Record<VoiceEventKind, { enabled: boolean; template: string }>;
}

/** Structured details attached to a notification, used to build the spoken sentence. */
export interface SpeechMeta {
  name?: string;
  fish?: string;
  kg?: number;
  gift?: string;
  count?: number;
  event?: string;
  bot?: boolean;
}

export interface SpeechDTO {
  id: string;
  text: string;
  kind: VoiceEventKind;
  /** Higher = more important (kept when the queue is full). */
  priority: number;
  createdAt: number;
}

export interface MusicSettings {
  enabled: boolean;
  /** 0–100 */
  volume: number;
  /** Tempo 55–100 BPM. */
  bpm: number;
  /** Vinyl crackle + soft pond water under the music. */
  ambience: boolean;
  /** Sparkle chimes when a Rare / Epic / Legendary fish is caught. */
  catchChimes: boolean;
}

export interface GameConfig {
  version: number;
  /** Stored-config migration level (see ConfigStore). */
  schemaRev?: number;
  rarities: RarityConfig[];
  fish: FishDef[];
  cats: CatAppearance[];
  gifts: GiftRule[];
  luck: LuckConfig;
  events: FishingEventDef[];
  game: GameSettings;
  ui: UiSettings;
}

// ---------------------------------------------------------------- Live events
export type LiveEventType =
  | 'COMMENT' | 'GIFT' | 'LIKE' | 'FOLLOW' | 'SHARE' | 'VIEWER_JOIN' | 'VIEWER_LEAVE' | 'ROOM_USERS' | 'LIVE_START' | 'LIVE_END';

export type ProviderId = 'mock' | 'tiktok' | 'baltik';

export interface LiveUser {
  userId: string;
  uniqueId: string;
  nickname: string;
  avatarUrl?: string;
  /** Simulated audience member (Mock simulator). Real TikTok / bridge viewers never have this. */
  bot?: boolean;
}

/** Normalized event – every provider (including Mock) produces this shape. */
export interface LiveEvent {
  id: string;
  type: LiveEventType;
  provider: ProviderId;
  timestamp: number;
  user?: LiveUser;
  comment?: string;
  gift?: { giftId?: string | number; name: string; diamonds: number; repeatCount: number };
  likeCount?: number;
  /** ROOM_USERS: viewers the platform reports as currently in the room. */
  users?: LiveUser[];
  raw?: unknown;
}

// ---------------------------------------------------------------- Players ---
export type PlayerStatus = 'idle' | 'fishing' | 'queued';

export interface PlayerStats {
  totalWeight: number;
  fishCount: number;
  largestWeight: number;
  largestFishId: string | null;
  commonCount: number;
  uncommonCount: number;
  rareCount: number;
  epicCount: number;
  legendaryCount: number;
  totalGifts: number;
  totalDiamonds: number;
  score: number;
}

export type PersonalLuckSource = 'random' | 'admin' | 'fixed';

export interface PlayerDTO {
  id: string;
  uniqueId: string;
  nickname: string;
  avatarUrl?: string;
  catId: string;
  seat: number | null;
  status: PlayerStatus;
  luck: number;
  /** Personal multiplier (random roll on joining, or set by the admin). Already included in `luck`. */
  personalLuck: number;
  /** random = rolled on join · admin = set for this visit · fixed = saved on the player, applied on every visit. */
  personalLuckSource: PersonalLuckSource;
  /** Simulated audience member (Mock simulator). */
  bot: boolean;
  boostAttempts: number;
  rank: number;
  stats: PlayerStats;
  joinedAt: number;
  lastActive: number;
}

export interface CatchDTO {
  id: string;
  playerId: string;
  fishId: string;
  fishName: string;
  rarity: Rarity;
  weight: number;
  score: number;
  luck: number;
  createdAt: number;
}

export interface FishingTimeline {
  castMs: number;
  waitMs: number;
  biteMs: number;
  pullMs: number;
  resultMs: number;
  celebrateMs: number;
  returnMs: number;
}

export interface FishingCycleDTO {
  cycleId: string;
  playerId: string;
  /** ms already elapsed when this message was produced (non-zero in snapshots). */
  elapsedMs: number;
  timeline: FishingTimeline;
  success: boolean;
  catch: CatchDTO | null;
  luck: number;
  distribution: Record<Rarity, number>;
}

export type LeaderboardCategory = 'weight' | 'largest' | 'count' | 'rare' | 'epic' | 'legendary';
export const LEADERBOARD_CATEGORIES: LeaderboardCategory[] = ['weight', 'largest', 'count', 'rare', 'epic', 'legendary'];

export interface LeaderboardEntry {
  playerId: string;
  nickname: string;
  avatarUrl?: string;
  catId: string;
  value: number;
  totalWeight: number;
  fishCount: number;
  rank: number;
}
export type Leaderboard = Record<LeaderboardCategory, LeaderboardEntry[]>;

export type NotificationKind =
  | 'catch' | 'rare' | 'epic' | 'legendary' | 'gift' | 'join' | 'follow' | 'share' | 'event' | 'fail' | 'info' | 'queue' | 'leave';

export interface NotificationDTO {
  id: string;
  kind: NotificationKind;
  title: string;
  message: string;
  playerId?: string;
  catId?: string;
  fishId?: string;
  rarity?: Rarity;
  color?: string;
  /** Details for the voice announcer (not displayed). */
  speech?: SpeechMeta;
  createdAt: number;
}

export interface CommunityState {
  likeEnergy: number;
  likeThreshold: number;
  totalLikes: number;
  shareBonus: number;
  shareBonusEndsAt: number;
  globalBoosts: { source: string; luck: number; endsAt: number }[];
  communityLuck: number;
}

export interface GameStateDTO {
  status: 'running' | 'paused' | 'stopped';
  sessionId: string;
  sessionStartedAt: number;
  totalCatches: number;
  queue: string[];
}

export interface ConnectionStatus {
  provider: ProviderId | null;
  state: 'disconnected' | 'connecting' | 'connected' | 'error';
  target?: string;
  message?: string;
  since: number;
  mockAuto: boolean;
}

export interface StatsDTO {
  totalPlayers: number;
  activePlayers: number;
  totalCatches: number;
  totalWeight: number;
  totalGifts: number;
  totalDiamonds: number;
  totalLikes: number;
  totalShares: number;
  totalFollows: number;
  byRarity: Record<Rarity, number>;
  eventsProcessed: number;
  duplicatesDropped: number;
}

export interface LogEntry {
  id: number;
  time: number;
  level: 'info' | 'warn' | 'error' | 'event';
  message: string;
}

export interface GiftEffectDTO {
  playerId: string | null;
  nickname: string;
  giftName: string;
  tier: GiftTier;
  count: number;
  luck: number;
  global: boolean;
}

export interface Snapshot {
  serverTime: number;
  config: GameConfig;
  players: PlayerDTO[];
  cycles: FishingCycleDTO[];
  leaderboard: Leaderboard;
  community: CommunityState;
  events: ActiveEventDTO[];
  game: GameStateDTO;
  connection: ConnectionStatus;
  stats: StatsDTO;
  recent: NotificationDTO[];
}

export type ServerMessage =
  | { type: 'snapshot'; data: Snapshot }
  | { type: 'player_joined'; player: PlayerDTO }
  | { type: 'player_updated'; player: PlayerDTO }
  | { type: 'player_left'; playerId: string; reason: string }
  | { type: 'fishing_cycle'; cycle: FishingCycleDTO }
  | { type: 'catch_result'; result: CatchDTO; player: PlayerDTO }
  | { type: 'fishing_failed'; playerId: string; cycleId: string }
  | { type: 'leaderboard'; leaderboard: Leaderboard }
  | { type: 'notification'; notification: NotificationDTO }
  | { type: 'community'; community: CommunityState }
  | { type: 'events_state'; events: ActiveEventDTO[] }
  | { type: 'config'; config: GameConfig }
  | { type: 'game_state'; game: GameStateDTO }
  | { type: 'stats'; stats: StatsDTO }
  | { type: 'connection'; connection: ConnectionStatus }
  | { type: 'log'; entry: LogEntry }
  | { type: 'gift_effect'; effect: GiftEffectDTO }
  | { type: 'show_leaderboard'; category: LeaderboardCategory; requestedBy?: string }
  | { type: 'show_gift_guide'; durationSec: number; requestedBy?: string }
  | { type: 'speak'; speech: SpeechDTO }
  | { type: 'clear' };
