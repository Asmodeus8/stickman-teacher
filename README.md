# Stickman Teacher

A stickman stands in front of a blackboard and teaches with the numbers on it. He points at them, circles, underlines, ticks and crosses them out, compares and adds them, finds the biggest and smallest, sorts the board, and writes new numbers in chalk. He reads his lines aloud while he works.

Built with **TypeScript + HTML Canvas 2D**. No game engine or drawing library is used: every frame is drawn by hand.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests (Vitest)
npm run build      # type-check + production build into dist/
```

## Using it

- **Click numbers** on the board to select them. Click again to deselect, and click empty board to clear. Selection order matters for *Compare*.
- **Selected numbers:** Point, Circle, Underline, Tick, Cross out, Compare (2), Add these (2+). Actions run on every selected number in turn.
- **Whole board:** Read all, Add up, Biggest, Smallest, Evens, Sort.
- **Class:** Clean, New numbers, Play lesson (a scripted demo of everything), Wave.
- **Write a number:** type 0–999 and he writes it into a free spot.
- Chalk colour, speed (0.5×–2.5×), sound/voice toggle.
- Clicks made while he's busy are **queued**. **Stop** (Esc) cancels mid-animation, and **Undo** (Ctrl+Z) restores the board.
- Every action has a keyboard shortcut, shown on its button.

## How it works

```
src/
  core/      animator.ts  promise-based tweens + cancellation
             queue.ts     one-at-a-time action queue
             layers.ts    offscreen canvases, HiDPI
             math.ts
  scene/     layout.ts    pure geometry: slots, hit-testing, where to stand
             board.ts     room painting, the three board layers, snapshots
             chalk.ts     chalk strokes, chalk texture, text reveal, eraser
  actor/     ik.ts        two-bone inverse kinematics
             stickman.ts  pose model, per-frame update, drawing
  actions/   teacher.ts   movement vocabulary: walk, reach, tap, draw, write, speak
             catalog.ts   every button as one data entry
  audio/     sfx.ts       Web Audio synthesis (chalk scratch, steps, taps)
             voice.ts     Web Speech API
  ui/        controls.ts  DOM wiring, selection, shortcuts, undo
```

**Rendering.** The scene is a fixed 1280×720 world scaled to the screen at device pixel ratio. It is split into layers:
- the room, painted once
- the numbers ("ink")
- the stickman's marks

So *Clean* can wipe the marks and leave the numbers, and Undo is just a copy of two canvases. The stickman and the speech bubble are redrawn every frame on top.

**Animation as async scripts.** `anim.tween(ms, t => …)` returns a promise, so an action reads like stage directions:

```ts
await t.approach(n);                    // walk over, turn, look at it
await t.chalkPath(p => ellipse(n, p));  // trace a circle with the pen down
await t.say(`Circled ${n.value}`);
```

**The stickman is data.** His state is a few numbers: x, facing, walk phase, where the pointer tip should be, and a gesture blend. `computePose()` rebuilds the skeleton from them every frame. Actions never draw. They only tween those numbers.

**Inverse kinematics.** Actions say where the *tip of the pointer* should go. The hand is placed one stick-length back toward a comfortable grip point, then a two-bone IK solver (law of cosines) finds the elbow. That one rule handles far reaches (arm stretched) and close ones (stick held low, pointing up).

**Chalk.** The chalk effects are:
- **Strokes:** two jittered passes, then tiny holes punched out with `destination-out`.
- **Writing:** text is rendered once to a hidden canvas and revealed slice by slice just behind the moving hand.
- **Erasing:** `destination-out` strokes at 85% strength, which leaves a faint realistic smudge until the final clear.

**Cancellation.** `Animator.cancelAll()` rejects every in-flight tween with `Cancelled`, and keeps rejecting new ones until the queue has unwound. The current action's `await` chain unwinds naturally. The queue then runs `recover()`, which lifts the pen, resets gestures and returns the arm to rest.

**Sound.** Nothing is pre-recorded:
- **Chalk scratch:** band-passed noise whose volume follows the chalk's speed.
- **Eraser:** low-passed noise.
- **Footsteps:** pitched-down sine blips fired on each step of the walk cycle.
- **Speech:** spoken lines use the browser's Speech Synthesis.

## Tests

`tests/` covers the logic that doesn't need a browser:
- the IK solver: reaches targets, keeps bone lengths, clamps out-of-reach targets, bends to either side
- the animator: progress, speed, cancellation unwinding an async script
- the queue: ordering, stop/recover, surviving errors
- the board layout: unique values and slots, hit-testing, reading order, never walking off-screen
