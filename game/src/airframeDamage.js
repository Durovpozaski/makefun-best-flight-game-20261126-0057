// airframeDamage.js — structural limits: hard touchdowns, flap overspeed,
// gear overspeed, overheat. Damage accumulates and is shown, never hidden.
import { clamp } from './config.js';

export function createDamage() {
  return { gear: 100, airframe: 100, flaps: 100, engine2: 100, notes: [] };
}

export function stepDamage(D, S, F, dt) {
  const notes = D.notes;
  const addNote = (t) => { if (!notes.includes(t)) notes.push(t); };
  // flap overspeed
  const limit = S.flapStage === 1 ? 140 : S.flapStage === 2 ? 110 : 999;
  if (S.airspeedKt > limit && S.flapStage > 0) {
    D.flaps = Math.max(0, D.flaps - dt * 6);
    addNote('FLAPS OVERSPEED — reduce speed or retract flaps');
  }
  // gear overspeed
  if (S.gearDown && S.airspeedKt > 150) {
    D.gear = Math.max(0, D.gear - dt * 3);
    addNote('GEAR OVERSPEED — retract gear above 150 KT');
  }
  // overheat damages engine 2 first (sortie 6 emergency)
  if (F.overheat) {
    D.engine2 = Math.max(0, D.engine2 - dt * 2.5);
    addNote('ENGINE #2 CHT HIGH — reduce power');
  }
  // hard touchdown damage is applied by the landing event, not per-frame
  if (S.touchdown && S.touchdown.fpm > 500) {
    D.gear = Math.max(0, D.gear - (S.touchdown.fpm - 500) / 12);
    D.airframe = Math.max(0, D.airframe - (S.touchdown.fpm - 500) / 25);
    addNote('HARD TOUCHDOWN — airframe inspected, gear damaged');
    S.touchdown = null;
  }
  D.overall = Math.round((D.gear + D.airframe + D.flaps + D.engine2) / 4);
  return D;
}
