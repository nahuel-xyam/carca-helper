/**
 * Injected into the BGA PAGE CONTEXT (runs inside the game iframe).
 * Reads window.gameui directly and posts state updates to the content script
 * via window.postMessage.
 *
 * Strategy:
 *   1. Poll until window.gameui.gamedatas is ready.
 *   2. Fetch notificationHistory for the current table and replay through
 *      the local engine to compute partial scores.
 *   3. Send full state after every notif_playTile.
 */

import { computePartialScores } from '../engine/live-score';

const SOURCE = 'CTT_';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyObj = Record<string, any>;

export interface PlayerInfo {
  id: string;
  name: string;
  color: string;
  score: number;
  partialScore: number;
  isActive: boolean;
}

/** Read current game state from gamedatas and post UPDATE_STATE. */
function sendState(gameui: AnyObj): void {
  const gd: AnyObj = gameui['gamedatas'];
  if (!gd) return;

  // Placed tiles on the board (gamedatas.tiles includes the start tile)
  const tilesObj: AnyObj = gd['tiles'] ?? {};
  const placedTypes: string[] = Object.values(tilesObj).map((t: AnyObj) =>
    String(t['type'] ?? ''),
  );

  // Current player's hand (usually 0 or 1 tile in Carcassonne)
  const handArr: AnyObj[] = Array.isArray(gd['hand'])
    ? gd['hand']
    : Object.values(gd['hand'] ?? {});
  const handTypes: string[] = handArr.map((t: AnyObj) => String(t['type'] ?? ''));

  // BGA's deck_size is the authoritative draw-pile count (excludes both players'
  // hand tiles). Use it as N for probability calculations.
  const deckSize: number = parseInt(String(gd['deck_size'] ?? '0'), 10);

  // Player names + scores from gamedatas.players
  const myId = String(gameui['player_id'] ?? '');
  const activeId = String(gd['gamestate']?.['active_player'] ?? myId);
  const playersObj: AnyObj = gd['players'] ?? {};

  const players: PlayerInfo[] = Object.values(playersObj).map((p: AnyObj) => {
    const id = String(p['id'] ?? p['player_id'] ?? '');
    const committed = parseInt(String(p['score'] ?? '0'), 10) || 0;
    return {
      id,
      name: String(p['name'] ?? p['player_name'] ?? ''),
      color: '#' + String(p['color'] ?? '888888').replace(/^#/, ''),
      score: committed,
      partialScore: committed, // TODO: re-enable computePartialScores when ready
      isActive: id === activeId,
    };
  });

  window.postMessage(
    { source: SOURCE, type: 'UPDATE_STATE', placedTypes, handTypes, deckSize, players },
    '*',
  );
}

// Marker used to detect if our hook is still in place
const HOOK_MARKER = '__ctt_hooked__';

function applyHook(gameui: AnyObj): void {
  // notif_playTile — fires for every tile placed by any player
  if (typeof gameui['notif_playTile'] === 'function' && !gameui['notif_playTile'][HOOK_MARKER]) {
    const orig = gameui['notif_playTile'].bind(gameui);
    const hooked = function (notif: AnyObj) {
      const result = orig(notif);
      const bgaType = String((notif['args'] ?? {})['type'] ?? '');
      if (bgaType) {
        window.postMessage({ source: SOURCE, type: 'TILE_PLACED', bgaType }, '*');
      }
      return result;
    };
    (hooked as AnyObj)[HOOK_MARKER] = true;
    gameui['notif_playTile'] = hooked;
  }

  // notif_winPoints — fires when scores update (cities, roads completed)
  // Use it to refresh player scores without re-reading tiles.
  if (typeof gameui['notif_winPoints'] === 'function' && !gameui['notif_winPoints'][HOOK_MARKER]) {
    const origW = gameui['notif_winPoints'].bind(gameui);
    const hookedW = function (notif: AnyObj) {
      const result = origW(notif);
      setTimeout(() => { try { sendState(gameui); } catch { /* ignore */ } }, 400);
      return result;
    };
    (hookedW as AnyObj)[HOOK_MARKER] = true;
    gameui['notif_winPoints'] = hookedW;
  }
}

function hookNotifications(gameui: AnyObj): void {
  // BGA resets notif_* instance methods during its own init cycle.
  // We re-apply our hook every 200ms; the HOOK_MARKER prevents double-wrapping.
  applyHook(gameui);
  setInterval(() => { try { applyHook(gameui); } catch { /* ignore */ } }, 200);
}

function tryInit(attempt = 0): void {
  try {
    const gameui: AnyObj | undefined = (window as AnyObj)['gameui'];
    if (!gameui || !gameui['gamedatas']) {
      if (attempt < 60) setTimeout(() => tryInit(attempt + 1), 500);
      return;
    }
    sendState(gameui);
    hookNotifications(gameui);
  } catch {
    if (attempt < 60) setTimeout(() => tryInit(attempt + 1), 500);
  }
}

tryInit();
