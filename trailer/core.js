// Core toolkit for the Glidepath trailer: maths, noise, sky, water, terrain, particles, post.
import * as THREE from 'three';

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const ease = {
  inOut: t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  out: t => 1 - Math.pow(1 - t, 3),
  in: t => t * t * t,
  outExpo: t => t >= 1 ? 1 : 1 - Math.pow(2, -10 * t),
  inExpo: t => t <= 0 ? 0 : Math.pow(2, 10 * t - 10),
  outBack: t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); }
};
export const seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1);

export function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// ---------- 2D simplex noise ----------
const perm = new Uint8Array(512);
(function () {
  const r = rng(1337), p = [];
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
})();
const G2 = [[1, 1], [-1, 1], [1, -1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]];
export function noise2(xin, yin) {
  const F2 = 0.5 * (Math.sqrt(3) - 1), G = (3 - Math.sqrt(3)) / 6;
  const s = (xin + yin) * F2, i = Math.floor(xin + s), j = Math.floor(yin + s);
  const t = (i + j) * G, x0 = xin - (i - t), y0 = yin - (j - t);
  const i1 = x0 > y0 ? 1 : 0, j1 = x0 > y0 ? 0 : 1;
  const x1 = x0 - i1 + G, y1 = y0 - j1 + G, x2 = x0 - 1 + 2 * G, y2 = y0 - 1 + 2 * G;
  const ii = i & 255, jj = j & 255;
  let n = 0;
  let t0 = 0.5 - x0 * x0 - y0 * y0;
  if (t0 > 0) { const g = G2[perm[ii + perm[jj]] & 7]; t0 *= t0; n += t0 * t0 * (g[0] * x0 + g[1] * y0); }
  let t1 = 0.5 - x1 * x1 - y1 * y1;
  if (t1 > 0) { const g = G2[perm[ii + i1 + perm[jj + j1]] & 7]; t1 *= t1; n += t1 * t1 * (g[0] * x1 + g[1] * y1); }
  let t2 = 0.5 - x2 * x2 - y2 * y2;
  if (t2 > 0) { const g = G2[perm[ii + 1 + perm[jj + 1]] & 7]; t2 *= t2; n += t2 * t2 * (g[0] * x2 + g[1] * y2); }
  return 70 * n; // ~[-1,1]
}
export function fbm(x, y, oct = 5, lac = 2.0, gain = 0.5) {
  let s = 0, a = 0.5, f = 1, norm = 0;
  for (let i = 0; i < oct; i++) { s += a * noise2(x * f, y * f); norm += a; a *= gain; f *= lac; }
  return s / norm;
}
export function ridged(x, y, oct = 5) {
  let s = 0, a = 0.5, f = 1, norm = 0;
  for (let i = 0; i < oct; i++) { const n = 1 - Math.abs(noise2(x * f, y * f)); s += a * n * n; norm += a; a *= 0.5; f *= 2.03; }
  return s / norm;
}

// ---------- GLSL shared ----------
export const GLSL_NOISE = `
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);
  return mix(mix(hash12(i), hash12(i+vec2(1,0)), u.x), mix(hash12(i+vec2(0,1)), hash12(i+vec2(1,1)), u.x), u.y); }
float vfbm(vec2 p){ float s=0., a=.5; for(int i=0;i<5;i++){ s+=a*vnoise(p); p=p*2.03+vec2(17.1,9.2); a*=.5; } return s; }
`;

// ---------- SKY ----------
export function makeSky() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      uZenith: { value: new THREE.Color(0x1d4f8f) }, uHorizon: { value: new THREE.Color(0xbfd6ea) },
      uGround: { value: new THREE.Color(0x203040) }, uSunDir: { value: new THREE.Vector3(0, 0.2, -1).normalize() },
      uSunColor: { value: new THREE.Color(1, 0.9, 0.7) }, uSunSize: { value: 0.99993 }, uGlow: { value: 1 },
      uStars: { value: 0 }, uAurora: { value: 0 }, uTime: { value: 0 }, uExp: { value: 0.45 },
      uClouds: { value: 0.0 }, uCloudColor: { value: new THREE.Color(1, 1, 1) }, uCloudShade: { value: new THREE.Color(0.5, 0.5, 0.6) },
      uCloudScale: { value: 1.0 }, uMoonDir: { value: new THREE.Vector3(0, 0.3, 1).normalize() }, uMoon: { value: 0 },
      uHaze: { value: 1.0 }
    },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize((modelMatrix * vec4(position,1.)).xyz - cameraPosition); vec4 p = projectionMatrix * viewMatrix * vec4((modelMatrix*vec4(position,1.)).xyz,1.); gl_Position = p.xyww; }`,
    fragmentShader: GLSL_NOISE + `
      uniform vec3 uZenith, uHorizon, uGround, uSunDir, uSunColor, uCloudColor, uCloudShade, uMoonDir;
      uniform float uSunSize, uGlow, uStars, uAurora, uTime, uExp, uClouds, uCloudScale, uMoon, uHaze;
      varying vec3 vDir;
      void main(){
        vec3 d = normalize(vDir); float h = d.y;
        vec3 col = mix(uHorizon, uZenith, pow(clamp(h,0.,1.), uExp));
        col = mix(col, uGround, smoothstep(0.0, -0.12, h));
        float sd = dot(d, uSunDir);
        col += uSunColor * uGlow * (pow(max(sd,0.), 8.)*0.16 + pow(max(sd,0.), 90.)*0.32);
        col += uSunColor * uGlow * smoothstep(uSunSize - 0.00006, uSunSize, sd) * 9.0;
        col += uSunColor * uGlow * uHaze * 0.22 * exp(-abs(h)*9.) * pow(max(sd*0.5+0.5,0.), 4.);
        // stars
        if (uStars > 0.) {
          vec3 p = d * 260.; vec3 c = floor(p); float hs = hash12(c.xy + c.z*17.3);
          float st = step(0.985, hs) * smoothstep(0.42, 0.0, length(fract(p)-0.5));
          st *= 0.6 + 0.4*sin(uTime*3. + hs*90.);
          col += vec3(0.85,0.9,1.0) * st * uStars * 2.2 * smoothstep(0.0, 0.25, h);
        }
        // aurora curtains
        if (uAurora > 0.) {
          float az = atan(d.z, d.x);
          float acc = 0.;
          vec3 ac = vec3(0.);
          for (int i=0;i<3;i++){
            float fi = float(i);
            float band = sin(az*3.0 + fi*1.7 + uTime*0.12 + sin(az*7.0 - uTime*0.2 + fi)*0.7);
            float y0 = 0.22 + fi*0.07 + band*0.06;
            float v = (h - y0);
            float curtain = exp(-max(v,0.)*7.0) * smoothstep(-0.02, 0.0, v) ;
            float rays = 0.45 + 0.55*pow(vnoise(vec2(az*60.0 + fi*13., uTime*0.4)), 2.0);
            float a = curtain * rays * (0.5+0.5*sin(az*2.0+fi*2.3+uTime*0.1));
            ac += a * mix(vec3(0.1,1.0,0.45), vec3(0.75,0.25,1.0), smoothstep(0.0, 0.25, v));
          }
          col += ac * uAurora * 0.85 * smoothstep(0.0,0.1,h);
        }
        // moon
        if (uMoon > 0.) {
          float md = dot(d, uMoonDir);
          col += vec3(0.8,0.85,1.0) * (smoothstep(0.99975,0.9998,md)*6.0 + pow(max(md,0.),300.)*0.6) * uMoon;
        }
        // cloud layer (projected plane)
        if (uClouds > 0. && h > 0.005) {
          vec2 uv = d.xz / (h + 0.06) * 1.6 * uCloudScale + vec2(uTime*0.004, uTime*0.002);
          float n = vfbm(uv*1.3);
          float cov = smoothstep(0.6 - uClouds*0.25, 0.78 - uClouds*0.2, n);
          float lit = pow(max(sd,0.), 3.);
          vec3 cc = mix(uCloudShade, uCloudColor, 0.35 + 0.65*vfbm(uv*2.7+3.)) + uSunColor*lit*0.5*uGlow;
          col = mix(col, cc, cov * smoothstep(0.005, 0.12, h) * 0.95);
        }
        gl_FragColor = vec4(col, 1.);
      }`
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(18000, 48, 24), mat);
  mesh.frustumCulled = false; mesh.renderOrder = -10;
  return mesh;
}

// ---------- WATER ----------
export function makeWater(size = 160000) {
  const geo = new THREE.PlaneGeometry(size, size, 1, 1); geo.rotateX(-Math.PI / 2);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 }, uOffset: { value: new THREE.Vector2() }, uBlur: { value: 0 },
      uDeep: { value: new THREE.Color(0x06233a) }, uShallow: { value: new THREE.Color(0x0f5a6a) },
      uZenith: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() },
      uSunDir: { value: new THREE.Vector3(0, 0.2, -1) }, uSunColor: { value: new THREE.Color(1, 0.9, 0.7) },
      uFogColor: { value: new THREE.Color() }, uFogDensity: { value: 0.0001 }, uSpec: { value: 1 },
      uChop: { value: 1 }, uExtraLight: { value: new THREE.Color(0, 0, 0) }, uExtraPos: { value: new THREE.Vector3() }, uExtraRange: { value: 1 },
      uAurora: { value: 0 }
    },
    vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
    fragmentShader: GLSL_NOISE + `
      uniform float uTime, uBlur, uFogDensity, uSpec, uChop, uExtraRange, uAurora;
      uniform vec2 uOffset;
      uniform vec3 uDeep, uShallow, uZenith, uHorizon, uSunDir, uSunColor, uFogColor, uExtraLight, uExtraPos;
      varying vec3 vW;
      vec2 waveGrad(vec2 p){
        vec2 g = vec2(0.);
        float k = 1.0 - uBlur;
        // directional swell
        vec2 d1 = normalize(vec2(1.0, 0.35)), d2 = normalize(vec2(-0.4, 1.0)), d3 = normalize(vec2(0.8,-0.7)), d4 = normalize(vec2(-0.9,-0.2));
        g += d1 * cos(dot(d1,p)*0.021 + uTime*0.9) * 0.021 * 1.2;
        g += d2 * cos(dot(d2,p)*0.047 + uTime*1.4) * 0.047 * 0.55;
        g += d3 * cos(dot(d3,p)*0.11 + uTime*2.1) * 0.11 * 0.22 * k;
        g += d4 * cos(dot(d4,p)*0.23 + uTime*2.9) * 0.23 * 0.1 * k;
        return g * uChop;
      }
      void main(){
        vec2 p = vW.xz + uOffset;
        vec2 ps = vec2(p.x, p.y * mix(1.0, 0.004, uBlur));
        vec2 g = waveGrad(ps);
        // fine ripples
        float e = 0.6;
        vec2 q = ps*0.09 + vec2(uTime*0.05, uTime*0.03);
        float n0 = vfbm(q);
        float nx = vfbm(q+vec2(e*0.09,0.)), nz = vfbm(q+vec2(0.,e*0.09));
        g += vec2(nx-n0, nz-n0) * 6.0 * (1.0-uBlur*0.8) * uChop;
        vec3 N = normalize(vec3(-g.x, 1.0, -g.y));
        vec3 V = normalize(cameraPosition - vW);
        float dist = length(cameraPosition - vW);
        // flatten normals with distance (anti-shimmer)
        N = normalize(mix(N, vec3(0.,1.,0.), smoothstep(800., 9000., dist)*0.75));
        vec3 R = reflect(-V, N); R.y = abs(R.y);
        vec3 sky = mix(uHorizon, uZenith, pow(clamp(R.y,0.,1.),0.45));
        float sd = max(dot(R, uSunDir), 0.);
        sky += uSunColor * (pow(sd,6.)*0.15 + pow(sd,48.)*0.35);
        if (uAurora > 0.) sky += vec3(0.1,0.9,0.45)*uAurora*0.25*smoothstep(0.1,0.4,R.y);
        float fres = 0.02 + 0.98*pow(1.0 - max(dot(N,V),0.), 5.0);
        float sunUp = clamp(uSunDir.y*4.0+0.2, 0., 1.);
        vec3 body = mix(uDeep, uShallow, clamp(g.x*4.0+0.3,0.,1.)*0.5) * (0.25 + 0.75*sunUp);
        vec3 col = mix(body, sky, fres);
        col += uSunColor * pow(sd, 1600.0) * 14.0 * uSpec;
        col += uSunColor * pow(sd, 160.0) * 0.45 * uSpec;
        // a moving light source (afterburner / lava) glinting on the water
        vec3 L = uExtraPos - vW; float ld = length(L);
        col += uExtraLight * pow(max(dot(R, L/ld),0.), 40.0) * 3.0 / (1.0 + ld*ld/(uExtraRange*uExtraRange));
        float f = 1.0 - exp(-pow(dist*uFogDensity, 2.0));
        col = mix(col, uFogColor, f);
        gl_FragColor = vec4(col, 1.);
      }`
  });
  const m = new THREE.Mesh(geo, mat); m.frustumCulled = false;
  return m;
}

// ---------- TERRAIN ----------
// heightFn(x,z) -> y ; colorFn(x,z,y,ny,out:THREE.Color)
export function makeTerrain({ size, seg: n, cx = 0, cz = 0, height, color, roughness = 0.95, material }) {
  const geo = new THREE.PlaneGeometry(size, size, n, n); geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) + cx, z = pos.getZ(i) + cz;
    pos.setXYZ(i, x, height(x, z), z);
  }
  geo.computeVertexNormals();
  const nrm = geo.attributes.normal, cols = new Float32Array(pos.count * 3), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    color(pos.getX(i), pos.getZ(i), pos.getY(i), nrm.getY(i), c);
    cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  const mat = material || new THREE.MeshStandardMaterial({ vertexColors: true, roughness, metalness: 0 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true; mesh.castShadow = true;
  return mesh;
}

// ---------- soft sprite texture ----------
let _soft = null;
export function softTex() {
  if (_soft) return _soft;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.75)');
  gr.addColorStop(0.6, 'rgba(255,255,255,0.18)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  _soft = new THREE.CanvasTexture(c); _soft.colorSpace = THREE.SRGBColorSpace;
  return _soft;
}
let _smoke = null;
export function smokeTex() {
  if (_smoke) return _smoke;
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d'), img = g.createImageData(S, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dx = (x - S / 2) / (S / 2), dy = (y - S / 2) / (S / 2), r = Math.sqrt(dx * dx + dy * dy);
    const n = fbm(x * 0.02, y * 0.02, 5) * 0.5 + 0.5;
    let a = clamp(1 - r, 0, 1); a = Math.pow(a, 1.2) * clamp(n * 1.6 - 0.15, 0, 1);
    const i = (y * S + x) * 4;
    const v = 200 + n * 55;
    img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v; img.data[i + 3] = a * 255;
  }
  g.putImageData(img, 0, 0);
  _smoke = new THREE.CanvasTexture(c); _smoke.colorSpace = THREE.SRGBColorSpace;
  return _smoke;
}

// A pool of billboard sprites drawn as one InstancedMesh facing the camera.
// Each frame call set(i, x,y,z, size, r,g,b, a, rot) then commit(camera).
export class SpritePool {
  constructor(max, { tex = softTex(), additive = false, depthWrite = false, fog = true } = {}) {
    const geo = new THREE.PlaneGeometry(1, 1);
    this.max = max;
    this.col = new Float32Array(max * 4);
    geo.setAttribute('iCol', new THREE.InstancedBufferAttribute(this.col, 4));
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite, fog,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { map: { value: tex } }]),
      vertexShader: `
        attribute vec4 iCol; varying vec4 vCol; varying vec2 vUv;
        #include <fog_pars_vertex>
        void main(){
          vUv = uv; vCol = iCol;
          vec3 c = (instanceMatrix * vec4(0.,0.,0.,1.)).xyz;
          float s = length(instanceMatrix[0].xyz);
          float rot = atan(instanceMatrix[0].y, instanceMatrix[0].x);
          vec4 mv = viewMatrix * vec4(c,1.);
          vec2 o = position.xy * s; float cr = cos(rot), sr = sin(rot);
          mv.xy += vec2(o.x*cr - o.y*sr, o.x*sr + o.y*cr);
          vec4 mvPosition = mv;
          gl_Position = projectionMatrix * mv;
          #include <fog_vertex>
        }`,
      fragmentShader: `
        uniform sampler2D map; varying vec4 vCol; varying vec2 vUv;
        #include <fog_pars_fragment>
        void main(){ vec4 t = texture2D(map, vUv); gl_FragColor = vec4(vCol.rgb * t.rgb, vCol.a * t.a);
          #include <fog_fragment>
        }`
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, max);
    this.mesh.frustumCulled = false;
    this.n = 0; this._m = new THREE.Matrix4();
  }
  begin() { this.n = 0; }
  add(x, y, z, size, r, g, b, a, rot = 0) {
    if (this.n >= this.max) return;
    const i = this.n++, m = this._m.elements;
    const c = Math.cos(rot) * size, s = Math.sin(rot) * size;
    m[0] = c; m[1] = s; m[2] = 0; m[3] = 0; m[4] = -s; m[5] = c; m[6] = 0; m[7] = 0; m[8] = 0; m[9] = 0; m[10] = size; m[11] = 0;
    m[12] = x; m[13] = y; m[14] = z; m[15] = 1;
    this.mesh.setMatrixAt(i, this._m);
    this.col[i * 4] = r; this.col[i * 4 + 1] = g; this.col[i * 4 + 2] = b; this.col[i * 4 + 3] = a;
  }
  end() {
    this.mesh.count = this.n;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.geometry.attributes.iCol.needsUpdate = true;
  }
}

// ---------- post grade pass (display space) ----------
export const GradeShader = {
  uniforms: {
    tDiffuse: { value: null }, uTime: { value: 0 }, uRes: { value: new THREE.Vector2(1920, 804) },
    uVignette: { value: 0.55 }, uGrain: { value: 0.045 }, uCA: { value: 0.0015 }, uFlash: { value: 0 }, uFade: { value: 0 },
    uTint: { value: new THREE.Color(1, 1, 1) }, uContrast: { value: 1.06 }, uSat: { value: 1.08 }, uLift: { value: new THREE.Color(0, 0, 0) },
    uRadial: { value: 0 }, uFlashColor: { value: new THREE.Color(1, 1, 1) }, uEdgeGlow: { value: 0 }, uEdgeColor: { value: new THREE.Color(0.45, 0.75, 1) },
    uShake: { value: new THREE.Vector2() }
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uTime, uVignette, uGrain, uCA, uFlash, uFade, uContrast, uSat, uRadial, uEdgeGlow;
    uniform vec2 uRes, uShake; uniform vec3 uTint, uLift, uFlashColor, uEdgeColor; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
    vec3 samp(vec2 uv){
      vec2 d = uv - 0.5;
      return vec3(texture2D(tDiffuse, 0.5 + d*(1.0+uCA)).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, 0.5 + d*(1.0-uCA)).b);
    }
    void main(){
      vec2 uv = vUv + uShake;
      vec3 col = samp(uv);
      if (uRadial > 0.) {
        vec3 acc = col; float w = 1.;
        for (int i=1;i<12;i++){ float f = float(i)/12.; vec2 u2 = 0.5 + (uv-0.5)*(1.0 - uRadial*f*0.18); acc += samp(u2)*(1.0-f*0.5); w += 1.0-f*0.5; }
        col = acc / w;
      }
      col = (col - 0.5) * uContrast + 0.5;
      float l = dot(col, vec3(0.299,0.587,0.114));
      col = mix(vec3(l), col, uSat);
      col = col * uTint + uLift;
      vec2 vd = (vUv - 0.5) * vec2(1.25, 1.0);
      col *= mix(1.0, smoothstep(0.95, 0.2, length(vd)), uVignette);
      float edge = smoothstep(0.25, 0.75, length(vd));
      col += uEdgeColor * edge * uEdgeGlow;
      col += (h(vUv*uRes + fract(uTime*7.13)*100.) - 0.5) * uGrain;
      col = mix(col, uFlashColor, uFlash);
      col *= 1.0 - uFade;
      gl_FragColor = vec4(clamp(col,0.,1.), 1.);
    }`
};

// path helper: orientation from a parametric path p(t) (returns THREE.Vector3)
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3();
export function orientOnPath(obj, pathFn, t, bankMul = 0.55, maxBank = 0.8) {
  const e = 0.05;
  pathFn(t - e, _a); pathFn(t, _b); pathFn(t + e, _c);
  obj.position.copy(_b);
  const v1 = _b.clone().sub(_a), v2 = _c.clone().sub(_b);
  const fwd = _c.clone().sub(_a).normalize();
  // lateral acceleration -> bank
  const acc = v2.sub(v1).divideScalar(e * e);
  const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();
  const lat = acc.dot(right);
  const bank = clamp(Math.atan2(lat, 9.81) * bankMul, -maxBank, maxBank);
  const m = new THREE.Matrix4().lookAt(new THREE.Vector3(0, 0, 0), fwd, new THREE.Vector3(0, 1, 0));
  obj.quaternion.setFromRotationMatrix(m);
  obj.rotateZ(-bank);
  return { fwd, bank, speed: _c.distanceTo(_a) / (2 * e) };
}
