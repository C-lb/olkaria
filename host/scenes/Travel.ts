// The road between battles (spec 4.5): a short platformer the lead class of the coming round runs, the other three
// classes trailing it. The party walks it by itself: SETOFF_MS after the segment starts it sets off along the
// segment's baked path, resting where it picks up an exhibit so the room can read the figure, and the gate at the end
// starts the round's Battle. An exhibit on the way is a case figure: touching one sends it to the room, where it adds
// an exhibit flourish worth the content's `scoring.exhibitBonus` to the coming strike, and shows it as a toast.
// A pauses the walk and resumes it from where the lead stands; any arrow key takes control of the lead, and the walk
// stays off until A resumes it; N skips to the arena. No text on the canvas: a sticky toast names the boss ahead and
// the class that leads. A reload mid-travel starts the segment over and walks it again, and the exhibits the room
// already counts are not offered again.
import Phaser from 'phaser';
import type { CaseContent } from '../../shared/content';
import type { HostView } from '../../shared/types';
import { addBackdrop } from '../art/backdrop';
import { PALETTE } from '../art/placeholders';
import { oncePerEvent } from '../hotkeys';
import type { Hud } from '../hud/Hud';
import { standAt, Trail } from '../levels/party';
import {
  autoStep, gateColumn, GROUND_Y, JUMP_SPEED, PICKUP_PAUSE_MS, RUN_SPEED, SEGMENTS, SETOFF_MS, START_X, stopAhead, TILE, type Segment,
} from '../levels/road';
import type { RoomClient } from '../net';
import { tripOf, type SceneData } from '../router';
import { classFor, labelFor, SEND_LOCK_MS, SPACE_LOCK_KEY } from '../strikers';

const hex = (colour: string): number => Number.parseInt(colour.slice(1), 16);

/** The other three follow the lead's feet as they were this long ago, a slot apart, behind the way it faced then. */
const TRAIL_MS = 200;
const SLOT_PX = 12;
/** How quickly a follower closes on its spot: the time constant of its easing, in ms. */
const FOLLOW_MS = 60;
/** How many lead positions the trail keeps, one per frame: 200 ms at up to 240 frames a second, with room over. */
const TRAIL_SIZE = 64;
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
/** The keys Travel reads itself: the arrows and Space. */
type Keys = Record<'left' | 'right' | 'up' | 'down' | 'space', Phaser.Input.Keyboard.Key>;

export class Travel extends Phaser.Scene {
  private round = 0;
  /** The trip the room was on when this road started, which the Battle at the gate is started with. */
  private trip = 0;
  /** The round as an index into the roads and the content: the room only travels in rounds 0 to 3. */
  private roundIndex = 0;
  private client!: RoomClient;
  private content!: CaseContent;
  private hud!: Hud;
  private segment!: Segment;
  private lead!: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  /** The three support classes, in role order, nearest the lead first, and the height each one stands at or is making for. */
  private party: Phaser.GameObjects.Image[] = [];
  private stands: number[] = [];
  private trail = new Trail(TRAIL_SIZE);
  private keys: Keys | null = null;
  /** The exhibits still on the road, by id, each with the overlap that picks it up. */
  private exhibits = new Map<string, { sprite: Phaser.GameObjects.Image; overlap: Phaser.Physics.Arcade.Collider }>();
  /** "Travel 1: Grid Wyrm ahead. Rogues lead.", kept in the HUD's sticky toast slot. */
  private label = '';
  /**
   * Whether the party is walking by itself (on from the start, until A pauses it or an arrow takes over), and the first
   * stop of the path it has not reached yet.
   */
  private auto = false;
  private nextStop = 0;
  /**
   * The walk's rest at an exhibit: owed from the pickup until the lead stands, then held until this game time. The wait
   * before it sets off is held the same way.
   */
  private restOwed = false;
  private restUntil = 0;
  /** Set once the gate or N has started the Battle: nothing else happens here after that. */
  private leaving = false;

  constructor() {
    super('Travel');
  }

  /** A resumed travel is no different: the segment starts over, and create() leaves out the exhibits the room already has. */
  init(data: Partial<SceneData>): void {
    this.round = data.round ?? 0;
    this.trip = data.trip ?? 0;
  }

  create(): void {
    this.client = this.registry.get('client') as RoomClient;
    this.content = this.registry.get('content') as CaseContent;
    this.hud = this.registry.get('hud') as Hud;
    this.hud.clear();
    this.roundIndex = Math.min(SEGMENTS.length - 1, Math.max(0, this.round));
    this.segment = SEGMENTS[this.roundIndex];
    this.party = [];
    this.stands = [];
    this.trail = new Trail(TRAIL_SIZE);
    this.exhibits = new Map();
    this.auto = true;
    this.nextStop = stopAhead(this.segment.autoPath, START_X);
    this.restOwed = false;
    // The game's step time, which is what update() is given: this scene's own clock only moves while it runs, so in
    // create() it still reads where the last visit left it (0 on the first).
    this.restUntil = this.game.getTime() + SETOFF_MS;
    this.leaving = false;

    const { lead, support } = classFor(this.content, this.roundIndex);
    const boss = this.content.rounds[this.roundIndex].boss;
    this.label = `Travel ${this.roundIndex + 1}: ${boss} ahead. ${labelFor(this.content, lead, true)} lead.`;
    this.hud.showToast(this.label, 0);

    const { width, gateX } = this.segment;
    const height = this.scale.height;
    this.physics.world.setBounds(0, 0, width, height);
    this.cameras.main.setBounds(0, 0, width, height);
    addBackdrop(this, width);
    const { road, ledges } = this.lay(height);
    this.add.image(gateX, GROUND_Y, 'gate').setOrigin(0.5, 1).setDepth(DEPTH.gate);
    const column = gateColumn(this.segment);
    const gate = this.add.zone(column.x, column.y, column.w, column.h).setOrigin(0, 0);
    this.physics.add.existing(gate, true);

    this.lead = this.physics.add.sprite(START_X, GROUND_Y, `class-${lead}`).setOrigin(0.5, 1).setDepth(DEPTH.lead).setCollideWorldBounds(true);
    support.forEach((role, i) => {
      this.party.push(this.add.image(START_X - SLOT_PX * (i + 1), GROUND_Y, `class-${role}`).setOrigin(0.5, 1).setDepth(DEPTH.party));
      this.stands.push(GROUND_Y);
    });
    this.physics.add.collider(this.lead, road);
    this.physics.add.collider(this.lead, ledges, undefined, (_lead, ledge) => this.landsOn(ledge));
    this.physics.add.overlap(this.lead, gate, () => this.enterArena());
    this.placeExhibits(this.content.exhibits[this.roundIndex], (this.registry.get('view') as HostView | null | undefined) ?? null);
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
    this.steer(time);
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
    return view?.exhibits[this.roundIndex] ?? [];
  }

  /**
   * The lead touched an exhibit: it goes, the room counts it toward the coming strike, and its figure shows for 4 s. On
   * auto-run the lead then rests where it next stands; driven by hand it does not.
   */
  private collect(exhibit: Exhibit): void {
    if (this.leaving || !this.exhibits.has(exhibit.id)) return;
    this.removeExhibit(exhibit.id);
    this.client.send({ k: 'exhibit', exhibitId: exhibit.id });
    this.hud.showToast(`${exhibit.text} (${exhibit.source})`);
    if (this.auto) this.restOwed = true;
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
    this.registry.set(SPACE_LOCK_KEY, this.time.now + SEND_LOCK_MS);
    this.scene.start('Battle', { round: this.round, resume: false, trip: this.trip } satisfies SceneData);
  }

  // ---- Views ----------------------------------------------------------------------------------------------

  /** Puts the label back if "Reconnecting to the room" took its slot, and takes away exhibits the room counted meanwhile. */
  private onView(_parent: unknown, view: HostView | null): void {
    // No view, or another phase, round or trip: the router is about to move on.
    if (view === null || view.phase !== 'travel' || view.round !== this.round || tripOf(view) !== this.trip) return;
    this.hud.showToast(this.label, 0);
    for (const id of this.counted(view)) this.removeExhibit(id);
  }

  // ---- Keys and movement ----------------------------------------------------------------------------------

  /**
   * The party walks by itself, so no key is needed. A pauses the walk and resumes it from where the lead stands; any
   * arrow press takes control, which turns the walk off, and the arrows then move and jump (Space jumps too, with or
   * without the walk). N skips to the gate. A held key does not repeat a toggle, and a Ctrl, Alt or Cmd chord is left
   * to the browser. The keys are added without capture: Phaser keeps a key's capture after its scene stops, so Space
   * and the arrows would otherwise lose their default actions for the rest of the session.
   */
  private bindKeys(): void {
    const keyboard = this.input.keyboard;
    this.keys = null;
    if (keyboard === null) return;
    const key = (code: number): Phaser.Input.Keyboard.Key => keyboard.addKey(code, false);
    const { LEFT, RIGHT, UP, DOWN, SPACE } = Phaser.Input.Keyboard.KeyCodes;
    const keys: Keys = { left: key(LEFT), right: key(RIGHT), up: key(UP), down: key(DOWN), space: key(SPACE) };
    this.keys = keys;
    for (const arrow of [keys.left, keys.right, keys.up, keys.down]) arrow.on(Phaser.Input.Keyboard.Events.DOWN, () => { this.auto = false; });
    const plain = (event: KeyboardEvent): boolean => !event.repeat && !event.ctrlKey && !event.altKey && !event.metaKey;
    keyboard.on('keydown-A', oncePerEvent((event: KeyboardEvent) => {
      if (!plain(event)) return;
      this.auto = !this.auto;
      this.restOwed = false;
      this.restUntil = 0;
      if (this.auto) this.nextStop = stopAhead(this.segment.autoPath, this.lead.body.center.x);
    }));
    keyboard.on('keydown-N', oncePerEvent((event: KeyboardEvent) => {
      if (!plain(event) || this.leaving) return;
      this.lead.body.reset(this.segment.gateX, GROUND_Y);
      this.enterArena();
    }));
  }

  /**
   * Sets the lead's velocity for the next physics step. Auto-run goes right at RUN_SPEED and jumps at each stop of the
   * path it reaches, or when a wall stops it in a pit (the only wall on the way: ledges let it through, and the gate
   * takes it before the world's edge). After a pickup it stands still for PICKUP_PAUSE_MS once it stands on something,
   * so the rest changes when it gets somewhere, never where it goes. By hand, left or right alone moves. Up or Space
   * jumps from anything the lead stands on. The body, which arcade physics has already stepped this frame, is where the
   * lead is now; the sprite catches up after this.
   */
  private steer(time: number): void {
    const body = this.lead.body;
    const keys = this.keys;
    let vx = 0;
    let jump = keys !== null && (keys.up.isDown || keys.space.isDown);
    if (this.auto) {
      if (this.restOwed && body.blocked.down) {
        this.restOwed = false;
        this.restUntil = time + PICKUP_PAUSE_MS;
      }
      if (time >= this.restUntil) {
        const step = autoStep(this.segment.autoPath, this.nextStop, body.center.x);
        this.nextStop = step.next;
        vx = RUN_SPEED;
        jump ||= step.jump || (body.blocked.right && body.bottom > GROUND_Y);
      }
    } else if (keys !== null && keys.left.isDown !== keys.right.isDown) {
      vx = keys.left.isDown ? -RUN_SPEED : RUN_SPEED;
    }
    body.setVelocityX(vx);
    if (vx !== 0) this.lead.setFlipX(vx < 0);
    if (jump && body.blocked.down) body.setVelocityY(-JUMP_SPEED);
  }

  /**
   * The three behind ease toward the lead's footprint from TRAIL_MS ago, each a slot further back, at the height standAt
   * gives them (party.ts). They collide with nothing and never get in the lead's way.
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
      this.stands[i] = standAt(this.segment, x, print, this.stands[i]);
      sprite.x = Phaser.Math.Linear(sprite.x, x, ease);
      sprite.y = Phaser.Math.Linear(sprite.y, this.stands[i], ease);
      sprite.setFlipX(print.left);
    });
  }
}
