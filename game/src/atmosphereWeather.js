// atmosphereWeather.js — golden-hour sky dome, layered cumulus, sea haze,
// sun, and the Mistral squall rain system with a live wind model.
import * as THREE from 'three';
import { clamp, lerp } from './config.js';

export function createWeather() {
  return {
    windDirDeg: 120, windKt: 12, gustKt: 4,
    storm: false, stormIntensity: 0, rain: false,
    visibilityM: 26000, cloudBaseFt: 3200,
  };
}

export function buildSky(scene, renderer) {
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  scene.fog = new THREE.Fog(0xe8b07e, 3500, 11000);
  // Gradient sky dome (golden hour: warm horizon, dusty blue zenith)
  const skyGeo = new THREE.SphereGeometry(11500, 24, 16);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      top: { value: new THREE.Color(0x5f7fb0) },
      mid: { value: new THREE.Color(0xe9a86a) },
      low: { value: new THREE.Color(0xf7c98a) },
      sunDir: { value: new THREE.Vector3(-0.82, 0.24, 0.35).normalize() },
    },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 low; uniform vec3 sunDir; varying vec3 vDir;
      void main(){
        float h = clamp(vDir.y, -0.05, 1.0);
        vec3 col = mix(low, mid, smoothstep(0.0, 0.18, h));
        col = mix(col, top, smoothstep(0.15, 0.65, h));
        float s = max(dot(normalize(vDir), normalize(sunDir)), 0.0);
        col += vec3(1.0, 0.62, 0.25) * pow(s, 90.0) * 1.4;
        col += vec3(1.0, 0.75, 0.45) * pow(s, 6.0) * 0.28;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  scene.add(sky);
  // Sun disc + warm key light
  const sun = new THREE.DirectionalLight(0xffc98a, 2.4);
  sun.position.set(-8200, 2400, 3500);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -1600; sun.shadow.camera.right = 1600;
  sun.shadow.camera.top = 1600; sun.shadow.camera.bottom = -1600;
  sun.shadow.camera.far = 22000;
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0x9db4d6, 0x8a6f4d, 0.85));
  // Soft eastern fill: lifts the camera-facing (backlit) side of the
  // aircraft on westbound shots without washing out the golden hour.
  const fill = new THREE.DirectionalLight(0xffd9b0, 0.45);
  fill.position.set(8000, 1500, -2000);
  scene.add(fill);
  const sunSprite = new THREE.Mesh(
    new THREE.CircleGeometry(420, 32),
    new THREE.MeshBasicMaterial({ color: 0xffe6b0, fog: false, transparent: true, opacity: 0.95 }),
  );
  sunSprite.position.set(-9200, 2600, 3900);
  sunSprite.lookAt(0, 0, 0);
  scene.add(sunSprite);
  // Golden-hour lens flare: additive radial glow + a wide anamorphic
  // streak, both parked on the sun so any shot looking west gets the
  // glare. Procedural canvas textures, zero network.
  const flareCanvas = document.createElement('canvas');
  flareCanvas.width = 256; flareCanvas.height = 256;
  const fg = flareCanvas.getContext('2d');
  const grad = fg.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, 'rgba(255,246,220,1)');
  grad.addColorStop(0.18, 'rgba(255,214,140,0.75)');
  grad.addColorStop(0.45, 'rgba(255,170,80,0.28)');
  grad.addColorStop(1, 'rgba(255,150,60,0)');
  fg.fillStyle = grad; fg.fillRect(0, 0, 256, 256);
  fg.strokeStyle = 'rgba(255,240,200,0.55)'; fg.lineWidth = 5;
  fg.beginPath(); fg.arc(128, 128, 62, 0, Math.PI * 2); fg.stroke();
  fg.strokeStyle = 'rgba(255,220,160,0.3)'; fg.lineWidth = 2;
  fg.beginPath(); fg.arc(128, 128, 92, 0, Math.PI * 2); fg.stroke();
  const flareTex = new THREE.CanvasTexture(flareCanvas);
  const flare = new THREE.Sprite(new THREE.SpriteMaterial({
    map: flareTex, blending: THREE.AdditiveBlending, depthWrite: false,
    fog: false, transparent: true, opacity: 0.9,
  }));
  flare.position.set(-9200, 2600, 3900);
  flare.scale.set(3400, 3400, 1);
  scene.add(flare);
  const streakCanvas = document.createElement('canvas');
  streakCanvas.width = 256; streakCanvas.height = 64;
  const sg = streakCanvas.getContext('2d');
  const sgrad = sg.createLinearGradient(0, 0, 256, 0);
  sgrad.addColorStop(0, 'rgba(255,190,110,0)');
  sgrad.addColorStop(0.5, 'rgba(255,225,170,0.85)');
  sgrad.addColorStop(1, 'rgba(255,190,110,0)');
  sg.fillStyle = sgrad; sg.fillRect(0, 0, 256, 64);
  const streakTex = new THREE.CanvasTexture(streakCanvas);
  const streak = new THREE.Sprite(new THREE.SpriteMaterial({
    map: streakTex, blending: THREE.AdditiveBlending, depthWrite: false,
    fog: false, transparent: true, opacity: 0.5,
  }));
  streak.position.set(-9200, 2600, 3900);
  streak.scale.set(6500, 480, 1);
  scene.add(streak);
  return { sky, sun, sunSprite, flare, streak };
}

export function buildClouds(scene) {
  // Layered cumulus: clusters of soft golden-lit billboards
  const group = new THREE.Group();
  const cloudMat = new THREE.MeshLambertMaterial({ color: 0xfff8ec, transparent: true, opacity: 0.8, emissive: 0x6a4a28, emissiveIntensity: 0.1 });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x8f8578, transparent: true, opacity: 0.85, emissive: 0x1a1a22, emissiveIntensity: 0.4 });
  const puffs = [];
  for (let i = 0; i < 30; i++) {
    const isStorm = i >= 24;
    const cluster = new THREE.Group();
    const n = 4 + (i % 4);
    for (let j = 0; j < n; j++) {
      const r = 90 + ((i * 37 + j * 53) % 160);
      const puff = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), isStorm ? darkMat : cloudMat);
      puff.position.set((j - n / 2) * r * 1.1, ((j * 29) % 60) - 20, ((j * 41) % 90) - 45);
      puff.scale.y = 0.6;
      cluster.add(puff);
    }
    const x = -5600 + ((i * 911) % 11200);
    const z = -5600 + ((i * 1733) % 11200);
    const y = isStorm ? 1100 + (i % 3) * 140 : 1500 + ((i * 211) % 900);
    cluster.position.set(x, y, z);
    cluster.userData.storm = isStorm;
    group.add(cluster);
    puffs.push(cluster);
  }
  // Hero clusters: big, low, warm-lit cumulus strung along the cover
  // corridor and a towering bank on the western horizon around the sun,
  // so a westbound cover frame has layered clouds instead of empty sky.
  const heroSpots = [
    { x: -2500, y: 700, z: -800, r: 300, n: 7 },
    { x: -800, y: 850, z: 600, r: 260, n: 6 },
    { x: 800, y: 750, z: -400, r: 280, n: 6 },
    { x: 1400, y: 700, z: 2200, r: 320, n: 7 },
    { x: 3500, y: 900, z: -1000, r: 260, n: 5 },
    { x: 500, y: 1100, z: 1800, r: 300, n: 6 },
    { x: -5200, y: 900, z: 2800, r: 380, n: 8 },
    { x: -4800, y: 1250, z: 3600, r: 340, n: 7 },
    { x: -5600, y: 700, z: 1800, r: 360, n: 8 },
  ];
  const warmMat = new THREE.MeshLambertMaterial({ color: 0xffe6c0, transparent: true, opacity: 0.88, emissive: 0x8a5426, emissiveIntensity: 0.35 });
  const shadeMat = new THREE.MeshLambertMaterial({ color: 0xc4b2a4, transparent: true, opacity: 0.85, emissive: 0x4a3a34, emissiveIntensity: 0.3 });
  for (let i = 0; i < heroSpots.length; i++) {
    const sp = heroSpots[i];
    const cluster = new THREE.Group();
    for (let j = 0; j < sp.n; j++) {
      const r = sp.r * (0.55 + ((i * 31 + j * 47) % 50) / 100);
      const puff = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), j % 3 === 2 ? shadeMat : warmMat);
      puff.position.set((j - sp.n / 2) * r * 0.9, ((j * 37) % 90) - 30, ((j * 53) % 120) - 60);
      puff.scale.y = 0.55;
      cluster.add(puff);
    }
    cluster.position.set(sp.x, sp.y, sp.z);
    cluster.userData.storm = false;
    group.add(cluster);
    puffs.push(cluster);
  }
  scene.add(group);
  return {
    group, puffs,
    update(dt, time, weather) {
      for (const c of puffs) {
        c.position.x += dt * (2.2 + weather.windKt * 0.12);
        if (c.position.x > 6000) c.position.x = -6000;
        c.visible = !c.userData.storm || weather.storm;
      }
    },
  };
}

export function buildRain(scene) {
  // Slanted streaks (LineSegments), not dots: each drop is a short line
  // aligned with its velocity, so the rain visibly leans with the wind —
  // the harder the Mistral blows, the harder the slant.
  const COUNT = 900;
  const pos = new Float32Array(COUNT * 2 * 3);
  const drops = new Float32Array(COUNT * 3);
  for (let i = 0; i < COUNT; i++) {
    drops[i * 3] = (Math.random() - 0.5) * 900;
    drops[i * 3 + 1] = Math.random() * 320;
    drops[i * 3 + 2] = (Math.random() - 0.5) * 900;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.LineBasicMaterial({ color: 0xcfe0ee, transparent: true, opacity: 0 });
  const lines = new THREE.LineSegments(geo, mat);
  lines.visible = false;
  lines.frustumCulled = false;
  scene.add(lines);
  return {
    points: lines,
    update(dt, aircraftPos, weather) {
      const active = weather.storm && weather.rain;
      lines.visible = active;
      if (!active) return;
      mat.opacity = 0.5 * weather.stormIntensity;
      lines.position.set(aircraftPos.x, aircraftPos.y - 120, aircraftPos.z);
      const wind = windVectorAt(weather, aircraftPos.y);
      // streak tilt follows the live wind (exaggerated ~3x so 24 kt reads)
      const sx = wind.x * 0.35, sz = wind.z * 0.35, sy = 14;
      const fall = 260;
      for (let i = 0; i < COUNT; i++) {
        let x = drops[i * 3], y = drops[i * 3 + 1], z = drops[i * 3 + 2];
        y -= fall * dt;
        x += wind.x * 3 * dt;
        z += wind.z * 3 * dt;
        if (y < 0) { y = 320; x = (Math.random() - 0.5) * 900; z = (Math.random() - 0.5) * 900; }
        drops[i * 3] = x; drops[i * 3 + 1] = y; drops[i * 3 + 2] = z;
        pos[i * 6] = x; pos[i * 6 + 1] = y; pos[i * 6 + 2] = z;
        pos[i * 6 + 3] = x - sx; pos[i * 6 + 4] = y + sy; pos[i * 6 + 5] = z - sz;
      }
      geo.attributes.position.needsUpdate = true;
    },
  };
}

export function buildLightning(scene) {
  // Periodic lightning, storm only: a jagged bolt (two crossed additive
  // planes with a canvas-drawn bolt) plus a sky flash (dedicated
  // directional light spiking and fading over ~1 s). Strikes every 4-7 s
  // near the aircraft in the storm zone; thunder fires via onThunder
  // ~0.4-0.9 s after the flash, the way sound lags light.
  const c = document.createElement('canvas'); c.width = 128; c.height = 512;
  const g = c.getContext('2d');
  const pts = [];
  let x = 64;
  pts.push([x, 0]);
  for (let y = 42; y <= 512; y += 42) {
    x += (Math.random() - 0.5) * 70;
    x = Math.max(14, Math.min(114, x));
    pts.push([x, y]);
  }
  const trace = (style, width, blur) => {
    g.strokeStyle = style; g.lineWidth = width; g.lineCap = 'round';
    g.shadowColor = '#cfe6ff'; g.shadowBlur = blur;
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
    g.stroke();
  };
  g.clearRect(0, 0, 128, 512);
  trace('rgba(190,220,255,0.95)', 20, 26);
  trace('rgba(255,255,255,1.0)', 8, 12);
  const tex = new THREE.CanvasTexture(c);
  const boltGeo = new THREE.PlaneGeometry(150, 900);
  const boltMat = new THREE.MeshBasicMaterial({
    map: tex, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false,
    side: THREE.DoubleSide, fog: false,
  });
  const boltA = new THREE.Mesh(boltGeo, boltMat);
  const boltB = new THREE.Mesh(boltGeo, boltMat.clone());
  boltB.rotation.y = Math.PI / 2;
  const group = new THREE.Group();
  group.add(boltA, boltB);
  group.visible = false;
  scene.add(group);
  const flashLight = new THREE.DirectionalLight(0xdfeaff, 0);
  flashLight.position.set(0, 900, 0);
  scene.add(flashLight);
  let nextIn = 1.5 + Math.random() * 1.5;
  let boltT = 0;
  let flash = 0;
  let thunderAt = -1;
  let strikes = 0; // diagnostic counter: how many bolts have fired
  return {
    group,
    get strikes() { return strikes; },
    update(dt, time, weather, aircraftPos, onThunder, headingDeg) {
      if (!weather.storm || !aircraftPos) {
        group.visible = false;
        flashLight.intensity = 0;
        return;
      }
      nextIn -= dt;
      if (nextIn <= 0) {
        // Bolt lands in the forward hemisphere the pilot is looking at
        // (+-55 deg around the nose), 350-800 m out, so a strike is
        // visible from the chase/cockpit camera instead of behind it.
        const hdg = (typeof headingDeg === 'number' ? headingDeg : 0) * Math.PI / 180;
        const ang = hdg + (Math.random() - 0.5) * 1.92;
        const dist = 350 + Math.random() * 450;
        const sx = aircraftPos.x + Math.sin(ang) * dist;
        const sz = aircraftPos.z - Math.cos(ang) * dist;
        group.position.set(sx, 560, sz);
        group.rotation.y = Math.random() * Math.PI;
        group.visible = true;
        boltT = 0.35;
        flash = 1;
        flashLight.position.set(sx, 900, sz);
        thunderAt = time + 0.35 + Math.random() * 0.5;
        nextIn = 4 + Math.random() * 3;
        strikes++;
      }
      if (boltT > 0) {
        boltT -= dt;
        // double-stroke flicker: bright, dip, bright again, then gone
        const on = boltT > 0.14 || (boltT > 0.06 && boltT < 0.1);
        const op = on ? 1.0 : 0.5;
        boltMat.opacity = op;
        boltB.material.opacity = op;
        if (boltT <= 0) { group.visible = false; boltMat.opacity = 0; boltB.material.opacity = 0; }
      }
      if (flash > 0) {
        flash = Math.max(0, flash - dt * 1.0);
        flashLight.intensity = flash * 5.5;
      } else {
        flashLight.intensity = 0;
      }
      if (thunderAt > 0 && time >= thunderAt) {
        thunderAt = -1;
        if (onThunder) onThunder();
      }
    },
  };
}

export function windVectorAt(weather, altitudeM) {
  const dir = (weather.windDirDeg + 180) * Math.PI / 180; // blowing TOWARD
  const speed = weather.windKt * 0.514444 * (1 + altitudeM / 6000);
  const gust = weather.storm ? weather.gustKt * 0.514444 * Math.sin(performance.now() * 0.0013) : 0;
  const s = speed + gust;
  return new THREE.Vector3(Math.sin(dir) * s, 0, -Math.cos(dir) * s); // north is -z
}
