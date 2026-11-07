import { create } from 'zustand';
import type {
  ActiveEventDTO, CommunityState, ConnectionStatus, GameConfig, GameStateDTO, Leaderboard, LeaderboardCategory,
  LogEntry, NotificationDTO, PlayerDTO, ServerMessage, StatsDTO,
} from '@shared/types';

const emptyLb: Leaderboard = { weight: [], largest: [], count: [], rare: [], epic: [], legendary: [] };

export interface Toast extends NotificationDTO {
  expiresAt: number;
}

export interface GameStore {
  connected: boolean;
  config: GameConfig | null;
  players: Record<string, PlayerDTO>;
  leaderboard: Leaderboard;
  community: CommunityState | null;
  events: ActiveEventDTO[];
  game: GameStateDTO | null;
  connection: ConnectionStatus | null;
  stats: StatsDTO | null;
  toasts: Toast[];
  banner: Toast | null;
  feed: NotificationDTO[];
  logs: LogEntry[];
  leaderboardPopup: { category: LeaderboardCategory; until: number; requestedBy?: string } | null;
  giftGuidePopup: { id: number; until: number; durationSec: number; requestedBy?: string } | null;
  setConnected(v: boolean): void;
  apply(msg: ServerMessage): void;
  dismissExpired(now: number): void;
}

const BANNER_KINDS = new Set(['legendary', 'epic', 'event']);
/** Kinds that only go to the bottom feed (they are frequent and would cover the pond). */
const TOAST_SKIP = new Set(['fail', 'queue', 'catch', 'join', 'leave']);

export const useGameStore = create<GameStore>((set, get) => ({
  connected: false,
  config: null,
  players: {},
  leaderboard: emptyLb,
  community: null,
  events: [],
  game: null,
  connection: null,
  stats: null,
  toasts: [],
  banner: null,
  feed: [],
  logs: [],
  leaderboardPopup: null,
  giftGuidePopup: null,

  setConnected: (v) => set({ connected: v }),

  apply: (msg) => {
    switch (msg.type) {
      case 'snapshot': {
        const s = msg.data;
        const players: Record<string, PlayerDTO> = {};
        for (const p of s.players) players[p.id] = p;
        set({
          config: s.config, players, leaderboard: s.leaderboard, community: s.community, events: s.events,
          game: s.game, connection: s.connection, stats: s.stats, feed: s.recent.slice(-8).reverse(),
        });
        break;
      }
      case 'player_joined':
      case 'player_updated':
        set({ players: { ...get().players, [msg.player.id]: msg.player } });
        break;
      case 'catch_result':
        set({ players: { ...get().players, [msg.player.id]: msg.player } });
        break;
      case 'player_left': {
        const players = { ...get().players };
        delete players[msg.playerId];
        set({ players });
        break;
      }
      case 'leaderboard': set({ leaderboard: msg.leaderboard }); break;
      case 'community': set({ community: msg.community }); break;
      case 'events_state': set({ events: msg.events }); break;
      case 'config': set({ config: msg.config }); break;
      case 'game_state': set({ game: msg.game }); break;
      case 'stats': set({ stats: msg.stats }); break;
      case 'connection': set({ connection: msg.connection }); break;
      case 'log': set({ logs: [...get().logs.slice(-299), msg.entry] }); break;
      case 'show_leaderboard':
        set({ leaderboardPopup: { category: msg.category, until: Date.now() + 9000, requestedBy: msg.requestedBy } });
        break;
      case 'show_gift_guide':
        set({ giftGuidePopup: { id: Date.now(), until: Date.now() + msg.durationSec * 1000, durationSec: msg.durationSec, requestedBy: msg.requestedBy } });
        break;
      case 'clear':
        set({ players: {}, toasts: [], banner: null, feed: [] });
        break;
      case 'notification': {
        const n = msg.notification;
        const secs = get().config?.ui.notificationSec ?? 4;
        const feed = [n, ...get().feed].slice(0, 8);
        if (BANNER_KINDS.has(n.kind)) {
          const dur = n.kind === 'legendary' ? 7000 : n.kind === 'epic' ? 5000 : 4500;
          set({ feed, banner: { ...n, expiresAt: Date.now() + dur } });
        } else if (!TOAST_SKIP.has(n.kind)) {
          const toasts = [...get().toasts, { ...n, expiresAt: Date.now() + secs * 1000 }].slice(-3);
          set({ feed, toasts });
        } else {
          set({ feed });
        }
        break;
      }
    }
  },

  dismissExpired: (now) => {
    const { toasts, banner, leaderboardPopup, giftGuidePopup } = get();
    const next = toasts.filter((t) => t.expiresAt > now);
    const patch: Partial<GameStore> = {};
    if (next.length !== toasts.length) patch.toasts = next;
    if (banner && banner.expiresAt <= now) patch.banner = null;
    if (leaderboardPopup && leaderboardPopup.until <= now) patch.leaderboardPopup = null;
    if (giftGuidePopup && giftGuidePopup.until <= now) patch.giftGuidePopup = null;
    if (Object.keys(patch).length) set(patch);
  },
}));
