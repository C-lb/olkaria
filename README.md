# Olkaria: the Deadlock

A classroom game for the BUSI611 case on Microsoft's US$1 billion data centre in Kenya.
The class meets five bosses, one per problem: Power, Demand, Competition, Risk and the Deadlock. Each boss guards one question with three options. Students vote on their phones, some are called out to defend their pick, the boss dies whatever the vote, and the projector shows how the room split. Nothing is scored. The ending congratulates the room and shows who picked each option on the last question.
A Phaser game runs on the projector, a plain TypeScript page runs on the phones, and a Cloudflare Worker with one Durable Object per room keeps the state.

Live at https://olkaria.sparkbot-worker.workers.dev. The projector page is `/host/`; phones join at `/j/CODE` with a name, a role (Citizen, Government, Local Businessman or Satya Nadella) and a team (Team 1 to Team 8).

## Run it locally

```sh
npm install
npm run dev
```

Then open http://localhost:5173/host/?mode=offline.
Offline (practice) mode runs the room in the browser with no server: 1 to 3 add a vote for A to C, Shift adds ten, B adds 30 bots (practice mode only; B does nothing online).

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

A deploy to `olkaria` replaces the live game at once, and a Worker with a Durable Object gets no preview URL. So a build goes to a staging Worker first.

1. `npx wrangler whoami` shows the account (`npx wrangler login` if it shows none).
2. `npm run deploy:next` builds and deploys the `next` environment in `wrangler.jsonc`: a second Worker, `olkaria-next`, at https://olkaria-next.sparkbot-worker.workers.dev, with its own Durable Object namespace, so its rooms never touch the live ones.
3. `node scripts/live-smoke.mjs <out dir> https://olkaria-next.sparkbot-worker.workers.dev` plays a room through all five questions to the ending in two headless Chromes, a projector at 1920 x 1080 and a phone at 390 x 844, and saves screenshots into the out dir. It exits 0 only if every check held.
4. `npm run deploy` builds and deploys `olkaria`, the live game. Run the smoke script again without the URL, which defaults to production.
5. If production fails, `npx wrangler rollback` puts the previous version back.

Check a deploy with `curl -s -X POST https://olkaria.sparkbot-worker.workers.dev/api/rooms`, which returns `code`, `hostKey` and `joinUrl` as JSON.
Load test before class: open the host page, note the code at the end of the join address, then run `npm run simulate -- --base https://olkaria.sparkbot-worker.workers.dev --code CODE --n 60`.

## Content

The case lives in `content/case.json`: the roles, the five questions with their bosses, problems and options, the ending's words, and the settings (the vote's length and the call-outs per question).
It is the team's file to edit. The questions and options appear on the projector and the phones exactly as written there.
`npm test` checks the content file's shape (`tests/content.test.ts`).
A change reaches the live site only after a deploy.

## More

- `RUNBOOK.md`: the day itself, from before class to the rehearsal checklist, keys included.
- The host plays chiptune music for each phase, with pixel sound effects. S turns it off or on, and the menu has the same switch.
- M on the host opens the menu: restart the question, back to the lobby, reload, sound, and go to Q1 to Q5 or the Ending. Every item that changes the room asks twice.
- `CREDITS.md`: the licensed art and font. The role figures and the bosses are drawn in code (`shared/figures.ts` and the host's art).
- Design: `docs/superpowers/specs/2026-11-02-olkaria-deadlock-design.md`, and the five-question version: `docs/superpowers/specs/2026-11-04-class-edits-design.md`.

## Known limits

- The host key travels in the query string of the host socket's address. `wrangler tail` masks it as `key=REDACTED`; other logs that keep full URLs may not.
- Nothing rate-limits room creation (`POST /api/rooms`).
