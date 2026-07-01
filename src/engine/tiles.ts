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
  { id: 'A', count: 2 },  // Cloister + road to the south
  { id: 'B', count: 4 },  // Cloister, no road (plain field)
  { id: 'C', count: 1 },  // Full city all four sides (pennant)
  { id: 'D', count: 4 },  // City cap north + straight road E-W  ← start tile
  { id: 'E', count: 5 },  // City cap north, rest field
  { id: 'F', count: 2 },  // City tunnel E-W (pennant), fields N & S
  { id: 'G', count: 1 },  // City tunnel E-W, no pennant
  { id: 'H', count: 3 },  // Two separate city caps E + W
  { id: 'I', count: 2 },  // Two separate city caps N + E
  { id: 'J', count: 3 },  // City cap north + road bend E-S
  { id: 'K', count: 3 },  // City cap north + road bend S-W
  { id: 'L', count: 3 },  // City cap north + road T-junction E/S/W
  { id: 'U', count: 8 },  // Straight road N-S, no city
  { id: 'V', count: 9 },  // Road bend S-W, no city
  { id: 'W', count: 4 },  // Road T-junction E/S/W, no city
  { id: 'X', count: 1 },  // Four-way crossroads, no city
  { id: 'Q', count: 1 },  // City N+E+W (pennant), field south
  { id: 'R', count: 3 },  // City N+E+W, no pennant, field south
  { id: 'S', count: 2 },  // City N+E+W (pennant) + road south
  { id: 'T', count: 1 },  // City N+E+W, no pennant + road south
  { id: 'M', count: 2 },  // City diagonal N+W (pennant)
  { id: 'N', count: 3 },  // City diagonal N+W, no pennant
  { id: 'O', count: 2 },  // City diagonal N+W (pennant) + road bend E-S
  { id: 'P', count: 3 },  // City diagonal N+W, no pennant + road bend E-S
];

export const TILE_BY_ID: Record<string, TileDef> = Object.fromEntries(
  TILES.map((t) => [t.id, t]),
);
