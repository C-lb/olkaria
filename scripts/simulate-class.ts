// Fake phones for a rehearsal or a load check. N players join a room over WebSockets and vote at random
// moments in every round until the leaderboard comes up.
//   npm run simulate -- --base http://localhost:8787 --code ABCD --n 60
// Player i is role ROLES[i % 4] at table `Table ${floor(i / 4) + 1}`, named `Sim i`, client id `sim-i`.
// Rounds are numbered from 0, as in the room. The exit code is 0 only when the leaderboard comes up with every
// phone still connected. A connection error, a phone the room closed or removed first, or phones that have not
// all joined within 15 seconds end the run with 1.
import WebSocket from 'ws';
import { ROLES, type ClientMsg, type OptionId, type PlayerView, type ServerMsg } from '../shared/types';

/** Each phone votes at a random moment in the first 20 seconds of the window, or in the first two thirds of a shorter one. */
const VOTE_SPREAD_MS = 20_000;
const VOTE_SPREAD_SHARE = 0.66;

/** Every phone must be a player in the room (have had its first view) within this long. */
const JOIN_WAIT_MS = 15_000;

/** Option weights A:B:C:D = 1:3:1:2, so B usually wins and the others still collect votes. */
const WEIGHTS: readonly (readonly [OptionId, number])[] = [['A', 1], ['B', 3], ['C', 1], ['D', 2]];

const USAGE = 'usage: npm run simulate -- --base http://localhost:8787 --code ABCD [--n 60]';

function flag(name: string): string | undefined {
  const at = process.argv.indexOf(`--${name}`);
  return at === -1 ? undefined : process.argv[at + 1];
}

function pickOption(): OptionId {
  let draw = Math.random() * WEIGHTS.reduce((sum, [, weight]) => sum + weight, 0);
  for (const [option, weight] of WEIGHTS) {
    draw -= weight;
    if (draw < 0) return option;
  }
  return 'D';
}

const base = flag('base');
const code = flag('code');
const n = Number(flag('n') ?? 60);
if (!base || !/^https?:\/\//.test(base) || !code || !Number.isInteger(n) || n < 1) {
  console.error(USAGE);
  process.exit(1);
}
const wsBase = base.replace(/^http/, 'ws').replace(/\/+$/, '');

const sockets: WebSocket[] = [];
const votesSent = new Map<number, number>();
let joined = 0;
let live = 0;   // sockets not closed yet
let finished = false;

// A refused join (a removed client id, say) would otherwise leave the run waiting for phones that never arrive.
const joinWatchdog = setTimeout(() => {
  console.error(`only ${joined} of ${n} phones joined within ${JOIN_WAIT_MS / 1000} s`);
  process.exit(1);
}, JOIN_WAIT_MS);

function finish(): void {
  if (finished) return;
  finished = true;
  console.log('leaderboard');
  for (const socket of sockets) socket.close(1000);
  setTimeout(() => process.exit(), 250);
}

function startPhone(i: number): void {
  const clientId = `sim-${i}`;
  const socket = new WebSocket(`${wsBase}/ws/${code}?role=player&clientId=${clientId}`);
  sockets.push(socket);
  live += 1;
  const scheduled = new Set<number>();   // rounds this phone has a vote queued for, until the room shows it landed
  let seen = false;
  let explained = false;   // this phone has already said why it is failing, so its close needs no line of its own

  const send = (msg: ClientMsg): void => {
    if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(msg));
  };

  const onView = (view: PlayerView): void => {
    if (!seen) {
      seen = true;
      joined += 1;
      if (joined === n) {
        clearTimeout(joinWatchdog);
        console.log(`joined ${n}`);
      }
    }
    if (view.phase === 'leaderboard') {
      finish();
      return;
    }
    if (view.myVote !== null) {
      // The vote is in. Forgetting it here lets this phone vote again if the host resets and replays the round.
      scheduled.delete(view.round);
      return;
    }
    if (view.phase !== 'vote' || scheduled.has(view.round)) return;
    const { round } = view;
    scheduled.add(round);
    const spread = Math.min(VOTE_SPREAD_MS, VOTE_SPREAD_SHARE * view.voteWindowMs);
    setTimeout(() => {
      send({ t: 'vote', round, option: pickOption() });
      const sent = (votesSent.get(round) ?? 0) + 1;
      if (sent < n) {
        votesSent.set(round, sent);
        return;
      }
      votesSent.delete(round);
      console.log(`round ${round}: votes sent`);
    }, Math.random() * spread);
  };

  socket.on('open', () => {
    send({ t: 'join', clientId, name: `Sim ${i}`, role: ROLES[i % ROLES.length], table: `Table ${Math.floor(i / 4) + 1}` });
  });
  socket.on('message', (data) => {
    const msg = JSON.parse(data.toString()) as ServerMsg;
    if (msg.t === 'you') {
      onView(msg.view);
    } else if (msg.t === 'error') {
      console.error(`${clientId}: server error "${msg.msg}"`);
    } else if (msg.t === 'kicked') {
      explained = true;
      console.error(`${clientId}: removed from the room`);
    }
  });
  socket.on('error', (err) => {
    explained = true;
    console.error(`${clientId}: ${err.message}`);
    process.exitCode = 1;
  });
  socket.on('close', (closeCode, reason) => {
    live -= 1;
    if (!finished) {
      // Any close before the leaderboard fails the run, even a clean one (the room was wiped, this phone was removed).
      if (!explained) console.error(`${clientId}: closed before the leaderboard (${closeCode}${reason.length > 0 ? ` ${reason.toString()}` : ''})`);
      process.exitCode = 1;
    }
    if (live === 0) process.exit();
  });
}

for (let i = 0; i < n; i++) startPhone(i);
