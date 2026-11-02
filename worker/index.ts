// The Worker in front of the rooms. It creates rooms, forwards WebSocket upgrades to the room's
// Durable Object and serves the two pages. Everything else is a static asset.
import { isValidCode, makeRoomCode } from '../shared/codes';
import type { Env } from './room';

export { Room } from './room';

const WS_PATH = /^\/ws\/([^/]+)$/;
const JOIN_PATH = /^\/j\/[^/]+$/;

/** A fresh code collides with a live room about once in 330,000 draws; this many draws make a failure practically impossible. */
const CODE_DRAWS = 5;

const roomFor = (env: Env, code: string) => env.ROOM.get(env.ROOM.idFromName(code));

async function createRoom(req: Request, env: Env): Promise<Response> {
  for (let draw = 0; draw < CODE_DRAWS; draw++) {
    const code = makeRoomCode(Math.random);
    const hostKey = crypto.randomUUID();
    const res = await roomFor(env, code).fetch('https://room/init', { method: 'POST', body: JSON.stringify({ code, hostKey }) });
    if (res.status === 409) continue;   // that code is a live room, so draw another
    if (!res.ok) return Response.json({ error: 'could not create a room' }, { status: 500 });
    return Response.json({ code, hostKey, joinUrl: new URL('/j/' + code, req.url).toString() }, { status: 201 });
  }
  return Response.json({ error: 'no free room code, try again' }, { status: 503 });
}

export default {
  async fetch(req, env): Promise<Response> {
    const { pathname } = new URL(req.url);

    if (req.method === 'POST' && pathname === '/api/rooms') return createRoom(req, env);

    const ws = WS_PATH.exec(pathname);
    if (ws) {
      const code = ws[1];
      if (!isValidCode(code)) return new Response('No such room', { status: 404 });
      return roomFor(env, code).fetch(req);
    }

    // The page is asked for as /player/, not /player/index.html: assets answer the latter with a redirect to
    // /player/, and the phone would lose the room code in its address bar.
    if (JOIN_PATH.test(pathname)) return env.ASSETS.fetch(new Request(new URL('/player/', req.url), req));
    if (pathname === '/') return Response.redirect(new URL('/host/', req.url).toString(), 302);
    return env.ASSETS.fetch(req);
  },
} satisfies ExportedHandler<Env>;
