import type { TileDef, Segment, Dir, CitySeg, RoadSeg, FieldSeg } from './types';

// ---------------------------------------------------------------------------
// Base-game Carcassonne tile definitions (canonical 1st-edition letters A..X).
//
// Edges are listed N, E, S, W in the tile's base (unrotated) orientation.
//
// Field "nodes" are half-edges, two per side, numbered clockwise:
//   N -> 0 (left), 1 (right)
//   E -> 2 (top),  3 (bottom)
//   S -> 4 (right),5 (left)
//   W -> 6 (bottom),7 (top)
// i.e. side d (a Dir) owns nodes 2d and 2d+1, in clockwise order.
//
// Distribution (total 72): A2 B4 C1 D4 E5 F2 G1 H3 I2 J3 K3 L3 M2 N3 O2 P3
//                          Q1 R3 S2 T1 U8 V9 W4 X1
// One copy of D is the start tile.
// ---------------------------------------------------------------------------

const city = (edges: Dir[], pennant = false): CitySeg => ({ kind: 'city', edges, pennant });
const road = (edges: Dir[]): RoadSeg => ({ kind: 'road', edges });
const field = (nodes: number[]): FieldSeg => ({ kind: 'field', nodes });
const cloister: Segment = { kind: 'cloister' };

const F = 'field';
const R = 'road';
const C = 'city';

function tile(
  id: string,
  edges: [typeof F | typeof R | typeof C, typeof F | typeof R | typeof C, typeof F | typeof R | typeof C, typeof F | typeof R | typeof C],
  segments: Segment[],
  count: number,
  isStart = false,
): TileDef {
  return { id, edges: edges as TileDef['edges'], segments, count, ...(isStart ? { isStart: true } : {}) };
}

export const TILES: TileDef[] = [
  // A: cloister with a road stub from the South. Field all around (road dead-ends).
  tile('A', [F, F, R, F], [cloister, road([2]), field([0, 1, 2, 3, 4, 5, 6, 7])], 2),

  // B: cloister, no road. Field all around.
  tile('B', [F, F, F, F], [cloister, field([0, 1, 2, 3, 4, 5, 6, 7])], 4),

  // C: full city on all four edges, with pennant.
  tile('C', [C, C, C, C], [city([0, 1, 2, 3], true)], 1),

  // D: city cap on N + straight road E-W. START TILE.
  tile('D', [C, R, F, R], [city([0]), road([1, 3]), field([2, 7]), field([3, 4, 5, 6])], 4, true),

  // E: city cap on N, rest field.
  tile('E', [C, F, F, F], [city([0]), field([2, 3, 4, 5, 6, 7])], 5),

  // F: city across E-W connected, with pennant; field N and S separated.
  tile('F', [F, C, F, C], [city([1, 3], true), field([0, 1]), field([4, 5])], 2),

  // G: city across E-W connected, no pennant.
  tile('G', [F, C, F, C], [city([1, 3]), field([0, 1]), field([4, 5])], 1),

  // H: two separate city caps on E and W; field connects N-S between them.
  tile('H', [F, C, F, C], [city([1]), city([3]), field([0, 1, 4, 5])], 3),

  // I: two separate city caps on N and E; field over S-W (base orientation matches the source art).
  tile('I', [C, C, F, F], [city([0]), city([1]), field([4, 5, 6, 7])], 2),

  // J: city cap N + road bending E-S. SE inside-corner field separated.
  tile('J', [C, R, R, F], [city([0]), road([1, 2]), field([3, 4]), field([2, 5, 6, 7])], 3),

  // K: city cap N + road bending S-W. SW inside-corner field separated.
  tile('K', [C, F, R, R], [city([0]), road([2, 3]), field([5, 6]), field([2, 3, 4, 7])], 3),

  // L: city cap N + road T-junction (E,S,W). Three field regions.
  tile('L', [C, R, R, R], [city([0]), road([1]), road([2]), road([3]), field([2, 7]), field([3, 4]), field([5, 6])], 3),

  // M: city NW connected, with pennant; field SE.
  tile('M', [C, F, F, C], [city([0, 3], true), field([2, 3, 4, 5])], 2),

  // N: city NW connected, no pennant; field SE.
  tile('N', [C, F, F, C], [city([0, 3]), field([2, 3, 4, 5])], 3),

  // O: city NW connected + road E-S, with pennant.
  tile('O', [C, R, R, C], [city([0, 3], true), road([1, 2]), field([3, 4]), field([2, 5])], 2),

  // P: city NW connected + road E-S, no pennant.
  tile('P', [C, R, R, C], [city([0, 3]), road([1, 2]), field([3, 4]), field([2, 5])], 3),

  // Q: city N-E-W connected, with pennant; field S.
  tile('Q', [C, C, F, C], [city([0, 1, 3], true), field([4, 5])], 1),

  // R: city N-E-W connected, no pennant; field S.
  tile('R', [C, C, F, C], [city([0, 1, 3]), field([4, 5])], 3),

  // S: city N-E-W connected + road S, with pennant. Field split by road at S.
  tile('S', [C, C, R, C], [city([0, 1, 3], true), road([2]), field([4]), field([5])], 2),

  // T: city N-E-W connected + road S, no pennant.
  tile('T', [C, C, R, C], [city([0, 1, 3]), road([2]), field([4]), field([5])], 1),

  // U: straight road N-S. East field = N-right,E,S-right; West field = N-left,W,S-left.
  tile('U', [R, F, R, F], [road([0, 2]), field([1, 2, 3, 4]), field([0, 5, 6, 7])], 8),

  // V: road bending S-W. Inside-corner field separated.
  tile('V', [F, F, R, R], [road([2, 3]), field([5, 6]), field([0, 1, 2, 3, 4, 7])], 9),

  // W: road T-junction (E,S,W), no city. Three field regions (N region wraps top).
  tile('W', [F, R, R, R], [road([1]), road([2]), road([3]), field([0, 1, 2, 7]), field([3, 4]), field([5, 6])], 4),

  // X: four-way crossroads. Four corner fields.
  tile('X', [R, R, R, R], [road([0]), road([1]), road([2]), road([3]), field([1, 2]), field([3, 4]), field([5, 6]), field([7, 0])], 1),
];

export function sumCounts(tiles: TileDef[]): number {
  return tiles.reduce((s, t) => s + t.count, 0);
}

export const TILE_BY_ID: Record<string, TileDef> = Object.fromEntries(TILES.map((t) => [t.id, t]));

export const START_TILE_ID: string = TILES.find((t) => t.isStart)!.id;
