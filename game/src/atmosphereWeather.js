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
  const sunSprite = new THREE.Mesh(
    new THREE.CircleGeometry(420, 32),
    new THREE.MeshBasicMaterial({ color: 0xffe6b0, fog: false, transparent: true, opacity: 0.95 }),
  );
  sunSprite.position.set(-9200, 2600, 3900);
  sunSprite.lookAt(0, 0, 0);
  scene.add(sunSprite);
  return { sky, sun, sunSprite };
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
  const COUNT = 2600;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(COUNT * 3);
  for (let i = 0; i < COUNT; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 900;
    pos[i * 3 + 1] = Math.random() * 320;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 900;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ color: 0xcfe0ee, size: 1.6, transparent: true, opacity: 0.0 });
  const points = new THREE.Points(geo, mat);
  points.visible = false;
  scene.add(points);
  return {
    points,
    update(dt, aircraftPos, weather) {
      const active = weather.storm && weather.rain;
      points.visible = active;
      if (!active) return;
      mat.opacity = 0.55 * weather.stormIntensity;
      points.position.set(aircraftPos.x, aircraftPos.y - 120, aircraftPos.z);
      const arr = geo.attributes.position.array;
      for (let i = 0; i < COUNT; i++) {
        arr[i * 3 + 1] -= dt * 260;
        arr[i * 3] += dt * 34; // wind slant
        if (arr[i * 3 + 1] < 0) arr[i * 3 + 1] = 320;
      }
      geo.attributes.position.needsUpdate = true;
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
