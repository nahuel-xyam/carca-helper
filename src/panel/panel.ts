/// <reference types="chrome"/>
import css from './panel.css';
import type { DeckStats } from '../engine/deck';

let gridEl: HTMLElement | null = null;
let totalEl: HTMLElement | null = null;
let panelEl: HTMLElement | null = null;
let combinedEl: HTMLElement | null = null;
let isOpen = false;

const selectedIds = new Set<string>();
let getCombinedProbFn: ((a: string, b: string) => number) | null = null;

function refreshSelectionClasses(): void {
  gridEl?.querySelectorAll<HTMLElement>('.ctt-cell').forEach((el) => {
    el.classList.toggle('ctt-cell--selected', selectedIds.has(el.dataset['tileId'] ?? ''));
  });
}

function updateCombined(): void {
  if (!combinedEl || !getCombinedProbFn) return;
  if (selectedIds.size === 2) {
    const [a, b] = [...selectedIds];
    const pct = getCombinedProbFn(a, b);
    combinedEl.innerHTML =
      `<span class="ctt-combined-dot"></span>` +
      `Combined chance to draw both: <strong>${pct}%</strong>`;
    combinedEl.classList.remove('ctt-hidden');
  } else {
    combinedEl.classList.add('ctt-hidden');
  }
}

function tileUrl(id: string): string {
  return chrome.runtime.getURL(`tiles/${id}.png`);
}

/** Inject panel styles and build the DOM structure. Call once on page load. */
export function createPanel(getCombinedProb: (a: string, b: string) => number): void {
  getCombinedProbFn = getCombinedProb;
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

  // Scores row (populated by renderTiles)
  const scoresRow = document.createElement('div');
  scoresRow.className = 'ctt-scores';
  scoresRow.id = 'ctt-scores';
  header.appendChild(scoresRow);

  // Legend
  const legend = document.createElement('div');
  legend.className = 'ctt-legend';
  legend.innerHTML =
    '<span class="ctt-legend-item"><span class="ctt-legend-dot ctt-legend-dot--next"></span>next draw</span>' +
    '<span class="ctt-legend-item"><span class="ctt-legend-dot ctt-legend-dot--rest"></span>2p game</span>';
  header.appendChild(legend);

  // Combined probability bar (hidden until 2 tiles are selected)
  combinedEl = document.createElement('div');
  combinedEl.className = 'ctt-combined ctt-hidden';
  header.appendChild(combinedEl);

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
export function renderTiles({ tiles: stats, opponentDrawsNext, players }: DeckStats): void {
  if (!gridEl || !totalEl) return;

  const totalInDeck = stats.reduce((s, t) => s + t.inDeck, 0);
  const totalAll = stats.reduce((s, t) => s + t.total, 0);
  totalEl.textContent = `${totalInDeck} / ${totalAll} in deck`;

  // Render player scores
  const scoresRow = document.getElementById('ctt-scores');
  if (scoresRow && players.length > 0) {
    scoresRow.innerHTML = players
      .map((p) => {
        const dot = `<span class="ctt-score-dot" style="background:#${p.color.replace(/^#/,'')}"></span>`;
        const active = p.isActive ? ' ctt-score--active' : '';
        const partial = p.partialScore > p.score
          ? `<span class="ctt-score-partial">(${p.partialScore})</span>`
          : '';
        return `<span class="ctt-score-player${active}">${dot}<span class="ctt-score-name">${p.name}</span><span class="ctt-score-val">${p.score}${partial}</span></span>`;
      })
      .join('<span class="ctt-score-sep">vs</span>');
  }

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

    // Click to select/deselect for combined probability
    cell.dataset['tileId'] = stat.id;
    if (selectedIds.has(stat.id)) cls += ' ctt-cell--selected';
    cell.addEventListener('click', () => {
      if (selectedIds.has(stat.id)) {
        selectedIds.delete(stat.id);
      } else if (selectedIds.size < 2) {
        selectedIds.add(stat.id);
      } else {
        // Replace the oldest selection with the new one
        selectedIds.delete([...selectedIds][0]);
        selectedIds.add(stat.id);
      }
      refreshSelectionClasses();
      updateCombined();
    });

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
