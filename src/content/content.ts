import { Deck, type DeckStats } from '../engine/deck';
import { createPanel, renderTiles } from '../panel/panel';

// This content script only runs in the Carcassonne game iframe
// (manifest matches *://*.boardgamearena.com/*/carcassonne*).

function init(): void {
  const deck = new Deck();

  createPanel((a, b) => deck.combinedProb(a, b));
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
      const placedTypes: string[] = ev.data.placedTypes ?? [];
      const handTypes: string[] = ev.data.handTypes ?? [];
      const deckSize: number = typeof ev.data.deckSize === 'number' ? ev.data.deckSize : 0;
      deck.setState(placedTypes, handTypes, deckSize);
      renderTiles(deck.stats());
    }
  });
}

init();
