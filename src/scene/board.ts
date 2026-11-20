import { clearLayer, copyLayer, makeLayer, pasteLayer, roundRectPath, type Layer } from '../core/layers';
import { rand } from '../core/math';
import { CHALK_FONT, CHALK_WHITE, NUMBER_FONT, chalkSegment, chalkify } from './chalk';
import { BOARD, FLOOR_Y, H, INNER, NUMBER_HEIGHT, SLOTS, W, type BoardNumber, type Rect } from './layout';

export interface BoardSnapshot {
  numbers: BoardNumber[];
  ink: HTMLCanvasElement;
  marks: HTMLCanvasElement;
  equation: Rect | null;
}

export class Board {
  readonly room = makeLayer();
  readonly ink = makeLayer();
  readonly marks = makeLayer();
  numbers: BoardNumber[] = [];
  equation: Rect | null = null;

  measure(value: number): number {
    const c = this.ink.ctx;
    c.font = NUMBER_FONT;
    return c.measureText(String(value)).width;
  }

  place(value: number, slot: number): BoardNumber {
    const s = SLOTS[slot];
    return { value, slot, x: s.x + rand(-22, 22), y: s.y + rand(-12, 12), w: this.measure(value), h: NUMBER_HEIGHT };
  }

  drawNumberNow(n: BoardNumber): void {
    const c = this.ink.ctx;
    c.font = NUMBER_FONT;
    c.fillStyle = CHALK_WHITE;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(String(n.value), n.x, n.y);
    chalkify(c, n.x - n.w / 2 - 4, n.y - n.h / 2 - 8, n.w + 8, n.h + 16);
  }

  wipe(includeNumbers: boolean): void {
    clearLayer(this.marks);
    this.equation = null;
    if (includeNumbers) {
      clearLayer(this.ink);
      this.numbers = [];
    }
  }

  clearRect(layer: Layer, r: Rect): void {
    layer.ctx.clearRect(r.left, r.top, r.right - r.left, r.bottom - r.top);
  }

  snapshot(): BoardSnapshot {
    return {
      numbers: this.numbers.map(n => ({ ...n })),
      ink: copyLayer(this.ink),
      marks: copyLayer(this.marks),
      equation: this.equation && { ...this.equation },
    };
  }

  restore(s: BoardSnapshot): void {
    this.numbers = s.numbers.map(n => ({ ...n }));
    pasteLayer(this.ink, s.ink);
    pasteLayer(this.marks, s.marks);
    this.equation = s.equation && { ...s.equation };
  }

  paintRoom(): void {
    const c = this.room.ctx;
    c.clearRect(0, 0, W, H);

    const wall = c.createLinearGradient(0, 0, 0, FLOOR_Y);
    wall.addColorStop(0, '#efe6d2');
    wall.addColorStop(1, '#dccfb1');
    c.fillStyle = wall;
    c.fillRect(0, 0, W, FLOOR_Y);

    const light = c.createRadialGradient(W * 0.85, 40, 20, W * 0.85, 40, 520);
    light.addColorStop(0, 'rgba(255, 248, 225, 0.55)');
    light.addColorStop(1, 'rgba(255, 248, 225, 0)');
    c.fillStyle = light;
    c.fillRect(0, 0, W, FLOOR_Y);

    const floor = c.createLinearGradient(0, FLOOR_Y, 0, H);
    floor.addColorStop(0, '#9c6b40');
    floor.addColorStop(1, '#7a502e');
    c.fillStyle = floor;
    c.fillRect(0, FLOOR_Y, W, H - FLOOR_Y);
    c.strokeStyle = 'rgba(60, 35, 15, 0.25)';
    c.lineWidth = 2;
    for (let y = FLOOR_Y + 28, row = 0; y < H; y += 30, row++) {
      c.beginPath();
      c.moveTo(0, y);
      c.lineTo(W, y);
      c.stroke();
      for (let x = (row % 2) * 160 + 80; x < W; x += 320) {
        c.beginPath();
        c.moveTo(x, y - 30);
        c.lineTo(x, y);
        c.stroke();
      }
    }
    c.fillStyle = '#6e4626';
    c.fillRect(0, FLOOR_Y - 10, W, 12);

    c.fillStyle = 'rgba(70, 50, 30, 0.18)';
    roundRectPath(c, BOARD.x + 8, BOARD.y + 12, BOARD.w, BOARD.h, 10);
    c.fill();
    c.fillStyle = '#6b4423';
    roundRectPath(c, BOARD.x, BOARD.y, BOARD.w, BOARD.h, 10);
    c.fill();
    c.strokeStyle = 'rgba(255, 220, 170, 0.18)';
    c.lineWidth = 2;
    roundRectPath(c, BOARD.x + 3, BOARD.y + 3, BOARD.w - 6, BOARD.h - 6, 8);
    c.stroke();

    const slate = c.createLinearGradient(INNER.x, INNER.y, INNER.x + INNER.w, INNER.y + INNER.h);
    slate.addColorStop(0, '#2f5e4b');
    slate.addColorStop(1, '#244c3c');
    c.fillStyle = slate;
    c.fillRect(INNER.x, INNER.y, INNER.w, INNER.h);

    c.save();
    c.beginPath();
    c.rect(INNER.x, INNER.y, INNER.w, INNER.h);
    c.clip();
    for (let i = 0; i < 26; i++) {
      c.fillStyle = `rgba(255, 255, 255, ${rand(0.015, 0.04)})`;
      c.beginPath();
      c.ellipse(rand(INNER.x, INNER.x + INNER.w), rand(INNER.y, INNER.y + INNER.h),
        rand(60, 180), rand(18, 50), rand(-0.3, 0.3), 0, Math.PI * 2);
      c.fill();
    }
    c.restore();

    const trayY = BOARD.y + BOARD.h - 4;
    c.fillStyle = '#5a3819';
    c.fillRect(BOARD.x + 40, trayY, BOARD.w - 80, 14);
    c.fillStyle = '#7a5130';
    c.fillRect(BOARD.x + 40, trayY, BOARD.w - 80, 4);
    for (const [col, x] of [['#f6f4ea', 260], ['#ffe680', 290], ['#ff9ec7', 312], ['#8fd3ff', 340]] as const) {
      c.fillStyle = col;
      c.fillRect(BOARD.x + x, trayY - 6, 22, 7);
    }
    c.fillStyle = '#8b5a2b';
    c.fillRect(BOARD.x + BOARD.w - 220, trayY - 14, 64, 12);
    c.fillStyle = '#d9d4c7';
    c.fillRect(BOARD.x + BOARD.w - 220, trayY - 4, 64, 5);

    const title = "Today's numbers";
    c.font = `36px ${CHALK_FONT}`;
    c.fillStyle = 'rgba(247, 246, 236, 0.75)';
    c.textAlign = 'left';
    c.textBaseline = 'middle';
    c.fillText(title, INNER.x + 26, INNER.y + 38);
    const tw = c.measureText(title).width;
    chalkSegment(c, INNER.x + 24, INNER.y + 62, INNER.x + 30 + tw, INNER.y + 60, 'rgba(247,246,236,0.6)', 3);
    chalkify(c, INNER.x + 20, INNER.y + 14, tw + 20, 54, 0.5);
  }
}
