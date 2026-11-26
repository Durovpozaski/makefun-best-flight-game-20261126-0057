// ilsAndPapi.js — ILS localizer + 3.0 deg glideslope to Runway 09/27 and the
// live 4-light PAPI. Deviations in dots, the same numbers the HSI and the
// HUD diamonds show.
import { degToRad, clamp } from './config.js';

const RWY09 = { x: 0, z: 0, elevM: 28, headingDeg: 90, lengthM: 1800 };

export function computeIls(pos) {
  const hd = degToRad(RWY09.headingDeg);
  const thrX = RWY09.x - Math.sin(hd) * (RWY09.lengthM / 2);
  const thrZ = RWY09.z + Math.cos(hd) * (RWY09.lengthM / 2);
  const dx = pos.x - thrX, dz = pos.z - thrZ;
  const along = dx * Math.sin(hd) - dz * Math.cos(hd); // +ve past threshold
  const lateral = dx * Math.cos(hd) + dz * Math.sin(hd); // +ve right of centreline
  const dist = Math.max(Math.hypot(dx, dz), 1);
  const heightAboveThr = pos.y - RWY09.elevM;
  const gsAngle = Math.atan2(heightAboveThr, dist) * 180 / Math.PI;
  const gsDevDeg = gsAngle - 3.0;
  const locDevDeg = Math.atan2(lateral, dist) * 180 / Math.PI;
  return {
    alongM: along, distM: dist, lateralM: lateral,
    gsDevDots: clamp(gsDevDeg / 0.7, -2.5, 2.5), // 1 dot = 0.7 deg
    locDevDots: clamp(locDevDeg / 1.0, -2.5, 2.5),
    gsAngle, onApproach: along > -6000 && along < 2000 && Math.abs(lateral) < 1200,
    threshold: { x: thrX, z: thrZ },
  };
}

export function papiState(pos) {
  const ils = computeIls(pos);
  const a = ils.gsAngle;
  const whites = a > 3.35 ? 4 : a > 3.15 ? 3 : a > 2.85 ? 2 : a > 2.65 ? 1 : 0;
  return { whites, reds: 4 - whites, onGlide: whites === 2, angleDeg: a };
}

export function ilsAudioCue(ils, time) {
  // marker beeps: outer marker when crossing 4 NM on the localizer
  if (ils.onApproach && ils.distM > 7300 && ils.distM < 7600) return 'outer';
  return null;
}
