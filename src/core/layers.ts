import { W, H } from '../scene/layout';

export const DPR = Math.min(window.devicePixelRatio || 1, 2);

export interface Layer {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  w: number;
  h: number;
}

export function makeLayer(w = W, h = H): Layer {
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(w * DPR);
  canvas.height = Math.ceil(h * DPR);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D is not supported');
  ctx.scale(DPR, DPR);
  return { canvas, ctx, w, h };
}

export function copyLayer(src: Layer): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = src.canvas.width;
  c.height = src.canvas.height;
  c.getContext('2d')?.drawImage(src.canvas, 0, 0);
  return c;
}

export function pasteLayer(dst: Layer, img: HTMLCanvasElement): void {
  const c = dst.ctx;
  c.save();
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.clearRect(0, 0, dst.canvas.width, dst.canvas.height);
  c.drawImage(img, 0, 0);
  c.restore();
}

export function clearLayer(layer: Layer): void {
  layer.ctx.clearRect(0, 0, layer.w, layer.h);
}

export function roundRectPath(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}
