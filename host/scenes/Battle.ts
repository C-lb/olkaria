// One round's battle (spec 3.2, 4.3): the boss, the party and the HP bar on the canvas, every word in the HUD, all
// drawn from the room's phase. Travel (arrived, vote not open): the narration. Vote: the cards, the clock, the count.
// Locked: two bars per card, the call-out banner, the judged call-outs. Reveal: the special attack, whose numbers add up
// to what the HP drains, then the debrief. Space opens the vote, locks it, reveals, skips the strike, and moves on.
// Started with resume (a reload mid-round) it shows the phase as it stands, and a reveal as its debrief, never
// replaying the strike (spec 6.3).
import Phaser from 'phaser';
import type { CaseContent } from '../../shared/content';
import { shares } from '../../shared/scoring';
import type { Callout, DamageResult, HostView, Phase, Role } from '../../shared/types';
import { buildBoss, type Boss, type BossId } from '../art/bosses';
import { PALETTE } from '../art/placeholders';
import { oncePerEvent } from '../hotkeys';
import { OPTION_COLORS, type BannerArgs, type Hud, type OptionsArgs } from '../hud/Hud';
import type { RoomClient } from '../net';
import { tripOf, type SceneData } from '../router';
import {
  bannerFor, beatsFor, classFor, CLOCK_LOCK_NOTE_MS, debriefFor, DRAIN_MS, judgedNotes, judgeFlash,
  labelFor, lockNoteFor, lockoutAfterLock, lungeReach, narrationFor, optionsFooter, SKIP_LOCK_MS, SPACE_LOCK_KEY,
  spaceAction, strikePlan, timerText, votedText,
  type Stand, type StrikePlan,
} from '../strikers';
import { HpBar } from '../ui/HpBar';

const hex = (colour: string): number => Number.parseInt(colour.slice(1), 16);

/** The phases this scene draws. In any other the router is about to move on. */
const PHASES: readonly Phase[] = ['travel', 'vote', 'locked', 'reveal'];
/** The boss of each round, by round index. */
const BOSSES: readonly BossId[] = ['grid', 'debt', 'fog', 'core'];

/** The top of the arena floor, where everyone stands: just above the HUD's status line, so the cards never hide the party. */
const GROUND_Y = 84;
/** The floor's one row of tiles. */
const FLOOR_H = 16;
/** The boss stands at the right edge, so the HP bar over it is clear of the banner, which is centred and at most about 200 px wide. */
const BOSS_X = 280;
/** The party stands left of the boss and faces it: the lead class in front, the other three behind in role order. */
const LEAD_X = 104;
const SUPPORT_X = [30, 52, 74] as const;
const HP_X = BOSS_X - 20;
const HP_Y = 18;
const HP_W = 52;
/**
 * The damage numbers rise in the open space between the party and the boss, above the sprites: x from about 111 to 200
 * (the lead's rest box ends at 110, the boss's box starts at 240), bottoms from y 48 up to 38, while no sprite reaches
 * above y 52 (the lead at its dash peak is 32 px tall on the floor at 84). So a number never covers the boss or a sprite.
 */
const NUMBER_X = 172;
const NUMBER_DX = [-22, 0, 22] as const;
const NUMBER_Y = 48;
const NUMBER_RISE = 10;

/** How far the called student's class steps forward while their call-out is pending (ms for the step). */
const STEP_PX = 8;
const STEP_MS = 150;
/** How far each kind of strike would lunge toward the boss; support and rally lunges stop CLEAR_PX short of the sprite in front. */
const LUNGE_LEAD = 112;
const LUNGE_SUPPORT = 20;
const LUNGE_RALLY = 28;
const CLEAR_PX = 2;
const HOP_PX = 6;
const SHAKE_MS = 200;
/** How often the vote clock is redrawn. */
const TICK_MS = 250;

/** Live draws the round from each view; strike plays the special attack; debrief holds the debrief until the router moves on. */
type Stage = 'live' | 'strike' | 'debrief';

export class Battle extends Phaser.Scene {
  private round = 0;
  private resume = false;
  /** The trip the room was on when this battle started (router.ts): views of a later trip belong to the next road. */
  private trip = 0;
  private client!: RoomClient;
  private content!: CaseContent;
  private hud!: Hud;

  private boss!: Boss;
  private sprites = new Map<Role, Phaser.GameObjects.Image>();
  private homes = new Map<Role, number>();
  private hp!: HpBar;
  /** Damage numbers still on the canvas, dropped when a skip cuts the strike short. */
  private numbers = new Set<Phaser.GameObjects.BitmapText>();
  /** What the strike's tween chain moves from beat to beat. */
  private readonly beat = { t: 0 };

  private stage: Stage = 'live';
  /** True while the special attack plays: Space then skips to the debrief. */
  private busy = false;
  /** The reveal being struck, for a skip. */
  private striking: { view: HostView; d: DamageResult } | null = null;
  /** The latest view of this round, and the room's clock minus this machine's when it came. */
  private view: HostView | null = null;
  private offset = 0;
  /** No view drawn yet: a resumed scene shows a reveal as its debrief, and nothing that was already so animates. */
  private first = true;
  /** What the HUD shows now, so a view that changes nothing it shows redraws nothing. */
  private shownScreen = '';
  private shownStatus = '';
  private shownBanner = 'null';
  /** The statuses of the round's call-outs as last drawn, to flash a judgement when a pending one is settled. */
  private judged: Callout['status'][] | null = null;
  /** The class standing forward for a pending call-out. */
  private stepped: Role | null = null;

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
    this.hud.clear();
    this.stage = 'live';
    this.busy = false;
    this.striking = null;
    this.view = null;
    this.offset = 0;
    this.first = true;
    this.shownScreen = '';
    this.shownStatus = '';
    this.shownBanner = 'null';
    this.judged = null;
    this.stepped = null;
    this.sprites = new Map();
    this.homes = new Map();
    this.numbers = new Set();

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
    const { lead, support } = classFor(this.content, this.round);
    // One row of floor tiles over flat stone: stacked rows of the tile would stripe the lower canvas like a wall.
    this.add.tileSprite(0, GROUND_Y, 320, FLOOR_H, 'tile-ground').setOrigin(0, 0).setDepth(0);
    this.add.rectangle(0, GROUND_Y + FLOOR_H, 320, 180 - GROUND_Y - FLOOR_H, hex(PALETTE.stoneDeep)).setOrigin(0, 0).setDepth(0);
    this.boss = buildBoss(this, BOSSES[Math.min(BOSSES.length - 1, Math.max(0, this.round))], BOSS_X, GROUND_Y).setDepth(10);
    this.idle();
    const stand = (role: Role, x: number): void => {
      this.homes.set(role, x);
      this.sprites.set(role, this.add.image(x, GROUND_Y, `class-${role}`).setOrigin(0.5, 1).setDepth(20));
    };
    stand(lead, LEAD_X);
    support.forEach((role, i) => stand(role, SUPPORT_X[i] ?? SUPPORT_X[0]));
    const { roundHp } = this.content.scoring;
    this.hp = new HpBar(this, HP_X, HP_Y, HP_W, roundHp, this.content.rounds.length * roundHp).setDepth(30);
  }

  /** The boss's idle loop (bosses.ts), from where it stands; again after a skip has killed every tween. */
  private idle(): void {
    this.boss.idle();
  }

  /** Everyone back where they stand, untinted, and no damage numbers left. Leaves the boss's breathing alone. */
  private rest(): void {
    for (const [role, sprite] of this.sprites) {
      this.tweens.killTweensOf(sprite);
      sprite.setPosition(this.homes.get(role) ?? sprite.x, GROUND_Y).setScale(1).clearTint();
    }
    this.stepped = null;
    for (const n of this.numbers) n.destroy();
    this.numbers.clear();
    this.boss.reset();
  }

  /** The class of the student called out steps forward; the one before steps back. Null steps everyone back. */
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
    if (this.stage !== 'live') return;   // the strike, then the debrief, keep the screen until the router moves on
    if (view.phase === 'reveal') {
      const d = view.damageLog[this.round];
      if (d === undefined) return;
      if (first && this.resume) this.debrief(view, d, false);
      else this.strike(view, d);
      return;
    }
    const callouts = view.callouts[this.round] ?? [];
    this.flashJudgements(callouts);
    this.stepForward(this.calledRole(view, callouts), !first);
    this.hp.set(this.content.scoring.roundHp, view.bossHp);
    if (view.phase === 'travel') {
      const args = narrationFor(this.content, this.round);
      this.screen(JSON.stringify(['narration', args]), () => this.hud.showNarration(args));
      return;
    }
    this.showCards(view);
    this.banner(bannerFor(this.content, this.round, callouts, view.players));   // still up in a vote reopened over it
  }

  /** The class of the student a pending call-out names, if they are still in the room. */
  private calledRole(view: HostView, callouts: readonly Callout[]): Role | null {
    const id = callouts.find((co) => co.status === 'pending')?.playerId ?? null;
    return id !== null && Object.hasOwn(view.players, id) ? view.players[id].role : null;
  }

  /** "+10 rally" or "no bonus" for each call-out judged since the last view. Nothing for the ones judged before this scene. */
  private flashJudgements(callouts: readonly Callout[]): void {
    const was = this.judged;
    this.judged = callouts.map((co) => co.status);
    if (was === null) return;
    callouts.forEach((co, i) => {
      if (was[i] === 'pending' && co.status !== 'pending') this.hud.flashRally(judgeFlash(this.content, co.status === 'awarded'));
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
   * The cards: bare while the vote is open, with both groups' bars once it is locked (and through the strike), under a
   * hint that says what the keys do now. The clock and the count are patched in place.
   */
  private showCards(view: HostView): void {
    const locked = view.phase !== 'vote';
    const callouts = view.callouts[this.round] ?? [];
    const args: OptionsArgs = {
      options: this.content.rounds[this.round].options.map((o) => ({ letter: o.id, screen: o.screen })),
      leadLabel: labelFor(this.content, classFor(this.content, this.round).lead, true),
      timerText: this.clock(view),
      votedText: this.voted(view),
      leadShares: locked ? shares(view.leadTally) : null,
      supportShares: locked ? shares(view.supportTally) : null,
      footer: optionsFooter(this.content, view.phase, callouts),
      resolved: judgedNotes(this.content, callouts, view.players),
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

  /** Counts the clock down between views, which come only when something changes. */
  private tickClock(): void {
    const view = this.view;
    if (this.stage !== 'live' || view === null || view.phase !== 'vote') return;
    const timer = this.clock(view);
    const voted = this.voted(view);
    const status = JSON.stringify([timer, voted]);
    if (status === this.shownStatus) return;
    this.shownStatus = status;
    this.hud.updateOptionsStatus({ timerText: timer, votedText: voted });
  }

  // ---- Space ----------------------------------------------------------------------------------------------

  /** spaceAction decides; the lockout is set before a send, because offline the answer arrives inside send(). */
  private onSpace(): void {
    if (this.view === null) return;
    const action = spaceAction({
      phase: this.view.phase, busy: this.busy, onDebrief: this.stage === 'debrief', lockedUntil: this.lockedUntil, time: this.time.now,
    });
    if (action.kind === 'ignore') return;
    this.lockedUntil = action.lockedUntil;
    if (action.kind === 'skip') this.skip();
    else this.client.send(action.cmd);
  }

  /** Space during the strike: every tween stops, everyone is back in place, the strike's toast goes, the debrief shows. */
  private skip(): void {
    const striking = this.striking;
    this.tweens.killAll();
    this.rest();
    this.idle();
    this.hud.clearTimedToast();
    if (striking !== null) this.debrief(striking.view, striking.d, true);
  }

  // ---- The special attack ---------------------------------------------------------------------------------

  /**
   * Plays the round's strikes in order as one tween chain, a beat each, then drains the HP by the round's damage with a
   * shake, then the debrief: 6 s at most in all, the 1.5 s drain included (beatsFor).
   */
  private strike(view: HostView, d: DamageResult): void {
    this.stage = 'strike';
    this.busy = true;
    this.striking = { view, d };
    this.banner(null);
    this.showCards(view);
    this.rest();
    this.hp.set(this.content.scoring.roundHp, view.bossHp + d.total);   // the bar as it stood before the strike
    const plan = strikePlan(d, this.content, this.round, view.callouts[this.round] ?? [], view.players);
    const beats = beatsFor(plan);
    // A toast for a strike that does not happen stays until the strikes are over, never over the debrief.
    const untilStrikesEnd = beats.map((_, i) => beats.slice(i).reduce((sum, ms) => sum + ms, 0));
    this.tweens.chain({
      targets: this.beat,
      tweens: [
        ...plan.map((step, i) => ({ t: { from: 0, to: 1 }, duration: beats[i], onStart: () => this.play(step, beats[i], i, untilStrikesEnd[i]) })),
        { t: { from: 0, to: 1 }, duration: DRAIN_MS, onStart: () => this.drain(view, d) },
      ],
      onComplete: () => this.debrief(view, d, true),
    });
  }

  /** One beat: a toast for a strike that does not happen, else its strikers move, the boss is hit and its number rises. */
  private play(step: StrikePlan[number], ms: number, i: number, toastMs: number): void {
    if (step.kind === 'skip') {
      this.hud.showToast(step.toast, toastMs);
      return;
    }
    if (step.label !== null) this.hud.flashRally(step.label, ms);
    const colour = step.colour === null ? null : hex(OPTION_COLORS[step.colour]);
    const strikers = step.by.flatMap((role) => this.sprites.get(role) ?? []);
    const impact = (): void => {
      if (colour !== null) for (const sprite of strikers) sprite.setTintFill(colour);
      this.hitBoss();
      this.pop(step.figure, colour ?? hex(PALETTE.amber), i, step.kind === 'lead' ? 3 : 2);
    };
    switch (step.kind) {
      case 'lead': this.lunge(strikers, this.reach(step.by, LUNGE_LEAD), 2, ms, impact); break;   // the special attack: a long dash, twice the size
      case 'support': this.lunge(strikers, this.reach(step.by, LUNGE_SUPPORT), 1, ms, impact); break;
      case 'rally': this.lunge(strikers, this.reach(step.by, LUNGE_RALLY), 1, ms, impact); break;
      default: this.hop(strikers, ms, impact); break;   // a flourish: the whole party jumps
    }
  }

  /** How far these classes can lunge, up to `want`, and stop CLEAR_PX short of any sprite standing in front of them. */
  private reach(roles: readonly Role[], want: number): number {
    const stands: Stand[] = [...this.homes].map(([role, x]) => ({ role, x, w: this.sprites.get(role)?.width ?? 0 }));
    return lungeReach(stands, roles, want, CLEAR_PX);
  }

  /** Out to the boss, the impact, a hold, and back. */
  private lunge(targets: Phaser.GameObjects.Image[], dx: number, scale: number, ms: number, impact: () => void): void {
    if (targets.length === 0) {
      impact();
      return;
    }
    this.tweens.chain({
      targets,
      tweens: [
        { x: `+=${dx}`, scale, duration: ms * 0.35, ease: 'Quad.easeIn', onComplete: impact },
        {
          x: `-=${dx}`, scale: 1, duration: ms * 0.35, delay: ms * 0.15, ease: 'Quad.easeOut',
          onComplete: () => { for (const t of targets) t.clearTint(); },
        },
      ],
    });
  }

  private hop(targets: Phaser.GameObjects.Image[], ms: number, impact: () => void): void {
    this.tweens.chain({
      targets,
      tweens: [
        { y: GROUND_Y - HOP_PX, duration: ms * 0.25, ease: 'Quad.easeOut', onComplete: impact },
        { y: GROUND_Y, duration: ms * 0.25, ease: 'Quad.easeIn' },
      ],
    });
  }

  /** The boss flashes bone and recoils (bosses.ts). */
  private hitBoss(): void {
    this.boss.hit();
  }

  /**
   * A damage number in the digits font: light ink inside a 1 px outline in the strike's colour, rising in the open space
   * between the party and the boss, then fading.
   */
  private pop(figure: string, colour: number, i: number, scale: number): void {
    const x = NUMBER_X + NUMBER_DX[i % NUMBER_DX.length];
    const make = (dx: number, dy: number, tint: number, depth: number): Phaser.GameObjects.BitmapText =>
      this.add.bitmapText(x + dx, NUMBER_Y + dy, 'digits', figure).setOrigin(0.5, 1).setScale(scale).setTint(tint).setDepth(depth);
    const ring: readonly (readonly [number, number])[] = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];
    const all = [...ring.map(([dx, dy]) => make(dx, dy, colour, 40)), make(0, 0, hex(PALETTE.bone), 41)];
    for (const n of all) this.numbers.add(n);
    this.tweens.chain({
      targets: all,
      tweens: [
        { y: `-=${NUMBER_RISE}`, duration: 500, ease: 'Quad.easeOut' },
        {
          alpha: 0, duration: 400, delay: 300,
          onComplete: () => { for (const n of all) { this.numbers.delete(n); n.destroy(); } },
        },
      ],
    });
  }

  private drain(view: HostView, d: DamageResult): void {
    this.hp.set(this.content.scoring.roundHp - d.total, view.bossHp, DRAIN_MS);
    if (d.total > 0) this.cameras.main.shake(SHAKE_MS, 0.01);
  }

  /** The debrief, with the HP drained at once if the strike did not get there. After a strike, Space rests a moment. */
  private debrief(view: HostView, d: DamageResult, struck: boolean): void {
    this.stage = 'debrief';
    this.busy = false;
    this.striking = null;
    if (struck) this.lockedUntil = Math.max(this.lockedUntil, this.time.now + SKIP_LOCK_MS);
    this.hp.set(this.content.scoring.roundHp - d.total, view.bossHp);
    const args = debriefFor(d, this.content, this.round, view.callouts[this.round] ?? [], view.players);
    this.screen(JSON.stringify(['debrief', args]), () => this.hud.showDebrief(args));
  }
}
