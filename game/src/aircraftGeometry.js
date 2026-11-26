// aircraftGeometry.js — the three hangar aircraft, built from primitives with
// PBR livery: MC-18 ALBATRO amphibian, SR-4 LIBECCIO, LJ-22 SIROCCO jet.
// Control surfaces, props, gear and lights are kept as named refs so the
// physics and camera code can move them every frame.
import * as THREE from 'three';

function propAssembly(radius) {
  const g = new THREE.Group();
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.5, 10),
    new THREE.MeshStandardMaterial({ color: 0x2a2d30, roughness: 0.4, metalness: 0.6 }));
  hub.rotation.x = Math.PI / 2; g.add(hub);
  const bladeMat = new THREE.MeshStandardMaterial({ color: 0x1c1e20, roughness: 0.35, metalness: 0.5 });
  for (let i = 0; i < 3; i++) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.28, radius, 0.09), bladeMat);
    blade.position.y = radius / 2;
    const holder = new THREE.Group();
    holder.rotation.z = (i * Math.PI * 2) / 3;
    holder.add(blade);
    g.add(holder);
  }
  const disc = new THREE.Mesh(new THREE.CircleGeometry(radius, 24),
    new THREE.MeshBasicMaterial({ color: 0x999999, transparent: true, opacity: 0.10, side: THREE.DoubleSide, depthWrite: false }));
  g.add(disc);
  return g;
}

function navLightSet(wingSpan) {
  const g = new THREE.Group();
  const mk = (color, x) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), new THREE.MeshBasicMaterial({ color }));
    m.position.set(x, 0, 0); g.add(m); return m;
  };
  const left = mk(0xff2020, -wingSpan / 2);
  const right = mk(0x20ff50, wingSpan / 2);
  const strobe = mk(0xffffff, 0);
  strobe.position.set(0, 0.4, -4.5);
  const landing = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xffe6a0 }));
  landing.position.set(0, -0.4, 3.2); g.add(landing);
  return { group: g, left, right, strobe, landing };
}

export function buildAlbatro(textures) {
  const g = new THREE.Group();
  const alu = new THREE.MeshStandardMaterial({
    map: textures.aluminium.map, bumpMap: textures.aluminium.bumpMap, bumpScale: 0.4,
    roughness: 0.42, metalness: 0.55,
  });
  const blue = new THREE.MeshStandardMaterial({ color: 0x1d4e89, roughness: 0.45, metalness: 0.4 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x22262a, roughness: 0.5, metalness: 0.5 });
  // hull fuselage with boat-step belly
  const fus = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 0.75, 9.2, 14), alu);
  fus.rotation.x = Math.PI / 2; g.add(fus);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(1.05, 14, 10), alu);
  nose.scale.set(1, 1, 1.4); nose.position.z = 4.6; g.add(nose);
  const belly = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.7, 6.5), blue);
  belly.position.set(0, -0.85, 0.6); g.add(belly);
  // cockpit glass
  const glass = new THREE.Mesh(new THREE.SphereGeometry(0.95, 14, 10),
    new THREE.MeshStandardMaterial({ color: 0x9fc4d8, roughness: 0.08, metalness: 0.4, transparent: true, opacity: 0.14, depthWrite: false }));
  glass.scale.set(1, 0.72, 1.5); glass.position.set(0, 0.55, 3.4); g.add(glass);
  // high wing + wingtip floats
  const wing = new THREE.Mesh(new THREE.BoxGeometry(15.5, 0.28, 2.4), alu);
  wing.position.set(0, 1.15, 0.4); g.add(wing);
  const aileronL = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.16, 0.9), blue);
  aileronL.position.set(-5.6, 1.12, -0.55); g.add(aileronL);
  const aileronR = aileronL.clone(); aileronR.position.x = 5.6; g.add(aileronR);
  const flapL = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.16, 1.0), blue);
  flapL.position.set(-2.4, 1.12, -0.6); g.add(flapL);
  const flapR = flapL.clone(); flapR.position.x = 2.4; g.add(flapR);
  for (const s of [-1, 1]) {
    const float = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.3, 2.6, 10), blue);
    float.rotation.x = Math.PI / 2; float.position.set(s * 7.6, -0.15, 0.4); g.add(float);
    const strut = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.3, 0.3), dark);
    strut.position.set(s * 7.6, 0.5, 0.4); g.add(strut);
  }
  // tail
  const hstab = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.2, 1.7), alu);
  hstab.position.set(0, 0.35, -4.3); g.add(hstab);
  const elevator = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.14, 0.8), blue);
  elevator.position.set(0, 0.33, -5.4); g.add(elevator);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.4, 2.0), blue);
  fin.position.set(0, 1.3, -4.5); g.add(fin);
  const rudder = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.2, 0.9), alu);
  rudder.position.set(0, 1.25, -5.5); g.add(rudder);
  // twin engines on the wing
  const props = [];
  for (const s of [-1, 1]) {
    const nac = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.65, 3.2, 12), alu);
    nac.rotation.x = Math.PI / 2; nac.position.set(s * 3.4, 1.15, 0.6); g.add(nac);
    const prop = propAssembly(1.7);
    prop.position.set(s * 3.4, 1.15, 2.35); g.add(prop);
    props.push(prop);
  }
  // retractable tricycle gear
  const gear = new THREE.Group();
  const mkLeg = (x, z, len) => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, len, 8), dark);
    leg.position.set(x, -len / 2, z);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 12), dark);
    wheel.rotation.z = Math.PI / 2; wheel.position.set(x, -len, z);
    gear.add(leg, wheel);
  };
  mkLeg(0, 3.1, 1.1); mkLeg(-0.85, -1.2, 1.35); mkLeg(0.85, -1.2, 1.35);
  g.add(gear);
  const lights = navLightSet(15.5);
  lights.group.position.set(0, 1.15, 0.4); g.add(lights.group);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
  return {
    group: g, props, aileronL, aileronR, flapL, flapR, elevator, rudder, gear,
    lights, spanM: 15.5, lengthM: 9.6,
  };
}

export function buildLibeccio() {
  const g = new THREE.Group();
  const red = new THREE.MeshStandardMaterial({ color: 0xb03a2e, roughness: 0.4, metalness: 0.4 });
  const cream = new THREE.MeshStandardMaterial({ color: 0xf2ead8, roughness: 0.45, metalness: 0.3 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.5, metalness: 0.5 });
  const fus = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.4, 7.4, 12), cream);
  fus.rotation.x = Math.PI / 2; g.add(fus);
  const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, 7.4, 12, 1, true), red);
  stripe.rotation.x = Math.PI / 2; stripe.scale.set(1, 0.4, 1); stripe.position.y = 0.05; g.add(stripe);
  const glass = new THREE.Mesh(new THREE.SphereGeometry(0.62, 12, 10),
    new THREE.MeshStandardMaterial({ color: 0x9fc4d8, roughness: 0.08, metalness: 0.4, transparent: true, opacity: 0.14, depthWrite: false }));
  glass.scale.set(1, 0.7, 1.6); glass.position.set(0, 0.42, 1.6); g.add(glass);
  const wing = new THREE.Mesh(new THREE.BoxGeometry(10.5, 0.2, 2.0), red);
  wing.position.set(0, -0.35, 0.4); g.add(wing);
  const aileronL = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.12, 0.7), cream);
  aileronL.position.set(-3.8, -0.35, -0.45); g.add(aileronL);
  const aileronR = aileronL.clone(); aileronR.position.x = 3.8; g.add(aileronR);
  const flapL = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.12, 0.8), cream);
  flapL.position.set(-1.6, -0.35, -0.5); g.add(flapL);
  const flapR = flapL.clone(); flapR.position.x = 1.6; g.add(flapR);
  const hstab = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.16, 1.3), red);
  hstab.position.set(0, 0.15, -3.5); g.add(hstab);
  const elevator = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.12, 0.6), cream);
  elevator.position.set(0, 0.15, -4.3); g.add(elevator);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.6, 1.5), red);
  fin.position.set(0, 0.85, -3.6); g.add(fin);
  const rudder = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.5, 0.7), cream);
  rudder.position.set(0, 0.8, -4.4); g.add(rudder);
  const prop = propAssembly(1.15);
  prop.position.set(0, 0, 3.9); g.add(prop);
  const gear = new THREE.Group();
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.0, 8), dark);
    leg.position.set(s * 0.6, -0.9, 1.2); gear.add(leg);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.24, 10), dark);
    wheel.rotation.z = Math.PI / 2; wheel.position.set(s * 0.6, -1.4, 1.2); gear.add(wheel);
  }
  g.add(gear);
  const lights = navLightSet(10.5);
  lights.group.position.set(0, -0.35, 0.4); g.add(lights.group);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return { group: g, props: [prop], aileronL, aileronR, flapL, flapR, elevator, rudder, gear, lights, spanM: 10.5, lengthM: 7.6 };
}

export function buildSirocco() {
  const g = new THREE.Group();
  const grey = new THREE.MeshStandardMaterial({ color: 0x9aa4ae, roughness: 0.35, metalness: 0.7 });
  const navy = new THREE.MeshStandardMaterial({ color: 0x1d3a5f, roughness: 0.4, metalness: 0.5 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1c1e20, roughness: 0.5, metalness: 0.5 });
  const fus = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.5, 10.5, 12), grey);
  fus.rotation.x = Math.PI / 2; g.add(fus);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.85, 2.4, 12), navy);
  nose.rotation.x = Math.PI / 2; nose.position.z = 6.4; g.add(nose);
  const glass = new THREE.Mesh(new THREE.SphereGeometry(0.7, 12, 10),
    new THREE.MeshStandardMaterial({ color: 0x9fc4d8, roughness: 0.06, metalness: 0.4, transparent: true, opacity: 0.14, depthWrite: false }));
  glass.scale.set(1, 0.6, 1.8); glass.position.set(0, 0.55, 3.6); g.add(glass);
  const wing = new THREE.Mesh(new THREE.BoxGeometry(11.5, 0.22, 2.6), grey);
  wing.position.set(0, -0.2, -0.4); wing.rotation.y = 0.06; g.add(wing);
  const aileronL = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.14, 0.8), navy);
  aileronL.position.set(-4.2, -0.2, -1.5); g.add(aileronL);
  const aileronR = aileronL.clone(); aileronR.position.x = 4.2; g.add(aileronR);
  const flapL = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.14, 0.9), navy);
  flapL.position.set(-1.7, -0.2, -1.55); g.add(flapL);
  const flapR = flapL.clone(); flapR.position.x = 1.7; g.add(flapR);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.2, 2.2), navy);
  fin.position.set(0, 1.1, -4.6); g.add(fin);
  const rudder = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.0, 0.9), grey);
  rudder.position.set(0, 1.05, -5.6); g.add(rudder);
  const hstab = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.16, 1.4), grey);
  hstab.position.set(0, 0.3, -4.8); g.add(hstab);
  const elevator = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.12, 0.6), navy);
  elevator.position.set(0, 0.3, -5.7); g.add(elevator);
  const gear = new THREE.Group();
  for (const [x, z] of [[0, 3.4], [-0.8, -1.4], [0.8, -1.4]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.2, 8), dark);
    leg.position.set(x, -0.6, z); gear.add(leg);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.28, 10), dark);
    wheel.rotation.z = Math.PI / 2; wheel.position.set(x, -1.2, z); gear.add(wheel);
  }
  g.add(gear);
  // jet exhaust glow
  const exhaust = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.6, 10),
    new THREE.MeshBasicMaterial({ color: 0xff9a3a, transparent: true, opacity: 0.7 }));
  exhaust.rotation.x = -Math.PI / 2; exhaust.position.set(0, 0, -5.9); g.add(exhaust);
  const lights = navLightSet(11.5);
  lights.group.position.set(0, -0.2, -0.4); g.add(lights.group);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return { group: g, props: [], aileronL, aileronR, flapL, flapR, elevator, rudder, gear, lights, exhaust, spanM: 11.5, lengthM: 11.8 };
}

export function buildAircraft(type, textures) {
  if (type === 'libeccio') return buildLibeccio();
  if (type === 'sirocco') return buildSirocco();
  return buildAlbatro(textures);
}
