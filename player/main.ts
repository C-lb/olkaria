// Wires the phone page together: the room code from the address, the saved client id and join details, the
// socket, and a render on every change. The tab keeps no other state; the room is the source of truth.
import raw from '../content/case.json';
import type { CaseContent } from '../shared/content';
import { ROLES, type PlayerView, type Role } from '../shared/types';
import { PlayerSocket } from './net';
import { render, updateCountdown, type Actions, type UiState } from './render';

// The JSON is validated by tests/content.test.ts. Loading the schema here would put Zod in every student's download.
const content = raw as unknown as CaseContent;

const ID_KEY = 'olkaria.clientId';
const JOIN_KEY = 'olkaria.join';

/** What this phone told the room it is. Stored with its room code, so last week's details never join this week's room. */
type Draft = { code: string; name: string; role: Role; table: string };

// Storage can be blocked (private windows, strict settings). The page still works for the life of the tab without it.
const readStore = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const writeStore = (key: string, value: string): void => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // nothing to do: the tab just will not remember
  }
};

/** Random hex from getRandomValues, which unlike randomUUID also exists over plain http (testing on a laptop's LAN address). */
function newClientId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function loadClientId(): string {
  const saved = readStore(ID_KEY);
  if (saved) return saved;
  const fresh = newClientId();
  writeStore(ID_KEY, fresh);
  return fresh;
}

function loadDraft(code: string): Draft | null {
  const text = readStore(JOIN_KEY);
  if (!text) return null;
  try {
    const d = JSON.parse(text) as Partial<Draft> | null;
    if (d && d.code === code && typeof d.name === 'string' && typeof d.table === 'string' && ROLES.includes(d.role as Role)) {
      return { code, name: d.name, role: d.role as Role, table: d.table };
    }
  } catch {
    // a corrupt entry is the same as none
  }
  return null;
}

function start(app: HTMLElement, code: string): void {
  document.title = `Olkaria ${code}`;
  const clientId = loadClientId();
  const socket = new PlayerSocket(code, clientId);

  let draft = loadDraft(code);
  /** True for a returning phone that rejoins without showing the form. */
  let restored = draft !== null;
  let view: PlayerView | null = null;
  let receivedAt = 0;
  let link: 'connecting' | 'open' | 'closed' = 'connecting';
  let kicked = false;
  /** The room's last refusal and the screen it was raised on. The room always follows a refusal with a view, so the line has to outlive that one. */
  let error: { msg: string; on: string } | null = null;
  let ticker: number | undefined;

  const where = (v: PlayerView | null): string => (v ? `${v.phase}|${v.round}|${v.myVote}` : 'none');

  const status = (): UiState['status'] => {
    if (kicked) return 'kicked';
    // The join form stays up whatever the link is doing, so a dropped connection never costs a player what they typed.
    // A join tapped while the link is down is already in `draft` and goes out on the next open.
    if (view === null && !restored) return 'joining';
    if (link === 'closed') return 'offline';
    return view ? 'joined' : 'connecting';
  };

  const tick = (): void => {
    if (view && view.phase === 'vote') updateCountdown(app, view, Date.now(), receivedAt);
  };

  const paint = (): void => {
    const ui: UiState = {
      status: status(), name: draft?.name ?? '', role: draft?.role ?? null, table: draft?.table ?? '', error: error?.msg ?? null,
      // Several attempts that never opened, in a tab that has never been in: most likely a wrong code, so say so.
      unreachable: view === null && socket.unreachable ? code : null,
    };
    render(app, view, content, ui, actions);
    // The clock only runs while a vote is open and this phone is connected.
    const counting = ui.status === 'joined' && view?.phase === 'vote';
    if (counting && ticker === undefined) ticker = window.setInterval(tick, 250);
    if (!counting && ticker !== undefined) {
      window.clearInterval(ticker);
      ticker = undefined;
    }
    tick();
  };

  const sendJoin = (d: Draft): void => {
    socket.send({ t: 'join', clientId, name: d.name, role: d.role, table: d.table });
  };

  const actions: Actions = {
    join(name, role, table) {
      if (kicked) return;
      draft = { code, name, role, table };
      writeStore(JOIN_KEY, JSON.stringify(draft));
      restored = false;
      error = null;
      sendJoin(draft);
      paint();
    },
    vote(option) {
      if (kicked || !view) return;
      socket.send({ t: 'vote', round: view.round, option });
    },
  };

  socket.onView((next) => {
    view = next;
    receivedAt = Date.now();
    // Only a view that changes the phase, the round or this phone's vote ends the error line.
    if (error && error.on !== where(next)) error = null;
    paint();
  });
  socket.onError((msg) => {
    error = { msg, on: where(view) };
    paint();
  });
  socket.onStatus((s) => {
    if (s === 'kicked') {
      kicked = true;
    } else if (s === 'open') {
      link = 'open';
      // Every connection announces who this is again. The room treats a repeat join as a rejoin and changes nothing.
      if (draft) sendJoin(draft);
    } else {
      link = 'closed';
    }
    paint();
  });

  paint();
}

const app = document.getElementById('app') as HTMLElement;
const code = /\/j\/([A-Za-z]{4})(?![A-Za-z])/.exec(location.pathname)?.[1]?.toUpperCase();
if (code) {
  start(app, code);
} else {
  app.innerHTML = '<section class="screen is-centered"><p class="title">This link has no room code. Scan the code on the screen to join.</p></section>';
}
