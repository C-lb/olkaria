// The how-to's markup (spec 3 and 4): one slide on a full-bleed dialog, with the dots and the keycaps along the
// bottom. host/howto.ts holds the slides; Hud.showHowTo puts this up. The motion is CSS only (hud.css, "How to play"):
// each slide is built afresh as it is shown, so its animations run again, and each element that animates in carries
// its place in the slide's stagger as --i. Every word is a text node; only the class figures go in through innerHTML,
// as constant markup (figure() in Hud.ts).
import type { HowToSlide, Party } from '../howto';
import { badge, figure, h, tint, type Kid } from './Hud';

/** The slide to draw, where it falls among the slides, and what a click on the slide does. */
export interface HowToArgs { slide: HowToSlide; index: number; count: number; onNext: () => void }

/** The class figures at three canvas pixels to each of their pixels; the stylesheet sizes them to match. */
const FIGURE_SCALE = 3;

/** Sets custom properties the stylesheet reads off an element: its place in the stagger (--i), or a size. */
function vars<E extends HTMLElement>(el: E, values: Record<string, string | number>): E {
  for (const [name, value] of Object.entries(values)) el.style.setProperty(name, String(value));
  return el;
}

/** An element that animates in, at place `i` in its slide's stagger. */
const staggered = <E extends HTMLElement>(el: E, i: number): E => vars(el, { '--i': i });

/** `part` of `whole`, from 0 to 1. */
const share = (part: number, whole: number): number => (whole > 0 && Number.isFinite(part) ? Math.min(1, Math.max(0, part / whole)) : 0);

/** A share as a length along its track, to one decimal: "50%". */
const percent = (s: number): string => `${Math.round(s * 1000) / 10}%`;

/** One of a slide's lines, rising in at place `i`. */
const line = (text: string, i: number): HTMLElement => staggered(h('p', { class: 'howto-line howto-in' }, text), i);

/** One class: its figure over its class name in bold and its stakeholder. */
function member(m: Party[number], cls: string): HTMLLIElement {
  return h('li', { class: `howto-member ${cls}` },
    figure(m.role, FIGURE_SCALE), h('b', { class: 'howto-class' }, m.className), h('span', { class: 'howto-who' }, m.stakeholder));
}

/** What comes after the slide's eyebrow. Each line rises in after what is above it. */
function body(s: HowToSlide): Kid[] {
  switch (s.kind) {
    case 'title':
      return [
        h('h1', { class: 'howto-title' }, h('span', { class: 'howto-name' }, s.name), h('span', { class: 'howto-sub' }, s.sub)),
        // The front of the line, on the right, sets off first, so no one walks into the one ahead of them.
        h('ul', { class: 'howto-party' }, ...s.party.map((m, i) => staggered(member(m, 'howto-walk'), s.party.length - 1 - i))),
        line(s.line, s.party.length),
      ];
    case 'join':
      return [h('ol', { class: 'howto-steps' }, ...s.steps.map((step, i) => staggered(h('li', { class: 'howto-step howto-in' }, step), i)))];
    case 'round':
      return [
        h('header', { class: 'howto-boss' },
          h('h2', { class: 'howto-bossname' }, s.boss),
          h('div', { class: 'howto-hp' }, vars(h('div', { class: 'howto-hpbar howto-hit' }), { '--hit': share(s.hit, s.hp) }))),
        h('p', { class: 'howto-question' }, s.question),
        h('div', { class: 'howto-vote' },
          h('ul', { class: 'howto-options' }, ...s.options.map((o) =>
            tint(h('li', { class: 'howto-option' }, badge(o.letter, 'is-inline'), h('span', { class: 'howto-option-label' }, o.label)), o.letter))),
          h('div', { class: 'howto-ring', 'aria-hidden': 'true' }, h('span', { class: 'howto-clock' }, s.clock))),
        ...s.lines.map((text, i) => line(text, i)),
      ];
    case 'lead':
      // The four rise in together, then the lead class steps forward. The split rises in after the lines under it,
      // which say what it shows.
      return [
        h('ul', { class: 'howto-party' }, ...s.party.map((m) => member(m, m.role === s.lead ? 'howto-in howto-lead' : 'howto-in'))),
        staggered(h('div', { class: 'howto-split howto-in' },
          h('span', { class: 'howto-half is-lead' }, s.halves[0]), h('span', { class: 'howto-half' }, s.halves[1])), s.lines.length + 1),
        ...s.lines.map((text, i) => line(text, i + 1)),
      ];
    case 'points':
      return [
        h('ul', { class: 'howto-chips' }, ...s.chips.map((chip, i) => staggered(h('li', { class: 'howto-chip howto-in' },
          h('span', { class: 'howto-chip-label' }, chip.label), h('b', { class: 'howto-chip-value' }, chip.value)), i))),
        line(s.line, s.chips.length),
      ];
    case 'damage':
      // Each chunk of the track and its row in the list share a place in the stagger, so they come in together.
      return [
        h('div', { class: 'howto-track' }, ...s.chunks.map((chunk, i) =>
          vars(h('span', { class: 'howto-chunk howto-fill' }), { '--w': percent(share(chunk.width, s.hp)), '--i': i }))),
        h('ol', { class: 'howto-chunks' }, ...s.chunks.map((chunk, i) => staggered(h('li', { class: 'howto-in' }, h('span', {}, chunk.label), h('b', {}, chunk.note)), i))),
        line(s.line, s.chunks.length),
      ];
    case 'ending': {
      // The lines, then the gauge filling, then the line under it; the gauge ends in its top score.
      const mark = (at: number, label: string): HTMLElement =>
        vars(h('span', { class: 'howto-mark' }, h('b', {}, String(at)), ` ${label}`), { '--at': percent(share(at, s.max)) });
      return [
        ...s.lines.map((text, i) => line(text, i)),
        h('div', { class: 'howto-gauge' },
          vars(h('div', { class: 'howto-gaugefill howto-fill' }), { '--w': percent(share(s.fill, s.max)), '--i': s.lines.length }),
          mark(s.fragile, 'Fragile'),
          mark(s.decisive, 'Decisive'),
          h('b', { class: 'howto-end' }, String(s.max))),
        line(s.holds, s.lines.length + 1),
      ];
    }
    case 'awards':
      return [h('ul', { class: 'howto-awards' }, ...s.items.map((item, i) => staggered(h('li', { class: 'howto-in' }, item), i)))];
  }
}

/** div.hud-howto[role=dialog][aria-label="How to play"] > section.howto-slide[data-kind] + footer.howto-foot */
export function howToPanel(a: HowToArgs): HTMLElement {
  const slide = h('section', { class: 'howto-slide', 'data-kind': a.slide.kind }, h('p', { class: 'eyebrow' }, a.slide.eyebrow), ...body(a.slide));
  slide.addEventListener('click', () => a.onNext());
  const dots = h('ol', { class: 'howto-dots' }, ...Array.from({ length: a.count }, (_, i) =>
    h('li', i === a.index ? { class: 'howto-dot', 'aria-current': 'step' } : { class: 'howto-dot' })));
  const keycap = (key: string, label: string): HTMLElement => h('li', { class: 'howto-key' }, h('kbd', { class: 'key' }, key), h('span', {}, label));
  const keys = h('ul', { class: 'howto-keys' }, keycap('Space', a.index === a.count - 1 ? 'Close' : 'Next'), keycap('Esc', 'Close'));
  return h('div', { class: 'hud-howto', role: 'dialog', 'aria-label': 'How to play' }, slide, h('footer', { class: 'howto-foot' }, dots, keys));
}
