// main.js — MISTRAL WINGS bootstrap: builds the Adriatic world, runs the
// 6-DOF loop, owns the menu -> fly -> debrief state machine and the
// deterministic ?shot= hooks the screenshots are taken from.
import * as THREE from 'three';
import { WORLD, AIRCRAFT_SPECS, FLIGHT, clamp, degToRad, ktToMs } from './config.js';
import * as Textures from './proceduralTextures.js';
import { buildTerrain, terrainHeight, isWater } from './terrainAdriatic.js';
import { buildWater } from './waterShader.js';
import { createWeather, buildSky, buildClouds, buildRain, buildLightning, windVectorAt } from './atmosphereWeather.js';
import { buildCity, buildLighthouse } from './harborAndCity.js';
import { buildAirfields, buildSeaplaneBasin } from './airfieldsAndSeaplane.js';
import { buildTraffic, buildShips } from './trafficAndShips.js';
import { buildAircraft } from './aircraftGeometry.js';
import { buildCockpit } from './cockpit3dAvionics.js';
import { createFlightState, stepFlight, centerlineOffsetM } from './aerodynamics6dof.js';
import { createFuelSystem, stepFuel } from './propulsionFuel.js';
import { createDamage, stepDamage } from './airframeDamage.js';
import { computeIls, papiState, ilsAudioCue } from './ilsAndPapi.js';
import { createInput, bindControls, describeControls } from './flightControls.js';
import { createCameraRig, updateCamera, orbitCrashCamera } from './cameraRig.js';
import { buildHud } from './hudInstruments.js';
import { SORTIES, getSortie, getAirfield, checkSortieObjective } from './missionSorties.js';
import { gradeLanding, showDebrief, showIncident, hideDebrief } from './landingDebrief.js';
import { createAudio } from './audioEngine.js';

const params = new URLSearchParams(location.search);
const shot = params.get('shot');
const statusEl = document.getElementById('status');

const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('game'), antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.5, 24000);
camera.position.set(-40, 60, -40);

const textures = {
  asphalt: Textures.makeAsphaltTextures(),
  cliff: Textures.makeCliffTextures(),
  roof: Textures.makeRoofTextures(),
  wall: Textures.makeWallTextures(),
  aluminium: Textures.makeAluminiumTextures(),
  dashboard: Textures.makeDashboardTextures(),
  ground: Textures.makeGroundTextures(),
};

const weather = createWeather();
const skyLights = buildSky(scene, renderer);
buildTerrain(scene, textures);
const water = buildWater(scene);
const clouds = buildClouds(scene);
const rain = buildRain(scene);
const lightning = buildLightning(scene);
buildCity(scene, textures);
const lighthouse = buildLighthouse(scene);
const airfields = buildAirfields(scene, textures);
const basin = buildSeaplaneBasin(scene);
const traffic = buildTraffic(scene);
const ships = buildShips(scene);

const rig = createCameraRig(camera);
const input = createInput();
const audio = createAudio();
const hud = buildHud();

let aircraft = null;      // {group, props, ...} visual
let aircraftType = 'albatro';
let S = null;             // flight state
let F = null;             // fuel system
let D = null;             // damage
let cockpit = null;
let sortie = SORTIES[0];
let mode = 'menu';        // menu | fly | debrief | crash
let paused = false;
let hangarMode = false;
let debriefShown = false;
let crashSmoke = null;
let crashFire = null;
let crashDebris = null;
let flashLevel = 0;
let frameCount = 0;
let lastStallHorn = 0;
let elapsed = 0;
// diagnostics handle for headless verification (frame counter, audio state,
// live weather/airfields). Harmless in the shipped game.
window.__mistral = { audio, weather, airfields, lightning, get S() { return S; } };

function quatFromHdgPitchRoll(hdgDeg, pitchDeg, rollDeg) {
  return new THREE.Quaternion().setFromEuler(new THREE.Euler(
    -degToRad(pitchDeg), Math.PI - degToRad(hdgDeg), degToRad(rollDeg), 'YXZ'));
}

function spawnAircraft(type) {
  if (aircraft) scene.remove(aircraft.group);
  aircraft = buildAircraft(type, textures);
  scene.add(aircraft.group);
  if (cockpit) { scene.remove(cockpit.group); }
  cockpit = buildCockpit(scene, textures);
  cockpit.group.position.copy(S.pos);
  cockpit.group.quaternion.copy(S.quat);
  return aircraft;
}

function resetFlight(sortieId, type, fuelGal, startOverride) {
  sortie = getSortie(sortieId);
  aircraftType = type;
  const spec = AIRCRAFT_SPECS[type];
  const field = getAirfield(sortie.airfield);
  S = createFlightState(spec, field, fuelGal !== undefined ? fuelGal : sortie.fuelGal);
  S.stormActive = !!sortie.storm;
  if (startOverride) {
    S.pos.copy(startOverride.pos);
    S.quat.copy(quatFromHdgPitchRoll(startOverride.hdg, startOverride.pitch || 0, startOverride.roll || 0));
    const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(S.quat);
    const kt = startOverride.kt || 0;
    S.vel.copy(fwd).multiplyScalar(ktToMs(kt));
    S.vel.y = (startOverride.vsiFpm || 0) / 196.85;
    S.throttle = startOverride.throttle !== undefined ? startOverride.throttle : 0.6;
    S.flapStage = startOverride.flapStage !== undefined ? startOverride.flapStage : 1;
    S.gearDown = startOverride.gearDown !== undefined ? startOverride.gearDown : true;
    S.onGround = false; S.airborne = true;
    S.headingDeg = startOverride.hdg;
  }
  F = createFuelSystem(spec, S.fuelGal);
  D = createDamage();
  weather.windKt = sortie.windKt;
  weather.windDirDeg = 120;
  weather.storm = !!sortie.storm;
  weather.rain = !!sortie.storm;
  weather.stormIntensity = sortie.storm ? 0.85 : 0;
  if (sortie.fog) scene.fog.near = 900; else scene.fog.near = 3500;
  if (sortie.id === 6) { F.chtC = [238, 251]; F.fuelGal = 26; S.fuelGal = 26; }
  spawnAircraft(type);
  debriefShown = false;
  hideDebrief();
  if (crashSmoke) { scene.remove(crashSmoke); crashSmoke = null; }
  if (crashFire) { scene.remove(crashFire); crashFire = null; }
  if (crashDebris) { scene.remove(crashDebris.points); crashDebris = null; }
  flashLevel = 0;
  const flashEl0 = document.getElementById('flash');
  if (flashEl0) flashEl0.style.opacity = '0';
  rig.shake = 0;
  const fwd0 = new THREE.Vector3(0, 0, 1).applyQuaternion(S.quat);
  const up0 = new THREE.Vector3(0, 1, 0).applyQuaternion(S.quat);
  rig.chasePos.copy(S.pos).addScaledVector(fwd0, -17).addScaledVector(up0, 4.4);
  rig.chaseLook.copy(S.pos).addScaledVector(fwd0, 22);
  mode = 'fly';
  document.getElementById('menu').style.display = 'none';
  document.getElementById('hangar').style.display = 'none';
  hud.setVisible(true);
  audio.ensure();
}

function applyShot(name) {
  if (name === 'cover') {
    resetFlight(1, 'albatro', 82, {
      pos: new THREE.Vector3(-1900, 80, 10), hdg: 91, pitch: -2, roll: 0,
      kt: 112, vsiFpm: -320, throttle: 0.55, flapStage: 1, gearDown: true,
    });
    rig.mode = 'chase';
  } else if (name === 'cockpit') {
    resetFlight(5, 'albatro', 70, {
      pos: new THREE.Vector3(-2400, 107, 8), hdg: 90, pitch: -3, roll: 0,
      kt: 105, vsiFpm: -480, throttle: 0.5, flapStage: 1, gearDown: true,
    });
    rig.mode = 'cockpit';
  } else if (name === 'storm') {
    resetFlight(6, 'albatro', 7, {
      pos: new THREE.Vector3(3100, 480, 1600), hdg: 295, pitch: -1, roll: -6,
      kt: 118, vsiFpm: -120, throttle: 0.92, flapStage: 0, gearDown: false,
    });
    weather.windKt = 24; weather.windDirDeg = 300;
    F.chtC = [226, 252]; F.fuelGal = 7; S.fuelGal = 7;
    rig.mode = 'chase';
  } else if (name === 'hangar') {
    showMenu(true);
    const menuEl = document.getElementById('menu');
    menuEl.style.background = 'linear-gradient(90deg, rgba(10,14,22,0.92) 0%, rgba(10,14,22,0.45) 40%, rgba(10,14,22,0.05) 62%, rgba(10,14,22,0) 100%)';
    const panelEl = menuEl.querySelector('.panel');
    panelEl.style.maxWidth = '480px';
    panelEl.style.margin = '4vh 0 0 3vw';
    document.getElementById('hangar').style.width = '380px';
    return;
  } else {
    showMenu(false);
  }
}

function showMenu(hangar) {
  mode = 'menu';
  hangarMode = !!hangar;
  hud.setVisible(false);
  const menu = document.getElementById('menu');
  menu.style.display = 'block';
  document.getElementById('hangar').style.display = hangarMode ? 'block' : 'none';
  // parked hero aircraft on the apron in front of the hangar
  if (!S) {
    const spec = AIRCRAFT_SPECS.albatro;
    const field = getAirfield('bellavista');
    S = createFlightState(spec, field, 110);
    S.pos.set(-420, terrainHeight(-420, 130) + 2.6, 130);
    S.quat.copy(quatFromHdgPitchRoll(35, 0, 0));
    spawnAircraft('albatro');
  }
  aircraft.group.position.copy(S.pos);
  aircraft.group.quaternion.copy(S.quat);
  camera.position.set(-470, 48, 60);
  camera.lookAt(-420, 32, 130);
}

function startFromMenu() {
  const type = document.getElementById('sel-aircraft').value;
  const sortieId = Number(document.getElementById('sel-sortie').value);
  const fuel = Number(document.getElementById('fuel-slider').value);
  audio.ensure();
  resetFlight(sortieId, type, fuel);
}

function triggerCrash(reason) {
  if (mode === 'crash') return;
  mode = 'crash';
  S.crashed = true; S.crashReason = reason;
  rig.shake = 1;
  // screen flash: full-screen warm flash, faded out by the frame loop
  flashLevel = 1;
  const flashEl = document.getElementById('flash');
  if (flashEl) flashEl.style.opacity = '0.85';
  // fireball: orange point light that flares, then dies over ~2 s
  crashFire = new THREE.PointLight(0xff7711, 260, 500, 1.6);
  crashFire.position.copy(S.pos);
  scene.add(crashFire);
  // debris: fragments with random outward velocity + gravity, updated every
  // frame in crash mode; orange/grey/red mix
  const n = 170;
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  const vel = new Float32Array(n * 3);
  const cA = new THREE.Color(0xffa040), cB = new THREE.Color(0x3a3a38), cC = new THREE.Color(0xff5518);
  for (let i = 0; i < n; i++) {
    pos[i * 3] = S.pos.x; pos[i * 3 + 1] = S.pos.y; pos[i * 3 + 2] = S.pos.z;
    const th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
    const sp = 6 + Math.random() * 26;
    vel[i * 3] = Math.sin(ph) * Math.cos(th) * sp;
    vel[i * 3 + 1] = Math.abs(Math.cos(ph)) * sp * 0.9 + 4;
    vel[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * sp;
    const c = Math.random() < 0.45 ? cA : (Math.random() < 0.5 ? cB : cC);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  crashDebris = {
    points: new THREE.Points(geo, new THREE.PointsMaterial({ size: 2.4, vertexColors: true, transparent: true, opacity: 0.95 })),
    vel, life: 5,
  };
  scene.add(crashDebris.points);
  // smoke: slow-rising grey puff over the wreck
  const sgeo = new THREE.BufferGeometry();
  const n2 = 260;
  const spos = new Float32Array(n2 * 3);
  for (let i = 0; i < n2; i++) {
    spos[i * 3] = S.pos.x + (Math.random() - 0.5) * 14;
    spos[i * 3 + 1] = S.pos.y + Math.random() * 10;
    spos[i * 3 + 2] = S.pos.z + (Math.random() - 0.5) * 14;
  }
  sgeo.setAttribute('position', new THREE.BufferAttribute(spos, 3));
  crashSmoke = new THREE.Points(sgeo, new THREE.PointsMaterial({ color: 0x555550, size: 3.2, transparent: true, opacity: 0.85 }));
  scene.add(crashSmoke);
  aircraft.group.visible = false;
  showIncident(S, reason);
  // water impact splashes; a land/building impact thuds
  if (isWater(S.pos.x, S.pos.z)) audio.splash(); else audio.crashThud();
}

function updateAircraftVisual(dt, time) {
  if (!aircraft || !S) return;
  aircraft.group.position.copy(S.pos);
  aircraft.group.quaternion.copy(S.quat);
  const rpm = (F.rpm[0] || 0) / 2500;
  for (const p of aircraft.props) {
    p.rotation.z += dt * (4 + rpm * 90);
    p.children.forEach((c) => { if (c.material && c.material.transparent) c.material.opacity = 0.06 + rpm * 0.10; });
  }
  if (aircraft.exhaust) aircraft.exhaust.material.opacity = 0.25 + S.throttle * 0.55;
  // control surfaces follow the stick
  const rollIn = (input.rollRight ? 1 : 0) - (input.rollLeft ? 1 : 0);
  const pitchIn = (input.pitchUp ? 1 : 0) - (input.pitchDown ? 1 : 0);
  const yawIn = (input.rudderRight ? 1 : 0) - (input.rudderLeft ? 1 : 0);
  aircraft.aileronL.rotation.x = rollIn * 0.4;
  aircraft.aileronR.rotation.x = -rollIn * 0.4;
  aircraft.elevator.rotation.x = pitchIn * 0.35;
  aircraft.rudder.rotation.y = yawIn * 0.4;
  const flapTarget = (S.flapDeg / 35) * 0.5;
  aircraft.flapL.rotation.x = flapTarget;
  aircraft.flapR.rotation.x = flapTarget;
  aircraft.gear.visible = S.gearAnim > 0.05;
  aircraft.gear.position.y = -(1 - S.gearAnim) * 1.6;
  // nav + strobe lights
  const strobeOn = (time % 1.4) < 0.12;
  aircraft.lights.strobe.material.color.setHex(strobeOn ? 0xffffff : 0x333333);
  aircraft.lights.landing.material.color.setHex(S.gearDown ? 0xffe6a0 : 0x554422);
  // cockpit follows the aircraft when in cockpit view
  if (cockpit) {
    cockpit.group.position.copy(S.pos);
    cockpit.group.quaternion.copy(S.quat);
    cockpit.setVisible(rig.mode === 'cockpit');
  }
}

function frame(timeMs) {
  requestAnimationFrame(frame);
  const dt = Math.min((timeMs - (frame.last || timeMs)) / 1000, FLIGHT.dtMax);
  frame.last = timeMs;
  elapsed += dt;
  const time = elapsed;
  frameCount++;
  window.__mistral.frames = frameCount;
  if (paused) { renderer.render(scene, camera); return; }
  water.update(dt, time);
  clouds.update(dt, time, weather);
  rain.update(dt, S ? S.pos : new THREE.Vector3(0, 100, 0), weather);
  lightning.update(dt, time, weather, S ? S.pos : null, () => audio.thunder());
  if (flashLevel > 0) {
    flashLevel = Math.max(0, flashLevel - dt * 1.4);
    const flashEl = document.getElementById('flash');
    if (flashEl) flashEl.style.opacity = String(flashLevel * 0.85);
  }
  traffic.update(dt, time);
  ships.update(dt, time);
  lighthouse.update(time);
  basin.update(dt, time);
  airfields.updateApproach(time);
  if (S) {
    airfields.updatePapi(S.pos);
    airfields.updateWindsock(weather.windDirDeg, weather.windKt);
  }
  if (mode === 'fly' && S) {
    stepFlight(S, input, weather, dt);
    stepFuel(F, S, dt, weather);
    stepDamage(D, S, F, dt);
    const ils = computeIls(S.pos);
    if (S.crashed) { triggerCrash(S.crashReason || 'AIRCRAFT LOST'); }
    // landing complete: slow on the surface after a recorded touchdown
    if (!debriefShown && S.touchdown && S.onGround && S.airspeedKt < 18) {
      debriefShown = true;
      S.touchdownCrab = S.touchdown.crabDeg || 0;
      const obj = checkSortieObjective(S, sortie);
      showDebrief(S, D, sortie);
      if (obj) statusEl.textContent = 'Sortie objective complete: ' + obj.field;
      audio.tyreSqueal();
      mode = 'debrief';
    }
    // water landing complete
    if (!debriefShown && S.onWater && !S.gearDown && S.airspeedKt < 12 && S.airborne) {
      debriefShown = true;
      S.touchdown = { fpm: Math.round(-S.vsiFpm), kt: Math.round(S.airspeedKt), crabDeg: 0 };
      S.touchdownCrab = 0;
      showDebrief(S, D, sortie);
      audio.splash();
      mode = 'debrief';
    }
    if (S.stall && time - lastStallHorn > 1.2) { lastStallHorn = time; audio.stallHorn(true); }
    const cue = ilsAudioCue(ils, time);
    if (cue) audio.markerBeep(cue);
    audio.update(S, F, weather);
    updateAircraftVisual(dt, time);
    updateCamera(rig, S, aircraft, dt);
    if (cockpit && rig.mode === 'cockpit') cockpit.update(S, F, ils, dt, time);
    hud.update(S, F, D, ils, sortie, weather);
  } else if (mode === 'crash' && S) {
    orbitCrashCamera(rig, S, time, dt);
    if (crashSmoke) { crashSmoke.rotation.y += dt * 0.2; crashSmoke.position.y += dt * 1.2; }
    if (crashFire) {
      crashFire.intensity *= Math.exp(-dt * 1.6);
      if (crashFire.intensity < 1) { scene.remove(crashFire); crashFire = null; }
    }
    if (crashDebris) {
      const arr = crashDebris.points.geometry.attributes.position.array;
      const v = crashDebris.vel;
      for (let i = 0; i < v.length / 3; i++) {
        v[i * 3 + 1] -= 12 * dt;
        arr[i * 3] += v[i * 3] * dt;
        arr[i * 3 + 1] += v[i * 3 + 1] * dt;
        arr[i * 3 + 2] += v[i * 3 + 2] * dt;
        const gy = Math.max(terrainHeight(arr[i * 3], arr[i * 3 + 2]), 0.3);
        if (arr[i * 3 + 1] < gy + 0.4) {
          arr[i * 3 + 1] = gy + 0.4;
          v[i * 3 + 1] = Math.abs(v[i * 3 + 1]) * 0.25;
          v[i * 3] *= 0.6; v[i * 3 + 2] *= 0.6;
        }
      }
      crashDebris.points.geometry.attributes.position.needsUpdate = true;
      crashDebris.life -= dt;
      crashDebris.points.material.opacity = Math.max(0, Math.min(0.95, crashDebris.life / 2));
      if (crashDebris.life <= 0) { scene.remove(crashDebris.points); crashDebris = null; }
    }
    rig.shake = Math.max(0, rig.shake - dt * 0.5);
    updateAircraftVisual(0, time);
  } else if (mode === 'debrief' && S) {
    updateCamera(rig, S, aircraft, dt);
    updateAircraftVisual(dt, time);
  } else if (mode === 'menu') {
    const t = time * 0.05;
    if (hangarMode) {
      camera.position.set(-434 + Math.sin(t) * 6, 37 + Math.sin(t * 0.7) * 2, 112 + Math.cos(t) * 5);
      camera.lookAt(-417, 33, 130);
    } else {
      camera.position.set(-470 + Math.sin(t) * 24, 48 + Math.sin(t * 0.7) * 4, 60 + Math.cos(t) * 14);
      camera.lookAt(-420, 32, 130);
    }
    if (aircraft) {
      aircraft.group.position.y = S.pos.y + Math.sin(time * 0.8) * 0.05;
      for (const p of aircraft.props) p.rotation.z += dt * 2;
    }
  }
  renderer.render(scene, camera);
}

bindControls(input, {
  onFlaps: () => {
    if (mode !== 'fly' || !S) return;
    S.flapStage = (S.flapStage + 1) % FLIGHT.flapStagesDeg.length;
    audio.flapServo();
  },
  onGear: () => {
    if (mode !== 'fly' || !S) return;
    S.gearDown = !S.gearDown;
    audio.gearThunk();
  },
  onStability: () => { if (S) S.stabilityAssist = !S.stabilityAssist; },
  onCamera: () => { rig.mode = rig.mode === 'chase' ? 'cockpit' : 'chase'; },
  onMusic: () => { audio.toggleMusic(); },
  onRetry: () => {
    if (mode === 'crash' || mode === 'debrief') resetFlight(sortie.id, aircraftType, sortie.fuelGal);
  },
  onPause: () => { paused = !paused; },
  onHelp: () => { document.getElementById('help').style.display = document.getElementById('help').style.display === 'block' ? 'none' : 'block'; },
  onTrim: (d) => { if (S) S.trim = clamp(S.trim + d * 0.1, -2, 2); },
});

document.getElementById('btn-fly').addEventListener('click', startFromMenu);
document.getElementById('btn-hangar').addEventListener('click', () => {
  document.getElementById('hangar').style.display = document.getElementById('hangar').style.display === 'block' ? 'none' : 'block';
});
document.getElementById('fuel-slider').addEventListener('input', (e) => {
  document.getElementById('fuel-value').textContent = e.target.value + ' GAL';
});
document.getElementById('sel-aircraft').addEventListener('change', (e) => {
  if (mode === 'menu' && S) {
    const spec = AIRCRAFT_SPECS[e.target.value];
    S.spec = spec; S.fuelGal = Number(document.getElementById('fuel-slider').value);
    spawnAircraft(e.target.value);
    aircraft.group.position.copy(S.pos);
    aircraft.group.quaternion.copy(S.quat);
  }
});
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Build the menu controls from the sortie list.
const selSortie = document.getElementById('sel-sortie');
for (const s of SORTIES) {
  const o = document.createElement('option');
  o.value = s.id; o.textContent = s.name;
  selSortie.appendChild(o);
}
const helpEl = document.getElementById('help');
helpEl.innerHTML = '<b>FLIGHT CONTROLS</b><br>' + describeControls().map((c) => `${c[0]} — ${c[1]}`).join('<br>');

if (shot) applyShot(shot); else showMenu(false);
requestAnimationFrame(frame);
