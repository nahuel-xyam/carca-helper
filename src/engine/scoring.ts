import { Component, FeatureGraph } from './features';
import { Meeples } from './meeples';

/** City points: 2/tile + 2/pennant when complete; 1/tile + 1/pennant at game end. */
export function cityPoints(comp: Component, complete: boolean): number {
  const mult = complete ? 2 : 1;
  return mult * comp.tiles.size + mult * comp.pennants;
}

/** Road points: 1 per tile (same whether completed during play or scored at game end). */
export function roadPoints(comp: Component): number {
  return comp.tiles.size;
}

/** Cloister points: 1 for the tile + 1 per surrounding tile present (9 when complete). */
export function cloisterPoints(present: number): number {
  return 1 + present;
}

/** Field points: 3 per *completed* city the field borders. */
export function fieldPoints(comp: Component, graph: FeatureGraph): number {
  let n = 0;
  for (const cid of comp.borderCities) {
    if (graph.components.get(cid)?.complete) n += 1;
  }
  return 3 * n;
}

/**
 * Award `points` to the player(s) with the most meeples on a feature.
 * Ties award full points to each tied player. Returns per-player awards.
 */
export function awardMajority(counts: Map<number, number>, points: number): Map<number, number> {
  const res = new Map<number, number>();
  if (counts.size === 0 || points === 0) return res;
  const max = Math.max(...counts.values());
  for (const [player, c] of counts) if (c === max) res.set(player, points);
  return res;
}

function addInto(acc: Map<number, number>, awards: Map<number, number>): void {
  for (const [p, pts] of awards) acc.set(p, (acc.get(p) ?? 0) + pts);
}

/**
 * End-game scoring: incomplete cities/roads, incomplete cloisters, and all fields,
 * each awarded to the majority meeple holder(s). Returns per-player totals.
 */
export function scoreEndgame(graph: FeatureGraph, meeples: Meeples): Map<number, number> {
  const totals = new Map<number, number>();

  for (const comp of graph.list()) {
    const counts = meeples.meeplesOnComponent(comp);
    if (counts.size === 0) continue;
    let pts = 0;
    if (comp.kind === 'city') pts = cityPoints(comp, comp.complete);
    else if (comp.kind === 'road') pts = roadPoints(comp);
    else if (comp.kind === 'field') pts = fieldPoints(comp, graph);
    addInto(totals, awardMajority(counts, pts));
  }

  for (const cl of graph.cloisters) {
    const owner = meeples.on(cl.x, cl.y, cl.i);
    if (owner === undefined) continue;
    totals.set(owner, (totals.get(owner) ?? 0) + cloisterPoints(cl.present));
  }

  return totals;
}
