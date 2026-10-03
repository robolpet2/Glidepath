// Procedural models for the trailer: the jet, the HYPER rocket, the carrier, Northreach station, trees.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rng, fbm, clamp } from './core.js';

function lathe(profile, seg = 24) {
  // profile: [radius, y] with y from tail (-) to nose (+); returns geometry pointing nose to -Z
  const g = new THREE.LatheGeometry(profile.map(p => new THREE.Vector2(p[0], p[1])), seg);
  g.rotateX(-Math.PI / 2);
  return g;
}
function flatShape(pts, depth, bevel = 0.04) {
  const s = new THREE.Shape(); s.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1 });
  g.translate(0, 0, -depth / 2);
  return g;
}

// ---------- exhaust plume shader ----------
export function plumeMaterial(core, outer) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    uniforms: { uPower: { value: 1 }, uTime: { value: 0 }, uCore: { value: new THREE.Color(core) }, uOuter: { value: new THREE.Color(outer) }, uDiamonds: { value: 1 } },
    vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv = uv; vN = normalize(normalMatrix*normal); vec4 mv = modelViewMatrix*vec4(position,1.); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `uniform float uPower, uTime, uDiamonds; uniform vec3 uCore, uOuter; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){
        float along = 1.0 - vUv.y;              // 1 at nozzle, 0 at tip
        float rim = abs(dot(normalize(vN), normalize(vV)));
        float body = pow(rim, 1.5);
        float dia = 0.6 + 0.4*pow(0.5+0.5*cos((1.0-along)*38.0), 6.0) * uDiamonds;
        float flick = 0.85 + 0.15*sin(uTime*60.0 + along*20.0);
        vec3 c = mix(uOuter, uCore, pow(along, 2.0)*body);
        float a = pow(along, 1.6) * body * dia * flick * uPower * 0.65;
        gl_FragColor = vec4(c * a, a);
      }`
  });
}

// ---------- THE JET (an Interceptor-like fighter, ~17 m) ----------
export function makeJet(opts = {}) {
  const g = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color: opts.color || 0x7d8892, metalness: 0.55, roughness: 0.38 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2a2f35, metalness: 0.6, roughness: 0.5 });
  const red = new THREE.MeshStandardMaterial({ color: 0xc8100a, metalness: 0.4, roughness: 0.4 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x1c2c3c, metalness: 0.4, roughness: 0.08, envMapIntensity: 2.0 });
  const fus = new THREE.Mesh(lathe([[0, 9.4], [0.18, 8.8], [0.45, 7.6], [0.72, 5.8], [0.92, 3.6], [1.02, 1.0], [1.05, -2.0], [1.0, -5.5], [0.85, -7.6], [0.82, -8.2], [0, -8.2]], 28), paint);
  fus.scale.set(1.0, 0.82, 1.0); g.add(fus);
  const cockpit = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), glass);
  cockpit.scale.set(0.55, 0.5, 1.9); cockpit.position.set(0, 0.62, -4.3); g.add(cockpit);
  const wingG = flatShape([[0.9, -1.8], [5.6, 3.5], [5.6, 4.5], [0.9, 4.8], [-0.9, 4.8], [-5.6, 4.5], [-5.6, 3.5], [-0.9, -1.8]], 0.16);
  wingG.rotateX(Math.PI / 2);
  const wing = new THREE.Mesh(wingG, paint); wing.position.y = -0.1; g.add(wing);
  const stabG = flatShape([[0.8, 5.6], [3.2, 7.2], [3.2, 7.9], [0.8, 8.0], [-0.8, 8.0], [-3.2, 7.9], [-3.2, 7.2], [-0.8, 5.6]], 0.12);
  stabG.rotateX(Math.PI / 2);
  const stab = new THREE.Mesh(stabG, paint); stab.position.y = 0.05; g.add(stab);
  for (const sx of [-1, 1]) {
    const finG = flatShape([[0, 0], [2.0, 3.4], [2.9, 3.4], [2.6, 0]], 0.12);
    finG.rotateY(-Math.PI / 2);   // shape x -> z (back), shape y -> up
    const fin = new THREE.Mesh(finG, paint);
    fin.position.set(sx * 0.95, 0.45, 4.4); fin.rotation.z = -sx * 0.26; g.add(fin);
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.5, 0.95), red);
    tip.position.set(sx * 0.95 + sx * 0.82, 3.55, 7.15); tip.rotation.z = -sx * 0.26; g.add(tip);
    const intake = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.95, 4.2), paint);
    intake.position.set(sx * 1.05, -0.3, -0.4); g.add(intake);
    const lip = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.85, 0.1), dark);
    lip.position.set(sx * 1.05, -0.3, -2.52); g.add(lip);
    const noz = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.6, 1.3, 16, 1, true), dark);
    noz.rotation.x = Math.PI / 2; noz.position.set(sx * 0.55, -0.05, 8.6); g.add(noz);
  }
  // afterburners
  const plumes = [];
  for (const sx of [-1, 1]) {
    const pg = new THREE.ConeGeometry(0.5, 6, 20, 1, true); pg.rotateX(Math.PI / 2); pg.translate(0, 0, 3);
    // cone tip points +Z (backwards): uv.y = 1 at base (nozzle)
    const pm = plumeMaterial(new THREE.Color(2.0, 1.5, 1.0), new THREE.Color(1.5, 0.4, 0.1));
    const p = new THREE.Mesh(pg, pm); p.position.set(sx * 0.55, -0.05, 9.2); p.frustumCulled = false;
    g.add(p); plumes.push(p);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.46, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 1.5, 0.7) }));
    disc.position.set(sx * 0.55, -0.05, 9.22); g.add(disc);
  }
  // nav lights
  const navR = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(9, 0.2, 0.2) }));
  navR.position.set(-5.6, -0.05, 4.0); g.add(navR);
  const navG = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 9, 0.6) }));
  navG.position.set(5.6, -0.05, 4.0); g.add(navG);
  const strobe = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(12, 12, 12) }));
  strobe.position.set(0, 1.0, 1.0); g.add(strobe);
  g.traverse(o => { if (o.isMesh && !(o.material.isShaderMaterial) && !(o.material.isMeshBasicMaterial)) { o.castShadow = true; o.receiveShadow = true; } });
  g.userData = { plumes, navR, navG, strobe, nozzles: [new THREE.Vector3(-0.55, -0.05, 9.4), new THREE.Vector3(0.55, -0.05, 9.4)], tips: [new THREE.Vector3(-5.6, -0.05, 4.4), new THREE.Vector3(5.6, -0.05, 4.4)] };
  g.userData.set = (t, power = 1, strobeOn = true) => {
    for (const p of plumes) { p.material.uniforms.uPower.value = power; p.material.uniforms.uTime.value = t; p.scale.set(1, 1, 0.55 + 0.6 * power); p.visible = power > 0.01; }
    strobe.visible = strobeOn && (t % 1.2) < 0.06;
  };
  return g;
}

// ---------- THE ROCKET (HYPER), ~24 m needle ----------
export function makeRocket() {
  const g = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: 0xe9edf1, metalness: 0.35, roughness: 0.3 });
  const black = new THREE.MeshStandardMaterial({ color: 0x121519, metalness: 0.6, roughness: 0.35 });
  const blue = new THREE.MeshStandardMaterial({ color: 0x7cc8ff, emissive: new THREE.Color(0x3fa8ff), emissiveIntensity: 0.0, metalness: 0.3, roughness: 0.3 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x1a2838, metalness: 0.4, roughness: 0.08, envMapIntensity: 2.0 });
  const fus = new THREE.Mesh(lathe([[0, 13], [0.12, 12.2], [0.38, 10], [0.66, 7], [0.88, 3.5], [0.98, 0], [1.0, -6], [1.08, -9], [1.16, -10.6], [0, -10.6]], 28), white);
  fus.scale.set(1, 0.9, 1); g.add(fus);
  const noseBand = new THREE.Mesh(lathe([[0, 13.05], [0.13, 12.2], [0.4, 10.0], [0.0, 10.0]], 28), black); g.add(noseBand);
  const stripe = new THREE.Mesh(new THREE.CylinderGeometry(1.01, 1.01, 0.5, 28, 1, true), blue);
  stripe.rotation.x = Math.PI / 2; stripe.position.z = 3.0; g.add(stripe);
  const cockpit = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), glass);
  cockpit.scale.set(0.45, 0.42, 2.4); cockpit.position.set(0, 0.62, -6.4); g.add(cockpit);
  const wingG = flatShape([[0.9, 2.5], [4.2, 8.6], [4.2, 9.6], [0.9, 10.2], [-0.9, 10.2], [-4.2, 9.6], [-4.2, 8.6], [-0.9, 2.5]], 0.14);
  wingG.rotateX(Math.PI / 2);
  g.add(new THREE.Mesh(wingG, black));
  const canG = flatShape([[0.6, -6.0], [1.9, -4.6], [1.9, -4.1], [0.6, -4.0], [-0.6, -4.0], [-1.9, -4.1], [-1.9, -4.6], [-0.6, -6.0]], 0.1);
  canG.rotateX(Math.PI / 2);
  g.add(new THREE.Mesh(canG, black));
  const finG = flatShape([[0, 0], [2.6, 3.6], [3.5, 3.6], [3.3, 0]], 0.14);
  finG.rotateY(-Math.PI / 2);
  const fin = new THREE.Mesh(finG, black); fin.position.set(0, 0.6, 6.8); g.add(fin);
  const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.25, 1.8, 24, 1, true), black);
  bell.rotation.x = Math.PI / 2; bell.position.z = 11.4; g.add(bell);
  const pg = new THREE.ConeGeometry(1.0, 18, 24, 1, true); pg.rotateX(Math.PI / 2); pg.translate(0, 0, 9);
  const plume = new THREE.Mesh(pg, plumeMaterial(new THREE.Color(1.3, 1.9, 2.9), new THREE.Color(0.25, 0.6, 1.8)));
  plume.position.z = 12.2; plume.frustumCulled = false; g.add(plume);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(0.95, 20), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 3.0, 4.2) }));
  disc.position.z = 12.25; g.add(disc);
  g.traverse(o => { if (o.isMesh && o.material.isMeshStandardMaterial) { o.castShadow = true; } });
  g.userData = { plume, blue, nozzle: new THREE.Vector3(0, 0, 12.4) };
  g.userData.set = (t, power = 1, glow = 0) => {
    plume.material.uniforms.uPower.value = power; plume.material.uniforms.uTime.value = t;
    plume.scale.set(1 + power * 0.15, 1 + power * 0.15, 0.4 + power * 1.1);
    blue.emissiveIntensity = glow;
  };
  return g;
}

// ---------- trees ----------
export function makeTreeMeshes(count, seed, place) {
  // place(r) -> {x,y,z,s,kind,c:THREE.Color} | null
  const conG = mergeGeometries([
    new THREE.CylinderGeometry(0.35, 0.5, 4, 5).translate(0, 2, 0),
    new THREE.ConeGeometry(3.2, 9, 7).translate(0, 7.5, 0),
    new THREE.ConeGeometry(2.4, 6.5, 7).translate(0, 11, 0)
  ].map(x => x.toNonIndexed()));
  const decG = mergeGeometries([
    new THREE.CylinderGeometry(0.4, 0.6, 4, 5).translate(0, 2, 0).toNonIndexed(),
    new THREE.IcosahedronGeometry(4.2, 0).translate(0, 7.2, 0).toNonIndexed()
  ]);
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.95, flatShading: true });
  const con = new THREE.InstancedMesh(conG, mat, count), dec = new THREE.InstancedMesh(decG, mat, count);
  const r = rng(seed), m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  let nc = 0, nd = 0;
  for (let tries = 0; tries < count * 6 && nc + nd < count; tries++) {
    const t = place(r);
    if (!t) continue;
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * 6.28);
    s.set(t.s, t.s * (0.85 + r() * 0.4), t.s); p.set(t.x, t.y - 0.5, t.z);
    m.compose(p, q, s);
    if (t.kind === 0 && nc < count) { con.setMatrixAt(nc, m); con.setColorAt(nc, t.c); nc++; }
    else if (nd < count) { dec.setMatrixAt(nd, m); dec.setColorAt(nd, t.c); nd++; }
  }
  con.count = nc; dec.count = nd;
  for (const im of [con, dec]) { im.castShadow = true; im.receiveShadow = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; }
  const g = new THREE.Group(); g.add(con, dec);
  return g;
}

// ---------- NORTHREACH research station ----------
export function makeStation() {
  const g = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: 0xf2f5f8, roughness: 0.55 });
  const orange = new THREE.MeshStandardMaterial({ color: 0xd2421a, roughness: 0.6 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x55606a, roughness: 0.5, metalness: 0.6 });
  const win = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 2.2, 1.0) });
  const reds = [];
  const domes = [[-60, 0, -30, 13], [-20, 0, -58, 10], [30, 0, -40, 15]];
  for (const [x, y, z, r] of domes) {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.95, r, r * 0.6, 24), white);
    base.position.set(x, y + r * 0.3, z); g.add(base);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(r, 28, 18, 0, Math.PI * 2, 0, Math.PI * 0.62), white);
    dome.position.set(x, y + r * 0.6, z); g.add(dome);
    const l = new THREE.Mesh(new THREE.SphereGeometry(0.6, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(14, 0.4, 0.3) }));
    l.position.set(x, y + r * 1.6 + 0.6, z); g.add(l); reds.push(l);
  }
  const blocks = [[-40, 20, 46, 12, 18], [10, 26, 34, 10, 14], [60, 10, 22, 9, 20], [-5, -10, 18, 8, 12]];
  for (const [x, z, w, h, d] of blocks) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), orange); b.position.set(x, h / 2 + 2.5, z); g.add(b);
    const legs = new THREE.Mesh(new THREE.BoxGeometry(w * 0.9, 2.5, d * 0.8), steel); legs.position.set(x, 1.25, z); g.add(legs);
    for (let i = 0; i < Math.floor(w / 5); i++) {
      const wn = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.4), win);
      wn.position.set(x - w / 2 + 3 + i * 5, h * 0.6 + 2.5, z + d / 2 + 0.05); g.add(wn);
    }
  }
  for (const [x, z, h] of [[90, -20, 70], [-100, 40, 55]]) {
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.9, h, 6), steel); mast.position.set(x, h / 2, z); g.add(mast);
    const l = new THREE.Mesh(new THREE.SphereGeometry(0.8, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(16, 0.4, 0.3) }));
    l.position.set(x, h + 0.8, z); g.add(l); reds.push(l);
  }
  const dish = new THREE.Mesh(new THREE.SphereGeometry(9, 24, 12, 0, Math.PI * 2, 0, 0.9), white);
  dish.material = white.clone(); dish.material.side = THREE.DoubleSide;
  dish.position.set(70, 14, -70); dish.rotation.x = -0.9; g.add(dish);
  const ped = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 2, 12, 8), steel); ped.position.set(70, 6, -70); g.add(ped);
  for (const [x, z] of [[-90, -10], [-82, -16]]) {
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 9, 20), white); tank.position.set(x, 4.5, z); g.add(tank);
  }
  g.traverse(o => { if (o.isMesh && o.material.isMeshStandardMaterial) { o.castShadow = true; o.receiveShadow = true; } });
  g.userData = { reds };
  g.userData.set = t => { reds.forEach((l, i) => { l.visible = ((t + i * 0.37) % 1.6) < 0.8; }); };
  return g;
}

// ---------- desert oil derrick with a gas flare ----------
export function makeDerrick() {
  const g = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({ color: 0x2d2622, roughness: 0.7, metalness: 0.4 });
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 5, 34, 4, 6, true), steel);
  tower.material = steel.clone(); tower.material.wireframe = true;
  tower.position.y = 17; g.add(tower);
  const towerSolid = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 4.2, 34, 4, 1, true), new THREE.MeshStandardMaterial({ color: 0x241e1a, roughness: 0.8, transparent: true, opacity: 0.35, side: THREE.DoubleSide }));
  towerSolid.position.y = 17; g.add(towerSolid);
  const shed = new THREE.Mesh(new THREE.BoxGeometry(12, 5, 8), steel); shed.position.set(9, 2.5, 4); g.add(shed);
  const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 22, 8), steel); stack.position.set(-14, 11, 6); g.add(stack);
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; } });
  g.userData = { flare: new THREE.Vector3(-14, 22.5, 6) };
  return g;
}

// ---------- THE CARRIER ----------
function deckTexture() {
  const W = 512, H = 2048, c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  // deck spans x:[-40,40] m (W) and length z:[-175,165] (H). helper: metres -> px
  const px = (mx) => (mx + 40) / 80 * W, pz = (mz) => (mz + 175) / 340 * H;
  x.fillStyle = '#2b2e31'; x.fillRect(0, 0, W, H);
  const r = rng(7);
  for (let i = 0; i < 9000; i++) { x.fillStyle = `rgba(${r() < 0.5 ? 0 : 255},${r() < 0.5 ? 0 : 255},${r() < 0.5 ? 0 : 255},${0.02 + r() * 0.03})`; x.fillRect(r() * W, r() * H, 2 + r() * 6, 2 + r() * 14); }
  for (let i = 0; i < 60; i++) { x.fillStyle = `rgba(0,0,0,${0.08 + r() * 0.1})`; x.beginPath(); x.ellipse(px(-30 + r() * 60), pz(-170 + r() * 330), 6 + r() * 20, 20 + r() * 60, 0, 0, 7); x.fill(); }
  x.lineWidth = 3; x.strokeStyle = 'rgba(240,240,235,0.9)';
  // deck edge lines
  x.setLineDash([]); x.beginPath(); x.moveTo(px(-36), pz(-160)); x.lineTo(px(-36), pz(160)); x.moveTo(px(32), pz(-160)); x.lineTo(px(32), pz(160)); x.stroke();
  // angled landing deck: from stern (x 6, z 160) toward port bow (x -34, z -40)
  const ax0 = 6, az0 = 160, ax1 = -36, az1 = -50;
  x.save(); x.strokeStyle = '#e8c21a'; x.lineWidth = 4; x.setLineDash([26, 18]);
  x.beginPath(); x.moveTo(px(ax0), pz(az0)); x.lineTo(px(ax1), pz(az1)); x.stroke(); x.restore();
  x.strokeStyle = 'rgba(240,240,235,0.9)'; x.lineWidth = 3; x.setLineDash([]);
  const off = 13;
  x.beginPath(); x.moveTo(px(ax0 + off), pz(az0)); x.lineTo(px(ax1 + off), pz(az1 + 4)); x.moveTo(px(ax0 - off), pz(az0)); x.lineTo(px(ax1 - off), pz(az1 - 4)); x.stroke();
  // catapult tracks at the bow
  x.strokeStyle = 'rgba(200,205,210,0.85)'; x.lineWidth = 2;
  for (const cx of [-10, 4]) { x.beginPath(); x.moveTo(px(cx), pz(-168)); x.lineTo(px(cx), pz(-60)); x.stroke(); x.fillStyle = '#e8c21a'; x.fillRect(px(cx) - 4, pz(-62), 8, 6); }
  // hull number
  x.fillStyle = 'rgba(240,240,235,0.92)'; x.font = 'bold 110px Oswald, sans-serif'; x.textAlign = 'center';
  x.save(); x.translate(px(-12), pz(-150)); x.fillText('73', 0, 0); x.restore();
  // safety walkways
  x.fillStyle = 'rgba(232,194,26,0.85)';
  for (let z = -150; z < 150; z += 14) x.fillRect(px(30.5), pz(z), 6, 18);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
export function makeCarrier(jetFactory) {
  const g = new THREE.Group();
  const hullMat = new THREE.MeshStandardMaterial({ color: 0x5d666f, roughness: 0.62, metalness: 0.25 });
  const hullDark = new THREE.MeshStandardMaterial({ color: 0x3b4249, roughness: 0.7, metalness: 0.2 });
  const boot = new THREE.MeshStandardMaterial({ color: 0x5a1d18, roughness: 0.8 });
  // lower hull: waterline outline (shape y = -z)
  const hull = [[0, 172], [8, 150], [16, 120], [19.5, 80], [20, -120], [18, -158], [-18, -158], [-20, -120], [-19.5, 80], [-16, 120], [-8, 150]];
  function ext(pts, y0, y1, mat, scale = 1) {
    const s = new THREE.Shape(); s.moveTo(pts[0][0] * scale, pts[0][1]); for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0] * scale, pts[i][1]); s.closePath();
    const geo = new THREE.ExtrudeGeometry(s, { depth: y1 - y0, bevelEnabled: false });
    geo.rotateX(-Math.PI / 2); geo.translate(0, y0, 0);
    const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; return m;
  }
  g.add(ext(hull, -9, 0.4, boot, 0.97));
  g.add(ext(hull, 0.4, 12, hullMat));
  // upper hull + flight deck, flared out, with the angled-deck sponson to port
  const deck = [[0, 176], [10, 160], [22, 130], [32, 100], [32, -150], [30, -162], [6, -165], [-14, -162], [-34, -100], [-40, -40], [-40, 30], [-26, 60], [-24, 120], [-12, 158]];
  g.add(ext(deck, 12, 19.2, hullDark, 0.92));
  {
    const s = new THREE.Shape(); s.moveTo(deck[0][0], deck[0][1]); for (let i = 1; i < deck.length; i++) s.lineTo(deck[i][0], deck[i][1]); s.closePath();
    const geo = new THREE.ExtrudeGeometry(s, { depth: 0.8, bevelEnabled: false });
    geo.rotateX(-Math.PI / 2); geo.translate(0, 19.2, 0);
    const tex = deckTexture();
    // extrude caps use raw shape coords (x, y=-z) as uv; map them onto the texture
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.repeat.set(1 / 80, -1 / 340); tex.offset.set(0.5, 1 - 175 / 340 + 0.0);
    const deckMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, metalness: 0.05 });
    const m = new THREE.Mesh(geo, [deckMat, hullDark]); m.receiveShadow = true; m.castShadow = true; g.add(m);
  }
  const DY = 20.0; // deck surface height
  // island superstructure (starboard, aft of midships)
  const isl = new THREE.Group();
  const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; isl.add(m); return m; };
  add(new THREE.BoxGeometry(12, 10, 36), hullMat, 0, 5, 0);
  add(new THREE.BoxGeometry(10.5, 8, 26), hullMat, -0.4, 14, -3);
  const bridge = add(new THREE.BoxGeometry(11, 4, 18), hullMat, -0.6, 20, -6);
  const winMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.25, 0.7) });
  add(new THREE.BoxGeometry(11.2, 1.2, 18.2), winMat, -0.6, 20.6, -6);
  add(new THREE.BoxGeometry(6, 7, 8), hullMat, 0, 25, -4);
  const mast = add(new THREE.CylinderGeometry(0.6, 1.2, 22, 6), hullDark, 0, 38, -4);
  add(new THREE.BoxGeometry(9, 0.6, 0.6), hullDark, 0, 42, -4);
  add(new THREE.BoxGeometry(7, 0.5, 0.5), hullDark, 0, 46, -4);
  const radar1 = add(new THREE.BoxGeometry(7, 2.2, 0.6), hullDark, 0, 44, -4);
  const radar2 = add(new THREE.BoxGeometry(5, 1.6, 0.5), hullDark, 0, 33.5, -10);
  add(new THREE.SphereGeometry(2.2, 14, 10), new THREE.MeshStandardMaterial({ color: 0xe6e8ea, roughness: 0.5 }), 3.5, 29.5, 6);
  add(new THREE.SphereGeometry(2.2, 14, 10), new THREE.MeshStandardMaterial({ color: 0xe6e8ea, roughness: 0.5 }), -3.5, 29.5, 6);
  const topLight = add(new THREE.SphereGeometry(0.5, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(16, 0.5, 0.3) }), 0, 49.5, -4);
  // the hull number on the island
  {
    const c = document.createElement('canvas'); c.width = 256; c.height = 256; const x = c.getContext('2d');
    x.fillStyle = 'rgba(0,0,0,0)'; x.fillRect(0, 0, 256, 256); x.fillStyle = '#f2f2ee'; x.font = 'bold 200px Oswald, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('73', 128, 136);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const num = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 0.6 }));
    num.position.set(-6.05, 13.5, 0); num.rotation.y = -Math.PI / 2; isl.add(num);
  }
  isl.position.set(26, DY, 30); g.add(isl);
  // jet blast deflector behind the bow catapult
  const jbd = new THREE.Mesh(new THREE.BoxGeometry(16, 0.6, 7), hullDark);
  jbd.position.set(-10, DY + 2.4, -66); jbd.rotation.x = 1.0; jbd.castShadow = true; g.add(jbd);
  // deck edge lights
  const lightMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 3.2, 1.2) });
  const lightMat2 = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 2.6, 6.0) });
  const lg = new THREE.SphereGeometry(0.28, 6, 4);
  for (let z = -150; z <= 150; z += 12) {
    for (const xx of [-35.5, 31.5]) { const l = new THREE.Mesh(lg, z % 24 === 0 ? lightMat : lightMat2); l.position.set(xx, DY + 0.95, z); g.add(l); }
  }
  // parked jets along the starboard side
  const parked = [];
  if (jetFactory) {
    const spots = [[18, -40, -0.7], [18, -60, -0.7], [18, -80, -0.7], [20, 80, 0.6], [20, 100, 0.6], [-28, 110, 2.4]];
    for (const [x, z, ry] of spots) { const j = jetFactory(); j.position.set(x, DY + 2.2, z); j.rotation.y = ry; j.userData.set(0, 0, false); g.add(j); parked.push(j); }
  }
  g.userData = { DY, radar1, radar2, topLight, catX: -10, catZ0: -82, catZ1: -168, jbd };
  g.userData.set = t => { radar1.rotation.y = t * 2.2; radar2.rotation.y = -t * 1.4; topLight.visible = (t % 1.5) < 0.75; };
  return g;
}

export function makeEscort() {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x5f6870, roughness: 0.6, metalness: 0.25 });
  const s = new THREE.Shape(); const pts = [[0, 80], [5, 50], [8, 0], [7.5, -70], [-7.5, -70], [-8, 0], [-5, 50]];
  s.moveTo(pts[0][0], pts[0][1]); pts.slice(1).forEach(p => s.lineTo(p[0], p[1])); s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth: 9, bevelEnabled: false }); geo.rotateX(-Math.PI / 2); geo.translate(0, -2, 0);
  g.add(new THREE.Mesh(geo, mat));
  const sup = new THREE.Mesh(new THREE.BoxGeometry(10, 9, 30), mat); sup.position.set(0, 11, 5); g.add(sup);
  const sup2 = new THREE.Mesh(new THREE.BoxGeometry(7, 7, 12), mat); sup2.position.set(0, 18, 0); g.add(sup2);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.8, 16, 6), mat); mast.position.set(0, 28, 0); g.add(mast);
  const gun = new THREE.Mesh(new THREE.BoxGeometry(4, 3, 5), mat); gun.position.set(0, 8.5, -40); g.add(gun);
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}
