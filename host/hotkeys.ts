// The facilitator's keys that work in every scene (spec 6.5). Space, the arrows and A belong to the scenes, and so
// does N in travel; M and Esc open the menu (menu.ts), which keeps every key from here while it is open. A refused
// command (a key pressed in the wrong phase) comes back through the client's onError, which main.ts shows as a
// toast, so the reducer is the one place that decides what each phase allows. The scenes register their own keys
// through oncePerEvent, so a press reaches each handler once.
import type Phaser from 'phaser';
import { OPTION_IDS, type HostView } from '../shared/types';
import type { Sound } from './audio/sound';
import type { Hud } from './hud/Hud';
import type { RoomClient } from './net';

/** Shift+R must come twice within this long to send the room back to the lobby. */
const RESET_WINDOW_MS = 3000;
/** How many bot votes B adds. */
const BOTS = 30;
/** Keys that are only ever held with another: on their own they are not a press. */
const MODIFIERS = new Set(['Shift', 'Control', 'Alt', 'Meta', 'CapsLock']);
/** How long the toasts that answer Shift+R ("Room reset", "Reset called off") stay. */
const RESET_NOTE_MS = 1500;
/** How long "Sound off" or "Sound on" stays after S. */
const SOUND_NOTE_MS = 1500;

/** The listener installed last, removed when another install replaces it. */
let uninstall: (() => void) | null = null;
/** Calls off the installed keys' waiting Shift+R, if one is waiting; null with no keys installed. */
let callOff: (() => void) | null = null;

/**
 * Calls off a Shift+R that waits for its second press, the way any other key does, toast and all. The menu and the
 * how-to call it as they open: they keep their opening key from these keys, which would otherwise never hear it.
 */
export function callOffReset(): void {
  callOff?.();
}

/** 1 to 4 on the top row or the number pad, read by position so Shift (which turns "1" into "!") does not hide it; else 0. */
function digitOf(code: string): number {
  const match = /^(?:Digit|Numpad)([1-4])$/.exec(code);
  return match === null ? 0 : Number(match[1]);
}

/**
 * A scene's key handler that runs once for each DOM event. Phaser 3.90's keyboard plugin keeps the key events of the
 * current frame in a queue and hands the whole queue to every scene's handlers again on each new key event, skipping
 * only the one event it handled last. So when three key events land inside one frame, say a key let go just before
 * Space is pressed and released, the Space keydown reaches its handlers a second time on the release's turn: that is
 * how one press of Space in the lobby sent `start` twice, 4 ms apart. Scenes register their key handlers through this.
 */
export function oncePerEvent<E extends Event>(handler: (event: E) => void): (event: E) => void {
  const seen = new WeakSet<E>();
  return (event) => {
    if (seen.has(event)) return;
    seen.add(event);
    handler(event);
  };
}

/** Whether a form field has the focus, so that a key goes into it and is not a command. */
export function typing(): boolean {
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
 * or shows names; F toggles fullscreen; S turns the sound off or on (Shift+S does nothing); Shift+R twice within 3 s resets to the lobby, and any other key in between
 * calls the reset off, as opening the menu or the how-to does (callOffReset). Escape is the menu's (menu.ts), not one
 * of these. Held keys do not repeat, and Ctrl, Alt or Cmd chords (a reload) are left to the browser. Returns the
 * function that removes the keys again; installing again removes the earlier install first, so a key never sends twice.
 */
export function installHotkeys(game: Phaser.Game, client: RoomClient, hud: Hud, sound: Sound): () => void {
  uninstall?.();
  let resetUntil = 0;

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || MODIFIERS.has(event.key) || typing()) return;
    const armed = Date.now() <= resetUntil;
    resetUntil = 0;
    const key = event.key.toLowerCase();
    if (key === 'r' && event.shiftKey) {
      if (armed) {
        client.send({ k: 'reset' });
        hud.showToast('Room reset', RESET_NOTE_MS);
      } else {
        resetUntil = Date.now() + RESET_WINDOW_MS;
        hud.showToast('Press Shift+R again to reset', RESET_WINDOW_MS);
      }
      return;
    }
    // Any other key calls an armed reset off, and the confirm toast says so instead of lingering.
    if (armed) hud.showToast('Reset called off', RESET_NOTE_MS);

    const digit = digitOf(event.code);
    if (digit > 0) {
      client.send({ k: 'injectVotes', counts: { [OPTION_IDS[digit - 1]]: event.shiftKey ? 10 : 1 } });
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
      case 's':
        if (!event.shiftKey) hud.showToast(sound.toggle() ? 'Sound on' : 'Sound off', SOUND_NOTE_MS);
        break;
      default:
        break;
    }
  };

  const callOffArmed = (): void => {
    if (Date.now() <= resetUntil) hud.showToast('Reset called off', RESET_NOTE_MS);
    resetUntil = 0;
  };

  window.addEventListener('keydown', onKeyDown);
  callOff = callOffArmed;
  const dispose = (): void => {
    window.removeEventListener('keydown', onKeyDown);
    if (callOff === callOffArmed) callOff = null;
    if (uninstall === dispose) uninstall = null;
  };
  uninstall = dispose;
  return dispose;
}
