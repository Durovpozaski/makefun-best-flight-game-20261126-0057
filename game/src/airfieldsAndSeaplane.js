// airfieldsAndSeaplane.js — five airfields: Porto Bellavista 09/27 with
// PAPI + ILS, Isola Bianca cliff strip, Cala Marina water runway with
// buoys and dock, Monte Corvo gravel ridge strip, Faro offshore platform.
import * as THREE from 'three';
import { AIRFIELDS, degToRad } from './config.js';
import { terrainHeight } from './terrainAdriatic.js';

function runwayMarkingTexture(rwyLabel, surface) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = surface === 'gravel' ? '#8a7f6a' : '#33363a';
  g.fillRect(0, 0, 1024, 128);
  g.fillStyle = '#e8e4d2';
  // threshold bars
  for (let i = 0; i < 8; i++) g.fillRect(20 + i * 12, 8, 7, 40);
  for (let i = 0; i < 8; i++) g.fillRect(20 + i * 12, 80, 7, 40);
  // centreline
  for (let x = 140; x < 900; x += 64) g.fillRect(x, 60, 36, 8);
  // runway numbers
  g.font = 'bold 64px sans-serif'; g.textAlign = 'center';
  g.fillText(rwyLabel, 512, 96);
  g.fillStyle = '#f7c948';
  g.fillRect(0, 0, 1024, 4); g.fillRect(0, 124, 1024, 4);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

export function buildAirfields(scene, textures) {
  const group = new THREE.Group();
  const papiUnits = [];
  const windsocks = [];
  const approachLights = [];
  for (const f of AIRFIELDS) {
    if (f.surface === 'water' || f.surface === 'platform') continue;
    const headingRad = degToRad(f.headingDeg);
    const tex = runwayMarkingTexture(f.rwy.split('/')[0], f.surface);
    const mat = new THREE.MeshStandardMaterial({
      map: f.surface === 'gravel' ? textures.ground.map : tex,
      roughness: 0.95, metalness: 0.0,
    });
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(f.lengthM, f.widthM), mat);
    strip.rotation.x = -Math.PI / 2;
    strip.rotation.y = degToRad(f.headingDeg - 90); // long axis along runway heading
    strip.position.set(f.x, f.elevM + 0.5, f.z);
    strip.receiveShadow = true;
    group.add(strip);
    // runway edge lights
    const lightGeo = new THREE.SphereGeometry(0.5, 6, 6);
    const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
    for (let d = -f.lengthM / 2; d <= f.lengthM / 2; d += 120) {
      for (const s of [-1, 1]) {
        const l = new THREE.Mesh(lightGeo, lightMat);
        const along = d, side = s * f.widthM / 2;
        l.position.set(
          f.x + Math.sin(headingRad) * along + Math.cos(headingRad) * side,
          f.elevM + 1, f.z - Math.cos(headingRad) * along + Math.sin(headingRad) * side);
        group.add(l);
      }
    }
    if (f.papi) {
      // 4-light PAPI row beside the touchdown zone, left of the runway
      const row = [];
      for (let i = 0; i < 4; i++) {
        const unit = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.6, 1.6),
          new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xffffff, emissiveIntensity: 1.4 }));
        const along = -f.lengthM / 2 + 320;
        const side = f.widthM / 2 + 12 + i * 7;
        unit.position.set(
          f.x + Math.sin(headingRad) * along + Math.cos(headingRad) * side,
          f.elevM + 1.2, f.z - Math.cos(headingRad) * along + Math.sin(headingRad) * side);
        group.add(unit);
        row.push(unit);
      }
      papiUnits.push({ field: f, units: row });
    }
    if (f.ils) {
      // sequenced approach lights extending west of threshold 09
      for (let i = 0; i < 9; i++) {
        const l = new THREE.Mesh(new THREE.SphereGeometry(2.2, 8, 8),
          new THREE.MeshBasicMaterial({ color: 0xffffff }));
        l.position.set(f.x - f.lengthM / 2 - 60 - i * 90, f.elevM + 2, f.z);
        group.add(l);
        approachLights.push(l);
      }
    }
    // windsock
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 9, 8),
      new THREE.MeshStandardMaterial({ color: 0xcccccc }));
    const sock = new THREE.Mesh(new THREE.ConeGeometry(1.1, 5, 8),
      new THREE.MeshStandardMaterial({ color: 0xff7a1a, roughness: 0.8 }));
    pole.position.set(f.x + 60, f.elevM + 4.5, f.z + f.widthM / 2 + 30);
    sock.position.set(f.x + 60, f.elevM + 8.6, f.z + f.widthM / 2 + 30);
    sock.rotation.z = Math.PI / 2;
    group.add(pole, sock);
    windsocks.push({ sock, pole });
  }
  // Bellavista: ATC tower, hangars, parked aircraft silhouettes
  const bv = AIRFIELDS[0];
  const tower = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(5, 7, 42, 10),
    new THREE.MeshStandardMaterial({ color: 0xe8e2d2, roughness: 0.85 }));
  shaft.position.y = 21;
  const cab = new THREE.Mesh(new THREE.CylinderGeometry(8, 6, 7, 10),
    new THREE.MeshStandardMaterial({ color: 0x2e4a66, roughness: 0.25, metalness: 0.5 }));
  cab.position.y = 45;
  tower.add(shaft, cab);
  tower.position.set(bv.x - 120, bv.elevM, bv.z - 120);
  group.add(tower);
  const hangarMat = new THREE.MeshStandardMaterial({ color: 0xb8c0c8, roughness: 0.6, metalness: 0.4 });
  for (let i = 0; i < 3; i++) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(46, 14, 34), hangarMat);
    h.position.set(bv.x - 260 - i * 60, bv.elevM + 7, bv.z + 130);
    group.add(h);
    const door = new THREE.Mesh(new THREE.PlaneGeometry(38, 11),
      new THREE.MeshStandardMaterial({ color: 0x5a6a78, roughness: 0.5, metalness: 0.5 }));
    door.position.set(bv.x - 260 - i * 60, bv.elevM + 5.5, bv.z + 113);
    door.rotation.y = Math.PI;
    group.add(door);
  }
  scene.add(group);
  return {
    group, papiUnits, windsocks, approachLights,
    updatePapi(aircraftPos) {
      for (const p of papiUnits) {
        const f = p.field;
        // glidepath angle from aircraft to threshold
        const dx = aircraftPos.x - (f.x - Math.sin(degToRad(f.headingDeg)) * f.lengthM / 2);
        const dz = aircraftPos.z - (f.z + Math.cos(degToRad(f.headingDeg)) * f.lengthM / 2);
        const dist = Math.hypot(dx, dz);
        const h = aircraftPos.y - f.elevM;
        const angle = Math.atan2(h, Math.max(dist, 1)) * 180 / Math.PI;
        // 4 lights: white above 3.0 deg, red below; threshold band +-0.25 deg
        const whites = angle > 3.35 ? 4 : angle > 3.15 ? 3 : angle > 2.85 ? 2 : angle > 2.65 ? 1 : 0;
        p.units.forEach((u, i) => {
          const white = i < whites;
          u.material.emissive.setHex(white ? 0xffffff : 0xff2a1a);
          u.material.color.setHex(white ? 0xffffff : 0x881111);
        });
      }
    },
    updateWindsock(windDirDeg, windKt) {
      for (const w of windsocks) {
        w.sock.rotation.y = degToRad(windDirDeg + 180);
        w.sock.rotation.z = Math.PI / 2 - Math.min(windKt, 30) * 0.012;
      }
    },
    updateApproach(time) {
      approachLights.forEach((l, i) => {
        l.material.color.setHex(((time * 2 + i * 0.25) % 2.2) < 0.4 ? 0xffffff : 0x555544);
      });
    },
  };
}

export function buildSeaplaneBasin(scene) {
  const group = new THREE.Group();
  const marina = AIRFIELDS[2];
  // boundary buoys along the water runway
  const buoyGeo = new THREE.SphereGeometry(1.6, 10, 8);
  const buoyMat = new THREE.MeshStandardMaterial({ color: 0xff7a1a, roughness: 0.5 });
  const buoys = [];
  for (let d = -marina.lengthM / 2; d <= marina.lengthM / 2; d += 150) {
    for (const s of [-1, 1]) {
      const b = new THREE.Mesh(buoyGeo, buoyMat);
      const hd = degToRad(marina.headingDeg);
      b.position.set(
        marina.x + Math.sin(hd) * d + Math.cos(hd) * s * marina.widthM / 2,
        1.2, marina.z - Math.cos(hd) * d + Math.sin(hd) * s * marina.widthM / 2);
      group.add(b); buoys.push(b);
    }
  }
  // wooden dock
  const dock = new THREE.Mesh(new THREE.BoxGeometry(60, 1.5, 8),
    new THREE.MeshStandardMaterial({ color: 0x8a6b48, roughness: 0.95 }));
  dock.position.set(marina.x - 260, 1.0, marina.z + 320);
  group.add(dock);
  // Faro offshore weather platform
  const faro = AIRFIELDS[4];
  const plat = new THREE.Group();
  const deck = new THREE.Mesh(new THREE.CylinderGeometry(16, 16, 3, 12),
    new THREE.MeshStandardMaterial({ color: 0x8a8f94, roughness: 0.6, metalness: 0.5 }));
  deck.position.y = 12;
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.8, 22, 8),
    new THREE.MeshStandardMaterial({ color: 0xd8d8d8 }));
  mast.position.y = 24;
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(1.2, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xff3020 }));
  beacon.position.y = 35;
  const leg1 = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 14, 8),
    new THREE.MeshStandardMaterial({ color: 0x6a6f74 }));
  leg1.position.set(8, 6, 8); const leg2 = leg1.clone(); leg2.position.set(-8, 6, 8);
  const leg3 = leg1.clone(); leg3.position.set(8, 6, -8); const leg4 = leg1.clone(); leg4.position.set(-8, 6, -8);
  plat.add(deck, mast, beacon, leg1, leg2, leg3, leg4);
  plat.position.set(faro.x, 0, faro.z);
  group.add(plat);
  scene.add(group);
  return {
    group, buoys, faroBeacon: beacon,
    update(dt, time) {
      for (const b of buoys) b.position.y = 1.2 + Math.sin(time * 1.2 + b.position.x * 0.05) * 0.35;
      beacon.material.color.setHex((time % 2) < 1 ? 0xff3020 : 0x441111);
    },
  };
}
