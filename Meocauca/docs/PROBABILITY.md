# Fishing probability & Luck

All code lives in `shared/probability.ts` and is used by **both** the backend (authoritative rolls with a
cryptographic RNG) and the admin dashboard (live preview). Covered by `backend/tests/probability.test.ts`.

## Per cast

1. **Luck** = `combine(baseLuck, active gift boosts, stacking)` × **personal luck** × community multiplier × event multipliers, clamped to `[minLuck, maxLuck]`.
   - *Personal luck* is rolled uniformly in `[luck.joinLuck.min, luck.joinLuck.max]` each time a cat enters the pond
     (x1 when disabled), unless the admin set one: **this visit** (dropped when the cat leaves) or **fixed**
     (saved on the player, used on every visit). Set it in *Admin → 🐱 Người chơi → May mắn ✎* or `POST /api/players/:id/luck`
     `{ "luck": 2.5, "persist": true }` (`"luck": null` → back to random).
2. **Rarity weights**: `w_i = base_i × luck^exponent_i × rarityMultiplier_i` (multipliers from gifts like Hand Heart and from events).
3. **Normalize** so the weights sum to 1 (base values that don't add to 100 are normalized too).
4. **Caps**: each rarity above its `maxProbability` is clamped; the excess flows back to Common. → No guaranteed rare fish.
5. **Roll rarity**, then **pick a fish** inside that rarity by its `baseChance` (× event fish boosts). Empty groups fall back to the next lower rarity.
6. **Weight**: `min + (max−min) × rand^skew`, `skew = 1.8 / (1 + (luck−1) × weightLuckInfluence)` (luck nudges toward heavier fish) × the fish's weight multiplier.
7. **Escape chance** (default 8%) is rolled independently → FAIL animation.
8. The result is saved and broadcast; the client animates the state machine from the server timeline; stats/leaderboard are committed at the reveal moment.

## Defaults

| Rarity | Base | Exponent | Cap | Weight (kg) |
|---|---|---|---|---|
| Common | 70% | 0 | 100% | 0.3–3 |
| Uncommon | 20% | 0.7 | 45% | 2–10 |
| Rare | 8% | 1.2 | 30% | 5–30 |
| Epic | 1.8% | 1.6 | 12% | 20–100 |
| Legendary | 0.2% | 1.9 | 3% | 50–300 |

Resulting distribution:

| Luck | Common | Uncommon | Rare | Epic | Legendary |
|---|---|---|---|---|---|
| x1.0 | 70.00% | 20.00% | 8.00% | 1.80% | 0.20% |
| x1.15 | 67.29% | 21.20% | 9.09% | 2.16% | 0.25% |
| x1.5 | 61.70% | 23.41% | 11.47% | 3.04% | 0.38% |
| x2.0 | 55.09% | 25.57% | 14.46% | 4.29% | 0.59% |
| x2.5 | 49.67% | 26.95% | 17.04% | 5.53% | 0.81% |
| x3.0 | 45.13% | 27.82% | 19.28% | 6.73% | 1.04% |
| x5.0 (max) | 32.59% | 28.73% | 25.69% | 11.01% | 1.98% |

Regenerate with `node backend/node_modules/tsx/dist/cli.mjs scripts/print-distribution.ts`; values for your current
config are shown live in **Admin → 🍀 May mắn & Xác suất**.

## Stacking rules

- `max` (default): strongest active boost wins (`base × max(luck_i)`).
- `additive`: `base + Σ(luck_i − 1)`.
- `multiplicative`: `base × Π luck_i`.

Each cast consumes one attempt from every active boost. Sending the same gift again extends its attempts and refreshes its duration.
Gift streaks (`repeatCount`) multiply the attempts when *Streak quà cộng lượt* is on.

## Gifts (defaults – all editable)

| Gift | Luck | Attempts | Duration | Extra |
|---|---|---|---|---|
| Rose | x1.15 | 3 | 3 min | |
| Finger Heart | x1.5 | 6 | 5 min | |
| Doughnut | x2.0 | 12 | 10 min | |
| Hand Heart | x2.5 | 15 | 10 min | Rare x1.3, Epic x1.2 |
| Large Gift (≥200 💎 or Galaxy/Lion/Universe…) | x3.0 | 30 | 15 min | Rare x1.2, Epic x1.3, Legendary x1.3, fireworks |
| Unknown gift | x1.1 | 2 | 2 min | |

Enable **Toàn hồ (global)** on a gift to make it a community boost for everyone instead of only the sender.
