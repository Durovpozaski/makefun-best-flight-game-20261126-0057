// aerodynamics6dof.js — rigid-body 6-DOF flight model.
// Lift CL(alpha, flaps) with a real stall break and buffet, induced +
// parasitic + flap/gear drag, weathercock yaw stability, damping, ground
// effect, hydrodynamic water planing, crosswind crab, trim, flaps, gear.
import * as THREE from 'three';
import { FLIGHT, clamp, degToRad, msToKt, ktToMs } from './config.js';
import { terrainHeight, isWater } from './terrainAdriatic.js';
import { windVectorAt } from './atmosphereWeather.js';

export function createFlightState(spec, airfield, fuelGal) {
  const headingRad = degToRad(airfield.headingDeg);
  return {
    spec, airfield,
    pos: new THREE.Vector3(airfield.x - Math.sin(headingRad) * (airfield.lengthM / 2 - 80), airfield.elevM + 2.2, airfield.z + Math.cos(headingRad) * (airfield.lengthM / 2 - 80)),
    quat: new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI - headingRad, 0, 'YXZ')),
    vel: new THREE.Vector3(0, 0, 0),
    angVel: new THREE.Vector3(0, 0, 0), // pitch, yaw, roll rates rad/s
    throttle: 0, rpm: 0,
    flapStage: 0, flapDeg: 0, flapTarget: 0,
    gearDown: true, gearAnim: 1,
    brakes: false, trim: 0,
    stabilityAssist: true,
    onGround: true, onWater: false,
    airspeedKt: 0, alphaDeg: 0, vsiFpm: 0, headingDeg: airfield.headingDeg,
    pitchDeg: 0, rollDeg: 0,
    stall: false, buffet: 0,
    fuelGal, weightKg: spec.emptyKg + fuelGal * 3.03,
    crashed: false, crashReason: '',
    touchdown: null, airborne: false, timeS: 0,
  };
}

function liftCoefficient(alphaDeg, flapDeg) {
  const a = degToRad(alphaDeg);
  const clMax = 1.75 + flapDeg * 0.014;
  const alphaStall = 15 + flapDeg * 0.06;
  let cl;
  if (alphaDeg < alphaStall) {
    cl = Math.min(0.30 + 0.11 * alphaDeg + flapDeg * 0.012, clMax);
  } else {
    // post-stall break: lift collapses from clMax toward the flat-plate
    // value, drag soars
    const over = alphaDeg - alphaStall;
    cl = clMax * Math.exp(-over * 0.14) + 0.15;
  }
  return { cl, alphaStall };
}

export function stepFlight(S, input, weather, dt) {
  dt = Math.min(dt, FLIGHT.dtMax);
  if (dt <= 0 || S.crashed) return S;
  S.timeS += dt;
  const spec = S.spec;
  // --- controls ---
  const pitchIn = (input.pitchUp ? 1 : 0) - (input.pitchDown ? 1 : 0);
  const rollIn = (input.rollRight ? 1 : 0) - (input.rollLeft ? 1 : 0);
  const yawIn = (input.rudderRight ? 1 : 0) - (input.rudderLeft ? 1 : 0);
  if (input.throttleUp) S.throttle = clamp(S.throttle + dt * 0.45, 0, 1);
  if (input.throttleDown) S.throttle = clamp(S.throttle - dt * 0.45, 0, 1);
  S.brakes = !!input.brakes;
  // flap / gear targets (debounced by caller)
  S.flapTarget = FLIGHT.flapStagesDeg[S.flapStage];
  S.flapDeg += clamp(S.flapTarget - S.flapDeg, -dt * 14, dt * 14);
  S.gearAnim += clamp((S.gearDown ? 1 : 0) - S.gearAnim, -dt * 0.5, dt * 0.5);

  const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(S.quat);
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(S.quat);
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(S.quat);
  const wind = windVectorAt(weather, S.pos.y);
  const airVel = S.vel.clone().sub(wind);
  const speed = airVel.length();
  const airspeed = Math.max(airVel.dot(fwd), 0);
  S.airspeedKt = msToKt(Math.max(speed, 0.001));
  // angle of attack from air velocity vs body axis
  const velNorm = speed > 1 ? airVel.clone().divideScalar(speed) : fwd.clone();
  const alpha = -Math.asin(clamp(velNorm.dot(up), -1, 1)) * 180 / Math.PI;
  S.alphaDeg = clamp(alpha, -8, 30);
  const rho = FLIGHT.rhoSea * Math.exp(-S.pos.y / 8500);
  const { cl, alphaStall } = liftCoefficient(S.alphaDeg, S.flapDeg);
  const q = 0.5 * rho * speed * speed;
  const S_area = spec.wingAreaSqM;
  // drag: parasitic + induced + flap + gear
  const cd0 = 0.032 + (S.flapDeg / 35) * 0.05 + (S.gearAnim > 0.5 ? 0.018 : 0);
  const cd = cd0 + (cl * cl) / (Math.PI * 7.2 * 0.85);
  const lift = q * S_area * cl;
  const drag = q * S_area * cd;
  const stallSpeed = spec.stallFlapsKt + (35 - S.flapDeg) * 0.28;
  S.stall = S.airspeedKt < stallSpeed && !S.onGround && S.airspeedKt > 5;
  S.buffet = S.stall ? clamp((stallSpeed - S.airspeedKt) / 12, 0, 1) : 0;

  // --- forces (world frame) ---
  const force = new THREE.Vector3(0, -spec.maxKg * FLIGHT.gravity * (S.weightKg / spec.maxKg), 0);
  // lift along body up (only while there is airflow)
  if (speed > 2) force.addScaledVector(up, lift);
  // ground effect: +18% lift within one wingspan of the surface
  const groundH = terrainHeight(S.pos.x, S.pos.z);
  const agl = S.pos.y - Math.max(groundH, 0);
  if (agl < 12 && agl > 0 && speed > 10) force.addScaledVector(up, lift * 0.18 * (1 - agl / 12));
  // drag opposite air velocity
  if (speed > 0.5) force.addScaledVector(velNorm, -drag);
  // thrust
  const maxThrust = spec.engines * (spec.prop ? 6800 : 12500);
  const thrust = S.throttle * maxThrust * (spec.prop
    ? clamp(1 - Math.pow(speed / ktToMs(spec.maxSpeedKt), 2), 0, 1) // prop: ~80% at climb speed, zero at Vmax
    : clamp(1.15 - speed / ktToMs(spec.maxSpeedKt), 0.2, 1)); // jet: soft cap past Vmax
  force.addScaledVector(fwd, thrust);
  // brakes on ground
  if (S.onGround && S.brakes) {
    const brakeF = Math.min(speed * S.weightKg * 1.4, 9000);
    force.addScaledVector(velNorm, -brakeF);
  }
  // water planing drag + buoyancy
  const water = isWater(S.pos.x, S.pos.z);
  S.onWater = water && S.pos.y <= 1.2;
  if (S.onWater) {
    const planing = clamp(speed / 18, 0.2, 1);
    force.addScaledVector(velNorm, -speed * 260 * planing);
    force.y += (1.2 - S.pos.y) * S.weightKg * 6; // buoyancy
    if (S.gearDown && speed > 8) {
      S.crashed = true; S.crashReason = 'WATER LANDING WITH GEAR DOWN — hull flipped on touchdown';
    }
  }
  // --- integrate translation ---
  const accel = force.divideScalar(S.weightKg);
  S.vel.addScaledVector(accel, dt);
  // gentle stability: damp vertical speed oscillation near stall
  S.pos.addScaledVector(S.vel, dt);
  // --- rotation ---
  const rollAuthority = clamp(S.airspeedKt / 70, 0.25, 1);
  const pitchAuthority = clamp(S.airspeedKt / 60, 0.3, 1);
  // longitudinal stability: the elevator commands an angle of attack and
  // the nose settles there (a docile trainer, not a fighter). Holding full
  // up gives a ~11 deg climb attitude; it can never loop the aircraft.
  const pitchWashout = clamp(1 - Math.abs(S.pitchDeg) / 80, 0.3, 1);
  let alphaCmd = clamp(3 + pitchIn * (5 + S.flapDeg * 0.15) + S.trim * 2, -4, 14); // pitchIn: +1 up, -1 down; flaps buy flare alpha
  // stick-pusher: below stall speed + 12 kt the nose must come down, even
  // with the stick held back, or the wing stalls and the sortie ends.
  // The margin follows the flaps, so a landing flare at 70 kt with flaps
  // 15 (stall ~54 kt) is still allowed.
  const pusherKt = stallSpeed + 12;
  if (!S.onGround && S.airspeedKt < pusherKt) alphaCmd = Math.min(alphaCmd, 3 + (S.airspeedKt - pusherKt) * 0.25);
  // nose-up is a NEGATIVE X rate, so the restoring term is (alpha - cmd):
  // alpha below command pulls the nose up, alpha above it pushes it down
  let targetPitchRate = clamp((S.alphaDeg - alphaCmd) * 0.015, -0.22, 0.22) * pitchAuthority * pitchWashout;
  // on the runway the elevator is weak until rotation speed
  if (S.onGround && S.airspeedKt < 70) targetPitchRate *= 0.15;
  const targetRollRate = rollIn * 0.55 * rollAuthority; // roll right = bank right (+Z about the nose axis)
  const targetYawRate = -yawIn * 0.30 + (S.stabilityAssist ? -S.rollDeg * 0.002 : 0);
  // weathercock: yaw velocity tends to align nose with velocity; weak on
  // the ground, where the tyres hold the heading
  const beta = Math.asin(clamp(velNorm.dot(right), -1, 1));
  const weathercock = beta * 0.35 * clamp(speed / 30, 0, 1) * (S.onGround ? 0.15 : 1);
  S.angVel.x += (targetPitchRate - S.angVel.x) * Math.min(dt * 4, 1);
  S.angVel.y += (targetYawRate + weathercock - S.angVel.y) * Math.min(dt * 3, 1);
  S.angVel.z += (targetRollRate - S.angVel.z) * Math.min(dt * 4, 1);
  // stability assist: auto-level roll and damp pitch when hands off
  if (S.stabilityAssist && !S.onGround) {
    const e = new THREE.Euler().setFromQuaternion(S.quat, 'YXZ');
    if (rollIn === 0) S.angVel.z += (-e.z * 0.9 - S.angVel.z) * Math.min(dt * 1.6, 1);
    if (pitchIn === 0) S.angVel.x += (-e.x * 0.35 - S.angVel.x) * Math.min(dt * 1.2, 1);
  }
  // stall buffet: zero-mean sinusoidal shake, never a random walk
  if (S.buffet > 0) {
    S.angVel.x += Math.sin(S.timeS * 31) * S.buffet * 0.05;
    S.angVel.z += Math.cos(S.timeS * 27) * S.buffet * 0.07;
  }
  // on the ground the tyres hold the heading: kill stray yaw rate
  if (S.onGround) S.angVel.y *= Math.max(0, 1 - dt * 3);
  const dq = new THREE.Quaternion().setFromEuler(new THREE.Euler(
    S.angVel.x * dt, S.angVel.y * dt, S.angVel.z * dt, 'YXZ'));
  S.quat.multiply(dq).normalize();
  // --- ground / water contact ---
  const e2 = new THREE.Euler().setFromQuaternion(S.quat, 'YXZ');
  S.pitchDeg = e2.x * 180 / Math.PI;
  S.rollDeg = e2.z * 180 / Math.PI;
  S.headingDeg = ((Math.atan2(fwd.x, -fwd.z) * 180 / Math.PI) + 360) % 360;
  S.vsiFpm = S.vel.y * 196.85;
  const gearH = 2.0 * S.gearAnim + 0.9;
  if (!water && S.pos.y <= groundH + gearH) {
    const vsFpm = -S.vsiFpm;
    if (!S.onGround && S.airborne) {
      S.touchdown = {
        fpm: Math.round(vsFpm), kt: Math.round(S.airspeedKt),
        centerlineM: 0, crabDeg: Math.abs(wrapCrab(S)),
      };
      S.touchdownCrab = S.touchdown.crabDeg;
      if (vsFpm > FLIGHT.hardTouchdownFpm) {
        S.crashed = true; S.crashReason = `HARD TOUCHDOWN ${Math.round(vsFpm)} FPM — landing gear collapsed`;
      }
    }
    S.pos.y = groundH + gearH;
    if (S.vel.y < 0) S.vel.y = 0;
    S.onGround = true;
    if (S.airspeedKt > 12) {
      // rolling: keep heading, kill lateral drift
      const lat = right.clone().multiplyScalar(S.vel.dot(right));
      S.vel.addScaledVector(lat, -0.4);
    }
  } else if (water && S.pos.y <= 1.1 && !S.onWater) {
    S.pos.y = 1.1;
    if (!S.onGround && S.airborne && !S.touchdown) {
      S.touchdown = { fpm: Math.round(-S.vsiFpm), kt: Math.round(S.airspeedKt), centerlineM: 0, crabDeg: Math.abs(wrapCrab(S)) };
      S.touchdownCrab = S.touchdown.crabDeg;
    }
    if (S.vel.y < -2) S.vel.y *= -0.2;
  } else if (S.pos.y > groundH + gearH + 0.5) {
    if (S.onGround && S.airspeedKt > stallSpeed * 0.9) { S.onGround = false; S.airborne = true; }
    if (!S.onGround) S.onGround = false;
  }
  if (S.pos.y < -2 && water) { S.pos.y = -2; S.vel.y = 0; }
  // terrain crash (cliff / hill strike)
  if (!water && S.pos.y < groundH + 0.5 && S.airspeedKt > 30 && !S.onGround) {
    S.crashed = true; S.crashReason = 'CONTROLLED FLIGHT INTO TERRAIN — struck the limestone cliff';
  }
  // building strike: rooftops, cranes, terminal, church tower, lighthouse,
  // ATC tower. Only while airborne and fast; the RWY 09/27 final (z ~ 0)
  // never enters the city box (z max -500), so a normal approach stays safe.
  if (!S.crashed && !S.onGround && S.airspeedKt > 30) {
    const gy = terrainHeight(S.pos.x, S.pos.z);
    const inCity = S.pos.x > -2600 && S.pos.x < -500 && S.pos.z > -2600 && S.pos.z < -500;
    if (inCity && S.pos.y < gy + 24) {
      S.crashed = true; S.crashReason = 'STRUCK A BUILDING — clipped a rooftop over Porto Bellavista';
    }
    // cargo cranes, south of the runway (x = -900 + i*170, z = 950, 60 m tall)
    for (let i = 0; i < 4 && !S.crashed; i++) {
      const dx = S.pos.x - (-900 + i * 170), dz = S.pos.z - 950;
      if (dx * dx + dz * dz < 12 * 12 && S.pos.y < gy + 60) {
        S.crashed = true; S.crashReason = 'STRUCK A CRANE — hit a harbour crane at Porto Bellavista';
      }
    }
    // terminal glass block (-420, -260), 150 x 46 m, 20 m tall
    if (!S.crashed && Math.abs(S.pos.x + 420) < 78 && Math.abs(S.pos.z + 260) < 26 && S.pos.y < gy + 20) {
      S.crashed = true; S.crashReason = 'STRUCK A BUILDING — hit the Bellavista terminal';
    }
    // church bell tower (-1120, -300), 46 m tall
    if (!S.crashed) {
      const dx = S.pos.x + 1120, dz = S.pos.z + 300;
      if (dx * dx + dz * dz < 10 * 10 && S.pos.y < gy + 46) {
        S.crashed = true; S.crashReason = 'STRUCK A BUILDING — hit the church bell tower';
      }
    }
    // lighthouse (1180, -1500), 40 m tall
    if (!S.crashed) {
      const dx = S.pos.x - 1180, dz = S.pos.z + 1500;
      if (dx * dx + dz * dz < 14 * 14 && S.pos.y < gy + 40) {
        S.crashed = true; S.crashReason = 'STRUCK THE LIGHTHOUSE — hit the Faro beacon tower';
      }
    }
    // ATC tower (-120, -120), 50 m tall, beside the runway
    if (!S.crashed) {
      const dx = S.pos.x + 120, dz = S.pos.z + 120;
      if (dx * dx + dz * dz < 10 * 10 && S.pos.y < gy + 50) {
        S.crashed = true; S.crashReason = 'STRUCK A BUILDING — hit the ATC tower';
      }
    }
  }
  if (Number.isNaN(S.pos.x) || !Number.isFinite(S.pos.x)) {
    S.pos.set(0, 200, 0); S.vel.set(0, 0, 0);
  }
  return S;
}

function wrapCrab(S) {
  const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(S.quat);
  const v = S.vel.clone(); v.y = 0;
  if (v.length() < 2) return 0;
  const hdgVel = Math.atan2(v.x, v.z);
  const hdgNose = Math.atan2(fwd.x, fwd.z);
  let d = (hdgVel - hdgNose) * 180 / Math.PI;
  return ((d + 180) % 360 + 360) % 360 - 180;
}

export function centerlineOffsetM(S) {
  const f = S.airfield;
  const hd = degToRad(f.headingDeg);
  const dx = S.pos.x - f.x, dz = S.pos.z - f.z;
  // perpendicular distance from runway centreline
  return Math.abs(-Math.sin(hd) * dx + Math.cos(hd) * dz);
}
