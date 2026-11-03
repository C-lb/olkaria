// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import raw from '../content/case.json';
import { loadContent } from '../shared/content';
import { render, formatCountdown } from '../player/render';
import type { PlayerView } from '../shared/types';
const c = loadContent(raw);
const base: PlayerView = { phase: 'vote', round: 0, serverNow: 1000, voteDeadline: 31000, voteWindowMs: 30000, name: 'Ann', role: 'citizen', table: null, lead: 'citizen', isLead: true, myVote: null, lastPoints: 0, score: 0, rank: 1, playerCount: 12, tally: null, leadTally: null, supportTally: null, majorities: [], picks: [], callout: null };
const joined = { status: 'joined' as const, name: 'Ann', role: 'citizen' as const, table: '' };
const noop = { join: vi.fn(), vote: vi.fn(), change: vi.fn() };
const mount = () => { const el = document.createElement('div'); document.body.appendChild(el); return el; };

describe('player render', () => {
  it('requires a name and a role before joining', () => {
    const el = mount(); const actions = { join: vi.fn(), vote: vi.fn(), change: vi.fn() };
    render(el, null, c, { status: 'joining', name: '', role: null, table: '' }, actions);
    const input = el.querySelector('input[name=nickname]') as HTMLInputElement;
    const roles = [...el.querySelectorAll('button[data-role]')];
    const button = el.querySelector('button[type=submit]') as HTMLButtonElement;
    expect(input.maxLength).toBe(16);
    expect(roles.map(r => r.getAttribute('data-role'))).toEqual(['citizen', 'government', 'business', 'microsoft']);
    expect(roles[1].textContent).toContain('Knight'); expect(roles[1].textContent).toContain('Kenyan Government');
    expect((el.querySelector('input[name=table]') as HTMLInputElement).maxLength).toBe(16);
    expect(button.disabled).toBe(true);
    input.value = 'Sarah'; input.dispatchEvent(new Event('input'));
    expect(button.disabled).toBe(true);
    (roles[1] as HTMLButtonElement).click();
    expect(button.disabled).toBe(false);
    button.click();
    expect(actions.join).toHaveBeenCalledWith('Sarah', 'government', '');
  });
  it('renders four vote buttons with phone labels, says when your class leads, and sends a vote', () => {
    const el = mount(); const actions = { join: vi.fn(), vote: vi.fn(), change: vi.fn() };
    render(el, base, c, joined, actions);
    const buttons = [...el.querySelectorAll('button[data-option]')];
    expect(buttons.map(b => b.getAttribute('data-option'))).toEqual(['A', 'B', 'C', 'D']);
    expect(buttons[1].textContent).toContain('Yes to 60 to 100 MW, tied');
    expect(el.textContent).toContain('Your class leads this round');
    (buttons[1] as HTMLButtonElement).click();
    expect(actions.vote).toHaveBeenCalledWith('B');
    render(el, { ...base, isLead: false }, c, joined, actions);
    expect(el.textContent).not.toContain('Your class leads this round');
  });
  it('shows the locked state, the call-out, and the result with the full debrief', () => {
    const el = mount();
    render(el, { ...base, myVote: 'B' }, c, joined, noop);
    expect(el.textContent).toContain('Locked'); expect(el.querySelectorAll('button[data-option]')).toHaveLength(0);
    render(el, { ...base, phase: 'locked', myVote: 'B', callout: { name: 'Ann', option: 'B', isMe: true } }, c, joined, noop);
    expect(el.textContent).toMatch(/You're up/); expect(el.textContent).toContain('Yes to 60 to 100 MW, tied');
    render(el, { ...base, phase: 'locked', myVote: 'A', callout: { name: 'Ann', option: 'B', isMe: false } }, c, { ...joined, name: 'Cy' }, noop);
    expect(el.textContent).toContain('Ann is defending B');
    render(el, { ...base, phase: 'reveal', myVote: 'B', picks: ['B'], lastPoints: 106, score: 106, rank: 3, tally: { A: 1, B: 9, C: 1, D: 1 } }, c, joined, noop);
    expect(el.textContent).toContain('106'); expect(el.textContent).toMatch(/3(rd)? of 12/);
    expect(el.textContent).toContain(c.rounds[0].options[1].debrief.slice(0, 40));
  });
  it('summarises the four picks at the end and tells a kicked player plainly', () => {
    const el = mount();
    render(el, { ...base, phase: 'ending', round: 3, picks: ['B', 'C', 'B', 'B'], majorities: ['B', 'C', 'B', 'B'], score: 400, rank: 2 }, c, joined, noop);
    expect(el.textContent).toMatch(/B.*C.*B.*B/s); expect(el.textContent).toMatch(/3 of 3/);
    render(el, null, c, { status: 'kicked', name: 'Ann', role: 'citizen', table: '' }, noop);
    expect(el.textContent).toMatch(/removed/i);
  });
});
it('formats the countdown from server time, never negative', () => {
  expect(formatCountdown(31000, 1000, 5000, 1000)).toBe('0:26');
  expect(formatCountdown(31000, 1000, 99000, 1000)).toBe('0:00');
  expect(formatCountdown(121000, 1000, 1000, 1000)).toBe('2:00');
  expect(formatCountdown(121000, 1000, 1500, 1000)).toBe('2:00');
  expect(formatCountdown(121000, 1000, 61500, 1000)).toBe('1:00');
});

// ---- Beyond the brief: the behaviours the page relies on that the four tests above do not pin ----------
import { afterEach } from 'vitest';
import { updateCountdown } from '../player/render';

afterEach(() => {
  vi.useRealTimers();
  Reflect.deleteProperty(navigator, 'vibrate');
});

const joining = { status: 'joining' as const, name: '', role: null, table: '' };
const calledView: PlayerView = { ...base, phase: 'locked', myVote: 'B', callout: { name: 'Ann', option: 'B', isMe: true } };
const nameInput = (el: HTMLElement) => el.querySelector('input[name=nickname]') as HTMLInputElement;
const tableInput = (el: HTMLElement) => el.querySelector('input[name=table]') as HTMLInputElement;
const joinButton = (el: HTMLElement) => el.querySelector('button[type=submit]') as HTMLButtonElement;
const votes = (el: HTMLElement) => [...el.querySelectorAll('button[data-option]')] as HTMLButtonElement[];

describe('join form details', () => {
  it('prefills saved details, enables Join, and keeps what is typed when drawn again', () => {
    const el = mount();
    render(el, null, c, { status: 'joining', name: 'Zed', role: 'business', table: 'T9' }, noop);
    expect(nameInput(el).value).toBe('Zed');
    expect(tableInput(el).value).toBe('T9');
    expect([...el.querySelectorAll('button[aria-pressed=true]')].map(b => b.getAttribute('data-role'))).toEqual(['business']);
    expect(joinButton(el).disabled).toBe(false);

    const typing = mount();
    render(typing, null, c, joining, noop);
    const input = nameInput(typing);
    input.value = 'Mo'; input.dispatchEvent(new Event('input'));
    render(typing, null, c, joining, noop);
    expect(nameInput(typing)).toBe(input);
    expect(input.value).toBe('Mo');
  });
  it('keeps the form and its loader when the saved details arrive after Join is pressed', () => {
    const el = mount(); const actions = { join: vi.fn(), vote: vi.fn(), change: vi.fn() };
    render(el, null, c, joining, actions);
    nameInput(el).value = 'Mo'; nameInput(el).dispatchEvent(new Event('input'));
    (el.querySelector('button[data-role=citizen]') as HTMLButtonElement).click();
    joinButton(el).click();
    const form = el.querySelector('form');
    render(el, null, c, { status: 'joining', name: 'Mo', role: 'citizen', table: '' }, actions);
    expect(el.querySelector('form')).toBe(form);
    expect(joinButton(el).classList.contains('is-loading')).toBe(true);
  });
  it('sends trimmed details, shows the loader, and never joins with a blank name', () => {
    const el = mount(); const actions = { join: vi.fn(), vote: vi.fn(), change: vi.fn() };
    render(el, null, c, joining, actions);
    nameInput(el).value = '   '; nameInput(el).dispatchEvent(new Event('input'));
    (el.querySelector('button[data-role=citizen]') as HTMLButtonElement).click();
    expect(joinButton(el).disabled).toBe(true);
    el.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    expect(actions.join).not.toHaveBeenCalled();

    nameInput(el).value = '  Mo '; nameInput(el).dispatchEvent(new Event('input'));
    tableInput(el).value = ' Red ';
    joinButton(el).click();
    expect(actions.join).toHaveBeenCalledWith('Mo', 'citizen', 'Red');
    expect(joinButton(el).classList.contains('is-loading')).toBe(true);
    expect(joinButton(el).disabled).toBe(true);
  });
});

describe('vote buttons', () => {
  it('are not swapped out by a view that differs only in the clock, and the clock is written in place', () => {
    const el = mount(); const first = { join: vi.fn(), vote: vi.fn(), change: vi.fn() }; const second = { join: vi.fn(), vote: vi.fn(), change: vi.fn() };
    render(el, base, c, joined, first);
    const before = votes(el);
    const clock = el.querySelector('[data-countdown]') as HTMLElement;
    expect(clock.textContent).toBe('0:30');
    updateCountdown(el, base, 6000, 1000);
    expect(clock.textContent).toBe('0:25');
    render(el, { ...base, serverNow: 9000, playerCount: 13 }, c, joined, second);
    expect(votes(el).every((b, i) => b === before[i])).toBe(true);
    expect(el.querySelector('[data-countdown]')).toBe(clock);
    expect(clock.textContent).toBe('0:22');
    before[0].click();
    expect(first.vote).not.toHaveBeenCalled();
    expect(second.vote).toHaveBeenCalledWith('A');
  });
  it('grey out the other options after a tap, take one tap, and come back if the room stays silent', () => {
    vi.useFakeTimers();
    const el = mount(); const actions = { join: vi.fn(), vote: vi.fn(), change: vi.fn() };
    render(el, base, c, joined, actions);
    const [a, b, cc, d] = votes(el);
    b.click();
    expect([a, b, cc, d].map(x => x.disabled)).toEqual([true, false, true, true]);
    expect(b.getAttribute('aria-pressed')).toBe('true');
    b.click();
    expect(actions.vote).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(4000);
    expect([a, b, cc, d].map(x => x.disabled)).toEqual([false, false, false, false]);
    expect(b.hasAttribute('aria-pressed')).toBe(false);
    b.click();
    expect(actions.vote).toHaveBeenCalledTimes(2);
  });
  it('show the countdown to a player who has locked in, and not once voting has closed', () => {
    const el = mount();
    render(el, { ...base, myVote: 'B' }, c, joined, noop);
    expect(el.querySelector('[data-countdown]')?.textContent).toBe('0:30');
    expect(el.textContent).toContain('Waiting for the others.');
    render(el, { ...base, phase: 'locked', myVote: 'B' }, c, joined, noop);
    expect(el.querySelector('[data-countdown]')).toBeNull();
    expect(el.textContent).toContain('Locked: B. Yes to 60 to 100 MW, tied.');
    expect(el.textContent).toContain('Voting is closed. Watch the screen.');
    render(el, { ...base, voteDeadline: null }, c, joined, noop);
    expect(el.querySelector('[data-countdown]')).toBeNull();
  });
});

describe('the other screens', () => {
  it('say who you are while you wait, in the lobby and between rounds', () => {
    const el = mount();
    render(el, { ...base, phase: 'lobby', round: -1, role: 'government', table: 'Red' }, c, joined, noop);
    expect(el.textContent).toContain("You're in as Ann, Knight. Watch the screen.");
    expect(el.textContent).toContain('Kenyan Government');
    expect(el.textContent).toContain('Table: Red');
    render(el, { ...base, phase: 'travel' }, c, joined, noop);
    expect(el.textContent).toContain("You're in as Ann, Rogue. Watch the screen.");
    expect(el.textContent).not.toContain('Table:');
  });
  it('offer a Change button in the lobby only, which asks to change the details', () => {
    const el = mount(); const actions = { join: vi.fn(), vote: vi.fn(), change: vi.fn() };
    render(el, { ...base, phase: 'lobby', round: -1, table: 'Red' }, c, joined, actions);
    const change = el.querySelector('button[data-change]') as HTMLButtonElement;
    expect(change.textContent).toBe('Change');
    expect(change.type).toBe('button');
    expect(change.classList.contains('btn')).toBe(true);
    expect(change.classList.contains('btn-accent')).toBe(false);   // flat: the accent belongs to Join
    change.click();
    expect(actions.change).toHaveBeenCalledTimes(1);
    expect(actions.join).not.toHaveBeenCalled();
    const later: PlayerView[] = [{ ...base, phase: 'travel' }, base, { ...base, myVote: 'B' }, { ...base, phase: 'locked' }, { ...base, phase: 'reveal', myVote: 'B', picks: ['B'] }, { ...base, phase: 'ending', round: 3 }];
    for (const view of later) {
      render(el, view, c, joined, actions);
      expect(el.querySelector('button[data-change]'), view.phase).toBeNull();
    }
  });
  it('reopen the join form over the lobby, filled in with the details given, and send a join from it', () => {
    const el = mount(); const actions = { join: vi.fn(), vote: vi.fn(), change: vi.fn() };
    const lobbyView: PlayerView = { ...base, phase: 'lobby', round: -1, name: 'Ann', role: 'citizen', table: 'Red' };
    render(el, lobbyView, c, joined, actions);
    render(el, lobbyView, c, { status: 'joining', name: 'Ann', role: 'citizen', table: 'Red' }, actions);
    expect(el.querySelector('[data-screen=waiting]')).toBeNull();
    expect(nameInput(el).value).toBe('Ann');
    expect(tableInput(el).value).toBe('Red');
    expect([...el.querySelectorAll('button[aria-pressed=true]')].map((b) => b.getAttribute('data-role'))).toEqual(['citizen']);
    expect(joinButton(el).disabled).toBe(false);
    (el.querySelector('button[data-role=business]') as HTMLButtonElement).click();
    joinButton(el).click();
    expect(actions.join).toHaveBeenCalledWith('Ann', 'business', 'Red');
  });
  it('say so when you did not vote, and when nobody is named in the call-out', () => {
    const el = mount();
    render(el, { ...base, phase: 'locked' }, c, joined, noop);
    expect(el.textContent).toContain('You did not vote this round.');
    render(el, { ...base, phase: 'locked', callout: { name: null, option: null, isMe: false } }, c, joined, noop);
    expect(el.textContent).toContain('Someone is defending their choice.');
    render(el, { ...base, phase: 'reveal', lastPoints: 0 }, c, joined, noop);
    expect(el.textContent).toContain('+0 this round');
    expect(el.textContent).toContain('You did not vote this round.');
  });
  it('score the last round on the room majorities and the ending on your own picks, and never score a missing vote', () => {
    const el = mount();
    const last: PlayerView = { ...base, phase: 'reveal', round: 3, myVote: 'B', picks: ['A', 'A', 'A', 'B'], majorities: ['B', 'C', 'B', 'B'] };
    render(el, last, c, joined, noop);
    expect(el.textContent).toContain('Your pick B fits 3 of the three earlier decisions.');
    render(el, { ...last, myVote: null, picks: ['A', 'A', 'A', null] }, c, joined, noop);
    expect(el.textContent).toContain('You did not vote in the final round.');
    expect(el.textContent).not.toContain('fits');

    const end: PlayerView = { ...base, phase: 'ending', round: 3, picks: ['B', 'C', 'B', 'B'], majorities: ['A', 'A', 'A', 'A'] };
    render(el, end, c, joined, noop);
    expect(el.textContent).toContain('Coherence: 3 of 3');
    render(el, { ...end, picks: ['A', 'B', 'C', 'A'] }, c, joined, noop);
    expect(el.textContent).toContain('Coherence: 0 of 3');
    render(el, { ...end, phase: 'leaderboard', picks: [null, 'B', null, null] }, c, joined, noop);
    expect(el.textContent).toContain('You did not vote in the final round.');
    expect(el.textContent).not.toContain('Coherence');
    expect(el.textContent).toContain('No vote');
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
  it('name the room on the offline screen when it cannot be reached, and on no other screen but the join form', () => {
    const el = mount();
    render(el, null, c, { ...joining, status: 'offline' }, noop);
    expect(el.textContent).toContain('Reconnecting…');
    expect(el.textContent).not.toContain("Can't reach");
    render(el, null, c, { ...joining, status: 'offline', unreachable: 'KFBN' }, noop);
    expect(el.textContent).toContain('Reconnecting…');
    expect(el.textContent).toContain("Can't reach room KFBN. Check the code on the screen.");
    render(el, null, c, { ...joining, status: 'connecting', unreachable: 'KFBN' }, noop);
    expect(el.textContent).not.toContain("Can't reach");
  });
  it('add and remove the unreachable line under the join form without rebuilding what the player is typing', () => {
    const el = mount();
    render(el, null, c, joining, noop);
    const form = el.querySelector('form')!;
    const input = nameInput(el);
    input.value = 'Mo'; input.dispatchEvent(new Event('input'));
    (el.querySelector('button[data-role=citizen]') as HTMLButtonElement).click();
    render(el, null, c, { ...joining, unreachable: 'KFBN' }, noop);
    expect(el.querySelector('form')).toBe(form);
    expect(nameInput(el)).toBe(input);
    expect(input.value).toBe('Mo');
    expect(joinButton(el).disabled).toBe(false);
    expect(form.textContent).toContain("Can't reach room KFBN. Check the code on the screen.");
    render(el, null, c, { ...joining, unreachable: 'KFBN' }, noop);
    expect(form.querySelectorAll('[data-unreachable]')).toHaveLength(1);
    render(el, null, c, joining, noop);
    expect(form.textContent).not.toContain("Can't reach");
    expect(el.querySelector('form')).toBe(form);
  });
  it('keep the locked card top-aligned under the round row in both phases, so it does not jump when voting closes', () => {
    const el = mount();
    render(el, { ...base, myVote: 'B' }, c, joined, noop);
    const layout = () => [...el.querySelector('section')!.children].map(n => n.className);
    const whileOpen = layout();
    expect(el.querySelector('.is-centered')).toBeNull();
    expect(el.textContent).toContain('Round 1 of 4');
    render(el, { ...base, phase: 'locked', myVote: 'B' }, c, joined, noop);
    expect(el.querySelector('.is-centered')).toBeNull();
    expect(el.textContent).toContain('Round 1 of 4');
    expect(layout()).toEqual(whileOpen);
  });
  it('buzz once per call-out and again only after the screen has changed', () => {
    const vibrate = vi.fn();
    Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true });
    const el = mount();
    render(el, calledView, c, joined, noop);
    render(el, { ...calledView, serverNow: 2000 }, c, joined, noop);
    render(el, calledView, c, { ...joined, error: 'wrong round' }, noop);
    expect(vibrate).toHaveBeenCalledTimes(1);
    expect(vibrate).toHaveBeenCalledWith(200);
    render(el, { ...base, phase: 'reveal' }, c, joined, noop);
    render(el, calledView, c, joined, noop);
    expect(vibrate).toHaveBeenCalledTimes(2);
  });
  it('use no em dash or en dash anywhere in the copy', () => {
    const el = mount();
    const dashes = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`);
    const screens: Array<[PlayerView | null, Parameters<typeof render>[3]]> = [
      [null, joining], [null, { ...joining, status: 'connecting' }], [null, { ...joining, status: 'kicked' }], [null, { ...joining, status: 'offline' }],
      [null, { ...joining, status: 'offline', unreachable: 'ABCD' }],
      [{ ...base, phase: 'lobby' }, joined], [base, joined], [{ ...base, myVote: 'C' }, joined], [calledView, joined], [{ ...base, phase: 'locked' }, joined],
      [{ ...calledView, callout: { name: 'Bo', option: 'D', isMe: false } }, joined],
      [{ ...base, phase: 'reveal', myVote: 'A', picks: ['A'] }, joined], [{ ...base, phase: 'reveal', round: 3, myVote: 'D', majorities: ['A', 'B', 'C', 'D'] }, joined],
      [{ ...base, phase: 'ending', round: 3, picks: ['A', 'B', 'C', 'D'] }, joined],
    ];
    for (const [view, ui] of screens) {
      render(el, view, c, { ...ui, error: 'bad phase' }, noop);
      expect(el.textContent).not.toMatch(dashes);
      expect(el.textContent?.length).toBeGreaterThan(0);
    }
  });
});
