// The trailer's locations. Each set builds its own geometry once and exposes update(t) hooks.
import * as THREE from 'three';
import { clamp, lerp, sstep, rng, fbm, ridged, noise2, makeTerrain, SpritePool, softTex, smokeTex, GLSL_NOISE } from './core.js';
import { makeTreeMeshes, makeStation, makeDerrick, makeCarrier, makeEscort, makeJet, makeDeckCrew } from './models.js';

const C = (hex) => new THREE.Color(hex);

/* =================== HEARTLAND =================== */
export function riverX(z) { return 520 * Math.sin(z * 0.00062 + 0.4) + 210 * Math.sin(z * 0.0017 + 1.3); }
export function heartHeight(x, z) {
  const hills = 70 + fbm(x * 0.00028, z * 0.00028, 6) * 170 + fbm(x * 0.0011 + 9, z * 0.0011 - 4, 4) * 28;
  const mtn = Math.pow(ridged(x * 0.00026 + 3.3, z * 0.00026 - 1.7, 5), 2.6) * 1300 * sstep(-1500, -6500, z);
  let h = hills + mtn;
  const d = Math.abs(x - riverX(z));
  // a broad valley floor just above the water, then a gentle muddy bank down into the channel
  h = lerp(3.5, h, Math.pow(sstep(70, 1400, d), 0.8));
  h = lerp(-3.5, h, sstep(30, 82, d));
  // coast to the south
  const coast = 3400 + fbm(x * 0.0006, 7.7, 3) * 900;
  h = lerp(h, -60, sstep(coast - 500, coast + 900, z));
  return h;
}
function heartColor(x, z, h, ny, c) {
  const n = fbm(x * 0.003, z * 0.003, 3);
  const d = Math.abs(x - riverX(z));
  c.setRGB(0.16 + n * 0.04, 0.27 + n * 0.06, 0.08);
  // farmland patchwork on the valley floor
  if (d < 900 && d > 70 && h < 60) {
    const cx = Math.floor((x + z * 0.35) / 140), cz = Math.floor((z - x * 0.35) / 95);
    const r = Math.abs(Math.sin(cx * 12.9898 + cz * 78.233) * 43758.5453) % 1;
    const f = [C(0x8a7a2e), C(0x5f7a2a), C(0x3f5f22), C(0xa08a40), C(0x6f6a2c), C(0x4a6d2a)][Math.floor(r * 6)];
    c.lerp(f.convertSRGBToLinear(), 0.75 * (1 - sstep(700, 900, d)));
  }
  if (h < 3) c.setRGB(0.42, 0.37, 0.25);
  if (ny < 0.82) c.lerp(new THREE.Color(0.22, 0.21, 0.2), sstep(0.82, 0.62, ny));
  if (h > 780) c.lerp(new THREE.Color(0.9, 0.93, 0.96), sstep(780, 900, h + n * 60) * sstep(0.55, 0.75, ny));
}
export function buildHeartland() {
  const g = new THREE.Group();
  // grid spacing ~10-18 m along the river corridor the camera flies, ~200 m at the far edges
  const sh = (k, u) => Math.sinh(k * u) / Math.sinh(k);
  const warp = (gx, gz) => {
    const u = gx / 9000, v = (gz + 1500) / 9000;
    const x = 9000 * sh(3.6, u);
    const z = v < 0 ? 2000 - 12500 * sh(3.8, -v) : 2000 + 5500 * sh(2.6, v);
    return [x, z];
  };
  const ter = makeTerrain({ size: 18000, seg: 360, cx: 0, cz: -1500, height: heartHeight, color: heartColor, warp });
  g.add(ter);
  const trees = makeTreeMeshes(26000, 11, (r) => {
    const x = -1800 + r() * 3600, z = -2600 + r() * 6200;
    const fm = fbm(x * 0.0016 + 4, z * 0.0016, 4);
    if (fm < 0.02) return null;
    const h = heartHeight(x, z), d = Math.abs(x - riverX(z));
    if (h < 6 || h > 650 || d < 90) return null;
    if (d < 900 && h < 60 && fm < 0.25) return null;
    const kind = h > 180 || r() < 0.35 ? 0 : 1;
    const c = kind === 0 ? new THREE.Color(0.05 + r() * 0.03, 0.13 + r() * 0.05, 0.05) : new THREE.Color(0.12 + r() * 0.08, 0.2 + r() * 0.08, 0.05);
    return { x, y: h, z, s: 0.9 + r() * 0.8, kind, c };
  });
  g.add(trees);
  return { group: g, height: heartHeight };
}

/* =================== DUST SEA =================== */
const MESAS = [];
(function () {
  const r = rng(42);
  // two staggered walls of mesas the jet threads between, plus some far-off buttes
  const lanes = [[-300, -300], [290, -620], [-320, -980], [310, -1350], [-290, -1750], [320, -2150], [-300, -2550], [300, -2950], [-320, -3350], [300, -3750]];
  for (const [x, z] of lanes) MESAS.push({ x: x + (r() - 0.5) * 40, z, R: 120 + r() * 60, H: 120 + r() * 70 });
  for (let i = 0; i < 26; i++) {
    const x = (r() < 0.35 ? -1 : 1) * (1150 + r() * 2600), z = 800 - r() * 6500;
    MESAS.push({ x, z, R: 160 + r() * 260, H: 80 + r() * 120 });
  }
})();
export function duneHeight(x, z) {
  const u = x * 0.8 + z * 0.6, v = -x * 0.6 + z * 0.8;
  const wob = noise2(x * 0.0011, z * 0.0011) * 3.0;
  let h = 10 + Math.pow(1 - Math.abs(Math.sin(u * 0.0062 + wob)), 2.2) * (11 + 9 * noise2(v * 0.002, u * 0.002));
  h += Math.pow(1 - Math.abs(Math.sin(u * 0.03 + wob * 2)), 3) * 1.6;
  return h;
}
export function mesaAt(x, z) {
  // rough mesa height for camera collision
  let h = 0;
  for (const m of MESAS) { const d = Math.hypot(x - m.x, z - m.z); if (d < m.R * 1.25) h = Math.max(h, m.H * sstep(m.R * 1.25, m.R * 0.9, d)); }
  return h;
}
export function desertHeight(x, z) { return Math.max(duneHeight(x, z), 10 + mesaAt(x, z)); }
function buildMesas() {
  const P = [], Cc = [], I = [];
  const bands = [C(0x94573c), C(0xbf8f68), C(0x7a4532), C(0xa9714f)].map(c => c.convertSRGBToLinear());
  const sand = C(0xc9a272).convertSRGBToLinear(), top = C(0xa97a52).convertSRGBToLinear();
  const SEG = 72;
  for (const m of MESAS) {
    const base = duneHeight(m.x, m.z) - 8, sd = m.x * 0.013 + m.z * 0.007;
    const rings = [[0, 1.6, 0], [7, 1.4, 0], [14, 1.18, 0], [21, 1.05, 0]];
    for (let h = 24, k = 0; h < m.H; h += 14, k++) { rings.push([h, 1.0 - 0.012 * k, 1]); rings.push([h + 11.5, 0.995 - 0.012 * k, 1]); rings.push([h + 13, 0.975 - 0.012 * k, 1]); }
    rings.push([m.H, 0.96 - 0.012 * (m.H / 14), 1]);
    const v0 = P.length / 3;
    rings.forEach(([h, sc, cliff], ri) => {
      for (let i = 0; i < SEG; i++) {
        const a = i / SEG * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
        let r = m.R * (1 + 0.15 * noise2(ca * 1.6 + sd, sa * 1.6 - sd) + 0.05 * noise2(ca * 5 + sd, sa * 5));
        r *= 1 + 0.035 * noise2(a * 18 + sd, h * 0.04) * cliff;
        r *= sc;
        P.push(m.x + ca * r, base + h, m.z + sa * r);
        let c;
        if (!cliff) c = sand.clone().lerp(bands[0], ri / 6);
        else { c = bands[(Math.floor(h / 9) + (i % 7 === 0 ? 1 : 0)) % 4].clone(); c.lerp(sand, 0.08 + 0.1 * noise2(a * 9, h * 0.1)); }
        Cc.push(c.r, c.g, c.b);
      }
    });
    for (let ri = 0; ri < rings.length - 1; ri++) for (let i = 0; i < SEG; i++) {
      const a = v0 + ri * SEG + i, b = v0 + ri * SEG + (i + 1) % SEG, c = a + SEG, d = b + SEG;
      I.push(a, c, b, b, c, d);
    }
    const ci = P.length / 3; P.push(m.x, base + m.H + 2, m.z); Cc.push(top.r, top.g, top.b);
    const last = v0 + (rings.length - 1) * SEG;
    for (let i = 0; i < SEG; i++) I.push(ci, last + (i + 1) % SEG, last + i);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(Cc, 3)); g.setIndex(I);
  g.computeVertexNormals();
  const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, flatShading: true }));
  mesh.castShadow = true; mesh.receiveShadow = true;
  return mesh;
}
function desertColor(x, z, h, ny, c) {
  const n = noise2(x * 0.004, z * 0.004) * 0.5 + 0.5;
  if (h > 40) {
    const band = Math.floor(h / 9) % 3;
    c.copy([C(0x9a5236), C(0xc48a5e), C(0x7e3f28)][band]).convertSRGBToLinear();
    c.lerp(C(0xa9875c).convertSRGBToLinear(), 0.12 + n * 0.15);
    if (ny > 0.9) c.lerp(C(0xb8875a).convertSRGBToLinear(), 0.5);
  } else {
    c.copy(C(0xd2ad7c)).convertSRGBToLinear().lerp(C(0x9c7b52).convertSRGBToLinear(), (1 - ny) * 3 + n * 0.25);
  }
}
export function buildDesert() {
  const g = new THREE.Group();
  const ter = makeTerrain({ size: 9000, seg: 400, cx: 0, cz: -1800, height: duneHeight, color: desertColor });
  g.add(ter);
  g.add(buildMesas());
  const derricks = [];
  for (const [x, z] of [[1100, -1700], [1250, -1950], [980, -2250], [1400, -2400]]) {
    const d = makeDerrick(); d.position.set(x, desertHeight(x, z) - 1, z); d.rotation.y = x * 0.01; g.add(d); derricks.push(d);
  }
  const dust = new SpritePool(260, { tex: smokeTex() }); g.add(dust.mesh);
  const flares = new SpritePool(40, { additive: true }); g.add(flares.mesh);
  return { group: g, height: desertHeight, dust, flares, derricks };
}

/* =================== NORTHREACH =================== */
const LAKE = { x: 0, z: -950, r: 1050 };
export function arcticHeight(x, z) {
  const rd = Math.hypot(x - LAKE.x, (z - LAKE.z) * 0.8);
  const m = Math.pow(ridged(x * 0.0003 + 1.1, z * 0.0003 + 5.3, 6), 2.0) * 1500 + fbm(x * 0.0012, z * 0.0012, 4) * 40;
  let h = 20 + m * sstep(1300, 3600, rd) + 25 * sstep(900, 1600, rd);
  const edge = LAKE.r + noise2(x * 0.002, z * 0.002) * 160;
  h = lerp(3, h, sstep(edge - 40, edge + 200, rd));
  // the station's flat shelf on the south shore
  const sd = Math.hypot(x, z);
  h = lerp(9, h, sstep(260, 520, sd));
  return h;
}
function arcticColor(x, z, h, ny, c) {
  const n = noise2(x * 0.006, z * 0.006) * 0.5 + 0.5;
  c.setRGB(0.86 + n * 0.05, 0.9 + n * 0.04, 0.96);
  if (ny < 0.78) c.lerp(new THREE.Color(0.12, 0.13, 0.16), sstep(0.78, 0.5, ny) * 0.9);
  if (h < 4.5) c.setRGB(0.42, 0.62, 0.78);
}
export function buildArctic() {
  const g = new THREE.Group();
  const ter = makeTerrain({ size: 15000, seg: 340, cx: 0, cz: -2500, height: arcticHeight, color: arcticColor, roughness: 0.8 });
  g.add(ter);
  const ice = new THREE.Mesh(new THREE.CircleGeometry(LAKE.r + 260, 64), new THREE.MeshStandardMaterial({ color: 0x8fb4cc, roughness: 0.12, metalness: 0.1, envMapIntensity: 1.6 }));
  ice.rotation.x = -Math.PI / 2; ice.position.set(LAKE.x, 3.6, LAKE.z); ice.scale.set(1, 1.25, 1); ice.receiveShadow = true; g.add(ice);
  const st = makeStation(); st.position.set(0, 9, 0); g.add(st);
  // packed-snow runway with edge lights, east of the station
  const rw = new THREE.Mesh(new THREE.PlaneGeometry(40, 900), new THREE.MeshStandardMaterial({ color: 0xd8dde4, roughness: 0.95 }));
  rw.rotation.x = -Math.PI / 2; rw.position.set(190, 9.15, -120); g.add(rw);
  const lights = new SpritePool(120, { additive: true, fog: false }); g.add(lights.mesh);
  const snow = new SpritePool(700, { additive: false }); g.add(snow.mesh);
  return { group: g, height: arcticHeight, station: st, lights, snow };
}

/* =================== MOUNT KAELA =================== */
export const VOLC = { r: 2900, h: 980, crater: 300, cdepth: 190 };
export function volcHeight(x, z) {
  const vd = Math.hypot(x, z);
  const t = 1 - vd / (VOLC.r * 1.35);
  const cone = Math.pow(Math.max(0, 1 - vd / VOLC.r), 1.45) * VOLC.h;
  const shelf = -80 + 92 * sstep(0, 0.4, t);
  const gully = 1 + 0.13 * Math.sin(Math.atan2(z, x) * 11 + vd * 0.004) * (vd / VOLC.r);
  let top = shelf + cone * gully + fbm(x * 0.002, z * 0.002, 4) * 18 * sstep(0, 0.3, t);
  if (vd < VOLC.crater) top -= Math.pow(1 - vd / VOLC.crater, 1.3) * VOLC.cdepth;
  return top;
}
function volcColor(x, z, h, ny, c) {
  const vd = Math.hypot(x, z);
  const n = noise2(x * 0.005, z * 0.005) * 0.5 + 0.5;
  if (h < 70 && vd > VOLC.r * 0.55) c.setRGB(0.04 + n * 0.02, 0.09 + n * 0.04, 0.03).lerp(new THREE.Color(0.02, 0.018, 0.017), sstep(30, 70, h));
  else c.setRGB(0.022 + n * 0.012, 0.02 + n * 0.01, 0.019).lerp(new THREE.Color(0.11, 0.1, 0.09), sstep(500, 900, h) * 0.8);
  if (h < 2) c.setRGB(0.05, 0.045, 0.04);
}
export const LAVA_CHANNELS = [0.4, 1.5, 2.45, 3.6, 4.7, 5.6];
export function buildVolcano() {
  const g = new THREE.Group();
  const ter = makeTerrain({ size: 9000, seg: 380, height: volcHeight, color: volcColor });
  g.add(ter);
  const lavaMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uHeat: { value: 1 } }, fog: false,
    vertexShader: `varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vec4 w = modelMatrix*vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
    fragmentShader: GLSL_NOISE + `uniform float uTime, uHeat; varying vec2 vUv; varying vec3 vW;
      void main(){
        vec2 p = vW.xz*0.035;
        float n = vfbm(p + vec2(uTime*0.05, -uTime*0.03));
        float cr = vfbm(p*2.7 - vec2(uTime*0.02, uTime*0.04));
        float crust = smoothstep(0.42, 0.62, cr);
        vec3 hot = mix(vec3(6.0,1.6,0.25), vec3(9.0,5.0,1.2), smoothstep(0.5,0.8,n));
        vec3 col = mix(hot, vec3(0.05,0.02,0.015), crust*0.85);
        gl_FragColor = vec4(col*uHeat, 1.);
      }`
  });
  const lakeY = volcHeight(0, 0) + 8;
  const lake = new THREE.Mesh(new THREE.CircleGeometry(VOLC.crater * 0.55, 48), lavaMat);
  lake.rotation.x = -Math.PI / 2; lake.position.y = lakeY; g.add(lake);
  // lava channels as ribbons draped down the flanks
  const chanMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } }, transparent: true, depthWrite: false, fog: false,
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: GLSL_NOISE + `uniform float uTime; varying vec2 vUv;
      void main(){
        float across = 1.0 - abs(vUv.y*2.0-1.0);
        float flow = vfbm(vec2(vUv.x*40.0 - uTime*1.5, vUv.y*3.0));
        float heat = smoothstep(0.0, 0.5, across) * (0.55 + 0.6*flow) * (1.0 - vUv.x*0.55);
        vec3 col = mix(vec3(2.5,0.4,0.05), vec3(8.0,3.2,0.6), smoothstep(0.55,0.9,flow*across));
        gl_FragColor = vec4(col*heat, smoothstep(0.0,0.35,across));
      }`
  });
  for (const a0 of LAVA_CHANNELS) {
    const pts = [];
    for (let i = 0; i <= 80; i++) {
      const r = VOLC.crater * 0.95 + i * 22;
      const a = a0 + Math.sin(r * 0.004 + a0 * 3) * 0.12;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      pts.push(new THREE.Vector3(x, volcHeight(x, z) + 2.2, z));
    }
    const pos = [], uv = [], idx = [];
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], q = pts[Math.min(i + 1, pts.length - 1)], pr = pts[Math.max(i - 1, 0)];
      const dir = q.clone().sub(pr).normalize(), side = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
      const w = 16 + 10 * Math.sin(i * 0.3 + a0) - i * 0.08;
      const L = p.clone().addScaledVector(side, -w), R = p.clone().addScaledVector(side, w);
      L.y = volcHeight(L.x, L.z) + 2.2; R.y = volcHeight(R.x, R.z) + 2.2;
      pos.push(L.x, L.y, L.z, R.x, R.y, R.z); uv.push(i / 80, 0, i / 80, 1);
      if (i < pts.length - 1) { const b = i * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx);
    const m = new THREE.Mesh(geo, chanMat); g.add(m);
  }
  const trees = makeTreeMeshes(9000, 23, (r) => {
    const a = r() * 6.283, d = VOLC.r * (0.62 + r() * 0.62), x = Math.cos(a) * d, z = Math.sin(a) * d;
    const h = volcHeight(x, z); if (h < 4 || h > 65) return null;
    return { x, y: h, z, s: 0.9 + r() * 0.7, kind: 1, c: new THREE.Color(0.03 + r() * 0.02, 0.07 + r() * 0.03, 0.025) };
  });
  g.add(trees);
  const smoke = new SpritePool(420, { tex: smokeTex() }); g.add(smoke.mesh);
  const glow = new SpritePool(900, { additive: true }); g.add(glow.mesh);
  const light = new THREE.PointLight(0xff5a1a, 0, 5000, 2); light.position.set(0, lakeY + 80, 0); g.add(light);
  return { group: g, height: volcHeight, lavaMat, chanMat, smoke, glow, light, lakeY };
}

/* =================== CARRIER =================== */
export function buildCarrier() {
  const g = new THREE.Group();
  const carrier = makeCarrier(() => makeJet({ color: 0x737e88 }));
  g.add(carrier);
  const esc1 = makeEscort(); esc1.position.set(-900, 0, -1300); esc1.rotation.y = 0.0; g.add(esc1);
  const esc2 = makeEscort(); esc2.position.set(1200, 0, 900); g.add(esc2);
  // wake: a long foam ribbon behind the stern
  const wakeMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uSun: { value: new THREE.Color(1, 0.8, 0.6) } }, transparent: true, depthWrite: false,
    vertexShader: `varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vec4 w = modelMatrix*vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
    fragmentShader: GLSL_NOISE + `uniform float uTime; uniform vec3 uSun; varying vec2 vUv; varying vec3 vW;
      void main(){
        float along = vUv.y;   // 0 at the stern
        float across = abs(vUv.x*2.0-1.0);
        float n = vfbm(vec2(vW.x*0.05, vW.z*0.02 - uTime*0.6));
        float n2 = vfbm(vec2(vW.x*0.14, vW.z*0.08 - uTime*1.2));
        float core = smoothstep(0.95, 0.1, across) * (1.0 - along*0.9);
        float edges = smoothstep(0.5, 0.82, across) * smoothstep(1.0, 0.84, across) * (1.0 - along*0.7);
        float foam = smoothstep(0.35, 0.75, n*0.6+n2*0.5) * (core*0.95 + edges*0.8);
        foam *= smoothstep(1.0, 0.5, along);
        vec3 col = mix(vec3(0.55,0.6,0.65), vec3(1.0), n2) * (0.35 + 0.65*uSun);
        gl_FragColor = vec4(col, foam*0.85);
      }`
  });
  const wake = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, 1, 1), wakeMat);
  {
    // trapezoid: 44 m wide at the stern, 340 m at 2.6 km
    const geo = new THREE.BufferGeometry();
    const P = [], U = [], I = [], N = 40;
    for (let i = 0; i <= N; i++) {
      const s = i / N, z = 150 + s * 2600, w = 22 + s * 170;
      P.push(-w, 0.6, z, w, 0.6, z); U.push(0, s, 1, s);
      if (i < N) { const b = i * 2; I.push(b, b + 2, b + 1, b + 1, b + 2, b + 3); }
    }
    geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); geo.setIndex(I);
    wake.geometry = geo;
  }
  g.add(wake);
  const launchJet = makeJet({ color: 0x8a959f });
  g.add(launchJet);
  // deck crew: color-coded flight-deck sailors (models.js makeDeckCrew); crew[0] is the shooter
  const crew = [];
  const DYc = carrier.userData.DY + 0.005;   // the deck slab's top face is at DY
  const JC = { yellow: 0xe8c21a, green: 0x2e9e3a, red: 0xd82a1a, purple: 0x6b3aa8, white: 0xf0f0ea, brown: 0x6b4a2b };
  const skins = [0xc08a62, 0x8a5a3c, 0xe0b090, 0x6e4630, 0xd09a70];
  const face = (x, z, tx, tz) => Math.atan2(-(tx - x), -(tz - z));
  // [x, z, jersey, pose, k, look-at x, look-at z]
  const crewSpots = [
    [4, -98, 'yellow', 'shooter', 0, -10, -86],   // shooter: faces the jet; pose('shooter', k) turns him toward the bow
    [-5.2, -94, 'green', 'kneel', 1, -10, -92],
    [-15.5, -95, 'green', 'stand', 1, -10, -91],
    [-1, -108, 'white', 'stand', 1, -10, -86],
    [-22, -100, 'yellow', 'wave', 1, -10, -86],
    [11, -105, 'red', 'kneel', 1, -10, -90],
    [-24, -78, 'purple', 'stand', 1, -10, -82],
    [-4.6, -87.5, 'brown', 'stand', 1, -10, -86],
    [-4, -128, 'green', 'stand', 1, -10, -95],
  ];
  crewSpots.forEach(([x, z, jc, pose, k, tx, tz], i) => {
    let turn = i === 0 ? face(x, z, -10, -104) - face(x, z, tx, tz) : 0;
    turn = Math.atan2(Math.sin(turn), Math.cos(turn));
    const p = makeDeckCrew(JC[jc], { skin: skins[i % skins.length], shooterTurn: turn });
    p.userData.pose(pose === 'shooter' ? 'stand' : pose, k);   // the shooter stands until trailer.js drives pose('shooter', k)
    p.position.set(x, DYc, z); p.rotation.y = face(x, z, tx, tz);
    g.add(p); crew.push(p);
  });
  const steam = new SpritePool(220, { tex: smokeTex() }); g.add(steam.mesh);
  const deckGlow = new SpritePool(30, { additive: true }); g.add(deckGlow.mesh);
  return { group: g, carrier, launchJet, wakeMat, crew, steam, deckGlow, esc: [esc1, esc2] };
}

/* =================== HYPER SKY =================== */
export function buildHyper() {
  const g = new THREE.Group();
  const clouds = new SpritePool(1400, { tex: smokeTex() }); g.add(clouds.mesh);
  const r = rng(99), puffs = [];
  for (let i = 0; i < 230; i++) puffs.push({ x: (r() - 0.5) * 9000, z: r() * 12000, y: -620 + r() * 120, s: 160 + r() * 260, b: 0.75 + r() * 0.25 });
  // speed lines
  const lineGeo = new THREE.BoxGeometry(0.12, 0.12, 1);
  const lineMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 2.4, 4.0), transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  const lines = new THREE.InstancedMesh(lineGeo, lineMat, 260); lines.frustumCulled = false; g.add(lines);
  const lineSeeds = []; for (let i = 0; i < 260; i++) { const a = r() * 6.283, rad = 9 + r() * 70; lineSeeds.push({ x: Math.cos(a) * rad, y: Math.sin(a) * rad * 0.7, z: r() * 1200, k: 0.5 + r() }); }
  // vapor cone + shock ring
  const vcMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: { uA: { value: 0 }, uTime: { value: 0 } },
    vertexShader: `varying vec3 vN; varying vec3 vV; varying vec2 vUv; void main(){ vUv = uv; vN = normalize(normalMatrix*normal); vec4 mv = modelViewMatrix*vec4(position,1.); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
    fragmentShader: GLSL_NOISE + `uniform float uA, uTime; varying vec3 vN; varying vec3 vV; varying vec2 vUv;
      void main(){ float f = 1.0 - abs(dot(normalize(vN), normalize(vV))); float n = vfbm(vec2(vUv.x*14.0, vUv.y*4.0 - uTime*3.0));
        float a = pow(f, 1.4) * (0.4 + 0.8*n) * uA * smoothstep(0.0, 0.25, vUv.y) * smoothstep(1.0, 0.7, vUv.y);
        gl_FragColor = vec4(vec3(1.0,1.0,1.02)*1.4, a); }`
  });
  const vcGeo = new THREE.ConeGeometry(7, 16, 40, 8, true); vcGeo.rotateX(Math.PI / 2); vcGeo.translate(0, 0, 4);
  const vapor = new THREE.Mesh(vcGeo, vcMat); vapor.frustumCulled = false; g.add(vapor);
  const ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.5, 3.0, 4.0), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 64), ringMat); ring.frustumCulled = false; g.add(ring);
  return { group: g, clouds, puffs, lines, lineSeeds, vapor, vcMat, ring, ringMat };
}
