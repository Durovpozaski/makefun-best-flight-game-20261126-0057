// hudInstruments.js — collimated aviation HUD: thin, legible, never a white
// box over the sky. Speed tape, altitude tape, heading compass, velocity
// vector, ILS diamonds, VSI, wind, trim/flaps/gear, fuel/CHT, mini map.
import { clamp } from './config.js';

export function buildHud() {
  const hud = document.getElementById('hud');
  const el = (id) => document.getElementById(id);
  return {
    hud,
    setVisible(v) { hud.style.display = v ? 'block' : 'none'; },
    update(S, F, D, ils, sortie, weather) {
      el('hud-ias').textContent = String(Math.round(S.airspeedKt)).padStart(3, '0');
      el('hud-alt').textContent = String(Math.round(S.pos.y * 3.28084)).padStart(5, '0');
      el('hud-hdg').textContent = String(Math.round(S.headingDeg)).padStart(3, '0');
      el('hud-vsi').textContent = (S.vsiFpm >= 0 ? '+' : '') + Math.round(S.vsiFpm);
      el('hud-wind').textContent = `${Math.round(weather.windDirDeg)}°/${Math.round(weather.windKt)}KT`;
      el('hud-trim').textContent = (S.trim >= 0 ? '+' : '') + S.trim.toFixed(1);
      el('hud-flaps').textContent = S.flapDeg.toFixed(0) + '°';
      el('hud-gear').textContent = S.gearDown ? 'DOWN' : 'UP';
      el('hud-gear').style.color = S.gearDown ? '#7ee2a0' : '#ffd24a';
      el('hud-fuel').textContent = F.fuelGal.toFixed(1) + ' GAL';
      el('hud-endurance').textContent = F.enduranceMin >= 999 ? '—' : Math.round(F.enduranceMin) + ' MIN';
      el('hud-cht').textContent = Math.round(Math.max(F.chtC[0], F.chtC[1])) + '°C';
      el('hud-cht').style.color = F.overheat ? '#ff5040' : '#e8f2ff';
      el('hud-rpm').textContent = String(F.rpm[0] || 0);
      el('hud-stab').textContent = S.stabilityAssist ? 'STAB ON' : 'STAB OFF';
      el('hud-sortie').textContent = sortie ? sortie.name : 'FREE FLIGHT';
      el('hud-objective').textContent = sortie ? sortie.objective : 'Fly the Adriatic coast — land on Runway 09';
      // warnings
      const warns = [];
      if (F.reserveWarn) warns.push('LOW FUEL RESERVE · ENDURANCE ' + Math.round(F.enduranceMin) + ' MIN');
      if (F.overheat) warns.push('ENGINE #2 CHT HIGH');
      if (S.stall) warns.push('STALL — LOWER NOSE, FULL POWER');
      if (S.onWater && S.gearDown) warns.push('GEAR WARNING — RETRACT FOR WATER LANDING');
      if (S.flapStage > 0 && S.airspeedKt > (S.flapStage === 1 ? 140 : 110)) warns.push('FLAP OVERSPEED');
      if (S.stormActive) warns.push('DIVERT ISOLA BIANCA 2.8 NM');
      const wEl = el('hud-warnings');
      wEl.innerHTML = warns.map((w) => `<div class="warn">⚠ ${w}</div>`).join('');
      // ILS diamonds
      const locEl = el('hud-loc');
      const gsEl = el('hud-gs');
      if (ils.onApproach) {
        locEl.style.display = 'block'; gsEl.style.display = 'block';
        locEl.style.left = `calc(50% + ${clamp(ils.locDevDots, -2.5, 2.5) * 46}px)`;
        gsEl.style.top = `calc(50% + ${clamp(ils.gsDevDots, -2.5, 2.5) * 46}px)`;
      } else { locEl.style.display = 'none'; gsEl.style.display = 'none'; }
      el('hud-ils').textContent = ils.onApproach
        ? `ILS 09 · LOC ${ils.locDevDots >= 0 ? '+' : ''}${ils.locDevDots.toFixed(1)} · GS ${ils.gsDevDots >= 0 ? '+' : ''}${ils.gsDevDots.toFixed(1)}`
        : 'ILS 09 · OUT OF RANGE';
      el('hud-papi').textContent = ils.onApproach ? papiText(ils) : 'PAPI —';
      el('hud-damage').textContent = 'AIRFRAME ' + D.overall + '%';
      drawMiniMap(S, ils);
    },
  };
}

function papiText(ils) {
  const a = ils.gsAngle;
  const w = a > 3.35 ? 4 : a > 3.15 ? 3 : a > 2.85 ? 2 : a > 2.65 ? 1 : 0;
  return 'PAPI ' + '●'.repeat(w) + '○'.repeat(4 - w) + (w === 2 ? ' ON GLIDE' : w > 2 ? ' HIGH' : ' LOW');
}

export function drawMiniMap(S, ils) {
  const c = document.getElementById('minimap');
  if (!c) return;
  const ctx = c.getContext('2d');
  const W = c.width, H = c.height;
  ctx.fillStyle = 'rgba(8,20,16,0.82)'; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#3fd4c0'; ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let z = -H; z <= H; z += 8) {
    const x = W * 0.62 + Math.sin(z * 0.05 + 1.1) * 14;
    const y = H / 2 + z * 0.5;
    if (z === -H) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();
  const airfields = [
    { x: 0, z: 0, r: '09' }, { x: 3500, z: -2500, r: '14' },
    { x: 2500, z: 2800, r: '32W' }, { x: -4200, z: -3800, r: '21' },
    { x: 5200, z: 3500, r: 'FARO' },
  ];
  ctx.font = 'bold 11px monospace'; ctx.textAlign = 'left';
  for (const f of airfields) {
    const mx = W / 2 + (f.x / 12000) * W * 0.95;
    const my = H / 2 + (f.z / 12000) * H * 0.95;
    ctx.fillStyle = '#ffd24a'; ctx.beginPath(); ctx.arc(mx, my, 3, 0, 7); ctx.fill();
    ctx.fillStyle = '#cfe8d8'; ctx.fillText(f.r, mx + 5, my + 4);
  }
  const ox = W / 2 + (S.pos.x / 12000) * W * 0.95;
  const oy = H / 2 + (S.pos.z / 12000) * H * 0.95;
  ctx.fillStyle = '#ffffff';
  ctx.save(); ctx.translate(ox, oy); ctx.rotate(S.headingDeg * Math.PI / 180);
  ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(4, 5); ctx.lineTo(-4, 5); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#7ee2a0'; ctx.font = 'bold 10px monospace';
  ctx.fillText('MAP · RWY 09 ILS', 6, 12);
}
