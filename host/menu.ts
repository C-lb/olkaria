// The facilitator's menu (spec 3): M or Esc opens it over any screen, with the actions (restart the round, back to
// the lobby, reload the page), a row of stages to go to, and the key map. menuItems() says what each item reads and
// does, from the view, the mode and the link; installMenu() owns the keys, the asking twice and the redraws; the HUD
// only draws (Hud.showMenu). While the menu is open no key press reaches the room or the scenes.
import type Phaser from 'phaser';
import type { CaseContent } from '../shared/content';
import type { HostCmd, HostView } from '../shared/types';
import { callOffReset, typing } from './hotkeys';
import type { Hud, MenuButton } from './hud/Hud';
import type { ConnectionStatus, RoomClient } from './net';

export type MenuAct = { kind: 'cmd'; cmd: HostCmd } | { kind: 'reload' };
export interface MenuItem { id: string; label: string; hint: string; enabled: boolean; confirm: boolean; act: MenuAct }
export interface MenuModel { actions: MenuItem[]; stages: MenuItem[]; stagesHint: string }

/** How long an armed item waits for its second press. */
export const ARM_MS = 3000;
/**
 * A second press this soon after the one that armed an item is the same press, a double-click or a bounce of the key,
 * not the answer to "Sure?": the item stays armed and nothing is sent.
 */
export const DEAD_MS = 300;

const RESTART_HINT = 'This round again from its road. Its votes go; earlier rounds stay.';
const LOBBY_HINT = 'Players stay; votes and scores go.';
const RELOAD_HINT_UP = 'The same room and screen come back.';
const RELOAD_HINT_DOWN = 'Needs the network. Without it the page is lost.';
const RELOAD_HINT_OFFLINE = 'Offline mode starts over on a reload. Use Back to the lobby.';
const STAGES_HINT = 'Earlier rounds stay. The one you go to, and the ones after it, start over. Ending shows what has been played.';

/** The menu installed last, taken down when another install replaces it. */
let uninstall: (() => void) | null = null;

/** M and Esc open the menu and close it again. */
const isToggle = (key: string): boolean => key === 'Escape' || key === 'm' || key === 'M';

/**
 * What the menu offers (spec 3.2). The restart names the round it plays again and, like the way back to the lobby,
 * waits for the game to start. Every stage, then the ending, can be gone to once a view has come, from the lobby too.
 * The reload fires at once while the link is up and asks twice while it is down; offline it is off, because a reload
 * there loses the game. Until the first view only the reload is on. `link` is the client's latest ConnectionStatus
 * (host/net.ts), null before the first one.
 */
export function menuItems(content: CaseContent, view: HostView | null, mode: 'online' | 'offline', link: ConnectionStatus | null): MenuModel {
  const round = view !== null && view.phase !== 'lobby' ? view.round : null;
  const goto = (stage: number): MenuAct => ({ kind: 'cmd', cmd: { k: 'goto', stage } });
  const stage = (index: number, label: string): MenuItem => ({ id: `stage-${index}`, label, hint: '', enabled: view !== null, confirm: true, act: goto(index) });
  return {
    actions: [
      { id: 'restart', label: round === null ? 'Restart the round' : `Restart round ${round + 1}`, hint: RESTART_HINT, enabled: round !== null, confirm: true, act: goto(round ?? 0) },
      { id: 'lobby', label: 'Back to the lobby', hint: LOBBY_HINT, enabled: round !== null, confirm: true, act: { kind: 'cmd', cmd: { k: 'reset' } } },
      { id: 'reload', label: 'Reload the page', ...reloadState(mode, link), act: { kind: 'reload' } },
    ],
    stages: [...content.rounds.map((r, i) => stage(i, `${i + 1} ${r.boss}`)), stage(content.rounds.length, 'Ending')],
    stagesHint: STAGES_HINT,
  };
}

function reloadState(mode: 'online' | 'offline', link: ConnectionStatus | null): Pick<MenuItem, 'hint' | 'enabled' | 'confirm'> {
  if (mode === 'offline') return { hint: RELOAD_HINT_OFFLINE, enabled: false, confirm: false };
  return link === 'open' ? { hint: RELOAD_HINT_UP, enabled: true, confirm: false } : { hint: RELOAD_HINT_DOWN, enabled: true, confirm: true };
}

/**
 * Puts the menu on M and Esc (spec 3.1 and 3.3) with one keydown listener on window in the capture phase, so the menu
 * hears a key before the hotkeys and Phaser, which listen on window in the bubble phase. Closed, M or Esc opens the
 * menu, unless the key is held down or typed into a field, and browser chords (Ctrl, Alt, Cmd) pass untouched; the
 * hotkeys never hear the key that opened it, so opening calls off a Shift+R that waits for its second press. Open,
 * the menu stops every key press: M or Esc closes it, the arrows and Tab (back with Shift) walk the focus, Enter or
 * Space presses the focused item, any other key does nothing, and a held key neither closes the menu nor presses an
 * item again. A chord is stopped as well but never prevented, so Cmd+R still reloads. Key releases always pass, so a
 * key held as the menu opens does not stick down. An item that changes the room asks twice: the first press arms it
 * for ARM_MS, a second press on it fires it unless it comes within DEAD_MS of the first, and a press on another item
 * arms that one instead. Firing closes the menu. While open, the panel follows the view and the link, and is drawn
 * again only when what it shows has changed, so the buttons under a pointer stay put through the room's broadcasts.
 * Returns the function that removes it all again; installing again removes the earlier install first.
 */
export function installMenu(game: Phaser.Game, client: RoomClient, hud: Hud, content: CaseContent, reload: () => void = () => location.reload()): () => void {
  uninstall?.();
  let open = false;
  let link: ConnectionStatus | null = null;
  /** The item waiting for its second press and when it was armed, and the timer that disarms it. */
  let armed: { id: string; at: number } | null = null;
  let lapse: ReturnType<typeof setTimeout> | null = null;
  /**
   * What the open panel was drawn from. The room sends a view on every join and vote, and a panel drawn afresh for one
   * that changes nothing it shows would swallow a click that spans it: the press lands on the old button, the release
   * on the new.
   */
  let drawn = '';

  function model(): MenuModel {
    return menuItems(content, (game.registry.get('view') as HostView | null | undefined) ?? null, client.mode, link);
  }

  function disarm(): void {
    if (lapse !== null) clearTimeout(lapse);
    lapse = null;
    armed = null;
  }

  function draw(): void {
    const m = model();
    // An armed item that a new view or link has turned off, or that no longer asks twice, is armed no more.
    if (armed !== null && ![...m.actions, ...m.stages].some((i) => i.id === armed?.id && i.enabled && i.confirm)) disarm();
    const signature = JSON.stringify([m, armed?.id ?? null]);
    if (signature === drawn) return;
    drawn = signature;
    const button = (i: MenuItem): MenuButton => ({ id: i.id, label: i.label, hint: i.hint, enabled: i.enabled, armed: i.id === armed?.id });
    hud.showMenu({ actions: m.actions.map(button), stages: m.stages.map(button), stagesHint: m.stagesHint, onPick: pick, onClose: close });
  }

  function show(): void {
    open = true;
    callOffReset();
    disarm();
    drawn = '';
    draw();
    game.registry.events.on('changedata-view', draw);
  }

  function close(): void {
    if (!open) return;
    open = false;
    game.registry.events.off('changedata-view', draw);
    disarm();
    drawn = '';
    // The focus goes with the panel, so that a later Space or Enter cannot land on a button that is no longer there.
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    hud.showMenu(null);
  }

  function pick(id: string): void {
    if (!open) return;
    const m = model();
    const item = [...m.actions, ...m.stages].find((i) => i.id === id);
    if (item === undefined || !item.enabled) return;
    if (item.confirm) {
      const since = armed !== null && armed.id === id ? Date.now() - armed.at : Infinity;
      if (since < DEAD_MS) return;   // the press that armed it, again: it stays armed, and its lapse runs on
      if (!(since < ARM_MS)) {
        disarm();
        armed = { id, at: Date.now() };
        lapse = setTimeout(() => {
          lapse = null;
          armed = null;
          draw();
        }, ARM_MS);
        draw();
        return;
      }
    }
    if (item.act.kind === 'reload') reload();
    else client.send(item.act.cmd);
    close();
  }

  const onKeyDown = (event: KeyboardEvent): void => {
    const chord = event.ctrlKey || event.metaKey || event.altKey;
    if (!open) {
      if (chord || !isToggle(event.key) || event.repeat || typing()) return;
      event.stopPropagation();
      show();
      return;
    }
    // Open: no key press gets past the menu, to the hotkeys, to Phaser or to the focused button. A chord stops here
    // too, since the scenes take Space with any modifier, but its default stays, so the browser still acts on it.
    event.stopPropagation();
    if (chord) return;
    switch (event.key) {
      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault();
        hud.moveMenuFocus(-1);
        break;
      case 'ArrowRight':
      case 'ArrowDown':
        event.preventDefault();
        hud.moveMenuFocus(1);
        break;
      // Tab walks the menu too, so the focus never leaves the page for the browser, where M and Esc would not
      // reach the menu.
      case 'Tab':
        event.preventDefault();
        hud.moveMenuFocus(event.shiftKey ? -1 : 1);
        break;
      case 'Enter':
      case ' ': {
        event.preventDefault();
        const id = event.repeat ? null : hud.focusedMenuItem();
        if (id !== null) pick(id);
        break;
      }
      default:
        if (isToggle(event.key) && !event.repeat) close();
        break;
    }
  };

  const offStatus = client.onStatus((status) => {
    link = status;
    if (open) draw();
  });
  window.addEventListener('keydown', onKeyDown, true);
  const dispose = (): void => {
    close();
    window.removeEventListener('keydown', onKeyDown, true);
    offStatus();
    if (uninstall === dispose) uninstall = null;
  };
  uninstall = dispose;
  return dispose;
}
