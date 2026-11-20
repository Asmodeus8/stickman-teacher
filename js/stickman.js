const BODY = {
  head: 24, neck: 10, torso: 105,
  upperArm: 85, foreArm: 80,
  thigh: 72, shin: 70,
  stick: 150,
  footY: 668,
};
const REST_TIP = { dx: 95, y: 652 };
const INK = '#151515';
const HALO = 'rgba(246, 239, 224, 0.95)';

const man = {
  x: 70,
  facing: 1,
  walking: false,
  walkPhase: 0,
  tip: { dx: REST_TIP.dx, y: REST_TIP.y },
  tool: 'stick',
  penDown: false,
  penColor: CHALK_WHITE,
  eraseLayers: null,
  gesture: 'none',
  gestureAmt: 0,
  look: null,
  talkUntil: 0,
  bubble: { text: '', alpha: 0 },
  pose: null,
  lastTip: null,
};

function solveIK(shoulder, target, a, b, bend) {
  const dx = target.x - shoulder.x;
  const dy = target.y - shoulder.y;
  const d = clamp(Math.hypot(dx, dy), Math.abs(a - b) + 0.01, a + b - 0.01);
  const base = Math.atan2(dy, dx);
  const cosA = clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1);
  const angle = base + bend * Math.acos(cosA);
  return {
    elbow: { x: shoulder.x + Math.cos(angle) * a, y: shoulder.y + Math.sin(angle) * a },
    hand: { x: shoulder.x + Math.cos(base) * d, y: shoulder.y + Math.sin(base) * d },
  };
}

function computePose(time) {
  const f = man.facing;
  const bob = man.walking ? -Math.abs(Math.sin(man.walkPhase)) * 5 : Math.sin(time / 650) * 1.2;
  const hip = { x: man.x, y: BODY.footY - BODY.thigh - BODY.shin + 4 + bob };
  const shoulder = { x: man.x + f * 2, y: hip.y - BODY.torso };
  const neck = { x: shoulder.x + f * 2, y: shoulder.y - BODY.neck };
  const head = { x: neck.x + f * 3, y: neck.y - BODY.head };

  const legs = [0, Math.PI].map((offset, i) => {
    const swing = man.walking ? Math.sin(man.walkPhase + offset) * 0.45 : (i ? 0.12 : -0.12);
    const thighA = Math.PI / 2 + f * swing;
    const knee = { x: hip.x + Math.cos(thighA) * BODY.thigh, y: hip.y + Math.sin(thighA) * BODY.thigh };
    const bendAmt = man.walking ? Math.max(0, -Math.cos(man.walkPhase + offset)) * 0.7 : 0.06;
    const shinA = thighA + f * bendAmt;
    const foot = { x: knee.x + Math.cos(shinA) * BODY.shin, y: Math.min(BODY.footY, knee.y + Math.sin(shinA) * BODY.shin) };
    return { knee, foot, toe: { x: foot.x + f * 13, y: foot.y } };
  });

  const sway = man.walking ? Math.sin(man.walkPhase * 2) * 4 : 0;
  const wantTip = { x: man.x + man.tip.dx, y: man.tip.y + sway };
  const grip = { x: shoulder.x + f * 20, y: shoulder.y + 70 };
  const toGrip = dist(wantTip, grip) || 1;
  const handTarget = {
    x: wantTip.x + ((grip.x - wantTip.x) / toGrip) * BODY.stick,
    y: wantTip.y + ((grip.y - wantTip.y) / toGrip) * BODY.stick,
  };
  const front = solveIK(shoulder, handTarget, BODY.upperArm, BODY.foreArm, f);
  const stickLen = dist(front.hand, wantTip) || 1;
  const sdir = { x: (wantTip.x - front.hand.x) / stickLen, y: (wantTip.y - front.hand.y) / stickLen };
  const tip = { x: front.hand.x + sdir.x * BODY.stick, y: front.hand.y + sdir.y * BODY.stick };

  const relaxed = { x: shoulder.x - f * 18, y: shoulder.y + 150 };
  let gestureTarget = relaxed;
  if (man.gesture === 'wave') {
    gestureTarget = { x: shoulder.x - f * 35 + Math.sin(time / 110) * 24, y: shoulder.y - 135 };
  } else if (man.gesture === 'shrug') {
    gestureTarget = { x: shoulder.x - f * 80, y: shoulder.y - 20 };
  }
  const backHand = {
    x: lerp(relaxed.x, gestureTarget.x, man.gestureAmt),
    y: lerp(relaxed.y, gestureTarget.y, man.gestureAmt),
  };
  const back = solveIK(shoulder, backHand, BODY.upperArm, BODY.foreArm, man.gesture === 'none' ? f : -f);

  return { hip, shoulder, neck, head, legs, front, back, tip, sdir };
}

function updateStickman(time) {
  man.pose = computePose(time);
  const tip = man.pose.tip;
  if (man.lastTip) {
    if (man.penDown) {
      chalkSegment(marksLayer.ctx, man.lastTip.x, man.lastTip.y, tip.x, tip.y, man.penColor, 5);
    } else if (man.eraseLayers) {
      eraseSegment(man.eraseLayers, man.lastTip.x, man.lastTip.y, tip.x, tip.y, 34);
    }
  }
  man.lastTip = { x: tip.x, y: tip.y };
}

function polyline(c, pts) {
  c.beginPath();
  c.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) c.lineTo(pts[i].x, pts[i].y);
  c.stroke();
}

function inked(c, width, draw, ink = INK) {
  c.lineCap = 'round';
  c.lineJoin = 'round';
  c.strokeStyle = HALO;
  c.lineWidth = width + 7;
  draw();
  c.strokeStyle = ink;
  c.lineWidth = width;
  draw();
}

function drawStickman(c, time) {
  const p = man.pose;
  if (!p) return;
  const f = man.facing;
  c.save();

  c.fillStyle = 'rgba(40, 25, 10, 0.18)';
  c.beginPath();
  c.ellipse(man.x, BODY.footY + 4, 46, 7, 0, 0, Math.PI * 2);
  c.fill();

  inked(c, 6, () => polyline(c, [p.shoulder, p.back.elbow, p.back.hand]));
  inked(c, 6, () => {
    p.legs.forEach(l => polyline(c, [p.hip, l.knee, l.foot, l.toe]));
    polyline(c, [p.hip, p.shoulder, p.neck]);
  });
  drawHead(c, p.head, f, time);

  inked(c, 5, () => polyline(c, [p.front.hand, p.tip]), '#8a5a2b');
  drawTool(c, p);
  inked(c, 6, () => polyline(c, [p.shoulder, p.front.elbow, p.front.hand]));
  c.fillStyle = INK;
  c.beginPath();
  c.arc(p.front.hand.x, p.front.hand.y, 5, 0, Math.PI * 2);
  c.fill();

  c.restore();
}

function drawTool(c, p) {
  const { tip, sdir } = p;
  if (man.tool === 'eraser') {
    c.save();
    c.translate(tip.x, tip.y);
    c.rotate(Math.atan2(sdir.y, sdir.x) + Math.PI / 2);
    c.fillStyle = '#8b5a2b';
    c.fillRect(-26, -16, 52, 14);
    c.fillStyle = '#e1dccf';
    c.fillRect(-26, -3, 52, 7);
    c.restore();
  } else if (man.tool === 'chalk') {
    c.strokeStyle = man.penColor;
    c.lineWidth = 7;
    c.lineCap = 'round';
    polyline(c, [{ x: tip.x - sdir.x * 14, y: tip.y - sdir.y * 14 }, tip]);
  } else {
    c.fillStyle = '#d64933';
    c.beginPath();
    c.arc(tip.x, tip.y, 4, 0, Math.PI * 2);
    c.fill();
  }
}

function drawHead(c, h, f, time) {
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
  if (man.look) {
    const a = Math.atan2(man.look.y - h.y, man.look.x - h.x);
    lx = Math.cos(a) * 2.2;
    ly = Math.sin(a) * 2.2;
  }
  const blink = (time % 4200) < 120;
  c.fillStyle = INK;
  [f * 5, f * 15].forEach(ex => {
    if (blink) {
      c.fillRect(h.x + ex - 3 + lx, h.y - 4, 6, 2);
    } else {
      c.beginPath();
      c.arc(h.x + ex + lx, h.y - 4 + ly, 2.8, 0, Math.PI * 2);
      c.fill();
    }
  });

  const talking = time < man.talkUntil;
  const mx = h.x + f * 10;
  const my = h.y + 9;
  c.lineWidth = 2.5;
  if (talking) {
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

const BUBBLE_FONT = `27px ${CHALK_FONT}`;

function drawBubble(c) {
  const b = man.bubble;
  const p = man.pose;
  if (!p || b.alpha < 0.01 || !b.text) return;
  const f = man.facing;
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
  c.beginPath();
  c.moveTo(tx - 9, top + bh - 1);
  c.lineTo(p.head.x - f * 6, p.head.y - BODY.head - 6);
  c.lineTo(tx + 9, top + bh - 1);
  c.fill();
  c.beginPath();
  c.moveTo(tx - 9, top + bh);
  c.lineTo(p.head.x - f * 6, p.head.y - BODY.head - 6);
  c.lineTo(tx + 9, top + bh);
  c.stroke();
  c.fillStyle = '#222';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(b.text, cx, top + bh / 2 + 1);
  c.restore();
}
