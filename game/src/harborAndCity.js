// harborAndCity.js — Porto Bellavista: hundreds of white limestone houses
// with terracotta roofs terracing the cliff, cargo port, marina, lighthouse,
// pine and olive groves, coastal road.
import * as THREE from 'three';
import { terrainHeight, coastlineX } from './terrainAdriatic.js';

function seeded(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

export function buildCity(scene, textures) {
  const group = new THREE.Group();
  const rnd = seeded(20261126);
  const wallMat = new THREE.MeshStandardMaterial({ map: textures.wall.map, roughness: 0.95 });
  const roofMat = new THREE.MeshStandardMaterial({ map: textures.roof.map, roughness: 0.9 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x9fc4d8, roughness: 0.15, metalness: 0.6 });
  // Terrace rows climbing the cliff west of the runway
  const houseGeo = new THREE.BoxGeometry(1, 1, 1);
  const roofGeo = new THREE.ConeGeometry(0.75, 0.55, 4);
  const houses = new THREE.InstancedMesh(houseGeo, wallMat, 420);
  const roofs = new THREE.InstancedMesh(roofGeo, roofMat, 420);
  houses.castShadow = true; roofs.castShadow = true;
  const m = new THREE.Matrix4(); const q = new THREE.Quaternion(); const sc = new THREE.Vector3();
  let placed = 0, guard = 0;
  while (placed < 420 && guard++ < 6000) {
    const x = -2600 + rnd() * 2100; // cliff town band, north of the runway
    const z = -2600 + rnd() * 2100;
    const ground = terrainHeight(x, z);
    if (ground < 10 || ground > 130) continue;
    const w = 14 + rnd() * 16, d = 12 + rnd() * 14, h = 9 + rnd() * 14;
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * Math.PI);
    m.compose(new THREE.Vector3(x, ground + h / 2 - 1, z), q, new THREE.Vector3(w, h, d));
    houses.setMatrixAt(placed, m);
    m.compose(new THREE.Vector3(x, ground + h + 1.4, z), q, new THREE.Vector3(w * 0.78, 3.2, d * 0.78));
    roofs.setMatrixAt(placed, m);
    placed++;
  }
  houses.count = placed; roofs.count = placed;
  group.add(houses); group.add(roofs);
  // Church dome + bell tower landmark
  const church = new THREE.Mesh(new THREE.BoxGeometry(34, 22, 24), wallMat);
  church.position.set(-1150, terrainHeight(-1150, -300) + 11, -300); group.add(church);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(10, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x3f6d8e, roughness: 0.4, metalness: 0.3 }));
  dome.position.set(-1150, terrainHeight(-1150, -300) + 22, -300); group.add(dome);
  const tower = new THREE.Mesh(new THREE.BoxGeometry(8, 46, 8), wallMat);
  tower.position.set(-1120, terrainHeight(-1120, -300) + 23, -300); group.add(tower);
  // Cargo port: cranes, containers, warehouses south of the runway
  const craneMat = new THREE.MeshStandardMaterial({ color: 0xc25a2a, roughness: 0.6, metalness: 0.4 });
  for (let i = 0; i < 4; i++) {
    const crane = new THREE.Group();
    const leg1 = new THREE.Mesh(new THREE.BoxGeometry(6, 60, 6), craneMat); leg1.position.set(-4, 30, 0);
    const leg2 = leg1.clone(); leg2.position.x = 4;
    const beam = new THREE.Mesh(new THREE.BoxGeometry(70, 5, 6), craneMat); beam.position.set(14, 58, 0);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(10, 8, 9), craneMat); cab.position.set(0, 52, 0);
    crane.add(leg1, leg2, beam, cab);
    crane.position.set(-900 + i * 170, terrainHeight(-900 + i * 170, 950), 950);
    group.add(crane);
  }
  const contColors = [0x2e6db4, 0xb03a2e, 0x3d8b4f, 0xc98a2e, 0x7a5a9e];
  const contGeo = new THREE.BoxGeometry(12, 2.6, 2.6);
  const conts = new THREE.InstancedMesh(contGeo, new THREE.MeshStandardMaterial({ roughness: 0.7, metalness: 0.3 }), 90);
  for (let i = 0; i < 90; i++) {
    const x = -1250 + (i % 15) * 16, z = 820 + Math.floor(i / 15) * 22;
    const y = terrainHeight(x, z) + 1.3 + (i % 3 === 0 ? 2.6 : 0);
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), (i % 2) * 0.05);
    m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(1, 1, 1));
    conts.setMatrixAt(i, m);
    conts.setColorAt(i, new THREE.Color(contColors[i % contColors.length]));
  }
  group.add(conts);
  // Warehouses + terminal glass block
  const wh = new THREE.Mesh(new THREE.BoxGeometry(120, 14, 40),
    new THREE.MeshStandardMaterial({ color: 0xd8d2c2, roughness: 0.9 }));
  wh.position.set(-700, terrainHeight(-700, 900) + 7, 900); group.add(wh);
  const terminal = new THREE.Mesh(new THREE.BoxGeometry(150, 18, 46), glassMat);
  terminal.position.set(-420, terrainHeight(-420, -260) + 9, -260); group.add(terminal);
  // Marina: wooden piers + moored sailboats near the bay
  const pierMat = new THREE.MeshStandardMaterial({ color: 0x8a6b48, roughness: 0.95 });
  for (let p = 0; p < 5; p++) {
    const pier = new THREE.Mesh(new THREE.BoxGeometry(10, 2, 150), pierMat);
    pier.position.set(1450 + p * 90, 1.2, 2050 + (p % 2) * 120);
    group.add(pier);
  }
  // Pine + olive groves (instanced cones/spheres)
  const pineGeo = new THREE.ConeGeometry(6, 18, 7);
  const pineMat = new THREE.MeshStandardMaterial({ color: 0x2e5d33, roughness: 1 });
  const pines = new THREE.InstancedMesh(pineGeo, pineMat, 260);
  const oliveGeo = new THREE.SphereGeometry(5, 8, 6);
  const oliveMat = new THREE.MeshStandardMaterial({ color: 0x6d7f4a, roughness: 1 });
  const olives = new THREE.InstancedMesh(oliveGeo, oliveMat, 200);
  for (let i = 0; i < 260; i++) {
    const x = -4200 + rnd() * 3200, z = -3200 + rnd() * 4200;
    const g = terrainHeight(x, z);
    if (g < 12) { m.compose(new THREE.Vector3(x, -50, z), q, sc.set(1, 1, 1)); pines.setMatrixAt(i, m); continue; }
    q.identity();
    m.compose(new THREE.Vector3(x, g + 8, z), q, sc.set(0.8 + rnd() * 0.7, 0.8 + rnd() * 0.9, 0.8 + rnd() * 0.7));
    pines.setMatrixAt(i, m);
  }
  for (let i = 0; i < 200; i++) {
    const x = -2600 + rnd() * 2400, z = -2600 + rnd() * 3600;
    const g = terrainHeight(x, z);
    q.identity();
    m.compose(new THREE.Vector3(x, g + 3, z), q, sc.set(0.8 + rnd() * 0.8, 0.7 + rnd() * 0.5, 0.8 + rnd() * 0.8));
    olives.setMatrixAt(i, m);
  }
  group.add(pines); group.add(olives);
  // Coastal road ribbon along the shore
  const roadMat = new THREE.MeshStandardMaterial({ color: 0x3a3d40, roughness: 0.95 });
  for (let z = -3000; z < 3000; z += 300) {
    const cx = coastlineX(z);
    const seg = new THREE.Mesh(new THREE.PlaneGeometry(14, 305), roadMat);
    seg.rotation.x = -Math.PI / 2;
    seg.position.set(cx - 95, terrainHeight(cx - 95, z) + 0.4, z);
    group.add(seg);
  }
  scene.add(group);
  return group;
}

export function buildLighthouse(scene) {
  const group = new THREE.Group();
  const lx = 1180, lz = -1500;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(9, 12, 34, 12),
    new THREE.MeshStandardMaterial({ color: 0xf2ead8, roughness: 0.85 }));
  base.position.set(lx, 17, lz);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 6, 12),
    new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.6 }));
  top.position.set(lx, 37, lz);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(3.4, 12, 10),
    new THREE.MeshBasicMaterial({ color: 0xfff2b0 }));
  lamp.position.set(lx, 37, lz);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 26, 420, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0.10, side: THREE.DoubleSide, depthWrite: false }));
  beam.rotation.z = Math.PI / 2;
  beam.position.set(lx, 37, lz);
  group.add(base, top, lamp, beam);
  scene.add(group);
  return {
    group, lamp, beam,
    update(time) {
      const on = (time % 4) < 0.5;
      lamp.material.color.setHex(on ? 0xfff6c0 : 0x8a7f5a);
      beam.material.opacity = on ? 0.14 : 0.0;
      beam.rotation.y = time * 0.5;
    },
  };
}
