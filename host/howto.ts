// How to play: five slides the facilitator shows on the projector before the game, one idea each, so the room sees
// how a question goes. Nothing is scored, so no slide talks about points or classes. This is the slide model:
// howtoSlides() reads the vote time from the case's settings, so a content edit carries through; the words are fixed
// here because they describe the game, not the case. host/hud/HowTo.ts draws a slide; Hud.showHowTo shows it;
// installHowTo() puts the slides on ? and walks them.
import { clockText } from '../shared/clock';
import type { CaseContent } from '../shared/content';
import { callOffReset, typing } from './hotkeys';
import type { Hud } from './hud/Hud';

/** One slide: a title and one or two lines under it. */
export interface HowToSlide { title: string; lines: string[] }

/** The five slides, in order. */
export function howtoSlides(content: CaseContent): HowToSlide[] {
  const clock = clockText(content.settings.voteSeconds);
  return [
    { title: 'Join', lines: ['Scan the code. Pick your name, your role and your team.'] },
    { title: 'Five bosses', lines: ['Power, Demand, Competition, Risk, and the Deadlock. Each one guards a question.'] },
    { title: 'Vote', lines: [`Read the question on your phone and pick A, B or C. You have ${clock}.`] },
    { title: 'Defend', lines: ['Then look at the screen. You may be called to defend your pick.'] },
    { title: 'The ending', lines: ['The last vote decides how it ends.'] },
  ];
}

/** The key that opens the how-to, and closes it again. */
const HOWTO_KEY = '?';

/** What a key does while the how-to is up: on to the next slide, back one, or close. */
type Walk = 'next' | 'back' | 'close';
const WALK_KEYS: ReadonlyMap<string, Walk> = new Map<string, Walk>([
  [' ', 'next'], ['Enter', 'next'], ['ArrowRight', 'next'], ['ArrowDown', 'next'], ['PageDown', 'next'],
  ['ArrowLeft', 'back'], ['ArrowUp', 'back'], ['PageUp', 'back'],
  ['Escape', 'close'], [HOWTO_KEY, 'close'],
]);

/** M opens the menu (menu.ts). */
const isMenuKey = (key: string): boolean => key === 'm' || key === 'M';

/** The how-to installed last, taken down when another install replaces it. */
let uninstall: (() => void) | null = null;

/**
 * Puts the how-to on `?` with one capture-phase keydown listener on window, registered before the menu's (main.ts),
 * so that while it is open it stops every key before the menu, the hotkeys and Phaser; browser chords are stopped too
 * but never prevented (Cmd+R still reloads), and M closes it and passes on to the menu. Closed: chords pass untouched,
 * and `?` opens it at the first slide unless the key is held, typed into a field, or the menu is up. Open: Space,
 * Enter, ArrowRight, ArrowDown and PageDown go on (the last slide closes); ArrowLeft, ArrowUp and PageUp go back;
 * Escape and `?` close; Tab does nothing, so the focus never leaves the page; held keys do nothing. Each slide is drawn
 * afresh as it is shown. Returns open, close and dispose; installing again removes the earlier install first.
 */
export function installHowTo(hud: Hud, content: CaseContent): { open: () => void; close: () => void; dispose: () => void } {
  uninstall?.();
  const slides = howtoSlides(content);
  /** The slide that is up; null while the how-to is closed. */
  let index: number | null = null;

  function draw(): void {
    if (index === null) return;
    hud.showHowTo({ slide: slides[index], index, count: slides.length, onNext: next });
  }

  /** At the first slide. The hotkeys never hear the ? that opened it, so a Shift+R waiting for its second press is off. */
  function open(): void {
    callOffReset();
    index = 0;
    draw();
  }

  function close(): void {
    if (index === null) return;
    index = null;
    // As the menu does: the focus goes with the dialog, so a later Space or Enter lands on nothing that was in it.
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    hud.showHowTo(null);
  }

  /** On to the next slide; past the last, the how-to closes. A click on the slide does this too. */
  function next(): void {
    if (index === null) return;
    if (index === slides.length - 1) {
      close();
      return;
    }
    index += 1;
    draw();
  }

  /** Back one slide; the first slide stays as it is. */
  function back(): void {
    if (index === null || index === 0) return;
    index -= 1;
    draw();
  }

  const onKeyDown = (event: KeyboardEvent): void => {
    const chord = event.ctrlKey || event.metaKey || event.altKey;
    if (index === null) {
      if (chord || event.key !== HOWTO_KEY || event.repeat || typing() || hud.menuOpen()) return;
      event.stopPropagation();
      open();
      return;
    }
    // M closes the how-to and goes on, so the menu's listener, which comes next, opens the menu on the same press.
    if (isMenuKey(event.key) && !chord && !event.repeat) {
      close();
      return;
    }
    // Every other key stops here, the menu's listener on this same target included, so no key reaches the menu, the
    // hotkeys or Phaser. A chord stops too, since the scenes take Space with any modifier, but its default stays, so
    // the browser still acts on it.
    event.stopImmediatePropagation();
    if (chord) return;
    // Tab would walk the focus out of the page, where ? and M no longer reach the how-to, so it does nothing here.
    if (event.key === 'Tab') {
      event.preventDefault();
      return;
    }
    const walk = WALK_KEYS.get(event.key);
    if (walk === undefined) return;
    event.preventDefault();
    if (event.repeat) return;
    if (walk === 'next') next();
    else if (walk === 'back') back();
    else close();
  };

  window.addEventListener('keydown', onKeyDown, true);
  const dispose = (): void => {
    close();
    window.removeEventListener('keydown', onKeyDown, true);
    if (uninstall === dispose) uninstall = null;
  };
  uninstall = dispose;
  return { open, close, dispose };
}
