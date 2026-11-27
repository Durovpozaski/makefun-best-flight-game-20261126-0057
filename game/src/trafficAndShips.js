// trafficAndShips.js — live AI air traffic on traffic patterns, ferries and
// sailboats crossing the strait with foam wakes, nav lights blinking.
// The harbour is BUSY on purpose: a five-ship formation around the hero,
// a big white ferry + speedboat + sailboats on the cover flight line, two
// bird flocks, and a crowded marina — the frame should never read empty.
import * as THREE from 'three';

function makeSimplePlane(color) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.3 });
  const fus = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 0.7, 11, 10), mat);
  fus.rotation.x = Math.PI / 2; g.add(fus);
  const wing = new THREE.Mesh(new THREE.BoxGeometry(15, 0.25, 2.6), mat);
  wing.position.y = 0.4; g.add(wing);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.2, 1.6), mat);
  tail.position.set(0, 0.3, -5); g.add(tail);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.25, 2.2, 1.8), mat);
  fin.position.set(0, 1.1, -5); g.add(fin);
  const prop = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.5, 8),
    new THREE.MeshStandardMaterial({ color: 0x222222 }));
  prop.rotation.x = Math.PI / 2; prop.position.z = 5.7; g.add(prop);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(2.4, 20),
    new THREE.MeshBasicMaterial({ color: 0x888888, transparent: true, opacity: 0.18, side: THREE.DoubleSide }));
  disc.position.z = 5.8; g.add(disc);
  const navL = new THREE.Mesh(new THREE.SphereGeometry(0.28, 6, 6), new THREE.MeshBasicMaterial({ color: 0xff2020 }));
  navL.position.set(-7.5, 0.4, 0); g.add(navL);
  const navR = new THREE.Mesh(new THREE.SphereGeometry(0.28, 6, 6), new THREE.MeshBasicMaterial({ color: 0x20ff40 }));
  navR.position.set(7.5, 0.4, 0); g.add(navR);
  const strobe = new THREE.Mesh(new THREE.SphereGeometry(0.3, 6, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  strobe.position.set(0, 1.4, -5.4); g.add(strobe);
  g.userData.strobe = strobe;
  return g;
}

export function buildTraffic(scene) {
  const planes = [];
  const patterns = [
    { color: 0xe8e8e8, cx: -200, cz: 600, r: 1500, alt: 420, speed: 0.055, phase: 0 },
    { color: 0xd8b25a, cx: 1800, cz: -1200, r: 2100, alt: 620, speed: 0.042, phase: 2.1 },
    { color: 0x7fa8c9, cx: 2600, cz: 2400, r: 1300, alt: 260, speed: 0.06, phase: 4.0, amphib: true },
  ];
  for (const p of patterns) {
    const plane = makeSimplePlane(p.color);
    scene.add(plane);
    planes.push({ mesh: plane, ...p });
  }
  // Formation escorts: FOUR wingmen holding station on the hero aircraft
  // in a loose echelon (inner pair tight, outer pair wide/high/low), so
  // the hero flies as a five-ship formation in every fly mode — the
  // cover shot and normal play both read busy, never a lone aircraft.
  // All four stay inside the chase camera's ~47 deg half-FOV.
  const escorts = [
    { color: 0xc23a2e, formation: true, lateral: -30, ahead: 40, up: 8 },
    { color: 0x2e6db4, formation: true, lateral: 30, ahead: 38, up: -6 },
    { color: 0xffd23e, formation: true, lateral: -78, ahead: 66, up: 14 },
    { color: 0x2ea88a, formation: true, lateral: 72, ahead: 64, up: -18 },
  ];
  for (const e of escorts) {
    const plane = makeSimplePlane(e.color);
    plane.visible = false;
    scene.add(plane);
    planes.push({ mesh: plane, ...e });
  }
  return {
    planes,
    update(dt, time, S, showEscorts) {
      for (const p of planes) {
        if (p.formation) {
          if (!showEscorts || !S) { p.mesh.visible = false; continue; }
          p.mesh.visible = true;
          const h = S.headingDeg * Math.PI / 180;
          const fx = Math.sin(h), fz = -Math.cos(h); // forward
          const rx = Math.cos(h), rz = Math.sin(h);  // pilot's right
          p.mesh.position.set(
            S.pos.x + fx * p.ahead + rx * p.lateral,
            S.pos.y + p.up + Math.sin(time * 0.9 + p.lateral) * 1.5,
            S.pos.z + fz * p.ahead + rz * p.lateral);
          p.mesh.rotation.y = Math.PI - h; // nose (+z) onto the heading
          p.mesh.rotation.z = 0.12; // gentle bank into formation
          p.mesh.userData.strobe.material.color.setHex((time % 1.2) < 0.12 ? 0xffffff : 0x333333);
          continue;
        }
        const a = time * p.speed + p.phase;
        p.mesh.position.set(p.cx + Math.cos(a) * p.r, p.alt + Math.sin(time * 0.3 + p.phase) * 18, p.cz + Math.sin(a) * p.r);
        p.mesh.rotation.y = -a - Math.PI / 2 + Math.PI;
        p.mesh.rotation.z = 0.18; // gentle bank into the turn
        p.mesh.userData.strobe.material.color.setHex((time % 1.2) < 0.12 ? 0xffffff : 0x333333);
      }
    },
  };
}

export function buildBirds(scene) {
  // TWO seabird flocks on the cover flight line, kept well clear of the
  // hero and the chase camera (flock centres sit ~230 m off the line and
  // orbit radii cap at 120 m, birds fly 40+ m above the hero's altitude,
  // so nothing ever clips through the aircraft or the lens).
  // Flock A: 24 birds, low-left of the sun; flock B: 10 birds, right.
  const group = new THREE.Group();
  const wingMat = new THREE.MeshBasicMaterial({ color: 0x1e1a16, side: THREE.DoubleSide });
  const birds = [];
  const flocks = [
    { cx: 2850, cy: 145, cz: 1800, n: 24, rMax: 120, hSpan: 30 },
    { cx: 2600, cy: 155, cz: 1400, n: 10, rMax: 110, hSpan: 25 },
  ];
  let idx = 0;
  for (const f of flocks) {
    for (let i = 0; i < f.n; i++, idx++) {
      const b = new THREE.Group();
      const wgeo = new THREE.BoxGeometry(3.4, 0.08, 0.9);
      const wl = new THREE.Mesh(wgeo, wingMat);
      wl.position.x = -1.7;
      const wr = new THREE.Mesh(wgeo, wingMat);
      wr.position.x = 1.7;
      b.add(wl, wr);
      group.add(b);
      birds.push({
        mesh: b, wl, wr,
        cx: f.cx, cy: f.cy, cz: f.cz,
        r: 45 + (idx * 37) % f.rMax,
        h: f.cy + ((idx * 53) % f.hSpan) - f.hSpan / 2,
        speed: 0.14 + (idx % 4) * 0.02,
        phase: (idx * 1.7) % (Math.PI * 2),
        flap: 5 + (idx % 3),
      });
    }
  }
  scene.add(group);
  return {
    group,
    update(dt, time) {
      for (const b of birds) {
        const a = time * b.speed + b.phase;
        const x = b.cx + Math.cos(a) * b.r;
        const z = b.cz + Math.sin(a) * b.r;
        const y = b.h + Math.sin(time * 0.8 + b.phase) * 6;
        b.mesh.position.set(x, y, z);
        b.mesh.rotation.y = -a; // face along the orbit tangent
        const flap = Math.sin(time * b.flap + b.phase) * 0.55;
        b.wl.rotation.z = flap;
        b.wr.rotation.z = -flap;
      }
    },
  };
}

function makeFerry(color, scale = 1, white = false) {
  const g = new THREE.Group();
  const hullMat = new THREE.MeshStandardMaterial({
    color: white ? 0xf2f0e8 : color, roughness: 0.55, metalness: 0.2 });
  const hull = new THREE.Mesh(new THREE.BoxGeometry(10, 5, 42), hullMat);
  hull.position.y = 2; g.add(hull);
  // bright waterline stripe so the hull reads against the sea even
  // backlit (white hull -> red stripe, blue hull -> white stripe), plus
  // a slight emissive lift so the shadow side never goes pitch-dark
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(10.2, 1.1, 42.2),
    new THREE.MeshStandardMaterial({ color: white ? 0xd8281e : 0xf2f0e8, roughness: 0.5,
      emissive: 0x222222, emissiveIntensity: 0.4 }));
  stripe.position.y = 1.2; g.add(stripe);
  if (white) {
    hullMat.emissive = new THREE.Color(0x555555);
    hullMat.emissiveIntensity = 0.35;
  }
  const deck = new THREE.Mesh(new THREE.BoxGeometry(9, 4, 30),
    new THREE.MeshStandardMaterial({ color: white ? 0x1d4e89 : 0xf2f0e8, roughness: 0.7 }));
  deck.position.y = 6; g.add(deck);
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(8, 3.4, 8),
    new THREE.MeshStandardMaterial({ color: 0x2e4a66, roughness: 0.3, metalness: 0.4 }));
  bridge.position.set(0, 9.5, -12); g.add(bridge);
  // foam wake TRAILS behind the stern (local -z is aft: the model
  // travels toward its local +z)
  const wake = new THREE.Mesh(new THREE.PlaneGeometry(16, 60),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45, depthWrite: false }));
  wake.rotation.x = -Math.PI / 2; wake.position.set(0, 0.7, -34); g.add(wake);
  g.scale.setScalar(scale);
  return g;
}

function makeSailboat() {
  const g = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 0.7, 9, 8),
    new THREE.MeshStandardMaterial({ color: 0xf8f8f8, roughness: 0.5 }));
  hull.rotation.x = Math.PI / 2; hull.scale.y = 1; hull.position.y = 0.8; g.add(hull);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 12, 6),
    new THREE.MeshStandardMaterial({ color: 0x6a4a2a }));
  mast.position.y = 6.5; g.add(mast);
  const sail = new THREE.Mesh(new THREE.PlaneGeometry(5.5, 10),
    new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide, roughness: 0.85 }));
  sail.position.set(0, 7, -1.4); sail.rotation.y = 0.5; g.add(sail);
  const wake = new THREE.Mesh(new THREE.PlaneGeometry(4, 14),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3, depthWrite: false }));
  wake.rotation.x = -Math.PI / 2; wake.position.set(0, 0.6, -8); g.add(wake);
  return g;
}

function makeSpeedboat() {
  // Sleek white speedboat crossing the frame with a long foaming V-wake —
  // the fastest, brightest thing on the water in the cover shot.
  const g = new THREE.Group();
  const hullMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35, metalness: 0.25 });
  const hull = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.1, 8.5), hullMat);
  hull.position.y = 0.7; g.add(hull);
  const bow = new THREE.Mesh(new THREE.ConeGeometry(1.3, 3.2, 4), hullMat);
  bow.rotation.x = Math.PI / 2; bow.rotation.y = Math.PI / 4;
  bow.position.set(0, 0.7, 5.8); g.add(bow);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.35, 8.6),
    new THREE.MeshStandardMaterial({ color: 0xd8281e, roughness: 0.4 }));
  stripe.position.y = 1.05; g.add(stripe);
  const screen = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.9, 0.3),
    new THREE.MeshStandardMaterial({ color: 0x223344, roughness: 0.15, metalness: 0.5 }));
  screen.position.set(0, 1.6, 1.2); g.add(screen);
  const motor = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.3, 0.7),
    new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.5 }));
  motor.position.set(0, 0.9, -4.5); g.add(motor);
  g.scale.setScalar(1.8); // big enough to read: 15 m hull, ~80 m wake
  // V-wake: two angled foam sheets + a centre trail, all trailing aft (-z)
  const wakeMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false });
  const wL = new THREE.Mesh(new THREE.PlaneGeometry(3, 42), wakeMat);
  wL.rotation.x = -Math.PI / 2; wL.rotation.z = 0.22; wL.position.set(-3.5, 0.55, -24); g.add(wL);
  const wR = new THREE.Mesh(new THREE.PlaneGeometry(3, 42), wakeMat.clone());
  wR.rotation.x = -Math.PI / 2; wR.rotation.z = -0.22; wR.position.set(3.5, 0.55, -24); g.add(wR);
  const wC = new THREE.Mesh(new THREE.PlaneGeometry(4, 46),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4, depthWrite: false }));
  wC.rotation.x = -Math.PI / 2; wC.position.set(0, 0.5, -26); g.add(wC);
  return g;
}

export function buildShips(scene) {
  const ships = [];
  const ferries = [
    { x: 2200, z: 800, heading: 0.5, speed: 9 },
    { x: 3400, z: -600, heading: 2.6, speed: 7 },
    // harbour ferry working the marina entrance
    { x: 1800, z: 2350, heading: 1.6, speed: 5 },
  ];
  for (const f of ferries) {
    const m = makeFerry(0x1d4e89);
    scene.add(m);
    ships.push({ mesh: m, ...f, kind: 'ferry' });
  }
  // COVER ferries: placed on the cover flight line ahead of the hero's
  // spawn (the headless screenshot fires with the hero still at its
  // spawn), broadside to the camera, big white hulls + foam wakes.
  // Ferry A is 1.5x scale, slow, and 160 m left of the centreline so it
  // clears the hero instead of hiding behind it.
  const coverFerries = [
    { x: 2413, z: 1846, heading: 0.40, speed: 2, scale: 1.5, white: true },
    { x: 2140, z: 1896, heading: 0.40, speed: 6, scale: 1.2, white: false },
  ];
  for (const f of coverFerries) {
    const m = makeFerry(0x1d4e89, f.scale, f.white);
    scene.add(m);
    ships.push({ mesh: m, x: f.x, z: f.z, heading: f.heading, speed: f.speed, kind: 'ferry' });
  }
  for (let i = 0; i < 14; i++) {
    const m = makeSailboat();
    scene.add(m);
    ships.push({
      mesh: m, kind: 'sail',
      x: 1600 + (i * 377) % 3600, z: -1400 + (i * 911) % 4200,
      heading: (i * 0.7) % (Math.PI * 2), speed: 3 + (i % 4),
    });
  }
  // COVER sailboats: three white sails strung along the flight line at
  // ~180 m (near, left), ~350 m (mid, left) and ~520 m (far, right).
  const coverSails = [
    { x: 2517, z: 1709, heading: 1.2, speed: 3 },
    { x: 2348, z: 1797, heading: 2.4, speed: 4 },
    { x: 2208, z: 1672, heading: 0.9, speed: 3 },
    { x: 2550, z: 1733, heading: 0.6, speed: 3 },
  ];
  for (const s of coverSails) {
    const m = makeSailboat();
    scene.add(m);
    ships.push({ mesh: m, kind: 'sail', ...s });
  }
  // Harbour sailboats: six more moored/sailing around the marina and bay
  // so the water near the coast reads crowded in normal play too.
  const harbourSails = [
    { x: 1700, z: 2100, heading: 0.4, speed: 2 },
    { x: 2000, z: 2250, heading: 1.1, speed: 3 },
    { x: 2300, z: 2150, heading: 2.0, speed: 2 },
    { x: 1600, z: 1850, heading: 2.8, speed: 3 },
    { x: 2600, z: 2300, heading: 0.7, speed: 2 },
    { x: 1900, z: 1950, heading: 1.9, speed: 3 },
  ];
  for (const s of harbourSails) {
    const m = makeSailboat();
    scene.add(m);
    ships.push({ mesh: m, kind: 'sail', ...s });
  }
  // COVER speedboat: crosses the frame right-to-left ~280 m ahead of the
  // hero at screenshot time (the headless render barely advances sim
  // time, so the boat sits near its start position), white V-wake
  // trailing behind it.
  const speedboat = makeSpeedboat();
  scene.add(speedboat);
  ships.push({ mesh: speedboat, kind: 'speed', x: 2435, z: 1565, heading: 3.54, speed: 16 });
  return {
    ships,
    update(dt, time) {
      for (const s of ships) {
        s.x += Math.sin(s.heading) * s.speed * dt;
        s.z += Math.cos(s.heading) * s.speed * dt;
        if (s.x > 5800) s.x = 1400; if (s.x < 1300) s.x = 5700;
        if (s.z > 5800) s.z = -2000; if (s.z < -2600) s.z = 5700;
        s.mesh.position.set(s.x, Math.sin(time * 0.9 + s.x * 0.01) * 0.35, s.z);
        s.mesh.rotation.y = s.heading;
        s.mesh.rotation.z = Math.sin(time * 0.7 + s.z * 0.01) * (s.kind === 'sail' ? 0.06 : 0.02);
      }
    },
  };
}
