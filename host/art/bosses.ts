// The four bosses (spec 4.2), one container each: the Grid Wyrm, the Debt Golem, the Fog of Demand and the core.
// Every part is a small texture painted once per game from the rows in boss-data.ts, so the art stays whole pixels at
// any zoom; a few particles and the digits font do the rest. A boss idles in a loop of tweens and, when hit, flashes
// bone white and recoils 3 px for 300 ms. Through all of it each one stays inside the box Battle keeps for it: x -40 to
// +38 and y -54 to 0 about its feet, and no higher than y -49 where the HP bar hangs over it (x -21 to +32), so the
// bar, the strike numbers and the boss never touch (world x 240 to 318, y 30 to 84, and y 35 under the bar, at BOSS_X
// 280 on the floor at 84; tests/bosses.test.ts holds every boss to it). The core's parts are also painted together as
// `boss-core`, the still image the Ending cracks.
import Phaser from 'phaser';
import {
  BOLTS, CORE, coreParts, FOG, GOLEM, golemParts, HIT, INK, PUFF_PX, SPARKS, SPRITES, STILL, WAVE, wyrmParts,
  type BossId, type Placed, type Shade, type Stray,
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
  grid: ['wyrm-link-face', 'wyrm-link-edge', 'wyrm-link-face-up', 'wyrm-link-edge-up', 'wyrm-head', 'boss-spark', 'boss-bolt'],
  debt: ['golem-body', 'golem-legs', 'golem-shackle', 'golem-eyes', 'boss-mote', 'digits'],
  fog: ['fog-wraith', 'boss-puff', 'digits'],
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

/** A loop that moves parts by whole pixels, from where they rest out to (dx, dy) and back, `ms` each way. */
function stray(scene: Phaser.Scene, parts: readonly Part[], { dx, dy, ms }: Stray, delay = 0): Phaser.Tweens.Tween {
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
 * A boss: its parts in one container at its feet, an idle loop, and a hit. idle() (re)starts the loop from rest, so
 * a scene that has killed every tween can call it again; reset() ends a hit early.
 */
export class Boss extends Phaser.GameObjects.Container {
  private readonly home: { x: number; y: number };
  /** The parts a hit flashes, and the tint each goes back to (null: none). */
  private readonly flashes: { part: Part; rest: number | null }[] = [];
  private readonly rig: Rig;
  private loops: Phaser.Tweens.BaseTween[] = [];
  private recoil: Phaser.Tweens.Tween | null = null;

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

  /** Bone white for HIT.flashMs and a HIT.recoilPx recoil, whole pixels; back where it stood after HIT.ms. A second hit restarts it. */
  hit(): this {
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

  /** Ends a hit: untinted, back at its place. The idle loop carries on. */
  reset(): this {
    this.recoil?.stop();
    this.recoil = null;
    this.x = this.home.x;
    this.flash(false);
    return this;
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

function grid(scene: Phaser.Scene, boss: Boss): Rig {
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

function debt(scene: Phaser.Scene, boss: Boss): Rig {
  const at = golemParts();
  const amber = shade(GOLEM.carvingShade);
  boss.part(image(scene, at.legs));
  const body = boss.part(image(scene, at.body));
  const eyes = boss.part(image(scene, at.eyes));
  const carvings = at.carvings.map(({ text, x, y }) => boss.part(scene.add.bitmapText(x, y, 'digits', text).setTint(amber), amber));
  const shackles = at.shackles.map((p) => boss.part(image(scene, p)));
  const { dust } = GOLEM;
  boss.add(scene.add.particles(0, 0, 'boss-mote', {
    emitZone: within(at.body.x + dust.x, at.body.y + dust.y, dust.w, dust.h), frequency: dust.everyMs, quantity: 1,
    lifespan: dust.lifeMs, speedX: { min: -dust.speedX, max: dust.speedX }, speedY: 0, gravityY: dust.gravityY, scale: dust.scale,
    tint: [shade('stoneLight'), shade('stone')], alpha: { start: 1, end: 0 },
  }));
  const breathing: Part[] = [body, eyes, ...carvings];
  const rests = [...breathing, ...shackles].map((part) => ({ part, x: part.x, y: part.y }));
  return {
    rest: () => {
      for (const r of rests) r.part.setPosition(r.x, r.y);
      eyes.setAlpha(GOLEM.eyeGlow.from);
    },
    loop: () => [
      stray(scene, breathing, GOLEM.breath),
      stray(scene, shackles, GOLEM.sway, GOLEM.swayDelay),
      scene.tweens.add({ targets: eyes, alpha: GOLEM.eyeGlow.to, duration: GOLEM.eyeGlow.ms, ease: 'Sine.easeInOut', yoyo: true, repeat: -1 }),
    ],
  };
}

function fog(scene: Phaser.Scene, boss: Boss): Rig {
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

const RIGS: Record<BossId, (scene: Phaser.Scene, boss: Boss) => Rig> = { grid, debt, fog, core };

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

