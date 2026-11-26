// landingDebrief.js — landings and crashes that read as what happened:
// touchdown telemetry, a grade, and a clean instant retry.
import { centerlineOffsetM } from './aerodynamics6dof.js';

export function gradeLanding(td, centerM, crabDeg) {
  const fpm = Math.abs(td.fpm);
  let score = 100;
  score -= Math.max(0, fpm - 120) * 0.12;
  score -= Math.max(0, centerM - 1) * 6;
  score -= Math.max(0, crabDeg - 2) * 4;
  score -= Math.max(0, Math.abs(td.kt - 85)) * 0.2;
  score = Math.max(0, Math.round(score));
  const grade = score >= 92 ? 'PRECISION LANDING' : score >= 78 ? 'GOOD LANDING'
    : score >= 60 ? 'ACCEPTABLE LANDING' : 'ROUGH LANDING';
  return { score, grade };
}

export function showDebrief(S, D, sortie) {
  const centerM = centerlineOffsetM(S);
  const td = S.touchdown || { fpm: 0, kt: 0 };
  const crab = Math.abs(S.touchdownCrab || 0);
  const g = gradeLanding(td, centerM, crab);
  const el = document.getElementById('debrief');
  el.style.display = 'block';
  el.innerHTML = `
    <div class="panel-title">LANDING TELEMETRY — ${sortie ? sortie.name : 'FREE FLIGHT'}</div>
    <div class="debrief-grid">
      <div><span>TOUCHDOWN</span><b>${td.fpm > 0 ? '-' : ''}${Math.abs(td.fpm)} FPM</b></div>
      <div><span>CENTERLINE</span><b>${centerM.toFixed(1)} M</b></div>
      <div><span>CRAB ANGLE</span><b>${crab.toFixed(1)}°</b></div>
      <div><span>AIRSPEED</span><b>${td.kt} KT</b></div>
      <div><span>AIRFRAME</span><b>${D.overall}%</b></div>
      <div><span>FUEL REMAINING</span><b>${S.fuelGal.toFixed(1)} GAL</b></div>
    </div>
    <div class="debrief-grade">${g.grade} · ${g.score}/100</div>
    <div class="debrief-hint">Press ENTER to fly again — same sortie, fresh aircraft</div>`;
  return g;
}

export function showIncident(S, reason) {
  const el = document.getElementById('debrief');
  el.style.display = 'block';
  el.innerHTML = `
    <div class="panel-title" style="color:#ff6a55">POST-FLIGHT INCIDENT REPORT</div>
    <div class="incident-reason">${reason}</div>
    <div class="debrief-grid">
      <div><span>ALTITUDE</span><b>${Math.round(S.pos.y * 3.28)} FT</b></div>
      <div><span>AIRSPEED</span><b>${Math.round(S.airspeedKt)} KT</b></div>
      <div><span>FUEL</span><b>${S.fuelGal.toFixed(1)} GAL</b></div>
      <div><span>FLIGHT TIME</span><b>${Math.round(S.timeS)} S</b></div>
    </div>
    <div class="debrief-hint">Press ENTER for an instant retry — clean aircraft, same sortie</div>`;
}

export function hideDebrief() {
  document.getElementById('debrief').style.display = 'none';
}
