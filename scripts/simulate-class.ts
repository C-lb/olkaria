// Fake phones for a rehearsal or a load check. N players join a room over WebSockets and vote at random
// moments in every round until the leaderboard comes up.
//   npm run simulate -- --base http://localhost:8787 --code ABCD --n 60
// Player i is role ROLES[i % 4] at table `Table ${floor(i / 4) + 1}`, named `Sim i`, client id `sim-i`.
// Rounds are numbered from 0, as in the room.
import WebSocket from 'ws';
import { ROLES, type ClientMsg, type OptionId, type PlayerView, type ServerMsg } from '../shared/types';

/** Each phone votes somewhere in the first 20 seconds of the window. */
const VOTE_SPREAD_MS = 20_000;

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
let finished = false;

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
  const scheduled = new Set<number>();   // rounds this phone has a vote queued for, until the room shows it landed
  let seen = false;

  const send = (msg: ClientMsg): void => {
    if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(msg));
  };

  const onView = (view: PlayerView): void => {
    if (!seen) {
      seen = true;
      joined += 1;
      if (joined === n) console.log(`joined ${n}`);
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
    setTimeout(() => {
      send({ t: 'vote', round, option: pickOption() });
      const sent = (votesSent.get(round) ?? 0) + 1;
      if (sent < n) {
        votesSent.set(round, sent);
        return;
      }
      votesSent.delete(round);
      console.log(`round ${round}: votes sent`);
    }, Math.random() * VOTE_SPREAD_MS);
  };

  socket.on('open', () => {
    send({ t: 'join', clientId, name: `Sim ${i}`, role: ROLES[i % ROLES.length], table: `Table ${Math.floor(i / 4) + 1}` });
  });
  socket.on('message', (data) => {
    const msg = JSON.parse(data.toString()) as ServerMsg;
    if (msg.t === 'you') onView(msg.view);
    else if (msg.t === 'error') console.error(`${clientId}: server error "${msg.msg}"`);
    else if (msg.t === 'kicked') console.error(`${clientId}: removed from the room`);
  });
  socket.on('error', (err) => {
    console.error(`${clientId}: ${err.message}`);
    process.exitCode = 1;
  });
}

for (let i = 0; i < n; i++) startPhone(i);
