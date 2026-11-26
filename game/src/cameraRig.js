// cameraRig.js — spring-damped chase camera that never fights the pilot,
// plus the in-cockpit camera. C toggles between them.
// Anti-clip: the chase and crash-orbit cameras are clamped to stay above
// the terrain (terrainHeight + 2.5 m), so a low pass over a ridge never
// pushes the lens inside the hillside. rig.shake (set by a crash) adds a
// decaying random jolt; main.js decays it.
import * as THREE from 'three';
import { clamp, lerp } from './config.js';
import { terrainHeight } from './terrainAdriatic.js';

export function createCameraRig(camera) {
  return {
    camera, mode: 'chase', // 'chase' | 'cockpit'
    chasePos: new THREE.Vector3(0, 60, -60),
    chaseLook: new THREE.Vector3(0, 30, 0),
    shake: 0,
  };
}

function shakeOffset(rig) {
  if (!rig.shake || rig.shake <= 0) return null;
  const s = rig.shake;
  return {
    x: (Math.random() - 0.5) * s * 1.8,
    y: (Math.random() - 0.5) * s * 1.3,
    z: (Math.random() - 0.5) * s * 1.8,
  };
}

function terrainFloor(x, z) {
  return terrainHeight(x, z) + 2.5;
}

export function updateCamera(rig, S, aircraft, dt) {
  const cam = rig.camera;
  const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(S.quat);
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(S.quat);
  if (rig.mode === 'cockpit') {
    const eye = S.pos.clone().addScaledVector(fwd, 0.3).addScaledVector(up, 0.7);
    cam.position.copy(eye);
    const look = S.pos.clone().addScaledVector(fwd, 60).addScaledVector(up, -6);
    cam.lookAt(look);
    cam.up.copy(up);
    const sh = shakeOffset(rig);
    if (sh) { cam.position.x += sh.x; cam.position.y += sh.y; cam.position.z += sh.z; }
    return;
  }
  // chase: spring-damped follow behind and above the tail
  const dist = 16 + S.airspeedKt * 0.02;
  const target = S.pos.clone().addScaledVector(fwd, -dist).addScaledVector(up, 4.2 + S.airspeedKt * 0.004);
  target.y = Math.max(target.y, 4);
  const k = 1 - Math.exp(-dt * 4.5);
  rig.chasePos.lerp(target, k);
  // anti-clip: never let the lens sink into the terrain
  const floorY = terrainFloor(rig.chasePos.x, rig.chasePos.z);
  if (rig.chasePos.y < floorY) rig.chasePos.y = floorY;
  const lookTarget = S.pos.clone().addScaledVector(fwd, 22);
  rig.chaseLook.lerp(lookTarget, 1 - Math.exp(-dt * 6));
  // stall buffet shake
  if (S.buffet > 0) {
    rig.chasePos.x += (Math.random() - 0.5) * S.buffet * 0.5;
    rig.chasePos.y += (Math.random() - 0.5) * S.buffet * 0.4;
  }
  cam.position.copy(rig.chasePos);
  const sh = shakeOffset(rig);
  if (sh) { cam.position.x += sh.x; cam.position.y += sh.y; cam.position.z += sh.z; }
  cam.lookAt(rig.chaseLook);
  cam.up.set(0, 1, 0);
}

export function orbitCrashCamera(rig, S, time, dt) {
  const cam = rig.camera;
  const r = 26;
  const a = time * 0.35;
  const px = S.pos.x + Math.cos(a) * r;
  const pz = S.pos.z + Math.sin(a) * r;
  let py = S.pos.y + 9 + Math.sin(time * 0.2) * 2;
  // anti-clip: keep the orbit above the ground (or the sea, floor -3.5 m)
  const floorY = terrainFloor(px, pz);
  if (py < floorY) py = floorY;
  cam.position.set(px, py, pz);
  const sh = shakeOffset(rig);
  if (sh) { cam.position.x += sh.x; cam.position.y += sh.y; cam.position.z += sh.z; }
  cam.lookAt(S.pos.x, S.pos.y + 1, S.pos.z);
  cam.up.set(0, 1, 0);
}
