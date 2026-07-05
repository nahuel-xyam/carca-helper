import type { Dir } from './types';
import { Board, DIR_OFFSET } from './board';
import { TILE_BY_ID } from './tiles-full';
import { rotatedSegments } from './geometry';

export interface SegRef {
  x: number;
  y: number;
  i: number; // segment index within the tile's segment list
}

export const segKey = (x: number, y: number, i: number) => `${x},${y}#${i}`;
const tileKey = (x: number, y: number) => `${x},${y}`;

export type ComponentKind = 'city' | 'road' | 'field';

export interface Component {
  id: string; // representative segKey
  kind: ComponentKind;
  segs: SegRef[];
  tiles: Set<string>;
  complete: boolean;
  openEdges: number; // city/road only
  pennants: number; // city only
  borderCities: Set<string>; // field only: ids of city components this field touches
}

export interface CloisterInfo {
  x: number;
  y: number;
  i: number; // segment index of the cloister within its tile
  present: number; // surrounding tiles present (0..8)
  complete: boolean; // present === 8
}

interface RotSeg {
  i: number;
  kind: string;
  edges: Dir[]; // city/road
  nodes: number[]; // field
  pennant: boolean;
}

interface RotTile {
  x: number;
  y: number;
  segs: RotSeg[];
}

/** The 8 surrounding offsets (orthogonal + diagonal) for cloister completion. */
const AROUND: ReadonlyArray<{ x: number; y: number }> = [
  { x: -1, y: -1 }, { x: 0, y: -1 }, { x: 1, y: -1 },
  { x: -1, y: 0 }, { x: 1, y: 0 },
  { x: -1, y: 1 }, { x: 0, y: 1 }, { x: 1, y: 1 },
];

class DSU {
  private parent = new Map<string, string>();
  add(k: string) {
    if (!this.parent.has(k)) this.parent.set(k, k);
  }
  find(k: string): string {
    let p = this.parent.get(k)!;
    while (p !== this.parent.get(p)!) p = this.parent.get(p)!;
    // path-compress
    let cur = k;
    while (this.parent.get(cur)! !== p) {
      const next = this.parent.get(cur)!;
      this.parent.set(cur, p);
      cur = next;
    }
    return p;
  }
  union(a: string, b: string) {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent.set(ra, rb);
  }
}

export class FeatureGraph {
  segToComp = new Map<string, string>();
  components = new Map<string, Component>();
  cloisters: CloisterInfo[] = [];

  constructor(private board: Board) {
    this.build();
  }

  componentOf(x: number, y: number, i: number): Component | undefined {
    const cid = this.segToComp.get(segKey(x, y, i));
    return cid ? this.components.get(cid) : undefined;
  }

  private build(): void {
    // 1. rotated segments per tile
    const rotTiles = new Map<string, RotTile>();
    for (const t of this.board.all()) {
      const def = TILE_BY_ID[t.defId];
      const segs = rotatedSegments(def, t.rot).map((s, i): RotSeg => ({
        i,
        kind: s.kind,
        edges: s.kind === 'city' || s.kind === 'road' ? s.edges : [],
        nodes: s.kind === 'field' ? s.nodes : [],
        pennant: s.kind === 'city' ? s.pennant : false,
      }));
      rotTiles.set(tileKey(t.x, t.y), { x: t.x, y: t.y, segs });
    }

    const dsu = new DSU();
    for (const rt of rotTiles.values())
      for (const s of rt.segs)
        if (s.kind === 'city' || s.kind === 'road' || s.kind === 'field') dsu.add(segKey(rt.x, rt.y, s.i));

    // 2. union city/road across shared edges
    for (const rt of rotTiles.values()) {
      for (const s of rt.segs) {
        if (s.kind !== 'city' && s.kind !== 'road') continue;
        for (const d of s.edges) {
          const off = DIR_OFFSET[d];
          const nb = rotTiles.get(tileKey(rt.x + off.x, rt.y + off.y));
          if (!nb) continue;
          const facing = ((d + 2) % 4) as Dir;
          const nbSeg = nb.segs.find((ns) => ns.kind === s.kind && ns.edges.includes(facing));
          if (nbSeg) dsu.union(segKey(rt.x, rt.y, s.i), segKey(nb.x, nb.y, nbSeg.i));
        }
      }
    }

    // 3. union fields across shared field-node adjacency
    for (const rt of rotTiles.values()) {
      for (const s of rt.segs) {
        if (s.kind !== 'field') continue;
        for (const n of s.nodes) {
          const d = Math.floor(n / 2) as Dir;
          const off = DIR_OFFSET[d];
          const nb = rotTiles.get(tileKey(rt.x + off.x, rt.y + off.y));
          if (!nb) continue;
          const paired = 2 * ((d + 2) % 4) + (1 - (n % 2));
          const nbSeg = nb.segs.find((ns) => ns.kind === 'field' && ns.nodes.includes(paired));
          if (nbSeg) dsu.union(segKey(rt.x, rt.y, s.i), segKey(nb.x, nb.y, nbSeg.i));
        }
      }
    }

    // 4. assemble components
    for (const rt of rotTiles.values()) {
      for (const s of rt.segs) {
        if (s.kind !== 'city' && s.kind !== 'road' && s.kind !== 'field') continue;
        const sk = segKey(rt.x, rt.y, s.i);
        const root = dsu.find(sk);
        this.segToComp.set(sk, root);
        let comp = this.components.get(root);
        if (!comp) {
          comp = {
            id: root,
            kind: s.kind as ComponentKind,
            segs: [],
            tiles: new Set(),
            complete: false,
            openEdges: 0,
            pennants: 0,
            borderCities: new Set(),
          };
          this.components.set(root, comp);
        }
        comp.segs.push({ x: rt.x, y: rt.y, i: s.i });
        comp.tiles.add(tileKey(rt.x, rt.y));
        if (s.kind === 'city' && s.pennant) comp.pennants += 1;
        // open edges: city/road edge facing an empty cell
        if (s.kind === 'city' || s.kind === 'road') {
          for (const d of s.edges) {
            const off = DIR_OFFSET[d];
            if (!rotTiles.has(tileKey(rt.x + off.x, rt.y + off.y))) comp.openEdges += 1;
          }
        }
      }
    }
    for (const comp of this.components.values()) {
      if (comp.kind === 'city' || comp.kind === 'road') comp.complete = comp.openEdges === 0;
    }

    // 5. cloisters
    for (const rt of rotTiles.values()) {
      const cloisterSeg = rt.segs.find((s) => s.kind === 'cloister');
      if (!cloisterSeg) continue;
      let present = 0;
      for (const a of AROUND) if (rotTiles.has(tileKey(rt.x + a.x, rt.y + a.y))) present += 1;
      this.cloisters.push({ x: rt.x, y: rt.y, i: cloisterSeg.i, present, complete: present === 8 });
    }

    // 6. field -> bordering city components
    for (const rt of rotTiles.values()) {
      for (const s of rt.segs) {
        if (s.kind !== 'city') continue;
        const cityRoot = this.segToComp.get(segKey(rt.x, rt.y, s.i));
        if (!cityRoot) continue;
        for (const d of s.edges) {
          // the two field half-edge nodes flanking city edge d
          const borderNodes = [2 * ((d + 1) % 4), 2 * ((d + 3) % 4) + 1];
          for (const bn of borderNodes) {
            const fieldSeg = rt.segs.find((fs) => fs.kind === 'field' && fs.nodes.includes(bn));
            if (!fieldSeg) continue;
            const fieldRoot = this.segToComp.get(segKey(rt.x, rt.y, fieldSeg.i));
            if (fieldRoot) this.components.get(fieldRoot)!.borderCities.add(cityRoot);
          }
        }
      }
    }
  }

  list(kind?: ComponentKind): Component[] {
    const all = [...this.components.values()];
    return kind ? all.filter((c) => c.kind === kind) : all;
  }

  /**
   * Deep copy of the graph structure (for AI search / Game.clone).
   * Faster than rebuilding from board since it copies the assembled structures directly.
   */
  clone(board: Board): FeatureGraph {
    const g = Object.create(FeatureGraph.prototype) as FeatureGraph;
    (g as unknown as { board: Board }).board = board;
    g.segToComp = new Map(this.segToComp);
    g.components = new Map();
    for (const [k, c] of this.components) {
      g.components.set(k, {
        id: c.id,
        kind: c.kind,
        segs: c.segs.map((s) => ({ ...s })),
        tiles: new Set(c.tiles),
        complete: c.complete,
        openEdges: c.openEdges,
        pennants: c.pennants,
        borderCities: new Set(c.borderCities),
      });
    }
    g.cloisters = this.cloisters.map((ci) => ({ ...ci }));
    return g;
  }
}
