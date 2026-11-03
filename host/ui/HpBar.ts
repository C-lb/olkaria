// The boss's health on the canvas: the current head's HP segment as a bar under an "HP 98/100" label, and a thin
// bar for the whole Deadlock under it (spec 3.2). The label is drawn in the digits bitmap font, which with the damage
// numbers is the only text on the canvas (spec 7). Whole pixels only, in the placeholder palette.
import Phaser from 'phaser';
import { PALETTE } from '../art/placeholders';

const hex = (colour: string): number => Number.parseInt(colour.slice(1), 16);

/** The digits font is 6 px tall; the head's bar sits 2 px under it, the total bar 2 px under that. */
const LABEL_H = 6;
const BAR_Y = LABEL_H + 2;
const BAR_H = 4;
const TOTAL_Y = BAR_Y + BAR_H + 2;

const clamp = (n: number, hi: number): number => (Number.isFinite(n) ? Math.min(hi, Math.max(0, n)) : 0);

export class HpBar extends Phaser.GameObjects.Container {
  private readonly bars: Phaser.GameObjects.Graphics;
  private readonly label: Phaser.GameObjects.BitmapText;
  /** What the bars show right now; a drain tweens these two numbers. */
  private readonly shown: { round: number; total: number };
  /** The width of both bars. (Containers already have a `w`: their 4D coordinate.) */
  private readonly barWidth: number;

  /** `w` is the width of both bars; `roundHp` is a full head, `totalHp` the whole Deadlock. */
  constructor(scene: Phaser.Scene, x: number, y: number, w: number, private readonly roundHp: number, private readonly totalHp: number) {
    super(scene, x, y);
    this.barWidth = w;
    this.bars = new Phaser.GameObjects.Graphics(scene);
    this.label = new Phaser.GameObjects.BitmapText(scene, 0, 0, 'digits', '').setTint(hex(PALETTE.bone));
    this.add([this.bars, this.label]);
    this.shown = { round: roundHp, total: totalHp };
    scene.add.existing(this);
    this.draw();
  }

  /**
   * Shows `roundRemaining` of the head and `totalRemaining` of the Deadlock: at once, or tweened over `animateMs`.
   * A new call replaces a drain still running, and asking for what is already shown changes nothing.
   */
  set(roundRemaining: number, totalRemaining: number, animateMs = 0): void {
    const round = clamp(roundRemaining, this.roundHp);
    const total = clamp(totalRemaining, this.totalHp);
    this.scene.tweens.killTweensOf(this.shown);
    if (round === this.shown.round && total === this.shown.total) return;
    if (animateMs > 0) {
      this.scene.tweens.add({
        targets: this.shown, round, total, duration: animateMs, ease: 'Sine.easeInOut',
        onUpdate: () => this.draw(), onComplete: () => this.draw(),
      });
      return;
    }
    this.shown.round = round;
    this.shown.total = total;
    this.draw();
  }

  private draw(): void {
    const w = this.barWidth;
    const head = Math.round(w * (this.shown.round / this.roundHp));
    const all = Math.round(w * (this.shown.total / this.totalHp));
    const g = this.bars.clear();
    g.fillStyle(hex(PALETTE.outline), 1).fillRect(-1, BAR_Y - 1, w + 2, BAR_H + 2).fillRect(-1, TOTAL_Y - 1, w + 2, 3);
    g.fillStyle(hex(PALETTE.stoneDeep), 1).fillRect(0, BAR_Y, w, BAR_H).fillRect(0, TOTAL_Y, w, 1);
    g.fillStyle(hex(PALETTE.ember), 1).fillRect(0, BAR_Y, head, BAR_H);
    g.fillStyle(hex(PALETTE.amber), 1).fillRect(0, BAR_Y, head, 1);   // the lit top edge of what is left
    g.fillStyle(hex(PALETTE.boneDim), 1).fillRect(0, TOTAL_Y, all, 1);
    this.label.setText(`HP ${Math.round(this.shown.round)}/${Math.round(this.roundHp)}`);
  }
}
