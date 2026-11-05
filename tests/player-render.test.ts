// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, it, expect, vi } from 'vitest';
import raw from '../content/case.json';
import { loadContent } from '../shared/content';
import { render, formatCountdown, updateCountdown } from '../player/render';
import { FIGURES, figureSvg } from '../shared/figures';
import { TEAMS } from '../shared/names';
import type { OptionId, Phase, PlayerView, Role } from '../shared/types';

const c = loadContent(raw);
const content = c;
const base: PlayerView = {
  phase: 'vote', round: 1, serverNow: 1000, voteDeadline: 121000, voteWindowMs: 120000,
  name: 'Ann', role: 'citizen', table: 'Team 3', myVote: null, playerCount: 12, picks: [], callout: null,
};
const joined = { status: 'joined' as const, name: 'Ann', role: 'citizen' as const, table: 'Team 3' };
const joining = { status: 'joining' as const, name: '', role: null, table: '' };
const noop = { join: vi.fn(), vote: vi.fn(), change: vi.fn() };
const actionsSpy = () => ({ join: vi.fn(), vote: vi.fn(), change: vi.fn() });
const mount = () => { const el = document.createElement('div'); document.body.appendChild(el); return el; };
const text = (round: number, option: OptionId) => c.rounds[round].options.find((o) => o.id === option)!.text;
const screenOf = (el: HTMLElement) => el.firstElementChild?.getAttribute('data-screen');
const lines = (el: HTMLElement, selector: string) => [...el.querySelectorAll(selector)].map((n) => n.textContent);

const nameInput = (el: HTMLElement) => el.querySelector('input[name=nickname]') as HTMLInputElement;
const teamSelect = (el: HTMLElement) => el.querySelector('select#team') as HTMLSelectElement;
const joinButton = (el: HTMLElement) => el.querySelector('button[type=submit]') as HTMLButtonElement;
const votes = (el: HTMLElement) => [...el.querySelectorAll('button[data-option]')] as HTMLButtonElement[];
const pickTeam = (el: HTMLElement, team: string) => { teamSelect(el).value = team; teamSelect(el).dispatchEvent(new Event('change')); };
const typeName = (el: HTMLElement, name: string) => { nameInput(el).value = name; nameInput(el).dispatchEvent(new Event('input')); };

/** The size figureSvg draws a role at a scale, read from its own markup, so the tests hold whatever the grid is. */
function figureSize(role: Role, scale: number): { width: string | null; height: string | null } {
  const holder = document.createElement('div');
  holder.innerHTML = figureSvg(role, scale);
  const svg = holder.firstElementChild!;
  return { width: svg.getAttribute('width'), height: svg.getAttribute('height') };
}

/** Everything the phone says in a phase, with and without a vote and with a call-out, for the no-points sweep. */
function renderText(phase: Phase): string {
  const el = mount();
  const views: PlayerView[] = [
    { ...base, phase, myVote: null },
    { ...base, phase, myVote: 'B', picks: [null, 'B'] },
    { ...base, phase, round: 4, myVote: 'C', picks: ['A', 'B', 'C', null, 'C'] },
    { ...base, phase, myVote: 'B', callout: { name: 'Ann', option: 'B', isMe: true } },
    { ...base, phase, myVote: 'A', callout: { name: 'Bo', option: 'B', isMe: false } },
  ];
  let all = '';
  for (const view of views) {
    render(el, view, c, joined, noop);
    all += `${el.textContent ?? ''}\n`;
  }
  el.remove();
  return all;
}

afterEach(() => {
  vi.useRealTimers();
  Reflect.deleteProperty(navigator, 'vibrate');
});

describe('the join form', () => {
  it('asks for a name, a role and a team, and joins only once all three are set', () => {
    const el = mount(); const actions = actionsSpy();
    render(el, null, c, joining, actions);
    const form = el.querySelector('form[data-screen=join]')!;
    expect(form.querySelector('h1')!.textContent).toBe('Join the game');
    expect(form.querySelector('label[for=nickname]')!.textContent).toBe('Name');
    expect(form.querySelector('#role-label')!.textContent).toBe('Role');
    expect(form.querySelector('label[for=team]')!.textContent).toBe('Team');
    expect(nameInput(el).maxLength).toBe(16);
    expect(form.querySelector('input[name=table]')).toBeNull();

    const roles = [...el.querySelectorAll('button[data-role]')] as HTMLButtonElement[];
    expect(roles.map((r) => r.getAttribute('data-role'))).toEqual(['citizen', 'government', 'business', 'microsoft']);
    expect(roles.map((r) => r.querySelector('.role-name')?.textContent)).toEqual(c.roles.map((r) => r.name));

    const options = [...teamSelect(el).options];
    expect(options).toHaveLength(9);
    expect(options[0].textContent).toBe('Choose your team');
    expect(options[0].disabled).toBe(true);
    expect(options[0].value).toBe('');
    expect(options.slice(1).map((o) => o.value)).toEqual([...TEAMS]);
    expect(options.slice(1).map((o) => o.textContent)).toEqual([...TEAMS]);
    expect(teamSelect(el).value).toBe('');

    expect(joinButton(el).disabled).toBe(true);
    typeName(el, 'Sarah');
    expect(joinButton(el).disabled).toBe(true);
    roles[1].click();
    expect(joinButton(el).disabled).toBe(true);   // name and role, still no team
    pickTeam(el, 'Team 5');
    expect(joinButton(el).disabled).toBe(false);
    joinButton(el).click();
    expect(actions.join).toHaveBeenCalledWith('Sarah', 'government', 'Team 5');
  });

  it('never joins without a team, even when the form is submitted by hand', () => {
    const el = mount(); const actions = actionsSpy();
    render(el, null, c, joining, actions);
    typeName(el, 'Mo');
    (el.querySelector('button[data-role=citizen]') as HTMLButtonElement).click();
    el.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    expect(actions.join).not.toHaveBeenCalled();
  });

  it('prefills saved details, team included, and keeps what is typed and chosen when drawn again', () => {
    const el = mount();
    render(el, null, c, { status: 'joining', name: 'Zed', role: 'business', table: 'Team 8' }, noop);
    expect(nameInput(el).value).toBe('Zed');
    expect(teamSelect(el).value).toBe('Team 8');
    expect(lines(el, 'button[aria-pressed=true]')).toHaveLength(1);
    expect(el.querySelector('button[aria-pressed=true]')!.getAttribute('data-role')).toBe('business');
    expect(joinButton(el).disabled).toBe(false);

    const typing = mount();
    render(typing, null, c, joining, noop);
    const input = nameInput(typing);
    const select = teamSelect(typing);
    typeName(typing, 'Mo');
    pickTeam(typing, 'Team 2');
    render(typing, null, c, joining, noop);
    expect(nameInput(typing)).toBe(input);
    expect(teamSelect(typing)).toBe(select);
    expect(input.value).toBe('Mo');
    expect(select.value).toBe('Team 2');
  });

  it('opens on the placeholder when the saved team is not one of the eight', () => {
    const el = mount();
    render(el, null, c, { status: 'joining', name: 'Zed', role: 'business', table: 'Front row' }, noop);
    expect(teamSelect(el).value).toBe('');
    expect(joinButton(el).disabled).toBe(true);
  });

  it('sends a trimmed name, shows the loader, and never joins with a blank name', () => {
    const el = mount(); const actions = actionsSpy();
    render(el, null, c, joining, actions);
    typeName(el, '   ');
    (el.querySelector('button[data-role=citizen]') as HTMLButtonElement).click();
    pickTeam(el, 'Team 1');
    expect(joinButton(el).disabled).toBe(true);
    el.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    expect(actions.join).not.toHaveBeenCalled();
    typeName(el, '  Mo ');
    joinButton(el).click();
    expect(actions.join).toHaveBeenCalledWith('Mo', 'citizen', 'Team 1');
    expect(joinButton(el).classList.contains('is-loading')).toBe(true);
    expect(joinButton(el).disabled).toBe(true);
  });

  it('keeps the form and its loader when the saved details arrive after Join is pressed', () => {
    const el = mount(); const actions = actionsSpy();
    render(el, null, c, joining, actions);
    typeName(el, 'Mo');
    (el.querySelector('button[data-role=citizen]') as HTMLButtonElement).click();
    pickTeam(el, 'Team 4');
    joinButton(el).click();
    const form = el.querySelector('form');
    render(el, null, c, { status: 'joining', name: 'Mo', role: 'citizen', table: 'Team 4' }, actions);
    expect(el.querySelector('form')).toBe(form);
    expect(joinButton(el).classList.contains('is-loading')).toBe(true);
  });

  it('reads a full room as a plain sentence', () => {
    const el = mount();
    render(el, null, c, { status: 'joining', name: 'Mo', role: 'citizen', table: 'Team 1', error: 'room full' }, noop);
    expect(el.querySelector('form [role=alert]')?.textContent).toBe('This room is full.');
  });

  it('shows a refused join as a line under the form, with the form ready to send again', () => {
    const el = mount();
    render(el, null, c, { status: 'joining', name: 'Mo', role: 'citizen', table: '', error: 'bad team' }, noop);
    expect(screenOf(el)).toBe('join');
    expect(el.querySelector('form [role=alert]')?.textContent).toBe('Bad team.');
    expect(el.querySelector('.is-loading')).toBeNull();
    expect(nameInput(el).value).toBe('Mo');
    expect(teamSelect(el).value).toBe('');
  });
});

describe('one screen per row of the table', () => {
  it('lobby and travel: the waiting card is the figure, the name, the role name and the team; Change in the lobby only', () => {
    const el = mount(); const actions = actionsSpy();
    render(el, { ...base, phase: 'lobby', round: -1, role: 'government' }, c, joined, actions);
    expect(screenOf(el)).toBe('waiting');
    const card = el.querySelector('[data-screen=waiting] .card')!;
    const size = figureSize('government', 5);
    const hero = card.querySelector('svg.figure')!;
    expect(hero.getAttribute('data-role')).toBe('government');
    expect([hero.getAttribute('width'), hero.getAttribute('height')]).toEqual([size.width, size.height]);
    expect(card.querySelector('h1')!.textContent).toBe('Ann');
    expect(lines(card as HTMLElement, 'p.cap')).toEqual(['Government', 'Team 3']);
    const change = el.querySelector('button[data-change]') as HTMLButtonElement;
    expect(change.textContent).toBe('Change');
    expect(change.classList.contains('btn-accent')).toBe(false);   // flat: the accent belongs to Join
    change.click();
    expect(actions.change).toHaveBeenCalledTimes(1);

    render(el, { ...base, phase: 'travel', role: 'microsoft' }, c, joined, actions);
    expect(screenOf(el)).toBe('waiting');
    expect(lines(el, '[data-screen=waiting] .card p.cap')).toEqual(['Satya Nadella', 'Team 3']);
    expect(el.querySelector('button[data-change]')).toBeNull();
  });

  it('vote, no vote yet: Question N of 5, the clock, the question, and three buttons with letter, shape and full text', () => {
    const el = mount(); const actions = actionsSpy();
    render(el, base, c, joined, actions);
    const root = el;
    expect(screenOf(el)).toBe('vote');
    expect(el.querySelector('.eyebrow')?.textContent).toBe(`Question 2 of ${c.rounds.length}`);
    expect(el.textContent).toContain('Question 2 of 5');
    expect(el.querySelector('[data-countdown]')?.textContent).toBe('2:00');
    // vote: the three buttons carry the full option text and the question is on screen
    expect(root.querySelector('h1')?.textContent).toBe(content.rounds[1].question);
    expect([...root.querySelectorAll('.vote')].map((b) => b.querySelector('.vote-label')?.textContent)).toEqual(content.rounds[1].options.map((o) => o.text));
    const buttons = votes(el);
    expect(buttons.map((b) => b.getAttribute('data-option'))).toEqual(['A', 'B', 'C']);
    expect(buttons.map((b) => b.querySelector('.vote-letter')?.textContent)).toEqual(['A', 'B', 'C']);
    expect(buttons.every((b) => b.querySelector('svg.ico') !== null)).toBe(true);
    buttons[1].click();
    expect(actions.vote).toHaveBeenCalledWith('B');
  });

  it('vote with a vote, and locked or reveal with one and no call-out: look at the screen, what you picked, its text', () => {
    const el = mount();
    for (const phase of ['vote', 'locked', 'reveal'] as const) {
      render(el, { ...base, phase, myVote: 'B' }, c, joined, noop);
      expect(screenOf(el), phase).toBe('look');
      expect(el.querySelector('h1')?.textContent).toBe('Look at the screen now.');
      const after = [...el.querySelector('h1')!.parentElement!.children].slice(1).map((n) => n.textContent);
      expect(after).toEqual(['You picked B.', text(1, 'B')]);
      expect(el.querySelector('[data-countdown]')).toBeNull();
      expect(votes(el)).toHaveLength(0);
    }
    // the option's text is in smaller type than the line above it
    expect(el.querySelector('.look-text')?.classList.contains('cap')).toBe(true);
  });

  it('locked or reveal without a vote: look at the screen, and nothing else', () => {
    const el = mount();
    for (const phase of ['locked', 'reveal'] as const) {
      render(el, { ...base, phase }, c, joined, noop);
      expect(screenOf(el), phase).toBe('look');
      expect(el.querySelector('h1')?.textContent).toBe('Look at the screen now.');
      expect(el.querySelector('section')!.textContent).toBe('Look at the screen now.');
    }
  });

  it('locked, the call-out is me: You are up, defend the letter, over its text, and a buzz', () => {
    const vibrate = vi.fn();
    Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true });
    const el = mount();
    render(el, { ...base, phase: 'locked', myVote: 'B', callout: { name: 'Ann', option: 'B', isMe: true } }, c, joined, noop);
    expect(screenOf(el)).toBe('called');
    expect(el.querySelector('h1')?.textContent).toBe("You're up. Defend B.");
    expect(el.querySelector('h1 + p')?.textContent).toBe(text(1, 'B'));
    expect(vibrate).toHaveBeenCalledWith(200);
  });

  it('locked, the call-out is someone else: who is defending which letter', () => {
    const el = mount();
    render(el, { ...base, phase: 'locked', myVote: 'A', callout: { name: 'Ann', option: 'B', isMe: false } }, c, { ...joined, name: 'Cy' }, noop);
    expect(screenOf(el)).toBe('someone');
    expect(el.querySelector('h1')?.textContent).toBe('Ann is defending B.');
  });

  it('ending: the congratulations, look at the screen, and your five picks with their full text or No vote', () => {
    const el = mount();
    render(el, { ...base, phase: 'ending', round: 4, picks: ['A', null, 'C', 'B', 'C'] }, c, joined, noop);
    expect(screenOf(el)).toBe('ending');
    expect(el.querySelector('h1')?.textContent).toBe(c.ending.title);
    expect(el.querySelector('h1')?.textContent).toBe('Congratulations!');
    expect(el.querySelector('h1 + p')?.textContent).toBe('Look at the screen now.');
    expect(el.querySelector('h2')?.textContent).toBe('Your five picks');
    const rows = [...el.querySelectorAll('.pick')];
    expect(rows).toHaveLength(5);
    expect(rows.map((r) => [r.querySelector('.pick-round')?.textContent, r.querySelector('.pick-letter')?.textContent, r.querySelector('.pick-label')?.textContent])).toEqual([
      ['Q1', 'A', text(0, 'A')],
      ['Q2', '', 'No vote'],
      ['Q3', 'C', text(2, 'C')],
      ['Q4', 'B', text(3, 'B')],
      ['Q5', 'C', text(4, 'C')],
    ]);
  });
});

describe('no points, no short labels', () => {
  it('says nothing about points on any screen of any phase', () => {
    // nothing about points on any screen of any phase
    for (const phase of ['lobby', 'travel', 'vote', 'locked', 'reveal', 'ending'] as const)
      expect(renderText(phase)).not.toMatch(/point|score|rank|\+\d/i);
  });

  it('shows no number but a question number, the clock, a team, or an option text', () => {
    const allowed = [/Question \d of \d/g, /\d:\d\d/g, /Team \d/g, /Q\d/g];
    for (const phase of ['lobby', 'travel', 'vote', 'locked', 'reveal', 'ending'] as const) {
      let left = renderText(phase);
      for (const round of c.rounds) for (const piece of [round.question, ...round.options.map((o) => o.text)]) left = left.split(piece).join('');
      for (const re of allowed) left = left.replace(re, '');
      expect(left, phase).not.toMatch(/\d/);
    }
  });

  it('the .vote-label rule in styles.css has no line-clamp and no nowrap', () => {
    // styles.css: the .vote-label rule has no line-clamp and no nowrap
    const css = readFileSync(resolve(process.cwd(), 'player/styles.css'), 'utf8');
    const rules = [...css.matchAll(/([^{}]*\.vote-label[^{}]*)\{([^}]*)\}/g)];
    expect(rules.length).toBeGreaterThan(0);
    for (const [, , body] of rules) {
      expect(body).not.toMatch(/line-clamp/);
      expect(body).not.toMatch(/nowrap/);
      expect(body).not.toMatch(/ellipsis/);
    }
  });
});

describe('vote buttons', () => {
  it('are not swapped out by a view that differs only in the clock, and the clock is written in place', () => {
    const el = mount(); const first = actionsSpy(); const second = actionsSpy();
    render(el, base, c, joined, first);
    const before = votes(el);
    const clock = el.querySelector('[data-countdown]') as HTMLElement;
    expect(clock.textContent).toBe('2:00');
    updateCountdown(el, base, 6000, 1000);
    expect(clock.textContent).toBe('1:55');
    render(el, { ...base, serverNow: 9000, playerCount: 13 }, c, joined, second);
    expect(votes(el).every((b, i) => b === before[i])).toBe(true);
    expect(el.querySelector('[data-countdown]')).toBe(clock);
    expect(clock.textContent).toBe('1:52');
    before[0].click();
    expect(first.vote).not.toHaveBeenCalled();
    expect(second.vote).toHaveBeenCalledWith('A');
  });

  it('grey out the other options after a tap, take one tap, and come back after 4 s if the room stays silent', () => {
    vi.useFakeTimers();
    const el = mount(); const actions = actionsSpy();
    render(el, base, c, joined, actions);
    const [a, b, cc] = votes(el);
    b.click();
    expect([a, b, cc].map((x) => x.disabled)).toEqual([true, false, true]);
    expect(b.getAttribute('aria-pressed')).toBe('true');
    b.click();
    expect(actions.vote).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(3999);
    expect(a.disabled).toBe(true);
    vi.advanceTimersByTime(1);
    expect([a, b, cc].map((x) => x.disabled)).toEqual([false, false, false]);
    expect(b.hasAttribute('aria-pressed')).toBe(false);
    b.click();
    expect(actions.vote).toHaveBeenCalledTimes(2);
  });

  it('the look screen does not change when voting closes, so it does not flicker', () => {
    const el = mount();
    render(el, { ...base, myVote: 'B' }, c, joined, noop);
    const section = el.querySelector('section');
    render(el, { ...base, phase: 'locked', myVote: 'B', voteDeadline: null }, c, joined, noop);
    expect(el.querySelector('section')).toBe(section);
  });
});

describe('the other screens', () => {
  it('format the countdown from server time, never negative', () => {
    expect(formatCountdown(31000, 1000, 5000, 1000)).toBe('0:26');
    expect(formatCountdown(31000, 1000, 99000, 1000)).toBe('0:00');
    expect(formatCountdown(121000, 1000, 1000, 1000)).toBe('2:00');
    expect(formatCountdown(121000, 1000, 1500, 1000)).toBe('2:00');
    expect(formatCountdown(121000, 1000, 61500, 1000)).toBe('1:00');
  });

  it('reopen the join form over the lobby, filled in with the details given, and send a join from it', () => {
    const el = mount(); const actions = actionsSpy();
    const lobbyView: PlayerView = { ...base, phase: 'lobby', round: -1 };
    render(el, lobbyView, c, joined, actions);
    render(el, lobbyView, c, { status: 'joining', name: 'Ann', role: 'citizen', table: 'Team 3' }, actions);
    expect(el.querySelector('[data-screen=waiting]')).toBeNull();
    expect(nameInput(el).value).toBe('Ann');
    expect(teamSelect(el).value).toBe('Team 3');
    expect(joinButton(el).disabled).toBe(false);
    (el.querySelector('button[data-role=business]') as HTMLButtonElement).click();
    joinButton(el).click();
    expect(actions.join).toHaveBeenCalledWith('Ann', 'business', 'Team 3');
  });

  it('say so when nobody is named in the call-out', () => {
    const el = mount();
    render(el, { ...base, phase: 'locked', callout: { name: null, option: null, isMe: false } }, c, joined, noop);
    expect(el.textContent).toContain('Someone is defending their choice.');
  });

  it('show a server error as one sentence under the screen, and never on the removed screen', () => {
    const el = mount();
    render(el, base, c, { ...joined, error: 'already voted' }, noop);
    expect(el.querySelectorAll('[role=alert]')).toHaveLength(1);
    expect(el.querySelector('[role=alert]')?.textContent).toBe('Already voted.');
    render(el, base, c, joined, noop);
    expect(el.querySelector('[role=alert]')).toBeNull();
    render(el, null, c, { status: 'kicked', name: 'Ann', role: 'citizen', table: '', error: 'removed' }, noop);
    expect(el.querySelector('[role=alert]')).toBeNull();
    expect(el.textContent).toMatch(/removed/i);
  });

  it('say when the connection is coming or going', () => {
    const el = mount();
    render(el, null, c, { ...joining, status: 'connecting' }, noop);
    expect(el.textContent).toContain('Connecting…');
    render(el, null, c, { ...joining, status: 'joined' }, noop);
    expect(el.textContent).toContain('Connecting…');
    render(el, base, c, { ...joined, status: 'offline' }, noop);
    expect(el.textContent).toContain('Reconnecting…');
    expect(el.querySelectorAll('button')).toHaveLength(0);
  });

  it('say the room cannot be reached on the offline screen and the join form, one sentence a line, with no code', () => {
    const el = mount();
    render(el, null, c, { ...joining, status: 'offline' }, noop);
    expect(el.textContent).not.toContain("Can't reach");
    render(el, null, c, { ...joining, status: 'offline', unreachable: 'KFBN' }, noop);
    expect(el.textContent).toContain("Can't reach this room. Scan the QR on the screen again.");
    expect(el.textContent).not.toContain('KFBN');
    render(el, null, c, { ...joining, status: 'connecting', unreachable: 'KFBN' }, noop);
    expect(el.textContent).not.toContain("Can't reach");
    render(el, null, c, { ...joining, unreachable: 'ABCD' }, noop);
    expect(el.querySelectorAll('[data-unreachable] span.line')).toHaveLength(2);
  });

  it('add and remove the unreachable line under the join form without rebuilding what the player is typing', () => {
    const el = mount();
    render(el, null, c, joining, noop);
    const form = el.querySelector('form')!;
    typeName(el, 'Mo');
    (el.querySelector('button[data-role=citizen]') as HTMLButtonElement).click();
    pickTeam(el, 'Team 6');
    render(el, null, c, { ...joining, unreachable: 'KFBN' }, noop);
    expect(el.querySelector('form')).toBe(form);
    expect(nameInput(el).value).toBe('Mo');
    expect(teamSelect(el).value).toBe('Team 6');
    expect(joinButton(el).disabled).toBe(false);
    expect(form.textContent).toContain("Can't reach this room. Scan the QR on the screen again.");
    render(el, null, c, { ...joining, unreachable: 'KFBN' }, noop);
    expect(form.querySelectorAll('[data-unreachable]')).toHaveLength(1);
    render(el, null, c, joining, noop);
    expect(form.textContent).not.toContain("Can't reach");
    expect(el.querySelector('form')).toBe(form);
  });

  it('buzz once per call-out and again only after the screen has changed', () => {
    const vibrate = vi.fn();
    Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true });
    const el = mount();
    const calledView: PlayerView = { ...base, phase: 'locked', myVote: 'B', callout: { name: 'Ann', option: 'B', isMe: true } };
    render(el, calledView, c, joined, noop);
    render(el, { ...calledView, serverNow: 2000 }, c, joined, noop);
    render(el, calledView, c, { ...joined, error: 'wrong round' }, noop);
    expect(vibrate).toHaveBeenCalledTimes(1);
    render(el, { ...base, phase: 'reveal' }, c, joined, noop);
    render(el, calledView, c, joined, noop);
    expect(vibrate).toHaveBeenCalledTimes(2);
  });

  it('use no em dash or en dash anywhere in the copy', () => {
    const el = mount();
    const dashes = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`);
    for (const phase of ['lobby', 'travel', 'vote', 'locked', 'reveal', 'ending'] as const) expect(renderText(phase)).not.toMatch(dashes);
    for (const ui of [joining, { ...joining, status: 'connecting' as const }, { ...joining, status: 'kicked' as const }, { ...joining, status: 'offline' as const, unreachable: 'ABCD' }]) {
      render(el, null, c, { ...ui, error: 'bad phase' }, noop);
      expect(el.textContent).not.toMatch(dashes);
    }
  });

  it('draw the class figures from the shared figures at their own size', () => {
    const el = mount();
    render(el, null, c, joining, noop);
    const roles = [...el.querySelectorAll('button[data-role]')];
    expect(roles.map((r) => r.querySelector('svg.figure')?.getAttribute('data-role'))).toEqual(['citizen', 'government', 'business', 'microsoft']);
    expect(roles[0].querySelector('svg.figure')?.getAttribute('width')).toBe(figureSize('citizen', 3).width);
    expect(roles[0].querySelectorAll('svg.figure rect')).toHaveLength(FIGURES.citizen.length);
  });
});
