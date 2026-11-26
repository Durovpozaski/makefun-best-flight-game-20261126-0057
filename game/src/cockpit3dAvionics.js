// cockpit3dAvionics.js — a physical 3D cockpit: curved matte dashboard,
// moving yoke and throttle quadrant, six backlit analogue steam gauges
// drawn on canvas textures (KIAS, attitude, altimeter, VSI, HSI with live
// ILS CDI needles, dual RPM/CHT/fuel flow) plus a moving-map / weather
// radar MFD. The gauges are lit, not drawn flat on the screen.
import * as THREE from 'three';
import { AIRFIELDS, clamp } from './config.js';

function gaugeCanvas(w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}
function roundGauge(ctx, cx, cy, r, label, sub) {
  ctx.clearRect(0, 0, 256, 256);
  ctx.fillStyle = '#101216'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill();
  ctx.strokeStyle = '#c9a85a'; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.arc(cx, cy, r - 3, 0, 7); ctx.stroke();
  ctx.strokeStyle = '#e8e4d2'; ctx.lineWidth = 2;
  ctx.fillStyle = '#f2ead8'; ctx.font = 'bold 20px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(label, cx, cy - r + 34);
  ctx.font = '14px sans-serif'; ctx.fillStyle = '#9aa0a8';
  ctx.fillText(sub, cx, cy + r - 14);
  return ctx;
}
function needle(ctx, cx, cy, angleRad, len, color, width) {
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.sin(angleRad) * len, cy - Math.cos(angleRad) * len); ctx.stroke();
}
function ticks(ctx, cx, cy, r, n, startA, endA, labels) {
  ctx.fillStyle = '#e8e4d2'; ctx.font = 'bold 17px sans-serif'; ctx.textAlign = 'center';
  for (let i = 0; i < n; i++) {
    const a = startA + (endA - startA) * (i / (n - 1));
    const x1 = cx + Math.sin(a) * (r - 12), y1 = cy - Math.cos(a) * (r - 12);
    const x2 = cx + Math.sin(a) * (r - 26), y2 = cy - Math.cos(a) * (r - 26);
    ctx.strokeStyle = '#e8e4d2'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    if (labels) {
      const lx = cx + Math.sin(a) * (r - 44), ly = cy - Math.cos(a) * (r - 44) + 6;
      ctx.fillText(String(labels[i]), lx, ly);
    }
  }
}

export function buildCockpit(scene, textures) {
  const group = new THREE.Group();
  const dashMat = new THREE.MeshStandardMaterial({
    map: textures.dashboard.map, roughness: 0.85, metalness: 0.25,
  });
  // dashboard brow above the panel (a simple coaming bar, not a dome)
  const coaming = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.22, 0.5), dashMat);
  coaming.position.set(0, 0.85, 2.85);
  group.add(coaming);
  const panel = new THREE.Mesh(new THREE.BoxGeometry(4.0, 1.9, 0.3), dashMat);
  panel.position.set(0, -0.15, 2.9); panel.rotation.x = -0.12;
  group.add(panel);
  // windscreen frame pillars
  const pillarMat = new THREE.MeshStandardMaterial({ color: 0x1b1e22, roughness: 0.6, metalness: 0.5 });
  for (const s of [-1, 1]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.0, 0.14), pillarMat);
    p.position.set(s * 1.75, 0.75, 2.9); p.rotation.z = -s * 0.22; group.add(p);
  }
  const brow = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.16, 0.16), pillarMat);
  brow.position.set(0, 1.7, 2.85); group.add(brow);
  // yoke + throttle quadrant (animated)
  const yoke = new THREE.Group();
  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.0, 8), pillarMat);
  column.rotation.x = 0.9; column.position.set(0, -0.85, 2.2); yoke.add(column);
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.07, 8, 20), pillarMat);
  wheel.position.set(0, -0.38, 1.85); yoke.add(wheel);
  group.add(yoke);
  const throttle = new THREE.Group();
  const quad = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.9), dashMat);
  quad.position.set(0.9, -0.8, 2.0); throttle.add(quad);
  const leverMat = new THREE.MeshStandardMaterial({ color: 0xd8d8d8, roughness: 0.3, metalness: 0.8 });
  const levers = [];
  for (let i = 0; i < 2; i++) {
    const lev = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.55, 8), leverMat);
    lev.position.set(0.78 + i * 0.24, -0.5, 2.0); throttle.add(lev); levers.push(lev);
  }
  const flapLever = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.5, 8),
    new THREE.MeshStandardMaterial({ color: 0xc98a2e, roughness: 0.4, metalness: 0.6 }));
  flapLever.position.set(1.25, -0.5, 2.2); throttle.add(flapLever);
  group.add(throttle);
  // six steam gauges on canvas textures
  const gauges = {};
  const defs = [
    ['kias', 1.45, 0.18], ['att', 0.87, 0.18], ['alt', 0.29, 0.18],
    ['vsi', -0.29, 0.18], ['hsi', -0.87, 0.18], ['eng', -1.45, 0.18],
  ];
  for (const [name, x, y] of defs) {
    const [c, ctx] = gaugeCanvas(256, 256);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshBasicMaterial({ map: tex });
    const bezel = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.04, 10, 24),
      new THREE.MeshStandardMaterial({ color: 0x8a7a4a, roughness: 0.35, metalness: 0.85 }));
    bezel.position.set(x, y, 2.70);
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.27, 24), mat);
    face.position.set(x, y, 2.68);
    face.rotation.y = Math.PI; // face the pilot, not the nose
    group.add(bezel, face);
    gauges[name] = { canvas: c, ctx, tex };
  }
  // MFD: moving map + weather radar
  const [mfdC, mfdCtx] = gaugeCanvas(512, 320);
  const mfdTex = new THREE.CanvasTexture(mfdC);
  mfdTex.colorSpace = THREE.SRGBColorSpace;
  const mfd = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.85),
    new THREE.MeshBasicMaterial({ map: mfdTex }));
  mfd.position.set(0, -0.55, 2.68); mfd.rotation.set(-0.12, Math.PI, 0); // face the pilot
  group.add(mfd);
  const mfdFrame = new THREE.Mesh(new THREE.BoxGeometry(1.85, 1.0, 0.08), pillarMat);
  mfdFrame.position.set(0, -0.55, 2.72); mfdFrame.rotation.x = -0.12;
  group.add(mfdFrame);
  group.visible = false;
  scene.add(group);
  return {
    group, yoke, levers, flapLever, gauges, mfdCanvas: mfdC, mfdCtx, mfdTex,
    setVisible(v) { group.visible = v; },
    update(S, F, ils, dt, time) {
      if (!group.visible) return;
      drawKias(gauges.kias, S.airspeedKt, S);
      drawAttitude(gauges.att, S.pitchDeg, S.rollDeg);
      drawAltimeter(gauges.alt, S.pos.y);
      drawVsi(gauges.vsi, S.vsiFpm);
      drawHsi(gauges.hsi, S.headingDeg, ils);
      drawEngines(gauges.eng, F);
      drawMfd(mfdCtx, mfdC, S, ils, time);
      mfdTex.needsUpdate = true;
      for (const k in gauges) gauges[k].tex.needsUpdate = true;
      // yoke follows the stick
      yoke.rotation.x = clamp(-S.pitchDeg * 0.01, -0.3, 0.3);
      yoke.rotation.z = clamp(S.rollDeg * 0.008, -0.4, 0.4);
      levers.forEach((l) => { l.rotation.x = -0.5 + S.throttle * 0.9; });
      flapLever.rotation.x = -0.4 + S.flapDeg * 0.02;
    },
  };
}

function drawKias(g, kt, S) {
  const { ctx } = g;
  roundGauge(ctx, 128, 128, 118, 'KIAS', 'AIRSPEED');
  // colour arcs: white flap range, green normal, yellow caution, red line
  ctx.lineWidth = 10;
  const a = (v) => -2.1 + (v / 200) * 4.2;
  ctx.strokeStyle = '#f2ead8'; ctx.beginPath(); ctx.arc(128, 128, 100, a(48), a(110)); ctx.stroke();
  ctx.strokeStyle = '#3fae5a'; ctx.beginPath(); ctx.arc(128, 128, 100, a(58), a(150)); ctx.stroke();
  ctx.strokeStyle = '#e8b93a'; ctx.beginPath(); ctx.arc(128, 128, 100, a(150), a(165)); ctx.stroke();
  ctx.strokeStyle = '#d23a2a'; ctx.beginPath(); ctx.arc(128, 128, 100, a(165), a(168)); ctx.stroke();
  ticks(ctx, 128, 128, 118, 9, -2.1, 2.1, [0, 25, 50, 75, 100, 125, 150, 175, 200]);
  needle(ctx, 128, 128, a(clamp(kt, 0, 200)), 92, '#ff5a3a', 5);
  if (S && S.stall) { ctx.fillStyle = '#ff3020'; ctx.font = 'bold 22px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('STALL', 128, 190); }
}
function drawAttitude(g, pitchDeg, rollDeg) {
  const { ctx } = g;
  roundGauge(ctx, 128, 128, 118, 'ATTITUDE', 'ARTIFICIAL HORIZON');
  ctx.save();
  ctx.beginPath(); ctx.arc(128, 128, 112, 0, 7); ctx.clip();
  ctx.translate(128, 128); ctx.rotate(-rollDeg * Math.PI / 180);
  ctx.translate(0, -clamp(pitchDeg, -30, 30) * 2.2);
  ctx.fillStyle = '#3a6ea8'; ctx.fillRect(-130, -260, 260, 260);
  ctx.fillStyle = '#a8763e'; ctx.fillRect(-130, 0, 260, 260);
  ctx.fillStyle = '#f2ead8'; ctx.fillRect(-130, -2, 260, 4);
  ctx.restore();
  ctx.strokeStyle = '#f2ead8'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(128, 118); ctx.lineTo(128, 138); ctx.moveTo(96, 128); ctx.lineTo(160, 128); ctx.stroke();
  ctx.fillStyle = '#ff5a3a'; ctx.beginPath(); ctx.moveTo(128, 128); ctx.arc(128, 128, 7, 0, 7); ctx.fill();
}
function drawAltimeter(g, altM) {
  const { ctx } = g;
  const ft = altM * 3.28084;
  roundGauge(ctx, 128, 128, 118, 'ALT', 'FEET · BARO 1014');
  ticks(ctx, 128, 128, 118, 11, -2.1, 2.1, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0]);
  const hundreds = (ft / 100) % 10;
  needle(ctx, 128, 128, -2.1 + (hundreds / 10) * 4.2, 92, '#f2ead8', 5);
  needle(ctx, 128, 128, -2.1 + ((ft / 1000) % 10 / 10) * 4.2, 55, '#c9a85a', 4);
  ctx.fillStyle = '#101216'; ctx.fillRect(88, 150, 80, 26);
  ctx.fillStyle = '#7ee2a0'; ctx.font = 'bold 20px monospace'; ctx.textAlign = 'center';
  ctx.fillText(String(Math.round(ft)).padStart(4, '0'), 128, 170);
}
function drawVsi(g, fpm) {
  const { ctx } = g;
  roundGauge(ctx, 128, 128, 118, 'VSI', 'FT / MIN');
  ticks(ctx, 128, 128, 118, 9, -2.1, 2.1, [2, 1.5, 1, 0.5, 0, 0.5, 1, 1.5, 2]);
  const v = clamp(fpm / 1000, -2, 2);
  needle(ctx, 128, 128, v * 1.05, 92, '#f2ead8', 5);
}
function drawHsi(g, hdg, ils) {
  const { ctx } = g;
  roundGauge(ctx, 128, 128, 118, 'HSI', 'HDG · ILS 09');
  // compass rose
  ctx.fillStyle = '#e8e4d2'; ctx.font = 'bold 18px sans-serif'; ctx.textAlign = 'center';
  const dirs = ['N', '03', '06', 'E', '12', '15', 'S', '21', '24', 'W', '30', '33'];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 - hdg * Math.PI / 180;
    const x = 128 + Math.sin(a) * 82, y = 128 - Math.cos(a) * 82 + 6;
    ctx.fillText(dirs[i], x, y);
  }
  // CDI needles: localizer vertical, glideslope horizontal
  ctx.strokeStyle = '#ff5a3a'; ctx.lineWidth = 4;
  const locX = 128 + clamp(ils.locDevDots, -2, 2) * 34;
  ctx.beginPath(); ctx.moveTo(locX, 40); ctx.lineTo(locX, 216); ctx.stroke();
  ctx.strokeStyle = '#7ee2a0';
  const gsY = 128 + clamp(ils.gsDevDots, -2, 2) * 34;
  ctx.beginPath(); ctx.moveTo(40, gsY); ctx.lineTo(216, gsY); ctx.stroke();
  // lubber line + heading bug
  ctx.fillStyle = '#f7c948';
  ctx.beginPath(); ctx.moveTo(128, 16); ctx.lineTo(120, 32); ctx.lineTo(136, 32); ctx.fill();
  ctx.fillStyle = '#f2ead8'; ctx.font = 'bold 20px monospace';
  ctx.fillText(String(Math.round(hdg)).padStart(3, '0') + '°', 128, 200);
}
function drawEngines(g, F) {
  const { ctx } = g;
  roundGauge(ctx, 128, 128, 118, 'ENG', 'RPM · CHT · FF');
  const rows = [
    ['ENG 1', F.rpm[0] || 0, F.chtC[0] || 150],
    ['ENG 2', F.rpm[1] || 0, F.chtC[1] || 150],
  ];
  ctx.font = 'bold 17px monospace'; ctx.textAlign = 'left';
  rows.forEach((r, i) => {
    const y = 84 + i * 58;
    ctx.fillStyle = r[2] > 245 ? '#ff3020' : '#e8e4d2';
    ctx.fillText(r[0], 28, y);
    ctx.fillStyle = '#7ee2a0';
    ctx.fillText(String(r[1]).padStart(4, '0'), 100, y);
    ctx.fillText(String(Math.round(r[2])) + '°C', 168, y);
  });
  ctx.fillStyle = '#9aa0a8'; ctx.font = '14px sans-serif';
  ctx.fillText('FUEL FLOW ' + (F.burnGalPerHr ? F.burnGalPerHr.toFixed(1) : '0.0') + ' GPH', 28, 210);
  ctx.fillText('FUEL ' + (F.fuelGal !== undefined ? F.fuelGal.toFixed(1) : '—') + ' GAL', 28, 232);
}

export function drawMfd(ctx, canvas, S, ils, time) {
  const W = canvas.width, H = canvas.height;
  ctx.fillStyle = '#0a1410'; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#1d5a3a'; ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 32) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y < H; y += 32) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  // coastline sketch: east sea is right of the line
  ctx.strokeStyle = '#3fd4c0'; ctx.lineWidth = 3;
  ctx.beginPath();
  for (let z = -300; z <= 300; z += 20) {
    const x = 300 + Math.sin(z * 0.01 + 1.1) * 40;
    const y = 160 + z * 0.5;
    if (z === -300) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();
  // airfields
  ctx.font = 'bold 15px monospace'; ctx.textAlign = 'left';
  for (const f of AIRFIELDS) {
    const mx = 256 + (f.x / 12000) * 480;
    const my = 160 + (f.z / 12000) * 300;
    ctx.fillStyle = f.id === 'bellavista' ? '#ffd24a' : '#7ee2a0';
    ctx.beginPath(); ctx.arc(mx, my, 5, 0, 7); ctx.fill();
    ctx.fillStyle = '#cfe8d8';
    ctx.fillText(f.rwy, mx + 8, my + 5);
  }
  // storm cells (green/yellow/red) when active
  if (S.stormActive) {
    const cells = [[390, 90, 46, '#ff3020'], [330, 130, 30, '#ffd24a'], [430, 160, 26, '#3fae5a']];
    for (const [x, y, r, col] of cells) {
      ctx.fillStyle = col; ctx.globalAlpha = 0.75;
      ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = '#ff3020'; ctx.font = 'bold 16px monospace';
    ctx.fillText('MISTRAL SQUALL', 300, 40);
  }
  // ownship + ILS line
  const ox = 256 + (S.pos.x / 12000) * 480;
  const oy = 160 + (S.pos.z / 12000) * 300;
  ctx.strokeStyle = '#ffd24a'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(180, 160); ctx.lineTo(256, 160); ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.save(); ctx.translate(ox, oy); ctx.rotate(S.headingDeg * Math.PI / 180);
  ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(6, 7); ctx.lineTo(-6, 7); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#7ee2a0'; ctx.font = 'bold 16px monospace';
  ctx.fillText('MAP · ILS 09 · GS ' + ils.gsDevDots.toFixed(1) + ' · LOC ' + ils.locDevDots.toFixed(1), 12, 24);
  ctx.fillText('HDG ' + String(Math.round(S.headingDeg)).padStart(3, '0') + '°  ALT ' + Math.round(S.pos.y * 3.28) + ' FT', 12, H - 12);
}
