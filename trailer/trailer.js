// GLIDEPATH — "Four Worlds" trailer. Deterministic: TRAILER.frame(t) renders the picture at time t.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { clamp, lerp, sstep, ease, seg, rng, noise2, makeSky, makeWater, GradeShader, orientOnPath } from './core.js';
import { makeJet, makeRocket } from './models.js';
import { buildHeartland, buildDesert, buildArctic, buildVolcano, buildCarrier, buildHyper, riverX, heartHeight, duneHeight, desertHeight, arcticHeight, volcHeight, VOLC } from './sets.js';
import { drawOverlay, DURATION } from './overlay.js';

const W = 1920, H = 1080, PH = 804, BAR = (H - PH) / 2;
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance', logarithmicDepthBuffer: false });
renderer.setPixelRatio(1); renderer.setSize(W, PH);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, W / PH, 0.5, 40000);
scene.fog = new THREE.FogExp2(0xffffff, 0.0001);

const sky = makeSky(); scene.add(sky);
const water = makeWater(); scene.add(water);
const sun = new THREE.DirectionalLight(0xffffff, 3); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.6;
scene.add(sun); scene.add(sun.target);
const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6); scene.add(hemi);
const jetLight = new THREE.PointLight(0xff8a3a, 0, 500, 2); scene.add(jetLight);

const composer = new EffectComposer(renderer);
composer.setPixelRatio(1); composer.setSize(W, PH);
composer.addPass(new RenderPass(scene, camera));
const sanitize = new ShaderPass({ uniforms: { tDiffuse: { value: null } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: `uniform sampler2D tDiffuse; varying vec2 vUv; void main(){ vec4 c = texture2D(tDiffuse, vUv);
    if (!(c.r == c.r) || !(c.g == c.g) || !(c.b == c.b) || c.r > 1e4 || c.g > 1e4 || c.b > 1e4) c = vec4(0.0, 0.0, 0.0, 1.0);
    gl_FragColor = vec4(min(c.rgb, vec3(40.0)), 1.0); }` });
composer.addPass(sanitize);
const bloom = new UnrealBloomPass(new THREE.Vector2(W / 2, PH / 2), 0.6, 0.55, 0.92); composer.addPass(bloom);
composer.addPass(new OutputPass());
const grade = new ShaderPass(GradeShader); composer.addPass(grade);
grade.uniforms.uRes.value.set(W, PH);

// ---------- sets ----------
const SETS = {
  heart: buildHeartland(), desert: buildDesert(), arctic: buildArctic(), volc: buildVolcano(), carrier: buildCarrier(), hyper: buildHyper()
};
for (const k in SETS) scene.add(SETS[k].group);
const jet = makeJet(); scene.add(jet);
const rocket = makeRocket(); scene.add(rocket);

// ---------- environments ----------
function sunDir(el, az) { el *= Math.PI / 180; return V3(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)).normalize(); }
const ENV = {
  dawn: { zen: 0x0a1a3c, hor: 0xd88a62, gnd: 0x0d141c, el: 1, az: -0.12, sunC: [1.0, 0.5, 0.22], glow: 1.2, light: [0xffa060, 1.6], hemi: [0x5a78a8, 0x2a1e18, 0.45], fog: 0.00011, exp: 1.0, deep: 0x041420, clouds: 0.35, cc: [0xffc8a0, 0x4a3a50] },
  morning: { zen: 0x2a62b4, hor: 0xcfe0ee, gnd: 0x26323a, el: 10, az: 0.75, sunC: [1.0, 0.88, 0.72], glow: 1.0, light: [0xfff0dc, 3.1], hemi: [0x9fc0e8, 0x3a3a24, 0.9], fog: 0.000085, exp: 1.0, deep: 0x0a2c40, clouds: 0.5, cc: [0xffffff, 0x8a98a8] },
  desert: { zen: 0x34588f, hor: 0xf2bf8a, gnd: 0x3a2a1c, el: 5.5, az: -1.35, sunC: [1.0, 0.6, 0.3], glow: 1.25, light: [0xffb070, 3.6], hemi: [0x8aa0c4, 0x7a5236, 0.55], fog: 0.00012, exp: 1.05, deep: 0x0a2c40, clouds: 0.25, cc: [0xffd0a0, 0x7a6a70] },
  arctic: { zen: 0x020611, hor: 0x0b2234, gnd: 0x04080e, el: -14, az: 0.4, sunC: [0.2, 0.3, 0.5], glow: 0.0, light: [0x8fafe0, 0.9], hemi: [0x2f5a7a, 0x0c1820, 0.45], fog: 0.00004, exp: 1.15, deep: 0x02080e, clouds: 0, stars: 1, aurora: 1, moon: 1, moonDir: sunDir(22, -0.5) },
  volc: { zen: 0x0a0818, hor: 0x7a2a1a, gnd: 0x080505, el: -2.5, az: 2.7, sunC: [1.0, 0.3, 0.1], glow: 0.5, light: [0xff7040, 0.35], hemi: [0x3a2c4a, 0x1a0805, 0.3], fog: 0.0001, exp: 1.0, deep: 0x05080a, clouds: 0.3, cc: [0xff8050, 0x2a1a30], stars: 0.35 },
  hyper: { zen: 0x04143a, hor: 0x9ab8d6, gnd: 0x2a3a48, el: 6, az: 0.62, sunC: [1.0, 0.9, 0.76], glow: 1.0, light: [0xfff2e0, 2.8], hemi: [0x90b0d8, 0x405060, 0.7], fog: 0.00004, exp: 1.0, deep: 0x041c34, clouds: 0.2, cc: [0xffffff, 0x8a9ab0] },
  sunset: { zen: 0x1a2c58, hor: 0xe0845a, gnd: 0x1a1a22, el: 4.5, az: -1.05, sunC: [1.0, 0.56, 0.26], glow: 0.95, light: [0xffa060, 2.1], hemi: [0x7080a8, 0x403028, 0.55], fog: 0.00008, exp: 0.95, deep: 0x06182a, clouds: 0.55, cc: [0xffb070, 0x50405a] }
};
const pmrem = new THREE.PMREMGenerator(renderer);
function applyEnv(name, overrides = {}) {
  const base = ENV[name];
  const e = Object.assign({}, base, overrides);
  const u = sky.material.uniforms;
  u.uZenith.value.set(e.zen); u.uHorizon.value.set(e.hor); u.uGround.value.set(e.gnd);
  const sd = sunDir(e.el, e.az); u.uSunDir.value.copy(sd);
  u.uSunColor.value.setRGB(...e.sunC); u.uGlow.value = e.glow;
  u.uStars.value = e.stars || 0; u.uAurora.value = e.aurora || 0; u.uMoon.value = e.moon || 0;
  if (e.moonDir) u.uMoonDir.value.copy(e.moonDir);
  u.uClouds.value = e.clouds || 0;
  if (e.cc) { u.uCloudColor.value.set(e.cc[0]); u.uCloudShade.value.set(e.cc[1]); }
  scene.fog.color.set(e.hor); scene.fog.density = e.fog;
  const w = water.material.uniforms;
  w.uZenith.value.set(e.zen); w.uHorizon.value.set(e.hor); w.uSunDir.value.copy(sd); w.uSunColor.value.setRGB(...e.sunC).multiplyScalar(Math.max(e.glow, 0.0));
  w.uFogColor.value.set(e.hor); w.uFogDensity.value = e.fog; w.uDeep.value.set(e.deep); w.uAurora.value = (e.aurora || 0);
  sun.color.set(e.light[0]); sun.intensity = e.light[1];
  const ld = e.el > 0 ? sd : (e.moonDir || V3(0.3, 0.6, -0.5).normalize());
  sun.userData.dir = ld;
  hemi.color.set(e.hemi[0]); hemi.groundColor.set(e.hemi[1]); hemi.intensity = e.hemi[2];
  renderer.toneMappingExposure = e.exp;
  if (!base._env) {
    const s2 = new THREE.Scene(); const sk = makeSky(); sk.material.uniforms = THREE.UniformsUtils.clone(u); s2.add(sk);
    base._env = pmrem.fromScene(s2, 0.02, 1, 30000).texture;
  }
  scene.environment = base._env;
  return sd;
}
function shadowAt(focus, size, on = true) {
  sun.castShadow = on;
  const d = sun.userData.dir || V3(0, 1, 0);
  sun.target.position.copy(focus); sun.position.copy(focus).addScaledVector(d, 4000);
  const c = sun.shadow.camera; c.left = -size; c.right = size; c.top = size; c.bottom = -size; c.near = 100; c.far = 9000; c.updateProjectionMatrix();
}
function show(...names) {
  for (const k in SETS) SETS[k].group.visible = names.includes(k);
}
function resetGrade() {
  const g = grade.uniforms;
  g.uVignette.value = 0.55; g.uGrain.value = 0.04; g.uCA.value = 0.0012; g.uFlash.value = 0; g.uFade.value = 0;
  g.uTint.value.setRGB(1, 1, 1); g.uContrast.value = 1.06; g.uSat.value = 1.08; g.uLift.value.setRGB(0, 0, 0);
  g.uRadial.value = 0; g.uEdgeGlow.value = 0; g.uShake.value.set(0, 0); g.uFlashColor.value.setRGB(1, 1, 1);
  bloom.strength = 0.6; bloom.radius = 0.55; bloom.threshold = 0.92;
  water.material.uniforms.uBlur.value = 0; water.material.uniforms.uOffset.value.set(0, 0); water.material.uniforms.uChop.value = 1;
  water.material.uniforms.uExtraLight.value.setRGB(0, 0, 0); water.material.uniforms.uSpec.value = 1;
  jetLight.intensity = 0; camera.near = 0.5; camera.far = 40000;
  jet.visible = false; rocket.visible = false; water.visible = true;
  scene.background = null;
}
function aim(pos, target, fov, roll = 0) {
  camera.position.copy(pos); camera.up.set(Math.sin(roll), Math.cos(roll), 0);
  camera.lookAt(target); camera.fov = fov; camera.updateProjectionMatrix();
}
function shake(t, amp, freq = 9, seed = 0) {
  return V3(noise2(t * freq, seed + 1.3) * amp, noise2(t * freq, seed + 7.9) * amp, noise2(t * freq, seed + 3.1) * amp * 0.5);
}
const flash = (t, t0, dur = 0.14, peak = 1) => (t >= t0 && t < t0 + dur) ? peak * (1 - (t - t0) / dur) : 0;

// ---------- the jet's paths ----------
const P = {
  dawn: (t, o) => { const pass = 3.25; const z = 10500 - 95 * pass - 190 * (t - pass); const k = Math.max(0, t - pass); return o.set(-10, 12 + k * k * 7, z); },
  heart: (t, o) => { const tau = t - 5; const z = 2700 - 235 * tau; return o.set(riverX(z), 50 + 6 * Math.sin(tau * 1.3), z); },
  desert: (t, o) => { const tau = t - 11; const z = 100 - 215 * tau; const x = 34 * Math.sin(tau * 1.1); return o.set(x, duneHeight(x, z) + 17, z); },
  arctic: (t, o) => { const z = -1300 + 320 * (t - 18); const k = Math.max(0, z); return o.set(-20 + 8 * Math.sin(t), 30 + k * 0.34 + k * k * 0.00012, z); },
  volcA: (t, o) => o.set(-900 + 420 * (t - 25), 230 + 12 * Math.sin(t), 3500),
  volcB: (t, o) => { const tau = t - 30.0; return o.set(-120 + 360 * tau, 760 - 10 * tau, 420 - 120 * tau); }
};
const _p = new THREE.Vector3(), _q = new THREE.Vector3();
function placeJet(pathFn, t, power = 1, bankMul = 0.55) {
  jet.visible = true;
  const info = orientOnPath(jet, pathFn, t, bankMul);
  jet.userData.set(t, power);
  return info;
}
function jetWorld(local) { return jet.localToWorld(local.clone()); }
function lightOnJet(power, color = 0xff8a3a, intensity = 30000, dist = 600) {
  jetLight.color.set(color); jetLight.intensity = intensity * power; jetLight.distance = dist;
  jetLight.position.copy(jetWorld(V3(0, 0, 12)));
}

// ---------- particles ----------
function hash(i) { return Math.abs(Math.sin(i * 127.1 + 311.7) * 43758.5453) % 1; }
function desertDust(t, pathFn, pool, camPos) {
  pool.begin();
  const list = [];
  const step = 0.03, N = 110;
  for (let k = 0; k < N; k++) {
    const sid = Math.floor(t / step) - k, ts = sid * step, age = t - ts;
    if (ts < 11) continue;
    pathFn(ts, _p);
    const gh = duneHeight(_p.x, _p.z), agl = _p.y - gh;
    const a = (1 - age / (N * step)) * 0.55 * sstep(40, 12, agl);
    if (a <= 0.01) continue;
    const ox = (hash(sid) - 0.5) * 10 * (1 + age * 3), oz = (hash(sid + 9) - 0.5) * 8;
    const x = _p.x + ox + age * 5, z = _p.z + oz, y = gh + 2 + age * 7 + hash(sid + 3) * 4;
    list.push([x, y, z, 7 + age * 26, a, hash(sid + 5) * 6.28]);
  }
  list.sort((A, B) => (B[0] - camPos.x) ** 2 + (B[2] - camPos.z) ** 2 - ((A[0] - camPos.x) ** 2 + (A[2] - camPos.z) ** 2));
  for (const s of list) pool.add(s[0], s[1], s[2], s[3] * 1.4, 0.78, 0.56, 0.38, s[4] * 0.42, s[5]);
  pool.end();
}
function flareFlames(t, D) {
  const pool = D.flares; pool.begin();
  D.derricks.forEach((d, i) => {
    const f = d.localToWorld(d.userData.flare.clone());
    for (let k = 0; k < 4; k++) {
      const fl = 0.75 + 0.25 * Math.sin(t * 23 + i * 3 + k * 1.7);
      pool.add(f.x + Math.sin(t * 7 + k) * 0.6, f.y + 1.5 + k * 2.2, f.z, (6 - k) * fl, 3.0, 1.2, 0.3, 0.9 - k * 0.18);
    }
  });
  pool.end();
}
function snowfall(t, pool, cam) {
  pool.begin();
  const B = 70;
  for (let i = 0; i < 650; i++) {
    const hx = hash(i * 3.1), hy = hash(i * 7.7), hz = hash(i * 1.9);
    let x = (hx * 2 * B + t * 3) % (2 * B) - B, z = (hz * 2 * B) % (2 * B) - B;
    let y = ((hy * 2 * B - t * (4 + hash(i) * 3)) % (2 * B) + 2 * B) % (2 * B) - B;
    x += cam.x - ((cam.x % (2 * B)) + 2 * B) % (2 * B) + B; z += cam.z - ((cam.z % (2 * B)) + 2 * B) % (2 * B) + B; y += cam.y;
    // keep flakes near the camera (wrap relative to it)
    if (x - cam.x > B) x -= 2 * B; if (x - cam.x < -B) x += 2 * B; if (z - cam.z > B) z -= 2 * B; if (z - cam.z < -B) z += 2 * B;
    pool.add(x + Math.sin(t + i) * 0.5, y, z, 0.18 + hash(i * 5.3) * 0.25, 0.75, 0.82, 0.95, 0.75);
  }
  pool.end();
}
function runwayLights(t, A) {
  const pool = A.lights; pool.begin();
  for (let z = -560; z <= 320; z += 32) for (const x of [170, 210]) pool.add(x, 9.8, z, 2.4, 0.6, 1.2, 3.2, 1);
  for (const x of [172, 180, 190, 200, 208]) pool.add(x, 9.8, -575, 2.6, 0.5, 3.0, 0.6, 1);
  pool.end();
}
// ---------- volcano: plume, bombs ----------
const ERUPT = [];
(function () {
  const r = rng(5);
  const ev = [[27.4, 130, 1.0], [29.3, 80, 0.8]];
  for (const [t0, n, k] of ev) for (let i = 0; i < n; i++) {
    const a = r() * 6.283, h = 25 + r() * 95 * k, vy = 110 + r() * 170 * k;
    ERUPT.push({ t0: t0 + r() * 0.5, x: Math.cos(a) * r() * 50, z: Math.sin(a) * r() * 50, vx: Math.cos(a) * h, vz: Math.sin(a) * h, vy, s: 4 + r() * 9 });
  }
  for (let i = 0; i < 60; i++) { const a = r() * 6.283, h = 15 + r() * 45; ERUPT.push({ t0: 20 + i * 0.25 + r() * 0.2, x: 0, z: 0, vx: Math.cos(a) * h, vz: Math.sin(a) * h, vy: 70 + r() * 80, s: 3 + r() * 4 }); }
})();
function volcanoFx(t, Vs, cam, surge, bombScale = 1) {
  const ly = Vs.lakeY;
  Vs.lavaMat.uniforms.uTime.value = t; Vs.chanMat.uniforms.uTime.value = t;
  Vs.lavaMat.uniforms.uHeat.value = 1 + surge * 0.8;
  // plume
  const list = [];
  const N = 380, period = 22.8;
  for (let i = 0; i < N; i++) {
    const b = i * (period / N);
    const age = ((t - b) % period + period) % period;
    const rise = age * 95 * (1 - age / 60);
    const x = age * 16 + Math.sin(i * 1.7) * (20 + age * 9), z = age * 5 + Math.cos(i * 2.3) * (20 + age * 9);
    const y = ly + 20 + rise;
    const s = 110 + age * 40 + hash(i) * 60;
    const lit = 1 - sstep(0, 700, rise);
    const col = [lerp(0.035, 0.8, lit * lit * lit) * (1 + 0.5 * surge), lerp(0.032, 0.2, lit * lit * lit) * (1 + surge * 0.3), lerp(0.03, 0.05, lit * lit)];
    const a = 0.85 * sstep(0, 1.2, age) * (1 - age / period);
    list.push([x, y, z, s, col, a, hash(i + 3) * 6.28]);
  }
  list.sort((A, B) => cam.distanceToSquared(V3(B[0], B[1], B[2])) - cam.distanceToSquared(V3(A[0], A[1], A[2])));
  Vs.smoke.begin(); for (const s of list) Vs.smoke.add(s[0], s[1], s[2], s[3], s[4][0], s[4][1], s[4][2], s[5], s[6]); Vs.smoke.end();
  // bombs + trails
  Vs.glow.begin();
  for (const b of ERUPT) {
    const age = t - b.t0; if (age < 0 || age > 22) continue;
    for (let k = 0; k < 4; k++) {
      const a2 = age - k * 0.07; if (a2 < 0) break;
      const x = b.x + b.vx * a2, z = b.z + b.vz * a2, y = ly + 10 + b.vy * a2 - 4.9 * a2 * a2;
      if (y < volcHeight(x, z) + 1) break;
      const fade = 1 - k / 4, cool = 1 - sstep(4, 18, age);
      Vs.glow.add(x, y, z, b.s * bombScale * (1.5 - k * 0.3), 3.0 * cool + 0.3, 0.9 * cool + 0.08, 0.12, 0.85 * fade);
    }
  }
  // the crater glow
  if (bombScale > 1.5) Vs.glow.add(0, ly + 120, 0, 700 * Math.max(surge, 0.3), 1.4, 0.35, 0.06, 0.5 * Math.max(surge, 0.3));
  Vs.glow.end();
  Vs.light.intensity = (5e5 + 1.5e5 * Math.sin(t * 11) * Math.sin(t * 3.3)) * (1 + surge * 1.5);
}

// ---------- shots ----------
const shots = [];
const shot = (t0, t1, fn) => shots.push({ t0, t1, fn });
const state = { sun: null, hyper: null };

// S1 · 0–5 · Dawn over the ocean, the island on the horizon, a jet roars overhead
shot(0, 5, (t) => {
  show('heart');
  const sd = applyEnv('dawn', { el: lerp(-1.4, 2.4, t / 5) });
  const cz = 10500 - 95 * t;
  const cp = V3(0, 4.5 + Math.sin(t * 1.1) * 0.4, cz).add(shake(t, 0.15, 3));
  aim(cp, V3(-60, 40, cz - 3000), 40);
  if (t > 2.6) {
    placeJet(P.dawn, t, 1);
    lightOnJet(1, 0xff8a3a, 3000, 300);
    water.material.uniforms.uExtraLight.value.setRGB(3, 1.2, 0.4); water.material.uniforms.uExtraPos.value.copy(jetLight.position); water.material.uniforms.uExtraRange.value = 120;
    const d = Math.abs(t - 3.25);
    grade.uniforms.uShake.value.set(noise2(t * 40, 1) * 0.004 * sstep(0.6, 0, d), noise2(t * 40, 2) * 0.004 * sstep(0.6, 0, d));
  }
  shadowAt(cp, 300, false);
  grade.uniforms.uFade.value = 1 - ease.out(seg(t, 0.0, 1.6));
  bloom.strength = 0.55; bloom.threshold = 1.0;
  state.sun = { dir: sd, k: 1.0 };
});

// S2a · 5–8.5 · Heartland: chase along the river
shot(5, 8.5, (t) => {
  show('heart');
  const sd = applyEnv('morning');
  const info = placeJet(P.heart, t, 0.55);
  const fwd = info.fwd, right = V3().crossVectors(fwd, V3(0, 1, 0)).normalize();
  const jp = jet.position.clone();
  const cp = jp.clone().addScaledVector(fwd, -34).addScaledVector(right, 13).add(V3(0, 7, 0)).add(shake(t, 0.35, 5));
  cp.y = Math.max(cp.y, heartHeight(cp.x, cp.z) + 6);
  aim(cp, jp.clone().addScaledVector(fwd, 30).add(V3(0, -1, 0)), 52, -info.bank * 0.25);
  shadowAt(jp, 420);
  state.sun = { dir: sd, k: 0.6 };
  grade.uniforms.uFlash.value = flash(t, 5, 0.12, 0.6);
});
// S2b · 8.5–11 · a ridge camera; the jet blasts past and away to the mountains
shot(8.5, 11, (t) => {
  show('heart');
  const sd = applyEnv('morning');
  placeJet(P.heart, t, 0.8);
  const cz = 1600, cx = riverX(cz) + 95;
  const cp = V3(cx, heartHeight(cx, cz) + 13, cz);
  const jp = jet.position.clone();
  const tgt = jp.clone().add(V3(0, 2, -18));
  const pass = sstep(9.2, 10.0, t);
  aim(cp.add(shake(t, 0.25 + 0.5 * sstep(0.5, 0, Math.abs(t - 9.62)), 14)), tgt, lerp(36, 46, pass));
  shadowAt(jp, 380);
  state.sun = { dir: sd, k: 0.6 };
});

// S3a · 11–14.5 · Dust Sea: the wide crane, mesas casting long shadows
shot(11, 14.5, (t) => {
  show('desert');
  const sd = applyEnv('desert'); water.visible = false;
  placeJet(P.desert, t, 0.7);
  const tau = t - 11;
  const jz = jet.position.z;
  const cp = V3(jet.position.x * 0.6 - 40, 95 - 8 * tau, jz + 230 - 15 * tau);
  aim(cp, V3(jet.position.x * 0.6 - 10, jet.position.y + 8, jz - 140), 36);
  desertDust(t, P.desert, SETS.desert.dust, cp); flareFlames(t, SETS.desert);
  shadowAt(V3(0, 0, jet.position.z + 50), 900);
  state.sun = { dir: sd, k: 0.9 };
  grade.uniforms.uFlash.value = flash(t, 11, 0.12, 0.6);
  grade.uniforms.uTint.value.setRGB(1.03, 1.0, 0.95);
});
// S3b · 14.5–18 · side tracking over the dune crests, mesa walls whipping by
shot(14.5, 18, (t) => {
  show('desert');
  const sd = applyEnv('desert'); water.visible = false;
  const info = placeJet(P.desert, t, 0.85);
  const jp = jet.position.clone();
  const sw = Math.sin((t - 14.5) * 0.6);
  const cp = jp.clone().add(V3(-26 - 6 * sw, 1.5, -10 + 14 * sw)).add(shake(t, 0.35, 7));
  cp.y = Math.max(cp.y, desertHeight(cp.x, cp.z) + 3);
  aim(cp, jp.clone().add(V3(0, 0.5, -6)), 42, 0.03);
  desertDust(t, P.desert, SETS.desert.dust, cp); flareFlames(t, SETS.desert);
  shadowAt(jp, 520);
  state.sun = { dir: sd, k: 0.9 };
  grade.uniforms.uTint.value.setRGB(1.03, 1.0, 0.95);
});

// S4a · 18–21.5 · Northreach under the aurora; the jet's lights come in across the frozen lake
shot(18, 21.5, (t) => {
  show('arctic');
  applyEnv('arctic'); water.visible = false;
  placeJet(P.arctic, t, 0.9);
  lightOnJet(0.9, 0xff9a50, 2500, 300);
  const tau = (t - 18) / 3.5;
  const cp = V3(lerp(-150, -70, ease.inOut(tau)), lerp(12, 46, ease.inOut(tau)), lerp(300, 190, ease.inOut(tau)));
  aim(cp, V3(lerp(-40, -10, tau), lerp(150, 120, tau), -900), 46);
  SETS.arctic.station.userData.set(t); runwayLights(t, SETS.arctic); snowfall(t, SETS.arctic.snow, cp);
  shadowAt(V3(0, 0, 0), 600, false);
  bloom.strength = 0.9; bloom.threshold = 0.85;
  grade.uniforms.uFlash.value = flash(t, 18, 0.12, 0.5);
  state.sun = null;
});
// S4b · 21.5–25 · low by the station; it thunders overhead and climbs into the aurora
shot(21.5, 25, (t) => {
  show('arctic');
  applyEnv('arctic'); water.visible = false;
  placeJet(P.arctic, t, 1.0);
  lightOnJet(1, 0xff9a50, 4000, 300);
  const cp = V3(58, 15, 38);
  const jp = jet.position.clone();
  const near = sstep(0.6, 0, Math.abs(t - 22.1));
  aim(cp.clone().add(shake(t, 0.15 + 0.9 * near, 18)), jp.clone().add(V3(0, 4, 0)), 50);
  SETS.arctic.station.userData.set(t); runwayLights(t, SETS.arctic); snowfall(t, SETS.arctic.snow, cp);
  shadowAt(V3(0, 0, 0), 600, false);
  bloom.strength = 0.9; bloom.threshold = 0.85;
  grade.uniforms.uCA.value = 0.0012 + 0.004 * near;
  state.sun = null;
});

// S5a · 25–28.2 · Mount Kaela from the sea; the eruption
shot(25, 28.2, (t) => {
  show('volc');
  applyEnv('volc');
  placeJet(P.volcA, t, 1.0);
  const tau = t - 25;
  const surge = sstep(27.3, 27.6, t) * (1 - sstep(27.8, 29.5, t));
  const cp = V3(-1150 + 30 * tau, 16, 5300 - 75 * tau).add(shake(t, 0.6 * surge, 10));
  aim(cp, V3(0, 560, 0), 33);
  volcanoFx(t, SETS.volc, cp, surge, 3.2);
  water.material.uniforms.uExtraLight.value.setRGB(0.6, 0.15, 0.03).multiplyScalar(1 + surge); water.material.uniforms.uExtraPos.value.set(0, 1000, 0); water.material.uniforms.uExtraRange.value = 4000;
  shadowAt(V3(0, 0, 0), 600, false);
  bloom.strength = 0.8; bloom.threshold = 0.95;
  grade.uniforms.uFlash.value = flash(t, 25, 0.12, 0.5) + flash(t, 27.45, 0.25, 0.35);
  grade.uniforms.uFlashColor.value.setRGB(1, t > 27 ? 0.6 : 1, t > 27 ? 0.35 : 1);
  state.sun = null;
});
// S5b · 28.2–32 · at the crater rim, lava bombs flying, the jet streaks through the ash
shot(28.2, 32, (t) => {
  show('volc');
  applyEnv('volc');
  const Vs = SETS.volc;
  const a = 0.75 + 0.1 * (t - 28.2), R = 720;
  const cp = V3(Math.cos(a) * R, 1080 + 20 * (t - 28.2), Math.sin(a) * R);
  const surge = 0.35 + 0.65 * sstep(29.2, 29.5, t) * (1 - sstep(29.8, 31.5, t));
  const near = sstep(0.5, 0, Math.abs(t - 30.35));
  if (t > 29.6) {
    // the jet crosses between the camera and the plume
    const C0 = V3(Math.cos(0.75 + 0.1 * 2.15) * 720, 0, Math.sin(0.75 + 0.1 * 2.15) * 720);
    C0.y = 1080 + 20 * 2.15;
    const mid = C0.clone().multiplyScalar(0.5); mid.y = C0.y - 60;
    const dir = V3(-C0.z, 0, C0.x).normalize();
    placeJet((tt, o) => o.copy(mid).addScaledVector(dir, (tt - 30.35) * 380).add(V3(0, (tt - 30.35) * 30, 0)), t, 1.0);
    lightOnJet(1, 0xff9a50, 4000, 300);
  }
  aim(cp.clone().add(shake(t, 0.5 * surge + 1.2 * near, 12)), V3(0, Vs.lakeY + 60, 0), 50);
  volcanoFx(t, Vs, cp, surge);
  water.material.uniforms.uExtraLight.value.setRGB(1.2, 0.3, 0.05); water.material.uniforms.uExtraPos.value.set(0, 900, 0); water.material.uniforms.uExtraRange.value = 4000;
  shadowAt(V3(0, 0, 0), 600, false);
  bloom.strength = 0.85; bloom.threshold = 0.95;
  grade.uniforms.uFlash.value = flash(t, 29.35, 0.2, 0.3);
  grade.uniforms.uFlashColor.value.setRGB(1, 0.6, 0.35);
  grade.uniforms.uCA.value = 0.0015 + 0.004 * near;
  state.sun = null;
});

// S6 · 32–34.5 · the montage — four worlds, four beats
shot(32, 34.5, (t) => {
  const b = Math.floor((t - 32) / 0.5), lt = (t - 32) - b * 0.5;
  grade.uniforms.uFlash.value = flash(lt, 0, 0.1, 0.85);
  if (b === 0) {
    show('desert'); const sd = applyEnv('desert'); water.visible = false;
    const tt = 15.6 + lt; placeJet(P.desert, tt, 1);
    P.desert(15.6 + 0.25, _q);
    const cp = V3(_q.x + 7, duneHeight(_q.x + 7, _q.z - 40) + 2.5, _q.z - 40);
    aim(cp, jet.position.clone().add(V3(0, 3, 0)), 58, 0.1);
    desertDust(tt, P.desert, SETS.desert.dust, cp); flareFlames(tt, SETS.desert); shadowAt(jet.position, 400);
    state.sun = { dir: sd, k: 0.8 };
  } else if (b === 1) {
    show('arctic'); applyEnv('arctic'); water.visible = false;
    const tt = 21.9 + lt * 0.8; placeJet(P.arctic, tt, 1); lightOnJet(1, 0xff9a50, 4000, 300);
    const cp = V3(-30, 12, 70);
    aim(cp, V3(-10, 120, -60), 70, 0.15);
    SETS.arctic.station.userData.set(tt); runwayLights(tt, SETS.arctic); snowfall(tt, SETS.arctic.snow, cp); shadowAt(V3(), 500, false);
    bloom.strength = 0.9; state.sun = null;
  } else if (b === 2) {
    show('volc'); applyEnv('volc');
    const tt = 28.3 + lt;
    const cp = V3(250, SETS.volc.lakeY + 230, 260);
    aim(cp.clone().add(shake(tt, 1.5, 14)), V3(0, SETS.volc.lakeY + 160, 0), 60);
    volcanoFx(tt, SETS.volc, cp, 0.6); shadowAt(V3(), 500, false);
    bloom.strength = 0.7; bloom.threshold = 1.0; state.sun = null;
  } else if (b === 3) {
    show('heart'); const sd = applyEnv('morning');
    const tt = 6.4 + lt; const info = placeJet(P.heart, tt, 1);
    const jp = jet.position.clone();
    const cp = jp.clone().addScaledVector(info.fwd, -24).add(V3(0, 10, 0));
    aim(cp, jp.clone().addScaledVector(info.fwd, 40).add(V3(0, -6, 0)), 58);
    shadowAt(jp, 300); state.sun = null;
  } else {
    show(); water.visible = false;
    grade.uniforms.uFade.value = 1; state.sun = null;
    aim(V3(0, 100, 0), V3(0, 100, -1), 45);
  }
});

// S7 · 34.5–44 · HYPER CRUISE
const HYV = (tau) => {
  if (tau < 2.0) return 650;
  if (tau < 7.3) return 650 + (20000 - 650) * ease.inOut(seg(tau, 2.0, 5.2));
  return lerp(20000, 650, ease.out(seg(tau, 7.3, 8.0)));
};
const HYD = []; { let d = 0; for (let i = 0; i <= 800; i++) { HYD.push(d); d += HYV(i / 100) * 0.01; } }
const hyDist = tau => { const f = clamp(tau, 0, 8) * 100, i = Math.floor(f), k = f - i; return lerp(HYD[i], HYD[Math.min(i + 1, 800)], k); };
shot(34.5, 36, (t) => {
  show(); water.visible = false;
  aim(V3(0, 1500, 0), V3(0, 1500, -1), 45);
  grade.uniforms.uFade.value = 1; state.sun = null;
});
shot(36, 44, (t) => {
  const tau = t - 36;
  show('hyper');
  const sd = applyEnv('hyper');
  const H = SETS.hyper;
  const v = HYV(tau), D = hyDist(tau), k = clamp((v - 650) / 19350, 0, 1);
  rocket.visible = true;
  const rp = V3(0, 1500, 0);
  // the rocket surges ahead of the chase camera when it lights up, then the camera catches it
  const surge = sstep(2.0, 2.5, tau) * (1 - sstep(2.6, 3.6, tau));
  rp.z -= surge * 26;
  rp.add(shake(t, 0.15 + 0.5 * k, 6, 4));
  rocket.position.copy(rp); rocket.rotation.set(0, 0, Math.sin(t * 0.7) * 0.05 * (1 - k));
  const glow = sstep(1.4, 2.0, tau) * (tau < 7.6 ? 1 : 1 - seg(tau, 7.6, 8));
  rocket.userData.set(t, 0.55 + 0.9 * glow + 0.3 * k, 2.5 * glow);
  // camera
  let cp, tgt, fov;
  if (tau < 2.6) {
    const a = -0.9 + tau * 0.08;
    cp = rp.clone().add(V3(Math.sin(a) * 30, 4 - tau * 0.5, Math.cos(a) * -30 + 6));
    if (tau > 2.0) cp.z = lerp(cp.z, rp.z + 30, sstep(2.0, 2.6, tau));
    tgt = rp.clone().add(V3(0, 0, 2)); fov = 40;
  } else {
    const b = sstep(2.6, 3.4, tau);
    const a = -0.9 + 2.6 * 0.08;
    const c0 = V3(0, 1500, 0).add(V3(Math.sin(a) * 30, 4 - 1.3, rp.z + 30));
    const c1 = rp.clone().add(V3(5.5, 4.2, 25));
    cp = c0.lerp(c1, ease.inOut(b));
    tgt = rp.clone().add(V3(0, 1.2, -40));
    fov = lerp(40, 74, ease.inOut(seg(tau, 2.8, 5.4))) * (tau > 7.3 ? lerp(1, 0.5, seg(tau, 7.3, 8)) : 1);
  }
  cp.add(shake(t, 0.1 + 0.9 * k + 1.4 * surge, 16, 9));
  aim(cp, tgt, fov, Math.sin(t * 1.3) * 0.02);
  camera.near = 0.3;
  // world motion: water + clouds scroll beneath
  const wu = water.material.uniforms;
  wu.uOffset.value.set(0, -D); wu.uBlur.value = sstep(0.05, 0.4, k);
  // clouds below, smeared along the motion
  const pool = H.clouds; pool.begin();
  const smear = Math.min(v / 60, 450);
  const list = [];
  for (const c of H.puffs) {
    let z = ((c.z + D) % 12000) - 10000;
    const n = Math.max(1, Math.min(7, Math.round(smear / 60)));
    for (let i = 0; i < n; i++) {
      const zz = z - (i / n) * smear;
      list.push([c.x, 1500 + c.y, zz, c.s * (1 + 0.15 * i / n), c.b * 0.85, (n > 1 ? 0.6 / Math.sqrt(n) : 0.85)]);
    }
  }
  list.sort((A, B) => (B[2] - cp.z) ** 2 + (B[0] - cp.x) ** 2 - (A[2] - cp.z) ** 2 - (A[0] - cp.x) ** 2);
  for (const s of list) pool.add(s[0], s[1], s[2], s[3], s[4], s[4], s[4] * 1.04, s[5]);
  pool.end();
  // speed lines
  const m = new THREE.Matrix4(), L = clamp(v * 0.012, 1, 260);
  H.lines.visible = k > 0.02;
  H.lineSeeds.forEach((s, i) => {
    const z = ((s.z + D * s.k * 0.08) % 1200) - 1100;
    m.compose(V3(rp.x + s.x, rp.y + s.y, rp.z + z), new THREE.Quaternion(), V3(1, 1, L * s.k));
    H.lines.setMatrixAt(i, m);
  });
  H.lines.instanceMatrix.needsUpdate = true;
  H.lines.material.opacity = 0.32 * sstep(0.05, 0.4, k);
  // vapor cone + shock ring at the moment it goes
  const vc = seg(tau, 2.05, 2.9);
  H.vapor.position.copy(rp).add(V3(0, 0, -6)); H.vapor.scale.set(0.6 + vc * 0.8, 0.6 + vc * 0.8, 0.7 + vc * 1.4);
  H.vcMat.uniforms.uA.value = (vc > 0 && vc < 1) ? Math.sin(vc * Math.PI) * 1.2 : 0; H.vcMat.uniforms.uTime.value = t;
  const rg = seg(tau, 2.15, 2.9);
  H.ring.position.copy(rp).add(V3(0, 0, -4)); H.ring.scale.setScalar(4 + rg * 120); H.ring.lookAt(cp);
  H.ringMat.opacity = rg > 0 && rg < 1 ? (1 - rg) * 0.9 : 0;
  shadowAt(rp, 60, true);
  // screen
  const g = grade.uniforms;
  g.uRadial.value = 0.42 * k + 0.35 * surge;
  g.uEdgeGlow.value = 0.14 * k;
  renderer.toneMappingExposure = lerp(1.0, 0.6, k);
  g.uTint.value.setRGB(lerp(1, 0.9, k), lerp(1, 0.97, k), 1.0); g.uEdgeColor.value.setRGB(0.35, 0.65, 1.0);
  g.uCA.value = 0.0012 + 0.006 * k + 0.008 * surge;
  g.uGrain.value = 0.04 + 0.03 * k;
  g.uFlash.value = flash(tau, 2.12, 0.18, 0.55) + (tau > 7.55 ? ease.in(seg(tau, 7.55, 8.0)) : 0) + flash(tau, 0, 0.12, 0.4);
  g.uFlashColor.value.setRGB(0.92, 0.97, 1.0);
  g.uContrast.value = 1.08 + 0.14 * k;
  bloom.strength = 0.6 + 0.15 * k;
  state.sun = { dir: sd, k: 1.0 - 0.4 * k };
  state.hyper = { tau, v, D, k };
});

// S8 · 44–62 · CARRIER OPS
const CAT = { a: 34, t0: 51.6 };
function launchZ(t) {
  const C = SETS.carrier.carrier.userData;
  const tl = Math.max(0, t - CAT.t0);
  let z = C.catZ0 - 0.5 * CAT.a * tl * tl;
  const tb = Math.sqrt(2 * (C.catZ0 - C.catZ1) / CAT.a);
  let y = C.DY + 2.2;
  if (tl > tb) {
    const vb = CAT.a * tb, tt = tl - tb;
    z = C.catZ1 - vb * tt - 0.5 * 18 * tt * tt;
    y += -1.5 * Math.sin(Math.min(tt, 1) * Math.PI) * (tt < 1 ? 1 : 0) + Math.max(0, tt - 0.4) ** 2 * 9;
  }
  return { z, y, tl, tb };
}
function carrierCommon(t, opts = {}) {
  show('carrier');
  const sd = applyEnv('sunset');
  const S = SETS.carrier, C = S.carrier.userData;
  C.set(t);
  S.wakeMat.uniforms.uTime.value = t; S.wakeMat.uniforms.uSun.value.setRGB(1, 0.75, 0.55);
  water.material.uniforms.uOffset.value.set(0, -t * 14);
  // the launching jet
  const L = launchZ(t);
  const jp = V3(C.catX, L.y, L.z);
  const J = S.launchJet;
  J.position.copy(jp);
  const pitch = L.tl > L.tb ? clamp((L.tl - L.tb - 0.3) * 0.25, 0, 0.32) : 0;
  J.rotation.set(pitch, 0, 0);
  const pw = t < 50.4 ? 0.25 : lerp(0.25, 1, sstep(50.4, 51.0, t));
  J.userData.set(t, pw);
  jetLight.color.set(0xff9a50); jetLight.intensity = 25000 * pw; jetLight.distance = 120; jetLight.position.copy(jp).add(V3(0, 0, 14));
  // crew: the shooter's arm comes down to launch
  S.crew.forEach((c, i) => { c.userData.arm.rotation.z = i === 0 ? lerp(2.6, 0.6, sstep(51.2, 51.5, t)) : 0.25 + 0.15 * Math.sin(t * 2 + i); });
  // catapult steam + the JBD glow
  const sp = S.steam; sp.begin();
  const list = [];
  for (let i = 0; i < 60; i++) {
    const z = C.catZ1 + 4 + hash(i) * (C.catZ0 - C.catZ1 - 8);
    const age = ((t * 0.6 + hash(i + 1)) % 1);
    list.push([C.catX + (hash(i + 2) - 0.5) * 1.6, C.DY + 1 + age * 5, z, 2 + age * 6, 0.9, 0.35 * Math.sin(age * Math.PI)]);
  }
  // the burst left behind the shuttle
  if (L.tl > 0) for (let i = 0; i < 120; i++) {
    const zz = C.catZ0 - (i / 120) * (C.catZ0 - C.catZ1);
    if (zz < L.z + 6) continue;
    const t_pass = CAT.t0 + Math.sqrt(2 * (C.catZ0 - zz) / CAT.a);
    const age = t - t_pass; if (age < 0) continue;
    list.push([C.catX + (hash(i + 7) - 0.5) * 3 * (1 + age), C.DY + 1 + age * 4 + hash(i) * 2, zz + age * 9, 3 + age * 9, 1.0, 0.75 * Math.exp(-age * 0.7)]);
  }
  const cam = opts.cam || camera.position;
  list.sort((A, B) => (B[0] - cam.x) ** 2 + (B[1] - cam.y) ** 2 + (B[2] - cam.z) ** 2 - ((A[0] - cam.x) ** 2 + (A[1] - cam.y) ** 2 + (A[2] - cam.z) ** 2));
  for (const s of list) sp.add(s[0], s[1], s[2], s[3], s[4], s[4] * 0.95, s[4] * 0.92, s[5], hash(s[2]) * 6);
  sp.end();
  const dg = S.deckGlow; dg.begin();
  if (L.tl === 0) dg.add(C.catX, C.DY + 3, C.catZ0 + 13, 7 * pw, 1.6, 0.6, 0.2, 0.5 * pw);
  dg.end();
  bloom.strength = 0.55; bloom.threshold = 1.0;
  water.material.uniforms.uSpec.value = 0.6;
  grade.uniforms.uTint.value.setRGB(1.04, 1.0, 0.96);
  return { sd, jp, C, L };
}
// S8a · 44–48.5 · golden hour; the carrier group from the air, the Rocket drops in over it
shot(44, 48.5, (t) => {
  const tau = (t - 44) / 4.5;
  const cp = V3(lerp(250, 120, ease.inOut(tau)), lerp(120, 42, ease.inOut(tau)), lerp(380, 210, ease.inOut(tau)));
  const { sd } = carrierCommon(t, { cam: cp });
  aim(cp, V3(lerp(0, -10, tau), 18, lerp(-30, -70, tau)), 40);
  // the Rocket, out of HYPER, streaking across the sunset
  if (t < 46.4) {
    rocket.visible = true;
    const k = (t - 44);
    const rpos = V3(-900 + 700 * k, 260 - 50 * k, -700 + 120 * k);
    rocket.position.copy(rpos);
    rocket.lookAt(rpos.clone().add(V3(700, -50, 120))); rocket.rotateY(Math.PI);
    rocket.userData.set(t, 1.2, 1.5);
  }
  shadowAt(V3(0, 0, 0), 240);
  grade.uniforms.uFlash.value = Math.max(0, 1 - (t - 44) / 0.35);
  grade.uniforms.uFlashColor.value.setRGB(0.92, 0.97, 1.0);
  state.sun = { dir: sd, k: 1.0 };
});
// S8b · 48.5–51.6 · on deck, behind the jet on the catapult; afterburner lights up
shot(48.5, 51.6, (t) => {
  const tau = (t - 48.5) / 3.1;
  const S = SETS.carrier, C = S.carrier.userData;
  const cp = V3(C.catX + 17 - 3 * tau, C.DY + 1.7, C.catZ0 + 14 - 5 * ease.inOut(tau));
  const { sd } = carrierCommon(t, { cam: cp });
  aim(cp.clone().add(shake(t, 0.03 + 0.12 * sstep(50.4, 51.0, t), 20)), V3(C.catX - 2, C.DY + 2.8, C.catZ0 - 18), 42);
  shadowAt(V3(C.catX, C.DY, C.catZ0 - 30), 90);
  state.sun = { dir: sd, k: 1.0 };
  grade.uniforms.uFlash.value = flash(t, 48.5, 0.1, 0.4);
});
// S8c · 51.6–54.4 · LAUNCH — from the bow edge; it screams past and climbs into the sun
shot(51.6, 54.4, (t) => {
  const S = SETS.carrier, C = S.carrier.userData;
  const cp0 = V3(C.catX - 13, C.DY + 1.3, -150);
  const { sd, jp } = carrierCommon(t, { cam: cp0 });
  const L = launchZ(t);
  const near = sstep(0.4, 0, Math.abs(t - (CAT.t0 + Math.sqrt(2 * (C.catZ0 + 152) / CAT.a))));
  const tgt = jp.clone().add(V3(0, 2, -4));
  const cp = cp0.clone().add(shake(t, 0.05 + 0.5 * near, 22));
  aim(cp, tgt, lerp(40, 54, sstep(53.2, 54.2, t)));
  shadowAt(V3(C.catX, C.DY, -120), 90);
  grade.uniforms.uCA.value = 0.0012 + 0.005 * near;
  state.sun = { dir: sd, k: 1.0 };
});
// S8d · 54.4–62 · the jet climbing away into the sunset; the title
shot(54.4, 62, (t) => {
  const S = SETS.carrier, C = S.carrier.userData;
  const { sd, jp } = carrierCommon(t);
  const tau = t - 54.4;
  const cp = V3(C.catX - 13 + tau * 2, C.DY + 1.3 + tau * 1.5, -150 - tau * 6);
  aim(cp, jp.clone().lerp(V3(-60, 260, -2600), sstep(0, 5, tau)), lerp(54, 46, sstep(0, 6, tau)));
  shadowAt(V3(C.catX, C.DY, -150), 120);
  grade.uniforms.uFade.value = 0.42 * sstep(0, 1.0, tau) + (1 - 0.42) * sstep(60.6, 61.9, t);
  grade.uniforms.uVignette.value = 0.8;
  state.sun = { dir: sd, k: 1.0 };
});

// ---------- overlay compositing ----------
const out = document.getElementById('out'); out.width = W; out.height = H;
const ctx = out.getContext('2d');
const _sp = new THREE.Vector3();
function frame(t) {
  t = clamp(t, 0, DURATION - 1e-4);
  const s = shots.find(s => t >= s.t0 && t < s.t1) || shots[shots.length - 1];
  resetGrade(); state.sun = null; state.hyper = null;
  s.fn(t);
  // per-frame globals
  sky.position.copy(camera.position); sky.material.uniforms.uTime.value = t;
  water.position.set(camera.position.x, 0, camera.position.z); water.material.uniforms.uTime.value = t;
  grade.uniforms.uTime.value = t;
  composer.render();
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  ctx.drawImage(renderer.domElement, 0, BAR);
  // sun on screen (for the lens flare)
  let sunScr = null;
  if (state.sun) {
    _sp.copy(camera.position).addScaledVector(state.sun.dir, 10000).project(camera);
    if (_sp.z < 1 && Math.abs(_sp.x) < 1.6 && Math.abs(_sp.y) < 1.6) {
      const sx = (_sp.x * 0.5 + 0.5) * W, sy = BAR + (-_sp.y * 0.5 + 0.5) * PH;
      let vis = 0;
      if (sx > 2 && sx < W - 2 && sy > BAR + 2 && sy < H - BAR - 2) {
        const px = ctx.getImageData(Math.round(sx), Math.round(sy), 1, 1).data;
        vis = sstep(0.75, 0.97, (px[0] + px[1] + px[2]) / 765);
      } else vis = 0.0;
      sunScr = { x: sx, y: sy, k: state.sun.k * vis };
    }
  }
  drawOverlay(ctx, t, { W, H, PH, BAR, sun: sunScr, hyper: state.hyper });
  return true;
}
window.setBloom = (v) => { bloom.enabled = v; };
window.TRAILER = { frame, duration: DURATION, W, H, debug: () => ({ jet: jet.position.toArray(), jv: jet.visible, cam: camera.position.toArray(), q: jet.quaternion.toArray() }) };
window.TRAILER_READY = true;
