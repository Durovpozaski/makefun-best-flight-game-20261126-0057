// propulsionFuel.js — fuel burn, endurance vs headwind, CHT / oil temperature.
// Throttle economy is a real decision: burn too much and the diversion
// to Isola Bianca becomes the only way home. Ram air cools the heads:
// the faster the airflow, the quicker CHT and oil shed heat.
import { clamp } from './config.js';

export function createFuelSystem(spec, fuelGal) {
  return {
    fuelGal, spec,
    burnGalPerHr: 0, enduranceMin: 999,
    chtC: [150, 150], oilC: [80, 80],
    overheat: false, lowFuel: false, reserveWarn: false,
    rpm: [0, 0],
  };
}

export function stepFuel(F, S, dt, weather) {
  const spec = F.spec;
  // burn: ~ idle 6 gph, cruise 22 gph/engine prop, jet 90 gph/engine
  const base = spec.prop ? 22 : 95;
  const burn = spec.engines * (4 + (base - 4) * Math.pow(S.throttle, 1.6));
  F.burnGalPerHr = burn;
  F.fuelGal = Math.max(0, F.fuelGal - (burn / 3600) * dt);
  S.fuelGal = F.fuelGal;
  // endurance vs headwind: ground speed shortfall eats range
  const headwindKt = Math.max(0, weather.windKt * Math.cos(((weather.windDirDeg - S.headingDeg) * Math.PI) / 180));
  const gsKt = Math.max(20, S.airspeedKt - headwindKt);
  const nmPerGal = gsKt / Math.max(burn, 1);
  F.enduranceMin = F.fuelGal > 0 ? (F.fuelGal / Math.max(burn, 0.1)) * 60 : 0;
  F.rangeNm = F.fuelGal * nmPerGal;
  F.lowFuel = F.fuelGal < spec.fuelGal * 0.18;
  F.reserveWarn = F.enduranceMin < 13 && F.enduranceMin > 0;
  // engine temperatures: over-throttle cooks the heads; ram air sheds the heat
  const airflow = 1 + S.airspeedKt / 120;
  for (let i = 0; i < spec.engines; i++) {
    const target = 150 + S.throttle * 130 + (S.throttle > 0.9 ? 55 : 0) - S.airspeedKt * 0.25;
    F.chtC[i] += clamp(target - F.chtC[i], -dt * 4 * airflow, dt * 3);
    F.oilC[i] += clamp((88 + S.throttle * 30) - F.oilC[i], -dt * 2 * airflow, dt * 1.5);
    F.rpm[i] = Math.round(600 + S.throttle * 1900 + (S.airspeedKt > 60 ? 60 : 0));
  }
  F.overheat = F.chtC.some((c) => c > 245);
  return F;
}
