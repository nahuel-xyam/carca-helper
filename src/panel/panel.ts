/// <reference types="chrome"/>
import css from './panel.css';
import type { DeckStats } from '../engine/deck';

let gridEl: HTMLElement | null = null;
let totalEl: HTMLElement | null = null;
let panelEl: HTMLElement | null = null;
let isOpen = false;

function tileUrl(id: string): string {
  return chrome.runtime.getURL(`tiles/${id}.png`);
}

/** Inject panel styles and build the DOM structure. Call once on page load. */
export function createPanel(): void {
  if (document.getElementById('ctt-styles')) return; // already mounted

  const style = document.createElement('style');
  style.id = 'ctt-styles';
  style.textContent = css as string;
  document.head.appendChild(style);

  const root = document.createElement('div');
  root.className = 'ctt-root';
  root.id = 'ctt-root';

  // ── Panel card (hidden by default) ──
  panelEl = document.createElement('div');
  panelEl.className = 'ctt-panel ctt-hidden';

  const header = document.createElement('div');
  header.className = 'ctt-header';

  const headerTop = document.createElement('div');
  headerTop.className = 'ctt-header-top';

  const title = document.createElement('span');
  title.className = 'ctt-header-title';
  title.textContent = 'Tiles Remaining';

  totalEl = document.createElement('span');
  totalEl.className = 'ctt-total';
  totalEl.textContent = '72 / 72';

  headerTop.appendChild(title);
  headerTop.appendChild(totalEl);
  header.appendChild(headerTop);

  // Legend
  const legend = document.createElement('div');
  legend.className = 'ctt-legend';
  legend.innerHTML =
    '<span class="ctt-legend-item"><span class="ctt-legend-dot ctt-legend-dot--next"></span>next draw</span>' +
    '<span class="ctt-legend-item"><span class="ctt-legend-dot ctt-legend-dot--rest"></span>2p game</span>';
  header.appendChild(legend);

  panelEl.appendChild(header);

  gridEl = document.createElement('div');
  gridEl.className = 'ctt-grid';
  panelEl.appendChild(gridEl);
  root.appendChild(panelEl);

  // ── Toggle button ──
  const toggle = document.createElement('button');
  toggle.className = 'ctt-toggle';
  toggle.title = 'Carcassonne Tile Tracker — click to open/close';
  toggle.textContent = '🏰';
  toggle.addEventListener('click', () => {
    isOpen = !isOpen;
    panelEl!.classList.toggle('ctt-hidden', !isOpen);
  });
  root.appendChild(toggle);

  document.body.appendChild(root);
}

/** Re-render the tile grid with the latest stats. */
export function renderTiles({ tiles: stats, opponentDrawsNext }: DeckStats): void {
  if (!gridEl || !totalEl) return;

  const totalInDeck = stats.reduce((s, t) => s + t.inDeck, 0);
  const totalAll = stats.reduce((s, t) => s + t.total, 0);
  totalEl.textContent = `${totalInDeck} / ${totalAll} in deck`;

  // Update legend label to clarify whose "next draw" it is
  const nextLabel = panelEl!.querySelector('.ctt-legend-item:first-child');
  if (nextLabel) nextLabel.textContent = opponentDrawsNext ? 'opp. next draw' : 'your next draw';
  const nextDot = document.createElement('span');
  nextDot.className = 'ctt-legend-dot ctt-legend-dot--next';
  if (nextLabel) nextLabel.insertBefore(nextDot, nextLabel.firstChild);

  // Rebuild grid
  gridEl.innerHTML = '';
  for (const stat of stats) {
    const depleted = stat.inDeck === 0 && stat.inHand === 0;
    let cls = 'ctt-cell';
    if (depleted) cls += ' ctt-cell--depleted';
    if (stat.inHand > 0) cls += ' ctt-cell--inhand';

    const cell = document.createElement('div');
    cell.className = cls;
    cell.title =
      `Tile ${stat.id}: ${stat.inDeck} in deck` +
      (stat.inHand > 0 ? `, ${stat.inHand} in hand` : '') +
      ` / ${stat.total} total`;

    const img = document.createElement('img');
    img.className = 'ctt-img';
    img.src = tileUrl(stat.id);
    img.alt = `Tile ${stat.id}`;
    cell.appendChild(img);

    const label = document.createElement('div');
    label.className = 'ctt-label';
    label.textContent = `${stat.inDeck + stat.inHand}/${stat.total}`;
    cell.appendChild(label);

    const probs = document.createElement('div');
    probs.className = 'ctt-probs';

    const makeProb = (cls2: string, val: number) => {
      const row = document.createElement('div');
      row.className = `ctt-prob ${cls2}`;
      const dot = document.createElement('span');
      dot.className = 'ctt-prob-dot';
      const valEl = document.createElement('span');
      valEl.className = 'ctt-prob-val';
      valEl.textContent = stat.inDeck > 0 ? `${val}%` : '—';
      row.appendChild(dot);
      row.appendChild(valEl);
      return row;
    };

    probs.appendChild(makeProb('ctt-prob--next', stat.nextPct));
    probs.appendChild(makeProb('ctt-prob--rest', stat.restPct));
    cell.appendChild(probs);

    gridEl.appendChild(cell);
  }
}
