import { Deck, type DeckStats, type PlayerInfo } from '../engine/deck';
import { createPanel, renderTiles, setRescanHandler } from '../panel/panel';

// This content script only runs in the Carcassonne game iframe
// (manifest matches *://*.boardgamearena.com/*/carcassonne*).

function init(): void {
  const deck = new Deck();

  createPanel((a, b) => deck.combinedProb(a, b));
  // Rescan: re-render with current live state (no reset — gamedatas is stale).
  // For a true rescan we re-send the bootstrap state from gamedatas so scores
  // and hand are refreshed, but preserve our live delta tile counts.
  setRescanHandler(() => window.postMessage({ source: 'CTT_', type: 'RESCAN' }, '*'));
  renderTiles(deck.stats());

  // Inject the page-context script so it can access window.WebSocket and window.gameui.
  // Content scripts run in an isolated world; the <script> tag breaks out into page context.
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('injected.js');
  script.onload = () => script.remove();
  (document.head ?? document.documentElement).appendChild(script);

  // Handle messages from injected.ts
  window.addEventListener('message', (ev: MessageEvent) => {
    if (!ev.data || typeof ev.data !== 'object') return;
    if (ev.data.source !== 'CTT_') return;

    if (ev.data.type === 'UPDATE_STATE') {
      // Full state refresh — used for bootstrap and score updates
      const placedTypes: string[] = ev.data.placedTypes ?? [];
      const handTypes: string[] = ev.data.handTypes ?? [];
      const deckSize: number = typeof ev.data.deckSize === 'number' ? ev.data.deckSize : 0;
      const players: PlayerInfo[] = Array.isArray(ev.data.players)
        ? (ev.data.players as PlayerInfo[]).map((p) => ({
            ...p,
            partialScore: typeof p.partialScore === 'number' ? p.partialScore : p.score,
          }))
        : [];
      deck.setState(placedTypes, handTypes, deckSize, players);
      renderTiles(deck.stats());
    } else if (ev.data.type === 'TILE_PLACED') {
      // Delta update — tile placed live, gamedatas is stale so we track it ourselves
      deck.place(String(ev.data.bgaType ?? ''));
      renderTiles(deck.stats());
    } else if (ev.data.type === 'SCORE_UPDATE') {
      // Rescan: refresh scores and deckSize without resetting tile counts
      const players: PlayerInfo[] = Array.isArray(ev.data.players) ? ev.data.players : [];
      const deckSize: number = typeof ev.data.deckSize === 'number' ? ev.data.deckSize : 0;
      deck.updateScores(players, deckSize);
      renderTiles(deck.stats());
    }
  });
}

init();
