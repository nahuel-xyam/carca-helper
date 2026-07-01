/**
 * LiveScore: computes partial scores (committed + incomplete features + farms)
 * directly from the current BGA game state — no network fetch, no full replay.
 *
 * Strategy:
 *   1. Build the engine Board from gamedatas.tiles (all placed tiles).
 *   2. Build the FeatureGraph from that board.
 *   3. Read current meeple placements from the DOM (part_{tileId}_{pos} elements).
 *   4. Run scoreEndgame() on the current state → points from open features + farms.
 *   5. Add those to BGA's committed score for each player.
 */

import { TILE_MAP, K0, meepleSegment } from './bga-map-full';
import { Board } from './board';
import { FeatureGraph } from './features';
import { Meeples } from './meeples';
import { scoreEndgame } from './scoring';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyObj = Record<string, any>;

export interface PartialScoreResult {
  /** BGA player id → partial score (committed + incomplete features + farms). */
  [bgaPlayerId: string]: number;
}

/**
 * Compute partial scores for all players from the current BGA gamedatas state.
 * @param gd - gameui.gamedatas
 * @param iframeDoc - the game iframe's document (for reading meeple DOM)
 * @param playerColorMap - map of '#rrggbb' color → BGA player id string
 */
export function computePartialScores(
  gd: AnyObj,
  iframeDoc: Document,
  playerColorMap: Map<string, string>,
): PartialScoreResult {
  // 1. Build engine board from gamedatas.tiles
  const board = new Board();
  const tilesById = new Map<number, AnyObj>();

  for (const t of Object.values(gd['tiles'] ?? {}) as AnyObj[]) {
    const bgaType = String(t['type'] ?? '');
    const letter = TILE_MAP[bgaType];
    if (!letter) continue;
    const ori = parseInt(String(t['ori'] ?? '0'), 10);
    const rot = (((ori + (K0[letter] ?? 0)) % 4) + 4) % 4 as 0 | 1 | 2 | 3;
    const x = parseInt(String(t['x'] ?? '0'), 10);
    const y = parseInt(String(t['y'] ?? '0'), 10);
    board.place({ defId: letter, rot, x, y });
    tilesById.set(parseInt(String(t['id']), 10), { ...t, letter, rot });
  }

  // 2. Build feature graph
  const graph = new FeatureGraph(board);

  // 3. Map player colors → engine player index
  const colorToEngineIdx = new Map<string, number>();
  const playerIdToEngineIdx = new Map<string, number>();
  let idx = 0;
  for (const [color, bgaId] of playerColorMap) {
    colorToEngineIdx.set(color.toLowerCase(), idx);
    playerIdToEngineIdx.set(bgaId, idx);
    idx++;
  }
  const numPlayers = idx;
  const engineIdxToBgaId = new Map<number, string>();
  for (const [bgaId, ei] of playerIdToEngineIdx) engineIdxToBgaId.set(ei, bgaId);

  const meeples = new Meeples(Array.from({ length: numPlayers }, (_, i) => i));

  // 4. Read meeple placements from DOM: id="part_{tileId}_{pos}"
  const meepleEls = iframeDoc.querySelectorAll<HTMLElement>('[id^="part_"]');
  for (const el of meepleEls) {
    const parts = el.id.split('_');
    if (parts.length < 3) continue;
    const tileId = parseInt(parts[1], 10);
    const pos = parseInt(parts[2], 10);

    // Resolve player from color class e.g. "partisan_008000"
    const colorClass = Array.from(el.classList).find((c) => /^partisan_[0-9a-f]{6}$/.test(c));
    if (!colorClass) continue;
    const color = '#' + colorClass.replace('partisan_', '');
    const enginePlayer = colorToEngineIdx.get(color.toLowerCase());
    if (enginePlayer === undefined) continue;

    // Resolve tile → engine letter + rotation
    const tile = tilesById.get(tileId);
    if (!tile) continue;
    const letter: string = tile['letter'];
    const rot: number = tile['rot'];

    // Use meepleSegment with a dummy feature guess — try all feature kinds
    // meepleSegment from bga-map-full uses FEATURE_ORDER[letter][pos-1]
    const segIndex = meepleSegment(letter, 'city', pos);
    if (segIndex < 0) continue;

    const x = parseInt(String(tile['x']), 10);
    const y = parseInt(String(tile['y']), 10);

    // Adjust segment index for rotation: the FEATURE_ORDER gives the
    // segment index in the unrotated tile definition, which is rotation-invariant
    // (segments don't change index on rotation, only their edge/node values do).
    try {
      meeples.place(x, y, segIndex, enginePlayer);
    } catch { /* ignore duplicate placements */ }
  }

  // 5. scoreEndgame → points from open features + farms
  const endgamePoints = scoreEndgame(graph, meeples);

  // 6. Build result: endgame points keyed by BGA player id
  const result: PartialScoreResult = {};
  for (const [ei, bgaId] of engineIdxToBgaId) {
    result[bgaId] = endgamePoints.get(ei) ?? 0;
  }
  return result;
}
