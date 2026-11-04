// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlayerView } from '../shared/types';

/** Stands in for the browser WebSocket. The tests play the room by calling open, say and drop. */
class FakeSocket {
  static OPEN = 1;
  static all: FakeSocket[] = [];
  readyState = 0;
  sent: string[] = [];
  private listeners: Record<string, Array<(ev: unknown) => void>> = {};
  constructor(public url: string) { FakeSocket.all.push(this); }
  addEventListener(type: string, fn: (ev: unknown) => void): void { (this.listeners[type] ??= []).push(fn); }
  send(data: string): void { this.sent.push(data); }
  close(): void { this.readyState = 3; }
  open(): void { this.readyState = 1; this.emit('open', {}); }
  say(msg: unknown): void { this.emit('message', { data: JSON.stringify(msg) }); }
  drop(code = 1006): void { this.readyState = 3; this.emit('close', { code }); }
  private emit(type: string, ev: unknown): void { for (const fn of this.listeners[type] ?? []) fn(ev); }
}

const lobby: PlayerView = { phase: 'lobby', round: -1, serverNow: 1000, voteDeadline: null, voteWindowMs: 30000, name: 'Ann', role: 'citizen', table: null, lead: 'citizen', isLead: true, myVote: null, lastPoints: 0, score: 0, rank: 1, playerCount: 1, tally: null, leadTally: null, supportTally: null, majorities: [], picks: [], callout: null };

const last = () => FakeSocket.all[FakeSocket.all.length - 1];

/** Loads the page the way a phone does: the address first, an empty main element, then the page script. */
async function boot(path = '/j/ABCD'): Promise<HTMLElement> {
  vi.resetModules();
  document.body.innerHTML = '<main id="app"></main>';
  window.history.pushState(null, '', path);
  await import('../player/main');
  return document.getElementById('app') as HTMLElement;
}

const nameInput = (app: HTMLElement) => app.querySelector('input[name=nickname]') as HTMLInputElement;
const joinButton = (app: HTMLElement) => app.querySelector('button[type=submit]') as HTMLButtonElement;
const typeAndPick = (app: HTMLElement, name: string) => {
  nameInput(app).value = name;
  nameInput(app).dispatchEvent(new Event('input'));
  (app.querySelector('button[data-role=citizen]') as HTMLButtonElement).click();
};
/** The waiting card line by line: the name, then the class and stakeholder, then the table when one was given. */
const waitingLines = (app: HTMLElement) =>
  [...app.querySelectorAll('[data-screen=waiting] .card h1, [data-screen=waiting] .card p.cap')].map((n) => n.textContent);

beforeEach(() => {
  FakeSocket.all = [];
  localStorage.clear();
  vi.useFakeTimers();
  vi.stubGlobal('WebSocket', FakeSocket);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('player page wiring', () => {
  it('keeps the join form, and what was typed in it, through a dropped connection', async () => {
    const app = await boot();
    expect(app.querySelector('form')).not.toBeNull();
    last().open();
    const form = app.querySelector('form')!;
    const name = nameInput(app);
    typeAndPick(app, 'Mo');
    last().drop();
    expect(app.querySelector('form')).toBe(form);
    expect(nameInput(app)).toBe(name);
    expect(name.value).toBe('Mo');
    expect(app.textContent).not.toContain('Reconnecting');
    vi.advanceTimersByTime(1000);
    last().open();
    expect(app.querySelector('form')).toBe(form);
    expect(name.value).toBe('Mo');
    expect(joinButton(app).disabled).toBe(false);
  });

  it('sends a join tapped while the connection is down as soon as it is back', async () => {
    const app = await boot();
    last().open();
    last().drop();
    typeAndPick(app, 'Mo');
    joinButton(app).click();
    expect(app.querySelector('form')).not.toBeNull();
    vi.advanceTimersByTime(1000);
    last().open();
    expect(last().sent.map((s) => JSON.parse(s))).toEqual([{ t: 'join', clientId: expect.any(String), name: 'Mo', role: 'citizen', table: '' }]);
  });

  it('says the room cannot be reached under the form after three failed opens, keeps the form, and clears the note once a connection opens', async () => {
    const app = await boot('/j/WXYZ');
    const form = app.querySelector('form')!;
    const name = nameInput(app);
    typeAndPick(app, 'Mo');
    for (const wait of [1000, 2000]) {
      last().drop();
      vi.advanceTimersByTime(wait);
    }
    expect(form.textContent).not.toContain("Can't reach");
    last().drop();
    expect(app.querySelector('form')).toBe(form);
    expect(name.value).toBe('Mo');
    expect(form.textContent).toContain("Can't reach this room. Scan the QR on the screen again.");
    vi.advanceTimersByTime(4000);
    last().open();
    expect(app.querySelector('form')).toBe(form);
    expect(form.textContent).not.toContain("Can't reach");
  });

  it('rejoins from saved details without the form, and says Reconnecting, never the unreachable note, once it has been in', async () => {
    localStorage.setItem('olkaria.join', JSON.stringify({ code: 'ABCD', name: 'Ann', role: 'citizen', table: '' }));
    const app = await boot();
    expect(app.textContent).toContain('Connecting…');
    last().open();
    expect(JSON.parse(last().sent[0])).toMatchObject({ t: 'join', name: 'Ann', role: 'citizen' });
    last().drop();
    expect(app.textContent).toContain('Reconnecting…');
    expect(app.querySelector('form')).toBeNull();
    vi.advanceTimersByTime(1000);
    last().open();
    last().say({ t: 'you', view: lobby });
    expect(waitingLines(app)).toEqual(['Ann', 'Rogue, Citizen']);
    last().drop();
    for (const wait of [1000, 2000, 4000]) {
      vi.advanceTimersByTime(wait);
      last().drop();
    }
    expect(app.textContent).toContain('Reconnecting…');
    expect(app.textContent).not.toContain("Can't reach");
  });

  it('reopens the join form from the lobby on what the room has, sends the change, and closes the form on the answer', async () => {
    localStorage.setItem('olkaria.join', JSON.stringify({ code: 'ABCD', name: 'Ann', role: 'citizen', table: 'Red' }));
    const app = await boot();
    last().open();
    last().say({ t: 'you', view: { ...lobby, table: 'Red' } });
    expect(waitingLines(app)).toEqual(['Ann', 'Rogue, Citizen', 'Table: Red']);
    (app.querySelector('button[data-change]') as HTMLButtonElement).click();
    const form = app.querySelector('form')!;
    expect(form).not.toBeNull();
    expect(nameInput(app).value).toBe('Ann');
    expect((app.querySelector('input[name=table]') as HTMLInputElement).value).toBe('Red');
    expect(app.querySelector('button[data-role=citizen]')!.getAttribute('aria-pressed')).toBe('true');
    last().say({ t: 'you', view: { ...lobby, table: 'Red', playerCount: 2 } });   // someone else joins meanwhile
    expect(app.querySelector('form')).toBe(form);
    (app.querySelector('button[data-role=business]') as HTMLButtonElement).click();
    joinButton(app).click();
    expect(JSON.parse(last().sent[last().sent.length - 1])).toEqual({ t: 'join', clientId: expect.any(String), name: 'Ann', role: 'business', table: 'Red' });
    expect(app.querySelector('form')).toBe(form);   // the room has not answered yet
    expect(joinButton(app).classList.contains('is-loading')).toBe(true);
    last().say({ t: 'you', view: { ...lobby, role: 'business', isLead: false, table: 'Red', playerCount: 2 } });
    expect(app.querySelector('form')).toBeNull();
    expect(waitingLines(app)).toEqual(['Ann', 'Bard, Local Businesses', 'Table: Red']);
    expect(JSON.parse(localStorage.getItem('olkaria.join')!)).toEqual({ code: 'ABCD', name: 'Ann', role: 'business', table: 'Red' });
  });

  it('closes a reopened form when the game starts, and offers no Change after that', async () => {
    localStorage.setItem('olkaria.join', JSON.stringify({ code: 'ABCD', name: 'Ann', role: 'citizen', table: '' }));
    const app = await boot();
    last().open();
    last().say({ t: 'you', view: lobby });
    (app.querySelector('button[data-change]') as HTMLButtonElement).click();
    expect(app.querySelector('form')).not.toBeNull();
    last().say({ t: 'you', view: { ...lobby, phase: 'travel', round: 0 } });
    expect(app.querySelector('form')).toBeNull();
    expect(waitingLines(app)).toEqual(['Ann', 'Rogue, Citizen']);
    expect(app.querySelector('button[data-change]')).toBeNull();
    last().say({ t: 'you', view: lobby });   // back in the lobby after a reset: the form does not come back by itself
    expect(app.querySelector('form')).toBeNull();
    expect(app.querySelector('button[data-change]')).not.toBeNull();
  });

  it('shows the removed screen and opens no more connections once the room removes the phone', async () => {
    const app = await boot();
    last().open();
    last().say({ t: 'kicked' });
    expect(app.textContent).toContain('You were removed from the room.');
    expect(app.querySelector('form')).toBeNull();
    vi.advanceTimersByTime(120_000);
    expect(FakeSocket.all).toHaveLength(1);
  });
});
