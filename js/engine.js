const W = 1280;
const H = 720;
const DPR = Math.min(window.devicePixelRatio || 1, 2);

const canvas = document.getElementById('stage');
const ctx = canvas.getContext('2d');
canvas.width = W * DPR;
canvas.height = H * DPR;

function makeLayer(w = W, h = H) {
  const c = document.createElement('canvas');
  c.width = Math.ceil(w * DPR);
  c.height = Math.ceil(h * DPR);
  const lctx = c.getContext('2d');
  lctx.scale(DPR, DPR);
  return { canvas: c, ctx: lctx, w, h };
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const dist = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);

const Ease = {
  linear: t => t,
  inOut: t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  out: t => 1 - Math.pow(1 - t, 3),
};

const settings = { speed: 1 };

const tweens = new Set();

function tween(ms, onUpdate, ease = Ease.inOut) {
  return new Promise(resolve => {
    tweens.add({ ms: Math.max(1, ms / settings.speed), onUpdate, ease, resolve, start: null });
  });
}

const wait = ms => tween(ms, () => {});

function updateTweens(now) {
  for (const t of tweens) {
    if (t.start === null) t.start = now;
    const p = Math.min(1, (now - t.start) / t.ms);
    t.onUpdate(t.ease(p));
    if (p >= 1) {
      tweens.delete(t);
      t.resolve();
    }
  }
}

function roundRectPath(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}
