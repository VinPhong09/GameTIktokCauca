import type { GameConfig, GiftRule, FishingEventDef, RarityConfig } from './types';
import { DEFAULT_FISH } from './fish';
import { DEFAULT_CATS } from './cats';

export const DEFAULT_RARITIES: RarityConfig[] = [
  { id: 'common', label: 'Common', labelVi: 'Thường', color: '#9ca3af', baseProbability: 70, luckExponent: 0, maxProbability: 100, weightMin: 0.3, weightMax: 3, scorePerKg: 1, cameraFocus: false, screenAlert: false },
  { id: 'uncommon', label: 'Uncommon', labelVi: 'Khá Hiếm', color: '#4ade80', baseProbability: 20, luckExponent: 0.7, maxProbability: 45, weightMin: 2, weightMax: 10, scorePerKg: 3, cameraFocus: false, screenAlert: false },
  { id: 'rare', label: 'Rare', labelVi: 'Hiếm', color: '#38bdf8', baseProbability: 8, luckExponent: 1.2, maxProbability: 30, weightMin: 5, weightMax: 30, scorePerKg: 8, cameraFocus: true, screenAlert: false },
  { id: 'epic', label: 'Epic', labelVi: 'Sử Thi', color: '#c084fc', baseProbability: 1.8, luckExponent: 1.6, maxProbability: 12, weightMin: 20, weightMax: 100, scorePerKg: 20, cameraFocus: true, screenAlert: true },
  { id: 'legendary', label: 'Legendary', labelVi: 'Huyền Thoại', color: '#fbbf24', baseProbability: 0.2, luckExponent: 1.9, maxProbability: 3, weightMin: 50, weightMax: 300, scorePerKg: 60, cameraFocus: true, screenAlert: true },
];

export const DEFAULT_GIFTS: GiftRule[] = [
  { id: 'rose', giftName: 'Rose', aliases: ['Hoa hồng', 'rose'], minDiamonds: 0, luck: 1.15, attempts: 3, durationSec: 180, global: false, tier: 'small', autoCast: true, rarityBoost: {}, enabled: true },
  { id: 'finger-heart', giftName: 'Finger Heart', aliases: ['Tim ngón tay', 'fingerheart'], minDiamonds: 0, luck: 1.5, attempts: 6, durationSec: 300, global: false, tier: 'medium', autoCast: true, rarityBoost: {}, enabled: true },
  { id: 'doughnut', giftName: 'Doughnut', aliases: ['Donut', 'Bánh donut'], minDiamonds: 0, luck: 2.0, attempts: 12, durationSec: 600, global: false, tier: 'medium', autoCast: true, rarityBoost: {}, enabled: true },
  { id: 'hand-heart', giftName: 'Hand Heart', aliases: ['Hand Hearts', 'Trái tim tay'], minDiamonds: 0, luck: 2.5, attempts: 15, durationSec: 600, global: false, tier: 'large', autoCast: true, rarityBoost: { rare: 1.3, epic: 1.2 }, enabled: true },
  { id: 'large-gift', giftName: 'Large Gift', aliases: ['Galaxy', 'Lion', 'Universe', 'Rocket', 'Interstellar', 'Rosa Nebula', 'Whale diving', 'Sports Car'], minDiamonds: 200, luck: 3.0, attempts: 30, durationSec: 900, global: false, tier: 'mega', autoCast: true, rarityBoost: { rare: 1.2, epic: 1.3, legendary: 1.3 }, enabled: true },
];

export const DEFAULT_EVENTS: FishingEventDef[] = [
  { id: 'golden-hour', name: 'Golden Fish Hour', nameVi: 'Giờ Cá Vàng', description: 'Cá vàng xuất hiện nhiều gấp 3 lần!', color: '#fbbf24', enabled: true, durationSec: 300, luckMultiplier: 1.3, rarityMultipliers: {}, fishBoost: { fishIds: ['golden-koi', 'golden-dragon', 'golden-emperor', 'small-goldfish'], multiplier: 3 }, unlockFishIds: [], intervalMin: 30 },
  { id: 'double-luck', name: 'Double Luck Event', nameVi: 'Nhân Đôi May Mắn', description: 'May mắn x2 cho tất cả mèo!', color: '#34d399', enabled: false, durationSec: 180, luckMultiplier: 2, rarityMultipliers: {}, fishBoost: { fishIds: [], multiplier: 1 }, unlockFishIds: [], intervalMin: 0 },
  { id: 'legendary-event', name: 'Legendary Fishing Event', nameVi: 'Săn Cá Huyền Thoại', description: 'Cá Huyền Thoại xuất hiện nhiều gấp 3!', color: '#f59e0b', enabled: false, durationSec: 180, luckMultiplier: 1, rarityMultipliers: { epic: 1.5, legendary: 3 }, fishBoost: { fishIds: [], multiplier: 1 }, unlockFishIds: [], intervalMin: 0 },
  { id: 'rainbow-event', name: 'Rainbow Fish Event', nameVi: 'Lễ Hội Cầu Vồng', description: 'Cá cầu vồng xuất hiện khắp hồ!', color: '#f472b6', enabled: false, durationSec: 240, luckMultiplier: 1.2, rarityMultipliers: {}, fishBoost: { fishIds: ['rainbow-trout', 'magic-rainbow', 'rainbow-phoenix'], multiplier: 4 }, unlockFishIds: [], intervalMin: 0 },
  { id: 'community-challenge', name: 'Community Fishing Challenge', nameVi: 'Thử Thách Cộng Đồng', description: 'Cả hồ cùng câu với may mắn x1.5!', color: '#60a5fa', enabled: true, durationSec: 60, luckMultiplier: 1.5, rarityMultipliers: {}, fishBoost: { fishIds: [], multiplier: 1 }, unlockFishIds: [], intervalMin: 0 },
];

export const DEFAULT_CONFIG: GameConfig = {
  version: 1,
  schemaRev: 2,
  rarities: DEFAULT_RARITIES,
  fish: DEFAULT_FISH,
  cats: DEFAULT_CATS,
  gifts: DEFAULT_GIFTS,
  luck: {
    baseLuck: 1.0,
    maxLuck: 5.0,
    minLuck: 0.5,
    stacking: 'max',
    maxActiveBoosts: 5,
    repeatExtendsAttempts: true,
    maxAttempts: 200,
    weightLuckInfluence: 0.15,
    shareBonus: { perShare: 0.05, max: 0.5, durationSec: 120 },
    community: { likeThreshold: 1000, luckMultiplier: 1.5, durationSec: 60, autoCastAll: true, eventId: 'community-challenge' },
    unknownGift: { luck: 1.1, attempts: 2, durationSec: 120 },
    joinLuck: { enabled: true, min: 1, max: 1.5 },
  },
  events: DEFAULT_EVENTS,
  game: {
    maxPlayers: 40,
    queueEnabled: true,
    maxQueue: 100,
    fishingCooldownSec: 1.5,
    commandCooldownSec: 1.0,
    idleTimeoutMin: 3,
    autoJoinOnViewerJoin: false,
    autoJoinOnComment: true,
    escapeChance: 8,
    waitMinSec: 2.5,
    waitMaxSec: 6.5,
    autoContinue: true,
    autoFishAll: false,
    autoFishPauseSec: 2,
    timeOfDay: 'auto',
    dayCycleMinutes: 20,
    commands: { fish: ['câu', 'câu cá', 'cau', 'fish'], join: ['join', 'tham gia', 'vào'], top: ['top', 'bxh', 'rank'], gifts: ['quà', 'quà tặng', 'gift', 'gifts'], leave: ['rời hồ', 'thoát', 'out', 'leave'] },
    leaveOnLiveEnd: true,
    botsYieldToViewers: true,
    autoAudience: {
      enabled: false, maxBots: 15, joinsPerMinute: 6, keepFreeSeats: 3, stayMinMin: 3, stayMaxMin: 10,
      castsPerMinute: 3, likesPerMinute: 20, giftsPerMinute: 0.5, sharesPerMinute: 0.3,
    },
  },
  ui: {
    title: 'HỒ CÂU CÁ MÈO',
    safeZone: { top: 110, bottom: 330, left: 24, right: 24 },
    showSafeZone: false,
    rankingSize: 5,
    showRules: true,
    notificationSec: 4,
    camera: { fov: 50, elevationDeg: 64, zoom: 1, offsetZ: 0, focusEnabled: true, welcomeFocus: true, welcomeSec: 3 },
    giftGuide: { enabled: true, intervalSec: 90, durationSec: 12, firstDelaySec: 20 },
    fpsCap: 60,
    quality: 'high',
    music: { enabled: true, volume: 35, bpm: 72, ambience: true, catchChimes: true },
    voice: {
      enabled: true,
      engine: 'auto',
      edgeVoice: 'vi-VN-HoaiMyNeural',
      windowsVoice: '',
      rate: 5,
      volume: 90,
      skipBots: false,
      maxQueue: 4,
      bannedWords: [],
      events: {
        join: { enabled: true, template: 'Chào mừng {name} đã vào hồ câu!' },
        follow: { enabled: true, template: 'Cảm ơn {name} đã theo dõi kênh!' },
        gift: { enabled: true, template: 'Cảm ơn {name} đã tặng {gift}!' },
        share: { enabled: true, template: 'Cảm ơn {name} đã chia sẻ buổi live!' },
        catch: { enabled: false, template: '{name} câu được {fish}, {kg} ký.' },
        rare: { enabled: true, template: '{name} câu được cá hiếm {fish}, nặng {kg} ký!' },
        epic: { enabled: true, template: 'Tuyệt vời! {name} câu được cá sử thi {fish}, nặng {kg} ký!' },
        legendary: { enabled: true, template: 'Ôi trời ơi! {name} vừa câu được cá huyền thoại {fish}, nặng {kg} ký!' },
        fail: { enabled: false, template: 'Ôi, cá của {name} thoát mất rồi!' },
        leave: { enabled: false, template: 'Tạm biệt {name}, hẹn gặp lại nhé!' },
        event: { enabled: true, template: 'Sự kiện {event} bắt đầu rồi!' },
      },
    },
  },
};

/** Deep clone helper that works in both Node and browsers. */
export function cloneConfig<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
