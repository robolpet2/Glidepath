// GLIDEPATH — "Weapons Free". A 35 s combat trailer rendered with three.js.
// Every object here is procedural: no game footage, models or textures.
// render(t) is a pure function of time, so frames can be captured in any order.
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { Water } from 'three/addons/objects/Water.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export const DUR = 35;
export const OUT_W = 1920, OUT_H = 1080;
const RW = 1920, RH = 804;               // 2.39:1 picture
const BAR = (OUT_H - RH) / 2;

/* ------------------------------------------------------------------ utils */
const V3 = THREE.Vector3;
const v3 = (x = 0, y = 0, z = 0) => new V3(x, y, z);
const UP = v3(0, 1, 0);
const TAU = Math.PI * 2;
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const seg = (t, a, b) => clamp((t - a) / (b - a));
const sm = t => t * t * (3 - 2 * t);
const ss = (a, b, t) => sm(seg(t, a, b));
const eout = t => 1 - Math.pow(1 - t, 3);
const eio = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const expo = t => t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
function hr(i, k = 0) {
  let h = Math.imul((i | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((k | 0) + 0x632be5ab, 0xc2b2ae35);
  h ^= h >>> 16; h = Math.imul(h, 0x7feb352d); h ^= h >>> 15; h = Math.imul(h, 0x846ca68b); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
const hs = (i, k) => hr(i, k) * 2 - 1;
function hdir(i, k) { const u = hs(i, k), a = hr(i, k + 1) * TAU, r = Math.sqrt(1 - u * u); return v3(r * Math.cos(a), u, r * Math.sin(a)); }
function vnoise(x, z, seed = 0) {
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz);
  const h = (a, b) => hr(Math.imul(a, 73856093) ^ Math.imul(b, 19349663), seed);
  return lerp(lerp(h(ix, iz), h(ix + 1, iz), ux), lerp(h(ix, iz + 1), h(ix + 1, iz + 1), ux), uz) * 2 - 1;
}
// s(u) for a time-warp with rate(u); s(uAt) = sAt
function makeWarp(rate, u0, u1, uAt, sAt) {
  const N = 600, du = (u1 - u0) / N, tab = [0];
  for (let i = 0; i < N; i++) tab.push(tab[i] + rate(u0 + (i + .5) * du) * du);
  const at = u => { const x = clamp((u - u0) / du, 0, N - 1e-6), i = Math.floor(x); return lerp(tab[i], tab[i + 1], x - i); };
  const off = sAt - at(uAt);
  return u => at(u) + off;
}

/* ------------------------------------------------------------------ renderer */
export const outCanvas = document.createElement('canvas');
outCanvas.width = OUT_W; outCanvas.height = OUT_H;
const out = outCanvas.getContext('2d');
const glCanvas = document.createElement('canvas');
const renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: false, preserveDrawingBuffer: true, logarithmicDepthBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(1);
renderer.setSize(RW, RH, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = .36;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, RW / RH, .25, 400000);
const SUN = v3(-.72, .105, -.68).normalize();
const SUNH = v3(SUN.x, 0, SUN.z).normalize();
const FOG = { color: new THREE.Color().setRGB(.5, .52, .58), density: 2.6e-5 };
scene.fog = new THREE.FogExp2(FOG.color, FOG.density);
const fogU = { fogColor: { value: FOG.color }, fogDensity: { value: FOG.density } };

/* sky + environment */
function makeSky(scale) {
  const s = new Sky(); s.scale.setScalar(scale);
  const u = s.material.uniforms;
  u.turbidity.value = 2.6; u.rayleigh.value = 2.4; u.mieCoefficient.value = .004; u.mieDirectionalG.value = .9;
  u.sunPosition.value.copy(SUN);
  return s;
}
scene.add(makeSky(350000));
{
  const pm = new THREE.PMREMGenerator(renderer);
  const es = new THREE.Scene(); es.add(makeSky(1500));
  const ground = new THREE.Mesh(new THREE.CircleGeometry(1400, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(.05, .07, .09) }));
  ground.position.y = -40; es.add(ground);
  scene.environment = pm.fromScene(es, 0, .1, 6000).texture;
  scene.environmentIntensity = .9;
}
const sunLight = new THREE.DirectionalLight(new THREE.Color().setRGB(1, .74, .5), 3.4);
sunLight.position.copy(SUN).multiplyScalar(1000);
scene.add(sunLight);
scene.add(new THREE.HemisphereLight(new THREE.Color().setRGB(.42, .52, .72), new THREE.Color().setRGB(.1, .09, .08), .55));
const flashLight = new THREE.PointLight(new THREE.Color().setRGB(1, .55, .2), 0, 600, 2);
scene.add(flashLight);

/* ------------------------------------------------------------------ terrain */
const ISLANDS = [{ x: 0, z: 0, r: 2700, h: 1250 }, { x: 4200, z: -1800, r: 1500, h: 600 }, { x: -3900, z: 2300, r: 1600, h: 520 }, { x: 1800, z: 3900, r: 950, h: 260 }, { x: 600, z: -3800, r: 1200, h: 380 }];
function rawH(x, z) {
  let b = 0;
  for (const i of ISLANDS) { const dx = (x - i.x) / i.r, dz = (z - i.z) / i.r; b += i.h * Math.exp(-(dx * dx + dz * dz) * 1.5); }
  let r = 0, a = .5, f = .00042;
  for (let o = 0; o < 6; o++) { const n = 1 - Math.abs(vnoise(x * f, z * f, o)); r += n * n * a; a *= .5; f *= 2.05; }
  return b * (.3 + 1.05 * r) + vnoise(x * .0011, z * .0011, 9) * 40 + vnoise(x * .004, z * .004, 10) * 10 - 75;
}
export const SITE = v3(1500, 0, 1700);
const SITE_H = Math.max(140, rawH(SITE.x, SITE.z) * .8);
SITE.y = SITE_H;
function terrainH(x, z) {
  const d = Math.hypot(x - SITE.x, z - SITE.z);
  return lerp(rawH(x, z), SITE_H + vnoise(x * .02, z * .02, 11) * 1.5 * seg(d, 70, 200), sm(seg(d, 440, 200)));
}
{
  const S = 17000, N = 420;
  const g = new THREE.PlaneGeometry(S, S, N, N); g.rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, terrainH(p.getX(i), p.getZ(i)));
  g.computeVertexNormals();
  const n = g.attributes.normal, col = new Float32Array(p.count * 3);
  const C = (r, gg, b) => [r, gg, b];
  const sand = C(.55, .47, .33), grass = C(.11, .14, .05), dry = C(.26, .22, .12), rock = C(.2, .18, .16), snow = C(.85, .87, .9), wet = C(.16, .17, .14);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), h = p.getY(i), ny = n.getY(i);
    const nz = vnoise(x * .004, z * .004, 21) * .5 + .5, nf = vnoise(x * .03, z * .03, 22) * .5 + .5;
    let c = grass.map((v, k) => lerp(v, dry[k], nz));
    if (h < 14) c = sand.map((v, k) => lerp(v, c[k], seg(h, 6, 14)));
    if (h < 2) c = wet;
    const steep = ss(.18, .42, 1 - ny);
    c = c.map((v, k) => lerp(v, rock[k], steep));
    const sn = ss(980, 1080, h + nz * 120) * ss(.55, .75, ny);
    c = c.map((v, k) => lerp(v, snow[k], sn) * (.82 + .36 * nf));
    col.set(c, i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .95, metalness: 0, envMapIntensity: .4 }));
  scene.add(m);
}

/* ------------------------------------------------------------------ ocean */
function waterNormals() {
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S;
  const x = c.getContext('2d'), img = x.createImageData(S, S), waves = [];
  for (let i = 0; i < 40; i++) {
    const sc = 1 + i * .45, kx = Math.round(hs(i, 1) * sc), ky = Math.round(hs(i, 2) * sc);
    if (!kx && !ky) continue;
    waves.push({ kx, ky, a: 1 / Math.pow(Math.hypot(kx, ky), 1.2), p: hr(i, 3) * TAU });
  }
  for (let y = 0; y < S; y++) for (let xx = 0; xx < S; xx++) {
    let dx = 0, dy = 0;
    for (const w of waves) { const c2 = Math.cos(TAU * (w.kx * xx + w.ky * y) / S + w.p) * w.a; dx += w.kx * c2; dy += w.ky * c2; }
    const v = new V3(-dx * .18, -dy * .18, 1).normalize(), o = (y * S + xx) * 4;
    img.data[o] = (v.x * .5 + .5) * 255; img.data[o + 1] = (v.y * .5 + .5) * 255; img.data[o + 2] = (v.z * .5 + .5) * 255; img.data[o + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.NoColorSpace;
  return t;
}
const water = new Water(new THREE.PlaneGeometry(400000, 400000), {
  textureWidth: 1024, textureHeight: 512, waterNormals: waterNormals(), sunDirection: SUN.clone(),
  sunColor: new THREE.Color().setRGB(1, .8, .55), waterColor: new THREE.Color().setRGB(.012, .05, .07), distortionScale: 2.6, fog: true,
});
water.rotation.x = -Math.PI / 2;
water.material.uniforms.size.value = 1.6;
scene.add(water);

/* ------------------------------------------------------------------ textures */
function canvasTex(S, draw, srgb = true) {
  const c = document.createElement('canvas'); c.width = c.height = S;
  draw(c.getContext('2d'), S);
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const puffTex = canvasTex(128, (x, S) => {
  for (let i = 0; i < 14; i++) {
    const cx = S / 2 + hs(i, 1) * S * .17, cy = S / 2 + hs(i, 2) * S * .17, r = S * (.16 + hr(i, 3) * .2);
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, 'rgba(255,255,255,.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.beginPath(); x.arc(cx, cy, r, 0, TAU); x.fill();
  }
  const d = x.getImageData(0, 0, S, S);
  for (let i = 0; i < d.data.length; i += 4) {
    const px = (i / 4) % S - S / 2, py = Math.floor(i / 4 / S) - S / 2, rr = Math.hypot(px, py) / (S / 2);
    d.data[i + 3] = Math.min(255, d.data[i + 3] * 1.35) * clamp(1 - rr * rr);
  }
  x.putImageData(d, 0, 0);
}, false);
const fireTex = canvasTex(64, (x, S) => {
  const g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.25, 'rgba(255,255,255,.7)'); g.addColorStop(.6, 'rgba(255,255,255,.18)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, S, S);
}, false);
const ringTex = canvasTex(128, (x, S) => {
  const g = x.createRadialGradient(S / 2, S / 2, S * .3, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.75, 'rgba(255,255,255,.8)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, S, S);
}, false);
function panelTex(base, seed, red) {
  return canvasTex(512, (x, S) => {
    x.fillStyle = base; x.fillRect(0, 0, S, S);
    for (let i = 0; i < 260; i++) {
      x.fillStyle = `rgba(${hr(i, seed) > .5 ? '255,255,255' : '0,0,0'},${.025 + hr(i, seed + 1) * .03})`;
      x.beginPath(); x.arc(hr(i, seed + 2) * S, hr(i, seed + 3) * S, 10 + hr(i, seed + 4) * 60, 0, TAU); x.fill();
    }
    x.strokeStyle = 'rgba(0,0,0,.28)'; x.lineWidth = 1.2;
    for (let i = 0; i < 9; i++) { const y = (i + .5) * S / 9 + hs(i, seed + 5) * 8; x.beginPath(); x.moveTo(0, y); x.lineTo(S, y); x.stroke(); }
    for (let i = 0; i < 40; i++) {
      const xx = hr(i, seed + 6) * S, y0 = Math.floor(hr(i, seed + 7) * 9) * S / 9;
      x.beginPath(); x.moveTo(xx, y0); x.lineTo(xx, y0 + S / 9); x.stroke();
    }
    x.fillStyle = 'rgba(0,0,0,.35)';
    for (let i = 0; i < 300; i++) x.fillRect(hr(i, seed + 8) * S, hr(i, seed + 9) * S, 1.6, 1.6);
    if (red) { x.fillStyle = red; x.fillRect(0, 0, S, S * .36); x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(0, S * .36, S, 3); }
  });
}

/* ------------------------------------------------------------------ billboard + streak pools */
const BB_V = `
#include <common>
#include <logdepthbuf_pars_vertex>
attribute vec4 iPos; attribute vec4 iCol; attribute float iRot;
varying vec2 vUv; varying vec4 vCol; varying float vDepth;
void main(){
  vec4 mv = modelViewMatrix * vec4(iPos.xyz, 1.0);
  float c = cos(iRot), s = sin(iRot);
  vec2 q = position.xy * iPos.w;
  mv.xy += vec2(c*q.x - s*q.y, s*q.x + c*q.y);
  gl_Position = projectionMatrix * mv;
  vUv = uv; vCol = iCol; vDepth = -mv.z;
  #include <logdepthbuf_vertex>
}`;
const BB_F = `
#include <logdepthbuf_pars_fragment>
uniform sampler2D map; uniform vec3 fogColor; uniform float fogDensity; uniform float additive;
varying vec2 vUv; varying vec4 vCol; varying float vDepth;
void main(){
  #include <logdepthbuf_fragment>
  vec4 t = texture2D(map, vUv);
  float f = 1.0 - exp(-fogDensity*fogDensity*vDepth*vDepth);
  float a = t.a * vCol.a;
  if (additive > 0.5) gl_FragColor = vec4(vCol.rgb * t.rgb * (1.0 - f), a);
  else gl_FragColor = vec4(mix(vCol.rgb * t.rgb, fogColor, f), a * mix(1.0, 0.7, f));
  // soften near-camera billboards so the lens can fly through smoke
  gl_FragColor.a *= smoothstep(1.5, 16.0, vDepth);
}`;
class Pool {
  constructor(max, tex, additive, sort, order) {
    this.max = max; this.n = 0; this.sort = sort;
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-.5, -.5, 0, .5, -.5, 0, -.5, .5, 0, .5, .5, 0], 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 1, 1], 2));
    g.setIndex([0, 1, 2, 2, 1, 3]);
    this.p = new Float32Array(max * 4); this.c = new Float32Array(max * 4); this.r = new Float32Array(max);
    this.P = new Float32Array(max * 4); this.Cc = new Float32Array(max * 4); this.R = new Float32Array(max);
    this.aP = new THREE.InstancedBufferAttribute(this.P, 4).setUsage(THREE.DynamicDrawUsage);
    this.aC = new THREE.InstancedBufferAttribute(this.Cc, 4).setUsage(THREE.DynamicDrawUsage);
    this.aR = new THREE.InstancedBufferAttribute(this.R, 1).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('iPos', this.aP); g.setAttribute('iCol', this.aC); g.setAttribute('iRot', this.aR);
    g.instanceCount = 0;
    this.mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: tex }, additive: { value: additive ? 1 : 0 }, ...fogU },
      vertexShader: BB_V, fragmentShader: BB_F, transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.mesh = new THREE.Mesh(g, this.mat); this.mesh.frustumCulled = false; this.mesh.renderOrder = order;
    this.geo = g; this.idx = new Uint32Array(max); this.key = new Float32Array(max);
    scene.add(this.mesh);
  }
  reset() { this.n = 0; }
  add(p, size, r, g, b, a, rot = 0) {
    if (this.n >= this.max || a <= .002 || size <= 0) return;
    const i = this.n++, o = i * 4;
    this.p[o] = p.x; this.p[o + 1] = p.y; this.p[o + 2] = p.z; this.p[o + 3] = size;
    this.c[o] = r; this.c[o + 1] = g; this.c[o + 2] = b; this.c[o + 3] = a; this.r[i] = rot;
  }
  commit() {
    const n = this.n, cp = camera.position;
    for (let i = 0; i < n; i++) {
      this.idx[i] = i;
      const dx = this.p[i * 4] - cp.x, dy = this.p[i * 4 + 1] - cp.y, dz = this.p[i * 4 + 2] - cp.z;
      this.key[i] = dx * dx + dy * dy + dz * dz;
    }
    const idx = Array.from(this.idx.subarray(0, n));
    if (this.sort) idx.sort((a, b) => this.key[b] - this.key[a]);
    idx.forEach((s, d) => {
      for (let k = 0; k < 4; k++) { this.P[d * 4 + k] = this.p[s * 4 + k]; this.Cc[d * 4 + k] = this.c[s * 4 + k]; }
      this.R[d] = this.r[s];
    });
    this.geo.instanceCount = n;
    this.aP.needsUpdate = this.aC.needsUpdate = this.aR.needsUpdate = true;
  }
}
const ST_V = `
#include <common>
#include <logdepthbuf_pars_vertex>
attribute vec4 iA; attribute vec4 iB; attribute vec4 iCol;
varying vec2 vUv; varying vec4 vCol; varying float vDepth;
void main(){
  vec4 a = modelViewMatrix * vec4(iA.xyz, 1.0), b = modelViewMatrix * vec4(iB.xyz, 1.0);
  vec4 p = mix(a, b, position.x);
  vec2 d = b.xy / max(-b.z, 0.05) - a.xy / max(-a.z, 0.05);
  vec2 side = normalize(vec2(-d.y, d.x) + vec2(1e-5));
  p.xy += side * position.y * iA.w;
  gl_Position = projectionMatrix * p;
  vUv = vec2(position.x, position.y * 0.5 + 0.5); vCol = iCol; vDepth = -p.z;
  #include <logdepthbuf_vertex>
}`;
const ST_F = `
#include <logdepthbuf_pars_fragment>
uniform float fogDensity;
varying vec2 vUv; varying vec4 vCol; varying float vDepth;
void main(){
  #include <logdepthbuf_fragment>
  float across = 1.0 - abs(vUv.y * 2.0 - 1.0);
  float a = across * across * mix(0.15, 1.0, vUv.x) * vCol.a;
  float f = 1.0 - exp(-fogDensity*fogDensity*vDepth*vDepth);
  gl_FragColor = vec4(vCol.rgb * (1.0 - f), a);
}`;
class Streaks {
  constructor(max) {
    this.max = max; this.n = 0;
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([0, -1, 0, 1, -1, 0, 0, 1, 0, 1, 1, 0], 3));
    g.setIndex([0, 1, 2, 2, 1, 3]);
    this.A = new Float32Array(max * 4); this.B = new Float32Array(max * 4); this.C = new Float32Array(max * 4);
    this.aA = new THREE.InstancedBufferAttribute(this.A, 4).setUsage(THREE.DynamicDrawUsage);
    this.aB = new THREE.InstancedBufferAttribute(this.B, 4).setUsage(THREE.DynamicDrawUsage);
    this.aC = new THREE.InstancedBufferAttribute(this.C, 4).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('iA', this.aA); g.setAttribute('iB', this.aB); g.setAttribute('iCol', this.aC);
    g.instanceCount = 0; this.geo = g;
    const m = new THREE.ShaderMaterial({ uniforms: { ...fogU }, vertexShader: ST_V, fragmentShader: ST_F, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    this.mesh = new THREE.Mesh(g, m); this.mesh.frustumCulled = false; this.mesh.renderOrder = 5;
    scene.add(this.mesh);
  }
  reset() { this.n = 0; }
  add(a, b, w, r, g, bb, al) {
    if (this.n >= this.max || al <= .002) return;
    const o = this.n++ * 4;
    this.A[o] = a.x; this.A[o + 1] = a.y; this.A[o + 2] = a.z; this.A[o + 3] = w;
    this.B[o] = b.x; this.B[o + 1] = b.y; this.B[o + 2] = b.z;
    this.C[o] = r; this.C[o + 1] = g; this.C[o + 2] = bb; this.C[o + 3] = al;
  }
  commit() { this.geo.instanceCount = this.n; this.aA.needsUpdate = this.aB.needsUpdate = this.aC.needsUpdate = true; }
}
const clouds = new Pool(5200, puffTex, false, true, 1);
const smoke = new Pool(14000, puffTex, false, true, 2);
const fire = new Pool(9000, fireTex, true, false, 3);
const rings = new Pool(64, ringTex, true, false, 4);
const streaks = new Streaks(4000);

/* static cumulus field */
const CLOUD_PUFFS = [];
function cloudCluster(c, r, n, seed, flat = .42) {
  for (let i = 0; i < n; i++) {
    const d = hdir(seed * 977 + i, 1);
    const k = Math.pow(hr(seed * 977 + i, 3), .5);
    const o = v3(d.x * r * k, Math.max(-.18, d.y) * r * flat * k + r * .12, d.z * r * k);
    const size = r * (.55 + hr(seed * 977 + i, 4) * .55) * (1 - k * .35);
    const dirLit = clamp(.55 + .55 * o.clone().normalize().dot(SUN) + .35 * o.y / r);
    const top = v3(4.2, 3.1, 2.2), bot = v3(.62, .66, .84);
    const col = bot.clone().lerp(top, dirLit);
    CLOUD_PUFFS.push({ p: c.clone().add(o), s: size, c: col, rot: hr(seed * 977 + i, 5) * TAU });
  }
}
for (let i = 0; i < 70; i++) {
  const c = v3(hs(i, 50) * 22000, 2050 + hs(i, 51) * 250, hs(i, 52) * 22000);
  if (Math.hypot(c.x - SITE.x, c.z - SITE.z) < 2600) continue;
  cloudCluster(c, 260 + hr(i, 53) * 260, 30, i);
}
// a carpet beneath the opening shot, and the cloud bank the bandits dive out of
for (let i = 0; i < 26; i++) cloudCluster(v3(-3300 + hs(i, 60) * 2600, 2050, 8000 + hs(i, 61) * 2600 - 1500), 280 + hr(i, 62) * 200, 26, 200 + i, .36);
cloudCluster(v3(-1400, 1330, -4260), 230, 34, 400); cloudCluster(v3(-1250, 1300, -4380), 180, 24, 401); cloudCluster(v3(-1600, 1350, -4400), 200, 24, 402);

/* ------------------------------------------------------------------ aircraft */
function extrude(shape, depth, bevel = .05) {
  return new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, curveSegments: 4 });
}
function shape(pts) { const s = new THREE.Shape(); pts.forEach(([x, y], i) => i ? s.lineTo(x, y) : s.moveTo(x, y)); s.closePath(); return s; }
const plumeMat = () => new THREE.ShaderMaterial({
  uniforms: { uT: { value: 0 }, uAB: { value: 1 }, uHot: { value: new THREE.Color(1, .82, .62) }, uCool: { value: new THREE.Color(1, .38, .12) } },
  vertexShader: `
    #include <common>
    #include <logdepthbuf_pars_vertex>
    varying float vL; varying vec3 vN; varying vec3 vV;
    void main(){ vL = -position.z; vec4 mv = modelViewMatrix*vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv;
      #include <logdepthbuf_vertex>
    }`,
  fragmentShader: `
    #include <logdepthbuf_pars_fragment>
    uniform float uT; uniform float uAB; uniform vec3 uHot; uniform vec3 uCool;
    varying float vL; varying vec3 vN; varying vec3 vV;
    void main(){
      #include <logdepthbuf_fragment>
      float edge = pow(abs(dot(normalize(vN), normalize(vV))), 1.6);
      float dia = 0.55 + 0.45 * sin(vL * 26.0 - uT * 50.0);
      vec3 c = mix(uHot, uCool, smoothstep(0.0, 0.55, vL));
      float a = edge * (1.0 - smoothstep(0.15, 1.0, vL)) * uAB * (0.85 + 0.15 * sin(uT * 97.0));
      gl_FragColor = vec4(c * a * 7.0 * dia, a);
    }`,
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
});
function makeMissile(scale = 1, color = .82) {
  const g = new THREE.Group();
  const m = new THREE.MeshStandardMaterial({ color: new THREE.Color().setRGB(color, color, color * .96), roughness: .45, metalness: .2 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x202020, roughness: .6 });
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(.09, .09, 2.9, 12).rotateX(Math.PI / 2), m));
  const nose = new THREE.Mesh(new THREE.ConeGeometry(.09, .38, 12).rotateX(Math.PI / 2), dark); nose.position.z = 1.64; g.add(nose);
  for (const [w, h, z] of [[.62, .02, -1.25], [.02, .62, -1.25], [.36, .02, .75], [.02, .36, .75]]) {
    const f = new THREE.Mesh(new THREE.BoxGeometry(w, h, .34), m); f.position.z = z; g.add(f);
  }
  g.scale.setScalar(scale);
  return g;
}
function makeJet(kind) {
  const enemy = kind === 'enemy';
  const g = new THREE.Group();
  const baseCol = enemy ? '#24262b' : '#8d959f';
  const lathTex = panelTex(baseCol, enemy ? 30 : 10);
  const worldTex = panelTex(baseCol, enemy ? 40 : 20); worldTex.wrapS = worldTex.wrapT = THREE.RepeatWrapping; worldTex.repeat.set(.12, .12);
  const skinL = new THREE.MeshStandardMaterial({ map: lathTex, metalness: .4, roughness: .48 });
  const skinW = new THREE.MeshStandardMaterial({ map: worldTex, metalness: .4, roughness: .5 });
  const tailTex = panelTex(baseCol, enemy ? 50 : 60, enemy ? '#c0120c' : '#18a9cf');
  tailTex.wrapS = tailTex.wrapT = THREE.RepeatWrapping; tailTex.repeat.set(1 / 10, 1 / 4.6);
  const tailM = new THREE.MeshStandardMaterial({ map: tailTex, metalness: .35, roughness: .5 });
  const darkMetal = new THREE.MeshStandardMaterial({ color: 0x3a3631, metalness: .9, roughness: .35, side: THREE.DoubleSide });
  const black = new THREE.MeshStandardMaterial({ color: 0x050506, roughness: .9 });
  // fuselage
  const prof = [[0, 8.8], [.2, 8.35], [.44, 7.5], [.68, 6.4], [.88, 5.2], [1.0, 3.8], [1.08, 2], [1.1, 0], [1.06, -3], [.98, -5.6], [.88, -7.4], [.82, -8.3]].map(([r, y]) => new THREE.Vector2(r, y));
  const fus = new THREE.LatheGeometry(prof, 32); fus.rotateX(Math.PI / 2); fus.scale(1.22, .84, 1);
  g.add(new THREE.Mesh(fus, skinL));
  // blended chine body
  const bodyG = extrude(shape([[0, 6.2], [1.0, 4.1], [1.78, 1.4], [2.05, -4.6], [1.7, -8.1], [-1.7, -8.1], [-2.05, -4.6], [-1.78, 1.4], [-1.0, 4.1]]), .42, .16);
  bodyG.rotateX(Math.PI / 2); bodyG.translate(0, .18, 0);
  g.add(new THREE.Mesh(bodyG, skinW));
  // wings
  const wingS = enemy ? [[1.5, 2.2], [6.3, -4.2], [6.3, -5.0], [1.5, -6.6]] : [[1.5, 1.6], [6.75, -3.9], [6.75, -5.1], [1.5, -6.4]];
  for (const sx of [1, -1]) {
    const w = new THREE.Mesh(extrude(shape(wingS), .14, .05).rotateX(Math.PI / 2).translate(0, -.02, 0), skinW); w.scale.x = sx; g.add(w);
    const st = new THREE.Mesh(extrude(shape([[1.1, -6.1], [4.5, -8.1], [4.5, -8.9], [1.1, -9.3]]), .1, .04).rotateX(Math.PI / 2).translate(0, -.08, 0), skinW); st.scale.x = sx; g.add(st);
    if (enemy) { const cn = new THREE.Mesh(extrude(shape([[1.1, 4.2], [2.9, 2.8], [2.9, 2.3], [1.1, 2.4]]), .08, .03).rotateX(Math.PI / 2).translate(0, .35, 0), skinW); cn.scale.x = sx; g.add(cn); }
    // intakes
    const ik = new THREE.Mesh(new THREE.BoxGeometry(.86, 1.0, 3.3), skinW); ik.position.set(sx * 1.55, -.18, .9); g.add(ik);
    const ih = new THREE.Mesh(new THREE.BoxGeometry(.66, .78, .1), black); ih.position.set(sx * 1.55, -.18, 2.58); g.add(ih);
  }
  // tails
  const tailShape = enemy ? [[-3.9, 0], [-7.0, 4.6], [-8.4, 4.6], [-8.8, 0]] : [[-4.6, 0], [-7.3, 3.5], [-8.55, 3.5], [-8.95, 0]];
  const tg = () => extrude(shape(tailShape), .14, .05).rotateY(-Math.PI / 2).translate(.07, 0, 0);
  if (enemy) { const t = new THREE.Mesh(tg(), tailM); t.position.set(0, .7, 0); g.add(t); }
  else for (const sx of [1, -1]) { const t = new THREE.Mesh(tg(), tailM); t.position.set(sx * 1.3, .5, 0); t.rotation.z = -sx * .42; g.add(t); }
  // canopy
  const can = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 18), new THREE.MeshPhysicalMaterial({ color: enemy ? 0x7a1010 : 0x9a7e46, metalness: .96, roughness: .07, clearcoat: 1, envMapIntensity: 1.4 }));
  can.scale.set(.6, .6, 2.15); can.position.set(0, .66, 3.95); g.add(can);
  // engines
  const nozzles = enemy ? [[0, .8]] : [[.62, .56], [-.62, .56]];
  const plumes = [], glows = [];
  for (const [x, r] of nozzles) {
    const nz = new THREE.Mesh(new THREE.CylinderGeometry(r * .9, r, 1.4, 22, 1, true).rotateX(Math.PI / 2), darkMetal); nz.position.set(x, -.02, -8.75); g.add(nz);
    const gl = new THREE.Mesh(new THREE.CircleGeometry(r * .82, 22).rotateY(Math.PI), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 1.2, .3) })); gl.position.set(x, -.02, -8.2); gl.userData.enemy = enemy; g.add(gl); glows.push(gl);
    for (const [len, rad, hot] of [[1, 1, 1], [.45, .55, 0]]) {
      const pm = plumeMat(); if (!hot) { pm.uniforms.uHot.value.setRGB(.75, .85, 1.3); pm.uniforms.uCool.value.setRGB(.9, .6, 1.0); }
      if (enemy) { if (hot) { pm.uniforms.uHot.value.setRGB(1, .55, .42); pm.uniforms.uCool.value.setRGB(1, .1, .05); } else { pm.uniforms.uHot.value.setRGB(1.2, .4, .4); pm.uniforms.uCool.value.setRGB(1, .15, .1); } }
      const pl = new THREE.Mesh(new THREE.CylinderGeometry(r * .78 * rad, r * .2, 1, 22, 1, true).translate(0, -.5, 0).rotateX(Math.PI / 2), pm);
      pl.position.set(x, -.02, -9.35); pl.userData.len = len; g.add(pl); plumes.push(pl);
    }
  }
  // identification lights: glowing strips along the spine, intakes and wing roots (cyan = friendly, red = bandit)
  const idCol = enemy ? new THREE.Color(5, .25, .15) : new THREE.Color(.25, 2.6, 3.6);
  const idMat = new THREE.MeshBasicMaterial({ color: idCol });
  for (const sx of [1, -1]) {
    const a = new THREE.Mesh(new THREE.BoxGeometry(.07, .07, 4.2), idMat); a.position.set(sx * 2.0, .3, -2.2); g.add(a);
    const b = new THREE.Mesh(new THREE.BoxGeometry(.07, .07, 2.2), idMat); b.position.set(sx * 1.99, -.2, 1.2); g.add(b);
    const w = new THREE.Mesh(new THREE.BoxGeometry(2.4, .05, .07), idMat); w.position.set(sx * (enemy ? 4.6 : 5.0), .07, enemy ? -2.4 : -2.9); w.rotation.y = sx * (enemy ? -.72 : -.79); g.add(w);
  }
  const sp = new THREE.Mesh(new THREE.BoxGeometry(.07, .07, 5), idMat); sp.position.set(0, .82, -1.8); g.add(sp);
  // nav lights
  for (const [x, c] of [[1, [6, .2, .1]], [-1, [.1, 4, .5]]]) {
    const l = new THREE.Mesh(new THREE.SphereGeometry(.09, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(...c) })); l.position.set(x * (enemy ? 6.35 : 6.8), 0, enemy ? -4.6 : -4.5); g.add(l);
  }
  // stores
  const stores = [];
  for (const [x, y, z] of [[6.85, -.12, -4.2], [-6.85, -.12, -4.2], [3.7, -.62, -2.9], [-3.7, -.62, -2.9]]) {
    if (enemy && Math.abs(x) > 6) continue;
    const m = makeMissile(1, enemy ? .6 : .85); m.position.set(x, y, z); g.add(m); stores.push(m);
  }
  // vapour cone (transonic)
  const vc = new THREE.Mesh(new THREE.ConeGeometry(4.3, 10, 40, 1, true).rotateX(Math.PI / 2), new THREE.ShaderMaterial({
    uniforms: { uO: { value: 0 }, uT: { value: 0 } },
    vertexShader: `
      #include <common>
      #include <logdepthbuf_pars_vertex>
      varying vec3 vN; varying vec3 vV; varying vec3 vP;
      void main(){ vP = position; vec4 mv = modelViewMatrix*vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv;
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: `
      #include <logdepthbuf_pars_fragment>
      uniform float uO; uniform float uT; varying vec3 vN; varying vec3 vV; varying vec3 vP;
      void main(){
        #include <logdepthbuf_fragment>
        float rim = 1.0 - abs(dot(normalize(vN), normalize(vV)));
        float along = smoothstep(5.0, 2.0, vP.z) * smoothstep(-5.0, -1.0, vP.z);
        float n = 0.85 + 0.15 * sin(atan(vP.y, vP.x) * 23.0 + vP.z * 3.0 + uT * 9.0);
        gl_FragColor = vec4(vec3(2.4, 2.35, 2.3), pow(rim, 1.4) * along * n * uO);
      }`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
  }));
  vc.position.z = 1.2; vc.visible = false; g.add(vc);
  g.userData = {
    plumes, glows, stores, vc,
    ab(level, t) {
      for (const p of plumes) { p.material.uniforms.uT.value = t; p.material.uniforms.uAB.value = clamp(level * 1.3, .15, 1.3); p.scale.z = (1.2 + 7.5 * level) * p.userData.len; p.visible = level > .02; }
      for (const gl of glows) gl.userData.enemy ? gl.material.color.setRGB(3 + 6 * level, .4 + .5 * level, .2 + .2 * level) : gl.material.color.setRGB(2 + 5 * level, .9 + 1.6 * level, .25 + .5 * level);
    },
  };
  g.visible = false;
  scene.add(g);
  return g;
}
const P1 = makeJet('player'), P2 = makeJet('player');
const E1 = makeJet('enemy'), E2 = makeJet('enemy'), E3 = makeJet('enemy');
const JETS = [P1, P2, E1, E2, E3];
const MISSILES = Array.from({ length: 6 }, (_, i) => { const m = makeMissile(i >= 4 ? 2.4 : 1.15, i >= 4 ? .72 : .85); m.visible = false; scene.add(m); return m; });
const DEBRIS = Array.from({ length: 16 }, (_, i) => {
  const geo = i % 3 === 0 ? new THREE.BoxGeometry(2.6, .2, 1.6) : i % 3 === 1 ? new THREE.CylinderGeometry(.5, .6, 2.6, 8) : new THREE.TetrahedronGeometry(.9);
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x1c1b1a, roughness: .8, metalness: .3 }));
  m.visible = false; scene.add(m); return m;
});

/* ------------------------------------------------------------------ SAM site */
const site = new THREE.Group(); site.position.copy(SITE); scene.add(site);
const LAUNCH_AZ = Math.atan2(900, -600); // launchers face north-east, toward the attack run
const LAUNCHERS = [];
{
  const olive = new THREE.MeshStandardMaterial({ color: 0x3f4430, roughness: .85, metalness: .1 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x18191a, roughness: .9 });
  const tube = new THREE.MeshStandardMaterial({ color: 0x4a4e3a, roughness: .7, metalness: .2 });
  const truck = (x, z, rotY) => {
    const t = new THREE.Group(); t.position.set(x, 0, z); t.rotation.y = rotY;
    const ch = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.1, 9.5), olive); ch.position.y = 1.4; t.add(ch);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(2.5, 2.0, 2.3), olive); cab.position.set(0, 2.4, 3.7); t.add(cab);
    const ws = new THREE.Mesh(new THREE.BoxGeometry(2.3, .8, .05), dark); ws.position.set(0, 2.9, 4.86); t.add(ws);
    for (let i = 0; i < 4; i++) for (const sx of [-1, 1]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(.6, .6, .5, 16).rotateZ(Math.PI / 2), dark); w.position.set(sx * 1.25, .6, 3 - i * 2.1); t.add(w);
    }
    site.add(t); return t;
  };
  for (const [x, z] of [[0, 0], [34, -18]]) {
    const t = truck(x, z, LAUNCH_AZ);
    const piv = new THREE.Group(); piv.position.set(0, 2.2, -3.5); piv.rotation.x = -.95; t.add(piv);
    for (const [dx, dy] of [[-.45, .45], [.45, .45], [-.45, -.45], [.45, -.45]]) {
      const tb = new THREE.Mesh(new THREE.CylinderGeometry(.42, .42, 7.5, 16).rotateX(Math.PI / 2).translate(0, 0, 3.6), tube); tb.position.set(dx, dy + .6, 0); piv.add(tb);
      const cap = new THREE.Mesh(new THREE.CircleGeometry(.36, 16), dark); cap.position.set(dx, dy + .6, 7.36); piv.add(cap);
    }
    LAUNCHERS.push({ truck: t, piv });
  }
  const rt = truck(-46, 44, LAUNCH_AZ + .6);
  const radar = new THREE.Mesh(new THREE.BoxGeometry(4.2, 3.0, .3), olive); radar.position.set(0, 5.2, -2); rt.add(radar);
  site.userData.radar = radar;
  const berm = new THREE.Mesh(new THREE.TorusGeometry(22, 1.6, 6, 40).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x5b5238, roughness: 1 }));
  berm.scale.y = .6; site.add(berm);
  for (let i = 0; i < 5; i++) { const c = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.4, 6), olive); c.position.set(-60 + i * 7, 1.2, -40); site.add(c); }
  // rocks and scrub for scale
  const rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: 0x4d463c, roughness: 1, flatShading: true }), 420);
  const scrub = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 2.2, 6), new THREE.MeshStandardMaterial({ color: 0x1f2a12, roughness: 1, flatShading: true }), 600);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = v3();
  for (let i = 0; i < 420; i++) {
    const a = hr(i, 70) * TAU, d = 30 + Math.pow(hr(i, 71), .7) * 700, x = SITE.x + Math.cos(a) * d, z = SITE.z + Math.sin(a) * d;
    const sz = .6 + hr(i, 72) * hr(i, 73) * 6;
    q.setFromEuler(new THREE.Euler(hr(i, 74) * 3, hr(i, 75) * 3, 0)); s.set(sz, sz * .7, sz);
    m4.compose(v3(x - SITE.x, terrainH(x, z) - SITE.y + sz * .2, z - SITE.z), q, s); rocks.setMatrixAt(i, m4);
  }
  for (let i = 0; i < 600; i++) {
    const a = hr(i, 80) * TAU, d = 28 + Math.pow(hr(i, 81), .8) * 800, x = SITE.x + Math.cos(a) * d, z = SITE.z + Math.sin(a) * d;
    const sz = .7 + hr(i, 82) * 1.6; q.identity(); s.set(sz, sz, sz);
    if (Math.hypot(x - SITE.x + 44, z - SITE.z - 14) < 40) { s.set(0, 0, 0); }
    m4.compose(v3(x - SITE.x, terrainH(x, z) - SITE.y + sz, z - SITE.z), q, s); scrub.setMatrixAt(i, m4);
  }
  site.add(rocks, scrub);
}
site.updateMatrixWorld(true);
function tubeMouth(li, ti) {
  const L = LAUNCHERS[li];
  const off = [[-.45, .45], [.45, .45], [-.45, -.45], [.45, -.45]][ti];
  const p = v3(off[0], off[1] + .6, 7.4).applyMatrix4(L.piv.matrixWorld);
  const d = v3(0, 0, 1).transformDirection(L.piv.matrixWorld);
  return { p, d };
}

/* ------------------------------------------------------------------ flight helpers */
const _m = new THREE.Matrix4();
// Frame of an aircraft flying path P at time s: banks with the lift it needs.
function frameAt(P, s, roll = 0, dt = .04) {
  const p0 = P(s - dt), p1 = P(s), p2 = P(s + dt);
  const vel = p2.clone().sub(p0).divideScalar(2 * dt);
  const acc = p2.clone().add(p0).sub(p1.clone().multiplyScalar(2)).divideScalar(dt * dt);
  const f = vel.clone().normalize();
  const lift = acc.add(v3(0, 9.81, 0));
  lift.addScaledVector(f, -lift.dot(f));
  let up = lift.lengthSq() > 1e-4 ? lift.normalize() : v3(0, 1, 0);
  if (roll) up.applyAxisAngle(f, roll);
  const x = v3().crossVectors(up, f).normalize();
  up = v3().crossVectors(f, x).normalize();
  const q = new THREE.Quaternion().setFromRotationMatrix(_m.makeBasis(x, up, f));
  return { pos: p1, vel, q, fwd: f, up, x };
}
function place(obj, P, s, roll = 0) {
  const F = frameAt(P, s, roll);
  obj.position.copy(F.pos); obj.quaternion.copy(F.q); obj.visible = true; obj.updateMatrixWorld(true);
  return F;
}
const toWorld = (F, lx, ly, lz) => v3(lx, ly, lz).applyQuaternion(F.q).add(F.pos);
function placeMissile(m, P, s) {
  const p = P(s), d = P(s + .01).sub(P(s - .01)).normalize();
  m.position.copy(p); m.quaternion.setFromUnitVectors(v3(0, 0, 1), d); m.visible = true; m.updateMatrixWorld(true);
  return { pos: p, dir: d };
}

/* ------------------------------------------------------------------ camera */
let SHAKE = 0, FLARE = 1, HANDHELD = .25, TAGS = 1, SHOT_U = 0;
const THREATS = [];
function camLook(pos, look, fov, up = UP) {
  camera.position.copy(pos); camera.up.copy(up); camera.lookAt(look); camera.fov = fov; camera.updateProjectionMatrix();
}
function camOn(F, off, lookOff, fov, upBlend = 1) {
  const up = F.up.clone().lerp(UP, 1 - upBlend).normalize();
  camLook(toWorld(F, ...off), toWorld(F, ...lookOff), fov, up);
}
function applyShake(t) {
  const a = SHAKE + HANDHELD;
  const n = (k, f) => Math.sin(t * f + k) * .6 + Math.sin(t * f * 2.31 + k * 3) * .4;
  camera.rotateX(n(1, 13) * .0016 * a); camera.rotateY(n(2, 11) * .0016 * a); camera.rotateZ(n(3, 7) * .0012 * a);
}

/* ------------------------------------------------------------------ effects */
const FLASHES = [];
// Stateless smoke/fire trail sampled along a path: emission at fixed time steps.
function trail(P, s, s0, s1, o) {
  const dt = o.dt || .012, life = o.life || 3, k0 = Math.ceil((Math.max(s0, s - life)) / dt - 1e-6), k1 = Math.floor(Math.min(s, s1) / dt + 1e-6);
  for (let k = k0; k <= k1; k++) {
    const te = k * dt, age = s - te;
    if (age < 0 || age > life || te < s0) continue;
    const id = k + (o.seed || 0) * 100000, p = P(te);
    const g = Math.sqrt(age);
    p.x += hs(id, 1) * g * (o.spread ?? 3) + (o.wind ? o.wind.x * age : 0);
    p.y += hs(id, 2) * g * (o.spread ?? 3) + (o.rise ?? 1.5) * age;
    p.z += hs(id, 3) * g * (o.spread ?? 3) + (o.wind ? o.wind.z * age : 0);
    const size = (o.s0 ?? 2) + (o.grow ?? 6) * g + hr(id, 4) * (o.s0 ?? 2);
    const fadeIn = clamp(age / .06);
    const a = (o.a ?? .5) * fadeIn * Math.pow(1 - age / life, 1.6);
    const sh = (o.shade ?? .9) * (1 - (o.mix ?? .35) * hr(id, 5));
    const col = o.col || [1, 1, 1];
    smoke.add(p, size, col[0] * sh, col[1] * sh, col[2] * sh, a, hr(id, 6) * TAU);
    if (o.fire && age < o.fire) smoke.add(p, size * .75, 4.5, 1.6, .35, (1 - age / o.fire) * .95, hr(id, 7) * TAU);
  }
}
function motorFlame(p, dir, size, t, int = 1) {
  fire.add(p, size * 1.2 * (1 + .15 * Math.sin(t * 90)), 7 * int, 4.5 * int, 2 * int, .9);
  fire.add(p.clone().addScaledVector(dir, -size * 1.2), size * 1.9, 2.4, .9, .25, .45);
  streaks.add(p, p.clone().addScaledVector(dir, -size * 7), size * .7, 8 * int, 4 * int, 1.2 * int, .8);
}
// A full explosion, stateless in its age. c may be a function of age.
function explosion(cp, age, R, seed, o = {}) {
  if (age < 0 || age > (o.life || 6)) return;
  const C = typeof cp === 'function' ? cp(age) : cp;
  const drag = o.vel ? o.vel.clone().multiplyScalar((1 - Math.exp(-1.8 * age)) / 1.8) : v3();
  const c = C.clone().add(drag);
  // fireball
  const nf = o.n || 80;
  for (let i = 0; i < nf; i++) {
    const id = seed * 1000 + i, d = hdir(id, 1), life = 1.0 + hr(id, 2) * 1.4;
    if (age > life) continue;
    const f = age / life, reach = R * (.25 + .95 * hr(id, 3)) * expo(age / .5);
    const p = c.clone().addScaledVector(d, reach); p.y += age * age * R * .35 * (o.column ? 2 : 1);
    const size = R * (.55 + .7 * hr(id, 4)) * (.75 + age * .9);
    // white-hot core -> orange -> dull red, then it hands over to the smoke
    const k = clamp(f * 1.6);
    const col = k < .35 ? [lerp(9, 6, k / .35), lerp(6.5, 2.6, k / .35), lerp(3.5, .7, k / .35)] : [lerp(6, .35, (k - .35) / .65), lerp(2.6, .1, (k - .35) / .65), lerp(.7, .05, (k - .35) / .65)];
    smoke.add(p, size, col[0], col[1], col[2], .95 * (1 - ss(.55, 1, f)), hr(id, 5) * TAU);
  }
  if (age < .3) fire.add(c, R * 3.2 * (1 - age / .3), 6, 4, 2.2, 1 - age / .3);
  if (age < 1.2) fire.add(c, R * 6, 1.4, .55, .15, .5 * (1 - age / 1.2));
  // smoke
  for (let i = 0; i < 46; i++) {
    const id = seed * 1000 + 300 + i, d = hdir(id, 1);
    const p = c.clone().addScaledVector(d, R * (.4 + .9 * hr(id, 2)) * eout(clamp(age / 1.6)));
    p.y += age * R * (.18 + .25 * hr(id, 3)) * (o.column ? 2.5 : 1);
    const size = R * (.7 + .5 * hr(id, 4)) * (1 + age * .55);
    const glow = clamp(1 - age / 1.1);
    const sh = .06 + .08 * hr(id, 5);
    const a = .9 * ss(.35, .9, age) * clamp(1 - (age - 1.5) / ((o.life || 6) - 1.5));
    smoke.add(p, size, sh + glow * 1.6, sh + glow * .55, sh + glow * .15, a, hr(id, 6) * TAU);
  }
  // sparks
  for (let i = 0; i < 60; i++) {
    const id = seed * 1000 + 600 + i, d = hdir(id, 1), sp = R * (4 + 8 * hr(id, 2)), life = .5 + hr(id, 3);
    if (age > life) continue;
    const dist = sp * (1 - Math.exp(-2.4 * age)) / 2.4;
    const p = c.clone().addScaledVector(d, dist); p.y -= 4.9 * age * age;
    const q = c.clone().addScaledVector(d, Math.max(0, dist - sp * .05)); q.y -= 4.9 * Math.max(0, age - .03) ** 2;
    const k = 1 - age / life;
    streaks.add(q, p, R * .04 + .12, 6 * k, 2.6 * k, .7 * k, k);
  }
  // shock ring
  if (age < .4 && !o.noRing) rings.add(c, R * (1.2 + 6 * eout(age / .4)), 1, 1, 1.1, .14 * (1 - age / .4));
  if (o.ground && age < 1.6) {
    for (let i = 0; i < 70; i++) {
      const id = seed * 1000 + 800 + i, a = i / 70 * TAU + hs(id, 1) * .1, r = R * (1 + 7 * eout(age / 1.6)) * (.85 + .3 * hr(id, 2));
      const p = v3(c.x + Math.cos(a) * r, 0, c.z + Math.sin(a) * r); p.y = terrainH(p.x, p.z) + R * (.7 + age * .4);
      smoke.add(p, R * (1.3 + age * 1.6), .55, .46, .32, .6 * (1 - age / 1.6), hr(id, 3) * TAU);
    }
  }
  FLASHES.push({ p: c, i: R * R * 900 * Math.exp(-age * 3.5) });
}
function flare(p, t, k, idx) {
  if (k <= 0) return;
  fire.add(p, 3.5 * k, 24 * k, 18 * k, 10 * k, 1, 0);
  fire.add(p, 16 * k * (1 + .2 * Math.sin(t * 60 + idx)), 2.6, 1.5, .7, .6, 0);
}
function sparks(c, age, n, seed, sp = 60) {
  if (age < 0 || age > .6) return;
  for (let i = 0; i < n; i++) {
    const id = seed * 31 + i, d = hdir(id, 1), v = sp * (.4 + hr(id, 2));
    const p = c.clone().addScaledVector(d, v * age), q = c.clone().addScaledVector(d, v * Math.max(0, age - .03));
    const k = 1 - age / .6;
    streaks.add(q, p, .12, 8 * k, 4 * k, 1 * k, k);
  }
  if (age < .08) fire.add(c, 4, 10, 7, 3, 1 - age / .08);
}
function wingVapor(F, s, amt, seed) {
  if (amt <= 0) return;
  for (let i = 0; i < 70; i++) {
    const id = seed * 100 + i, sx = hr(id, 1) > .5 ? 1 : -1;
    const ph = (s * 3.2 + hr(id, 2)) % 1;
    const lx = sx * (1.7 + hr(id, 3) * 4.6), lz = 1.2 - (lx * sx - 1.5) * .95 - ph * 6.5;
    const p = toWorld(F, lx, .45 + ph * .9 + hr(id, 4) * .4, lz);
    smoke.add(p, 1.2 + ph * 3.2, 1.9, 1.9, 2.0, amt * .32 * Math.sin(ph * Math.PI), hr(id, 5) * TAU);
  }
}
function vortices(P, s, roll, amt, len = .5, seed = 0) {
  if (amt <= 0) return;
  for (let k = 0; k < len / .006; k++) {
    const te = s - k * .006, F = frameAt(P, te, roll);
    for (const sx of [1, -1]) {
      const p = toWorld(F, sx * 6.8, 0, -4.8);
      smoke.add(p, .5 + k * .012, 1.8, 1.8, 1.9, amt * .45 * (1 - k * .006 / len), 0);
    }
  }
}

/* ------------------------------------------------------------------ the shots */
// 1 · canopy dawn
const D1 = v3(-.45, 0, -.89).normalize();
const P1a = s => v3(-3000, 2620, 9000).addScaledVector(D1, 230 * s).add(v3(0, Math.sin(s * .7) * 3, 0));
function shot1(u, t) {
  const F = place(P1, P1a, u, Math.sin(u * .9) * .05);
  P1.userData.ab(.12, t);
  const k = eio(seg(u, 0, 2.6));
  // slow orbit from the front quarter to the flank, sun behind the lens
  const a = lerp(.62, 1.42, k), r = lerp(17, 13.5, k);
  camOn(F, [Math.sin(a) * r, lerp(2.6, 1.2, k), Math.cos(a) * r], [0, .55, lerp(3.2, -.5, k)], lerp(36, 31, k), .85);
  HANDHELD = .6; FLARE = .4;
}
// 2 · formation over the island
const P1b = s => v3(3150 - 236 * s, 455 + Math.sin(s * 1.3) * 2, 3600);
const P2b = s => v3(3150 + 42 - 236 * s, 468 + Math.sin(s * 1.2 + 1) * 2, 3578);
function shot2(u, t) {
  const roll = -ss(.7, 1.5, u) * .55;
  const F1 = place(P1, P1b, u, roll), F2 = place(P2, P2b, u, roll);
  const ab = ss(1.25, 1.45, u);
  P1.userData.ab(.15 + .85 * ab, t); P2.userData.ab(.15 + .85 * ss(1.35, 1.55, u), t);
  const mid = F1.pos.clone().lerp(F2.pos, .4);
  camLook(v3(2790, 486, 3940), mid.add(v3(-6, 2, 0)), lerp(13, 11.5, u / 2));
  HANDHELD = 1.6 + ab * 2; FLARE = .6;
}
// 3 · bandits dive out of the clouds
const C3 = v3(-1400, 950, -3600);
const E3off = [v3(0, 0, 0), v3(-48, 12, -48), v3(52, 20, -64)];
const Eb = i => s => C3.clone().add(E3off[i]).add(v3(0, 330 - 120 * s, -560 + 340 * s));
function shot3(u, t) {
  [E1, E2, E3].forEach((e, i) => { place(e, Eb(i), u, Math.sin(u * 1.5 + i) * .15); e.userData.ab(.6, t); });
  const look = Eb(0)(u - .06).lerp(Eb(1)(u - .06), .3);
  camLook(C3, look, lerp(26, 40, ss(.8, 1.6, u)));
  HANDHELD = 1; FLARE = .9;
}
// 4 · the merge
const M4 = v3(2400, 1150, -2600);
const W4 = makeWarp(u => 1 - .86 * Math.exp(-Math.pow((u - .78) / .28, 2)), 0, 1.6, .78, 0);
const P1d = s => M4.clone().add(v3(-5, -6, -245 * s));
const E1d = s => M4.clone().add(v3(5, 8, 245 * s));
function shot4(u, t) {
  const s = W4(u);
  const r = Math.exp(-Math.pow(s / .32, 2));
  place(P1, P1d, s, -1.1 * r); place(E1, E1d, s, 1.1 * r);
  P1.userData.ab(1, t); E1.userData.ab(1, t);
  const push = ss(.15, .78, u);
  const follow = ss(.9, 1.3, u);
  const look = M4.clone().add(v3(0, 3, 0)).lerp(E1d(s), follow * .5);
  camLook(M4.clone().add(v3(118, 8, 0)), look, lerp(50, 22, push) + follow * 12);
  HANDHELD = .8; FLARE = 1;
}
// 5 · fox two
const D5 = v3(.62, .04, -.78).normalize();
const E05 = v3(-4200, 1700, 2600);
const E1e = s => E05.clone().addScaledVector(D5, 245 * s);
const LEFT5 = v3().crossVectors(UP, D5).normalize();
const P1e = s => E05.clone().addScaledVector(D5, 245 * s + 1500).addScaledVector(LEFT5, 220 - 40 * s * s).add(v3(0, 140 + 20 * s, 0));
const FIRE5 = .35, IGN5 = .62;
let F5 = null;
function missile5(s) {
  const a = s - FIRE5;
  const F = frameAt(E1e, s);
  if (a < 0) return toWorld(F, -3.7, -.62, -2.9);
  const ig = Math.max(0, a - (IGN5 - FIRE5));
  const local = toWorld(F, -3.7 + a * .3, -.62 - 4.9 * a * a * 1.1, -2.9 - 1.6 * a * a + .5 * 420 * ig * ig);
  const tgt = P1e(s + .6);
  return local.lerp(tgt, Math.pow(seg(ig, 0, 6), 2.2));
}
function shot5(u, t) {
  F5 = place(E1, E1e, u); E1.userData.ab(.5, t);
  E1.userData.stores[1].visible = u < FIRE5;
  place(P1, P1e, u, 0); P1.userData.ab(1, t);
  if (u >= FIRE5) {
    const M = placeMissile(MISSILES[0], missile5, u);
    if (u > IGN5) {
      motorFlame(M.pos.clone().addScaledVector(M.dir, -1.8), M.dir, 1.1, t, 1.4);
      trail(missile5, u, IGN5, u, { s0: 1.2, grow: 7, life: 2.6, a: .55, spread: 2.5, seed: 5, dt: .006 });
      if (u - IGN5 < .12) fire.add(M.pos, 18, 12, 7, 3, 1 - (u - IGN5) / .12);
    }
  }
  camOn(F5, [-8.6, -2.7, -15.5], [-3.7, -.9, 14], 42, 1);
  HANDHELD = .9 + (u > IGN5 ? 2.5 * Math.exp(-(u - IGN5) * 4) : 0); FLARE = .5;
}
// 6 · break turn, flares, the missile decoys
const C6 = v3(-3000, 0, 2000);
const P1f = s => { const a = 1.2 + .175 * s; return C6.clone().add(v3(Math.cos(a) * 1300, 1900 + 18 * s, Math.sin(a) * 1300)); };
const ROLL6 = s => ss(.6, 1.6, s) * TAU;
const FLARES6 = Array.from({ length: 26 }, (_, k) => ({ te: .55 + Math.floor(k / 2) * .09, side: k % 2 ? 1 : -1, k }));
function flarePos(P, rollFn, f, s) {
  const a = s - f.te; if (a < 0) return null;
  const F = frameAt(P, f.te, rollFn(f.te));
  const ej = v3(f.side * .75, -.55, -.35).applyQuaternion(F.q).multiplyScalar(38 + 10 * hr(f.k, 9));
  const p0 = toWorld(F, f.side * .9, -.6, -6.5);
  return p0.addScaledVector(F.vel, (1 - Math.exp(-1.7 * a)) / 1.7).addScaledVector(ej, (1 - Math.exp(-3 * a)) / 3).add(v3(0, -2.5 * a * a, 0));
}
function drawFlares(P, rollFn, list, s, t, smokeSeed) {
  list.forEach(f => {
    const a = s - f.te; if (a < 0 || a > 3.2) return;
    flare(flarePos(P, rollFn, f, s), t, clamp(1 - a / 3.2) * (a < .05 ? a / .05 : 1), f.k);
    trail(ss2 => flarePos(P, rollFn, f, ss2), s, f.te, s, { s0: .8, grow: 3.2, life: 1.6, a: .5, spread: .8, rise: .6, seed: smokeSeed + f.k, dt: .02 });
  });
}
const MS6 = (() => {
  const F0 = frameAt(P1f, 0);
  const S0 = F0.pos.clone().addScaledVector(F0.fwd, -1700).addScaledVector(F0.x, 380).add(v3(0, -360, 0));
  const v0 = F0.pos.clone().sub(S0).normalize().multiplyScalar(420);
  const HIT = 2.0, FL = FLARES6[9];
  return s => {
    const tgt = P1f(s).lerp(flarePos(P1f, ROLL6, FL, Math.max(s, FL.te)) || P1f(s), ss(1.05, 1.5, s));
    return S0.clone().addScaledVector(v0, s).lerp(tgt, Math.pow(clamp(s / HIT), 1.7));
  };
})();
function shot6(u, t) {
  if (u < 2.0) THREATS.push([MISSILES[0], 'MISSILE']);
  const F = place(P1, P1f, u, ROLL6(u));
  P1.userData.ab(1, t);
  const Fc = frameAt(P1f, u, 0);
  drawFlares(P1f, ROLL6, FLARES6, u, t, 600);
  if (u < 2.0) {
    const M = placeMissile(MISSILES[0], MS6, u);
    motorFlame(M.pos.clone().addScaledVector(M.dir, -1.8), M.dir, 1.1, t, 1.4);
  }
  trail(MS6, u, 0, 2.0, { s0: 1.2, grow: 6, life: 2.6, a: .55, spread: 2.5, seed: 6, dt: .006 });
  explosion(MS6(2.0), u - 2.0, 11, 61);
  vortices(P1f, u, ROLL6(u), .5, .35);
  camOn(Fc, [15, 4.5, 27], [-1, -2.5, -70], 50, .3);
  HANDHELD = 1.4; FLARE = .3;
}
// 7 · max-G reversal into the sun
const A7 = v3(5200, 1400, -6200);
const P1g = s => { const th = .34 * s + .06 * s * s, R = 620; return A7.clone().addScaledVector(SUNH, R * Math.sin(th)).add(v3(0, R * (1 - Math.cos(th)), 0)); };
function shot7(u, t) {
  const roll = .22 * Math.sin(u * .9);
  const F = place(P1, P1g, u, roll);
  P1.userData.ab(1, t);
  wingVapor(F, u, .9, 7);
  vortices(P1g, u, roll, .8, .4);
  camOn(F, [6.1, 1.5, -5.4], [.6, .85, 7], 64, 1);
  HANDHELD = 2.2; FLARE = .8;
}
// 8 · guns guns guns
const C8 = v3(-2000, 0, -1500), R8 = 2600;
const P1h = s => { const a = 2.2 - .0904 * s; return C8.clone().add(v3(Math.cos(a) * R8, 1700 + 8 * Math.sin(s), Math.sin(a) * R8)); };
const LAG8 = s => .62 - .2 * ss(1.2, 2.0, s);
const E1h = s => {
  const F = frameAt(P1h, s + LAG8(s));
  return F.pos.clone().addScaledVector(F.x, 14 * Math.sin(2.3 * s)).addScaledVector(F.up, 9 * Math.sin(1.7 * s + 1));
};
const GUN0 = .8, GUN1 = 1.9, RATE = 100, KILL8 = 2.05;
const ROUNDS = (() => {
  const list = [];
  for (let k = 0; k < (GUN1 - GUN0) * RATE; k++) {
    const te = GUN0 + k / RATE, F = frameAt(P1h, te);
    const muzzle = toWorld(F, 1.05, .55, 4.2);
    const err = lerp(26, .8, ss(GUN0, GUN0 + .45, te));
    const tgt0 = E1h(te + .22);
    const aim = tgt0.clone().add(v3(hs(k, 1), hs(k, 2), hs(k, 3)).multiplyScalar(err));
    const dist = aim.distanceTo(muzzle), tof = dist / 1050;
    const dir = aim.clone().sub(muzzle).normalize();
    const hit = err < 4 && te + tof < KILL8;
    list.push({ te, muzzle, vel: F.vel.clone().addScaledVector(dir, 1050), tof, hit, k, local: v3(hs(k, 4) * 3, hs(k, 5) * .8, hs(k, 6) * 6) });
  }
  return list;
})();
function shot8(u, t) {
  const F = place(P1, P1h, u, 0); P1.userData.ab(.7, t);
  if (u < KILL8) {
    const Fe = place(E1, E1h, u, .5 * Math.sin(1.9 * u)); E1.userData.ab(.8, t);
    // damage: fire and smoke pouring off the bandit after the first hits
    const dmg = s => toWorld(frameAt(E1h, s, .5 * Math.sin(1.9 * s)), .8, .4, -5);
    trail(dmg, u, 1.25, u, { s0: 1.5, grow: 5, life: 2.2, a: .65, spread: 2, seed: 81, shade: .12, mix: .5, fire: .35, dt: .01 });
  }
  // the cannon
  for (const r of ROUNDS) {
    const a = u - r.te; if (a < 0) continue;
    if (r.hit && a > r.tof) { sparks(E1h(r.te + r.tof).add(r.local), a - r.tof, 6, r.k); continue; }
    if (a > .9) continue;
    const p = r.muzzle.clone().addScaledVector(r.vel, a), q = r.muzzle.clone().addScaledVector(r.vel, Math.max(0, a - .022));
    streaks.add(q, p, .5, 9, 4.5, 1.2, 1);
  }
  if (u > GUN0 && u < GUN1) {
    const mz = toWorld(F, 1.05, .55, 4.6);
    fire.add(mz, 1.4 + 1.1 * hr(Math.floor(u * 60), 1), 9, 6, 2.5, 1);
    FLASHES.push({ p: toWorld(F, 1.05, 3, 9), i: 300 });
  }
  const kp = E1h(KILL8);
  explosion(kp, u - KILL8, 20, 88, { vel: frameAt(E1h, KILL8).vel.multiplyScalar(.55), life: 5, n: 110 });
  // debris
  const kv = frameAt(E1h, KILL8).vel;
  for (let i = 0; i < 10; i++) {
    const a = u - KILL8, d = DEBRIS[i];
    if (a < 0) continue;
    const dir = hdir(880 + i, 1), sp = 25 + 45 * hr(880 + i, 2);
    const pos = kp.clone().addScaledVector(kv, (1 - Math.exp(-.9 * a)) / .9).addScaledVector(dir, sp * a).add(v3(0, -4.9 * a * a, 0));
    d.position.copy(pos); d.rotation.set(a * 6 * hs(i, 3), a * 5 * hs(i, 4), a * 4 * hs(i, 5)); d.visible = true;
    if (i < 6) trail(s => kp.clone().addScaledVector(kv, (1 - Math.exp(-.9 * (s - KILL8))) / .9).addScaledVector(dir, sp * (s - KILL8)).add(v3(0, -4.9 * (s - KILL8) ** 2, 0)),
      u, KILL8, u, { s0: 1, grow: 3, life: 1.6, a: .6, shade: .1, spread: .6, seed: 900 + i, fire: .4, dt: .015 });
  }
  camLook(toWorld(F, 3.4, 4.2, -19), E1h(Math.min(u, KILL8 + .3)), 36, F.up.clone().lerp(UP, .45).normalize());
  HANDHELD = u > GUN0 && u < GUN1 ? 3.2 : 1.2; FLARE = .4;
}
// 9 · wave-top pass
const C9 = v3(-5600, 4, 600);
const W9 = (x0, z, y, delay) => s => v3(C9.x + x0 - 300 * (s - delay), y + Math.sin(s * 2) * .6, C9.z + z);
const P1i = W9(270, 13, 9, 0), P2i = W9(270, -21, 12, .55);
function spray(P, s, s0, seed) {
  const dt = .0035, life = 1.8;
  for (let k = Math.ceil(Math.max(s0, s - life) / dt); k <= Math.floor(s / dt); k++) {
    const te = k * dt, a = s - te, id = seed * 10000 + k;
    const j = P(te), base = v3(j.x + hs(id, 1) * 3, 0, j.z + hs(id, 2) * 5);
    const vy = 10 + 20 * hr(id, 3), vx = 40 + 70 * hr(id, 4), vz = hs(id, 5) * 16;
    const p = base.add(v3(vx * (1 - Math.exp(-1.2 * a)) / 1.2, vy * a - 4.9 * a * a * .7, vz * a));
    if (p.y < -1) continue;
    smoke.add(p, 1.2 + a * 5.5, 2.3, 2.35, 2.45, .3 * (1 - a / life) * clamp(a / .05), hr(id, 6) * TAU);
  }
}
function shot9(u, t) {
  place(P1, P1i, u, .05); place(P2, P2i, u, -.08);
  P1.userData.ab(1, t); P2.userData.ab(1, t);
  spray(P1i, u, -1, 91); spray(P2i, u, -1, 92);
  const lag = .07;
  const tgt = P1i(u - lag).lerp(P2i(u - lag), ss(1.0, 1.6, u) * .6);
  const look = C9.clone().add(tgt.clone().sub(C9).normalize().multiplyScalar(100));
  camLook(C9, look, 50);
  HANDHELD = 1.5 + 6 * Math.exp(-Math.pow((u - .9) / .2, 2)); FLARE = 1;
}
// 10–12 · the SAM site
const T_SAM = [19.65, 20.25];
const ATK = (() => {   // Viper 1-1's attack run, in global time
  const F = SITE.clone().add(v3(900, 700, -600));
  const d = SITE.clone().add(v3(0, 100, 0)).sub(F).normalize();
  const side = v3().crossVectors(UP, d).normalize();
  return t => {
    const a = t - 23.5;
    const p = F.clone().addScaledVector(d, 260 * a).addScaledVector(side, 120 * Math.sin(a * .7));
    p.y += a < 0 ? 22 * a * a : 40 * a * a;
    if (a > 0) p.addScaledVector(side, 60 * a * a);
    return p;
  };
})();
const FLARES11 = Array.from({ length: 16 }, (_, k) => ({ te: 21.95 + Math.floor(k / 2) * .09, side: k % 2 ? 1 : -1, k: k + 50 }));
const noRoll = () => 0;
const SAMP = T_SAM.map((t0, i) => {
  const { p, d } = tubeMouth(i, i ? 2 : 1);
  const det = [22.65, 22.95][i], fl = FLARES11[[5, 11][i]];
  return t => {
    const a = Math.max(0, t - t0);
    const boost = .5 * 90 * a * a + (a > 1 ? 160 * (a - 1) * (a - 1) : 0);
    const bal = p.clone().addScaledVector(d, boost);
    const tgt = t < 21.4 ? ATK(t) : ATK(t).lerp(flarePos(ATK, noRoll, fl, Math.max(t, fl.te)) || ATK(t), ss(22.0, det - .15, t));
    return bal.lerp(tgt, Math.pow(seg(t, t0 + .4, det), 2.2));
  };
});
const SAM_DET = [22.65, 22.95];
function samFX(t, smokeA = .7) {
  T_SAM.forEach((t0, i) => {
    if (t < t0) return;
    const P = SAMP[i], det = SAM_DET[i];
    if (t < det) {
      const M = placeMissile(MISSILES[4 + i], P, t);
      motorFlame(M.pos.clone().addScaledVector(M.dir, -3.6), M.dir, 2.2, t, 1.6);
    }
    trail(P, t, t0, det, { s0: 3.5, grow: 14, life: 6, a: smokeA, spread: 3.5, rise: 2, seed: 100 + i, dt: .008, shade: .95, fire: .12 });
    // launch blast and ground cloud
    const a = t - t0;
    if (a < 3) {
      const base = tubeMouth(i, 0).p.clone();
      for (let k = 0; k < 44; k++) {
        const id = 7000 + i * 100 + k, ang = hr(id, 1) * TAU, r = (6 + 40 * hr(id, 2)) * eout(clamp(a / 1.6));
        const p = base.clone().add(v3(Math.cos(ang) * r, 1 + 4 * hr(id, 3) + a * 2, Math.sin(ang) * r));
        p.y = Math.max(p.y, terrainH(p.x, p.z) + 2);
        smoke.add(p, 6 + 8 * hr(id, 4) + a * 5, .9, .82, .7, .5 * ss(0, .1, a) * (1 - a / 3), hr(id, 5) * TAU);
      }
      if (a < .25) { fire.add(base, 30 * (1 - a / .25), 14, 8, 3, 1); FLASHES.push({ p: base, i: 4e5 * (1 - a / .25) }); }
    }
    explosion(SAMP[i](det), t - det, 18, 300 + i, { life: 5, n: 90 });
  });
}
function shot10(u, t) {
  site.userData.radar.rotation.y = t * 2.4;
  samFX(t);
  const cam = SITE.clone().add(v3(-44, 0, 14)); cam.y = SITE.y + 1.7;
  const L = tubeMouth(0, 0).p;
  const follow = ss(.55, 1.5, u);
  const look = L.clone().lerp(SAMP[0](Math.max(t - .1, T_SAM[0])), follow);
  camLook(cam, look, lerp(52, 60, follow));
  HANDHELD = 1.2; FLARE = .25; renderer.toneMappingExposure = .46;
}
function shot11(u, t) {
  SAM_DET.forEach((d, i) => { if (t < d) THREATS.push([MISSILES[4 + i], 'SAM']); });
  const F = place(P1, ATK, t, Math.sin(t * 2) * .3); P1.userData.ab(1, t);
  samFX(t, .75);
  drawFlares(ATK, noRoll, FLARES11, t, t, 1100);
  const cam = SITE.clone().add(v3(380, 520, 120));
  const look = ATK(t).lerp(SAMP[0](Math.min(t, SAM_DET[0])), .35);
  camLook(cam, look, 34);
  HANDHELD = 1; FLARE = .6; renderer.toneMappingExposure = .4;
}
const AGM = [{ t0: 23.5, imp: 24.75, store: 2, tgt: () => tubeMouth(0, 0).p.clone().add(v3(0, -3, 0)) }, { t0: 23.62, imp: 24.95, store: 3, tgt: () => SITE.clone().add(v3(-22, 2, 22)) }];
const AGMP = AGM.map(g => {
  const F = frameAt(ATK, g.t0), start = toWorld(F, g.store === 2 ? 3.7 : -3.7, -.62, -2.9), tgt = g.tgt();
  return t => {
    const a = Math.max(0, t - g.t0);
    const drop = start.clone().addScaledVector(F.vel, a).add(v3(0, -4.9 * a * a, 0));
    const boost = a > .25 ? .5 * 260 * (a - .25) ** 2 : 0;
    drop.addScaledVector(F.fwd, boost);
    return drop.lerp(tgt, Math.pow(seg(t, g.t0 + .25, g.imp), 2));
  };
});
function shot12(u, t) {
  const F = place(P1, ATK, t, 0); P1.userData.ab(.9, t);
  site.userData.radar.rotation.y = t * 2.4;
  AGM.forEach((g, i) => {
    P1.userData.stores[g.store].visible = t < g.t0;
    if (t >= g.t0 && t < g.imp) {
      const M = placeMissile(MISSILES[i], AGMP[i], t);
      if (t > g.t0 + .25) motorFlame(M.pos.clone().addScaledVector(M.dir, -1.8), M.dir, 1.2, t, 1.5);
    }
    if (t > g.t0 + .25) trail(AGMP[i], t, g.t0 + .25, g.imp, { s0: 1, grow: 5, life: 2.5, a: .5, spread: 1.5, seed: 120 + i, dt: .006 });
    explosion(g.tgt(), t - g.imp, 46 - i * 8, 500 + i, { ground: true, column: true, life: 7, n: 130 });
  });
  explosion(SITE.clone().add(v3(34, 4, -18)), t - 25.2, 30, 520, { ground: true, column: true, life: 6, n: 100 });
  // the chase camera rides missile 1, then holds as it hits
  const tc = Math.min(t, AGM[0].imp - .22);
  const mp = AGMP[0](tc), md = AGMP[0](tc + .01).sub(AGMP[0](tc - .01)).normalize();
  const sideV = v3().crossVectors(md, UP).normalize();
  const camP = mp.clone().addScaledVector(md, -14).add(v3(0, 6, 0)).addScaledVector(sideV, 7);
  const look = t < AGM[0].imp - .22 ? mp.clone().addScaledVector(md, 40) : AGM[0].tgt().add(v3(0, 45 * ss(24.75, 25.6, t), 0));
  camLook(camP, look, t < 23.75 ? 55 : lerp(50, 66, ss(24.4, 25.0, t)));
  HANDHELD = 1.4; FLARE = .3;
}
// 13 · the last bandit
const A13 = v3(-2500, 3100, 1800);
const PERP = v3(-SUNH.z, 0, SUNH.x);
const CLIMB = PERP.clone().multiplyScalar(.7).add(v3(0, .72, 0)).normalize();
const P1m = s => A13.clone().addScaledVector(CLIMB, 250 * s).addScaledVector(SUNH, 20 * Math.sin(s * 1.3));
const E2m = s => P1m(s - 1.25).add(v3(0, -18, 0));
const W13 = makeWarp(u => 1 - .72 * ss(.35, .55, u) * (1 - ss(.95, 1.2, u)), 0, 1.2, 0, 1.2);
const KILL13 = 1.2 + .45;   // in shot-13 time
const P2m = s => { const hit = E2m(KILL13); return hit.clone().add(v3(-900, 300, 500).multiplyScalar(1 - s / KILL13)); };
const MS13 = s => { const hit = E2m(KILL13), st = E2m(.95).add(v3(-700, 260, 360)); return st.lerp(hit, Math.pow(seg(s, .95, KILL13), 1.5)); };
function shot13(u, t) {
  const s = u < 1.2 ? u : W13(u - 1.2);
  const F = place(P1, P1m, s, s * 1.1); P1.userData.ab(1, t);
  if (s < KILL13) { place(E2, E2m, s, .2 * Math.sin(s * 2)); E2.userData.ab(1, t); }
  drawFlares(P1m, s2 => s2 * 1.1, FLARES6.slice(0, 10).map(f => ({ ...f, te: f.te - .2 })), s, t, 1300);
  if (s > .95 && s < KILL13) {
    const M = placeMissile(MISSILES[1], MS13, s);
    motorFlame(M.pos.clone().addScaledVector(M.dir, -1.8), M.dir, 1.2, t, 1.5);
  }
  trail(MS13, s, .95, KILL13, { s0: 1, grow: 5, life: 2.5, a: .5, spread: 1.5, seed: 130, dt: .006 });
  explosion(E2m(KILL13), s - KILL13, 20, 131, { vel: frameAt(E2m, KILL13).vel.multiplyScalar(.5), n: 110 });
  // bandit's guns, missing
  if (s > .35 && s < .8) {
    const Fe = frameAt(E2m, s);
    for (let k = 0; k < 30; k++) {
      const te = .35 + k / 70; if (te > s) break;
      const Fk = frameAt(E2m, te), mz = toWorld(Fk, 1, .5, 4.2);
      const dir = P1m(te + .3).add(v3(hs(k, 1) * 30, hs(k, 2) * 30 + 25, hs(k, 3) * 30)).sub(mz).normalize();
      const a = s - te, p = mz.clone().addScaledVector(Fk.vel.clone().addScaledVector(dir, 1000), a), q = mz.clone().addScaledVector(Fk.vel.clone().addScaledVector(dir, 1000), Math.max(0, a - .02));
      streaks.add(q, p, .3, 9, 4.5, 1.2, 1);
    }
    fire.add(toWorld(Fe, 1, .5, 4.6), 1.4, 9, 6, 2.5, 1);
  }
  if (u < 1.2) {
    const Fe = frameAt(E2m, s);
    camOn(Fe, [1.5, 7, -34], [0, 2, 60], 40, .8);
    camLook(camera.position.clone(), P1m(s).lerp(toWorld(Fe, 0, 2, 60), .25), 38, Fe.up.clone().lerp(UP, .2));
  } else {
    const Fe = frameAt(E2m, Math.min(s, KILL13 - .05));
    camOn(Fe, [-80, 14, 34], [0, 4, 10], 40, .3);
  }
  HANDHELD = 1.4; FLARE = .5;
}
// 14 · hero pass out of the sun
const C14 = v3(-6000, 5, -2500);
const W14 = makeWarp(u => lerp(.2, 1.7, ss(.95, 1.4, u)), 0, 2, 1.5, 0);
const APP14 = SUNH.clone().applyAxisAngle(UP, .78);
const P1n = s => C14.clone().addScaledVector(APP14, -250 * s).add(v3(0, 10, 0)).addScaledVector(v3(-APP14.z, 0, APP14.x), 4);
function shot14(u, t) {
  const s = W14(u);
  const F = place(P1, P1n, s, .04 * Math.sin(u * 3)); P1.userData.ab(1, t);
  P1.userData.vc.visible = true;
  P1.userData.vc.material.uniforms.uO.value = ss(-.9, -.4, s) * (1 - ss(.0, .25, s)) * .55;
  P1.userData.vc.material.uniforms.uT.value = t;
  spray(P1n, s, -3, 141);
  const look = P1n(s - .05);
  camLook(C14, look, lerp(26, 56, ss(.8, 1.45, u)));
  HANDHELD = 1 + 9 * Math.exp(-Math.pow(s / .18, 2)); FLARE = .9;
}
// 15 · title
const C15 = v3(-1000, 260, 9000);
const DIR15 = SUNH.clone().applyAxisAngle(UP, -.62);
const P1o = s => C15.clone().add(v3(0, -30, 0)).addScaledVector(DIR15, 140 + 240 * s).add(v3(0, 55 * s * s, 0));
const P2o = s => P1o(s).addScaledVector(v3(-DIR15.z, 0, DIR15.x), 34).addScaledVector(DIR15, -45).add(v3(0, -10, 0));
function shot15(u, t) {
  TAGS = 1 - ss(.2, .6, u);
  place(P1, P1o, u, -.25); place(P2, P2o, u, -.25);
  P1.userData.ab(1, t); P2.userData.ab(1, t);
  vortices(P1o, u, -.25, .6, 1.2);
  vortices(P2o, u, -.25, .6, 1.2);
  camLook(C15.clone().add(v3(0, u * 6, 0)), C15.clone().addScaledVector(DIR15, 3000).add(v3(0, 120 + u * 70, 0)), 40);
  HANDHELD = .4; FLARE = .9;
}
const SHOTS = [
  [0, 2.6, shot1], [2.6, 4.6, shot2], [4.6, 6.2, shot3], [6.2, 7.8, shot4], [7.8, 9.6, shot5], [9.6, 12.4, shot6],
  [12.4, 14.2, shot7], [14.2, 17.2, shot8], [17.2, 19.2, shot9], [19.2, 21.4, shot10], [21.4, 23.4, shot11],
  [23.4, 25.6, shot12], [25.6, 28.0, shot13], [28.0, 30.0, shot14], [30.0, 35.0, shot15],
];

/* ------------------------------------------------------------------ post */
const rt = new THREE.WebGLRenderTarget(RW, RH, { type: THREE.HalfFloatType, samples: 4 });
const composer = new EffectComposer(renderer, rt);
composer.setPixelRatio(1); composer.setSize(RW, RH);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(RW, RH), .42, .5, 2.4);
composer.addPass(new ShaderPass({
  uniforms: { tDiffuse: { value: null } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: `uniform sampler2D tDiffuse; varying vec2 vUv;
    void main(){ vec4 c = texture2D(tDiffuse, vUv); vec3 x = c.rgb;
      if (!(x.r >= 0.0 && x.g >= 0.0 && x.b >= 0.0) || x.r > 6e4 || x.g > 6e4 || x.b > 6e4) x = vec3(60.0, 50.0, 40.0);
      gl_FragColor = vec4(min(x, vec3(400.0)), 1.0); }`,
}));
composer.addPass(bloom);
composer.addPass(new OutputPass());
const grade = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uT: { value: 0 }, uFlash: { value: 0 }, uFlashCol: { value: new THREE.Color(1, 1, 1) }, uAb: { value: .006 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uT; uniform float uFlash; uniform vec3 uFlashCol; uniform float uAb; varying vec2 vUv;
    void main(){
      vec2 d = vUv - 0.5; float r2 = dot(d, d);
      vec3 c = vec3(texture2D(tDiffuse, vUv + d * uAb * r2 * 4.0).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - d * uAb * r2 * 4.0).b);
      float l = dot(c, vec3(.299, .587, .114));
      c *= mix(vec3(.9, 1.0, 1.08), vec3(1.0), smoothstep(0.0, .45, l));
      c *= mix(vec3(1.0), vec3(1.06, 1.0, .9), smoothstep(.45, 1.0, l));
      c = mix(c, c * c * (3.0 - 2.0 * c), .22);
      c = max(mix(vec3(dot(c, vec3(.299, .587, .114))), c, 1.16), 0.0);
      c *= 1.0 - r2 * vec2(1.25, 1.0).x * .9;
      c = mix(c, uFlashCol, uFlash);
      float n = fract(sin(dot(floor(vUv * vec2(1920.0, 804.0)) + floor(uT * 15.0) * 17.0, vec2(12.9898, 78.233))) * 43758.5453);
      c += (n - .5) * .022;
      gl_FragColor = vec4(c, 1.0);
    }`,
});
composer.addPass(grade);

/* ------------------------------------------------------------------ 2D: flare, titles */
const MONO = '"JetBrains Mono", "DejaVu Sans Mono", monospace';
const DISPLAY = 'Oswald, "Arial Narrow", Impact, sans-serif';
function lensFlare(k) {
  if (k <= 0) return;
  const sp = camera.position.clone().addScaledVector(SUN, 100000).project(camera);
  if (sp.z > 1 || Math.abs(sp.x) > 1.4 || Math.abs(sp.y) > 1.4) return;
  const x = (sp.x * .5 + .5) * RW, y = (1 - (sp.y * .5 + .5)) * RH + BAR;
  const vis = k * clamp(1.5 - Math.max(Math.abs(sp.x), Math.abs(sp.y)));
  if (vis <= 0) return;
  out.save(); out.globalCompositeOperation = 'lighter';
  const streak = out.createLinearGradient(x - 900, 0, x + 900, 0);
  streak.addColorStop(0, 'rgba(80,140,255,0)'); streak.addColorStop(.5, `rgba(150,190,255,${.55 * vis})`); streak.addColorStop(1, 'rgba(80,140,255,0)');
  out.fillStyle = streak; out.fillRect(x - 900, y - 2.5, 1800, 5);
  out.fillStyle = streak; out.globalAlpha = .35; out.fillRect(x - 900, y - 10, 1800, 20); out.globalAlpha = 1;
  const g = out.createRadialGradient(x, y, 0, x, y, 260);
  g.addColorStop(0, `rgba(255,236,200,${.5 * vis})`); g.addColorStop(1, 'rgba(255,200,140,0)');
  out.fillStyle = g; out.beginPath(); out.arc(x, y, 260, 0, TAU); out.fill();
  const cx = RW / 2, cy = BAR + RH / 2;
  [[.35, 40, '120,200,255', .08], [.6, 18, '255,160,90', .12], [-.3, 70, '90,255,170', .05], [-.7, 120, '160,120,255', .045], [1.3, 30, '255,210,140', .07]].forEach(([f, r, c, a]) => {
    const gx = cx + (cx - x) * f, gy = cy + (cy - y) * f;
    const gg = out.createRadialGradient(gx, gy, 0, gx, gy, r);
    gg.addColorStop(0, `rgba(${c},${a * vis})`); gg.addColorStop(.8, `rgba(${c},${a * vis * .6})`); gg.addColorStop(1, `rgba(${c},0)`);
    out.fillStyle = gg; out.beginPath(); out.arc(gx, gy, r, 0, TAU); out.fill();
  });
  out.restore();
}
const IDS = [[P1, 'VIPER 1-1', 'YOU', 0], [P2, 'VIPER 1-2', 'WINGMAN', 0], [E1, 'BANDIT', '', 1], [E2, 'BANDIT', '', 1], [E3, 'BANDIT', '', 1]];
// HUD-style identification boxes that track each aircraft: cyan for our side, red for the enemy.
function idTags() {
  const a0 = TAGS * ss(.12, .35, SHOT_U);
  if (a0 <= 0) return;
  const right = v3(1, 0, 0).applyQuaternion(camera.quaternion);
  const list = IDS.filter(([o]) => o.visible).map(([o, name, sub, en]) => [o, name, sub, en, 9]);
  for (const [m, name] of THREATS) if (m.visible) list.push([m, name, '', 1, 2.5]);
  for (const [o, name, sub, en, half] of list) {
    const c = o.position.clone().project(camera);
    if (c.z > 1 || Math.abs(c.x) > 1.02 || Math.abs(c.y) > 1.02) continue;
    const e = o.position.clone().addScaledVector(right, half).project(camera);
    const x = (c.x * .5 + .5) * RW, y = BAR + (1 - (c.y * .5 + .5)) * RH;
    const r = Math.abs(e.x - c.x) * .5 * RW;
    const col = en ? '255,52,40' : '70,220,255';
    out.save(); out.globalAlpha = a0;
    out.strokeStyle = `rgba(${col},.95)`; out.lineWidth = 2; out.shadowColor = `rgba(${col},.8)`; out.shadowBlur = 8;
    let top;
    if (r < 230) {
      const h = clamp(r * 1.25, 20, 260), l = Math.max(7, h * .28);
      out.beginPath();
      for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        const cx = x + sx * h, cy = y + sy * h * .7;
        out.moveTo(cx - sx * l, cy); out.lineTo(cx, cy); out.lineTo(cx, cy - sy * l);
      }
      out.stroke();
      if (en) { out.beginPath(); out.moveTo(x, y - h * .7 - 16); out.lineTo(x + 6, y - h * .7 - 10); out.lineTo(x, y - h * .7 - 4); out.lineTo(x - 6, y - h * .7 - 10); out.closePath(); out.fillStyle = `rgba(${col},1)`; out.fill(); }
      top = y - h * .7 - (en ? 30 : 16);
    } else top = clamp(y - Math.min(r * .55, 300), BAR + 70, BAR + RH - 120);
    out.shadowBlur = 6; out.shadowColor = 'rgba(0,0,0,.9)';
    const ly = clamp(top, BAR + 40, BAR + RH - 60), lx = clamp(x, 120, RW - 120);
    text(name, lx, ly - (sub ? 18 : 0), `700 ${r < 230 ? 17 : 22}px ${MONO}`, `rgba(${col},1)`, 3);
    if (sub) text(sub, lx, ly, `700 ${r < 230 ? 12 : 15}px ${MONO}`, 'rgba(242,241,237,.9)', 4);
    out.restore();
  }
}
function text(str, x, y, font, color, spacing = 0, align = 'center') {
  out.font = font; out.letterSpacing = spacing + 'px'; out.textAlign = align; out.textBaseline = 'middle'; out.fillStyle = color;
  out.fillText(str, x + (align === 'center' ? spacing / 2 : 0), y); out.letterSpacing = '0px';
}
const RADIO = [
  [.45, 2.45, 'SENTINEL', 'VIPER 1-1, FOUR BANDITS INBOUND. YOU ARE WEAPONS FREE.'],
  [9.75, 11.4, 'VIPER 1-2', 'MISSILE LAUNCH! BREAK RIGHT, BREAK RIGHT!'],
  [27.0, 27.95, 'VIPER 1-2', 'FOX TWO… SPLASH ONE.'],
];
const CARDS = [[5.0, 6.15, 'OUTNUMBERED.'], [19.45, 20.9, 'OUTGUNNED.'], [28.35, 29.35, 'NEVER OUTFLOWN.']];
function overlays(t) {
  for (const [a, b, who, line] of RADIO) {
    if (t < a || t > b) continue;
    const n = Math.floor(seg(t, a, a + Math.min(1.2, (b - a) * .6)) * line.length);
    const al = ss(a, a + .12, t) * (1 - ss(b - .2, b, t));
    out.save(); out.globalAlpha = al;
    const y = BAR + RH - 64;
    out.fillStyle = 'rgba(8,10,14,.55)'; out.fillRect(RW / 2 - 560, y - 26, 1120, 52);
    out.fillStyle = '#E10600'; out.fillRect(RW / 2 - 560, y - 26, 4, 52);
    text(who, RW / 2 - 532, y, `700 17px ${MONO}`, '#ff5a46', 4, 'left');
    text(line.slice(0, n) + (n < line.length ? '▌' : ''), RW / 2 - 400, y, `500 19px ${MONO}`, '#F2F1ED', 2.5, 'left');
    out.restore();
  }
  for (const [a, b, word] of CARDS) {
    if (t < a || t > b) continue;
    const p = eout(seg(t, a, a + .25)), q = ss(b - .25, b, t);
    out.save(); out.globalAlpha = p * (1 - q);
    out.shadowColor = 'rgba(0,0,0,.6)'; out.shadowBlur = 40;
    text(word, RW / 2, BAR + RH * .74, `700 ${Math.round(lerp(128, 108, p))}px ${DISPLAY}`, '#F2F1ED', lerp(60, 14, p) + q * 30);
    out.shadowBlur = 0;
    out.fillStyle = '#E10600'; const w = 420 * eout(seg(t, a + .1, a + .5)); out.fillRect(RW / 2 - w / 2, BAR + RH * .74 + 66, w, 5);
    out.restore();
  }
  if (t > 30.5) {
    const u = t - 30.5;
    out.save();
    const scrim = out.createRadialGradient(RW / 2, BAR + RH / 2, 80, RW / 2, BAR + RH / 2, 900);
    scrim.addColorStop(0, `rgba(4,6,10,${.55 * ss(0, .6, u)})`); scrim.addColorStop(1, 'rgba(4,6,10,0)');
    out.fillStyle = scrim; out.fillRect(0, BAR, RW, RH);
    const word = 'GLIDEPATH';
    out.font = `700 210px ${DISPLAY}`; out.letterSpacing = '0px';
    const ws = [...word].map(c => out.measureText(c).width), sp = 22, total = ws.reduce((a, b) => a + b, 0) + sp * 8;
    let x = RW / 2 - total / 2;
    const cy = BAR + RH / 2 - 30;
    [...word].forEach((c, i) => {
      const p = seg(u, i * .045, i * .045 + .3), cx = x + ws[i] / 2; x += ws[i] + sp;
      if (p <= 0) return;
      out.save(); out.globalAlpha = p * (1 - ss(4.0, 4.45, u)); out.translate(cx, cy); out.scale(lerp(1.7, 1, eout(p)), lerp(1.7, 1, eout(p)));
      out.shadowColor = 'rgba(0,0,0,.65)'; out.shadowBlur = 36; out.textAlign = 'center'; out.textBaseline = 'middle'; out.fillStyle = '#F2F1ED';
      out.fillText(c, 0, 0); out.restore();
    });
    const fade = 1 - ss(4.0, 4.45, u);
    out.globalAlpha = fade;
    out.fillStyle = '#E10600'; out.shadowColor = 'rgba(225,6,0,.9)'; out.shadowBlur = 22;
    const lw = total * eout(seg(u, .5, 1.1)); out.fillRect(RW / 2 - lw / 2, cy + 118, lw, 6); out.shadowBlur = 0;
    out.globalAlpha = fade * ss(1.0, 1.5, u);
    text('ENDLESS FLIGHT', RW / 2, cy + 168, `500 30px ${MONO}`, '#F2F1ED', 18);
    out.globalAlpha = fade * ss(1.6, 2.1, u);
    text('TACTICAL AVIATION ACTION', RW / 2, cy + 214, `500 18px ${MONO}`, 'rgba(242,241,237,.7)', 9);
    out.restore();
  }
}

/* ------------------------------------------------------------------ frame */
const SHAKES = [[2.6, 2], [3.9, 3], [6.95, 6], [8.42, 4], [11.6, 6], [16.25, 9], [17.9, 5], [18.45, 4], [19.65, 5], [20.25, 5], [22.65, 3], [22.95, 3], [24.75, 12], [24.95, 9], [25.2, 7], [27.25, 8], [29.45, 16], [30.5, 3]];
const WHITE = [[2.6, .2, .5], [11.6, .25, .35], [16.25, .3, .45], [24.75, .35, .6], [27.25, .3, .5], [29.45, .5, .85], [30.0, .5, .9]];
export function render(t) {
  t = clamp(t, 0, DUR - 1e-4);
  for (const j of JETS) { j.visible = false; j.userData.vc.visible = false; j.userData.stores.forEach(s => s.visible = true); }
  MISSILES.forEach(m => m.visible = false); DEBRIS.forEach(d => d.visible = false);
  clouds.reset(); smoke.reset(); fire.reset(); rings.reset(); streaks.reset(); FLASHES.length = 0;
  SHAKE = 0; HANDHELD = .25; FLARE = 1; TAGS = 1; THREATS.length = 0; renderer.toneMappingExposure = .36;
  const [t0, , fn] = SHOTS.find(([a, b]) => t >= a && t < b) || SHOTS[SHOTS.length - 1];
  fn(t - t0, t);
  SHOT_U = t - t0;
  for (const [ts, a] of SHAKES) if (t >= ts) SHAKE += a * Math.exp(-(t - ts) * 4.5);
  applyShake(t);
  // clouds (static, sorted per frame)
  for (const c of CLOUD_PUFFS) { if (c.p.distanceToSquared(camera.position) < 9e8) clouds.add(c.p, c.s, c.c.x, c.c.y, c.c.z, .62, c.rot); }
  let best = null; for (const f of FLASHES) if (!best || f.i > best.i) best = f;
  flashLight.intensity = best ? Math.min(best.i, 4e5) : 0; if (best) flashLight.position.copy(best.p);
  clouds.commit(); smoke.commit(); fire.commit(); rings.commit(); streaks.commit();
  water.material.uniforms.time.value = t * .6;
  let fl = 0; for (const [ts, d, a] of WHITE) if (t >= ts && t < ts + d) fl = Math.max(fl, a * Math.pow(1 - (t - ts) / d, 2));
  grade.uniforms.uT.value = t; grade.uniforms.uFlash.value = fl;
  composer.render();
  out.fillStyle = '#000'; out.fillRect(0, 0, OUT_W, OUT_H);
  out.drawImage(glCanvas, 0, BAR);
  out.save(); out.beginPath(); out.rect(0, BAR, RW, RH); out.clip();
  lensFlare(FLARE);
  idTags();
  overlays(t);
  out.restore();
  const fade = Math.max(1 - seg(t, 0, .6), seg(t, DUR - .6, DUR));
  if (fade > 0) { out.fillStyle = `rgba(0,0,0,${fade})`; out.fillRect(0, 0, OUT_W, OUT_H); }
}
