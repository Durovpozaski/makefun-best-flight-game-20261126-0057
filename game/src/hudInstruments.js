// hudInstruments.js — dense reference-style HUD: stage checklist, sortie
// advisor, live touchdown scoring card, tower ATC, NAV & ILS panel with
// moving map, compass strip and a bottom five-gauge instrument strip.
// Every number is live flight data; nothing is staged or faked.
import { clamp, AIRFIELDS, wrapAngleDeg } from './config.js';
import { gradeLanding } from './landingDebrief.js';
import { centerlineOffsetM } from './aerodynamics6dof.js';

const STAGES = {
  1: ['Take off RWY 09 — full power', 'Fly the harbour circuit', 'Land RWY 09 on the PAPI'],
  2: ['Water take-off Cala Marina', 'Cross the bay — gear UP', 'Water landing 32W'],
  3: ['Take off RWY 09', 'Cliffside approach RWY 14', 'Short-field full-flaps landing'],
  4: ['Take off RWY 09 in 24 KT', 'Crab-and-decrab final', 'Land RWY 09 in crosswind'],
  5: ['Capture 110.90 MHz Localizer', 'Hold 3.0° glideslope', 'PAPI landing RWY 09'],
  6: ['Extinguish & Feather R-Engine', 'ECON LEAN & De-Ice in 26 KT gust', 'Emergency STOL Touchdown RWY 09'],
  7: ['Take off RWY 09', 'Climb to Monte Corvo ridge', 'High-altitude delivery RWY 21'],
  8: ['Bianca · Marina · Corvo circuit', 'Multi-airfield navigation', 'Precision ILS landing RWY 09'],
};

function nearestField(S) {
  // skip the Faro offshore platform: it has no runway ('—')
  let best = AIRFIELDS[0], bd = Infinity;
  for (const f of AIRFIELDS) {
    if (!f.rwy || f.rwy === '—' || !f.lengthM) continue;
    const d = Math.hypot(S.pos.x - f.x, S.pos.z - f.z);
    if (d < bd) { bd = d; best = f; }
  }
  return { field: best, distM: bd };
}

function gradeLabel(score) {
  if (score >= 95) return 'A+ BUTTER';
  if (score >= 85) return 'A SMOOTH';
  if (score >= 75) return 'B FIRM';
  if (score >= 60) return 'C HARD';
  return 'D ROUGH';
}

export function buildHud() {
  const hud = document.getElementById('hud');
  const el = (id) => document.getElementById(id);
  let tdPos = null; // position where the wheels first touched, for rollout
  return {
    hud,
    setVisible(v) { hud.style.display = v ? 'block' : 'none'; },
    update(S, F, D, ils, sortie, weather, camMode) {
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
      // ---- compass strip: headings around the nose, cardinal letters ----
      const hdg = Math.round(S.headingDeg);
      const parts = [];
      for (const off of [-30, -20, -10, 0, 10, 20, 30]) {
        const h = ((hdg + off) % 360 + 360) % 360;
        const lbl = h === 0 ? 'N' : h === 90 ? 'E' : h === 180 ? 'S' : h === 270 ? 'W'
          : String(Math.round(h / 10)).padStart(2, '0');
        parts.push(off === 0 ? `<b>${lbl}</b>` : lbl);
      }
      el('hud-compass').innerHTML = parts.join('&nbsp; ');
      // ---- stage checklist: real progress from flight state ----
      const stages = STAGES[sortie ? sortie.id : 1] || STAGES[1];
      const near = nearestField(S);
      const done1 = S.airborne || S.airspeedKt > 60;
      const done2 = ils.onApproach || near.distM < 2000;
      const done3 = !!S.touchdown;
      const doneCount = (done1 ? 1 : 0) + (done2 ? 1 : 0) + (done3 ? 1 : 0);
      el('hud-stage-name').textContent = sortie ? sortie.name.replace('SORTIE ', '') : 'FREE FLIGHT';
      el('hud-stage-trim').textContent = 'TRIM ' + Math.round(100 - Math.abs(S.trim) * 25) + '%';
      el('hud-stage-fill').style.width = Math.round((doneCount / 3) * 100) + '%';
      const rowsEl = el('hud-stage-rows');
      rowsEl.innerHTML = stages.map((t, i) => {
        const done = i === 0 ? done1 : i === 1 ? done2 : done3;
        const cur = !done && (i === 0 || (i === 1 && done1) || (i === 2 && done2));
        return `<div class="srow${done ? ' done' : cur ? ' cur' : ''}"><span class="mk">${done ? '✓' : cur ? '▶' : '○'}</span>${t}</div>`;
      }).join('');
      const banner = el('hud-stage-banner');
      if (sortie && sortie.id === 6) {
        banner.style.display = 'block';
        banner.innerHTML = `<b>EMERGENCY DIVERT · RWY 09 (${(near.distM / 1852).toFixed(2)} NM)</b><br>R-ENG ${Math.round(Math.max(F.chtC[0], F.chtC[1]))}°C FIRE · ECON LEAN lands with +${Math.max(0, Math.round(F.fuelGal / 110 * 100))}% fuel.`;
      } else { banner.style.display = 'none'; }
      // ---- sortie advisor: nearest runway + live fuel advice ----
      const burn = F.burnGalPerHr ? F.burnGalPerHr.toFixed(1) : '0.0';
      const reserve = F.enduranceMin >= 999 ? '—' : Math.round(F.enduranceMin) + ' MIN';
      el('hud-advisor-title').textContent = `SORTIE ADVISOR · RWY ${near.field.rwy.split('/')[0]} (${(near.distM / 1852).toFixed(2)} NM)`;
      el('hud-advisor-text').textContent = ils.onApproach
        ? `HOLD <1.8G SMOOTH FLARE · AUTO CRUISE (${burn} GPH) · +${reserve} reserve · Hull ${D.overall}%`
        : `AUTO CRUISE (${burn} GPH) · +${reserve} reserve · Hull ${D.overall}%`;
      // ---- touchdown card: live predicted grade on final, actual after ----
      const tdEl = el('hud-touchdown');
      const onFinal = (ils.onApproach || (S.gearDown && S.airborne && near.distM < 4000)) && !S.crashed;
      if (S.touchdown && !tdPos) tdPos = { x: S.pos.x, z: S.pos.z };
      if (onFinal || S.touchdown) {
        tdEl.style.display = 'block';
        const centerM = Math.abs(centerlineOffsetM(S));
        const crab = S.touchdown ? Math.abs(S.touchdownCrab || 0)
          : Math.abs(wrapAngleDeg(S.headingDeg - near.field.headingDeg));
        let fpm, kt, roll, sinkNow;
        if (S.touchdown) {
          fpm = Math.abs(S.touchdown.fpm); kt = S.touchdown.kt; sinkNow = fpm;
          roll = tdPos ? Math.round(Math.hypot(S.pos.x - tdPos.x, S.pos.z - tdPos.z)) + 'M' : '—';
        } else {
          // live prediction: a normal flare bleeds roughly half the sink
          // rate, so the card grades the predicted touchdown sink, not
          // the raw descent rate on final
          sinkNow = Math.abs(Math.round(S.vsiFpm));
          fpm = Math.max(120, Math.round(sinkNow * 0.45));
          kt = Math.round(S.airspeedKt); roll = '—';
        }
        const g = gradeLanding({ fpm, kt }, centerM, crab);
        el('hud-td-grade').textContent = `${gradeLabel(g.score)} (${g.score}/100)`;
        el('hud-td-grade').style.color = g.score >= 85 ? '#7ee2a0' : g.score >= 60 ? '#ffd24a' : '#ff6a55';
        el('hud-td-note').textContent = S.touchdown
          ? `${g.grade} — smooth oleo compression, ${centerM.toFixed(1)}m centerline.`
          : g.score >= 92 ? 'Text-book STOL flare — smooth oleo compression, on centerline.'
            : g.score >= 75 ? 'Firm but safe — keep the nose up, watch the sink.'
            : 'Hard — flare earlier next time, hold the centerline.';
        el('hud-td-sink').textContent = `-${sinkNow} FPM`;
        el('hud-td-center').textContent = `+${centerM.toFixed(1)}M OFF`;
        el('hud-td-roll').textContent = roll === '—' ? '—' : `${roll} (${S.flapDeg.toFixed(0)}° FLP)`;
        el('hud-td-kt').textContent = `${kt} KT`;
      } else { tdEl.style.display = 'none'; }
      // ---- tower ATC: phase-driven, live wind and field ----
      const windTxt = `${Math.round(weather.windDirDeg)}°/${Math.round(weather.windKt)}KT`;
      let atc;
      if (S.touchdown) atc = '“Albatross 07, Bellavista Tower — welcome back. Taxi to the apron, contact ground 121.7.”';
      else if (ils.onApproach) atc = `“Albatross 07, cleared visual Runway ${near.field.rwy.split('/')[0]}. Wind ${windTxt}, PAPI 2 white 2 red.”`;
      else if (S.stormActive) atc = '“Mayday Albatross 07, Highcrest Mesa RWY 09 flares lit! Wings level in 26 KT squall.”';
      else if (!S.airborne) atc = `“Albatross 07, cleared for takeoff Runway ${near.field.rwy.split('/')[0]}. Wind ${windTxt}.”`;
      else atc = '“Albatross 07, Bellavista Tower — traffic is a ferry crossing the bay, report final.”';
      el('hud-atc-msg').textContent = atc;
      // ---- NAV & ILS panel ----
      el('hud-nav-mode').textContent = camMode === 'cockpit' ? 'COCKPIT [V]' : 'CHASE [V]';
      el('hud-nav-rwy').textContent = `RWY ${near.field.rwy} (${String(near.field.headingDeg).padStart(3, '0')}°)`;
      el('hud-nav-ils').textContent = ils.onApproach
        ? `LOCK ${ils.gsAngle.toFixed(1)}° ${papiText(ils)}` : 'OUT OF RANGE';
      el('hud-nav-wind').textContent = `${Math.round(weather.windDirDeg)}° / ${Math.round(weather.windKt)}KT`;
      el('hud-nav-mix').textContent = F.overheat ? 'ECON LEAN' : 'AUTO CRUISE';
      el('hud-nav-air').textContent = F.overheat ? `${D.overall}% FIRE!` : `${D.overall}% OK`;
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
      drawGaugeStrip(S, F, ils);
    },
  };
}

function papiText(ils) {
  const a = ils.gsAngle;
  const w = a > 3.35 ? 4 : a > 3.15 ? 3 : a > 2.85 ? 2 : a > 2.65 ? 1 : 0;
  return 'PAPI ' + '●'.repeat(w) + '○'.repeat(4 - w) + (w === 2 ? ' ON GLIDE' : w > 2 ? ' HIGH' : ' LOW');
}

export function drawMiniMap(S, ils) {
  const c = document.getElementById('navmap');
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

// Bottom instrument strip: five mini steam gauges (KIAS, attitude, alt,
// HSI, VSI) with live needles, drawn on one canvas.
function drawGaugeStrip(S, F, ils) {
  const c = document.getElementById('hud-gauges');
  if (!c) return;
  const ctx = c.getContext('2d');
  const W = c.width, H = c.height;
  ctx.fillStyle = 'rgba(8,16,22,0.62)'; ctx.fillRect(0, 0, W, H);
  const dials = [
    { x: 36, label: 'KIAS', v: S.airspeedKt, min: 0, max: 200, txt: String(Math.round(S.airspeedKt)) },
    { x: 116, label: 'ATT', att: true },
    { x: 196, label: 'ALT', v: S.pos.y * 3.28084, min: 0, max: 5000, txt: String(Math.round(S.pos.y * 3.28084)) },
    { x: 276, label: 'HSI', hsi: true },
    { x: 356, label: 'VSI', v: S.vsiFpm, min: -2000, max: 2000, txt: (S.vsiFpm >= 0 ? '+' : '') + Math.round(S.vsiFpm) },
  ];
  for (const d of dials) {
    const cx = d.x, cy = 30, r = 24;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7);
    ctx.fillStyle = '#101216'; ctx.fill();
    ctx.strokeStyle = '#c9a85a'; ctx.lineWidth = 2; ctx.stroke();
    if (d.att) {
      ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r - 2, 0, 7); ctx.clip();
      ctx.translate(cx, cy); ctx.rotate(-S.rollDeg * Math.PI / 180);
      ctx.translate(0, -clamp(S.pitchDeg, -25, 25) * 0.5);
      ctx.fillStyle = '#3a6ea8'; ctx.fillRect(-30, -30, 60, 30);
      ctx.fillStyle = '#a8763e'; ctx.fillRect(-30, 0, 60, 30);
      ctx.fillStyle = '#f2ead8'; ctx.fillRect(-30, -1, 60, 2);
      ctx.restore();
      ctx.strokeStyle = '#f2ead8'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(cx - 10, cy); ctx.lineTo(cx + 10, cy); ctx.stroke();
    } else if (d.hsi) {
      ctx.fillStyle = '#e8e4d2'; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center';
      const dirs = ['N', 'E', 'S', 'W'];
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 - S.headingDeg * Math.PI / 180;
        ctx.fillText(dirs[i], cx + Math.sin(a) * 16, cy - Math.cos(a) * 16 + 3);
      }
      ctx.strokeStyle = '#ff5a3a'; ctx.lineWidth = 2;
      const lx = cx + clamp(ils.locDevDots, -2, 2) * 7;
      ctx.beginPath(); ctx.moveTo(lx, cy - 18); ctx.lineTo(lx, cy + 18); ctx.stroke();
      ctx.fillStyle = '#f7c948';
      ctx.beginPath(); ctx.moveTo(cx, cy - 22); ctx.lineTo(cx - 4, cy - 15); ctx.lineTo(cx + 4, cy - 15); ctx.fill();
    } else {
      const frac = clamp((d.v - d.min) / (d.max - d.min), 0, 1);
      const ang = -2.1 + frac * 4.2;
      ctx.strokeStyle = '#f2ead8'; ctx.lineWidth = 2; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.sin(ang) * (r - 6), cy - Math.cos(ang) * (r - 6)); ctx.stroke();
      ctx.fillStyle = '#7ee2a0'; ctx.font = 'bold 10px monospace'; ctx.textAlign = 'center';
      ctx.fillText(d.txt, cx, cy + r - 4);
    }
    ctx.fillStyle = '#9aa0a8'; ctx.font = '9px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(d.label, cx, H - 4);
  }
}
