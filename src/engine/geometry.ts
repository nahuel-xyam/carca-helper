import type { Dir, EdgeKind, Segment, TileDef } from './types';

/** Rotate a direction clockwise by `rot` quarter-turns. */
export function rotateDir(d: Dir, rot: number): Dir {
  return (((d + rot) % 4) + 4) % 4 as Dir;
}

/**
 * Rotate a field half-edge node clockwise by `rot` quarter-turns.
 * Each quarter-turn moves a node from side d to side d+1 keeping its half (+2 mod 8).
 */
export function rotateFieldNode(n: number, rot: number): number {
  return (((n + 2 * rot) % 8) + 8) % 8;
}

/** Edges of a tile after rotating it clockwise by `rot`. new[d] = base[d - rot]. */
export function rotatedEdges(def: TileDef, rot: Dir): [EdgeKind, EdgeKind, EdgeKind, EdgeKind] {
  const r = ((rot % 4) + 4) % 4;
  const out = [0, 0, 0, 0].map((_, d) => def.edges[(((d - r) % 4) + 4) % 4]);
  return out as [EdgeKind, EdgeKind, EdgeKind, EdgeKind];
}

/** Segments of a tile after rotating it clockwise by `rot` (city/road edges and field nodes shifted). */
export function rotatedSegments(def: TileDef, rot: Dir): Segment[] {
  const r = (((rot % 4) + 4) % 4) as Dir;
  return def.segments.map((s): Segment => {
    switch (s.kind) {
      case 'city':
        return { kind: 'city', edges: s.edges.map((e) => rotateDir(e, r)), pennant: s.pennant };
      case 'road':
        return { kind: 'road', edges: s.edges.map((e) => rotateDir(e, r)) };
      case 'field':
        return { kind: 'field', nodes: s.nodes.map((n) => rotateFieldNode(n, r)) };
      case 'cloister':
        return { kind: 'cloister' };
    }
  });
}
