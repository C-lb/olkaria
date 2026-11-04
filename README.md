# Olkaria: the Deadlock

An 18-minute classroom boss fight for the BUSI611 case on Microsoft's US$1 billion data centre in Kenya.
The class plays a party of four stakeholder classes and votes on their phones. Each vote becomes an attack on the Deadlock.
A Phaser game runs on the projector, a plain TypeScript page runs on the phones, and a Cloudflare Worker with one Durable Object per room keeps the state.

Live at https://olkaria.sparkbot-worker.workers.dev. The projector page is `/host/`; phones join at `/j/CODE`.

## Run it locally

```sh
npm install
npm run dev
```

Then open http://localhost:5173/host/?mode=offline.
Offline mode runs the room in the browser with no server: 1 to 4 add a vote, Shift adds ten, B adds 30 bots.

Online, with the Worker:

```sh
npm run build
npx wrangler dev
```

Then open http://localhost:8787/host/. `npm run dev:worker` is the same as `npx wrangler dev`.
`wrangler dev` serves the pages built into `dist/`, so build again after changing the host or phone code or `content/case.json`, which both pages bundle.
A class of 60 fake phones: `npm run simulate -- --base http://localhost:8787 --code CODE --n 60`.

## Test and check

```sh
npm test        # Vitest
npm run check   # TypeScript, for the pages and for the Worker
npm run build   # Vite, into dist/
```

## Deploy

`npm run deploy` builds, then runs `wrangler deploy` to the account `npx wrangler whoami` shows (`npx wrangler login` if it shows none).
It prints the workers.dev address, today https://olkaria.sparkbot-worker.workers.dev.
Check it with `curl -s -X POST https://olkaria.sparkbot-worker.workers.dev/api/rooms`, which returns `code`, `hostKey` and `joinUrl` as JSON.
Load test before class: open the host page, note the code at the end of the join address, then run `npm run simulate -- --base https://olkaria.sparkbot-worker.workers.dev --code CODE --n 60`.

## Content

The case lives in `content/case.json`: roles, rounds and options, evidence scores, debriefs, discuss lines, exhibits, endings, quotes and the scoring constants.
It is the team's file to edit, and scores never go in code.
Two bits of case wording do live in code: the quote speakers with their citations (`host/quotes.ts`) and the leaderboard's closing question (`host/finale.ts`).
`npm test` checks the content file's shape and rules (`tests/content.test.ts`).
A change reaches the live site only after `npm run deploy`.

## More

- `RUNBOOK.md`: the day itself, from before class to the rehearsal checklist, keys included.
- M on the host opens the menu: restart the round, back to the lobby, reload, go to a stage or the ending, and the key map. Every item that changes the room asks twice.
- `CREDITS.md`: the licensed art and font. The class figures, tiles and bosses are drawn in code.
- Design: `docs/superpowers/specs/2026-11-02-olkaria-deadlock-design.md`
- Plan: `docs/superpowers/plans/2026-11-02-olkaria-deadlock.md`

## Known limits

- The host key travels in the query string of the host socket's address. `wrangler tail` masks it as `key=REDACTED`; other logs that keep full URLs may not.
- The phone page bundles the whole of `content/case.json`, evidence scores included, so a curious student can read them.
- Nothing rate-limits room creation (`POST /api/rooms`).
- The class figures, tiles, exhibit and gate are placeholders drawn in code. Real sprites need both the files in `host/art/assets/` and a loader line in `host/scenes/Boot.ts` for each texture key (`class-citizen` and the rest); Boot loads only the backdrop today.
