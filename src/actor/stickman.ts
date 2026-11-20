import type { Sfx } from '../audio/sfx';
import type { Layer } from '../core/layers';
import { roundRectPath } from '../core/layers';
import { clamp, dist, lerp, type Vec } from '../core/math';
import type { Board } from '../scene/board';
import { CHALK_FONT, CHALK_WHITE, chalkSegment, eraseSegment } from '../scene/chalk';
import { FOOT_Y, W } from '../scene/layout';
import { gripFor, solveIK, type ArmSolution } from './ik';

export const BODY = {
  head: 24,
  neck: 10,
  torso: 105,
  upperArm: 85,
  foreArm: 80,
  thigh: 72,
  shin: 70,
  stick: 150,
};
export const REST_TIP = { dx: 95, y: 652 };

const INK = '#151515';
const HALO = 'rgba(246, 239, 224, 0.95)';
const BUBBLE_FONT = `27px ${CHALK_FONT}`;

export type Facing = 1 | -1;
export type Tool = 'stick' | 'chalk' | 'eraser';
export type Gesture = 'none' | 'wave' | 'shrug' | 'cheer';

interface Leg {
  knee: Vec;
  foot: Vec;
  toe: Vec;
}

export interface Pose {
  hip: Vec;
  shoulder: Vec;
  neck: Vec;
  head: Vec;
  legs: Leg[];
  front: ArmSolution;
  back: ArmSolution;
  tip: Vec;
  stickDir: Vec;
}

export class Stickman {
  x = 70;
  facing: Facing = 1;
  walking = false;
  walkPhase = 0;
  hop = 0;
  tip = { dx: REST_TIP.dx, y: REST_TIP.y };
  tool: Tool = 'stick';
  penDown = false;
  writing = false;
  penColor: string = CHALK_WHITE;
  eraseLayers: Layer[] | null = null;
  gesture: Gesture = 'none';
  gestureAmt = 0;
  look: Vec | null = null;
  talkUntil = 0;
  voiceActive = false;
  bubble = { text: '', alpha: 0 };
  pose: Pose | null = null;

  private lastTip: Vec | null = null;
  private lastStep = 0;

  computePose(time: number): Pose {
    const f = this.facing;
    const bob = this.walking ? -Math.abs(Math.sin(this.walkPhase)) * 5 : Math.sin(time / 650) * 1.2;
    const lift = this.hop;
    const hip = { x: this.x, y: FOOT_Y - BODY.thigh - BODY.shin + 4 + bob - lift };
    const shoulder = { x: this.x + f * 2, y: hip.y - BODY.torso };
    const neck = { x: shoulder.x + f * 2, y: shoulder.y - BODY.neck };
    const head = { x: neck.x + f * 3, y: neck.y - BODY.head };

    const legs = [0, Math.PI].map((offset, i): Leg => {
      const swing = this.walking ? Math.sin(this.walkPhase + offset) * 0.45 : i ? 0.12 : -0.12;
      const thighA = Math.PI / 2 + f * swing;
      const knee = { x: hip.x + Math.cos(thighA) * BODY.thigh, y: hip.y + Math.sin(thighA) * BODY.thigh };
      const bend = this.walking ? Math.max(0, -Math.cos(this.walkPhase + offset)) * 0.7 : 0.06 + lift / 60;
      const shinA = thighA + f * bend;
      const foot = {
        x: knee.x + Math.cos(shinA) * BODY.shin,
        y: Math.min(FOOT_Y - lift, knee.y + Math.sin(shinA) * BODY.shin),
      };
      return { knee, foot, toe: { x: foot.x + f * 13, y: foot.y } };
    });

    const sway = this.walking ? Math.sin(this.walkPhase * 2) * 4 : 0;
    const wantTip = { x: this.x + this.tip.dx, y: this.tip.y + sway };
    const grip = { x: shoulder.x + f * 20, y: shoulder.y + 70 };
    const front = solveIK(shoulder, gripFor(wantTip, grip, BODY.stick), BODY.upperArm, BODY.foreArm, f);
    const len = dist(front.hand, wantTip) || 1;
    const stickDir = { x: (wantTip.x - front.hand.x) / len, y: (wantTip.y - front.hand.y) / len };
    const tip = { x: front.hand.x + stickDir.x * BODY.stick, y: front.hand.y + stickDir.y * BODY.stick };

    const relaxed = { x: shoulder.x - f * 18, y: shoulder.y + 150 };
    const targets: Record<Gesture, Vec> = {
      none: relaxed,
      wave: { x: shoulder.x - f * 35 + Math.sin(time / 110) * 24, y: shoulder.y - 135 },
      shrug: { x: shoulder.x - f * 80, y: shoulder.y - 20 },
      cheer: { x: shoulder.x - f * 25, y: shoulder.y - 160 },
    };
    const g = targets[this.gesture];
    const backHand = { x: lerp(relaxed.x, g.x, this.gestureAmt), y: lerp(relaxed.y, g.y, this.gestureAmt) };
    const back = solveIK(shoulder, backHand, BODY.upperArm, BODY.foreArm, this.gesture === 'none' ? f : -f);

    return { hip, shoulder, neck, head, legs, front, back, tip, stickDir };
  }

  update(time: number, board: Board, sfx: Sfx): void {
    const pose = this.computePose(time);
    this.pose = pose;
    const tip = pose.tip;
    const speed = this.lastTip ? dist(this.lastTip, tip) : 0;

    if (this.lastTip) {
      if (this.penDown) {
        chalkSegment(board.marks.ctx, this.lastTip.x, this.lastTip.y, tip.x, tip.y, this.penColor, 5);
      } else if (this.eraseLayers) {
        eraseSegment(this.eraseLayers, this.lastTip.x, this.lastTip.y, tip.x, tip.y, 34);
      }
    }
    sfx.scratch(this.penDown || this.writing ? clamp(speed / 5, 0.15, 1) : 0);
    sfx.erase(this.eraseLayers ? clamp(speed / 8, 0.2, 1) : 0);

    if (this.walking) {
      const step = Math.floor(this.walkPhase / Math.PI);
      if (step !== this.lastStep) {
        this.lastStep = step;
        sfx.step();
      }
    }
    this.lastTip = { x: tip.x, y: tip.y };
  }

  get talking(): boolean {
    return this.pose !== null && (this.voiceActive || performance.now() < this.talkUntil) && this.bubble.alpha > 0.05;
  }

  draw(c: CanvasRenderingContext2D, time: number): void {
    const p = this.pose;
    if (!p) return;
    c.save();

    c.fillStyle = `rgba(40, 25, 10, ${0.18 - this.hop / 400})`;
    c.beginPath();
    c.ellipse(this.x, FOOT_Y + 4, 46 - this.hop / 3, 7, 0, 0, Math.PI * 2);
    c.fill();

    inked(c, 6, () => polyline(c, [p.shoulder, p.back.elbow, p.back.hand]));
    inked(c, 6, () => {
      for (const l of p.legs) polyline(c, [p.hip, l.knee, l.foot, l.toe]);
      polyline(c, [p.hip, p.shoulder, p.neck]);
    });
    this.drawHead(c, p.head, time);

    inked(c, 5, () => polyline(c, [p.front.hand, p.tip]), '#8a5a2b');
    this.drawTool(c, p);
    inked(c, 6, () => polyline(c, [p.shoulder, p.front.elbow, p.front.hand]));
    c.fillStyle = INK;
    c.beginPath();
    c.arc(p.front.hand.x, p.front.hand.y, 5, 0, Math.PI * 2);
    c.fill();

    c.restore();
  }

  drawBubble(c: CanvasRenderingContext2D): void {
    const p = this.pose;
    const b = this.bubble;
    if (!p || b.alpha < 0.01 || !b.text) return;
    const f = this.facing;
    c.save();
    c.globalAlpha = b.alpha;
    c.font = BUBBLE_FONT;
    const bw = c.measureText(b.text).width + 36;
    const bh = 50;
    const cx = clamp(p.head.x - f * (bw / 2 + 30), bw / 2 + 12, W - bw / 2 - 12);
    const top = p.head.y - 98;

    c.fillStyle = 'rgba(30, 20, 10, 0.18)';
    roundRectPath(c, cx - bw / 2 + 3, top + 4, bw, bh, 18);
    c.fill();
    c.fillStyle = '#fffdf6';
    c.strokeStyle = INK;
    c.lineWidth = 3;
    roundRectPath(c, cx - bw / 2, top, bw, bh, 18);
    c.fill();
    c.stroke();

    const tx = clamp(p.head.x - f * 12, cx - bw / 2 + 20, cx + bw / 2 - 20);
    const tail = { x: p.head.x - f * 6, y: p.head.y - BODY.head - 6 };
    c.beginPath();
    c.moveTo(tx - 9, top + bh - 1.5);
    c.lineTo(tail.x, tail.y);
    c.lineTo(tx + 9, top + bh - 1.5);
    c.fill();
    c.beginPath();
    c.moveTo(tx - 9, top + bh);
    c.lineTo(tail.x, tail.y);
    c.lineTo(tx + 9, top + bh);
    c.stroke();

    c.fillStyle = '#222';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(b.text, cx, top + bh / 2 + 1);
    c.restore();
  }

  private drawTool(c: CanvasRenderingContext2D, p: Pose): void {
    const { tip, stickDir } = p;
    if (this.tool === 'eraser') {
      c.save();
      c.translate(tip.x, tip.y);
      c.rotate(Math.atan2(stickDir.y, stickDir.x) + Math.PI / 2);
      c.fillStyle = '#8b5a2b';
      c.fillRect(-26, -16, 52, 14);
      c.fillStyle = '#e1dccf';
      c.fillRect(-26, -3, 52, 7);
      c.restore();
    } else if (this.tool === 'chalk') {
      c.strokeStyle = this.penColor;
      c.lineWidth = 7;
      c.lineCap = 'round';
      polyline(c, [{ x: tip.x - stickDir.x * 14, y: tip.y - stickDir.y * 14 }, tip]);
    } else {
      c.fillStyle = '#d64933';
      c.beginPath();
      c.arc(tip.x, tip.y, 4, 0, Math.PI * 2);
      c.fill();
    }
  }

  private drawHead(c: CanvasRenderingContext2D, h: Vec, time: number): void {
    const f = this.facing;
    const r = BODY.head;
    c.fillStyle = HALO;
    c.beginPath();
    c.arc(h.x, h.y, r + 4, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#fbf7ee';
    c.strokeStyle = INK;
    c.lineWidth = 5;
    c.beginPath();
    c.arc(h.x, h.y, r, 0, Math.PI * 2);
    c.fill();
    c.stroke();

    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(h.x - f * 4, h.y - r + 1);
    c.quadraticCurveTo(h.x + f * 2, h.y - r - 12, h.x + f * 10, h.y - r - 6);
    c.stroke();

    let lx = f * 1.5;
    let ly = 0;
    if (this.look) {
      const a = Math.atan2(this.look.y - h.y, this.look.x - h.x);
      lx = Math.cos(a) * 2.2;
      ly = Math.sin(a) * 2.2;
    }
    const blink = time % 4200 < 120;
    c.fillStyle = INK;
    for (const ex of [f * 5, f * 15]) {
      if (blink) {
        c.fillRect(h.x + ex - 3 + lx, h.y - 4, 6, 2);
      } else {
        c.beginPath();
        c.arc(h.x + ex + lx, h.y - 4 + ly, 2.8, 0, Math.PI * 2);
        c.fill();
      }
    }

    const mx = h.x + f * 10;
    const my = h.y + 9;
    c.lineWidth = 2.5;
    if (this.talking) {
      const open = 2 + Math.abs(Math.sin(time / 70)) * 5;
      c.beginPath();
      c.ellipse(mx, my, 5, open, 0, 0, Math.PI * 2);
      c.fill();
    } else {
      c.beginPath();
      c.arc(mx, my - 4, 7, 0.25 * Math.PI, 0.75 * Math.PI);
      c.stroke();
    }
  }
}

function polyline(c: CanvasRenderingContext2D, pts: Vec[]): void {
  c.beginPath();
  c.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) c.lineTo(pts[i].x, pts[i].y);
  c.stroke();
}

function inked(c: CanvasRenderingContext2D, width: number, draw: () => void, ink = INK): void {
  c.lineCap = 'round';
  c.lineJoin = 'round';
  c.strokeStyle = HALO;
  c.lineWidth = width + 7;
  draw();
  c.strokeStyle = ink;
  c.lineWidth = width;
  draw();
}
