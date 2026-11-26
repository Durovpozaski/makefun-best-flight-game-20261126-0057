// missionSorties.js — eight campaign sorties with distinct goals, weather
// and diversions. Completing the objective raises the debrief grade.
import { AIRFIELDS } from './config.js';

export const SORTIES = [
  { id: 1, name: 'SORTIE 1 — BELLAVISTA COASTAL CHECKRIDE',
    objective: 'Take off RWY 09, fly the harbour circuit, land RWY 09 on the PAPI',
    airfield: 'bellavista', aircraft: 'albatro', windKt: 12, storm: false,
    fuelGal: 110, target: { type: 'land', field: 'bellavista' } },
  { id: 2, name: 'SORTIE 2 — CALA MARINA SEAPLANE SHUTTLE',
    objective: 'Water-landing in Cala Marina bay — gear UP — then water take-off',
    airfield: 'bellavista', aircraft: 'albatro', windKt: 8, storm: false,
    fuelGal: 90, target: { type: 'water', field: 'marina' } },
  { id: 3, name: 'SORTIE 3 — ISOLA BIANCA CLIFFSIDE CARGO',
    objective: 'Short-field full-flaps landing on RWY 14, the cliffside strip',
    airfield: 'bellavista', aircraft: 'albatro', windKt: 14, storm: false,
    fuelGal: 100, target: { type: 'land', field: 'bianca' } },
  { id: 4, name: 'SORTIE 4 — MISTRAL 24 KT CROSSWIND APPROACH',
    objective: 'Crab-and-decrab landing on RWY 09 in a 24 KT crosswind',
    airfield: 'bellavista', aircraft: 'albatro', windKt: 24, storm: false,
    fuelGal: 100, target: { type: 'land', field: 'bellavista' } },
  { id: 5, name: 'SORTIE 5 — LOW-CEILING ILS RECOVERY',
    objective: 'Fly the ILS needles through sea fog to a PAPI landing on RWY 09',
    airfield: 'bellavista', aircraft: 'albatro', windKt: 12, storm: false, fog: true,
    fuelGal: 100, target: { type: 'land', field: 'bellavista' } },
  { id: 6, name: 'SORTIE 6 — ENGINE #2 OVERHEAT & FUEL DIVERSION',
    objective: 'Engine #2 is overheating and fuel is short — divert to Isola Bianca 2.8 NM',
    airfield: 'bellavista', aircraft: 'albatro', windKt: 16, storm: true,
    fuelGal: 26, target: { type: 'land', field: 'bianca' } },
  { id: 7, name: 'SORTIE 7 — MONTE CORVO RIDGE MEDEVAC',
    objective: 'High-altitude delivery to the gravel ridge strip RWY 21',
    airfield: 'bellavista', aircraft: 'libeccio', windKt: 18, storm: false,
    fuelGal: 62, target: { type: 'land', field: 'corvo' } },
  { id: 8, name: 'SORTIE 8 — ADRIATIC DUSK GRAND CIRCUIT',
    objective: 'Multi-airfield navigation: Bianca, Marina, Corvo, then a precision ILS landing on RWY 09',
    airfield: 'bellavista', aircraft: 'sirocco', windKt: 12, storm: false,
    fuelGal: 200, target: { type: 'land', field: 'bellavista' } },
];

export function getSortie(id) { return SORTIES.find((s) => s.id === id) || SORTIES[0]; }
export function getAirfield(id) { return AIRFIELDS.find((f) => f.id === id) || AIRFIELDS[0]; }

export function checkSortieObjective(S, sortie) {
  if (!sortie || !S.touchdown) return null;
  const t = sortie.target;
  const f = getAirfield(t.field);
  const dx = S.pos.x - f.x, dz = S.pos.z - f.z;
  const dist = Math.hypot(dx, dz);
  const onTarget = t.type === 'land' ? dist < f.lengthM : dist < 900;
  if (!onTarget) return null;
  return { complete: true, field: f.name, touchdown: S.touchdown };
}
