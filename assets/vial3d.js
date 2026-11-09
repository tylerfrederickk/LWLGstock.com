/* #29 Live 3D Perkinamine vial (homepage). Drag to spin; idles with a slow turn. Concept model. */
import * as THREE from 'three';
const Q = new URLSearchParams('');
const COL = {
  platform: { name: 'Silicon photonics grade', a: '#1A0B3D', b: '#8B5CF6', glint: '#D4B5FF', cap: '#7C4DFF' },
  cpo:      { name: 'CPO grade', a: '#06183A', b: '#2997FF', glint: '#9BE7FF', cap: '#0A84FF' },
};
function rnd(s) { return () => (s = (s * 16807) % 2147483647) / 2147483647; }

function labelTex(c, size) {
  const cv = document.createElement('canvas'); cv.width = 2048; cv.height = 768; const g = cv.getContext('2d');
  // frosted white label
  g.fillStyle = '#F5F5F7'; g.fillRect(0, 0, 2048, 768);
  const gr = g.createLinearGradient(0, 0, 2048, 0); gr.addColorStop(0, '#2997FF'); gr.addColorStop(.55, '#BF5AF2'); gr.addColorStop(1, '#FF375F');
  g.fillStyle = gr; g.fillRect(0, 0, 2048, 18); g.fillRect(0, 750, 2048, 18);
  // front panel centred at x=1024 (faces camera)
  g.textAlign = 'center'; g.fillStyle = '#1D1D1F';
  g.font = '600 44px Inter'; g.fillStyle = '#86868B'; g.fillText('ELECTRO-OPTIC POLYMER', 1024, 165);
  g.font = '700 132px Inter'; g.fillStyle = '#1D1D1F'; g.fillText('Perkinamine', 1024, 315);
  g.font = '600 50px Inter'; g.fillStyle = '#1D1D1F'; g.fillText('®', 1024 + 418, 250);
  g.font = '700 58px Inter'; g.fillStyle = c.cap; g.fillText(c.name, 1024, 420);
  g.font = '500 38px Inter'; g.fillStyle = '#6E6E73'; g.fillText('For silicon photonics modulators  ·  ' + (size || Q.get('size') || '1 g'), 1024, 530);
  g.font = '500 30px "DejaVu Sans Mono"'; g.fillStyle = '#86868B'; g.fillText('BEOL-COMPATIBLE · STORE COOL, DARK, DRY', 1024, 630);
  g.textAlign = 'left'; g.font = '500 30px "DejaVu Sans Mono"'; g.fillStyle = '#A1A1A6';
  ['Telcordia 85/85 passed', 'Rare-earth free', 'Concept render'].forEach((t, i) => g.fillText(t, 1500, 260 + i * 60));
  // barcode
  for (let i = 0; i < 60; i++) { g.fillStyle = '#1D1D1F'; const w = (i * 7919 % 5) + 2; g.fillRect(140 + i * 9, 280, w, 200); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

function crystals(c, count, radius, height, y0, seed = 7, mound = .35, opts_s = 1) {
  const r = rnd(seed);
  const geo = new THREE.OctahedronGeometry(1, 0);
  const mat = new THREE.MeshPhysicalMaterial({ color: c.a, metalness: .75, roughness: .14, iridescence: .6, iridescenceIOR: 1.8, iridescenceThicknessRange: [250, 900], clearcoat: 1, clearcoatRoughness: .1, sheen: .6, sheenColor: new THREE.Color(c.glint), envMapIntensity: 1.6 });
  const m = new THREE.InstancedMesh(geo, mat, count); const o = new THREE.Object3D(); const col = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * radius;
    const yTop = y0 + height + mound * (1 - (d / radius) ** 2);
    o.position.set(Math.cos(a) * d, y0 + Math.pow(r(), .6) * (yTop - y0), Math.sin(a) * d);
    const s = (0.016 + r() * 0.03) * (opts_s || 1);
    o.scale.set(s * (0.6 + r() * .8), s * (1 + r() * 1.6), s * (0.6 + r() * .8));
    o.rotation.set(r() * 6, r() * 6, r() * 6); o.updateMatrix(); m.setMatrixAt(i, o.matrix);
    col.set(c.a).lerp(new THREE.Color(r() < .12 ? c.glint : c.b), Math.pow(r(), 2) * .8); m.setColorAt(i, col);
  }
  m.castShadow = true; return m;
}

function vial(c, opts = {}) {
  const G = new THREE.Group();
  const R = 0.86, Hb = 2.95, neckR = 0.5, lipR = 0.6;
  // glass profile (outer), lathe
  const p = [];
  p.push(new THREE.Vector2(0.0, 0.0));
  for (let i = 0; i <= 8; i++) { const a = i / 8 * Math.PI / 2; p.push(new THREE.Vector2(R - 0.12 + Math.sin(a) * 0.12, 0.12 - Math.cos(a) * 0.12)); }
  p.push(new THREE.Vector2(R, Hb));
  for (let i = 0; i <= 10; i++) { const t = i / 10; p.push(new THREE.Vector2(R + (neckR - R) * (t * t * (3 - 2 * t)), Hb + t * 0.45)); }
  p.push(new THREE.Vector2(neckR, Hb + 0.62)); p.push(new THREE.Vector2(lipR, Hb + 0.66)); p.push(new THREE.Vector2(lipR, Hb + 0.86)); p.push(new THREE.Vector2(neckR - 0.08, Hb + 0.88));
  const glass = new THREE.Mesh(new THREE.LatheGeometry(p, 128), new THREE.MeshPhysicalMaterial({
    color: '#ffffff', metalness: 0, roughness: 0.03, transmission: 1, thickness: 0.25, ior: 1.5, clearcoat: 1, clearcoatRoughness: 0.02,
    specularIntensity: 1, envMapIntensity: +(Q.get('genv') || 1.4), transparent: true, side: THREE.DoubleSide, attenuationColor: new THREE.Color('#E8F4FF'), attenuationDistance: 4 }));
  glass.castShadow = true; G.add(glass);
  const inner = new THREE.Mesh(new THREE.LatheGeometry(p.map(v => new THREE.Vector2(Math.max(v.x - 0.05, 0), v.y + (v.y < 0.2 ? 0.05 : 0))), 128), new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.05, transmission: 1, thickness: 0.05, ior: 1.5, transparent: true, opacity: 1, side: THREE.BackSide, envMapIntensity: .35 }));
  G.add(inner);
  const edge = new THREE.Mesh(new THREE.LatheGeometry(p, 128), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix*vec4(position,1.); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }',
    fragmentShader: 'varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1.-abs(dot(vN,vV)), 3.); gl_FragColor = vec4(vec3(.85,.92,1.)*f*.75, f*.75); }' }));
  edge.scale.setScalar(1.002); G.add(edge);
  // contents
  if (opts.liquid) {
    const lq = new THREE.Mesh(new THREE.CylinderGeometry(R - 0.06, R - 0.06, opts.fill || 1.7, 96), new THREE.MeshPhysicalMaterial({
      color: c.b, transmission: .55, thickness: 1.6, roughness: 0.05, ior: 1.45, attenuationColor: new THREE.Color(c.b), attenuationDistance: 1.2, emissive: new THREE.Color(c.b), emissiveIntensity: .55, envMapIntensity: 1 }));
    lq.position.y = 0.06 + (opts.fill || 1.7) / 2; G.add(lq);
  } else {
    // crystalline powder filling the bottom third, with a mound on top
    const core = new THREE.Mesh(new THREE.CylinderGeometry(R - 0.2, R - 0.2, 0.95, 64), new THREE.MeshStandardMaterial({ color: '#050308', roughness: .9 }));
    core.position.y = 0.55; G.add(core);
    G.add(crystals(c, opts.n || 9000, R - 0.06, 1.05, 0.06, opts.seed || 11, 0.28));
  }
  // label
  if (!opts.noLabel) {
    const lab = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.006, R + 0.006, 1.1, 128, 1, true, -2.2, 4.4), new THREE.MeshPhysicalMaterial({ map: labelTex(c, opts.size), roughness: .5, clearcoat: .3, transparent: false }));
    lab.position.y = 2.1; lab.rotation.y = 0; G.add(lab);
  }
  // crimp cap: aluminium skirt + flip-off top
  const capY = Hb + 0.6;
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(lipR + 0.05, lipR + 0.05, 0.42, 96), new THREE.MeshPhysicalMaterial({ color: '#D4D7DD', metalness: 1, roughness: .32, clearcoat: .5 }));
  skirt.position.y = capY + 0.1; skirt.castShadow = true; G.add(skirt);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(lipR + 0.03, 0.03, 16, 96), skirt.material); ring.rotation.x = Math.PI / 2; ring.position.y = capY - 0.1; G.add(ring);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(lipR + 0.07, lipR + 0.07, 0.16, 96), new THREE.MeshPhysicalMaterial({ color: opts.capColor || c.cap, roughness: .28, clearcoat: 1, clearcoatRoughness: .08 }));
  top.position.y = capY + 0.39; top.castShadow = true; G.add(top);
  const dimple = new THREE.Mesh(new THREE.CylinderGeometry(lipR - 0.1, lipR - 0.1, 0.02, 64), new THREE.MeshPhysicalMaterial({ color: opts.capColor || c.cap, roughness: .6 }));
  dimple.position.y = capY + 0.475; G.add(dimple);
  return G;
}


export function mountVial(canvas, variant = 'platform') {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const studio = (() => {
  const e = new THREE.Scene(); e.background = new THREE.Color('#050507');
  const box = (w, h, d, x, y, z, i, col = '#ffffff') => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(i) })); m.position.set(x, y, z); e.add(m); };
  box(1.2, 14, 1.2, -7, 2, 3, 6);       // left strip
  box(1.2, 14, 1.2, 7, 2, 3, 6);        // right strip
  box(10, 0.6, 6, 0, 9, 0, 3);          // top softbox
  box(0.6, 10, 0.6, -5, 1, -7, 4, '#5AA8FF');   // blue kicker
  box(0.6, 10, 0.6, 5, 1, -7, 4, '#FF5A8A');    // pink kicker
  box(30, 0.2, 30, 0, -3, 0, .12);      // floor bounce
  return e;
})();
  scene.environment = pmrem.fromScene(studio, 0.02).texture; scene.environmentIntensity = 0.9;
  const dome = new THREE.Mesh(new THREE.SphereGeometry(60, 32, 16), new THREE.MeshBasicMaterial({ color: '#000000', side: THREE.BackSide })); scene.add(dome);
  const key = new THREE.DirectionalLight('#ffffff', 2.2); key.position.set(4, 7, 5); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.radius = 6; Object.assign(key.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4 }); scene.add(key);
  const rimL = new THREE.SpotLight('#2997FF', 60, 30, .5, .8); rimL.position.set(-6, 4, -5); scene.add(rimL);
  const rimR = new THREE.SpotLight('#FF375F', 50, 30, .5, .8); rimR.position.set(6, 3, -5); scene.add(rimR);
  const cv = document.createElement('canvas'); cv.width = cv.height = 256; const g = cv.getContext('2d');
  const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128); gr.addColorStop(0, '#fff'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.MeshPhysicalMaterial({ color: '#16161A', roughness: .28, metalness: .4, alphaMap: new THREE.CanvasTexture(cv), transparent: true, envMapIntensity: .25 }));
  fl.rotation.x = -Math.PI / 2; fl.receiveShadow = true; scene.add(fl);
  const sh = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.ShadowMaterial({ opacity: .45 })); sh.rotation.x = -Math.PI / 2; sh.position.y = .001; sh.receiveShadow = true; scene.add(sh);
  const v = vial(COL[variant], { n: 6000 }); scene.add(v);
  const camera = new THREE.PerspectiveCamera(26, 1, 0.05, 200);
  camera.position.set(0, 1.7, 11.5); camera.lookAt(0, 1.9, 0);
  const size = () => { const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); };
  size(); new ResizeObserver(size).observe(canvas);
  // drag to spin (with inertia), idle auto-turn
  let rot = 0.12, vel = 0, drag = false, lx = 0, idle = 0;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  canvas.addEventListener('pointerdown', e => { drag = true; lx = e.clientX; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', e => { if (!drag) return; const dx = e.clientX - lx; lx = e.clientX; vel = dx * 0.008; rot += vel; idle = 0; });
  const up = () => { drag = false; }; canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  let visible = true; new IntersectionObserver(en => { visible = en[0].isIntersecting; }).observe(canvas);
  const clock = new THREE.Clock();
  (function frame() {
    requestAnimationFrame(frame); if (!visible) return;
    const dt = Math.min(clock.getDelta(), .05); idle += dt;
    if (!drag) { vel *= 0.94; rot += vel; if (!reduce && idle > 1.2) rot += dt * 0.25; }
    v.rotation.y = rot; renderer.render(scene, camera);
  })();
  return renderer;
}
