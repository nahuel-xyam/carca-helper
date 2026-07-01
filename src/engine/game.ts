import type { ActionResult, Dir, PlacedTile } from './types';
import { Board, Pos } from './board';
import { FeatureGraph } from './features';
import { Meeples } from './meeples';
import { TILE_BY_ID, START_TILE_ID } from './tiles-full';
import { cityPoints, roadPoints, cloisterPoints, awardMajority, scoreEndgame } from './scoring';

export type Phase = 'draw' | 'place' | 'meeple' | 'confirm';

/**
 * Stripped-down Game class for the tile-tracker extension.
 * AI methods (clone, snapshot, legalMoves, applyMove, etc.) are removed.
 * Used only for replay + partial score calculation.
 */
export class Game {
  board!: Board;
  meeples!: Meeples;
  graph!: FeatureGraph;
  currentTile: { defId: string; rot: Dir } | null = null;
  lastPlaced: Pos | null = null;
  phase: Phase = 'draw';
  players: number[] = [0];
  private current = 0;
  private tentative: PlacedTile | null = null;
  private pendingMeeple: { x: number; y: number; i: number; player: number } | null = null;
  discarded: string[] = [];
  private scores = new Map<number, number>();

  constructor() {
    this.newGame();
  }

  newGame(numPlayers = 2, startPlayer = 0): void {
    this.players = Array.from({ length: Math.max(1, numPlayers) }, (_, i) => i);
    this.current = ((startPlayer % this.players.length) + this.players.length) % this.players.length;
    this.board = new Board();
    this.meeples = new Meeples(this.players);
    this.board.place({ defId: START_TILE_ID, rot: 0, x: 0, y: 0 });
    this.graph = new FeatureGraph(this.board);
    this.currentTile = null;
    this.lastPlaced = null;
    this.tentative = null;
    this.pendingMeeple = null;
    this.phase = 'draw';
    this.discarded = [];
    this.scores = new Map(this.players.map((p) => [p, 0]));
  }

  activePlayer(): number {
    return this.players[this.current];
  }

  /** Draw a specific tile by defId (used by replay). */
  drawSpecific(defId: string): ActionResult {
    if (this.phase !== 'draw') return { ok: false, reason: 'not in draw phase' };
    if (!TILE_BY_ID[defId]) return { ok: false, reason: `unknown tile ${defId}` };
    this.currentTile = { defId, rot: 0 };
    this.phase = 'place';
    return { ok: true };
  }

  rotate(): void {
    if (!this.currentTile) return;
    if (this.phase === 'meeple' && this.tentative) {
      const t = this.tentative;
      const rots = this.fittingRotations(t.x, t.y);
      if (rots.length <= 1) return;
      const next = rots[(rots.indexOf(t.rot) + 1) % rots.length];
      this.board.remove(t.x, t.y);
      this.board.place({ defId: t.defId, rot: next, x: t.x, y: t.y });
      this.tentative = { defId: t.defId, rot: next, x: t.x, y: t.y };
      this.currentTile.rot = next;
      this.graph = new FeatureGraph(this.board);
    } else if (this.phase === 'place') {
      this.currentTile.rot = ((this.currentTile.rot + 1) % 4) as Dir;
    }
  }

  placeTile(x: number, y: number): ActionResult {
    if ((this.phase !== 'place' && this.phase !== 'meeple') || !this.currentTile) {
      return { ok: false, reason: 'no tile to place' };
    }
    const prev = this.tentative;
    if (prev) this.board.remove(prev.x, prev.y);
    this.tentative = null;
    const rots = this.fittingRotations(x, y);
    if (rots.length === 0) {
      if (prev) { this.board.place(prev); this.tentative = prev; }
      return { ok: false, reason: 'tile does not fit here' };
    }
    const rot = rots.includes(this.currentTile.rot) ? this.currentTile.rot : rots[0];
    this.board.place({ defId: this.currentTile.defId, rot, x, y });
    this.tentative = { defId: this.currentTile.defId, rot, x, y };
    this.currentTile.rot = rot;
    this.lastPlaced = { x, y };
    this.graph = new FeatureGraph(this.board);
    this.phase = 'meeple';
    return { ok: true };
  }

  private fittingRotations(x: number, y: number): Dir[] {
    const id = this.currentTile!.defId;
    const t = this.tentative;
    if (t) this.board.remove(t.x, t.y);
    const rots: Dir[] = [];
    for (let r = 0 as Dir; r < 4; r = (r + 1) as Dir) {
      if (this.board.canPlace({ defId: id, rot: r, x, y }).ok) rots.push(r);
    }
    if (t) this.board.place(t);
    return rots;
  }

  placeMeeple(segIndex: number): ActionResult {
    if (this.phase !== 'meeple' || !this.lastPlaced) return { ok: false, reason: 'not in meeple phase' };
    const { x, y } = this.lastPlaced;
    const player = this.activePlayer();
    const r = this.meeples.canPlace(this.graph, x, y, segIndex, player);
    if (!r.ok) return r;
    this.meeples.place(x, y, segIndex, player);
    this.pendingMeeple = { x, y, i: segIndex, player };
    this.phase = 'confirm';
    return { ok: true };
  }

  skipMeeple(): void {
    if (this.phase === 'meeple') {
      this.pendingMeeple = null;
      this.phase = 'confirm';
    }
  }

  confirmTurn(): void {
    if (this.phase === 'confirm') this.resolveTurn();
  }

  private resolveTurn(): void {
    const g = this.graph;
    for (const comp of g.list()) {
      if ((comp.kind === 'city' || comp.kind === 'road') && comp.complete) {
        const counts = this.meeples.meeplesOnComponent(comp);
        if (counts.size === 0) continue;
        const pts = comp.kind === 'city' ? cityPoints(comp, true) : roadPoints(comp);
        const awards = awardMajority(counts, pts);
        for (const [p, pp] of awards) this.addScore(p, pp);
        this.meeples.returnComponent(comp);
      }
    }
    for (const cl of g.cloisters) {
      if (!cl.complete) continue;
      const owner = this.meeples.on(cl.x, cl.y, cl.i);
      if (owner !== undefined) {
        this.addScore(owner, cloisterPoints(cl.present));
        this.meeples.returnSegment(cl.x, cl.y, cl.i);
      }
    }
    this.tentative = null;
    this.pendingMeeple = null;
    this.currentTile = null;
    this.lastPlaced = null;
    this.phase = 'draw';
    this.current = (this.current + 1) % this.players.length;
  }

  private addScore(player: number, pts: number): void {
    this.scores.set(player, (this.scores.get(player) ?? 0) + pts);
  }

  score(player: number): number {
    return this.scores.get(player) ?? 0;
  }

  /** Committed score + partial score for all incomplete features + farms. */
  partialScore(player: number): number {
    const partial = scoreEndgame(this.graph, this.meeples).get(player) ?? 0;
    return this.score(player) + partial;
  }
}
