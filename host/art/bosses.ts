// The five bosses, one container each: the Grid Wyrm, the Fog of Demand, the Hydra of Rivalry, the Wraith of Risk and
// the core.
// Every part is a small texture painted once per game from the rows in boss-data.ts, so the art stays whole pixels at
// any zoom; a few particles and the digits font do the rest. A boss idles in a loop of tweens and, when hit, flashes
// bone white and recoils 3 px for 300 ms; beaten, it flashes, sinks and fades. Through all of it each one stays inside the box Battle keeps for it: x -40 to
// +38 and y -54 to 0 about its feet, and no higher than y -49 where the HP bar hangs over it (x -21 to +32), so the
// bar, the strike numbers and the boss never touch (world x 240 to 318, y 30 to 84, and y 35 under the bar, at BOSS_X
// 280 on the floor at 84; tests/bosses.test.ts holds every boss to it). The core's parts are also painted together as
// `boss-core`, the still image the Ending cracks.
import Phaser from 'phaser';
import {
  BOLTS, CORE, coreParts, DIE, FOG, HIT, HYDRA, hydraParts, INK, PUFF_PX, SAND, SPARKS, SPRITES, STILL, WAVE,
  WRAITH_OF_RISK, wraithParts, wyrmParts, type BossId, type Placed, type Shade, type Stray,
} from './boss-data';
import { PALETTE, Painter, texture } from './placeholders';

export type { BossId } from './boss-data';

const hex = (colour: string): number => Number.parseInt(colour.slice(1), 16);
const shade = (name: Shade): number => hex(PALETTE[name]);
const BONE = shade('bone');

function paint(p: Painter, rows: readonly string[], x0 = 0, y0 = 0): void {
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const name: Shade | undefined = INK[row[x]];
      if (name === undefined) continue;
      p.ctx.fillStyle = PALETTE[name];
      p.ctx.fillRect(x0 + x, y0 + y, 1, 1);
    }
  });
}

/** The textures each boss is built from, the digits font's where it carries figures; any one missing, it falls back. */
const ART: Record<BossId, readonly string[]> = {
  power: ['wyrm-link-face', 'wyrm-link-edge', 'wyrm-link-face-up', 'wyrm-link-edge-up', 'wyrm-head', 'boss-spark', 'boss-bolt'],
  demand: ['fog-wraith', 'boss-puff', 'digits'],
  competition: ['hydra-body', 'hydra-head-0', 'hydra-head-1', 'hydra-head-2'],
  risk: ['risk-glass', 'risk-sand', 'risk-arm-left', 'risk-arm-right', 'boss-mote'],
  core: ['core-heart', 'core-veins', 'core-ring-0', 'core-ring-1', 'core-ring-2', 'boss-mote'],
};

/**
 * Paints every boss texture once per game, and `boss-core`, the whole core as one still image for the Ending. Boot
 * calls it before makePlaceholders, so the placeholder core is never painted over it; buildBoss calls it again, which
 * paints nothing twice.
 */
export function makeBossArt(scene: Phaser.Scene): void {
  for (const [key, rows] of Object.entries(SPRITES)) texture(scene, key, rows[0].length, rows.length, (p) => paint(p, rows));
  const mid = Math.floor(PUFF_PX / 2);
  texture(scene, 'boss-puff', PUFF_PX, PUFF_PX, (p) => {
    p.ctx.globalAlpha = 0.5;
    p.disc(mid, mid, mid + 0.2, PALETTE.white);
    p.ctx.globalAlpha = 1;
    p.disc(mid, mid, mid - 1, PALETTE.white);
  });
  // The Ending's still core: every part where the Battle's core puts it about the feet, the veins lit.
  const { heart, veins, arcs } = coreParts();
  texture(scene, 'boss-core', STILL.w, STILL.h, (p) => {
    for (const part of [heart, veins, ...arcs]) paint(p, SPRITES[part.key], STILL.feetX + part.x, STILL.feetY + part.y);
  });
}

// ---- The boss -----------------------------------------------------------------------------------------------

type Part = Phaser.GameObjects.Image | Phaser.GameObjects.BitmapText;

/** What a boss's parts do: go back to where they rest, and start the idle loops. */
interface Rig {
  rest(): void;
  loop(): Phaser.Tweens.BaseTween[];
}

/** Anything placed by x and y: a part, or a container of parts that move together. */
type Movable = Phaser.GameObjects.Components.Transform;

/** A loop that moves parts by whole pixels, from where they rest out to (dx, dy) and back, `ms` each way. */
function stray(scene: Phaser.Scene, parts: readonly Movable[], { dx, dy, ms }: Stray, delay = 0): Phaser.Tweens.Tween {
  const home = parts.map((part) => ({ part, x: part.x, y: part.y }));
  const k = { t: 0 };
  return scene.tweens.add({
    targets: k, t: 1, duration: ms, delay, ease: 'Sine.easeInOut', yoyo: true, repeat: -1,
    onUpdate: () => {
      for (const h of home) h.part.setPosition(h.x + Math.round(dx * k.t), h.y + Math.round(dy * k.t));
    },
  });
}

/** Out over the first third, back over the rest: 0, then 1 at a third, then 0 at the end. */
const kick = (t: number): number => (t < 1 / 3 ? 1 - (1 - 3 * t) ** 2 : 1 - ((t - 1 / 3) * 1.5) ** 2);

/**
 * A boss: its parts in one container at its feet, an idle loop, a hit and a death. idle() (re)starts the loop from
 * rest, so a scene that has killed every tween can call it again; reset() ends a hit early and undoes a death.
 */
export class Boss extends Phaser.GameObjects.Container {
  private readonly home: { x: number; y: number };
  /** The parts a hit flashes, and the tint each goes back to (null: none). */
  private readonly flashes: { part: Part; rest: number | null }[] = [];
  private readonly rig: Rig;
  private loops: Phaser.Tweens.BaseTween[] = [];
  private recoil: Phaser.Tweens.Tween | null = null;
  private dying: Phaser.Tweens.Tween | null = null;
  private dead = false;
  /** Whoever asked to hear when the death ends, each told once. */
  private onDead: (() => void)[] = [];

  constructor(scene: Phaser.Scene, readonly bossId: BossId, x: number, y: number) {
    super(scene, x, y);
    this.home = { x, y };
    scene.add.existing(this);
    const art = ART[bossId].every((key) => scene.textures.exists(key));
    this.rig = art ? RIGS[bossId](scene, this) : placeholder(scene, this, bossId);
    // A boss destroyed before its scene stops takes its loops with it, so no tween keeps moving its parts.
    this.once(Phaser.GameObjects.Events.DESTROY, () => {
      for (const loop of this.loops) loop.stop();
      this.recoil?.stop();
      this.dying?.stop();
    });
  }

  /** Adds a part that a hit flashes; `rest` is the tint it goes back to. */
  part<T extends Part>(part: T, rest: number | null = null): T {
    this.add(part);
    this.flashes.push({ part, rest });
    return part;
  }

  /** Starts the idle loop from rest, stopping the one before. */
  idle(): this {
    for (const loop of this.loops) loop.stop();
    this.reset();
    this.setPosition(this.home.x, this.home.y);
    this.rig.rest();
    this.loops = this.rig.loop();
    return this;
  }

  /** Bone white for HIT.flashMs and a HIT.recoilPx recoil, whole pixels; back where it stood after HIT.ms. A second hit restarts it; a dying or dead boss ignores it. */
  hit(): this {
    // A beaten boss takes no more hits: the recoil's end would bring it back.
    if (this.dying !== null || this.dead) return this;
    this.recoil?.stop();
    this.flash(true);
    const k = { t: 0 };
    let lit = true;
    this.recoil = this.scene.tweens.add({
      targets: k, t: 1, duration: HIT.ms,
      onUpdate: () => {
        this.x = this.home.x + Math.round(HIT.recoilPx * kick(k.t));
        if (lit && k.t * HIT.ms >= HIT.flashMs) {
          lit = false;
          this.flash(false);
        }
      },
      onComplete: () => {
        this.recoil = null;
        this.reset();
      },
    });
    return this;
  }

  /**
   * Ends a hit: untinted, back at its place. The idle loop carries on. After a death it also brings the boss back,
   * whole and at rest but still, until idle() starts the loop again; anyone waiting on the death is not told.
   */
  reset(): this {
    this.recoil?.stop();
    this.recoil = null;
    if (this.dying !== null || this.dead) {
      this.dying?.stop();
      this.dying = null;
      this.dead = false;
      this.onDead = [];
      this.setAlpha(1);
      this.y = this.home.y;
      for (const emitter of this.emitters()) emitter.start();
      this.rig.rest();
    }
    this.x = this.home.x;
    this.flash(false);
    return this;
  }

  /**
   * Beaten: the loop stops, the particles stop coming, it flashes bone white and shudders for DIE.flashMs, then sinks
   * DIE.sinkPx and fades out, gone after DIE.ms. onDone is called once, when it is gone; a die() while dying or dead
   * only adds its onDone to that.
   */
  die(onDone?: () => void): this {
    if (onDone !== undefined) this.onDead.push(onDone);
    if (this.dead) return this.lieDead();
    if (this.dying !== null) return this;
    this.still();
    for (const emitter of this.emitters()) emitter.stop();
    this.flash(true);
    const k = { t: 0 };
    let lit = true;
    this.dying = this.scene.tweens.add({
      targets: k, t: 1, duration: DIE.ms,
      onUpdate: () => {
        const ms = k.t * DIE.ms;
        if (lit && ms >= DIE.flashMs) {
          lit = false;
          this.flash(false);
        }
        const fade = Math.max(0, (ms - DIE.flashMs) / (DIE.ms - DIE.flashMs));
        this.x = this.home.x + (lit ? (Math.floor(ms / 40) % 2 === 0 ? -1 : 1) : 0);
        this.y = this.home.y + Math.round(DIE.sinkPx * fade * fade);
        this.setAlpha(1 - fade);
      },
      onComplete: () => {
        this.dying = null;
        this.lieDead();
      },
    });
    return this;
  }

  /** The state die() ends in, at once: no loop, no particles, sunk and faded out. Tells anyone waiting on the death. */
  lieDead(): this {
    this.still();
    this.dying?.stop();
    this.dying = null;
    this.dead = true;
    for (const emitter of this.emitters()) {
      emitter.stop();
      emitter.killAll();
    }
    this.flash(false);
    this.setPosition(this.home.x, this.home.y + DIE.sinkPx);
    this.setAlpha(0);
    const waiting = this.onDead;
    this.onDead = [];
    for (const done of waiting) done();
    return this;
  }

  /** Stops the idle loop and any hit. */
  private still(): void {
    for (const loop of this.loops) loop.stop();
    this.loops = [];
    this.recoil?.stop();
    this.recoil = null;
  }

  /** Every particle emitter in the boss, those in a container of parts included. */
  private emitters(): Phaser.GameObjects.Particles.ParticleEmitter[] {
    const out: Phaser.GameObjects.Particles.ParticleEmitter[] = [];
    const walk = (list: readonly Phaser.GameObjects.GameObject[]): void => {
      for (const child of list) {
        if (child instanceof Phaser.GameObjects.Particles.ParticleEmitter) out.push(child);
        else if (child instanceof Phaser.GameObjects.Container) walk(child.list);
      }
    };
    walk(this.list);
    return out;
  }

  private flash(on: boolean): void {
    for (const { part, rest } of this.flashes) {
      if (on) part.setTintFill(BONE);
      else if (rest === null) part.clearTint();
      else part.setTint(rest);
    }
  }
}

/** Particles start on a whole pixel somewhere in this rectangle, about the emitter. */
const within = (x: number, y: number, w: number, h: number): Phaser.Types.GameObjects.Particles.EmitZoneData => ({
  type: 'random',
  source: {
    getRandomPoint: (point: Phaser.Types.Math.Vector2Like): void => {
      point.x = x + Math.floor(Math.random() * w);
      point.y = y + Math.floor(Math.random() * h);
    },
  },
});

/** A part placed by its top-left corner, so odd sizes still land on whole pixels. */
const image = (scene: Phaser.Scene, { key, x, y }: Placed): Phaser.GameObjects.Image => scene.add.image(x, y, key).setOrigin(0, 0);

function power(scene: Phaser.Scene, boss: Boss): Rig {
  const parts = wyrmParts();
  const placed = parts.map((p) => ({ ...p, part: boss.part(image(scene, p)) }));
  const wave = { phase: 0 };
  const lay = (): void => {
    for (const { part, x, y, across, i } of placed) {
      const s = Math.sin(wave.phase - i * WAVE.step);
      part.setPosition(x + Math.round(across.x * s), y + Math.round(across.y * s));
    }
  };
  // Lightning crawls over the chain: sparks off a link here and there, and now and then a bolt.
  const links = placed.slice(0, SPARKS.links).map((p) => p.part);
  const onChain = {
    getRandomPoint: (point: Phaser.Types.Math.Vector2Like): void => {
      const link = links[Math.floor(Math.random() * links.length)];
      point.x = link.x + link.width / 2 + Math.round((Math.random() - 0.5) * 2 * SPARKS.jitter.x);
      point.y = link.y + link.height / 2 + Math.round((Math.random() - 0.5) * 2 * SPARKS.jitter.y);
    },
  };
  boss.add(scene.add.particles(0, 0, 'boss-spark', {
    emitZone: { type: 'random', source: onChain }, frequency: SPARKS.everyMs, quantity: 1, lifespan: SPARKS.lifeMs,
    speedX: { min: -SPARKS.speedX, max: SPARKS.speedX }, speedY: SPARKS.speedY,
    tint: [shade('bone'), shade('steel'), shade('amber')], alpha: { start: 1, end: 0 },
  }));
  boss.add(scene.add.particles(0, 0, 'boss-bolt', {
    emitZone: { type: 'random', source: onChain }, frequency: BOLTS.everyMs, quantity: 1, lifespan: BOLTS.lifeMs, speed: 0,
    scaleX: [-1, 1], tint: shade('bone'), alpha: { start: 1, end: 0.2 },
  }));
  return {
    rest: () => {
      wave.phase = 0;
      lay();
    },
    loop: () => [
      scene.tweens.add({ targets: wave, phase: { from: 0, to: Math.PI * 2 }, duration: WAVE.ms, repeat: -1, onUpdate: lay }),
    ],
  };
}

function demand(scene: Phaser.Scene, boss: Boss): Rig {
  const { zone, drift } = FOG;
  const puffs = (count: number, peak: number): Phaser.GameObjects.Particles.ParticleEmitter =>
    scene.add.particles(0, 0, 'boss-puff', {
      emitZone: within(zone.x, zone.y, zone.w, zone.h),
      lifespan: FOG.ms, frequency: FOG.ms / count, quantity: 1, maxAliveParticles: count, advance: FOG.ms,
      speedX: { min: -drift.x, max: drift.x }, speedY: { min: -drift.up, max: drift.down },
      scale: [...FOG.scales], tint: [shade('stonePale'), shade('stoneLight'), shade('boneDim')],
      alpha: { onEmit: () => 0, onUpdate: (_particle, _key, t) => peak * Math.sin(Math.PI * t) },
    });
  boss.add(puffs(FOG.back, FOG.peak.back));
  const wraith = boss.part(image(scene, FOG.wraith));
  boss.add(puffs(FOG.front, FOG.peak.front));
  const figures = FOG.figures.map(({ text, x, y, shade: name, spacing }) =>
    boss.part(scene.add.bitmapText(x, y, 'digits', text).setLetterSpacing(spacing).setTint(shade(name)), shade(name)));
  const rests = [wraith, ...figures].map((part) => ({ part, x: part.x, y: part.y }));
  return {
    rest: () => {
      for (const r of rests) r.part.setPosition(r.x, r.y);
      for (const f of figures) f.setAlpha(1);
    },
    loop: () => [
      stray(scene, [wraith], FOG.bob),
      ...figures.flatMap((f, i) => {
        const { ms } = FOG.figures[i];
        return [
          stray(scene, [f], { ...FOG.figureDrift, ms }, i * 400),
          scene.tweens.add({ targets: f, alpha: FOG.floor, duration: ms / 2, delay: i * 250, ease: 'Sine.easeInOut', yoyo: true, repeat: -1 }),
        ];
      }),
    ],
  };
}

function core(scene: Phaser.Scene, boss: Boss): Rig {
  const at = coreParts();
  boss.part(image(scene, at.heart));
  const veins = boss.part(image(scene, at.veins));
  const arcs = at.arcs.map((p) => boss.part(image(scene, p)));
  const { embers } = CORE;
  boss.add(scene.add.particles(0, 0, 'boss-mote', {
    emitZone: within(CORE.at.x + embers.x, CORE.at.y + embers.y, embers.w, embers.h), frequency: embers.everyMs, quantity: 1,
    lifespan: embers.lifeMs, speedX: { min: -embers.speedX, max: embers.speedX }, speedY: embers.speedY, scale: embers.scale,
    tint: [shade('amber'), shade('ember')], alpha: { start: 1, end: 0 },
  }));
  const rests = arcs.map((part) => ({ part, x: part.x, y: part.y }));
  return {
    rest: () => {
      for (const r of rests) r.part.setPosition(r.x, r.y);
      veins.setAlpha(CORE.veinsRest);
    },
    loop: () => [
      scene.tweens.chain({ targets: veins, loop: -1, tweens: CORE.beat.map(([alpha, duration]) => ({ alpha, duration })) }),
      ...arcs.map((arc, i) => stray(scene, [arc], CORE.stray[i])),
    ],
  };
}

function competition(scene: Phaser.Scene, boss: Boss): Rig {
  const at = hydraParts();
  const body = boss.part(image(scene, at.body));
  const heads = at.heads.map((p) => boss.part(image(scene, p)));
  // The heads ride the body's breath in a container of their own, so each can dip on its own beat as well.
  const neck = scene.add.container(0, 0, heads);
  boss.add(neck);
  const rests = [body, ...heads].map((part) => ({ part, x: part.x, y: part.y }));
  return {
    rest: () => {
      for (const r of rests) r.part.setPosition(r.x, r.y);
      neck.setPosition(0, 0);
    },
    loop: () => [
      stray(scene, [body], HYDRA.breath),
      stray(scene, [neck], HYDRA.breath),
      ...heads.map((head, i) => stray(scene, [head], HYDRA.sway[i], HYDRA.swayDelay[i])),
    ],
  };
}

function risk(scene: Phaser.Scene, boss: Boss): Rig {
  const at = wraithParts();
  const arms = at.arms.map((p) => boss.part(image(scene, p)));
  const glass = boss.part(image(scene, at.glass));
  const sand = boss.part(image(scene, at.sand));
  const { fall } = SAND;
  const grains = scene.add.particles(0, 0, 'boss-mote', {
    emitZone: within(at.glass.x + fall.x, at.glass.y + fall.y, 1, 1), frequency: fall.everyMs, quantity: 1,
    lifespan: fall.lifeMs, speedX: 0, speedY: fall.speedY, scale: fall.scale, tint: [shade('amber'), shade('ember')],
  });
  // The arms hang behind the glass, the grains fall in front of it; all of them hover with it.
  const body = scene.add.container(0, 0, [...arms, glass, sand, grains]);
  boss.add(body);
  const rests = arms.map((part) => ({ part, x: part.x, y: part.y }));
  const { glow } = WRAITH_OF_RISK;
  return {
    rest: () => {
      for (const r of rests) r.part.setPosition(r.x, r.y);
      body.setPosition(0, 0);
      sand.setAlpha(glow.to);
    },
    loop: () => [
      stray(scene, [body], WRAITH_OF_RISK.bob),
      stray(scene, arms, WRAITH_OF_RISK.reach, 200),
      scene.tweens.add({ targets: sand, alpha: glow.from, duration: glow.ms, ease: 'Sine.easeInOut', yoyo: true, repeat: -1 }),
    ],
  };
}

const RIGS: Record<BossId, (scene: Phaser.Scene, boss: Boss) => Rig> = { power, demand, competition, risk, core };

/** The boss's placeholder image, breathing a pixel up and down: what Battle showed before the art pass. */
function placeholder(scene: Phaser.Scene, boss: Boss, id: BossId): Rig {
  const img = boss.part(scene.add.image(0, 0, `boss-${id}`).setOrigin(0.5, 1));
  return {
    rest: () => img.setPosition(0, 0),
    loop: () => [stray(scene, [img], { dx: 0, dy: -1, ms: 900 })],
  };
}

/** Builds a boss at its feet (x, y), with its idle loop not yet started: call idle() once it stands where it should. */
export function buildBoss(scene: Phaser.Scene, id: BossId, x: number, y: number): Boss {
  makeBossArt(scene);
  return new Boss(scene, id, x, y);
}

