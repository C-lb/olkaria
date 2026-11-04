// The phone page. Every screen is plain DOM built from the latest PlayerView, one function per screen, no framework.
// render() swaps the page only when a screen's markup actually changed: the room sends every phone a view after
// every vote, and replacing a button in the middle of a press would swallow the tap.
import type { CaseContent } from '../shared/content';
import { figureSvg } from '../shared/figures';
import { synergyHits } from '../shared/scoring';
import { OPTION_SHAPE, SHAPE_MARKUP } from '../shared/shapes';
import { OPTION_IDS, type OptionId, type PlayerView, type Role } from '../shared/types';

export type UiState = {
  /** 'joining' is the join form: before the first join, or opened again from the lobby to change the details. */
  status: 'connecting' | 'joining' | 'joined' | 'kicked' | 'offline';
  name: string;
  role: Role | null;
  table: string;
  /** What the room last refused, for example "already voted". Shown under the screen until the next view. */
  error?: string | null;
  /**
   * The room code, set while the room cannot be reached and this tab has never been in. The offline screen and the join
   * form then carry the unreachable note. The note does not print the code; it only tells one note from another.
   */
  unreachable?: string | null;
};

export type Actions = {
  join(name: string, role: Role, table: string): void;
  vote(option: OptionId): void;
  /** The lobby's Change button: open the join form again on the details this phone joined with. */
  change(): void;
};

/** What the handlers on a mounted screen call. A re-render swaps the actions in without rebuilding the handlers. */
type Ref = { actions: Actions };
type Kid = Node | string | false | null | undefined;
type Attrs = Record<string, string | true | undefined>;
type Built = { kind: string; node: HTMLElement };

function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...kids: Kid[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) {
    if (value !== undefined) el.setAttribute(name, value === true ? '' : value);
  }
  for (const kid of kids) {
    if (kid !== false && kid !== null && kid !== undefined) el.append(kid);
  }
  return el;
}

// Icons are drawn inline in one family: 24 px grid, 2 px stroke, round caps and joins. No icon font and no request.
// The four option shapes come from shared/shapes.ts, which the projector's badges draw from too. A class is shown by
// its pixel figure, not an icon: figure() below draws it from shared/figures.ts, the pixels the projector paints.
const GLYPHS = {
  ...SHAPE_MARKUP,
  check: '<path d="M5 12.5 10 17.5 19 7"/>',
  alert: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.5v.01"/>',
} as const;
type Glyph = keyof typeof GLYPHS;

const OPTION_GLYPH: Record<OptionId, Glyph> = OPTION_SHAPE;

function icon(glyph: Glyph): Element {
  const holder = document.createElement('div');
  // The markup is a constant from the table above; nothing from the room or the player goes through innerHTML.
  holder.innerHTML = `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${GLYPHS[glyph]}</svg>`;
  return holder.firstElementChild as Element;
}

/** The class figure for `role`, drawn `scale` CSS pixels to each of its pixels. */
function figure(role: Role, scale: number): Element {
  const holder = document.createElement('div');
  // The markup is built from the constant figure lists; the role only picks one of the four.
  holder.innerHTML = figureSvg(role, scale);
  return holder.firstElementChild as Element;
}

// ---- Text -------------------------------------------------------------------------------------------

const sentence = (text: string): string => {
  const t = text.trim();
  if (t === '') return '';
  const s = t.charAt(0).toUpperCase() + t.slice(1);
  return /[.!?]$/.test(s) ? s : `${s}.`;
};

const phoneLabel = (content: CaseContent, round: number, option: OptionId): string =>
  content.rounds[round]?.options.find((o) => o.id === option)?.phone ?? '';
const roundName = (view: PlayerView, content: CaseContent): string => `Round ${view.round + 1} of ${content.rounds.length}`;

/** "1:23" from the room's clock: the deadline minus the time the view said it was, minus the time since the view arrived. */
export function formatCountdown(deadline: number, serverNow: number, localNow: number, localAtServerNow: number): string {
  const remainingMs = deadline - serverNow - (localNow - localAtServerNow);
  // The m:ss of clockText in host/strikers.ts, copied: the phone page must not import host code.
  const seconds = Math.max(0, Math.ceil(remainingMs / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/** Rewrites the clock on the mounted vote screen in place, so a tick never rebuilds the buttons. */
export function updateCountdown(root: HTMLElement, view: PlayerView, localNow: number, localAtServerNow: number): void {
  const clock = root.querySelector('[data-countdown]');
  if (!clock || view.voteDeadline === null) return;
  const text = formatCountdown(view.voteDeadline, view.serverNow, localNow, localAtServerNow);
  if (clock.textContent !== text) clock.textContent = text;
}

// ---- Screens ----------------------------------------------------------------------------------------

function screen(kind: string, kids: Kid[], centered = false): HTMLElement {
  return h('section', { class: centered ? 'screen is-centered' : 'screen', 'data-screen': kind }, ...kids);
}

function field(id: string, label: string, input: HTMLInputElement): HTMLElement {
  return h('div', { class: 'field' }, h('label', { class: 'eyebrow', for: id }, label), h('div', { class: 'control' }, input));
}

function joinForm(content: CaseContent, ui: UiState, ref: Ref): HTMLElement {
  let chosen: Role | null = ui.role;
  const nickname = h('input', {
    id: 'nickname', name: 'nickname', type: 'text', maxlength: '16', required: true,
    autocomplete: 'off', autocapitalize: 'words', spellcheck: 'false', enterkeyhint: 'done',
  });
  nickname.value = ui.name;
  const table = h('input', {
    id: 'table', name: 'table', type: 'text', maxlength: '16', placeholder: 'Optional',
    autocomplete: 'off', autocapitalize: 'words', spellcheck: 'false', enterkeyhint: 'done',
  });
  table.value = ui.table;
  const submit = h('button', { type: 'submit', class: 'btn btn-accent btn-block' }, 'Join');

  const roleButtons = content.roles.map((r) =>
    h('button', { type: 'button', class: 'role', 'data-role': r.id, 'aria-pressed': String(r.id === chosen) },
      figure(r.id, 3), h('span', { class: 'role-name' }, r.className), h('span', { class: 'role-sub' }, r.stakeholder)));

  const refresh = (): void => {
    const ready = nickname.value.trim() !== '' && chosen !== null;
    submit.disabled = !ready;
  };
  roleButtons.forEach((button, i) => button.addEventListener('click', () => {
    chosen = content.roles[i].id;
    for (const other of roleButtons) other.setAttribute('aria-pressed', String(other === button));
    refresh();
  }));
  nickname.addEventListener('input', refresh);

  const form = h('form', { class: 'screen', 'data-screen': 'join', novalidate: true },
    h('header', {}, h('h1', { class: 'title is-lg' }, 'Join the game')),
    field('nickname', 'Name', nickname),
    h('div', { class: 'field', role: 'group', 'aria-labelledby': 'role-label' },
      h('span', { class: 'eyebrow', id: 'role-label' }, 'Role'),
      h('div', { class: 'roles' }, ...roleButtons)),
    field('table', 'Table', table),
    submit);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const who = nickname.value.trim();
    if (who === '' || chosen === null) return;
    submit.classList.add('is-loading');
    submit.setAttribute('aria-busy', 'true');
    submit.disabled = true;
    ref.actions.join(who, chosen, table.value.trim());
  });
  refresh();
  return form;
}

/**
 * Who you are while you wait, in the lobby and between rounds: your class figure, your name, your class and stakeholder,
 * and your table when you gave one. In the lobby a flat Change button under the card opens the join form again,
 * because roles are fixed only once the game has started.
 */
function waiting(view: PlayerView, content: CaseContent, ref: Ref): HTMLElement {
  const role = content.roles.find((r) => r.id === view.role);
  let change: HTMLElement | null = null;
  if (view.phase === 'lobby') {
    change = h('button', { type: 'button', class: 'btn btn-block', 'data-change': true, title: 'Change your name, role or table' }, 'Change');
    change.addEventListener('click', () => ref.actions.change());
  }
  return screen('waiting', [
    h('div', { class: 'card card-lifted' },
      h('span', { class: 'glyph' }, figure(view.role, 5)),
      h('h1', { class: 'title' }, view.name),
      h('p', { class: 'cap' }, role ? `${role.className}, ${role.stakeholder}` : view.role),
      view.table ? h('p', { class: 'cap' }, `Table: ${view.table}`) : null),
    change,
  ], true);
}

function roundRow(view: PlayerView, content: CaseContent, clock: boolean): HTMLElement {
  return h('div', { class: 'round-row' },
    h('span', { class: 'eyebrow' }, roundName(view, content)),
    // Left empty here: render() and updateCountdown() write the time, so the markup never depends on the clock.
    // With no clock the span stays, empty and hidden, so the row keeps its height and what sits under it does not move.
    clock && view.voteDeadline !== null
      ? h('span', { class: 'countdown', 'data-countdown': '', role: 'timer', 'aria-label': 'Time left' })
      : h('span', { class: 'countdown', 'aria-hidden': 'true' }));
}

/** How long the vote buttons stay greyed after a tap before they are handed back, if the room has said nothing. */
const SENT_MS = 4000;

function voteButtons(view: PlayerView, content: CaseContent, ref: Ref): HTMLElement {
  const group = h('div', { class: 'votes', role: 'group', 'aria-label': 'Your vote' });
  const buttons = OPTION_IDS.map((option) => {
    const button = h('button', { type: 'button', class: 'vote', 'data-option': option },
      h('span', { class: 'vote-letter' }, option), icon(OPTION_GLYPH[option]), h('span', { class: 'vote-label' }, phoneLabel(content, view.round, option)));
    button.addEventListener('click', () => {
      // One tap per screen. The other three grey out until the room answers with the locked view or an error.
      if (group.classList.contains('is-sent')) return;
      group.classList.add('is-sent');
      button.setAttribute('aria-pressed', 'true');
      for (const other of buttons) if (other !== button) other.disabled = true;
      ref.actions.vote(option);
      // A wait that nothing ends is a hang: if the room stays silent, give the buttons back so the tap can be repeated.
      setTimeout(() => {
        if (!group.isConnected) return;
        group.classList.remove('is-sent');
        for (const each of buttons) {
          each.disabled = false;
          each.removeAttribute('aria-pressed');
        }
      }, SENT_MS);
    });
    return button;
  });
  group.append(...buttons);
  return screen('vote', [
    roundRow(view, content, true),
    view.isLead ? h('p', { class: 'note' }, figure(view.role, 2), 'Your class leads this round') : null,
    group,
  ]);
}

function locked(view: PlayerView, content: CaseContent): HTMLElement {
  if (view.myVote === null) {
    return screen('skipped', [h('div', { class: 'card card-lifted' },
      h('h1', { class: 'title' }, 'You did not vote this round.'),
      h('p', { class: 'cap' }, 'Watch the screen.'))], true);
  }
  const open = view.phase === 'vote';
  // Top-aligned under the round row in both phases, so the card stays put when voting closes and the clock goes.
  return screen('locked', [
    roundRow(view, content, open),
    h('div', { class: 'card card-lifted' },
      h('span', { class: 'glyph' }, icon('check')),
      h('h1', { class: 'title' }, `Locked: ${view.myVote}. ${phoneLabel(content, view.round, view.myVote)}.`),
      h('p', { class: 'cap' }, open ? 'Waiting for the others.' : 'Voting is closed. Watch the screen.')),
  ]);
}

function calledOut(view: PlayerView, content: CaseContent): HTMLElement {
  const option = view.callout?.option ?? view.myVote;
  const text = option === null ? "You're up." : `You're up. Defend ${option}: ${phoneLabel(content, view.round, option)}.`;
  return screen('called', [h('div', { class: 'card card-lifted' }, h('h1', { class: 'title is-lg' }, text))], true);
}

function someoneCalled(view: PlayerView): HTMLElement {
  const { name, option } = view.callout ?? { name: null, option: null };
  const text = name !== null && option !== null ? `${name} is defending ${option}.` : 'Someone is defending their choice.';
  return screen('someone', [h('div', { class: 'card card-lifted' }, h('h1', { class: 'title' }, text))], true);
}

function stat(label: string, value: string, rest: string): HTMLElement {
  return h('p', { class: 'stat' }, h('span', { class: 'eyebrow' }, label), h('span', { class: 'stat-line' }, h('b', {}, value), ` ${rest}`));
}

function result(view: PlayerView, content: CaseContent): HTMLElement {
  const finalRound = view.round === content.rounds.length - 1;
  const mine = view.myVote;
  let detail: Kid[];
  if (mine === null) {
    detail = [h('p', {}, finalRound ? 'You did not vote in the final round.' : 'You did not vote this round.')];
  } else if (finalRound) {
    const hits = synergyHits(mine, view.majorities.slice(0, 3), content.synergy);
    detail = [h('p', {}, `Your pick ${mine} fits ${hits} of the three earlier decisions.`)];
  } else {
    const debrief = content.rounds[view.round]?.options.find((o) => o.id === mine)?.debrief ?? '';
    detail = [h('h2', { class: 'subtitle' }, `Why ${mine} scored what it did`), h('p', {}, debrief)];
  }
  return screen('result', [h('div', { class: 'card card-lifted' },
    h('span', { class: 'eyebrow' }, roundName(view, content)),
    h('h1', { class: 'hero' }, `+${view.lastPoints} `, h('span', { class: 'unit' }, 'this round')),
    h('div', { class: 'stats' }, stat('Score', String(view.score), 'total'), stat('Rank', String(view.rank), `of ${view.playerCount}`)),
    h('div', { class: 'card-sep' }),
    ...detail)]);
}

function ending(view: PlayerView, content: CaseContent): HTMLElement {
  const picks = content.rounds.map((_, i) => view.picks[i] ?? null);
  const final = picks[picks.length - 1];
  const earlier = picks.slice(0, -1);
  const coherence = final === null
    ? 'You did not vote in the final round.'
    : `Coherence: ${synergyHits(final, earlier, content.synergy)} of ${earlier.length}`;
  const rows = picks.map((pick, i) => h('li', { class: 'pick' },
    h('span', { class: 'pick-round' }, `Round ${i + 1}`),
    h('b', { class: 'pick-letter' }, pick ?? ''),
    h('span', { class: 'pick-label' }, pick === null ? 'No vote' : phoneLabel(content, i, pick))));
  return screen('ending', [h('div', { class: 'card card-lifted' },
    h('h1', { class: 'title' }, 'Your four picks'),
    h('ol', { class: 'picks' }, ...rows),
    h('div', { class: 'card-sep' }),
    h('p', {}, coherence),
    h('div', { class: 'stats' }, stat('Score', String(view.score), 'total'), stat('Rank', String(view.rank), `of ${view.playerCount}`)))]);
}

function kicked(): HTMLElement {
  return screen('kicked', [h('div', { class: 'card card-lifted' }, h('h1', { class: 'title' }, 'You were removed from the room.'))], true);
}

function waitingOn(kind: string, text: string): HTMLElement {
  return screen(kind, [h('div', { class: 'status', role: 'status' }, h('span', { class: 'wheel' }), text)], true);
}
const connecting = (): HTMLElement => waitingOn('connecting', 'Connecting…');

/**
 * "Can't reach this room. Scan the QR on the screen again." One sentence per line, with the space kept between them so
 * the text still reads as one. The code is not in the words; it rides on data-unreachable so syncUnreachable can tell
 * whether the form already carries this note.
 */
function unreachableNote(code: string): HTMLElement {
  return h('p', { class: 'cap', role: 'status', 'data-unreachable': code },
    h('span', { class: 'line' }, "Can't reach this room."), ' ', h('span', { class: 'line' }, 'Scan the QR on the screen again.'));
}

function offline(unreachable: string | null | undefined): HTMLElement {
  return screen('offline', [h('div', { class: 'status-stack' },
    h('div', { class: 'status', role: 'status' }, h('span', { class: 'wheel' }), 'Reconnecting…'),
    unreachable ? unreachableNote(unreachable) : null)], true);
}

/**
 * The join form is the one screen where a player may be half way through typing, so the unreachable note is added to and
 * removed from the live form instead of being part of its markup. Rebuilding the form would take the typing, and the keyboard, with it.
 */
function syncUnreachable(form: Element | null, code: string | null | undefined): void {
  if (!form) return;
  const line = [...form.children].find((el) => el.hasAttribute('data-unreachable'));
  if (line && line.getAttribute('data-unreachable') === code) return;
  line?.remove();
  if (code) form.append(unreachableNote(code));
}

// ---- Render -----------------------------------------------------------------------------------------

function choose(view: PlayerView | null, content: CaseContent, ui: UiState, ref: Ref): Built {
  if (ui.status === 'kicked') return { kind: 'kicked', node: kicked() };
  if (ui.status === 'offline') return { kind: 'offline', node: offline(ui.unreachable) };
  // The form also goes over the lobby's waiting screen when the player asks to change their details.
  if (ui.status === 'joining') return { kind: 'join', node: joinForm(content, ui, ref) };
  if (view === null) return { kind: 'connecting', node: connecting() };
  switch (view.phase) {
    case 'lobby':
    case 'travel':
      return { kind: 'waiting', node: waiting(view, content, ref) };
    case 'vote':
      return view.myVote === null ? { kind: 'vote', node: voteButtons(view, content, ref) } : { kind: 'locked', node: locked(view, content) };
    case 'locked':
      if (view.callout?.isMe) return { kind: 'called', node: calledOut(view, content) };
      if (view.callout) return { kind: 'someone', node: someoneCalled(view) };
      return { kind: 'locked', node: locked(view, content) };
    case 'reveal':
      return { kind: 'result', node: result(view, content) };
    case 'ending':
    case 'leaderboard':
      return { kind: 'ending', node: ending(view, content) };
  }
}

type Slot = { sig: string; kind: string; ref: Ref };
const slots = new WeakMap<HTMLElement, Slot>();

export function render(root: HTMLElement, view: PlayerView | null, content: CaseContent, ui: UiState, actions: Actions): void {
  let slot = slots.get(root);
  if (!slot) {
    slot = { sig: '', kind: '', ref: { actions } };
    slots.set(root, slot);
  }
  slot.ref.actions = actions;

  const { kind, node } = choose(view, content, ui, slot.ref);
  const message = ui.status === 'kicked' || ui.status === 'offline' ? '' : sentence(ui.error ?? '');
  if (message) node.append(h('p', { class: 'msg', role: 'alert' }, icon('alert'), message));

  // The join form keeps what the player is typing, so it is told apart by its error line alone, not by its markup.
  const sig = kind === 'join' ? `join|${message}` : node.outerHTML;
  if (sig !== slot.sig || root.firstElementChild === null) {
    root.replaceChildren(node);
    if (kind === 'called' && slot.kind !== 'called') navigator.vibrate?.(200);
    slot.sig = sig;
    slot.kind = kind;
  }
  if (view) updateCountdown(root, view, view.serverNow, view.serverNow);
  if (kind === 'join') syncUnreachable(root.firstElementChild, ui.unreachable);
}
