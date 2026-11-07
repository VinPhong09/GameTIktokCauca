import type { GameConfig, NotificationDTO, ServerMessage } from '@shared/types';
import type { Rng } from '@shared/probability';
import type { Repository } from '../database/repository';
import type { PlayerManager } from '../players/PlayerManager';
import type { LuckService } from '../probability/LuckService';
import type { CommunityService } from './CommunityService';
import type { FishingEventService } from './FishingEventService';
import type { FishingService } from '../fishing/FishingService';
import type { LeaderboardService } from './LeaderboardService';
import type { StatsService } from './StatsService';

export type NotifyInput = Omit<NotificationDTO, 'id' | 'createdAt'>;

/** Everything a game service may need. Implemented by the Game composition root. */
export interface GameContext {
  config(): GameConfig;
  repo: Repository;
  rng: Rng;
  now(): number;
  broadcast(msg: ServerMessage, opts?: { adminOnly?: boolean }): void;
  notify(n: NotifyInput): void;
  isPaused(): boolean;
  showGiftGuide(requestedBy?: string): boolean;
  sessionId(): string;
  players: PlayerManager;
  luck: LuckService;
  community: CommunityService;
  events: FishingEventService;
  fishing: FishingService;
  leaderboard: LeaderboardService;
  stats: StatsService;
}
