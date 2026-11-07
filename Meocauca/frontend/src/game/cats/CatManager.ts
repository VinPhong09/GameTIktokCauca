import type { FishingCycleDTO, GameConfig, GiftEffectDTO, PlayerDTO } from '@shared/types';
import { getCat } from '@shared/cats';
import { CatActor, type World } from './CatActor';

/**
 * Adds/removes cats incrementally (never rebuilds the scene), keeps seats in sync
 * and routes fishing cycles to the right actor.
 */
export class CatManager {
  readonly actors = new Map<string, CatActor>();
  private leaving = new Set<CatActor>();
  private maxSeats = 40;
  private catKeys = new Map<string, string>();

  constructor(private world: World, private config: () => GameConfig | null) {}

  setMaxSeats(n: number) {
    if (n === this.maxSeats) return;
    this.maxSeats = n;
    for (const a of this.actors.values()) if (a.seat !== null) a.setSeat(a.seat, n, false);
  }

  /** Returns true when a new cat actor was created (the cat just appeared in the pond). */
  upsert(p: PlayerDTO): boolean {
    const cfg = this.config();
    if (!cfg) return false;
    let created = false;
    let actor = this.actors.get(p.id);
    if (p.seat === null) {
      if (actor) this.remove(p.id);
      return false;
    }
    const cat = getCat(cfg.cats, p.catId);
    if (!actor) {
      actor = new CatActor(p, cat, this.world);
      actor.setSeat(p.seat, this.maxSeats, true);
      this.actors.set(p.id, actor);
      this.catKeys.set(p.id, p.catId);
      this.world.effects.sparkle(actor.root.position.clone().setY(1.4), 'rare', 16);
      created = true;
    } else {
      if (actor.seat !== p.seat) actor.setSeat(p.seat, this.maxSeats, false);
      if (this.catKeys.get(p.id) !== p.catId) {
        actor.setAppearance(cat);
        this.catKeys.set(p.id, p.catId);
      }
    }
    actor.updateTag(p);
    return created;
  }

  remove(id: string) {
    const actor = this.actors.get(id);
    if (!actor) return;
    this.actors.delete(id);
    this.catKeys.delete(id);
    this.leaving.add(actor);
    actor.leave(() => {
      this.leaving.delete(actor);
      actor.dispose();
    });
  }

  clear() {
    for (const id of [...this.actors.keys()]) this.remove(id);
  }

  sync(players: PlayerDTO[], cycles: FishingCycleDTO[]) {
    const ids = new Set(players.filter((p) => p.seat !== null).map((p) => p.id));
    for (const id of [...this.actors.keys()]) if (!ids.has(id)) this.remove(id);
    for (const p of players) this.upsert(p);
    for (const c of cycles) this.actors.get(c.playerId)?.startCycle(c);
  }

  cycle(c: FishingCycleDTO) {
    this.actors.get(c.playerId)?.startCycle(c);
  }

  gift(e: GiftEffectDTO) {
    if (e.playerId) this.actors.get(e.playerId)?.giftReact(e.tier);
  }

  refreshAppearances() {
    const cfg = this.config();
    if (!cfg) return;
    for (const [id, a] of this.actors) {
      a.setAppearance(getCat(cfg.cats, a.player.catId));
      this.catKeys.set(id, a.player.catId);
    }
  }

  update(dt: number, t: number) {
    for (const a of this.actors.values()) a.update(dt, t);
    for (const a of this.leaving) a.update(dt, t);
  }
}
