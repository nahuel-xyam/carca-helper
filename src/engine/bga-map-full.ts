/**
 * Mapping layer: BGA (2nd-edition) Carcassonne log representation -> our A..X engine.
 *
 * Derived (and proven, see tests) from three finished BGA games:
 *  - BGA numeric tile `type` -> engine tile letter (TILE_MAP), a bijection over A..X.
 *  - per-tile rotation offset K0 such that  engineRot = (ori + K0[letter]) % 4
 *    reproduces the exact world orientation BGA placed the tile in. Verified by
 *    replaying every placement of all games with ZERO edge mismatches against the
 *    pre-placed start tile (engine D at rot 0 = [city,road,field,road]).
 *  - meeple `pos` -> engine segment index, via a per-tile ordered feature list
 *    (FEATURE_ORDER). With this, replaying both sample games reproduces BGA's
 *    scores EXACTLY at every turn AND at the end (incomplete features + farms).
 *
 * BGA omits the start tile from the log (it is pre-placed at 0,0); our engine
 * places it via newGame, so the converter only emits the drawn turns.
 */
import { TILE_BY_ID } from './tiles-full';
import type { ReplayMove } from './replay';
import type { BgaTurn } from './bga-log';

/** BGA numeric tile type -> engine tile letter. */
export const TILE_MAP: Record<string, string> = {
  '1': 'T', '2': 'S', '3': 'N', '4': 'M', '5': 'P', '6': 'O', '7': 'G', '8': 'F',
  '9': 'I', '10': 'H', '11': 'E', '12': 'K', '13': 'J', '14': 'L', '15': 'D',
  '16': 'U', '17': 'V', '18': 'W', '19': 'X', '20': 'B', '21': 'A', '22': 'C',
  '23': 'R', '24': 'Q',
};

/** Rotation offset per engine letter:  engineRot = (bgaOri + K0[letter]) % 4. */
export const K0: Record<string, number> = {
  A: 3, B: 0, C: 0, D: 3, E: 3, F: 1, G: 1, H: 0, I: 2, J: 3, K: 3, L: 3,
  M: 3, N: 3, O: 3, P: 3, Q: 3, R: 3, S: 3, T: 3, U: 1, V: 3, W: 3, X: 0,
};

/** BGA meeple `target` -> engine segment kind. */
function targetKind(target: string): string {
  if (target === 'abbey') return 'cloister';
  return target; // 'city' | 'road' | 'field'
}

/**
 * BGA's meeple `pos` is a 1-based index into a tile's ordered feature list. The
 * ordering, recovered from the sample games, is: cloister, then roads, then cities,
 * then fields. Within roads/cities the side sub-order is tile-specific (taken from
 * `realizationAchieved.partisans` ground truth); fields follow in segment-index order.
 *
 * FEATURE_ORDER[letter] lists engine segment indices in that pos order, so the
 * segment for a meeple is simply FEATURE_ORDER[letter][pos - 1]. Single-feature
 * kinds fall out of this for free; the only hand-set bits are the multi-road/-city
 * sub-orders on H, I, L, W, X.
 */
const FEATURE_ORDER: Record<string, number[]> = {
  A: [0, 1, 2], //   cloister, road, field
  B: [0, 1], //      cloister, field
  C: [0], //         city
  D: [1, 0, 2, 3], // road, city, field, field
  E: [0, 1], //      city, field
  F: [0, 1, 2], //   city, field, field
  G: [0, 1, 2], //   city, field, field
  H: [1, 0, 2], //   city(W=seg1), city(E=seg0), field
  I: [1, 0, 2], //   city(E=seg1), city(N=seg0), field
  J: [1, 0, 2, 3], // road, city, field, field
  K: [1, 0, 3, 2], // road, city, field(big=seg3), field(corner=seg2)
  L: [3, 1, 2, 0, 4, 5, 6], // roads W,E,S; city; fields
  M: [0, 1], //      city, field
  N: [0, 1], //      city, field
  O: [1, 0, 2, 3], // road, city, field, field
  P: [1, 0, 2, 3], // road, city, field, field
  Q: [0, 1], //      city, field
  R: [0, 1], //      city, field
  S: [1, 0, 2, 3], // road, city, field, field
  T: [1, 0, 2, 3], // road, city, field, field
  U: [0, 2, 1], //   road, field(W=seg2), field(E=seg1)
  V: [0, 2, 1], //   road, field(big=seg2), field(corner=seg1)
  W: [2, 0, 1, 3, 4, 5], // roads W,E,S; fields
  X: [2, 3, 1, 0, 4, 5, 6, 7], // roads S,W,E,N (pos1->seg2, pos3->seg1 per ground truth); fields
};

/**
 * Resolve a meeple's engine segment index from BGA's (target, pos).
 *
 * `pos` indexes the tile's ordered feature list (see FEATURE_ORDER); `target` is
 * used only as a sanity check / fallback so a malformed pos still lands on a segment
 * of the right kind.
 */
export function meepleSegment(letter: string, target: string, pos: number): number {
  const def = TILE_BY_ID[letter];
  if (!def) return -1;
  const kind = targetKind(target);
  const order = FEATURE_ORDER[letter];
  if (order) {
    const seg = order[pos - 1];
    if (seg != null && def.segments[seg]?.kind === kind) return seg;
  }
  // fallback: first segment of the target kind
  const idx = def.segments.findIndex((s) => s.kind === kind);
  return idx;
}

/** Convert one parsed BGA turn into an engine ReplayMove. */
export function turnToMove(turn: BgaTurn): ReplayMove {
  const letter = TILE_MAP[turn.type];
  const rot = (((turn.ori + (K0[letter] ?? 0)) % 4) + 4) % 4;
  const move: ReplayMove = { defId: letter, x: turn.x, y: turn.y, rot: rot as ReplayMove['rot'], player: turn.player };
  if (turn.meeple) {
    const seg = meepleSegment(letter, turn.meeple.feature, turn.meeple.pos);
    if (seg >= 0) {
      move.meeple = seg;
      move.meepleKind = turn.meeple.feature === 'abbey' ? 'cloister' : turn.meeple.feature;
    }
  }
  return move;
}

/** Convert a full parsed BGA log (ordered turns) into engine ReplayMoves. */
export function turnsToMoves(turns: BgaTurn[]): ReplayMove[] {
  return turns.map(turnToMove);
}
