# Architecture

```
TikTok Live Connector ─┐
Baltik / WS bridge ────┼─► normalize ─► EventBus (dedupe) ─► EventProcessor ─► Game services ─► WsHub ─► /game /overlay /admin
Mock simulator (admin) ┘                                         │                 │
                                                          anti-spam, cooldown   SQLite (sql.js)
```

## Backend (`backend/src`)

| Module | Responsibility |
|---|---|
| `connectors/*` | Provider adapters. Each converts its payload into a `LiveEvent` via `normalize.ts` (handles tiktok-live-connector v1 + v2 shapes, gift streaks). |
| `events/EventBus.ts` | Single entry point for every event (real **and** mock). Drops duplicates by `provider:id` (10-minute window). |
| `events/EventProcessor.ts` | Maps events to gameplay: commands (`câu`, `join`, `top`), gifts → luck, likes → community energy, follows → new cat, shares → community luck. Global token bucket + per-user cooldown. |
| `players/PlayerManager.ts` | Persistent records + active cats, seat assignment (max spread), queue, idle timeout, reflow when max players changes. |
| `fishing/FishingService.ts` | Authoritative cycle: rolls result at cast, broadcasts the timeline, commits catch at reveal, handles cooldowns and queued casts. |
| `probability/LuckService.ts` | Gift boosts (attempts + expiry), stacking, community & event multipliers. |
| `services/*` | `Game` (composition root, start/pause/resume/restart), `ConfigStore` (defaults + DB overrides + sanitizing), `LeaderboardService`, `StatsService`, `CommunityService`, `FishingEventService` (scheduled/manual/community events), `MockSimulator`. |
| `database/*` | sql.js SQLite (WASM, no native build) persisted to `data/cat-fishing.sqlite` every 3 s. Tables: players, catches, gifts, config, counters, sessions. |
| `websocket/WsHub.ts` | Snapshot on connect, deltas afterwards, admin-only log stream, heartbeat. |
| `api/routes.ts` | REST for the dashboard (see EVENTS_API.md). |

## Frontend (`frontend/src`)

| Module | Responsibility |
|---|---|
| `game/core` | `GameEngine` (renderer, loop, adaptive resolution, 60→30 FPS fallback), tween/easing, geometry helpers (vertex-colored merges, shared toon material), optional GLB loader. |
| `game/environment` | Sky dome, lighting + day/night palettes, terrain, instanced vegetation, decorations (flags, lanterns, sign, props, island statue). |
| `game/pond` | Water shader, underwater basin (instanced seaweed/fish/lily pads), wooden platform (instanced planks/posts/railings/stools/buckets). |
| `game/cats` | `CatBuilder` (procedural model per appearance, cached), `CatActor` (pose animation per state, rod/line/bobber, fish display, emotes, gift reactions), `CatManager` (incremental add/remove/reseat), `NameTag`. |
| `game/fishing` | `FishingStateMachine` (wall-clock timeline from the server), `FishingRig` (Line2 fishing line with sag + bobber). |
| `game/fish` | `FishBuilder` (13 body shapes × patterns × extras), `IconRenderer` (offscreen renders for HUD icons/avatars). |
| `game/effects` | Pooled particle systems (glow, stars, droplets, confetti), ripples, auras, light beams. |
| `game/camera` | `CameraDirector`: 9:16 fit-to-pond overview, gentle drift, priority focus for rare/epic/legendary. |
| `components/` | `GameStage` (1080×1920 stage scaled to window), HUD (header, ranking, rules, notifications/banners, bottom HUD, leaderboard popup, safe zone guides). |
| `dashboard/` | Admin panels. |

## Shared (`shared/`)

Types, default content (24 cats, 24 fish, gifts, events, settings) and the probability algorithm — imported by both sides
so the dashboard preview is exactly what the server rolls.

## Performance notes

- Environment: ~20 draw calls via `InstancedMesh` and merged geometry.
- Each cat: ~8 draw calls with **one shared vertex-colored toon material**; cat/fish geometries are cached per appearance.
- Particles: 4 pooled `Points` systems (single draw call each); ripples/auras/beams are pooled meshes.
- Players join/leave by adding/removing one actor; the scene is never rebuilt.
- Fishing line buffers are updated in place (no per-frame allocations).
