// Shared engine types. Pure data — no DOM, no logic.

/** Direction index for tile edges, clockwise from North. */
export type Dir = 0 | 1 | 2 | 3; // N, E, S, W

export type EdgeKind = 'city' | 'road' | 'field';
export type FeatureKind = 'city' | 'road' | 'cloister' | 'field';

/**
 * Field half-edge nodes. Two per side, indexed 0..7 clockwise:
 * side `d` (a Dir) covers nodes `2*d` and `2*d + 1`, in clockwise order.
 * So N -> 0,1 ; E -> 2,3 ; S -> 4,5 ; W -> 6,7.
 */
export type FieldNode = number; // 0..7

export interface CitySeg {
  kind: 'city';
  edges: Dir[]; // which tile edges this city occupies
  pennant: boolean;
}
export interface RoadSeg {
  kind: 'road';
  edges: Dir[]; // 1 edge (road end) or 2 edges (road passing through); [] only for special cases (unused in base set)
}
export interface FieldSeg {
  kind: 'field';
  nodes: FieldNode[]; // field half-edge nodes 0..7 belonging to this field area
}
export interface CloisterSeg {
  kind: 'cloister';
}

export type Segment = CitySeg | RoadSeg | FieldSeg | CloisterSeg;

export interface TileDef {
  id: string; // canonical letter A..X
  edges: [EdgeKind, EdgeKind, EdgeKind, EdgeKind]; // N, E, S, W (base orientation)
  segments: Segment[];
  count: number; // copies in the base-game deck (including the start tile copy)
  isStart?: boolean;
}

export interface PlacedTile {
  defId: string;
  rot: Dir; // clockwise quarter-turns applied to the base definition
  x: number;
  y: number;
}

export type ActionResult = { ok: true } | { ok: false; reason: string };
