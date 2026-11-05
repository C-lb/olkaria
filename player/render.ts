// The phone page. Every screen is plain DOM built from the latest PlayerView, one function per screen, no framework.
// render() swaps the page only when a screen's markup actually changed: the room sends every phone a view after
// every vote, and replacing a button in the middle of a press would swallow the tap.
import { clockText } from '../shared/clock';
import type { CaseContent } from '../shared/content';
import { figureSvg } from '../shared/figures';
import { TEAMS } from '../shared/names';
import { OPTION_SHAPE, SHAPE_MARKUP } from '../shared/shapes';
import { OPTION_IDS, type OptionId, type PlayerView, type Role } from '../shared/types';

export type UiState = {
  /** 'joining' is the join form: before the first join, or opened again from the lobby to change the details. */
  status: 'connecting' | 'joining' | 'joined' | 'kicked' | 'offline';
  name: string;
  role: Role | null;
  /** The team, one of TEAMS. An empty string means none is chosen yet, and the form opens on its placeholder. */
  table: string;
  /** What the room last refused, for example "already voted". Shown under the screen until the next view. */
  error?: string | null;
  /**
   * The room code, set while the room cannot be reached and this tab has never been in. The offline screen and the join
   * form then carry the unreachable note. The code is not in the note's words; it rides on data-unreachable, so
   * syncUnreachable can tell whether the form already carries this note.
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
// The three option shapes come from shared/shapes.ts, which the projector's badges draw from too. A class is shown by
// its pixel figure, not an icon: figure() below draws it from shared/figures.ts, the pixels the projector paints.
const GLYPHS = {
  ...SHAPE_MARKUP,
  chevron: '<path d="M6 9.5 12 15.5 18 9.5"/>',
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

/** An option's full text. There are no short labels: every screen that names an option shows all of it. */
const optionText = (content: CaseContent, round: number, option: OptionId): string =>
  content.rounds[round]?.options.find((o) => o.id === option)?.text ?? '';
const questionName = (view: PlayerView, content: CaseContent): string => `Question ${view.round + 1} of ${content.rounds.length}`;
const roleName = (content: CaseContent, role: Role): string => content.roles.find((r) => r.id === role)?.name ?? role;

const LOOK = 'Look at the screen now.';

/** "1:23" from the room's clock: the deadline minus the time the view said it was, minus the time since the view arrived. */
export function formatCountdown(deadline: number, serverNow: number, localNow: number, localAtServerNow: number): string {
  const remainingMs = deadline - serverNow - (localNow - localAtServerNow);
  return clockText(Math.ceil(remainingMs / 1000));   // the projector's m:ss (shared/clock.ts), rounded up as it is
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

function field(id: string, label: string, ...control: Kid[]): HTMLElement {
  return h('div', { class: 'field' }, h('label', { class: 'eyebrow', for: id }, label), h('div', { class: 'control' }, ...control));
}

/** The team dropdown: a placeholder that cannot be picked again, then the eight teams. It opens on `team` when that is one of them. */
function teamPicker(team: string): HTMLSelectElement {
  const select = h('select', { id: 'team', name: 'team', required: true },
    h('option', { value: '', disabled: true, selected: true }, 'Choose your team'),
    ...TEAMS.map((t) => h('option', { value: t }, t)));
  // By index, because the placeholder is disabled and a value of '' cannot pick it.
  select.selectedIndex = TEAMS.indexOf(team) + 1;
  return select;
}

function joinForm(content: CaseContent, ui: UiState, ref: Ref): HTMLElement {
  let chosen: Role | null = ui.role;
  const nickname = h('input', {
    id: 'nickname', name: 'nickname', type: 'text', maxlength: '16', required: true,
    autocomplete: 'off', autocapitalize: 'words', spellcheck: 'false', enterkeyhint: 'done',
  });
  nickname.value = ui.name;
  const team = teamPicker(ui.table);
  const submit = h('button', { type: 'submit', class: 'btn btn-accent btn-block' }, 'Join');

  const roleButtons = content.roles.map((r) =>
    h('button', { type: 'button', class: 'role', 'data-role': r.id, 'aria-pressed': String(r.id === chosen) },
      figure(r.id, 3), h('span', { class: 'role-name' }, r.name)));

  const picked = (): string => (TEAMS.includes(team.value) ? team.value : '');
  const refresh = (): void => {
    const ready = nickname.value.trim() !== '' && chosen !== null && picked() !== '';
    submit.disabled = !ready;
  };
  roleButtons.forEach((button, i) => button.addEventListener('click', () => {
    chosen = content.roles[i].id;
    for (const other of roleButtons) other.setAttribute('aria-pressed', String(other === button));
    refresh();
  }));
  nickname.addEventListener('input', refresh);
  team.addEventListener('change', refresh);

  const form = h('form', { class: 'screen', 'data-screen': 'join', novalidate: true },
    h('header', {}, h('h1', { class: 'title is-lg' }, 'Join the game')),
    field('nickname', 'Name', nickname),
    h('div', { class: 'field', role: 'group', 'aria-labelledby': 'role-label' },
      h('span', { class: 'eyebrow', id: 'role-label' }, 'Role'),
      h('div', { class: 'roles' }, ...roleButtons)),
    // The chevron sits over the select's right edge and lets taps through, so the whole field opens the list.
    field('team', 'Team', team, icon('chevron')),
    submit);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const who = nickname.value.trim();
    const which = picked();
    if (who === '' || chosen === null || which === '') return;
    submit.classList.add('is-loading');
    submit.setAttribute('aria-busy', 'true');
    submit.disabled = true;
    ref.actions.join(who, chosen, which);
  });
  refresh();
  return form;
}

/**
 * Who you are while you wait, in the lobby and between questions: your class figure, your name, your role and your
 * team. In the lobby a flat Change button under the card opens the join form again, because roles are fixed only once
 * the game has started.
 */
function waiting(view: PlayerView, content: CaseContent, ref: Ref): HTMLElement {
  let change: HTMLElement | null = null;
  if (view.phase === 'lobby') {
    change = h('button', { type: 'button', class: 'btn btn-block', 'data-change': true, title: 'Change your name, role or team' }, 'Change');
    change.addEventListener('click', () => ref.actions.change());
  }
  return screen('waiting', [
    h('div', { class: 'card card-lifted' },
      h('span', { class: 'glyph' }, figure(view.role, 5)),
      h('h1', { class: 'title' }, view.name),
      h('p', { class: 'cap' }, roleName(content, view.role)),
      view.table ? h('p', { class: 'cap' }, view.table) : null),
    change,
  ], true);
}

function questionRow(view: PlayerView, content: CaseContent): HTMLElement {
  return h('div', { class: 'round-row' },
    h('span', { class: 'eyebrow' }, questionName(view, content)),
    // Left empty here: render() and updateCountdown() write the time, so the markup never depends on the clock.
    // With no clock the span stays, empty and hidden, so the row keeps its height and the question does not move.
    view.voteDeadline !== null
      ? h('span', { class: 'countdown', 'data-countdown': '', role: 'timer', 'aria-label': 'Time left' })
      : h('span', { class: 'countdown', 'aria-hidden': 'true' }));
}

/** How long the vote buttons stay greyed after a tap before they are handed back, if the room has said nothing. */
const SENT_MS = 4000;

/** The question and its three options, one full-width card each, so the full text wraps as long as it needs to. */
function voteButtons(view: PlayerView, content: CaseContent, ref: Ref): HTMLElement {
  const group = h('div', { class: 'votes', role: 'group', 'aria-label': 'Your vote' });
  const buttons = OPTION_IDS.map((option) => {
    const button = h('button', { type: 'button', class: 'vote', 'data-option': option },
      h('span', { class: 'vote-mark' }, h('span', { class: 'vote-letter' }, option), icon(OPTION_GLYPH[option])),
      h('span', { class: 'vote-label' }, optionText(content, view.round, option)));
    button.addEventListener('click', () => {
      // One tap per screen. The other two grey out until the room answers with the next view or an error.
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
    questionRow(view, content),
    h('h1', { class: 'title' }, content.rounds[view.round]?.question ?? ''),
    group,
  ]);
}

/**
 * After this phone has voted, and through the lock and the reveal: send the eyes to the projector, then say what was
 * picked. The same markup in all three phases, so the screen does not flicker when voting closes.
 */
function look(view: PlayerView, content: CaseContent): HTMLElement {
  const mine = view.myVote;
  return screen('look', [h('div', { class: 'card card-lifted' },
    h('h1', { class: 'title is-lg' }, LOOK),
    mine === null ? null : h('p', { class: 'subtitle' }, `You picked ${mine}.`),
    mine === null ? null : h('p', { class: 'cap look-text' }, optionText(content, view.round, mine)))], true);
}

function calledOut(view: PlayerView, content: CaseContent): HTMLElement {
  const option = view.callout?.option ?? view.myVote;
  return screen('called', [h('div', { class: 'card card-lifted' },
    h('h1', { class: 'title is-lg' }, option === null ? "You're up." : `You're up. Defend ${option}.`),
    option === null ? null : h('p', { class: 'look-text' }, optionText(content, view.round, option)))], true);
}

function someoneCalled(view: PlayerView): HTMLElement {
  const { name, option } = view.callout ?? { name: null, option: null };
  const text = name !== null && option !== null ? `${name} is defending ${option}.` : 'Someone is defending their choice.';
  return screen('someone', [h('div', { class: 'card card-lifted' }, h('h1', { class: 'title' }, text))], true);
}

/** The end of the game: the projector's congratulations, and this phone's own pick for every question, in full. */
function ending(view: PlayerView, content: CaseContent): HTMLElement {
  const rows = content.rounds.map((_, i) => {
    const pick = view.picks[i] ?? null;
    return h('li', { class: 'pick' },
      h('span', { class: 'pick-round' }, `Q${i + 1}`),
      h('b', { class: 'pick-letter' }, pick ?? ''),
      h('span', { class: pick === null ? 'pick-label is-empty' : 'pick-label' }, pick === null ? 'No vote' : optionText(content, i, pick)));
  });
  return screen('ending', [h('div', { class: 'card card-lifted' },
    h('h1', { class: 'title is-lg' }, content.ending.title),
    h('p', {}, LOOK),
    h('div', { class: 'card-sep' }),
    h('h2', { class: 'subtitle' }, 'Your five picks'),
    h('ol', { class: 'picks' }, ...rows))]);
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
      return view.myVote === null ? { kind: 'vote', node: voteButtons(view, content, ref) } : { kind: 'look', node: look(view, content) };
    case 'locked':
      if (view.callout?.isMe) return { kind: 'called', node: calledOut(view, content) };
      if (view.callout) return { kind: 'someone', node: someoneCalled(view) };
      return { kind: 'look', node: look(view, content) };
    case 'reveal':
      return { kind: 'look', node: look(view, content) };
    case 'ending':
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

  // The join form keeps what the player is typing and the team they chose, so it is told apart by its error line
  // alone, not by its markup.
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
