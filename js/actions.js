async function turn(dir) {
  if (man.facing === dir) return;
  const from = man.tip.dx;
  await tween(240, t => {
    man.tip.dx = lerp(from, -from, t);
    if (t > 0.5) man.facing = dir;
  });
}

async function walkTo(x) {
  x = clamp(x, 60, W - 60);
  const distance = Math.abs(x - man.x);
  if (distance < 4) return;
  const dir = Math.sign(x - man.x);
  await turn(dir);
  const x0 = man.x;
  const phase0 = man.walkPhase;
  man.walking = true;
  await tween(250 + distance * 3.1, t => {
    man.x = lerp(x0, x, t);
    man.walkPhase = phase0 + Math.abs(man.x - x0) / 36;
  });
  man.walking = false;
}

async function moveTip(wx, wy, ms = 500) {
  const fromDx = man.tip.dx;
  const fromY = man.tip.y;
  const toDx = wx - man.x;
  await tween(ms, t => {
    man.tip.dx = lerp(fromDx, toDx, t);
    man.tip.y = lerp(fromY, wy, t);
  });
}

async function restArm() {
  man.tool = 'stick';
  await moveTip(man.x + man.facing * REST_TIP.dx, REST_TIP.y, 450);
}

async function approach(point) {
  await restArm();
  const side = man.x <= point.x ? -1 : 1;
  let stand = point.x + side * 105;
  if (stand < 60) stand = point.x + 105;
  if (stand > W - 60) stand = point.x - 105;
  await walkTo(stand);
  await turn(Math.sign(point.x - man.x) || 1);
  man.look = { x: point.x, y: point.y };
}

function setBubble(text) {
  man.bubble.text = text;
  man.bubble.alpha = 1;
  man.talkUntil = clock + Math.min(1400, 250 + text.length * 45) / settings.speed;
}

async function say(text, ms = 1300) {
  man.bubble.text = text;
  man.talkUntil = clock + Math.min(ms, 250 + text.length * 45) / settings.speed;
  const a0 = man.bubble.alpha;
  await tween(150, t => { man.bubble.alpha = lerp(a0, 1, t); });
  await wait(ms);
  await hideBubble();
}

async function hideBubble() {
  const a0 = man.bubble.alpha;
  await tween(180, t => { man.bubble.alpha = lerp(a0, 0, t); });
}

async function gesture(kind, ms) {
  man.gesture = kind;
  await tween(250, t => { man.gestureAmt = t; });
  await wait(ms);
  await tween(250, t => { man.gestureAmt = 1 - t; });
  man.gesture = 'none';
}

async function tap(wx, wy) {
  for (let i = 0; i < 2; i++) {
    await moveTip(wx - man.facing * 8, wy + 6, 120);
    await moveTip(wx, wy, 120);
  }
}

async function chalkPath(fn, ms, color = man.penColor) {
  man.tool = 'chalk';
  const start = fn(0);
  await moveTip(start.x, start.y, 380);
  man.penColor = color;
  man.penDown = true;
  await tween(ms, t => {
    const pt = fn(t);
    man.tip.dx = pt.x - man.x;
    man.tip.y = pt.y;
  }, Ease.linear);
  man.penDown = false;
}

async function writeText(text, x, y, target, font, align = 'left', msPerPx = 7) {
  const prepared = prepareText(text, font, man.penColor, x, y, align);
  const left = prepared.left + 12;
  const right = prepared.left + prepared.w - 12;
  await restArm();
  await walkTo(left - 105);
  await turn(1);
  man.look = { x: left, y };
  man.tool = 'chalk';
  await moveTip(left, y, 300);
  const x0 = man.x;
  const walkDist = Math.max(0, right - left - 60);
  const phase0 = man.walkPhase;
  man.walking = walkDist > 20;
  await tween(Math.max(450, prepared.w * msPerPx), t => {
    const tipX = lerp(left, right, t);
    man.x = x0 + walkDist * t;
    man.walkPhase = phase0 + (man.x - x0) / 36;
    man.tip.dx = tipX - man.x;
    man.tip.y = y + Math.sin(t * prepared.w / 7) * 10;
    revealText(prepared, target, tipX - prepared.left + 16);
  }, Ease.linear);
  revealText(prepared, target, prepared.w);
  man.walking = false;
}

function readingOrder() {
  return [...numbers].sort((a, b) => (Math.abs(a.y - b.y) > 60 ? a.y - b.y : a.x - b.x));
}

const pointSpot = n => ({ x: n.x - man.facing * (n.w / 2 + 10), y: n.y + 26 });

async function pointTo(n) {
  await approach(n);
  const s = pointSpot(n);
  await moveTip(s.x, s.y, 520);
}

const Actions = {
  async point(n) {
    await pointTo(n);
    const s = pointSpot(n);
    await tap(s.x, s.y);
    await say(`That's ${n.value}!`);
    await restArm();
    man.look = null;
  },

  async circle(n, color = man.penColor, silent = false) {
    await approach(n);
    const rx = n.w / 2 + 24;
    const ry = n.h / 2 + 18;
    const a0 = man.facing > 0 ? Math.PI * 0.85 : Math.PI * 0.15;
    const dirSign = man.facing > 0 ? 1 : -1;
    await chalkPath(t => {
      const a = a0 + dirSign * t * Math.PI * 2.12;
      const wobble = 1 + Math.sin(a * 3) * 0.035;
      return { x: n.x + Math.cos(a) * rx * wobble, y: n.y + Math.sin(a) * ry * wobble };
    }, 1100, color);
    if (!silent) await say(`Circled ${n.value}`, 900);
    await restArm();
    man.look = null;
  },

  async underline(n) {
    await approach(n);
    const y = n.y + n.h / 2 + 12;
    const x1 = n.x - n.w / 2 - 10;
    const x2 = n.x + n.w / 2 + 10;
    const [from, to] = man.facing > 0 ? [x1, x2] : [x2, x1];
    await chalkPath(t => ({ x: lerp(from, to, t), y: y + Math.sin(t * Math.PI) * 3 }), 550);
    await chalkPath(t => ({ x: lerp(from + 6, to - 6, t), y: y + 9 + Math.sin(t * Math.PI) * 2 }), 450);
    await restArm();
    man.look = null;
  },

  async tick(n) {
    await approach(n);
    const x = n.x + n.w / 2 + 16;
    const y = n.y + 4;
    await chalkPath(t => (t < 0.3
      ? { x: lerp(x, x + 14, t / 0.3), y: lerp(y, y + 18, t / 0.3) }
      : { x: lerp(x + 14, x + 44, (t - 0.3) / 0.7), y: lerp(y + 18, y - 30, (t - 0.3) / 0.7) }), 520);
    await say('Correct!', 800);
    await restArm();
    man.look = null;
  },

  async cross(n) {
    await approach(n);
    const hw = n.w / 2 + 12;
    const hh = n.h / 2 + 6;
    await chalkPath(t => ({ x: lerp(n.x - hw, n.x + hw, t), y: lerp(n.y - hh, n.y + hh, t) }), 380);
    await chalkPath(t => ({ x: lerp(n.x + hw, n.x - hw, t), y: lerp(n.y - hh, n.y + hh, t) }), 380);
    await say('Crossed out', 800);
    await restArm();
    man.look = null;
  },

  async readAll() {
    for (const n of readingOrder()) {
      await pointTo(n);
      setBubble(String(n.value));
      await wait(450);
    }
    await hideBubble();
    await restArm();
    man.look = null;
  },

  async addUp() {
    let total = 0;
    for (const n of readingOrder()) {
      await pointTo(n);
      const before = total;
      total += n.value;
      setBubble(before === 0 ? `${n.value}` : `${before} + ${n.value} = ${total}`);
      await wait(650);
    }
    await hideBubble();
    await writeText(`Total = ${total}`, W / 2, TOTAL_Y, marksLayer, `46px ${CHALK_FONT}`, 'center');
    await restArm();
    await say(`They add up to ${total}!`, 1300);
    man.look = null;
  },

  async findExtreme(kind) {
    await scanBoard();
    const pick = numbers.reduce((best, n) =>
      (kind === 'max' ? n.value > best.value : n.value < best.value) ? n : best);
    await Actions.circle(pick, '#ffe680', true);
    await say(`${pick.value} is the ${kind === 'max' ? 'biggest' : 'smallest'}!`, 1300);
  },

  async evens() {
    const evens = readingOrder().filter(n => n.value % 2 === 0);
    if (!evens.length) {
      await shrug('No even numbers here!');
      return;
    }
    for (const n of evens) await Actions.circle(n, '#8fd3ff', true);
    await say(`${evens.length} even number${evens.length > 1 ? 's' : ''}`, 1200);
  },

  async clean(includeNumbers = false) {
    await restArm();
    await walkTo(70);
    await turn(1);
    man.tool = 'eraser';
    const top = INNER.y + 50;
    const bottom = INNER.y + INNER.h - 30;
    await moveTip(man.x + 105, top, 350);
    man.eraseLayers = includeNumbers ? [marksLayer, numbersLayer] : [marksLayer];
    const x0 = man.x;
    const x1 = INNER.x + INNER.w - 105;
    const phase0 = man.walkPhase;
    man.walking = true;
    await tween(3400, t => {
      man.x = lerp(x0, x1, t);
      man.walkPhase = phase0 + (man.x - x0) / 36;
      man.tip.dx = 105;
      man.tip.y = lerp(top, bottom, 0.5 - 0.5 * Math.cos(t * Math.PI * 22));
    }, Ease.linear);
    man.walking = false;
    man.eraseLayers = null;
    clearLayer(marksLayer);
    if (includeNumbers) clearLayer(numbersLayer);
    await restArm();
  },

  async newNumbers() {
    selectNumber(null);
    await Actions.clean(true);
    numbers = [];
    const fresh = generateNumbers();
    const order = [...fresh].sort((a, b) => (Math.abs(a.y - b.y) > 60 ? a.y - b.y : a.x - b.x));
    man.penColor = CHALK_WHITE;
    for (const n of order) {
      await writeText(String(n.value), n.x, n.y, numbersLayer, NUMBER_FONT, 'center', 9);
      numbers.push(n);
    }
    applyPenColor();
    await restArm();
    await say('Fresh numbers!', 1000);
  },

  async wave(text = 'Hi there!') {
    man.look = null;
    man.talkUntil = clock + 900;
    await Promise.all([gesture('wave', 1200), say(text, 1300)]);
  },
};

async function scanBoard() {
  await restArm();
  await walkTo(W / 2 - 40);
  await turn(1);
  setBubble('Hmm...');
  await tween(1100, t => {
    man.look = { x: lerp(INNER.x, INNER.x + INNER.w, t), y: INNER.y + 160 + Math.sin(t * Math.PI * 2) * 60 };
  });
  await hideBubble();
}

async function shrug(text) {
  man.look = null;
  await Promise.all([gesture('shrug', 1100), say(text, 1300)]);
}
