// flightControls.js — keyboard + mouse flight controls. Arrow keys / WASD
// fly the stick, Q/E rudder, R/F throttle, X flaps, G gear, B brakes,
// T/Y trim, V stability assist, C camera, M music, H help, Enter retry.
import { KEYS } from './config.js';

export function createInput() {
  return {
    keys: new Set(),
    pitchUp: false, pitchDown: false, rollLeft: false, rollRight: false,
    rudderLeft: false, rudderRight: false,
    throttleUp: false, throttleDown: false, brakes: false,
    mouseX: 0, mouseY: 0, mouseActive: false,
    pressed: new Set(), // edge-triggered keys, consumed each frame
  };
}

function keyIn(code, list) { return list.includes(code); }

export function bindControls(input, handlers) {
  const update = () => {
    const k = input.keys;
    input.pitchUp = KEYS.pitchUp.some((c) => k.has(c));
    input.pitchDown = KEYS.pitchDown.some((c) => k.has(c));
    input.rollLeft = KEYS.rollLeft.some((c) => k.has(c));
    input.rollRight = KEYS.rollRight.some((c) => k.has(c));
    input.rudderLeft = KEYS.rudderLeft.some((c) => k.has(c));
    input.rudderRight = KEYS.rudderRight.some((c) => k.has(c));
    input.throttleUp = KEYS.throttleUp.some((c) => k.has(c));
    input.throttleDown = KEYS.throttleDown.some((c) => k.has(c));
    input.brakes = KEYS.brakes.some((c) => k.has(c));
  };
  window.addEventListener('keydown', (e) => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    if (!e.repeat) {
      input.pressed.add(e.code);
      if (keyIn(e.code, KEYS.flaps)) handlers.onFlaps();
      if (keyIn(e.code, KEYS.gear)) handlers.onGear();
      if (keyIn(e.code, KEYS.stability)) handlers.onStability();
      if (keyIn(e.code, KEYS.camera)) handlers.onCamera();
      if (keyIn(e.code, KEYS.music)) handlers.onMusic();
      if (keyIn(e.code, KEYS.retry)) handlers.onRetry();
      if (keyIn(e.code, KEYS.pause)) handlers.onPause();
      if (keyIn(e.code, KEYS.help)) handlers.onHelp();
      if (keyIn(e.code, KEYS.trimUp)) handlers.onTrim(1);
      if (keyIn(e.code, KEYS.trimDown)) handlers.onTrim(-1);
    }
    input.keys.add(e.code);
    update();
  });
  window.addEventListener('keyup', (e) => { input.keys.delete(e.code); update(); });
  window.addEventListener('blur', () => { input.keys.clear(); update(); });
  window.addEventListener('mousemove', (e) => {
    input.mouseX = (e.clientX / window.innerWidth) * 2 - 1;
    input.mouseY = (e.clientY / window.innerHeight) * 2 - 1;
  });
  window.addEventListener('mousedown', () => { input.mouseActive = true; });
  window.addEventListener('mouseup', () => { input.mouseActive = false; });
  update();
  return input;
}

export function describeControls() {
  return [
    ['ARROWS / WASD', 'Pitch + roll (stick)'],
    ['Q / E', 'Rudder'],
    ['R / F or SHIFT / CTRL', 'Throttle up / down'],
    ['X', 'Flaps 0 / 15 / 35 deg'],
    ['G', 'Landing gear up / down'],
    ['B', 'Brakes / water rudder (hold)'],
    ['T / Y', 'Pitch trim up / down'],
    ['V', 'Stability assist on / off'],
    ['C', 'Chase view / 3D cockpit'],
    ['M', 'Ambient music on / off'],
    ['P', 'Pause'],
    ['ENTER', 'Retry after crash / landing'],
  ];
}
