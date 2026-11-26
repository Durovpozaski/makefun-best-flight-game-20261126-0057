// proceduralTextures.js — every surface is a procedural 1024x1024 PBR canvas
// texture (albedo + bump), drawn in code. No image files, no network.
import * as THREE from 'three';

function makeCanvas(size) {
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  return [c, c.getContext('2d')];
}
function noiseRand(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
function finishTexture(canvas, repeatX = 1, repeatY = 1) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeatX, repeatY);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
function bumpFrom(canvas) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.RepeatWrapping;
  return t;
}

// Runway asphalt: dark grey, aggregate speckle, tyre skid-marks, cracks.
export function makeAsphaltTextures() {
  const [c, g] = makeCanvas(1024);
  const rnd = noiseRand(11);
  g.fillStyle = '#33363a'; g.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 26000; i++) {
    const v = 40 + rnd() * 50;
    g.fillStyle = `rgb(${v | 0},${v | 0},${(v + 4) | 0})`;
    g.fillRect(rnd() * 1024, rnd() * 1024, 1 + rnd() * 3, 1 + rnd() * 3);
  }
  // tyre skid bands along the touchdown zone
  for (let lane = 0; lane < 2; lane++) {
    const y = 380 + lane * 264;
    for (let x = 120; x < 900; x += 6) {
      g.fillStyle = `rgba(12,12,14,${0.10 + rnd() * 0.22})`;
      g.fillRect(x, y + (rnd() - 0.5) * 14, 5 + rnd() * 8, 10 + rnd() * 16);
    }
  }
  // cracks
  g.strokeStyle = 'rgba(18,18,20,0.55)'; g.lineWidth = 2;
  for (let i = 0; i < 14; i++) {
    g.beginPath(); let x = rnd() * 1024, y = rnd() * 1024; g.moveTo(x, y);
    for (let s = 0; s < 8; s++) { x += (rnd() - 0.5) * 90; y += (rnd() - 0.5) * 90; g.lineTo(x, y); }
    g.stroke();
  }
  // centreline dashes + edge lines (drawn into the albedo so markings stay crisp)
  g.fillStyle = '#e8e4d2';
  for (let x = 0; x < 1024; x += 64) g.fillRect(x + 8, 508, 36, 8);
  g.fillRect(0, 40, 1024, 6); g.fillRect(0, 978, 1024, 6);
  const [bc, bg] = makeCanvas(1024);
  bg.fillStyle = '#808080'; bg.fillRect(0, 0, 1024, 1024);
  const brnd = noiseRand(23);
  for (let i = 0; i < 18000; i++) {
    const v = 96 + brnd() * 64;
    bg.fillStyle = `rgb(${v | 0},${v | 0},${v | 0})`;
    bg.fillRect(brnd() * 1024, brnd() * 1024, 2, 2);
  }
  return { map: finishTexture(c, 6, 1), bumpMap: bumpFrom(bc), roughness: 0.94, metalness: 0.0 };
}

// Limestone cliff strata with scrub vegetation speckle.
export function makeCliffTextures() {
  const [c, g] = makeCanvas(1024);
  const rnd = noiseRand(41);
  const palette = ['#c9b795', '#bfae8c', '#d6c4a0', '#a89a7c', '#c2b28d'];
  for (let y = 0; y < 1024; y += 26) {
    g.fillStyle = palette[(y / 26 | 0) % palette.length];
    g.fillRect(0, y, 1024, 26);
  }
  for (let i = 0; i < 9000; i++) {
    g.fillStyle = rnd() > 0.5 ? 'rgba(90,80,60,0.25)' : 'rgba(230,220,190,0.22)';
    g.fillRect(rnd() * 1024, rnd() * 1024, 2 + rnd() * 6, 1 + rnd() * 3);
  }
  // scrub: olive-green dots in the upper half
  for (let i = 0; i < 2600; i++) {
    g.fillStyle = `rgba(${70 + rnd() * 40 | 0},${100 + rnd() * 40 | 0},${50 + rnd() * 25 | 0},0.8)`;
    g.beginPath(); g.arc(rnd() * 1024, rnd() * 520, 2 + rnd() * 5, 0, 7); g.fill();
  }
  const [bc, bg] = makeCanvas(1024);
  bg.fillStyle = '#7f7f7f'; bg.fillRect(0, 0, 1024, 1024);
  for (let y = 0; y < 1024; y += 26) { bg.fillStyle = y % 52 ? '#8a8a8a' : '#6e6e6e'; bg.fillRect(0, y, 1024, 26); }
  return { map: finishTexture(c, 4, 4), bumpMap: bumpFrom(bc), roughness: 0.96, metalness: 0.0 };
}

// Terracotta roof tiles.
export function makeRoofTextures() {
  const [c, g] = makeCanvas(1024);
  const rnd = noiseRand(77);
  g.fillStyle = '#a34d2c'; g.fillRect(0, 0, 1024, 1024);
  for (let row = 0; row < 32; row++) {
    for (let col = 0; col < 32; col++) {
      const v = 150 + rnd() * 60;
      g.fillStyle = `rgb(${v | 0},${(v * 0.45) | 0},${(v * 0.22) | 0})`;
      g.fillRect(col * 32 + 1, row * 32 + 1, 30, 30);
      g.fillStyle = 'rgba(0,0,0,0.18)';
      g.fillRect(col * 32 + 1, row * 32 + 28, 30, 3);
    }
  }
  return { map: finishTexture(c, 1, 1), roughness: 0.9, metalness: 0.0 };
}

// Whitewashed limestone wall with subtle stains.
export function makeWallTextures() {
  const [c, g] = makeCanvas(1024);
  const rnd = noiseRand(99);
  g.fillStyle = '#efe6d2'; g.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 12000; i++) {
    const v = 215 + rnd() * 30;
    g.fillStyle = `rgba(${v | 0},${(v - 12) | 0},${(v - 35) | 0},0.5)`;
    g.fillRect(rnd() * 1024, rnd() * 1024, 2 + rnd() * 4, 2 + rnd() * 4);
  }
  g.fillStyle = 'rgba(120,100,70,0.12)';
  for (let i = 0; i < 40; i++) g.fillRect(rnd() * 1024, rnd() * 1024, 6 + rnd() * 20, 30 + rnd() * 90);
  return { map: finishTexture(c, 1, 1), roughness: 0.95, metalness: 0.0 };
}

// Brushed aluminium airframe with rivet lines and panel seams (livery base).
export function makeAluminiumTextures() {
  const [c, g] = makeCanvas(1024);
  const rnd = noiseRand(7);
  const grad = g.createLinearGradient(0, 0, 0, 1024);
  grad.addColorStop(0, '#f4f6f8'); grad.addColorStop(0.5, '#e8ebee'); grad.addColorStop(1, '#dfe3e8');
  g.fillStyle = grad; g.fillRect(0, 0, 1024, 1024);
  // Adriatic sapphire cheatline + gold-terracotta accent stripe
  g.fillStyle = '#1d4e89'; g.fillRect(0, 620, 1024, 74);
  g.fillStyle = '#c98a2e'; g.fillRect(0, 694, 1024, 10);
  g.fillStyle = '#b3502a'; g.fillRect(0, 704, 1024, 6);
  // panel seams
  g.strokeStyle = 'rgba(60,70,85,0.5)'; g.lineWidth = 2;
  for (let x = 64; x < 1024; x += 128) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 1024); g.stroke(); }
  for (let y = 96; y < 1024; y += 160) { g.beginPath(); g.moveTo(0, y); g.lineTo(1024, y); g.stroke(); }
  // rivets along seams
  g.fillStyle = 'rgba(70,80,95,0.65)';
  for (let x = 64; x < 1024; x += 128) for (let y = 8; y < 1024; y += 16) { g.beginPath(); g.arc(x + 5, y, 2.2, 0, 7); g.fill(); }
  // exhaust soot streaks near the rear
  for (let i = 0; i < 300; i++) {
    g.fillStyle = `rgba(40,38,34,${0.05 + rnd() * 0.12})`;
    g.fillRect(880 + rnd() * 120, 560 + rnd() * 120, 3 + rnd() * 8, 2);
  }
  // registration I-MIST
  g.fillStyle = '#16324f'; g.font = 'bold 64px sans-serif';
  g.fillText('I-MIST', 420, 560);
  const [bc, bg] = makeCanvas(1024);
  bg.fillStyle = '#808080'; bg.fillRect(0, 0, 1024, 1024);
  bg.strokeStyle = '#5a5a5a'; bg.lineWidth = 2;
  for (let x = 64; x < 1024; x += 128) { bg.beginPath(); bg.moveTo(x, 0); bg.lineTo(x, 1024); bg.stroke(); }
  return { map: finishTexture(c, 1, 1), bumpMap: bumpFrom(bc), roughness: 0.42, metalness: 0.55 };
}

// Matte dark cockpit dashboard panel.
export function makeDashboardTextures() {
  const [c, g] = makeCanvas(1024);
  g.fillStyle = '#1b1e22'; g.fillRect(0, 0, 1024, 1024);
  const rnd = noiseRand(5);
  for (let i = 0; i < 9000; i++) {
    const v = 22 + rnd() * 22;
    g.fillStyle = `rgb(${v | 0},${v | 0},${(v + 3) | 0})`;
    g.fillRect(rnd() * 1024, rnd() * 1024, 2, 2);
  }
  g.strokeStyle = 'rgba(200,170,90,0.35)'; g.lineWidth = 3;
  g.strokeRect(20, 20, 984, 984);
  return { map: finishTexture(c, 1, 1), roughness: 0.85, metalness: 0.25 };
}

// Dry Mediterranean grass / olive grove ground.
export function makeGroundTextures() {
  const [c, g] = makeCanvas(1024);
  const rnd = noiseRand(31);
  g.fillStyle = '#9a8f5e'; g.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 22000; i++) {
    const pick = rnd();
    g.fillStyle = pick > 0.6 ? 'rgba(120,130,60,0.6)' : pick > 0.3 ? 'rgba(150,135,80,0.6)' : 'rgba(110,105,60,0.6)';
    g.fillRect(rnd() * 1024, rnd() * 1024, 2 + rnd() * 5, 2 + rnd() * 5);
  }
  return { map: finishTexture(c, 24, 24), roughness: 1.0, metalness: 0.0 };
}
