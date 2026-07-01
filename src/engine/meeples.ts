import type { ActionResult } from './types';
import { FeatureGraph, Component, segKey } from './features';

export const MEEPLES_PER_PLAYER = 7;

/** Tracks meeple placements (keyed by segment instance) and per-player supply. */
export class Meeples {
  private placements = new Map<string, number>(); // segKey -> player
  private supplyByPlayer = new Map<number, number>();

  constructor(players: number[] = [0]) {
    for (const p of players) this.supplyByPlayer.set(p, MEEPLES_PER_PLAYER);
  }

  supply(player: number): number {
    return this.supplyByPlayer.get(player) ?? 0;
  }

  /** Player on a specific segment instance, if any. */
  on(x: number, y: number, i: number): number | undefined {
    return this.placements.get(segKey(x, y, i));
  }

  /** All current meeple placements (for rendering). */
  all(): { x: number; y: number; i: number; player: number }[] {
    return [...this.placements.entries()].map(([k, player]) => {
      const [coords, i] = k.split('#');
      const [x, y] = coords.split(',').map(Number);
      return { x, y, i: Number(i), player };
    });
  }

  meeplesOnComponent(comp: Component): Map<number, number> {
    const counts = new Map<number, number>();
    for (const s of comp.segs) {
      const p = this.placements.get(segKey(s.x, s.y, s.i));
      if (p !== undefined) counts.set(p, (counts.get(p) ?? 0) + 1);
    }
    return counts;
  }

  canPlace(graph: FeatureGraph, x: number, y: number, i: number, player: number): ActionResult {
    if (this.supply(player) <= 0) return { ok: false, reason: 'no meeples left' };
    if (this.placements.has(segKey(x, y, i))) return { ok: false, reason: 'segment occupied' };
    const comp = graph.componentOf(x, y, i);
    if (comp) {
      const counts = this.meeplesOnComponent(comp);
      if (counts.size > 0) return { ok: false, reason: 'feature already claimed' };
    }
    // cloister (no component) only needs the exact-segment check above
    return { ok: true };
  }

  /** Independent deep copy of placements and supply. */
  clone(): Meeples {
    const m = new Meeples([]);
    m.placements = new Map(this.placements);
    m.supplyByPlayer = new Map(this.supplyByPlayer);
    return m;
  }

  /** Restore placements and supply from a snapshot. */
  restore(placements: { x: number; y: number; i: number; player: number }[], supply: Map<number, number>): void {
    this.placements = new Map(placements.map((p) => [segKey(p.x, p.y, p.i), p.player]));
    this.supplyByPlayer = new Map(supply);
  }

  place(x: number, y: number, i: number, player: number): void {
    this.placements.set(segKey(x, y, i), player);
    this.supplyByPlayer.set(player, this.supply(player) - 1);
  }

  /** Remove all meeples on a component, returning a per-player count and restoring supply. */
  returnComponent(comp: Component): Map<number, number> {
    const returned = new Map<number, number>();
    for (const s of comp.segs) {
      const k = segKey(s.x, s.y, s.i);
      const p = this.placements.get(k);
      if (p !== undefined) {
        returned.set(p, (returned.get(p) ?? 0) + 1);
        this.supplyByPlayer.set(p, this.supply(p) + 1);
        this.placements.delete(k);
      }
    }
    return returned;
  }

  /** Remove a meeple from a specific cloister/segment, restoring supply. */
  returnSegment(x: number, y: number, i: number): void {
    const k = segKey(x, y, i);
    const p = this.placements.get(k);
    if (p !== undefined) {
      this.supplyByPlayer.set(p, this.supply(p) + 1);
      this.placements.delete(k);
    }
  }
}
