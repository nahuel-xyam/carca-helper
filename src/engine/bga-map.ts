/**
 * Maps BGA's numeric tile type (2nd edition) to the canonical engine letter A–X.
 * Verified against finished BGA games (see bga-extension/src/engine/bga-map.ts).
 */
export const TILE_MAP: Record<string, string> = {
  '1': 'T', '2': 'S',  '3': 'N',  '4': 'M',  '5': 'P',  '6': 'O',
  '7': 'G', '8': 'F',  '9': 'I',  '10': 'H', '11': 'E', '12': 'K',
  '13': 'J', '14': 'L', '15': 'D', '16': 'U', '17': 'V', '18': 'W',
  '19': 'X', '20': 'B', '21': 'A', '22': 'C', '23': 'R', '24': 'Q',
};
