/**
 * Injected into the BGA PAGE CONTEXT (runs inside the game iframe).
 * Reads window.gameui directly and posts state updates to the content script
 * via window.postMessage.
 *
 * Strategy:
 *   1. Poll until window.gameui.gamedatas is ready.
 *   2. Send full state (placed tiles + hand) immediately.
 *   3. After every notif_playTile or notif_pickTile, re-send the full state so
 *      the content script always has a consistent, up-to-date picture.
 */

const SOURCE = 'CTT_';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyObj = Record<string, any>;

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

  window.postMessage(
    { source: SOURCE, type: 'UPDATE_STATE', placedTypes, handTypes, deckSize },
    '*',
  );
}

function hookNotifications(gameui: AnyObj): void {
  // Wrap a BGA notification handler so our sendState runs AFTER BGA fully
  // processes the notification. We use setTimeout(0) to defer our code to the
  // next event-loop tick, ensuring we never block or throw inside BGA's call.
  const safeHook = (orig: (n: AnyObj) => unknown) =>
    function (this: unknown, notif: AnyObj) {
      const result = orig(notif);
      setTimeout(() => { try { sendState(gameui); } catch { /* ignore */ } }, 0);
      return result;
    };

  gameui['notif_playTile'] = safeHook(gameui['notif_playTile'].bind(gameui));

  if (typeof gameui['notif_pickTile'] === 'function') {
    gameui['notif_pickTile'] = safeHook(gameui['notif_pickTile'].bind(gameui));
  }

  if (typeof gameui['notif_deck_size'] === 'function') {
    gameui['notif_deck_size'] = safeHook(gameui['notif_deck_size'].bind(gameui));
  }
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
