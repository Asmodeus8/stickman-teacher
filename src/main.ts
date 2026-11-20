import '@fontsource/gochi-hand/400.css';
import '@fontsource/nunito/500.css';
import '@fontsource/nunito/700.css';
import '@fontsource/nunito/800.css';
import './style.css';

import { Teacher } from './actions/teacher';
import { Stickman } from './actor/stickman';
import { Sfx } from './audio/sfx';
import { Voice } from './audio/voice';
import { Animator } from './core/animator';
import { DPR, roundRectPath } from './core/layers';
import { ActionQueue } from './core/queue';
import { Board } from './scene/board';
import { CHALK_FONT, NUMBER_FONT } from './scene/chalk';
import { H, W, pickSlots, pickValues, type BoardNumber } from './scene/layout';
import { Controls } from './ui/controls';

const canvas = document.getElementById('stage') as HTMLCanvasElement;
canvas.width = W * DPR;
canvas.height = H * DPR;
const ctx = canvas.getContext('2d')!;

const board = new Board();
const man = new Stickman();
const anim = new Animator();
const voice = new Voice();
const sfx = new Sfx();
const teacher = new Teacher(man, board, anim, voice, sfx);

let controls: Controls | null = null;
const queue = new ActionQueue({
  onChange: () => controls?.refresh(),
  cancelCurrent: () => anim.cancelAll(),
  recover: () => teacher.recover(),
  onError: e => console.error(e),
});
controls = new Controls(canvas, teacher, queue);

function drawHighlights(c: CanvasRenderingContext2D, time: number): void {
  const sel = controls?.selection ?? [];
  const hover = controls?.hover;
  if (hover && !sel.includes(hover)) {
    c.fillStyle = 'rgba(255, 255, 255, 0.06)';
    roundRectPath(c, hover.x - hover.w / 2 - 16, hover.y - hover.h / 2 - 14, hover.w + 32, hover.h + 28, 12);
    c.fill();
  }
  const pulse = 0.5 + 0.5 * Math.sin(time / 300);
  sel.forEach((n: BoardNumber, i) => {
    c.save();
    c.fillStyle = `rgba(255, 230, 128, ${0.08 + pulse * 0.06})`;
    roundRectPath(c, n.x - n.w / 2 - 16, n.y - n.h / 2 - 14, n.w + 32, n.h + 28, 12);
    c.fill();
    c.setLineDash([6, 6]);
    c.lineDashOffset = -time / 60;
    c.strokeStyle = `rgba(255, 230, 128, ${0.45 + pulse * 0.25})`;
    c.lineWidth = 2;
    c.stroke();
    if (sel.length > 1) {
      const bx = n.x + n.w / 2 + 14;
      const by = n.y - n.h / 2 - 12;
      c.setLineDash([]);
      c.fillStyle = '#ffe680';
      c.beginPath();
      c.arc(bx, by, 12, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#2b2b2b';
      c.font = `20px ${CHALK_FONT}`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(String(i + 1), bx, by + 1);
    }
    c.restore();
  });
}

function render(time: number): void {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ctx.drawImage(board.room.canvas, 0, 0, W, H);
  drawHighlights(ctx, time);
  ctx.drawImage(board.ink.canvas, 0, 0, W, H);
  ctx.drawImage(board.marks.canvas, 0, 0, W, H);
  man.draw(ctx, time);
  man.drawBubble(ctx);
}

function frame(now: number): void {
  anim.update(now);
  man.voiceActive = voice.speaking;
  man.gaze = queue.busy ? null : controls?.pointer ?? null;
  man.update(now, board, sfx);
  render(now);
  requestAnimationFrame(frame);
}

const unlockAudio = () => sfx.unlock();
window.addEventListener('pointerdown', unlockAudio);
window.addEventListener('keydown', unlockAudio);

async function start(): Promise<void> {
  await Promise.race([document.fonts.load(NUMBER_FONT), new Promise(r => setTimeout(r, 1500))]).catch(() => {});
  board.paintRoom();
  const values = pickValues(8);
  board.numbers = pickSlots(8).map((slot, i) => board.place(values[i], slot));
  board.numbers.forEach(n => board.drawNumberNow(n));
  man.x = -160;
  requestAnimationFrame(frame);
}

void start();
