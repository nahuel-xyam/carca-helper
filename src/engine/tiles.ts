/** Minimal tile definition for the tracker (id + deck count only). */
export interface TileDef {
  id: string;
  count: number;
}

/**
 * Base-game Carcassonne tile set (A–X, 72 tiles total).
 * Distribution: A2 B4 C1 D4 E5 F2 G1 H3 I2 J3 K3 L3 M2 N3 O2 P3 Q1 R3 S2 T1 U8 V9 W4 X1
 */
export const TILES: TileDef[] = [
  { id: 'A', count: 2 },
  { id: 'B', count: 4 },
  { id: 'C', count: 1 },
  { id: 'D', count: 4 },
  { id: 'E', count: 5 },
  { id: 'F', count: 2 },
  { id: 'G', count: 1 },
  { id: 'H', count: 3 },
  { id: 'I', count: 2 },
  { id: 'J', count: 3 },
  { id: 'K', count: 3 },
  { id: 'L', count: 3 },
  { id: 'M', count: 2 },
  { id: 'N', count: 3 },
  { id: 'O', count: 2 },
  { id: 'P', count: 3 },
  { id: 'Q', count: 1 },
  { id: 'R', count: 3 },
  { id: 'S', count: 2 },
  { id: 'T', count: 1 },
  { id: 'U', count: 8 },
  { id: 'V', count: 9 },
  { id: 'W', count: 4 },
  { id: 'X', count: 1 },
];

export const TILE_BY_ID: Record<string, TileDef> = Object.fromEntries(
  TILES.map((t) => [t.id, t]),
);
