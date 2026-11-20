let clock = 0;
let selected = null;
let busy = false;
let chosenColor = CHALK_WHITE;

const ui = {
  status: document.getElementById('status'),
  selected: document.getElementById('selected-value'),
  buttons: [...document.querySelectorAll('[data-action]')],
  swatches: [...document.querySelectorAll('[data-color]')],
  speed: document.getElementById('speed'),
  speedLabel: document.getElementById('speed-label'),
};

function render() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ctx.drawImage(roomLayer.canvas, 0, 0, W, H);
  drawSelection(ctx, selected, clock);
  ctx.drawImage(numbersLayer.canvas, 0, 0, W, H);
  ctx.drawImage(marksLayer.canvas, 0, 0, W, H);
  drawStickman(ctx, clock);
  drawBubble(ctx);
}

function frame(now) {
  clock = now;
  updateTweens(now);
  updateStickman(now);
  render();
  requestAnimationFrame(frame);
}

function selectNumber(n) {
  selected = n;
  ui.selected.textContent = n ? n.value : '–';
  ui.selected.parentElement.classList.toggle('has-value', !!n);
}

function toWorld(e) {
  const r = canvas.getBoundingClientRect();
  return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
}

canvas.addEventListener('pointermove', e => {
  const p = toWorld(e);
  canvas.style.cursor = numberAt(p.x, p.y) ? 'pointer' : 'default';
});

canvas.addEventListener('click', e => {
  const p = toWorld(e);
  const n = numberAt(p.x, p.y);
  selectNumber(n && n === selected ? null : n || null);
});

canvas.addEventListener('dblclick', e => {
  const p = toWorld(e);
  const n = numberAt(p.x, p.y);
  if (n) {
    selectNumber(n);
    runAction('point');
  }
});

const NEEDS_NUMBER = new Set(['point', 'circle', 'underline', 'tick', 'cross']);

const LABELS = {
  point: n => `Pointing at ${n.value}`,
  circle: n => `Circling ${n.value}`,
  underline: n => `Underlining ${n.value}`,
  tick: n => `Ticking ${n.value}`,
  cross: n => `Crossing out ${n.value}`,
  readAll: () => 'Reading every number',
  addUp: () => 'Adding them up',
  biggest: () => 'Finding the biggest',
  smallest: () => 'Finding the smallest',
  evens: () => 'Circling even numbers',
  clean: () => 'Cleaning the board',
  newNumbers: () => 'Writing new numbers',
  wave: () => 'Saying hi',
};

const RUN = {
  point: n => Actions.point(n),
  circle: n => Actions.circle(n),
  underline: n => Actions.underline(n),
  tick: n => Actions.tick(n),
  cross: n => Actions.cross(n),
  readAll: () => Actions.readAll(),
  addUp: () => Actions.addUp(),
  biggest: () => Actions.findExtreme('max'),
  smallest: () => Actions.findExtreme('min'),
  evens: () => Actions.evens(),
  clean: () => Actions.clean(false),
  newNumbers: () => Actions.newNumbers(),
  wave: () => Actions.wave(),
};

function setBusy(on, label = '') {
  busy = on;
  ui.buttons.forEach(b => { b.disabled = on; });
  ui.status.textContent = on ? `${label}…` : 'Ready';
  ui.status.classList.toggle('is-busy', on);
}

async function runAction(name) {
  if (busy || !RUN[name]) return;
  if (NEEDS_NUMBER.has(name) && !selected) {
    setBusy(true, 'Waiting for a number');
    await shrug('Click a number first!');
    setBusy(false);
    return;
  }
  const target = selected;
  setBusy(true, LABELS[name](target));
  try {
    await RUN[name](target);
  } finally {
    setBusy(false);
  }
}

ui.buttons.forEach(b => b.addEventListener('click', () => runAction(b.dataset.action)));

const KEYS = { p: 'point', c: 'circle', u: 'underline', t: 'tick', x: 'cross', r: 'readAll', a: 'addUp', e: 'clean', n: 'newNumbers', w: 'wave' };
window.addEventListener('keydown', e => {
  if (e.ctrlKey || e.metaKey || e.altKey || e.target.tagName === 'INPUT') return;
  const name = KEYS[e.key.toLowerCase()];
  if (name) runAction(name);
});

function applyPenColor() {
  man.penColor = chosenColor;
}

ui.swatches.forEach(s => s.addEventListener('click', () => {
  chosenColor = s.dataset.color;
  ui.swatches.forEach(o => o.setAttribute('aria-pressed', String(o === s)));
  if (!busy) applyPenColor();
}));

ui.speed.addEventListener('input', () => {
  settings.speed = Number(ui.speed.value);
  ui.speedLabel.textContent = `${settings.speed}×`;
});

async function start() {
  try {
    await Promise.race([document.fonts.load(NUMBER_FONT), new Promise(r => setTimeout(r, 1500))]);
  } catch (_) { }
  paintRoom();
  numbers = generateNumbers();
  numbers.forEach(drawNumberNow);
  requestAnimationFrame(frame);
  setBusy(true, 'Saying hi');
  await walkTo(170);
  await Actions.wave('Hi! Pick a number, then an action.');
  setBusy(false);
}

start();
