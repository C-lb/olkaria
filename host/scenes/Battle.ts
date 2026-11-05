// One question's boss fight (spec, "The flow"): the boss and the party on the canvas, every word in the HUD, all
// drawn from the room's phase. Travel (the boss has arrived, the vote is not open): the question. Vote: the question
// over three cards, the clock and the count. Locked: one bar per card, the call-out banner, the valid points. Reveal:
// the four strike together and the boss dies, always, within KILL_MS; then the boss lies dead and the cards keep the
// split. Space opens the vote, locks it, strikes, skips the kill, and moves on. Started with resume (a reload mid-round)
// it shows the phase as it stands, and a reveal with the boss already dead, never replaying the kill (spec 6.3). The
// music follows the phase, and the vote's theme tightens as its clock runs down (clockCues in strikers.ts).
import Phaser from 'phaser';
import type { CaseContent } from '../../shared/content';
import { shares } from '../../shared/tally';
import { ROLES, type Callout, type HostView, type Phase, type Role } from '../../shared/types';
import { buildBoss, type Boss, type BossId } from '../art/bosses';
import { PALETTE } from '../art/placeholders';
import type { Tension } from '../audio/score';
import type { Sound } from '../audio/sound';
import { oncePerEvent } from '../hotkeys';
import type { BannerArgs, Hud, OptionsArgs } from '../hud/Hud';
import type { RoomClient } from '../net';
import { tripOf, type SceneData } from '../router';
import {
  bannerFor, clockCues, CLOCK_LOCK_NOTE_MS, judgeFlash, KILL_MS, lockNoteFor, lockoutAfterLock, optionsFooter, phaseCues,
  questionFor, SEND_LOCK_MS, SKIP_LOCK_MS, SPACE_LOCK_KEY, spaceAction, timerText, validNotes, votedText,
} from '../strikers';

const hex = (colour: string): number => Number.parseInt(colour.slice(1), 16);

/** The phases this scene draws. In any other the router is about to move on. */
const PHASES: readonly Phase[] = ['travel', 'vote', 'locked', 'reveal'];
/** The boss of each question, by round index. */
const BOSSES: readonly BossId[] = ['power', 'demand', 'competition', 'risk', 'core'];

/**
 * The top of the arena floor, where everyone stands. The HUD's question and cards fill the canvas under it (hud.css,
 * .options, from y 74), so the boss (y 18 to 72) and the party (y 52 to 72) stay in full view above them.
 */
const GROUND_Y = 72;
/** The floor's one row of tiles. */
const FLOOR_H = 16;
/** The boss stands at the right edge; the banner and the flash keep to the sky between it and the party. */
const BOSS_X = 280;
/** The party, in ROLES order, facing the boss. */
const PARTY_X = [26, 48, 70, 92] as const;

/** How far the called student's figure steps forward while their call-out is pending (ms for the step). */
const STEP_PX = 8;
const STEP_MS = 150;

/**
 * The kill, about 1.9 s of KILL_MS: the four dash at the boss together (DASH_MS), strike it three times with a short
 * jab each (the hit and its sound on each), then fall back home while it dies (DIE.ms in boss-data.ts).
 */
const DASH_PX = 128;
const DASH_MS = 380;
const JAB_PX = 6;
const JAB_MS = 110;
const BACK_MS = 450;
const BACK_DELAY_MS = 200;
const STRIKES = 3;
const SHAKE_MS = 220;
const SHAKE = 0.012;
/** How often the vote clock is redrawn. */
const TICK_MS = 250;

/** Live draws the round from each view; kill plays the party's strike and the boss's death; dead holds the split. */
type Stage = 'live' | 'kill' | 'dead';

export class Battle extends Phaser.Scene {
  private round = 0;
  private resume = false;
  /** The trip the room was on when this battle started (router.ts): views of a later trip belong to the next fight. */
  private trip = 0;
  private client!: RoomClient;
  private content!: CaseContent;
  private hud!: Hud;
  /** The music and effects (audio/sound.ts); `sound` is Phaser's own. */
  private audio!: Sound;

  private boss!: Boss;
  private sprites = new Map<Role, Phaser.GameObjects.Image>();
  private homes = new Map<Role, number>();

  private stage: Stage = 'live';
  /** Ends the kill if the boss's death has not by KILL_MS. */
  private killTimer: Phaser.Time.TimerEvent | null = null;
  /** The latest view of this round, and the room's clock minus this machine's when it came. */
  private view: HostView | null = null;
  private offset = 0;
  /** No view drawn yet: a resumed scene shows a reveal with the boss dead, and nothing that was already so animates. */
  private first = true;
  /** What the HUD shows now, so a view that changes nothing it shows redraws nothing. */
  private shownScreen = '';
  private shownStatus = '';
  private shownBanner = 'null';
  /** The statuses of the round's call-outs as last drawn, to flash a valid point when a pending one is settled. */
  private judged: Callout['status'][] | null = null;
  /** The role standing forward for a pending call-out. */
  private stepped: Role | null = null;
  /**
   * The vote clock's sounds: the deadline they count to, the time left at the last tick (Infinity before the first), the
   * music's tension and whether the riser has played. All start over when a vote opens or its clock restarts.
   */
  private clockDeadline: number | null = null;
  private clockMs = Infinity;
  private tension: Tension = 0;
  private rose = false;

  constructor() {
    super('Battle');
  }

  init(data: Partial<SceneData>): void {
    this.round = data.round ?? 0;
    this.resume = data.resume ?? false;
    this.trip = data.trip ?? 0;
  }

  /**
   * Space does nothing until the game clock (which every scene's clock reads) passes this. It lives in the registry, not
   * on the scene, so it holds across the switch a `next` causes: a second press that lands after the room has answered
   * reaches the next round's Battle, which must not open that round's vote with it.
   */
  private get lockedUntil(): number {
    const until: unknown = this.registry.get(SPACE_LOCK_KEY);
    return typeof until === 'number' ? until : 0;
  }

  private set lockedUntil(until: number) {
    this.registry.set(SPACE_LOCK_KEY, until);
  }

  create(): void {
    this.client = this.registry.get('client') as RoomClient;
    this.content = this.registry.get('content') as CaseContent;
    this.hud = this.registry.get('hud') as Hud;
    this.audio = this.registry.get('sound') as Sound;
    this.hud.clear();
    this.stage = 'live';
    this.killTimer = null;
    this.view = null;
    this.offset = 0;
    this.first = true;
    this.shownScreen = '';
    this.shownStatus = '';
    this.shownBanner = 'null';
    this.judged = null;
    this.stepped = null;
    this.clockDeadline = null;
    this.clockMs = Infinity;
    this.tension = 0;
    this.rose = false;
    this.sprites = new Map();
    this.homes = new Map();

    this.drawArena();
    this.registry.events.on('changedata-view', this.onView, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.registry.events.off('changedata-view', this.onView, this);
    });
    this.input.keyboard?.on('keydown-SPACE', oncePerEvent((event: KeyboardEvent) => {
      if (!event.repeat) this.onSpace();
    }));
    this.time.addEvent({ delay: TICK_MS, loop: true, callback: () => this.tickClock() });
    this.onView(null, (this.registry.get('view') as HostView | null | undefined) ?? null);
  }

  // ---- The world ------------------------------------------------------------------------------------------

  private drawArena(): void {
    // One row of floor tiles over flat stone: stacked rows of the tile would stripe the lower canvas like a wall.
    this.add.tileSprite(0, GROUND_Y, 320, FLOOR_H, 'tile-ground').setOrigin(0, 0).setDepth(0);
    this.add.rectangle(0, GROUND_Y + FLOOR_H, 320, 180 - GROUND_Y - FLOOR_H, hex(PALETTE.stoneDeep)).setOrigin(0, 0).setDepth(0);
    this.boss = buildBoss(this, BOSSES[Math.min(BOSSES.length - 1, Math.max(0, this.round))], BOSS_X, GROUND_Y).setDepth(10);
    this.boss.idle();
    ROLES.forEach((role, i) => {
      this.homes.set(role, PARTY_X[i]);
      this.sprites.set(role, this.add.image(PARTY_X[i], GROUND_Y, `class-${role}`).setOrigin(0.5, 1).setDepth(20));
    });
  }

  /** Everyone back where they stand, and no one stepped forward. Leaves the boss alone. */
  private home(): void {
    for (const [role, sprite] of this.sprites) {
      this.tweens.killTweensOf(sprite);
      sprite.setPosition(this.homes.get(role) ?? sprite.x, GROUND_Y);
    }
    this.stepped = null;
  }

  /** The figure of the student called out steps forward; the one before steps back. Null steps everyone back. */
  private stepForward(role: Role | null, animate: boolean): void {
    if (role === this.stepped) return;
    const move = (r: Role, dx: number): void => {
      const sprite = this.sprites.get(r);
      const home = this.homes.get(r);
      if (sprite === undefined || home === undefined) return;
      this.tweens.killTweensOf(sprite);
      if (animate) this.tweens.add({ targets: sprite, x: home + dx, duration: STEP_MS, ease: 'Quad.easeOut' });
      else sprite.x = home + dx;
    };
    if (this.stepped !== null) move(this.stepped, 0);
    if (role !== null) move(role, STEP_PX);
    this.stepped = role;
  }

  // ---- Views ----------------------------------------------------------------------------------------------

  private onView(_parent: unknown, view: HostView | null): void {
    // No view, or another round, phase or trip: the router is about to move on. A goto to this same round is a new trip.
    if (view === null || view.round !== this.round || !PHASES.includes(view.phase) || tripOf(view) !== this.trip) return;
    const was = this.view?.phase ?? null;
    this.view = view;
    // The room locks the vote at 0:00, or the moment the last player votes, maybe just before a Space meant to lock it:
    // Space rests on any move from vote to locked (lockoutAfterLock), and when the clock or the last vote did the locking
    // a note says why the next press does nothing.
    const until = lockoutAfterLock(was, view.phase, this.lockedUntil, this.time.now);
    if (until !== this.lockedUntil) this.lockedUntil = until;
    const note = lockNoteFor(was, view);
    if (note !== null) this.hud.showToast(note, CLOCK_LOCK_NOTE_MS);
    this.offset = view.serverNow - Date.now();
    const first = this.first;
    this.first = false;
    if (view.phase === 'reveal') {
      if (this.stage === 'live') {
        if (first && this.resume) this.lieDead(false);
        else this.kill();
      } else {
        this.showCards(view);   // a later view of the reveal (names hidden, say): the split as it stands
      }
      return;
    }
    if (this.stage !== 'live') return;   // the router is about to move on
    this.cuePhase(was, view);
    const callouts = view.callouts[this.round] ?? [];
    this.flashJudgements(callouts, view);
    this.stepForward(this.calledRole(view, callouts), !first);
    if (view.phase === 'travel') {
      const args = questionFor(this.content, this.round);
      this.screen(JSON.stringify(['question', args]), () => this.hud.showQuestion(args));
      return;
    }
    this.showCards(view);
    this.banner(bannerFor(callouts, view.players));   // still up in a vote reopened over it
  }

  /**
   * The music for the phase, on the view that moves into it (phaseCues). When the vote's clock starts again (the vote
   * opens, or R reopens it) the theme loosens, and the ticks and the riser are due again.
   */
  private cuePhase(was: Phase | null, view: HostView): void {
    const cue = phaseCues(was, view.phase, view.voteDeadline !== this.clockDeadline);
    if (cue.clock) {
      this.clockDeadline = view.voteDeadline;
      this.clockMs = Infinity;
      this.tension = 0;
      this.rose = false;
    }
    if (cue.sfx !== null) this.audio.sfx(cue.sfx);
    if (cue.music !== null) this.audio.music(cue.music);
    if (cue.clock) this.audio.tension(0);
  }

  /** The role of the student a pending call-out names, if they are still in the room. */
  private calledRole(view: HostView, callouts: readonly Callout[]): Role | null {
    const id = callouts.find((co) => co.status === 'pending')?.playerId ?? null;
    return id !== null && Object.hasOwn(view.players, id) ? view.players[id].role : null;
  }

  /**
   * "Valid point, Ann!", with its jingle, for each call-out judged valid since the last view (N flashes nothing), and
   * the call-out fanfare for each one made since. Nothing for the ones made or judged before this scene.
   */
  private flashJudgements(callouts: readonly Callout[], view: HostView): void {
    const was = this.judged;
    this.judged = callouts.map((co) => co.status);
    if (was === null) return;
    callouts.forEach((co, i) => {
      if (was[i] !== 'pending' && co.status === 'pending') this.audio.sfx('callout');
      if (was[i] !== 'pending' || co.status === 'pending') return;
      const flash = judgeFlash(co, view.players, co.status === 'awarded');
      if (flash === null) return;
      this.hud.showFlash(flash);
      this.audio.sfx('rallyYes');
    });
  }

  /** Puts up a HUD screen unless it is up already; every screen but the cards takes the banner down. True if it drew. */
  private screen(sig: string, draw: () => void, keepsBanner = false): boolean {
    if (sig === this.shownScreen) return false;
    this.shownScreen = sig;
    draw();
    if (!keepsBanner) this.shownBanner = 'null';
    return true;
  }

  private banner(args: BannerArgs | null): void {
    const sig = JSON.stringify(args);
    if (sig === this.shownBanner) return;
    this.shownBanner = sig;
    this.hud.showBanner(args);
  }

  /**
   * The question over the three cards: bare while the vote is open, one bar each once it is locked (and through the
   * kill and after it), under a hint that says what the keys do now. The clock and the count are patched in place.
   */
  private showCards(view: HostView): void {
    const round = this.content.rounds[Math.min(this.content.rounds.length - 1, Math.max(0, this.round))];
    const callouts = view.callouts[this.round] ?? [];
    const args: OptionsArgs = {
      eyebrow: questionFor(this.content, this.round).eyebrow,
      question: round.question,
      options: round.options.map((o) => ({ letter: o.id, text: o.text })),
      timerText: this.clock(view),
      votedText: this.voted(view),
      split: view.phase === 'vote' ? null : { shares: shares(view.tally), counts: view.tally },
      // During the kill Space skips it, so no hint says otherwise.
      footer: this.stage === 'kill' ? '' : optionsFooter(this.content, view),
      called: validNotes(callouts, view.players),
    };
    const { timerText: clock, votedText: count, ...cards } = args;
    const status = JSON.stringify([clock, count]);
    if (this.screen(JSON.stringify(['options', cards]), () => this.hud.showOptions(args), true)) {
      this.shownStatus = status;
    } else if (status !== this.shownStatus) {
      this.shownStatus = status;
      this.hud.updateOptionsStatus(args);
    }
  }

  /** The time left as m:ss while the vote is open, by the room's clock; nothing once it is locked. */
  private clock(view: HostView): string {
    return view.phase === 'vote' ? timerText(view.voteDeadline, Date.now() + this.offset) : '';
  }

  /** Who is still to vote while the vote is open, who voted once it is locked. */
  private voted(view: HostView): string {
    const players = Object.keys(view.players).length;
    return votedText(view.tally, players, view.synthetic[this.round], { offline: this.client.mode === 'offline', open: view.phase === 'vote' });
  }

  /** Counts the clock down between views, which come only when something changes, and sounds it (cueClock). */
  private tickClock(): void {
    const view = this.view;
    if (this.stage !== 'live' || view === null || view.phase !== 'vote') return;
    this.cueClock(view);
    const timer = this.clock(view);
    const voted = this.voted(view);
    const status = JSON.stringify([timer, voted]);
    if (status === this.shownStatus) return;
    this.shownStatus = status;
    this.hud.updateOptionsStatus({ timerText: timer, votedText: voted });
  }

  /**
   * The clock's sounds since the last tick (clockCues): the theme tightens when the tension level rises, a tick on each
   * second from 10 down to 1, a high tick between the last three, and the riser once a vote as 3 s is crossed.
   */
  private cueClock(view: HostView): void {
    if (view.voteDeadline === null) return;
    const remaining = view.voteDeadline - (Date.now() + this.offset);
    const cues = clockCues(this.clockMs, remaining);
    this.clockMs = remaining;
    if (cues.tension > this.tension) {
      this.tension = cues.tension;
      this.audio.tension(cues.tension);
    }
    if (cues.tick) this.audio.sfx('tick');
    if (cues.tickHigh) this.audio.sfx('tickHigh');
    if (cues.riser && !this.rose) {
      this.rose = true;
      this.audio.sfx('riser');
    }
  }

  // ---- Space ----------------------------------------------------------------------------------------------

  /** spaceAction decides; the rest is set before a send, because offline the answer arrives inside send(). */
  private onSpace(): void {
    if (this.view === null) return;
    const action = spaceAction({
      phase: this.view.phase, busy: false, killing: this.stage === 'kill', lockedUntil: this.lockedUntil, time: this.time.now,
    });
    if (action.kind === 'none') return;
    if (action.kind === 'skip') {
      this.lockedUntil = this.time.now + SKIP_LOCK_MS;
      this.lieDead(true);
      return;
    }
    this.lockedUntil = this.time.now + SEND_LOCK_MS;
    this.client.send(action.cmd);
  }

  // ---- The kill -------------------------------------------------------------------------------------------

  /**
   * The whole party dashes at the boss, strikes three times, and falls back while the boss dies, whatever the vote.
   * Each strike flashes the boss with the hit sound under it. Done when the boss is gone, or at KILL_MS at the latest.
   */
  private kill(): void {
    this.stage = 'kill';
    this.audio.music('strike');
    this.banner(null);
    if (this.view !== null) this.showCards(this.view);
    this.home();
    this.boss.reset();
    let struck = 0;
    const strike = (): void => {
      struck += 1;
      this.boss.hit();
      this.audio.hit(struck, STRIKES);
    };
    const party = [...this.sprites.values()];
    this.tweens.chain({
      targets: party,
      tweens: [
        { x: `+=${DASH_PX}`, duration: DASH_MS, ease: 'Quad.easeIn', onComplete: strike },
        { x: `-=${JAB_PX}`, duration: JAB_MS, ease: 'Quad.easeOut' },
        { x: `+=${JAB_PX}`, duration: JAB_MS, ease: 'Quad.easeIn', onComplete: strike },
        { x: `-=${JAB_PX}`, duration: JAB_MS, ease: 'Quad.easeOut' },
        {
          x: `+=${JAB_PX}`, duration: JAB_MS, ease: 'Quad.easeIn',
          onComplete: () => {
            strike();
            this.cameras.main.shake(SHAKE_MS, SHAKE);
            this.boss.die(() => this.lieDead(true));
          },
        },
        { x: `-=${DASH_PX}`, duration: BACK_MS, delay: BACK_DELAY_MS, ease: 'Quad.easeOut' },
      ],
    });
    this.killTimer = this.time.delayedCall(KILL_MS, () => this.lieDead(true));
  }

  /**
   * The end of the kill, played out, skipped or never shown (a resumed reveal, `struck` false): the boss lies dead,
   * the party is home, the cards keep the split with the reveal's hint. After a kill the closing chord sounds and Space
   * rests a moment, so the press that skipped it cannot also go on.
   */
  private lieDead(struck: boolean): void {
    if (this.stage === 'dead') return;
    this.stage = 'dead';
    this.killTimer?.remove();
    this.killTimer = null;
    this.home();
    this.boss.lieDead();
    if (struck) {
      this.lockedUntil = Math.max(this.lockedUntil, this.time.now + SKIP_LOCK_MS);
      this.audio.sfx('strikeEnd');
    }
    this.audio.music('debrief');
    this.banner(null);
    if (this.view !== null) this.showCards(this.view);
  }
}
