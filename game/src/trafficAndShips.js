// trafficAndShips.js — live AI air traffic on traffic patterns, ferries and
// sailboats crossing the strait with foam wakes, nav lights blinking.
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
  // Formation escorts: two wingmen that hold station on the hero aircraft
  // (left-ahead high, right-behind low). Only shown for the cover shots
  // (main.js passes showEscorts) — a lone hero reads empty, a three-ship
  // formation over the harbor reads epic.
  const escorts = [
    { color: 0xc23a2e, formation: true, lateral: -48, ahead: 50, up: 10 },
    { color: 0x2e6db4, formation: true, lateral: 44, ahead: 48, up: -8 },
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
  // A flock of seabirds circling low over the bay, right on the cover
  // low-pass line: dark flapping V shapes against the sky and sea.
  const group = new THREE.Group();
  const wingMat = new THREE.MeshBasicMaterial({ color: 0x1e1a16, side: THREE.DoubleSide });
  const birds = [];
  const cx = 3050, cy = 115, cz = 1450;
  for (let i = 0; i < 14; i++) {
    const b = new THREE.Group();
    const wgeo = new THREE.BoxGeometry(2.6, 0.08, 0.7);
    const wl = new THREE.Mesh(wgeo, wingMat);
    wl.position.x = -1.3;
    const wr = new THREE.Mesh(wgeo, wingMat);
    wr.position.x = 1.3;
    b.add(wl, wr);
    group.add(b);
    birds.push({
      mesh: b, wl, wr,
      r: 60 + (i * 37) % 100,
      h: cy + ((i * 53) % 50) - 25,
      speed: 0.14 + (i % 4) * 0.02,
      phase: (i * 1.7) % (Math.PI * 2),
      flap: 5 + (i % 3),
    });
  }
  scene.add(group);
  return {
    group,
    update(dt, time) {
      for (const b of birds) {
        const a = time * b.speed + b.phase;
        const x = cx + Math.cos(a) * b.r;
        const z = cz + Math.sin(a) * b.r;
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

function makeFerry(color) {
  const g = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.BoxGeometry(10, 5, 42),
    new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.2 }));
  hull.position.y = 2; g.add(hull);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(9, 4, 30),
    new THREE.MeshStandardMaterial({ color: 0xf2f0e8, roughness: 0.7 }));
  deck.position.y = 6; g.add(deck);
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(8, 3.4, 8),
    new THREE.MeshStandardMaterial({ color: 0x2e4a66, roughness: 0.3, metalness: 0.4 }));
  bridge.position.set(0, 9.5, -12); g.add(bridge);
  const wake = new THREE.Mesh(new THREE.PlaneGeometry(16, 60),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, depthWrite: false }));
  wake.rotation.x = -Math.PI / 2; wake.position.set(0, 0.7, 34); g.add(wake);
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
  wake.rotation.x = -Math.PI / 2; wake.position.set(0, 0.6, 7); g.add(wake);
  return g;
}

export function buildShips(scene) {
  const ships = [];
  const ferries = [
    { x: 2200, z: 800, heading: 0.5, speed: 9 },
    { x: 3400, z: -600, heading: 2.6, speed: 7 },
  ];
  for (const f of ferries) {
    const m = makeFerry(0x1d4e89);
    scene.add(m);
    ships.push({ mesh: m, ...f, kind: 'ferry' });
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
