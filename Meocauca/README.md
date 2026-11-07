# 🐱🎣 CAT FISHING LIVE — HỒ CÂU CÁ MÈO

Interactive **3D TikTok LIVE fishing game** where every viewer becomes a cute low‑poly cat fishing around a circular pond.
Runs 100% in the browser on localhost — **Three.js + WebGL**, React, Node.js, WebSocket, SQLite. No Unity / Unreal / desktop windows.

| Page | URL | Purpose |
|---|---|---|
| Game | http://localhost:3000/game | Full 9:16 game, fitted to any window |
| Admin | http://localhost:3000/admin | Dashboard: connection, simulator, players, fish, luck, gifts, events, control, stats |
| Overlay | http://localhost:3000/overlay | OBS / TikTok LIVE Studio browser source (native 1080×1920) |

## Quick start (Windows)

1. Install **Node.js 20+** (https://nodejs.org).
2. Double‑click **`start.bat`** — installs dependencies on first run, builds the UI, starts the server and opens the admin page.
3. In **Admin → 🧪 Simulator** press **"+10 mèo câu cá"** or **"🎣 Comment câu"** — the game works fully without TikTok.
4. **`stop.bat`** stops the server. **`test.bat`** runs all tests.

`start.bat rebuild` forces a UI rebuild (after editing frontend code).

Manual / other OS:
```bash
npm run install:all
npm run build
npm start
```
Development with hot reload: `npm run dev:backend` + `npm run dev:frontend` (Vite on http://localhost:5173/game, proxied to the backend).

## How to play (viewers)

| Action | Effect |
|---|---|
| Comment **`câu`** / **`câu cá`** | Your cat joins (if needed) and casts. Commenting while fishing queues the next cast. |
| Comment **`join`** | Join the pond without casting |
| Comment **`top`** | Shows the full leaderboard on screen |
| Comment **`rời hồ`** / **`thoát`** / **`out`** | Your cat leaves the pond (frees the seat for the queue) |
| Comment **`quà`** | Shows the **gift guide popup** (each gift's luck, casts, duration, rarity bonuses). Also appears automatically every 90 s and from *Admin → 🎮 Điều khiển → 🎁 Hiện bảng quà tặng* |
| **Follow** | A new cat is created with a random look + welcome notification |
| **Joining** | Each cat gets a random personal Luck in the range set in *Admin → 🍀 May mắn → Luck ngẫu nhiên khi mèo vào hồ* (default x1–x1.5); the admin can set any cat's luck in *🐱 Người chơi* |
| **Gifts** | Temporary Luck boost for *your* cat (Rose x1.15/3 casts … Large Gift x3/30 casts) + auto cast + effects |
| **Likes** | Fill the community energy bar → **Community Fishing Challenge** (everyone casts, Luck x1.5) |
| **Share** | Community Luck bonus (+5% each, max +50%, 2 min) |

Gifts **never guarantee** a Legendary fish — they raise probabilities, which are capped. A player who never gifts can still catch Legendary fish (0.2% base).

## Features

- **3D world**: circular pond with animated water shader (waves, caustics, sparkles, foam), underwater basin with seaweed and swimming fish, lily pads, a wooden circular deck with planks/railings/walkways/stools/buckets, trees, flowers, rocks, bunting flags, lanterns, signboard, center island statue, sky dome with clouds/stars/moon, **day / sunset / night cycle**.
- **24 cat appearances** (10 breeds: orange tabby, white, black, British Shorthair, calico, Siamese, Scottish Fold, Ragdoll, tuxedo, cream + variants) with ears, tail, whiskers, eyes, paws, fishing vest, hats and rods. Procedurally animated (idle, cast, wait, pull, catch, celebrate, fail, gift reaction, blink).
- **24 original fish** across 5 rarities with rarity visuals (sparkle → glow → aura → legendary light beam, golden aura, confetti, big splash, camera focus, screen banner). Optional GLB override per fish.
- **Fishing state machine** IDLE → CAST → WAITING → BITE → PULL → CATCH → RESULT → CELEBRATE → RETURN (or FAIL), driven by the server's pre-rolled result — animations always match the real outcome.
- **Probability + Luck system** (shared code, unit-tested): configurable base %, luck exponent per rarity, caps, stacking rules (max / additive / multiplicative), boost attempts + durations, community & event multipliers.
- **Players**: 30–50+ cats, auto registration, duplicate prevention, reconnection (stats persisted), smart seat spreading, waiting queue, replacement of idle never-fished cats when full.
- **"Tất cả tự động câu"** (*Admin → 🎮 Điều khiển*): every seated cat keeps fishing by itself (configurable pause +
  random jitter), no comment needed; a "🎣 Tự câu" chip shows on the game. Automatic casts don't count as activity,
  so cats of viewers who left still leave the pond.
- **Voice announcements** (*Admin → 🔊 Giọng nói*): the server reads events aloud — joins, follows, gifts, shares,
  Rare/Epic/Legendary catches, events (optional: common catches, escapes, leaves) — with editable sentence templates
  (`{name} {fish} {kg} {gift} {event}`). Voices: **Edge Online** neural (vi-VN-HoaiMy / NamMinh, needs internet) or
  **Windows offline** (install the Vietnamese voice in *Settings → Time & Language → Speech*); *Auto* falls back from
  Edge to Windows. Audio plays through `/game` / `/overlay` (captured by OBS), music ducks while speaking, priority
  queue, names cleaned (emoji removed, `user123…` → "bạn mới"), banned-word list, optional "skip bots".
  `?voice=0` disables it on one page.
- **Auto audience** (*Admin → 🧪 Simulator → 🤖 Khán giả tự động*): when on, simulated viewers with realistic names
  keep the pond lively — limit of bot cats, new cats per minute, seats always kept free for real viewers, how long each
  bot stays (random min–max, then it leaves), casts per minute per bot, likes / gifts / shares per minute, presets
  (Vắng / Vừa / Đông), live status and "Xoá hết mèo bot". Bots stop joining while a real viewer is waiting. The on/off
  state is saved, so it resumes after a server restart.
- **Bots give way to real viewers**: simulator cats are flagged as bots (🤖 in *Admin → 🐱 Người chơi*). When the pond is
  full, a real viewer takes a bot's seat at once (idle bots first); real viewers always queue ahead of bots and bots never
  replace a real viewer. Toggle: *Admin → 🎮 Điều khiển → "🤖 Mèo giả lập nhường chỗ cho người xem thật"*.
- **Welcome camera**: when a cat takes a seat (new viewer, or promoted from the queue) the camera flies to it, a
  "🎉 Chào mừng …!" bubble pops above it, confetti bursts and the cat jumps. Welcomes play one at a time (only the 3 most
  recent during a burst of joins) and always yield to Rare/Epic/Legendary catch close-ups. Toggle + duration in
  *Admin → 🎮 Điều khiển → "Camera chúc mừng mèo mới vào hồ" / "Chúc mừng mèo mới (giây)"*.
- **Leaving the LIVE**: TikTok does not announce viewers leaving, so a cat stays only while its viewer is present — any comment, like,
  gift, share, follow or TikTok's `roomUser` viewer list keeps it; after **3 minutes** without any of these the cat leaves
  (*Admin → 🎮 Điều khiển → "Rời hồ khi không tương tác"*). Bridges that do send leave events (`leave`, `viewer_leave`,
  `member_leave`) remove the cat instantly, and the whole pond is cleared when the LIVE ends. Stats are kept for when they return.
- **Clean 9:16 layout**: compact header, leaderboard + "how to play" side by side at the top, slim bottom bar; the camera
  auto-fits the whole ring of cats into the space between them, and name tags are staggered so neighbours don't overlap.
- **Leaderboards**: total weight (primary), largest fish, most fish, rare / epic / legendary counts.
- **Live connectors**: TikTok Live Connector (community library), Baltik Live Bridge / generic WebSocket bridge, Mock provider — all normalized into one event pipeline with duplicate detection, anti‑spam and cooldowns.
- **Events**: Golden Fish Hour (scheduled every 30 min by default), Double Luck, Legendary Fishing, Rainbow Fish, Community Challenge — start/stop/configure from the dashboard.
- **9:16 HUD** with configurable TikTok safe zones; **OBS overlay** with transparent mode.
- **Background music**: original lo-fi chill music **generated live in code** (Web Audio API — no audio files, so no copyright
  issues): electric piano, pad, bass, brushed drums, kalimba melody, vinyl crackle + pond water. Chords, sections and key keep
  changing; sparkle chimes on Rare/Epic/Legendary catches. On/off, volume, BPM in *Admin → 🎮 Điều khiển → 🎵 Nhạc nền*;
  `?music=0` disables it on one page, **M** mutes locally.
- **Performance**: instancing for environment props, one shared material for all cats, merged geometries, pooled particles/ripples/auras, incremental scene updates, adaptive resolution + 60→30 FPS fallback, wall‑clock animation sync (correct even when OBS throttles frames).

## Tests

`test.bat` runs:
1. Backend unit tests (Vitest): probability normalization/caps/monotonicity, Monte Carlo distribution, stacking, fish/weight rolls, full event pipeline (join, cast, catch, gifts, duplicates, cooldown, queue, likes, shares, pause).
2. Frontend TypeScript typecheck.
3. Production build.
4. End‑to‑end smoke test: boots a real server on port 3999 with an in-memory DB and drives it via REST + WebSocket.

## Project structure

```
cat-fishing-live/
├── frontend/src/
│   ├── game/ core · scenes · camera · environment · pond · cats · fishing · fish · probability · effects · leaderboard
│   ├── dashboard/   admin panels
│   ├── components/  stage + HUD
│   ├── pages/       /game /admin /overlay
│   └── services/    socket, store, api
├── backend/src/
│   ├── connectors/  mock, tiktok-live-connector, baltik bridge, normalizer
│   ├── events/      event bus (dedupe) + processor (gameplay mapping)
│   ├── players/     seats, queue, idle timeout
│   ├── fishing/     authoritative fishing cycles
│   ├── probability/ luck service
│   ├── services/    game root, config, leaderboard, stats, events, community, mock simulator
│   ├── database/    SQLite (sql.js) + repository
│   └── websocket/   WS hub
├── shared/          types, defaults (fish, cats, gifts, events), probability algorithm
├── assets/          optional GLB models (served at /models)
├── config/          settings.json (port, DB, default provider)
├── docs/            architecture, probability, OBS setup, events/API
├── scripts/         smoke test
└── start.bat · stop.bat · test.bat
```

More: [docs/OBS_SETUP.md](docs/OBS_SETUP.md) · [docs/PROBABILITY.md](docs/PROBABILITY.md) · [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) · [docs/EVENTS_API.md](docs/EVENTS_API.md)

## Notes on TikTok

There is no unrestricted official TikTok LIVE events API. The **TikTok Live Connector** provider uses the community
`tiktok-live-connector` package **v2** (v1.x no longer works: its Euler Stream signing route was retired, giving
"Failed to sign request … 403"). v2 officially asks for Node 22 but runs on Node 20 (`backend/.npmrc` disables the engine check).
Requests are signed by Euler Stream's free tier; if you hit rate limits, add an Euler Stream API key in the admin
(or `config/settings.json → live.tiktok.signApiKey`). It can break when TikTok changes things — the
**Baltik/WebSocket bridge** provider lets you plug in any relay tool instead, and the **Mock** provider always works for
testing. All three share the exact same event pipeline.
