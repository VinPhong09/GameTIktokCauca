# Events & API

## Normalized live event

Every provider produces this shape (`shared/types.ts → LiveEvent`):

```json
{
  "id": "provider-message-id-or-hash",
  "type": "COMMENT | GIFT | LIKE | FOLLOW | SHARE | VIEWER_JOIN | VIEWER_LEAVE | LIVE_START | LIVE_END",
  "provider": "tiktok | baltik | mock",
  "timestamp": 1730000000000,
  "user": { "userId": "123", "uniqueId": "cat_lover", "nickname": "Cat Lover", "avatarUrl": "https://…" },
  "comment": "câu",
  "gift": { "name": "Rose", "diamonds": 1, "repeatCount": 5 },
  "likeCount": 15
}
```

## Bridge (Baltik / any WebSocket relay)

The bridge connector accepts JSON messages (single object or array) in either format:

```json
{ "event": "chat", "data": { "uniqueId": "a", "nickname": "A", "comment": "câu", "msgId": "1" } }
{ "event": "gift", "data": { "uniqueId": "a", "giftName": "Rose", "diamondCount": 1, "repeatCount": 3, "repeatEnd": true } }
{ "type": "COMMENT", "user": { "userId": "1", "uniqueId": "a", "nickname": "A" }, "comment": "câu" }
```

Event names: `chat/comment`, `gift`, `like`, `follow`, `share`, `member/join`, `streamEnd`. Streak gifts
(`giftType: 1`) are only processed when `repeatEnd` is true.

## REST API (`/api`)

| Method | Path | Body | Description |
|---|---|---|---|
| GET | `/health` | | Health check |
| GET | `/state` | | Full snapshot |
| GET / PUT | `/config` | full config | Read / replace configuration |
| PATCH | `/config/:section` | object or array | Update `rarities`, `fish`, `cats`, `gifts`, `luck`, `events`, `game`, `ui` |
| POST | `/config/reset` | `{ section? }` | Restore defaults |
| GET | `/probability?luck=2` | | Distribution + per-fish probability |
| GET | `/players` | | Active players + queue |
| POST | `/players/:id/appearance` | `{ catId }` | Change cat |
| POST | `/players/:id/reset` | | Reset player stats |
| POST | `/players/:id/cast` | | Force a cast |
| DELETE | `/players/:id?forget=1` | | Remove from pond (and DB) |
| POST | `/game/:action` | | `start`, `pause`, `resume`, `restart`, `reset-leaderboard`, `cast-all`, `show-leaderboard`, `show-gift-guide` |
| GET | `/stats`, `/leaderboard`, `/logs`, `/events` | | |
| POST | `/events/:id/start` | `{ durationSec? }` | Start a fishing event |
| POST | `/events/:id/stop` | | Stop it |
| POST | `/connect` | `{ provider, options: { username \| url } }` | Connect a live provider |
| POST | `/disconnect` | | |
| POST | `/mock/event` | `{ type, user?, comment?, giftName?, diamonds?, repeatCount?, likeCount?, id? }` | Inject a mock event (same pipeline) |
| POST | `/mock/spawn` | `{ count, fish }` | Add N mock viewers |
| POST | `/mock/auto` | `{ enabled, eventsPerMinute }` | Background mock audience |

## WebSocket (`/ws?role=game|overlay|admin`)

Server → client messages (`ServerMessage` in `shared/types.ts`): `snapshot`, `player_joined`, `player_updated`,
`player_left`, `fishing_cycle`, `catch_result`, `fishing_failed`, `leaderboard`, `notification`, `community`,
`events_state`, `config`, `game_state`, `stats`, `connection`, `gift_effect`, `show_leaderboard`, `show_gift_guide`, `clear`, `log` (admin only).
Client → server: `{ "type": "resync" }` requests a fresh snapshot.
