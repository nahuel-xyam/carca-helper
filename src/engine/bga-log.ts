/**
 * Parser for a BGA Carcassonne game log (the `notificationHistory` JSON).
 *
 * It extracts a neutral, ordered list of turns — the tile placed and the meeple
 * (if any) — straight from the log. BGA's representation (2nd edition) uses
 * numeric tile `type`, an `ori` 0..3, and a feature `pos` for the meeple; mapping
 * those onto our A..X engine tiles/rotations/segments is a separate layer.
 */
export interface BgaTurn {
  player: number;
  type: string; // BGA numeric tile type, e.g. "11"
  tileId: number; // unique tile instance id
  x: number;
  y: number;
  ori: number; // BGA orientation 0..3
  meeple: { pos: number; feature: string } | null; // partisan placement, if any
}

type Note = { type?: string; args?: Record<string, unknown> };

/** Accepts the raw `notificationHistory` object (or its `.data`) and returns ordered turns. */
export function parseBgaLog(raw: unknown): BgaTurn[] {
  const root = raw as { data?: { logs?: unknown[] }; logs?: unknown[] };
  const packets = (root?.data?.logs ?? root?.logs ?? []) as Array<{ data?: Note[] }>;

  // flatten all notifications in order
  const notes: Note[] = [];
  for (const p of packets) for (const n of p.data ?? []) notes.push(n);

  // meeple placements keyed by the tile id they sit on
  const partisanByTile = new Map<number, { pos: number; feature: string }>();
  for (const n of notes) {
    if (n.type !== 'playPartisan') continue;
    const a = n.args ?? {};
    partisanByTile.set(Number(a.id), {
      pos: Number(a.pos),
      feature: String((a.target ?? a.type) ?? ''),
    });
  }

  const turns: BgaTurn[] = [];
  for (const n of notes) {
    if (n.type !== 'playTile') continue;
    const a = n.args ?? {};
    const tileId = Number(a.id);
    turns.push({
      player: Number(a.player_id),
      type: String(a.type),
      tileId,
      x: Number(a.x),
      y: Number(a.y),
      ori: Number(a.ori),
      meeple: partisanByTile.get(tileId) ?? null,
    });
  }
  return turns;
}
