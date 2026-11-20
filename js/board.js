const BOARD = { x: 150, y: 60, w: 980, h: 412, frame: 16 };
const INNER = {
  x: BOARD.x + BOARD.frame,
  y: BOARD.y + BOARD.frame,
  w: BOARD.w - BOARD.frame * 2,
  h: BOARD.h - BOARD.frame * 2,
};
const FLOOR_Y = 600;

const CHALK_FONT = '"Gochi Hand", "Comic Sans MS", cursive';
const NUMBER_FONT = `64px ${CHALK_FONT}`;
const CHALK_WHITE = 'rgba(247, 246, 236, 0.93)';

const roomLayer = makeLayer();
const numbersLayer = makeLayer();
const marksLayer = makeLayer();

const SLOTS = [
  [300, 200], [510, 200], [720, 200], [930, 200],
  [300, 330], [510, 330], [720, 330], [930, 330],
];
const TOTAL_Y = 418;

let numbers = [];

function paintRoom() {
  const c = roomLayer.ctx;
  c.clearRect(0, 0, W, H);

  const wall = c.createLinearGradient(0, 0, 0, FLOOR_Y);
  wall.addColorStop(0, '#efe6d2');
  wall.addColorStop(1, '#dccfb1');
  c.fillStyle = wall;
  c.fillRect(0, 0, W, FLOOR_Y);

  const floor = c.createLinearGradient(0, FLOOR_Y, 0, H);
  floor.addColorStop(0, '#9c6b40');
  floor.addColorStop(1, '#7e5330');
  c.fillStyle = floor;
  c.fillRect(0, FLOOR_Y, W, H - FLOOR_Y);
  c.strokeStyle = 'rgba(60, 35, 15, 0.25)';
  c.lineWidth = 2;
  for (let y = FLOOR_Y + 28; y < H; y += 30) {
    c.beginPath();
    c.moveTo(0, y);
    c.lineTo(W, y);
    c.stroke();
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
  [['#f6f4ea', 260], ['#ffe680', 290], ['#ff9ec7', 312], ['#8fd3ff', 340]].forEach(([col, x]) => {
    c.fillStyle = col;
    c.fillRect(BOARD.x + x, trayY - 6, 22, 7);
  });
  c.fillStyle = '#8b5a2b';
  c.fillRect(BOARD.x + BOARD.w - 220, trayY - 14, 64, 12);
  c.fillStyle = '#d9d4c7';
  c.fillRect(BOARD.x + BOARD.w - 220, trayY - 4, 64, 5);

  c.font = `36px ${CHALK_FONT}`;
  c.fillStyle = 'rgba(247, 246, 236, 0.75)';
  c.textAlign = 'left';
  c.textBaseline = 'middle';
  c.fillText("Today's numbers", INNER.x + 26, INNER.y + 38);
  const tw = c.measureText("Today's numbers").width;
  chalkSegment(c, INNER.x + 24, INNER.y + 62, INNER.x + 30 + tw, INNER.y + 60, 'rgba(247,246,236,0.6)', 3);
  chalkify(c, INNER.x + 20, INNER.y + 14, tw + 20, 54, 0.5);
}

function chalkify(c, x, y, w, h, density = 0.35) {
  c.save();
  c.globalCompositeOperation = 'destination-out';
  const count = (w * h * density) / 12;
  for (let i = 0; i < count; i++) {
    c.globalAlpha = rand(0.25, 0.9);
    c.fillRect(x + rand(0, w), y + rand(0, h), rand(0.6, 2), rand(0.6, 2));
  }
  c.restore();
}

function chalkSegment(c, x1, y1, x2, y2, color, width = 5) {
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

function eraseSegment(layers, x1, y1, x2, y2, radius) {
  for (const layer of layers) {
    const c = layer.ctx;
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

function clearLayer(layer) {
  layer.ctx.clearRect(0, 0, W, H);
}

function generateNumbers() {
  const used = new Set();
  const c = numbersLayer.ctx;
  c.font = NUMBER_FONT;
  return SLOTS.map(([sx, sy]) => {
    let value;
    do value = Math.floor(rand(1, 100)); while (used.has(value));
    used.add(value);
    const w = c.measureText(String(value)).width;
    return { value, x: sx + rand(-25, 25), y: sy + rand(-14, 14), w, h: 48 };
  });
}

function drawNumberNow(n) {
  const c = numbersLayer.ctx;
  c.font = NUMBER_FONT;
  c.fillStyle = CHALK_WHITE;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(String(n.value), n.x, n.y);
  chalkify(c, n.x - n.w / 2 - 4, n.y - n.h / 2 - 8, n.w + 8, n.h + 16);
}

function prepareText(text, font, color, x, y, align = 'left') {
  const probe = numbersLayer.ctx;
  probe.font = font;
  const w = probe.measureText(text).width;
  const left = align === 'center' ? x - w / 2 : x;
  const pad = 14;
  const h = parseInt(font, 10) * 1.3;
  const layer = makeLayer(w + pad * 2, h + pad * 2);
  layer.ctx.font = font;
  layer.ctx.fillStyle = color;
  layer.ctx.textAlign = 'left';
  layer.ctx.textBaseline = 'middle';
  layer.ctx.fillText(text, pad, layer.h / 2);
  chalkify(layer.ctx, 0, 0, layer.w, layer.h);
  return { layer, left: left - pad, top: y - layer.h / 2, w: layer.w, h: layer.h, revealed: 0 };
}

function revealText(prepared, target, upToPx) {
  const from = prepared.revealed;
  const to = clamp(upToPx, 0, prepared.w);
  if (to <= from) return;
  const sx = Math.floor(from * DPR);
  const ex = Math.ceil(to * DPR);
  target.ctx.drawImage(
    prepared.layer.canvas,
    sx, 0, ex - sx, prepared.layer.canvas.height,
    prepared.left + sx / DPR, prepared.top, (ex - sx) / DPR, prepared.h,
  );
  prepared.revealed = ex / DPR;
}

function numberAt(x, y) {
  return numbers.find(n =>
    x > n.x - n.w / 2 - 16 && x < n.x + n.w / 2 + 16 &&
    y > n.y - n.h / 2 - 14 && y < n.y + n.h / 2 + 14);
}

function drawSelection(c, n, time) {
  if (!n) return;
  const pulse = 0.5 + 0.5 * Math.sin(time / 300);
  c.save();
  c.fillStyle = `rgba(255, 230, 128, ${0.08 + pulse * 0.06})`;
  roundRectPath(c, n.x - n.w / 2 - 16, n.y - n.h / 2 - 14, n.w + 32, n.h + 28, 12);
  c.fill();
  c.setLineDash([6, 6]);
  c.lineDashOffset = -time / 60;
  c.strokeStyle = `rgba(255, 230, 128, ${0.45 + pulse * 0.25})`;
  c.lineWidth = 2;
  c.stroke();
  c.restore();
}
