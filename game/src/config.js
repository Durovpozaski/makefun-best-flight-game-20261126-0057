// config.js — every tunable constant for MISTRAL WINGS, in one place.
// World: 12 km x 12 km of golden-hour Adriatic coast. Units: metres, knots,
// feet, gallons. Nothing here touches the network or the DOM.
export const WORLD = {
  size: 12000,
  half: 6000,
  seaLevel: 0,
  sunAzimuthDeg: 262,
  sunElevationDeg: 14,
  baroHpa: 1014,
};

export const WIND = {
  directionDeg: 120, // wind FROM 120 deg
  speedKt: 12,
  gustKt: 4,
};

export const AIRCRAFT_SPECS = {
  albatro: {
    id: 'albatro', name: 'MC-18 "ALBATRO"', reg: 'I-MIST', kind: 'amphibian',
    engines: 2, maxSpeedKt: 165, cruiseKt: 120, stallKt: 58, stallFlapsKt: 48,
    wingAreaSqM: 24.5, emptyKg: 2450, maxKg: 3600, fuelGal: 110,
    climbFpm: 1100, amphibious: true, prop: true,
  },
  libeccio: {
    id: 'libeccio', name: 'SR-4 "LIBECCIO"', reg: 'I-LIBE', kind: 'touring',
    engines: 1, maxSpeedKt: 205, cruiseKt: 150, stallKt: 62, stallFlapsKt: 52,
    wingAreaSqM: 15.2, emptyKg: 980, maxKg: 1450, fuelGal: 62,
    climbFpm: 1400, amphibious: false, prop: true,
  },
  sirocco: {
    id: 'sirocco', name: 'LJ-22 "SIROCCO"', reg: 'I-SIRO', kind: 'patrol jet',
    engines: 2, maxSpeedKt: 320, cruiseKt: 240, stallKt: 88, stallFlapsKt: 76,
    wingAreaSqM: 21.0, emptyKg: 3100, maxKg: 5200, fuelGal: 240,
    climbFpm: 2800, amphibious: false, prop: false,
  },
};

// Five airfields. headingDeg is the runway heading the pilot flies.
export const AIRFIELDS = [
  { id: 'bellavista', name: 'Porto Bellavista Intl', rwy: '09/27', headingDeg: 90,
    x: 0, z: 0, elevM: 28, lengthM: 1800, widthM: 45, surface: 'asphalt', ils: true, papi: true },
  { id: 'bianca', name: 'Isola Bianca Cliffside', rwy: '14', headingDeg: 140,
    x: 3500, z: -2500, elevM: 62, lengthM: 700, widthM: 30, surface: 'asphalt', ils: false, papi: true },
  { id: 'marina', name: 'Cala Marina Seaplane Basin', rwy: '32W', headingDeg: 320,
    x: 2500, z: 2800, elevM: 0, lengthM: 1200, widthM: 90, surface: 'water', ils: false, papi: false },
  { id: 'corvo', name: 'Monte Corvo Ridge Strip', rwy: '21', headingDeg: 210,
    x: -4200, z: -3800, elevM: 620, lengthM: 800, widthM: 28, surface: 'gravel', ils: false, papi: false },
  { id: 'faro', name: 'Faro Offshore Station', rwy: '—', headingDeg: 0,
    x: 5200, z: 3500, elevM: 12, lengthM: 0, widthM: 0, surface: 'platform', ils: false, papi: false },
];

export const FLIGHT = {
  gravity: 9.81,
  rhoSea: 1.225,
  dtMax: 0.05,
  flapStagesDeg: [0, 15, 35],
  flapLimitKt: [999, 140, 110],
  gearLimitKt: 150,
  hardTouchdownFpm: 500,
  crosswindMistralKt: 24,
};

export const KEYS = {
  pitchUp: ['ArrowDown', 'KeyS'],
  pitchDown: ['ArrowUp', 'KeyW'],
  rollLeft: ['ArrowLeft', 'KeyA'],
  rollRight: ['ArrowRight', 'KeyD'],
  rudderLeft: ['KeyQ'],
  rudderRight: ['KeyE'],
  throttleUp: ['KeyR', 'ShiftLeft', 'ShiftRight'],
  throttleDown: ['KeyF', 'ControlLeft', 'ControlRight'],
  trimUp: ['KeyT'],
  trimDown: ['KeyY'],
  flaps: ['KeyX'],
  gear: ['KeyG'],
  brakes: ['KeyB'],
  stability: ['KeyV'],
  camera: ['KeyC'],
  music: ['KeyM'],
  retry: ['Enter'],
  pause: ['KeyP'],
  help: ['KeyH'],
};

export function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function degToRad(d) { return d * Math.PI / 180; }
export function radToDeg(r) { return r * 180 / Math.PI; }
export function wrapAngleDeg(d) { let x = ((d + 180) % 360 + 360) % 360 - 180; return x; }
export function ktToMs(kt) { return kt * 0.514444; }
export function msToKt(ms) { return ms / 0.514444; }
export function mToFt(m) { return m * 3.28084; }
export function ftToM(ft) { return ft / 3.28084; }
