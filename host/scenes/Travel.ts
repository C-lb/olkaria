// The road between battles (spec 4.5): a short platformer the lead class of the coming round runs, the other three
// classes trailing it. An exhibit on the way is a case figure: touching one sends it to the room, where it adds an
// "Exhibit +5" flourish to the coming strike, and shows it as a toast. The gate at the end, or N, starts the round's
// Battle. A toggles an auto-run along the segment's baked path, and any arrow key takes control back. No text on the
// canvas: a sticky toast names the boss ahead and the class that leads. A reload mid-travel starts the segment over,
// and the exhibits the room already counts are not offered again.
import Phaser from 'phaser';
import type { CaseContent } from '../../shared/content';
import type { HostView } from '../../shared/types';
import { PALETTE } from '../art/placeholders';
import type { Hud } from '../hud/Hud';
import { autoStep, groundUnder, GROUND_Y, JUMP_SPEED, RUN_SPEED, SEGMENTS, START_X, stopAhead, TILE, type Segment } from '../levels/road';
import type { RoomClient } from '../net';
import type { SceneData } from '../router';
import { classFor, labelFor, SEND_LOCK_MS } from '../strikers';

const hex = (colour: string): number => Number.parseInt(colour.slice(1), 16);

/** The registry key of the Battle's Space lockout. Set as the Battle starts, so a jump pressed at the gate cannot open the vote. */
const LOCK_KEY = 'spaceLockedUntil';
/** The other three follow the lead's feet as they were this long ago, a slot apart, behind the way it faced then. */
const TRAIL_MS = 200;
const SLOT_PX = 12;
/** How quickly a follower closes on its spot: the time constant of its easing, in ms. */
const FOLLOW_MS = 60;
/** How many lead positions the trail keeps, one per frame: 200 ms at up to 240 frames a second, with room over. */
const TRAIL_SIZE = 64;
/** The gate's doorway, between its pillars: stepping into it starts the battle. */
const DOOR_W = 20;
const DOOR_H = 38;
/** How far below a ledge's top the lead's feet may have been on the step before and still land on it (rounding). */
const LANDING_SLOP = 1;
/** An exhibit bobs this high over the spot it rests on, up and back in twice BOB_MS. */
const BOB_PX = 2;
const BOB_MS = 700;
/** How closely the camera follows the lead, from 0 (never) to 1 (locked on). */
const CAMERA_LERP = 0.15;
/** Draw order: the road and its ledges, the gate, the exhibits, the three behind, the lead in front. */
const DEPTH = { road: 0, gate: 1, exhibit: 2, party: 3, lead: 4 } as const;

type Exhibit = CaseContent['exhibits'][number][number];

/** Where the lead's feet were at time `t`, whether it faced left, and whether it stood on something. */
interface Footprint { t: number; x: number; y: number; left: boolean; grounded: boolean }

/** The lead's latest TRAIL_SIZE footprints, in a ring. */
class Trail {
  private readonly prints: Footprint[] = [];
  private head = 0;

  push(print: Footprint): void {
    this.prints[this.head] = print;
    this.head = (this.head + 1) % TRAIL_SIZE;
  }

  /** The newest footprint at least `ms` older than `t`, or the oldest one kept while the trail is younger than that. */
  at(t: number, ms: number): Footprint | undefined {
    let found: Footprint | undefined;
    let oldest: Footprint | undefined;
    for (const print of this.prints) {
      if (oldest === undefined || print.t < oldest.t) oldest = print;
      if (print.t <= t - ms && (found === undefined || print.t > found.t)) found = print;
    }
    return found ?? oldest;
  }
}

export class Travel extends Phaser.Scene {
  private round = 0;
  private client!: RoomClient;
  private content!: CaseContent;
  private hud!: Hud;
  private segment!: Segment;
  private lead!: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  /** The three support classes, in role order, nearest the lead first, and the height each one stands at or is making for. */
  private party: Phaser.GameObjects.Image[] = [];
  private stands: number[] = [];
  private trail = new Trail();
  private keys: Phaser.Types.Input.Keyboard.CursorKeys | null = null;
  /** The exhibits still on the road, by id, each with the overlap that picks it up. */
  private exhibits = new Map<string, { sprite: Phaser.GameObjects.Image; overlap: Phaser.Physics.Arcade.Collider }>();
  /** "Travel 1: Grid Wyrm ahead. Rogues lead.", kept in the HUD's sticky toast slot. */
  private label = '';
  /** Whether auto-run is on, and the first stop of the path it has not reached yet. */
  private auto = false;
  private nextStop = 0;
  /** Set once the gate or N has started the Battle: nothing else happens here after that. */
  private leaving = false;

  constructor() {
    super('Travel');
  }

  /** A resumed travel is no different: the segment starts over, and create() leaves out the exhibits the room already has. */
  init(data: Partial<SceneData>): void {
    this.round = data.round ?? 0;
  }

  create(): void {
    this.client = this.registry.get('client') as RoomClient;
    this.content = this.registry.get('content') as CaseContent;
    this.hud = this.registry.get('hud') as Hud;
    this.hud.clear();
    const index = Math.min(SEGMENTS.length - 1, Math.max(0, this.round));   // the room only travels in rounds 0 to 3
    this.segment = SEGMENTS[index];
    this.party = [];
    this.stands = [];
    this.trail = new Trail();
    this.exhibits = new Map();
    this.auto = false;
    this.nextStop = 0;
    this.leaving = false;

    const { lead, support } = classFor(this.content, this.round);
    this.label = `Travel ${this.round + 1}: ${this.content.rounds[index].boss} ahead. ${labelFor(this.content, lead, true)} lead.`;
    this.hud.showToast(this.label, 0);

    const { width, gateX } = this.segment;
    const height = this.scale.height;
    this.physics.world.setBounds(0, 0, width, height);
    this.cameras.main.setBounds(0, 0, width, height);
    const { road, ledges } = this.lay(height);
    this.add.image(gateX, GROUND_Y, 'gate').setOrigin(0.5, 1).setDepth(DEPTH.gate);
    const door = this.add.zone(gateX, GROUND_Y - DOOR_H / 2, DOOR_W, DOOR_H);
    this.physics.add.existing(door, true);

    this.lead = this.physics.add.sprite(START_X, GROUND_Y, `class-${lead}`).setOrigin(0.5, 1).setDepth(DEPTH.lead).setCollideWorldBounds(true);
    support.forEach((role, i) => {
      this.party.push(this.add.image(START_X - SLOT_PX * (i + 1), GROUND_Y, `class-${role}`).setOrigin(0.5, 1).setDepth(DEPTH.party));
      this.stands.push(GROUND_Y);
    });
    this.physics.add.collider(this.lead, road);
    this.physics.add.collider(this.lead, ledges, undefined, (_lead, ledge) => this.landsOn(ledge));
    this.physics.add.overlap(this.lead, door, () => this.enterArena());
    this.placeExhibits(this.content.exhibits[index], (this.registry.get('view') as HostView | null | undefined) ?? null);
    this.cameras.main.startFollow(this.lead, true, CAMERA_LERP, CAMERA_LERP);

    this.bindKeys();
    this.registry.events.on('changedata-view', this.onView, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.registry.events.off('changedata-view', this.onView, this);
      // The label goes with the segment: after a reset the Lobby draws over the HUD without clearing it.
      this.hud.clearToast();
    });
  }

  update(time: number, delta: number): void {
    if (this.leaving) return;
    this.steer();
    this.follow(time, delta);
  }

  // ---- The world ------------------------------------------------------------------------------------------

  /** The road in ground tiles over flat stone, with pits where it breaks, and the ledges in platform tiles. */
  private lay(height: number): { road: Phaser.Physics.Arcade.StaticGroup; ledges: Phaser.Physics.Arcade.StaticGroup } {
    const road = this.physics.add.staticGroup();
    const ledges = this.physics.add.staticGroup();
    for (const p of this.segment.platforms) {
      const onRoad = p.y === GROUND_Y;
      const tiles = this.add.tileSprite(p.x, p.y, p.w, TILE, onRoad ? 'tile-ground' : 'tile-platform').setOrigin(0, 0).setDepth(DEPTH.road);
      (onRoad ? road : ledges).add(tiles);
      if (onRoad) this.add.rectangle(p.x, p.y + TILE, p.w, height - p.y - TILE, hex(PALETTE.stoneDeep)).setOrigin(0, 0).setDepth(DEPTH.road);
    }
    return { road, ledges };
  }

  /** A ledge is passed through from below and from the side, and stood on from above: the lead lands if its feet were over it. */
  private landsOn(ledge: unknown): boolean {
    if (!(ledge instanceof Phaser.GameObjects.TileSprite)) return true;
    const body = this.lead.body;
    return body.velocity.y >= 0 && body.prev.y + body.height <= ledge.y + LANDING_SLOP;
  }

  /** The round's exhibits the room does not count yet, one on each of the segment's spots, bobbing over it. */
  private placeExhibits(exhibits: readonly Exhibit[], view: HostView | null): void {
    const counted = new Set(this.counted(view));
    this.segment.exhibits.forEach((spot, i) => {
      const exhibit = exhibits[i];
      if (counted.has(exhibit.id)) return;
      const sprite = this.physics.add.staticImage(spot.x, spot.y, 'exhibit').setOrigin(0.5, 1).refreshBody().setDepth(DEPTH.exhibit);
      this.tweens.add({ targets: sprite, y: spot.y - BOB_PX, duration: BOB_MS, ease: 'Sine.easeInOut', yoyo: true, repeat: -1 });
      const overlap = this.physics.add.overlap(this.lead, sprite, () => this.collect(exhibit));
      this.exhibits.set(exhibit.id, { sprite, overlap });
    });
  }

  /** The ids of this round's exhibits the room has counted. */
  private counted(view: HostView | null): readonly string[] {
    return view?.exhibits[this.round] ?? [];
  }

  /** The lead touched an exhibit: it goes, the room counts it toward the coming strike, and its figure shows for 4 s. */
  private collect(exhibit: Exhibit): void {
    if (this.leaving || !this.exhibits.has(exhibit.id)) return;
    this.removeExhibit(exhibit.id);
    this.client.send({ k: 'exhibit', exhibitId: exhibit.id });
    this.hud.showToast(`${exhibit.text} (${exhibit.source})`);
  }

  private removeExhibit(id: string): void {
    const placed = this.exhibits.get(id);
    if (placed === undefined) return;
    this.exhibits.delete(id);
    placed.overlap.destroy();
    this.tweens.killTweensOf(placed.sprite);
    placed.sprite.destroy();
  }

  /** The gate, or N: the round's Battle starts, with Space resting a moment first. */
  private enterArena(): void {
    if (this.leaving) return;
    this.leaving = true;
    this.registry.set(LOCK_KEY, this.time.now + SEND_LOCK_MS);
    this.scene.start('Battle', { round: this.round, resume: false } satisfies SceneData);
  }

  // ---- Views ----------------------------------------------------------------------------------------------

  /** Puts the label back if "Reconnecting to the room" took its slot, and takes away exhibits the room counted meanwhile. */
  private onView(_parent: unknown, view: HostView | null): void {
    if (view === null || view.phase !== 'travel' || view.round !== this.round) return;   // the router is about to move on
    this.hud.showToast(this.label, 0);
    for (const id of this.counted(view)) this.removeExhibit(id);
  }

  // ---- Keys and movement ----------------------------------------------------------------------------------

  /**
   * The arrows move and jump (Space jumps too), and any arrow press ends an auto-run. A toggles auto-run; N skips to the
   * gate. A held key does not repeat a toggle, and a Ctrl, Alt or Cmd chord is left to the browser.
   */
  private bindKeys(): void {
    const keyboard = this.input.keyboard;
    this.keys = null;
    if (keyboard === null) return;
    const keys = keyboard.createCursorKeys();
    this.keys = keys;
    for (const arrow of [keys.left, keys.right, keys.up, keys.down]) arrow.on(Phaser.Input.Keyboard.Events.DOWN, () => { this.auto = false; });
    const plain = (event: KeyboardEvent): boolean => !event.repeat && !event.ctrlKey && !event.altKey && !event.metaKey;
    keyboard.on('keydown-A', (event: KeyboardEvent) => {
      if (!plain(event)) return;
      this.auto = !this.auto;
      if (this.auto) this.nextStop = stopAhead(this.segment.autoPath, this.lead.body.center.x);
    });
    keyboard.on('keydown-N', (event: KeyboardEvent) => {
      if (!plain(event) || this.leaving) return;
      this.lead.body.reset(this.segment.gateX, GROUND_Y);
      this.enterArena();
    });
  }

  /**
   * Sets the lead's velocity for the next physics step. Auto-run goes right at RUN_SPEED and jumps at each stop of the
   * path it reaches, or when a wall stops it (the far side of a pit it fell into). By hand, left or right alone moves.
   * Up or Space jumps from anything the lead stands on. The body, which arcade physics has already stepped this frame,
   * is where the lead is now; the sprite catches up after this.
   */
  private steer(): void {
    const body = this.lead.body;
    const keys = this.keys;
    let vx = 0;
    let jump = keys !== null && (keys.up.isDown || keys.space.isDown);
    if (this.auto) {
      const step = autoStep(this.segment.autoPath, this.nextStop, body.center.x);
      this.nextStop = step.next;
      vx = RUN_SPEED;
      jump ||= step.jump || body.blocked.right;
    } else if (keys !== null && keys.left.isDown !== keys.right.isDown) {
      vx = keys.left.isDown ? -RUN_SPEED : RUN_SPEED;
    }
    body.setVelocityX(vx);
    if (vx !== 0) this.lead.setFlipX(vx < 0);
    if (jump && body.blocked.down) body.setVelocityY(-JUMP_SPEED);
  }

  /**
   * The three behind ease toward the lead's footprint from TRAIL_MS ago, each a slot further back, and stand on what is
   * under that spot: a surface no higher than the one they stand on or are making for, or, if the lead was standing then,
   * no higher than the lead stood. So a follower beside a ledge waits on the road below it, one on a ledge stays there
   * until it walks off the end, and one climbing keeps climbing when the lead jumps. Over a pit they take the lead's height
   * from then. They collide with nothing and never get in the lead's way.
   */
  private follow(time: number, delta: number): void {
    const body = this.lead.body;
    this.trail.push({ t: time, x: body.center.x, y: body.bottom, left: this.lead.flipX, grounded: body.blocked.down });
    const print = this.trail.at(time, TRAIL_MS);
    if (print === undefined) return;
    const ease = 1 - Math.exp(-delta / FOLLOW_MS);
    const behind = print.left ? 1 : -1;
    this.party.forEach((sprite, i) => {
      const x = print.x + behind * SLOT_PX * (i + 1);
      const stand = this.stands[i];
      this.stands[i] = groundUnder(this.segment, x, print.grounded ? Math.min(print.y, stand) : stand) ?? print.y;
      sprite.x = Phaser.Math.Linear(sprite.x, x, ease);
      sprite.y = Phaser.Math.Linear(sprite.y, this.stands[i], ease);
      sprite.setFlipX(print.left);
    });
  }
}
