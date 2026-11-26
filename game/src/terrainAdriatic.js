// terrainAdriatic.js — the 12 km x 12 km Adriatic coast heightfield.
// Analytic terrain: limestone ridge west, cliff coastline, Isola Bianca
// island, Cala Marina bay, Monte Corvo peak. Runway pads are flattened.
import * as THREE from 'three';
import { AIRFIELDS, clamp } from './config.js';

function smoothNoise(x, z) {
  return Math.sin(x * 0.0011 + 1.7) * Math.cos(z * 0.0009 - 0.6)
    + 0.5 * Math.sin(x * 0.0027 - z * 0.0021 + 3.1)
    + 0.25 * Math.sin(x * 0.006 + z * 0.005);
}
export function coastlineX(z) { return 1100 + 750 * Math.sin(z * 0.00032 + 1.1) + 260 * Math.sin(z * 0.0011); }

export function isWater(x, z) {
  // Cala Marina bay: a water inlet cut into the coast
  const bayDx = x - 2500, bayDz = z - 2800;
  if (bayDx * bayDx + bayDz * bayDz < 1500 * 1500) return true;
  // Isola Bianca island is land; everything east of the coastline is sea
  const isleDx = x - 3500, isleDz = z + 2500;
  if (isleDx * isleDx + isleDz * isleDz < 950 * 950) return false;
  return x > coastlineX(z);
}

export function terrainHeight(x, z) {
  const sea = -6;
  const cx = coastlineX(z);
  const inland = clamp((cx - x) / 900, 0, 1); // 0 at shore, 1 deep inland
  let h = 18 + 46 * inland + 26 * smoothNoise(x, z) * inland;
  // Monte Corvo ridge, far north-west
  const rdx = x + 4300, rdz = z + 3800;
  const rd = Math.sqrt(rdx * rdx + rdz * rdz);
  h += 620 * Math.exp(-(rd * rd) / (2 * 1500 * 1500));
  // Isola Bianca island dome
  const idx = x - 3500, idz = z + 2500;
  const id = Math.sqrt(idx * idx + idz * idz);
  h = Math.max(h, 62 * Math.exp(-(id * id) / (2 * 620 * 620)) + 8 * (1 - id / 950));
  // coastal cliff: sharp drop right at the waterline
  if (x > cx - 120 && x < cx + 60) h = Math.max(h, 14 * (1 - (x - (cx - 120)) / 180));
  if (x > cx) h = sea;
  // Cala Marina bay floor
  const bdx = x - 2500, bdz = z - 2800;
  if (bdx * bdx + bdz * bdz < 1500 * 1500) h = sea;
  // flatten runway pads so runways sit on real ground
  for (const f of AIRFIELDS) {
    if (f.surface === 'water' || f.surface === 'platform') continue;
    const dx = x - f.x, dz = z - f.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    const padR = Math.max(f.lengthM, f.widthM) * 0.75 + 260;
    if (d < padR) {
      const t = d / padR;
      const s = t * t * (3 - 2 * t);
      h = f.elevM + (h - f.elevM) * s;
    }
  }
  // graded approach corridor for RWY 09/27: the final approach stays clear
  {
    const f = AIRFIELDS[0];
    if (x > f.x - 3400 && x < f.x + 1400 && Math.abs(z - f.z) < 300) {
      const t = clamp(Math.abs(z - f.z) / 300, 0, 1);
      const s = t * t * (3 - 2 * t);
      h = f.elevM + (h - f.elevM) * s;
    }
  }
  return h;
}

export function buildTerrain(scene, textures) {
  const SEG = 180;
  const geo = new THREE.PlaneGeometry(12000, 12000, SEG, SEG);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    pos.setY(i, terrainHeight(x, z));
  }
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({
    map: textures.ground.map, bumpMap: textures.ground.map, bumpScale: 0.6,
    roughness: 1.0, metalness: 0.0,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  scene.add(mesh);
  // Cliff band: a steep limestone wall hugging the coastline
  const cliffMat = new THREE.MeshStandardMaterial({
    map: textures.cliff.map, bumpMap: textures.cliff.bumpMap, bumpScale: 1.2,
    roughness: 0.96, metalness: 0.0,
  });
  const cliffGroup = new THREE.Group();
  for (let z = -5800; z < 5800; z += 420) {
    const cx = coastlineX(z);
    const wall = new THREE.Mesh(new THREE.BoxGeometry(90, 42, 420), cliffMat);
    wall.position.set(cx - 30, 8, z);
    wall.rotation.y = (Math.random() - 0.5) * 0.2;
    cliffGroup.add(wall);
  }
  scene.add(cliffGroup);
  return mesh;
}
