#!/usr/bin/env node
// A smoke test of a deployed Olkaria: one projector and one phone play a real room through all five questions to the
// ending, with screenshots along the way.
//
//   node scripts/live-smoke.mjs <out dir> [base url]
//
// The base url defaults to the live game. Two headless Chromes are driven over the DevTools protocol with Node's own
// fetch and WebSocket (Node 22 or later), so there is nothing to install: the host at 1920 x 1080 on port 9333 and a
// phone at 390 x 844 on port 9335. Both are killed on exit, on failure too.
//
// It checks visible text (document.body.innerText), not class names, on the host, because the host's HUD markup
// changes; on the phone it uses the stable hooks in player/render.ts (data-screen, .vote[data-option], #nickname,
// .role[data-role], select#team). Text is compared case-blind with whitespace squeezed, because CSS text-transform
// shows in innerText. Host keys go in as DOM KeyboardEvents on window (Phaser, the hotkeys, the menu and the how-to all
// listen there), never as CDP Input.dispatchKeyEvent, which with Escape takes headless Chrome off the page under test.
// Every wait is a poll with a timeout; a failure names the step and prints what both screens show. Exit code 0 only if
// every check held.
//
// When it first meets a new build, the likeliest things to need fixing are the HOST_* text markers below.

import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, appendFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// ---- Settings ---------------------------------------------------------------------------------------

const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const HOST_PORT = 9333;
const PHONE_PORT = 9335;
const DEFAULT_BASE = 'https://olkaria.sparkbot-worker.workers.dev';

/** host/strikers.ts: Space rests SEND_LOCK_MS after a send and AUTO_LOCK_MS after the vote locks; the kill takes KILL_MS. */
const SEND_LOCK_MS = 1000;
const AUTO_LOCK_MS = 1500;
const KILL_MS = 2400;
/** Slack added to every lockout, so a press never lands on its edge. */
const SLACK_MS = 400;

/** What the host shows, from host/strikers.ts and content/case.json. Matched case-blind, whitespace squeezed. */
const HOST_LOCKED = 'calls a student out';               // CLOCK/EVERYONE_LOCK_NOTE and optionsFooter in `locked`
const HOST_VOTE_OPEN = ['still to vote', 'Space locks the vote', 'Everyone has voted'];
const HOST_VALID = 'Valid point, ';                        // judgeFlash: "Valid point, Ann!"
const HOST_PERCENT = /\d+\s*%/;                            // the split's shares
const PHONE_LOOK = 'Look at the screen now.';
const PHONE_CALLED = "You're up.";

/** The phone's pick per question; Q5's decides the column its name must sit under on the ending. */
const PICKS = ['B', 'A', 'C', 'B', 'A'];
const TEAM = 'Team 3';
const ROLE = 'citizen';

// ---- Arguments --------------------------------------------------------------------------------------

const [outArg, baseArg] = process.argv.slice(2);
if (!outArg) {
  console.error('Usage: node scripts/live-smoke.mjs <out dir> [base url]');
  process.exit(2);
}
const OUT = resolve(outArg);
const BASE = (baseArg ?? DEFAULT_BASE).replace(/\/+$/, '');
mkdirSync(OUT, { recursive: true });
const here = dirname(fileURLToPath(import.meta.url));
const content = JSON.parse(readFileSync(join(here, '..', 'content', 'case.json'), 'utf8'));
const ROUNDS = content.rounds;
const NAME = `Smoke${Array.from({ length: 3 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.floor(Math.random() * 24)]).join('')}`;

// ---- Small helpers ----------------------------------------------------------------------------------

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const norm = (s) => String(s ?? '').replace(/[‘’]/g, "'").replace(/\s+/g, ' ').trim().toLowerCase();
const has = (text, needle) => norm(text).includes(norm(needle));
let stepNo = 0;
const pass = (msg) => console.log(`ok ${String(++stepNo).padStart(2, '0')}  ${msg}`);
const consoleLog = join(OUT, 'console.log');
writeFileSync(consoleLog, '');

class StepError extends Error {}

// ---- Chrome -----------------------------------------------------------------------------------------

const children = [];
const profiles = [];

function cleanup() {
  for (const child of children) {
    if (child.exitCode === null && child.signalCode === null) {
      try { child.kill('SIGKILL'); } catch { /* gone already */ }
    }
  }
  children.length = 0;
  for (const dir of profiles) {
    try { rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
  }
  profiles.length = 0;
}
process.on('exit', cleanup);
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(sig, () => {
    cleanup();
    process.exit(130);
  });
}

async function portAnswers(port) {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/json/version`, { signal: AbortSignal.timeout(500) });
    return res.ok;
  } catch {
    return false;
  }
}

async function launchChrome(label, port, width, height) {
  if (await portAnswers(port)) throw new StepError(`${label}: something already answers on port ${port}. Quit it first (lsof -nP -iTCP:${port}).`);
  const profile = mkdtempSync(join(tmpdir(), `olkaria-smoke-${label}-`));
  profiles.push(profile);
  const child = spawn(CHROME, [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    '--remote-allow-origins=*',
    `--user-data-dir=${profile}`,
    `--window-size=${width},${height}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    '--autoplay-policy=no-user-gesture-required',
    '--mute-audio',
    'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  children.push(child);
  let stderr = '';
  child.stderr.on('data', (d) => { stderr = (stderr + d).slice(-4000); });
  const until = Date.now() + 15000;
  while (Date.now() < until) {
    if (child.exitCode !== null) throw new StepError(`${label}: Chrome exited at launch (${child.exitCode}).\n${stderr}`);
    if (await portAnswers(port)) break;
    await sleep(150);
  }
  if (!(await portAnswers(port))) throw new StepError(`${label}: Chrome never opened port ${port}.\n${stderr}`);
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const page = targets.find((t) => t.type === 'page');
  if (!page) throw new StepError(`${label}: no page target on port ${port}.`);
  const cdp = await Cdp.connect(label, page.webSocketDebuggerUrl);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  return cdp;
}

/** One DevTools session on one page: commands with replies, and the events it reports. */
class Cdp {
  static connect(label, url) {
    return new Promise((ok, fail) => {
      const ws = new WebSocket(url);
      ws.addEventListener('open', () => ok(new Cdp(label, ws)), { once: true });
      ws.addEventListener('error', () => fail(new StepError(`${label}: could not open the DevTools socket ${url}`)), { once: true });
    });
  }

  constructor(label, ws) {
    this.label = label;
    this.ws = ws;
    this.nextId = 1;
    this.pending = new Map();
    ws.addEventListener('message', (msg) => {
      const data = JSON.parse(String(msg.data));
      if (data.id !== undefined) {
        const p = this.pending.get(data.id);
        if (!p) return;
        this.pending.delete(data.id);
        if (data.error) p.fail(new Error(`${label} ${p.method}: ${data.error.message}`));
        else p.ok(data.result);
        return;
      }
      if (data.method === 'Runtime.consoleAPICalled') {
        const text = data.params.args.map((a) => a.value ?? a.description ?? '').join(' ');
        appendFileSync(consoleLog, `[${label} ${data.params.type}] ${text}\n`);
      } else if (data.method === 'Runtime.exceptionThrown') {
        const d = data.params.exceptionDetails;
        appendFileSync(consoleLog, `[${label} EXCEPTION] ${d.exception?.description ?? d.text}\n`);
      }
    });
    ws.addEventListener('close', () => {
      for (const p of this.pending.values()) p.fail(new Error(`${label}: the DevTools socket closed`));
      this.pending.clear();
    });
  }

  send(method, params = {}, timeoutMs = 30000) {
    const id = this.nextId++;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((ok, fail) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        fail(new Error(`${this.label} ${method}: no reply in ${timeoutMs} ms`));
      }, timeoutMs);
      this.pending.set(id, {
        method,
        ok: (v) => { clearTimeout(timer); ok(v); },
        fail: (e) => { clearTimeout(timer); fail(e); },
      });
    });
  }

  /** Evaluates an expression in the page (promises awaited) and returns its value. */
  async eval(expression, timeoutMs = 30000) {
    const res = await this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, timeoutMs);
    if (res.exceptionDetails) {
      throw new Error(`${this.label} eval failed: ${res.exceptionDetails.exception?.description ?? res.exceptionDetails.text}\n  in: ${expression.slice(0, 200)}`);
    }
    return res.result.value;
  }

  async navigate(url) {
    await this.send('Page.navigate', { url });
    await poll(`${this.label} loads ${url}`, async () => (await this.eval('document.readyState')) === 'complete' && (await this.eval('location.href')) !== 'about:blank', 30000);
  }

  async text() {
    try {
      return await this.eval('document.body ? document.body.innerText : ""', 5000);
    } catch (err) {
      return `<could not read: ${err.message}>`;
    }
  }

  async screenshot(name) {
    const { data } = await this.send('Page.captureScreenshot', { format: 'png' });
    const file = join(OUT, name);
    writeFileSync(file, Buffer.from(data, 'base64'));
    return file;
  }
}

// ---- Waiting and failing ----------------------------------------------------------------------------

let host = null;
let phone = null;

async function dump() {
  const show = (t) => t.split('\n').map((l) => `    | ${l}`).join('\n');
  return `\n  host text:\n${host ? show(await host.text()) : '    (none)'}\n  phone text:\n${phone ? show(await phone.text()) : '    (none)'}`;
}

/** Polls `check` (truthy to pass) every `every` ms until `timeoutMs`; else fails naming the step, with both screens' text. */
async function poll(step, check, timeoutMs = 15000, every = 150) {
  const until = Date.now() + timeoutMs;
  let last = null;
  while (Date.now() < until) {
    try {
      const v = await check();
      if (v) return v;
    } catch (err) {
      last = err;
    }
    await sleep(every);
  }
  throw new StepError(`timed out after ${timeoutMs} ms: ${step}${last ? `\n  last error: ${last.message}` : ''}${await dump()}`);
}

async function expect(step, cond) {
  if (!cond) throw new StepError(`failed: ${step}${await dump()}`);
  pass(step);
}

const hostHas = (needle) => async () => has(await host.text(), needle);

// ---- Host keys ----------------------------------------------------------------------------------------

/** When Space may next be pressed: the scene's rests (host/strikers.ts), tracked here rather than read from the page. */
let spaceFreeAt = 0;

/** The key's code and legacy keyCode, which Phaser's 'keydown-SPACE' reads (it maps event.keyCode, not event.key). */
function keyInfo(key) {
  if (key === ' ') return { code: 'Space', keyCode: 32 };
  if (key === 'Escape') return { code: 'Escape', keyCode: 27 };
  if (key === 'Enter') return { code: 'Enter', keyCode: 13 };
  if (/^[0-9]$/.test(key)) return { code: `Digit${key}`, keyCode: key.charCodeAt(0) };
  if (/^[a-z]$/i.test(key)) return { code: `Key${key.toUpperCase()}`, keyCode: key.toUpperCase().charCodeAt(0) };
  if (key === '?') return { code: 'Slash', keyCode: 191, shiftKey: true };
  throw new Error(`no key info for ${JSON.stringify(key)}`);
}

/** A keydown then a keyup on window, as DOM events. keyCode and which are pinned, since KeyboardEventInit may drop them. */
async function press(key, { shiftKey = false } = {}) {
  const info = keyInfo(key);
  const init = { key, code: info.code, keyCode: info.keyCode, which: info.keyCode, shiftKey: shiftKey || Boolean(info.shiftKey), bubbles: true, cancelable: true };
  await host.eval(`(() => {
    const init = ${JSON.stringify(init)};
    for (const type of ['keydown', 'keyup']) {
      const e = new KeyboardEvent(type, init);
      Object.defineProperty(e, 'keyCode', { get: () => init.keyCode });
      Object.defineProperty(e, 'which', { get: () => init.which });
      window.dispatchEvent(e);
    }
    return true;
  })()`);
}

/** A requestAnimationFrame callback fires within 2 s: the host tab is drawing, so Phaser will see the key queue. */
async function assertDrawing(step) {
  const drawing = await host.eval(`new Promise((r) => { const t = setTimeout(() => r(false), 2000); requestAnimationFrame(() => { clearTimeout(t); r(true); }); })`);
  if (!drawing) throw new StepError(`the host tab is not drawing (no requestAnimationFrame in 2 s) before: ${step}${await dump()}`);
}

/** Waits out Space's rest, checks the tab draws, presses Space once, and starts the rest after a send. */
async function space(step) {
  const wait = spaceFreeAt - Date.now();
  if (wait > 0) await sleep(wait);
  await assertDrawing(step);
  await press(' ');
  spaceFreeAt = Date.now() + SEND_LOCK_MS + SLACK_MS;
}

// ---- Phone ------------------------------------------------------------------------------------------

const screenIs = (kind) => async () => (await phone.eval(`document.querySelector('[data-screen]')?.getAttribute('data-screen') ?? ''`)) === kind;
const phoneHas = (needle) => async () => has(await phone.text(), needle);
const fitsChecked = new Set();

/** No phone screen needs a sideways scroll. */
async function phoneFits(where) {
  const r = await phone.eval(`({ sw: document.documentElement.scrollWidth, iw: window.innerWidth, screen: document.querySelector('[data-screen]')?.getAttribute('data-screen') ?? '?' })`);
  if (r.sw > r.iw) throw new StepError(`phone screen "${r.screen}" (${where}) scrolls sideways: scrollWidth ${r.sw} > innerWidth ${r.iw}${await dump()}`);
  fitsChecked.add(r.screen);
}

async function tapPhone(selector) {
  const ok = await phone.eval(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el || el.disabled) return false; el.click(); return true; })()`);
  if (!ok) throw new StepError(`phone: nothing enabled to tap at ${selector}${await dump()}`);
}

// ---- The run ----------------------------------------------------------------------------------------

async function run() {
  console.log(`Smoke test of ${BASE}, screenshots in ${OUT}, phone name ${NAME}`);

  host = await launchChrome('host', HOST_PORT, 1920, 1080);
  await host.send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
  await host.send('Emulation.setFocusEmulationEnabled', { enabled: true });
  phone = await launchChrome('phone', PHONE_PORT, 390, 844);
  await phone.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
  await phone.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await phone.send('Emulation.setUserAgentOverride', {
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  });
  pass('two headless Chromes are up');

  // The lobby. ?new=1 makes host/net.ts forget any remembered room and POST /api/rooms; the client then keeps the room
  // in sessionStorage under 'olkaria.room' (host/session.ts), which is where the code is read from. The join address
  // on the lobby screen is the fallback.
  await host.navigate(`${BASE}/host/?new=1`);
  const code = await poll('the host creates a room (sessionStorage olkaria.room, or /j/CODE on the lobby)', async () => {
    const saved = await host.eval(`(() => { try { return JSON.parse(sessionStorage.getItem('olkaria.room') ?? 'null')?.code ?? null; } catch { return null; } })()`);
    if (saved) return saved;
    return /\/j\/([A-Za-z0-9]+)/.exec(await host.text())?.[1] ?? null;
  }, 30000);
  pass(`room ${code} created`);
  await poll('the host drops ?new=1 from its address', async () => !(await host.eval('location.search')).includes('new=1'), 10000);
  await poll('the lobby shows the join address', hostHas(`/j/${code}`), 15000);
  pass('the lobby shows the join address');
  await host.screenshot('00-lobby-host.png');

  // The phone joins.
  await phone.navigate(`${BASE}/j/${code}`);
  await poll('the phone shows the join form', screenIs('join'), 20000);
  await phoneFits('join form');
  await phone.eval(`(() => {
    const input = document.querySelector('#nickname');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(NAME)});
    input.dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector('.role[data-role=${ROLE}]').click();
    const team = document.querySelector('select#team');
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(team, ${JSON.stringify(TEAM)});
    team.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
  await phone.screenshot('00-join-phone.png');
  await tapPhone('[data-screen=join] button[type=submit]');
  await poll('the phone shows its waiting card', screenIs('waiting'), 15000);
  await poll(`the waiting card shows ${NAME} and ${TEAM}`, async () => has(await phone.text(), NAME) && has(await phone.text(), TEAM), 5000);
  await phoneFits('waiting');
  pass(`the phone joined as ${NAME}, ${ROLE}, ${TEAM}`);
  await phone.screenshot('00-waiting-phone.png');
  try {
    await poll(`the lobby lists ${NAME}`, hostHas(NAME), 5000);
    pass('the lobby lists the phone');
  } catch {
    console.log(`warn     the lobby text does not show ${NAME} (names may be drawn on the canvas); not a failure`);
  }

  // Space starts the game.
  await space('start the game');

  for (const [i, round] of ROUNDS.entries()) {
    const n = i + 1;
    const pick = PICKS[i];
    const pickText = round.options.find((o) => o.id === pick).text;

    // The boss arrives with the question.
    await poll(`Q${n}: the host shows the question as ${round.boss} arrives`, hostHas(round.question), 20000);
    pass(`Q${n}: ${round.boss} arrives with the question`);
    await sleep(800);   // the arrival's tween
    await host.screenshot(`q${n}-1-boss-host.png`);
    await poll(`Q${n}: the phone waits before the vote`, screenIs('waiting'), 10000);

    // Space opens the vote.
    await space(`Q${n}: open the vote`);
    await poll(`Q${n}: the phone shows the vote`, screenIs('vote'), 15000);
    const h1 = await phone.eval(`document.querySelector('[data-screen=vote] h1')?.textContent ?? ''`);
    await expect(`Q${n}: the phone's h1 is the question`, norm(h1) === norm(round.question));
    const labels = await phone.eval(`[...document.querySelectorAll('.vote[data-option]')].map((b) => [b.getAttribute('data-option'), b.textContent])`);
    await expect(`Q${n}: the phone shows A, B and C in full`, labels.length === 3 && round.options.every((o) => labels.some(([id, t]) => id === o.id && has(t, o.text))));
    await poll(`Q${n}: the host shows the open vote`, async () => {
      const t = await host.text();
      return has(t, round.question) && HOST_VOTE_OPEN.some((m) => has(t, m));
    }, 10000);
    pass(`Q${n}: the host shows the open vote`);
    await phoneFits(`Q${n} vote`);
    await sleep(500);
    await host.screenshot(`q${n}-2-vote-host.png`);
    await phone.screenshot(`q${n}-2-vote-phone.png`);

    // The phone votes; with one phone in the room, that locks the vote at once.
    await tapPhone(`.vote[data-option=${pick}]`);
    await poll(`Q${n}: the phone says "${PHONE_LOOK}"`, async () => (await screenIs('look')()) && (await phoneHas(PHONE_LOOK)()), 10000);
    await expect(`Q${n}: the phone says "You picked ${pick}." with its text`, has(await phone.text(), `You picked ${pick}.`) && has(await phone.text(), pickText));
    await phoneFits(`Q${n} look`);
    await poll(`Q${n}: the vote locks (the host says "${HOST_LOCKED}")`, hostHas(HOST_LOCKED), 10000);
    // The room locked it, so Space rests AUTO_LOCK_MS from about now.
    spaceFreeAt = Math.max(spaceFreeAt, Date.now() + AUTO_LOCK_MS + SLACK_MS);
    pass(`Q${n}: the vote locked`);
    await host.screenshot(`q${n}-3-locked-host.png`);

    if (i === 0) {
      await assertDrawing('C: call a student out');
      await press('c');
      await poll(`Q${n}: the phone says "${PHONE_CALLED}"`, async () => (await screenIs('called')()) && (await phoneHas(PHONE_CALLED)()), 10000);
      await phoneFits('called');
      await poll(`Q${n}: the host's banner names ${NAME}`, hostHas(NAME), 10000);
      pass(`Q${n}: C called ${NAME} out`);
      await host.screenshot(`q${n}-3-callout-host.png`);
      await phone.screenshot(`q${n}-3-callout-phone.png`);
      await press('y');
      // The flash is brief, so poll fast.
      await poll(`Q${n}: the host flashes "${HOST_VALID}${NAME}!"`, hostHas(`${HOST_VALID}${NAME}`), 6000, 60);
      pass(`Q${n}: Y flashed "${HOST_VALID}${NAME}!"`);
      await host.screenshot(`q${n}-3-valid-host.png`);
      await poll(`Q${n}: the phone goes back to "${PHONE_LOOK}"`, screenIs('look'), 10000);
    }

    // Space strikes; the boss dies; the split shows.
    await space(`Q${n}: strike`);
    const struckAt = Date.now();
    await sleep(KILL_MS + 600);
    await poll(`Q${n}: the host shows the split (a percentage)`, async () => HOST_PERCENT.test(await host.text()), 10000);
    pass(`Q${n}: the boss died and the split shows (${Date.now() - struckAt} ms after the strike)`);
    await screenIs('look')().then((ok) => expect(`Q${n}: the phone still says "${PHONE_LOOK}" on the split`, ok));
    await host.screenshot(`q${n}-4-split-host.png`);
    // The kill's end rests Space too (SKIP_LOCK_MS), well inside the time already waited.
    await space(n < ROUNDS.length ? `Q${n}: next boss` : `Q${n}: the ending`);
  }

  // The ending.
  await poll('the host shows "Congratulations!"', hostHas(content.ending.title), 20000);
  await poll(`the ending names ${NAME}`, hostHas(NAME), 10000);
  pass('the host shows the ending with the phone\'s name');
  const last = ROUNDS[ROUNDS.length - 1];
  const pick5 = PICKS[ROUNDS.length - 1];
  const under = await host.eval(`(() => {
    const norm = ${norm.toString()};
    const name = norm(${JSON.stringify(NAME)});
    const mine = norm(${JSON.stringify(last.options.find((o) => o.id === pick5).text)});
    const others = ${JSON.stringify(last.options.filter((o) => o.id !== pick5).map((o) => o.text))}.map(norm);
    // Some element holds the name and the picked option's text but neither other option's: the name is in that column.
    return [...document.querySelectorAll('body *')].some((el) => {
      const t = norm(el.innerText ?? el.textContent);
      return t.includes(name) && t.includes(mine) && !others.some((o) => t.includes(o));
    });
  })()`);
  await expect(`the ending lists ${NAME} under ${pick5}`, under);
  await poll('the phone shows its ending', screenIs('ending'), 10000);
  await expect('the phone says "Congratulations!"', has(await phone.text(), content.ending.title));
  const endText = await phone.text();
  await expect('the phone lists its five picks in full', ROUNDS.every((r, i) => has(endText, r.options.find((o) => o.id === PICKS[i]).text)));
  await phoneFits('ending');
  await sleep(1000);
  await host.screenshot('q6-ending-host.png');
  await phone.screenshot('q6-ending-phone.png');

  const wanted = ['join', 'waiting', 'vote', 'look', 'called', 'ending'];
  await expect(`no phone screen scrolls sideways (${[...fitsChecked].join(', ')})`, wanted.every((s) => fitsChecked.has(s)));
}

let exitCode = 1;
try {
  await run();
  exitCode = 0;
  console.log(`\nPASS: ${stepNo} checks held. Screenshots in ${OUT}`);
} catch (err) {
  console.error(`\nFAIL at check ${stepNo + 1}: ${err instanceof StepError ? err.message : err.stack}`);
  for (const cdp of [host, phone]) {
    if (!cdp) continue;
    try { await cdp.screenshot(`fail-${cdp.label}.png`); } catch { /* the page may be gone */ }
  }
  console.error(`Console output of both pages: ${consoleLog}`);
} finally {
  cleanup();
}
process.exit(exitCode);
