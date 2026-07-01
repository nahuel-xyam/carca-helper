import { Game } from './game';
import { TILE_BY_ID } from './tiles-full';

export interface ReplayMove {
  defId: string;
  x: number;
  y: number;
  rot: 0 | 1 | 2 | 3;
  meeple?: number;
  meepleKind?: string;
  player?: number;
}

export class Replay {
  readonly game: Game;
  private idx = 0;

  constructor(private moves: ReplayMove[], private numPlayers = 2) {
    this.game = new Game();
    this.game.newGame(numPlayers);
  }

  get index(): number { return this.idx; }
  get length(): number { return this.moves.length; }
  get atEnd(): boolean { return this.idx >= this.moves.length; }

  reset(): void {
    this.game.newGame(this.numPlayers);
    this.idx = 0;
  }

  stepForward(): boolean {
    if (this.atEnd) return false;
    this.applyMove(this.moves[this.idx]);
    this.idx += 1;
    return true;
  }

  /** Replay all moves up to (but not including) index n from scratch. */
  stepTo(n: number): void {
    const target = Math.max(0, Math.min(this.moves.length, n));
    this.reset();
    for (let i = 0; i < target; i++) this.stepForward();
  }

  private applyMove(m: ReplayMove): void {
    if (!this.game.drawSpecific(m.defId).ok) return;
    let guard = 0;
    while (this.game.currentTile && this.game.currentTile.rot !== m.rot && guard++ < 4) {
      this.game.rotate();
    }
    if (!this.game.placeTile(m.x, m.y).ok) return;
    if (m.meeple != null) {
      this.placeMeepleResilient(m);
    } else {
      this.game.skipMeeple();
    }
    this.game.confirmTurn();
  }

  private placeMeepleResilient(m: ReplayMove): void {
    if (this.game.placeMeeple(m.meeple!).ok) return;
    const def = m.meepleKind ? TILE_BY_ID[m.defId] : undefined;
    if (def) {
      for (let i = 0; i < def.segments.length; i++) {
        if (i === m.meeple) continue;
        if (def.segments[i].kind !== m.meepleKind) continue;
        if (this.game.placeMeeple(i).ok) return;
      }
    }
    this.game.skipMeeple();
  }
}
