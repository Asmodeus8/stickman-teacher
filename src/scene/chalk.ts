import { DPR, makeLayer, type Layer } from '../core/layers';
import { clamp, lerp, rand } from '../core/math';
import type { Rect } from './layout';

export const CHALK_FONT = '"Gochi Hand", "Comic Sans MS", cursive';
export const NUMBER_FONT = `64px ${CHALK_FONT}`;
export const EQUATION_FONT = `46px ${CHALK_FONT}`;
export const CHALK_WHITE = 'rgba(247, 246, 236, 0.93)';

export const CHALK_COLORS = [
  { name: 'White', value: CHALK_WHITE, swatch: '#f7f6ec' },
  { name: 'Yellow', value: '#ffe680', swatch: '#ffe680' },
  { name: 'Pink', value: '#ff9ec7', swatch: '#ff9ec7' },
  { name: 'Blue', value: '#8fd3ff', swatch: '#8fd3ff' },
] as const;

export function chalkify(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, density = 0.35): void {
  c.save();
  c.globalCompositeOperation = 'destination-out';
  const count = (w * h * density) / 12;
  for (let i = 0; i < count; i++) {
    c.globalAlpha = rand(0.25, 0.9);
    c.fillRect(x + rand(0, w), y + rand(0, h), rand(0.6, 2), rand(0.6, 2));
  }
  c.restore();
}

export function chalkSegment(c: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, color: string, width = 5): void {
  c.save();
  c.lineCap = 'round';
  c.lineJoin = 'round';
  c.strokeStyle = color;
  c.globalAlpha = 0.85;
  c.lineWidth = width;
  c.beginPath();
  c.moveTo(x1, y1);
  c.lineTo(x2, y2);
  c.stroke();
  c.globalAlpha = 0.35;
  c.lineWidth = width * 0.6;
  c.beginPath();
  c.moveTo(x1 + rand(-1.5, 1.5), y1 + rand(-1.5, 1.5));
  c.lineTo(x2 + rand(-1.5, 1.5), y2 + rand(-1.5, 1.5));
  c.stroke();
  c.globalCompositeOperation = 'destination-out';
  c.globalAlpha = 0.6;
  const len = Math.hypot(x2 - x1, y2 - y1);
  for (let i = 0; i < len / 2.5; i++) {
    const t = Math.random();
    c.fillRect(lerp(x1, x2, t) + rand(-width / 2, width / 2), lerp(y1, y2, t) + rand(-width / 2, width / 2), 1.3, 1.3);
  }
  c.restore();
}

export function eraseSegment(layers: readonly Layer[], x1: number, y1: number, x2: number, y2: number, radius: number): void {
  for (const { ctx: c } of layers) {
    c.save();
    c.globalCompositeOperation = 'destination-out';
    c.globalAlpha = 0.85;
    c.lineCap = 'round';
    c.lineWidth = radius * 2;
    c.beginPath();
    c.moveTo(x1, y1);
    c.lineTo(x2, y2);
    c.stroke();
    c.restore();
  }
}

export interface PreparedText {
  layer: Layer;
  rect: Rect;
  revealed: number;
}

export function prepareText(text: string, font: string, color: string, x: number, y: number, align: 'left' | 'center' = 'left'): PreparedText {
  const probe = makeLayer(1, 1).ctx;
  probe.font = font;
  const w = probe.measureText(text).width;
  const pad = 14;
  const h = parseInt(font, 10) * 1.3;
  const layer = makeLayer(w + pad * 2, h + pad * 2);
  layer.ctx.font = font;
  layer.ctx.fillStyle = color;
  layer.ctx.textBaseline = 'middle';
  layer.ctx.fillText(text, pad, layer.h / 2);
  chalkify(layer.ctx, 0, 0, layer.w, layer.h);
  const left = (align === 'center' ? x - w / 2 : x) - pad;
  const top = y - layer.h / 2;
  return { layer, rect: { left, right: left + layer.w, top, bottom: top + layer.h }, revealed: 0 };
}

export function revealText(p: PreparedText, target: Layer, upTo: number): void {
  const to = clamp(upTo, 0, p.layer.w);
  if (to <= p.revealed) return;
  const sx = Math.floor(p.revealed * DPR);
  const ex = Math.ceil(to * DPR);
  target.ctx.drawImage(
    p.layer.canvas,
    sx, 0, ex - sx, p.layer.canvas.height,
    p.rect.left + sx / DPR, p.rect.top, (ex - sx) / DPR, p.layer.h,
  );
  p.revealed = ex / DPR;
}
