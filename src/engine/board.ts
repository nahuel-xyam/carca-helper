import type { ActionResult, Dir, PlacedTile } from './types';
import { TILE_BY_ID } from './tiles-full';
import { rotatedEdges } from './geometry';

export interface Pos {
  x: number;
  y: number;
}

/** Neighbour offset for each direction (N,E,S,W). y grows South. */
export const DIR_OFFSET: ReadonlyArray<Pos> = [
  { x: 0, y: -1 }, // N
  { x: 1, y: 0 }, // E
  { x: 0, y: 1 }, // S
  { x: -1, y: 0 }, // W
];

const key = (x: number, y: number) => `${x},${y}`;

export class Board {
  private tiles = new Map<string, PlacedTile>();

  at(x: number, y: number): PlacedTile | undefined {
    return this.tiles.get(key(x, y));
  }

  get size(): number {
    return this.tiles.size;
  }

  all(): PlacedTile[] {
    return [...this.tiles.values()];
  }

  canPlace(p: PlacedTile): ActionResult {
    if (!TILE_BY_ID[p.defId]) return { ok: false, reason: `unknown tile ${p.defId}` };
    if (this.at(p.x, p.y)) return { ok: false, reason: 'cell occupied' };

    if (this.tiles.size === 0) return { ok: true }; // first tile goes anywhere

    const myEdges = rotatedEdges(TILE_BY_ID[p.defId], p.rot);
    let adjacent = false;
    for (let d = 0 as Dir; d < 4; d++) {
      const off = DIR_OFFSET[d];
      const nb = this.at(p.x + off.x, p.y + off.y);
      if (!nb) continue;
      adjacent = true;
      const nbEdges = rotatedEdges(TILE_BY_ID[nb.defId], nb.rot);
      const facing = ((d + 2) % 4) as Dir;
      if (myEdges[d] !== nbEdges[facing]) {
        return { ok: false, reason: `edge mismatch on side ${d}` };
      }
    }
    if (!adjacent) return { ok: false, reason: 'not adjacent to any tile' };
    return { ok: true };
  }

  place(p: PlacedTile): ActionResult {
    const r = this.canPlace(p);
    if (!r.ok) return r;
    this.tiles.set(key(p.x, p.y), { ...p });
    return { ok: true };
  }

  /** Remove the tile at a cell (used to move a not-yet-committed tile). */
  remove(x: number, y: number): void {
    this.tiles.delete(key(x, y));
  }

  /** Empty cells orthogonally adjacent to at least one placed tile. */
  openPositions(): Pos[] {
    const seen = new Set<string>();
    const out: Pos[] = [];
    for (const t of this.tiles.values()) {
      for (const off of DIR_OFFSET) {
        const x = t.x + off.x;
        const y = t.y + off.y;
        if (this.at(x, y)) continue;
        const k = key(x, y);
        if (seen.has(k)) continue;
        seen.add(k);
        out.push({ x, y });
      }
    }
    return out;
  }

  /** Independent deep copy of the board. */
  clone(): Board {
    const b = new Board();
    for (const [k, v] of this.tiles) b.tiles.set(k, { ...v });
    return b;
  }

  /** Restore tiles directly (bypasses adjacency checks; for snapshot reconstruction). */
  restore(tiles: PlacedTile[]): void {
    this.tiles = new Map(tiles.map((t) => [key(t.x, t.y), { ...t }]));
  }

  /** Every legal (pos, rot) for a given tile definition. */
  legalPlacements(defId: string): PlacedTile[] {
    if (this.tiles.size === 0) return [{ defId, rot: 0, x: 0, y: 0 }];
    const out: PlacedTile[] = [];
    for (const pos of this.openPositions()) {
      for (let rot = 0 as Dir; rot < 4; rot++) {
        const cand: PlacedTile = { defId, rot, x: pos.x, y: pos.y };
        if (this.canPlace(cand).ok) out.push(cand);
      }
    }
    return out;
  }
}
