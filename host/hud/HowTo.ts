// The how-to's markup (spec 3 and 4): one slide on a full-bleed dialog, with the dots and the keycaps along the
// bottom. host/howto.ts holds the slides, each a step number, a sentence and sometimes a smaller line under it;
// Hud.showHowTo puts this up. Each slide is built afresh as it is shown, so its rise-in (hud.css, "How to play") runs
// again. Every word is a text node.
import type { HowToSlide } from '../howto';
import { h } from './Hud';

/** The slide to draw, where it falls among the slides, and what a click on the slide does. */
export interface HowToArgs { slide: HowToSlide; index: number; count: number; onNext: () => void }

/** An element that rises in at place `i` in its slide's stagger. */
function staggered<E extends HTMLElement>(el: E, i: number): E {
  el.style.setProperty('--i', String(i));
  return el;
}

/** div.hud-howto[role=dialog][aria-label="How to play"] > section.howto-slide + footer.howto-foot */
export function howToPanel(a: HowToArgs): HTMLElement {
  const { step, text, note } = a.slide;
  const slide = h('section', { class: 'howto-slide' },
    step === null ? null : staggered(h('p', { class: 'howto-step howto-in' }, String(step)), 0),
    staggered(h('h2', { class: 'howto-text howto-in' }, text), 1),
    note === undefined ? null : staggered(h('p', { class: 'howto-note howto-in' }, note), 2));
  slide.addEventListener('click', () => a.onNext());
  const dots = h('ol', { class: 'howto-dots' }, ...Array.from({ length: a.count }, (_, i) =>
    h('li', i === a.index ? { class: 'howto-dot', 'aria-current': 'step' } : { class: 'howto-dot' })));
  const keycap = (key: string, label: string): HTMLElement => h('li', { class: 'howto-key' }, h('kbd', { class: 'key' }, key), h('span', {}, label));
  // The second cap names ?, not Esc: in fullscreen Chrome takes Esc to leave fullscreen before the page sees it.
  const keys = h('ul', { class: 'howto-keys' }, keycap('Space', a.index === a.count - 1 ? 'Close' : 'Next'), keycap('?', 'Close'));
  return h('div', { class: 'hud-howto', role: 'dialog', 'aria-label': 'How to play' }, slide, h('footer', { class: 'howto-foot' }, dots, keys));
}
