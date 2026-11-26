// waterShader.js — GLSL Mediterranean water: shallow turquoise near shore
// fading to deep sapphire, moving swell, shoreline foam, golden sun glitter.
import * as THREE from 'three';

const VERT = `
varying vec3 vPos;
varying vec3 vNormalW;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vPos = wp.xyz;
  vNormalW = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const FRAG = `
uniform float uTime;
uniform vec3 uSunDir;
uniform vec3 uShallow;
uniform vec3 uDeep;
varying vec3 vPos;
varying vec3 vNormalW;
float wave(vec2 p, float f, float s, float t) {
  return sin(p.x * f + t * s) * cos(p.y * f * 1.3 - t * s * 0.7);
}
void main() {
  float t = uTime;
  float w = wave(vPos.xz, 0.021, 1.1, t) * 0.5 + wave(vPos.xz, 0.053, 1.7, t) * 0.3
    + wave(vPos.xz, 0.13, 2.6, t) * 0.2;
  vec3 n = normalize(vNormalW + vec3(
    wave(vPos.xz + 31.0, 0.09, 1.9, t) * 0.12,
    0.0,
    wave(vPos.xz - 17.0, 0.11, 1.5, t) * 0.12));
  // depth fake: distance from the coast line (x ~ 1100) drives the colour
  float shore = clamp((vPos.x - 800.0) / 2200.0, 0.0, 1.0);
  vec3 col = mix(uShallow, uDeep, shore);
  col += vec3(0.05, 0.06, 0.04) * w;
  // shoreline foam bands
  float foam = smoothstep(0.02, 0.0, abs(shore - 0.03 + 0.012 * sin(vPos.z * 0.02 + t * 0.8)));
  col = mix(col, vec3(0.93, 0.96, 0.94), foam * 0.55);
  // golden-hour sun glitter
  vec3 viewDir = normalize(cameraPosition - vPos);
  vec3 hv = normalize(viewDir + normalize(uSunDir));
  float spec = pow(max(dot(n, hv), 0.0), 220.0);
  col += vec3(1.0, 0.72, 0.38) * spec * 1.6;
  float fres = pow(1.0 - max(dot(n, viewDir), 0.0), 3.0);
  col = mix(col, vec3(0.98, 0.78, 0.52), fres * 0.28);
  gl_FragColor = vec4(col, 0.94);
}`;

export function buildWater(scene) {
  const uniforms = {
    uTime: { value: 0 },
    uSunDir: { value: new THREE.Vector3(-0.82, 0.24, 0.35).normalize() },
    uShallow: { value: new THREE.Color(0x2fd4c0) },
    uDeep: { value: new THREE.Color(0x0d4f8a) },
  };
  const geo = new THREE.PlaneGeometry(12000, 12000, 96, 96);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.ShaderMaterial({
    uniforms, vertexShader: VERT, fragmentShader: FRAG,
    transparent: true, side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = 0.4;
  mesh.renderOrder = 1;
  scene.add(mesh);
  return {
    mesh,
    update(dt, time) { uniforms.uTime.value = time; },
  };
}
