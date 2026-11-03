// The facilitator's keys that work in every scene (spec 6.5). Space, the arrows and A belong to the scenes, and so
// does N in travel. A refused command (a key pressed in the wrong phase) comes back through the client's onError,
// which main.ts shows as a toast, so the reducer is the one place that decides what each phase allows.
import type Phaser from 'phaser';
import { OPTION_IDS, type HostView } from '../shared/types';
import type { Hud } from './hud/Hud';
import type { RoomClient } from './net';

/** Shift+R must come twice within this long to send the room back to the lobby. */
const RESET_WINDOW_MS = 3000;
/** How many bot votes B adds. */
const BOTS = 30;
/** Keys that are only ever held with another: on their own they are not a press. */
const MODIFIERS = new Set(['Shift', 'Control', 'Alt', 'Meta', 'CapsLock']);

/** 1 to 4 on the top row or the number pad, read by position so Shift (which turns "1" into "!") does not hide it; else 0. */
function digitOf(code: string): number {
  const match = /^(?:Digit|Numpad)([1-4])$/.exec(code);
  return match === null ? 0 : Number(match[1]);
}

function typing(): boolean {
  const el = document.activeElement;
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement
    || (el instanceof HTMLElement && el.isContentEditable);
}

function pendingCallout(view: HostView | null): boolean {
  return view !== null && view.phase === 'locked' && (view.callouts[view.round] ?? []).some((c) => c.status === 'pending');
}

/**
 * 1 to 4 add a vote to A to D and Shift+1 to 4 add ten; B adds 30 bot votes; C calls a student out; Y and N judge a
 * pending call-out (only while one is pending in `locked`, otherwise N is the Travel scene's skip); R reopens; H hides
 * or shows names; F toggles fullscreen; Esc toggles the key map; Shift+R twice within 3 s resets to the lobby, and any
 * other key in between calls the reset off. Held keys do not repeat, and Ctrl, Alt or Cmd chords (a reload) are left
 * to the browser.
 */
export function installHotkeys(game: Phaser.Game, client: RoomClient, hud: Hud): void {
  let keymap = false;
  let resetUntil = 0;

  window.addEventListener('keydown', (event) => {
    if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || MODIFIERS.has(event.key) || typing()) return;
    const armed = resetUntil;
    resetUntil = 0;

    const digit = digitOf(event.code);
    if (digit > 0) {
      client.send({ k: 'injectVotes', counts: { [OPTION_IDS[digit - 1]]: event.shiftKey ? 10 : 1 } });
      return;
    }
    const key = event.key.toLowerCase();
    if (key === 'r' && event.shiftKey) {
      if (Date.now() <= armed) {
        client.send({ k: 'reset' });
      } else {
        resetUntil = Date.now() + RESET_WINDOW_MS;
        hud.showToast('Press Shift+R again to reset', RESET_WINDOW_MS);
      }
      return;
    }
    const view = (game.registry.get('view') as HostView | null | undefined) ?? null;
    switch (key) {
      case 'b':
        client.addBots(BOTS);
        break;
      case 'c':
        client.send({ k: 'callout' });
        break;
      case 'y':
      case 'n':
        if (pendingCallout(view)) client.send({ k: 'judge', awarded: key === 'y' });
        break;
      case 'h':
        client.send({ k: 'hideNames', hide: !(view?.hideNames ?? false) });
        break;
      case 'f':
        game.scale.toggleFullscreen();
        break;
      case 'r':
        client.send({ k: 'reopen' });
        break;
      case 'escape':
        keymap = !keymap;
        hud.showKeymap(keymap);
        break;
      default:
        break;
    }
  });
}
