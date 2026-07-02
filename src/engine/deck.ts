import { TILES } from './tiles';
import { TILE_MAP } from './bga-map';

export interface TileStat {
  id: string;
  /** Copies remaining in deck (excludes hand and placed). */
  inDeck: number;
  /** Copies currently in hand (0 or more). */
  inHand: number;
  /** Initial total count for this tile type. */
  total: number;
  /**
   * Probability (0–100) that the very next tile drawn from the deck
   * is this type. When opponentDrawsNext=true this is the opponent's draw.
   */
  nextPct: number;
  /**
   * Probability (0–100) that YOU draw at least one copy before the game ends
   * in a 2-player game.
   */
  restPct: number;
}

export interface PlayerInfo {
  id: string;
  name: string;
  color: string;
  score: number;
  /** Committed + incomplete features + farms (from local engine replay). */
  partialScore: number;
  isActive: boolean;
}

export interface DeckStats {
  tiles: TileStat[];
  /** True when the current player holds a tile and the opponent draws next. */
  opponentDrawsNext: boolean;
  players: PlayerInfo[];
}

// ── Probability helpers ───────────────────────────────────────────────────────

/**
 * P(you draw ≥1 copy of a tile type over the rest of a 2-player game).
 *
 * The opponent draws `opponentDraws` tiles; you draw the rest.
 * P(you get none) = P(all k copies land in the opponent's m draws)
 *                 = ∏_{i=0}^{k-1} (m−i)/(N−i)
 *
 * This is exact and avoids floating-point issues with log/exp.
 */
function probAtLeastOne(N: number, k: number, opponentDraws: number): number {
  if (k <= 0 || N <= 0) return 0;
  if (k > opponentDraws) return 1; // opponent can't absorb all copies → you must get one
  let pNone = 1;
  for (let i = 0; i < k; i++) pNone *= (opponentDraws - i) / (N - i);
  return Math.max(0, Math.min(1, 1 - pNone));
}

// ── Deck class ────────────────────────────────────────────────────────────────

export class Deck {
  /** Tiles remaining in the draw pile (excludes hand and placed tiles). */
  private deckCounts = new Map<string, number>();
  /** Tiles currently in the current player's hand. */
  private handCounts = new Map<string, number>();
  private readonly totals = new Map<string, number>();
  /**
   * Authoritative draw-pile size from BGA (excludes all hands).
   * Used as N for probability calculations so the opponent's hidden
   * hand tile doesn't inflate our estimates.
   */
  private bgaDeckSize = 0;
  private _players: PlayerInfo[] = [];

  constructor() {
    for (const t of TILES) {
      this.deckCounts.set(t.id, t.count);
      this.handCounts.set(t.id, 0);
      this.totals.set(t.id, t.count);
    }
  }

  /**
   * Delta update: remove one tile of a given BGA numeric type from the deck.
   * Used for live tile placements when gamedatas is stale.
   */
  place(bgaType: string): void {
    const letter = TILE_MAP[bgaType];
    if (!letter) return;
    const cur = this.deckCounts.get(letter) ?? 0;
    if (cur > 0) this.deckCounts.set(letter, cur - 1);
    if (this.bgaDeckSize > 0) this.bgaDeckSize = Math.max(0, this.bgaDeckSize - 1);
  }

  /**
   * Full state update from BGA gamedatas.
   * @param placedTypes BGA numeric type strings for every tile on the board
   *   (including the pre-placed start tile).
   * @param handTypes BGA numeric type strings for every tile in the current
   *   player's hand (usually 0 or 1 in Carcassonne).
   */
  setState(placedTypes: string[], handTypes: string[], deckSize = 0, players: PlayerInfo[] = []): void {
    this.bgaDeckSize = deckSize;
    this._players = players;
    // Reset to full counts
    for (const t of TILES) {
      this.deckCounts.set(t.id, t.count);
      this.handCounts.set(t.id, 0);
    }
    // Deduct placed tiles
    for (const bgaType of placedTypes) {
      const letter = TILE_MAP[bgaType];
      if (!letter) continue;
      const cur = this.deckCounts.get(letter) ?? 0;
      this.deckCounts.set(letter, Math.max(0, cur - 1));
    }
    // Deduct and record hand tiles
    for (const bgaType of handTypes) {
      const letter = TILE_MAP[bgaType];
      if (!letter) continue;
      const cur = this.deckCounts.get(letter) ?? 0;
      this.deckCounts.set(letter, Math.max(0, cur - 1));
      this.handCounts.set(letter, (this.handCounts.get(letter) ?? 0) + 1);
    }
  }

  get totalInDeck(): number {
    // Prefer BGA's authoritative value; fall back to our computed sum.
    if (this.bgaDeckSize > 0) return this.bgaDeckSize;
    let sum = 0;
    for (const v of this.deckCounts.values()) sum += v;
    return sum;
  }

  get totalLeft(): number {
    let sum = 0;
    for (const [id, v] of this.deckCounts) {
      sum += v + (this.handCounts.get(id) ?? 0);
    }
    return sum;
  }

  stats(): DeckStats {
    // N = bgaDeckSize = tiles confirmed in the draw pile (authoritative from BGA).
    // Used for restPct (how many tiles you can actually draw over the game).
    const N = this.totalInDeck;

    const opponentDrawsNext = [...this.handCounts.values()].some((v) => v > 0);
    const opponentDraws = opponentDrawsNext ? Math.ceil(N / 2) : Math.floor(N / 2);
    const tiles = TILES.map((t) => {
      const inDeck = this.deckCounts.get(t.id) ?? 0;
      const inHand = this.handCounts.get(t.id) ?? 0;
      // restPct: probability you draw ≥1 of this type before the game ends.
      const restPct = N > 0 ? Math.round(probAtLeastOne(N, inDeck, opponentDraws) * 100) : 0;
      // nextPct: probability the next draw FROM THE PILE is this type.
      // Only meaningful if you can actually draw it (restPct > 0).
      // When restPct=0 the tile is effectively out of reach (opponent will take it),
      // so showing a non-zero next-draw % would be misleading — clamp to 0.
      const nextPct = restPct > 0 && N > 0 ? Math.round((inDeck / N) * 100) : 0;
      return {
        id: t.id,
        inDeck,
        inHand,
        total: this.totals.get(t.id) ?? t.count,
        nextPct,
        restPct,
      };
    });
    return { tiles, opponentDrawsNext, players: this._players };
  }

  /**
   * P(you draw ≥1 of tile A AND ≥1 of tile B before the game ends) in a 2p game.
   * Uses inclusion-exclusion: P(A∩B) = 1 − P(no A) − P(no B) + P(no A∪B).
   */
  combinedProb(idA: string, idB: string): number {
    const N = this.totalInDeck;
    if (N === 0) return 0;
    const opponentDrawsNext = [...this.handCounts.values()].some((v) => v > 0);
    const m = opponentDrawsNext ? Math.ceil(N / 2) : Math.floor(N / 2);

    const kA = this.deckCounts.get(idA) ?? 0;
    const kB = this.deckCounts.get(idB) ?? 0;
    // For same tile type, union = kA. For different types, no overlap so union = kA + kB.
    const kUnion = idA === idB ? kA : kA + kB;

    // P(opponent absorbs all k copies) = ∏_{i=0}^{k-1} (m-i)/(N-i)
    const pNone = (k: number): number => {
      if (k <= 0) return 1;
      if (k > m) return 0;
      let p = 1;
      for (let i = 0; i < k; i++) p *= (m - i) / (N - i);
      return p;
    };

    const pBoth = 1 - pNone(kA) - pNone(kB) + pNone(kUnion);
    return Math.round(Math.max(0, Math.min(1, pBoth)) * 100);
  }

  reset(): void {
    this.bgaDeckSize = 0;
    for (const t of TILES) {
      this.deckCounts.set(t.id, t.count);
      this.handCounts.set(t.id, 0);
    }
  }
}
