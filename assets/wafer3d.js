/* LWLG Investor Index — real-time 3D silicon-photonics wafer.
   Geometry follows SEMI M1 300 mm wafers: 300 mm Ø, 775 µm thick, 1 mm 90° notch, 3 mm edge exclusion,
   backside/frontside laser ID; 26 × 33 mm reticle fields with test keys in the scribe lanes; a 220 nm Si /
   2 µm BOX silicon-photonics stack. Every chip carries a full procedurally-drawn photonic layout.
   Scrolling flies the camera from the whole wafer down to one chromophore molecule, then out to an AI
   data center. Units: 1 unit = 1 mm. Illustrative — not an actual Lightwave Logic design. */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const root = document.querySelector('.fly');
if (root) init(root);

function init(root) {
  const canvas = root.querySelector('canvas');
  const panels = [...root.querySelectorAll('.fly-panel')];
  const rail = root.querySelector('.fly-rail');
  const fade = root.querySelector('.fly-fade');
  const scaleEl = root.querySelector('.fly-scale');
  const stepEl = root.querySelector('.fly-step');
  const progEl = root.querySelector('.fly-progress i');
  const labelLayer = root.querySelector('.fly-labels');
  const N = panels.length;
  const small = matchMedia('(max-width: 800px)').matches;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const RENDER = new URLSearchParams(location.search).has('render'); // clean still renders for design work

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: RENDER, logarithmicDepthBuffer: true, powerPreference: 'high-performance', preserveDrawingBuffer: RENDER });
  } catch (e) { root.classList.add('no-webgl'); return; }
  renderer.setPixelRatio(Math.min(devicePixelRatio, small ? 1.5 : 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const maxAniso = renderer.capabilities.getMaxAnisotropy();

  const scene = new THREE.Scene();
  scene.background = RENDER ? null : new THREE.Color('#000000');
  // photo-studio environment: dark room, one big overhead softbox, coloured strip lights — gives the
  // mirror-polished silicon and metal layers the reflections you see in real wafer photography
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  envScene.add(new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), new THREE.MeshBasicMaterial({ color: '#06080F', side: THREE.BackSide })));
  const panel = (w, h, c, k, pos, look) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(k), side: THREE.DoubleSide })); m.position.set(...pos); m.lookAt(...look); envScene.add(m); };
  panel(40, 18, '#FFFFFF', 3.2, [0, 30, -8], [0, 0, 0]);          // overhead softbox
  panel(6, 34, '#3EE0FF', 4.0, [-34, 10, 10], [0, 0, 0]);        // cyan strip
  panel(6, 34, '#FF3D9A', 4.0, [34, 10, 6], [0, 0, 0]);          // magenta strip
  panel(28, 5, '#FFC97A', 3.0, [0, 6, 38], [0, 0, 0]);           // warm kicker
  panel(16, 16, '#8B6CFF', 2.2, [-14, 18, -34], [0, 0, 0]);      // violet fill
  scene.environment = pmrem.fromScene(envScene, 0.02).texture;
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 20000);

  // ---------- shared helpers ----------
  const glowTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.25, 'rgba(255,255,255,.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const glow = (color, size, opacity = 1) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false }));
    s.scale.setScalar(size); return s;
  };
  const uTime = { value: 0 };
  function pulseMat(c1, c2, rep = 6, speed = 0.6, base = 0.35) {
    return new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime, uC1: { value: new THREE.Color(c1) }, uC2: { value: new THREE.Color(c2) }, uRep: { value: rep }, uSpeed: { value: speed }, uBase: { value: base } },
      vertexShader: `#include <common>
        #include <logdepthbuf_pars_vertex>
        varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
        #include <logdepthbuf_vertex>
        }`,
      fragmentShader: `#include <logdepthbuf_pars_fragment>
        uniform float uTime,uRep,uSpeed,uBase; uniform vec3 uC1,uC2; varying vec2 vUv;
        void main(){
          #include <logdepthbuf_fragment>
          float d=fract(vUv.x*uRep-uTime*uSpeed);
          float p=smoothstep(0.0,0.12,d)*smoothstep(0.45,0.12,d);
          gl_FragColor=vec4(mix(uC1,uC2,vUv.x)*(uBase+2.2*p),uBase*0.8+0.8*p);
        }`
    });
  }
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

  // =====================================================================
  // DIMENSIONS (mm) — SEMI M1 300 mm wafer, 26 × 33 mm reticle, 2 × 2 chips per reticle
  // =====================================================================
  const R = 150, THICK = 0.775, EXCL = 3, NOTCH = 1.0;
  const RW = 26, RH = 33, SCRIBE = 0.2;
  const DW = (RW - 2 * SCRIBE) / 2, DH = (RH - 2 * SCRIBE) / 2;          // 12.8 × 16.3 mm chip
  const RX0 = -RW * 0.5, RZ0 = -RH * 0.5;                                  // reticle grid offset (centred field)
  const reticleCenter = (i, j) => new THREE.Vector3(RX0 + (i + 0.5) * RW, 0, RZ0 + (j + 0.5) * RH);
  const dieCenterOf = (i, j, a, b) => reticleCenter(i, j).add(new THREE.Vector3((a - 0.5) * (DW + SCRIBE), 0, (b - 0.5) * (DH + SCRIBE)));
  const TR = { i: 1, j: 0 };                         // target reticle
  const T = dieCenterOf(TR.i, TR.j, 0, 1);           // target chip (lower-left of that field)

  // =====================================================================
  // CHIP LAYOUT — one silicon-photonics transmitter test chip, drawn as primitives (die-local mm,
  // origin at chip centre, +x right, +z toward the notch). Used for the texture AND the 3D overlay.
  // =====================================================================
  const LANES = [-3.4, -2.0, -0.6, 0.8], ARM = 0.2, MZ0 = -3.0, MZ1 = 3.0; // 4 traveling-wave MZMs
  const prims = [];
  const P = (o) => prims.push(o);
  // seal ring
  P({ t: 'frame', inset: 0.06, w: 0.035, m: 'cu' }); P({ t: 'frame', inset: 0.13, w: 0.02, m: 'cu' });
  // bond pad rows (DC) top & bottom, aluminium
  for (let k = 0; k < 64; k++) { const x = -DW / 2 + 0.55 + k * 0.18; P({ t: 'rect', x, z: DH / 2 - 0.42, w: 0.1, h: 0.13, m: 'al' }); }
  // RF GSG pad triplets on the top edge (one per lane), gold
  const rfX = [-4.9, -3.3, -1.7, -0.1];
  rfX.forEach(x => { [-0.17, 0, 0.17].forEach((d, k) => P({ t: 'rect', x: x + d, z: -DH / 2 + 0.55, w: 0.11, h: 0.16, m: 'au' })); });
  // DC pad column on the right edge
  for (let k = 0; k < 40; k++) P({ t: 'rect', x: DW / 2 - 0.42, z: -6.8 + k * 0.18, w: 0.13, h: 0.1, m: 'al' });
  // laser input: edge coupler (spot-size converter) on the left, 1×4 MMI splitter tree
  P({ t: 'line', pts: [[-DW / 2 + 0.2, -1.3], [-5.6, -1.3]], w: 0.012, m: 'wg' });
  P({ t: 'taper', x0: -DW / 2 + 0.2, x1: -5.8, z: -1.3, w0: 0.004, w1: 0.03, m: 'wg' });
  P({ t: 'rect', x: -5.4, z: -1.3, w: 0.35, h: 0.09, m: 'si' });        // MMI 1×2
  P({ t: 'rect', x: -4.7, z: -2.7, w: 0.35, h: 0.09, m: 'si' }); P({ t: 'rect', x: -4.7, z: 0.1, w: 0.35, h: 0.09, m: 'si' });
  const sb = (x0, z0, x1, z1) => P({ t: 'sbend', x0, z0, x1, z1, w: 0.01, m: 'wg' });
  sb(-5.2, -1.3, -4.9, -2.7); sb(-5.2, -1.3, -4.9, 0.1);
  sb(-4.5, -2.7, -3.6, LANES[0]); sb(-4.5, -2.7, -3.6, LANES[1]); sb(-4.5, 0.1, -3.6, LANES[2]); sb(-4.5, 0.1, -3.6, LANES[3]);
  // Mach-Zehnder arms, heaters, polymer windows, GSG electrodes, terminations, monitor PDs, outputs
  LANES.forEach((zl, li) => {
    sb(-3.6, zl, MZ0, zl - ARM); sb(-3.6, zl, MZ0, zl + ARM);
    P({ t: 'line', pts: [[MZ0, zl - ARM], [MZ1, zl - ARM]], w: 0.01, m: 'wg' }); P({ t: 'line', pts: [[MZ0, zl + ARM], [MZ1, zl + ARM]], w: 0.01, m: 'wg' });
    sb(MZ1, zl - ARM, 3.6, zl); sb(MZ1, zl + ARM, 3.6, zl);
    P({ t: 'rect', x: 0, z: zl, w: MZ1 - MZ0 + 0.2, h: 0.62, m: 'poly' });                    // EO polymer window
    P({ t: 'rect', x: 0, z: zl - 0.45, w: MZ1 - MZ0, h: 0.3, m: 'au' });                       // ground
    P({ t: 'rect', x: 0, z: zl, w: MZ1 - MZ0, h: 0.24, m: 'au' });                             // signal
    P({ t: 'rect', x: 0, z: zl + 0.45, w: MZ1 - MZ0, h: 0.3, m: 'au' });                       // ground
    // RF taper from the GSG pads down to the electrodes
    P({ t: 'route', pts: [[rfX[li], -DH / 2 + 0.7], [rfX[li], zl - 0.9], [MZ0 - 0.4, zl]], w: 0.09, m: 'au' });
    P({ t: 'rect', x: MZ1 + 0.35, z: zl, w: 0.25, h: 0.5, m: 'tin' });                         // 50 Ω termination
    P({ t: 'meander', x: 3.9, z: zl, len: 0.9, amp: 0.12, n: 9, w: 0.018, m: 'tin' });         // thermo-optic bias heater
    P({ t: 'route', pts: [[4.4, zl], [4.4 + li * 0.15, 6.4], [DW / 2 - 0.42, 6.4 - li * 0.18]], w: 0.03, m: 'au' });
    P({ t: 'line', pts: [[3.6, zl], [5.1, zl], [5.5, -1.6 + li * 0.127], [5.75, -1.6 + li * 0.127]], w: 0.01, m: 'wg' });
    P({ t: 'pd', x: 4.75, z: zl + 0.28 });                                                     // tap monitor photodiode
  });
  // grating-coupler fiber array (127 µm pitch) on the right
  for (let k = 0; k < 8; k++) P({ t: 'grating', x: 5.95, z: -1.9 + k * 0.127 });
  // test structures: ring resonator array, spiral delay line, cut-back lines, alignment crosses
  for (let k = 0; k < 14; k++) {
    const x = -5.2 + k * 0.42, r = 0.06 + (k % 5) * 0.025;
    P({ t: 'line', pts: [[x - 0.2, 3.0], [x + 0.2, 3.0]], w: 0.008, m: 'wg' }); P({ t: 'ring', x, z: 3.0 + r + 0.018, r, w: 0.008, m: 'wg' });
  }
  P({ t: 'spiral', x: 3.1, z: 5.3, r0: 0.25, r1: 1.75, turns: 14, w: 0.008, m: 'wg' });
  for (let k = 0; k < 6; k++) P({ t: 'line', pts: [[-5.6, 4.2 + k * 0.28], [-0.6 - k * 0.6, 4.2 + k * 0.28]], w: 0.009, m: 'wg' });
  [[-5.9, -7.4], [5.9, -7.4], [-5.9, 7.4], [5.9, 7.4]].forEach(([x, z]) => P({ t: 'cross', x, z, s: 0.22, w: 0.03, m: 'au' }));
  P({ t: 'text', x: -5.6, z: 6.2, s: 0.34, txt: 'EO-PIC  4×200G  TX', m: 'au' });
  P({ t: 'text', x: -5.6, z: 6.75, s: 0.2, txt: 'POLYMER MZM · REV B · 1310 nm', m: 'al' });
  P({ t: 'text', x: -1.0, z: 2.25, s: 0.17, txt: 'RING TEST  R = 60–160 µm', m: 'al' });
  P({ t: 'text', x: 1.4, z: 7.4, s: 0.17, txt: 'SPIRAL 5 cm', m: 'al' });
  // keep-out zones for dummy metal fill
  const keep = [[-DW / 2, -DH / 2, DW, 1.05], [-DW / 2, DH / 2 - 0.65, DW, 0.65], [-6.1, -4.2, 12.2, 5.8], [DW / 2 - 0.7, -7, 0.7, 14], [-5.6, 2.2, 11.6, 5.5]];

  // material table: colour (paint) and ORM (R = iridescence, G = roughness, B = metalness)
  const MAT = {
    au: { c: '#E8B54A', orm: [0, 70, 255] }, al: { c: '#CDD3DF', orm: [0, 90, 255] }, cu: { c: '#C8834F', orm: [0, 80, 255] },
    tin: { c: '#5B5F78', orm: [0, 120, 200] }, wg: { c: '#A8F0FF', orm: [90, 30, 40] }, si: { c: '#8A97C2', orm: [140, 40, 60] },
    poly: { c: 'rgba(170,120,255,.55)', orm: [255, 25, 0] }, fill: { c: 'rgba(170,165,205,.42)', orm: [60, 80, 170] },
  };

  function drawChip(g, s, mode) {
    const W = DW * s, H = DH * s;
    const X = x => (x + DW / 2) * s, Z = z => (z + DH / 2) * s;
    const col = m => mode === 'c' ? MAT[m].c : `rgb(${MAT[m].orm.join(',')})`;
    // base: oxide cladding over silicon — thin-film interference blues/violets
    if (mode === 'c') {
      const gr = g.createLinearGradient(0, 0, W, H);
      gr.addColorStop(0, '#2B3474'); gr.addColorStop(.5, '#24446F'); gr.addColorStop(1, '#33307A');
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
    } else { g.fillStyle = 'rgb(255,32,0)'; g.fillRect(0, 0, W, H); }
    // dummy metal fill (CMP density tiles)
    g.fillStyle = col('fill');
    const fp = 0.11, fs = 0.055;
    for (let x = -DW / 2 + 0.2; x < DW / 2 - 0.2; x += fp) for (let z = -DH / 2 + 0.2; z < DH / 2 - 0.2; z += fp) {
      if (keep.some(([kx, kz, kw, kh]) => x > kx && x < kx + kw && z > kz && z < kz + kh)) continue;
      const o = ((Math.floor(z / fp) % 2) ? fp / 2 : 0);
      g.fillRect(X(x + o), Z(z), fs * s, fs * s);
    }
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (const p of prims) {
      g.fillStyle = g.strokeStyle = col(p.m || 'au');
      if (mode === 'c' && (p.m === 'au' || p.m === 'al' || p.m === 'cu') && (p.t === 'rect')) {
        const gr = g.createLinearGradient(X(p.x - p.w / 2), Z(p.z - p.h / 2), X(p.x + p.w / 2), Z(p.z + p.h / 2));
        const base = MAT[p.m].c; gr.addColorStop(0, base); gr.addColorStop(.5, '#FFF3C9'); gr.addColorStop(1, base);
        g.fillStyle = p.m === 'au' ? gr : base;
      }
      switch (p.t) {
        case 'rect': g.fillRect(X(p.x - p.w / 2), Z(p.z - p.h / 2), p.w * s, p.h * s); break;
        case 'frame': g.lineWidth = p.w * s; g.strokeRect(p.inset * s, p.inset * s, W - 2 * p.inset * s, H - 2 * p.inset * s); break;
        case 'line': case 'route': g.lineWidth = Math.max(1, p.w * s); g.beginPath(); p.pts.forEach(([x, z], k) => k ? g.lineTo(X(x), Z(z)) : g.moveTo(X(x), Z(z))); g.stroke(); break;
        case 'sbend': { g.lineWidth = Math.max(1, p.w * s); const mx = (p.x0 + p.x1) / 2; g.beginPath(); g.moveTo(X(p.x0), Z(p.z0)); g.bezierCurveTo(X(mx), Z(p.z0), X(mx), Z(p.z1), X(p.x1), Z(p.z1)); g.stroke(); break; }
        case 'taper': g.beginPath(); g.moveTo(X(p.x0), Z(p.z - p.w0)); g.lineTo(X(p.x1), Z(p.z - p.w1)); g.lineTo(X(p.x1), Z(p.z + p.w1)); g.lineTo(X(p.x0), Z(p.z + p.w0)); g.fill(); break;
        case 'ring': g.lineWidth = Math.max(1, p.w * s); g.beginPath(); g.arc(X(p.x), Z(p.z), p.r * s, 0, 6.2832); g.stroke(); break;
        case 'meander': { g.lineWidth = Math.max(1, p.w * s); g.beginPath(); for (let k = 0; k <= p.n; k++) { const x = p.x - p.len / 2 + k * p.len / p.n, z = p.z + (k % 2 ? p.amp : -p.amp); k ? g.lineTo(X(x), Z(z)) : g.moveTo(X(x), Z(z)); } g.stroke(); break; }
        case 'spiral': { g.lineWidth = Math.max(1, p.w * s); g.beginPath(); const n = 900; for (let k = 0; k <= n; k++) { const f = k / n, a = f * p.turns * 6.2832, r = p.r0 + (p.r1 - p.r0) * f; const x = p.x + Math.cos(a) * r, z = p.z + Math.sin(a) * r; k ? g.lineTo(X(x), Z(z)) : g.moveTo(X(x), Z(z)); } g.stroke(); break; }
        case 'grating': g.lineWidth = Math.max(1, 0.006 * s); for (let k = 0; k < 9; k++) { g.beginPath(); g.arc(X(p.x - 0.12), Z(p.z), (0.05 + k * 0.012) * s, -0.45, 0.45); g.stroke(); } break;
        case 'pd': g.fillStyle = col('si'); g.fillRect(X(p.x - 0.08), Z(p.z - 0.05), 0.16 * s, 0.1 * s); g.fillStyle = g.strokeStyle = col('au'); g.lineWidth = Math.max(1, 0.01 * s); for (let k = 0; k < 5; k++) { g.beginPath(); g.moveTo(X(p.x - 0.07 + k * 0.035), Z(p.z - 0.05)); g.lineTo(X(p.x - 0.07 + k * 0.035), Z(p.z + 0.05)); g.stroke(); } break;
        case 'cross': g.lineWidth = p.w * s; g.beginPath(); g.moveTo(X(p.x - p.s), Z(p.z)); g.lineTo(X(p.x + p.s), Z(p.z)); g.moveTo(X(p.x), Z(p.z - p.s)); g.lineTo(X(p.x), Z(p.z + p.s)); g.stroke(); break;
        case 'text': g.font = `600 ${p.s * s}px "JetBrains Mono", ui-monospace, monospace`; g.textBaseline = 'middle'; g.fillText(p.txt, X(p.x), Z(p.z)); break;
      }
    }
  }
  function chipTextures(px) {
    const s = px / DW, w = px, h = Math.round(DH * s);
    const make = mode => { const c = document.createElement('canvas'); c.width = w; c.height = h; drawChip(c.getContext('2d'), s, mode); return c; };
    const map = new THREE.CanvasTexture(make('c')); map.colorSpace = THREE.SRGBColorSpace;
    const ormC = make('o'), orm = new THREE.CanvasTexture(ormC);
    // surface relief: metal (B) stands tallest, silicon/waveguides (R mid-range) next, oxide lowest
    const src = ormC.getContext('2d').getImageData(0, 0, w, h).data, hgt = new Float32Array(w * h);
    for (let i = 0, j = 0; i < hgt.length; i++, j += 4) { const r = src[j], b = src[j + 2]; hgt[i] = b / 255 + (r > 60 && r < 170 ? 0.45 : 0); }
    const nc = document.createElement('canvas'); nc.width = w; nc.height = h;
    const nctx = nc.getContext('2d'), out = nctx.createImageData(w, h), od = out.data, k = 2.2;
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
      const i = yy * w + xx, l = hgt[i - (xx > 0)], r2 = hgt[i + (xx < w - 1)], u = hgt[i - (yy > 0) * w], d = hgt[i + (yy < h - 1) * w];
      let nx = (l - r2) * k, ny = (d - u) * k, nz = 1; const inv = 1 / Math.hypot(nx, ny, nz);
      const o = i * 4; od[o] = (nx * inv * .5 + .5) * 255; od[o + 1] = (ny * inv * .5 + .5) * 255; od[o + 2] = (nz * inv * .5 + .5) * 255; od[o + 3] = 255;
    }
    nctx.putImageData(out, 0, 0);
    const nrm = new THREE.CanvasTexture(nc);
    [map, orm, nrm].forEach(t => { t.anisotropy = maxAniso; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; });
    return { map, orm, nrm };
  }

  // =====================================================================
  // THE WAFER BODY — notched disc with a real edge bevel, mirror-polished silicon
  // =====================================================================
  const wafer = new THREE.Group(); scene.add(wafer);
  const bevel = 0.12, Rs = R - 0.3;
  const shape = new THREE.Shape();
  const a0 = Math.asin(NOTCH / Rs), th1 = -Math.PI / 2 + a0;
  shape.moveTo(Rs * Math.cos(th1), Rs * Math.sin(th1));
  shape.absarc(0, 0, Rs, th1, th1 + 2 * Math.PI - 2 * a0, false);
  shape.lineTo(0, -Rs + NOTCH); shape.closePath();
  const body = new THREE.ExtrudeGeometry(shape, { depth: THICK - 2 * bevel, bevelEnabled: true, bevelThickness: bevel, bevelSize: 0.3, bevelSegments: 6, curveSegments: 360 });
  body.rotateX(-Math.PI / 2); body.translate(0, -(THICK - bevel), 0);   // shape -y → world +z (notch faces the viewer)
  const silicon = new THREE.MeshPhysicalMaterial({ color: '#A3ABBD', metalness: 1, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 0.5 });
  wafer.add(new THREE.Mesh(body, silicon));

  // chips: one instanced quad per chip, every one carrying the full layout; clipped at the 3 mm edge exclusion
  const tex = chipTextures(small ? 1024 : 2048);
  const chipMat = new THREE.MeshPhysicalMaterial({
    map: tex.map, metalnessMap: tex.orm, roughnessMap: tex.orm, iridescenceMap: tex.orm, normalMap: tex.nrm, normalScale: new THREE.Vector2(0.9, -0.9),
    metalness: 1, roughness: 1, iridescence: 1, iridescenceIOR: 1.8, iridescenceThicknessRange: [120, 1100],
    clearcoat: 0.35, clearcoatRoughness: 0.25, envMapIntensity: 0.6,
  });
  // diffraction: the repeating chip structures act like a grating and split the studio lights into
  // spectral bands that sweep across the wafer as the camera moves — the signature look of a real wafer
  const uDiff = { value: 1 };
  const uL1 = { value: new THREE.Vector3(-0.45, 0.75, 0.48).normalize() }, uL2 = { value: new THREE.Vector3(0.62, 0.55, -0.56).normalize() };
  const DIFF_GLSL = `
    uniform float uDiff; uniform vec3 uL1; uniform vec3 uL2;
    vec3 spectral(float w){
      vec3 c=vec3(0.);
      if(w>=380.&&w<440.) c=vec3(-(w-440.)/60.,0.,1.);
      else if(w>=440.&&w<490.) c=vec3(0.,(w-440.)/50.,1.);
      else if(w>=490.&&w<510.) c=vec3(0.,1.,-(w-510.)/20.);
      else if(w>=510.&&w<580.) c=vec3((w-510.)/70.,1.,0.);
      else if(w>=580.&&w<645.) c=vec3(1.,-(w-645.)/65.,0.);
      else if(w>=645.&&w<=750.) c=vec3(1.,0.,0.);
      float f = w<420. ? .3+.7*(w-380.)/40. : (w>700. ? .3+.7*(750.-w)/50. : 1.);
      return w<380.||w>750. ? vec3(0.) : c*f;
    }
    vec3 grating(vec3 L, vec3 V, vec3 N, vec3 g, float d){
      vec3 H=L+V; float u=abs(dot(H,g));
      vec3 acc=vec3(0.);
      for(int m=1;m<=4;m++){ acc+=spectral(d*u*1000./float(m))/float(m); }
      vec3 Hp=H-g*dot(H,g);
      float lobe=pow(max(dot(normalize(Hp+1e-5),N),0.),55.);
      return acc*lobe;
    }
    float hash21(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }`;
  chipMat.onBeforeCompile = sh => {
    sh.uniforms.uDiff = uDiff; sh.uniforms.uL1 = uL1; sh.uniforms.uL2 = uL2;
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>' + DIFF_GLSL)
      .replace('#include <opaque_fragment>', `
        if (uDiff > 0.001) {
          vec3 V = normalize(vViewPosition);
          vec3 gx = normalize((viewMatrix*vec4(1.,0.,0.,0.)).xyz), gz = normalize((viewMatrix*vec4(0.,0.,1.,0.)).xyz);
          vec3 l1 = normalize((viewMatrix*vec4(uL1,0.)).xyz), l2 = normalize((viewMatrix*vec4(uL2,0.)).xyz);
          vec2 cell = floor(vWP.xz / vec2(${(DW + SCRIBE).toFixed(3)}, ${(DH + SCRIBE).toFixed(3)}));
          float d = 1.55 + 0.25*hash21(cell) + 0.0025*length(vWP.xz);
          float mask = 0.45 + 0.55*metalnessFactor;
          vec3 diff = grating(l1,V,normal,gx,d) + grating(l1,V,normal,gz,d*1.37) + 0.7*(grating(l2,V,normal,gx,d*1.1) + grating(l2,V,normal,gz,d*0.8));
          outgoingLight += diff * mask * uDiff * 0.9;
        }
        #include <opaque_fragment>`);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vWP = (modelMatrix * instanceMatrix * vec4(transformed,1.0)).xyz;
        #else
          vWP = (modelMatrix * vec4(transformed,1.0)).xyz;
        #endif`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;')
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        if (length(vWP.xz) > ${(R - EXCL).toFixed(1)}) discard;`);
  };
  const dies = [];
  for (let i = -7; i <= 6; i++) for (let j = -6; j <= 5; j++) for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) {
    const c = dieCenterOf(i, j, a, b);
    const near = Math.hypot(Math.max(Math.abs(c.x) - DW / 2, 0), Math.max(Math.abs(c.z) - DH / 2, 0));
    if (near < R - EXCL) dies.push(c);
  }
  const tIdx = dies.findIndex(c => c.distanceTo(T) < 0.01); if (tIdx >= 0) dies.splice(tIdx, 1);
  const dieGeo = new THREE.PlaneGeometry(DW, DH); dieGeo.rotateX(-Math.PI / 2);
  const dieMesh = new THREE.InstancedMesh(dieGeo, chipMat, dies.length);
  const m4 = new THREE.Matrix4(), col = new THREE.Color();
  dies.forEach((c, k) => {
    m4.makeTranslation(c.x, 0.02, c.z); dieMesh.setMatrixAt(k, m4);
    const ang = Math.atan2(c.z, c.x), rad = Math.hypot(c.x, c.z) / R;     // gentle diffraction tint across the wafer
    col.setHSL(((ang / 6.2832 + 1) % 1 * 0.8 + rad * 0.35 + 0.45) % 1, 0.75, 0.72); dieMesh.setColorAt(k, col);
  });
  wafer.add(dieMesh);
  // ---------- #6 YOUR NAME ON A CHIP: highlight one die + a floating etched label ----------
  let myDie = null;
  window.LWMarkDie = (name) => {
    if (myDie) { wafer.remove(myDie); myDie = null; }
    if (!name) return null;
    let h = 2166136261; for (const ch of name.toUpperCase()) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
    const k = Math.abs(h) % dies.length, c = dies[k], g = new THREE.Group(); g.position.set(c.x, 0.04, c.z);
    const frame = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(DW + 0.6, DH + 0.6).rotateX(-Math.PI / 2)), new THREE.LineBasicMaterial({ color: '#FFFFFF', transparent: true, opacity: .95 }));
    g.add(frame); const halo = glow('#3EE0FF', 34, .7); halo.position.y = 0.2; g.add(halo);
    const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 256; const x = cv.getContext('2d');
    x.font = '700 120px "DejaVu Sans Mono", monospace'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.shadowColor = '#3EE0FF'; x.shadowBlur = 30; x.fillStyle = '#FFFFFF'; x.fillText(name.toUpperCase().slice(0, 16), 512, 128);
    const lab = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false, depthTest: false }));
    lab.scale.set(64, 16, 1); lab.position.set(0, 14, 0); g.add(lab);
    g.userData = { frame, halo, lab }; wafer.add(g); myDie = g;
    return k + 1;
  };
  try { const saved = localStorage.getItem('lwlg-chipname'); if (saved) window.LWMarkDie(saved); } catch (e) { }
  // the chip the camera dives into gets a 4K drawing (2K on phones / low-memory devices)
  const big = !small && (navigator.deviceMemory || 8) >= 8;
  const hi = big ? chipTextures(4096) : tex;
  const hiMat = chipMat.clone(); Object.assign(hiMat, { map: hi.map, metalnessMap: hi.orm, roughnessMap: hi.orm, iridescenceMap: hi.orm, normalMap: hi.nrm });
  hiMat.onBeforeCompile = chipMat.onBeforeCompile;
  const hiChip = new THREE.Mesh(dieGeo, hiMat); hiChip.position.set(T.x, 0.02, T.z); wafer.add(hiChip);

  // thin-film colour bands near the rim (edge-bead removal zone), as on real processed wafers
  const bc = document.createElement('canvas'); bc.width = bc.height = 1024;
  { const g = bc.getContext('2d'), gr = g.createRadialGradient(512, 512, 512 * (R - EXCL - 0.2) / R, 512, 512, 512);
    ['#2B3474', '#3E5FB0', '#4FB3C9', '#D6C35A', '#C25AA0', '#5B3FA8', '#9AA3B8'].forEach((c, i, a) => gr.addColorStop(i / (a.length - 1), c));
    g.fillStyle = gr; g.fillRect(0, 0, 1024, 1024); }
  const bandTex = new THREE.CanvasTexture(bc); bandTex.colorSpace = THREE.SRGBColorSpace;
  const bands = new THREE.Mesh(new THREE.RingGeometry(R - EXCL, R - 0.35, 360, 1), new THREE.MeshPhysicalMaterial({ map: bandTex, metalness: .5, roughness: .15, iridescence: 1, iridescenceIOR: 1.9, iridescenceThicknessRange: [300, 1000], transparent: true, opacity: .85, envMapIntensity: .8 }));
  bands.rotation.x = -Math.PI / 2; bands.position.y = 0.012; wafer.add(bands);

  // scribe-lane test keys (overlay / CD / alignment marks) at every reticle corner and mid-lane
  const keyCanvas = document.createElement('canvas'); keyCanvas.width = 64; keyCanvas.height = 320;
  { const g = keyCanvas.getContext('2d'); g.fillStyle = '#1D2440'; g.fillRect(0, 0, 64, 320); g.fillStyle = '#E8B54A';
    for (let k = 0; k < 8; k++) g.fillRect(12, 10 + k * 38, 40, 26); g.fillStyle = '#A8F0FF'; g.fillRect(30, 0, 4, 320); }
  const keyTex = new THREE.CanvasTexture(keyCanvas); keyTex.colorSpace = THREE.SRGBColorSpace; keyTex.anisotropy = maxAniso;
  const keyGeo = new THREE.PlaneGeometry(0.16, 0.8); keyGeo.rotateX(-Math.PI / 2);
  const keyMat = chipMat.clone(); keyMat.map = keyTex; keyMat.metalnessMap = keyMat.roughnessMap = keyMat.iridescenceMap = null; keyMat.metalness = 0.6; keyMat.roughness = 0.3;
  keyMat.onBeforeCompile = chipMat.onBeforeCompile;
  const keyPos = [];
  for (let i = -7; i <= 7; i++) for (let j = -6; j <= 6; j++) {
    const x = RX0 + i * RW, z = RZ0 + j * RH;
    [[x, z + RH * 0.25], [x, z + RH * 0.75], [x + RW / 2, z + RH * 0.25], [x + RW / 2, z + RH * 0.75]].forEach(([px, pz]) => { if (Math.hypot(px, pz) < R - EXCL - 1) keyPos.push([px, pz]); });
  }
  const keys = new THREE.InstancedMesh(keyGeo, keyMat, keyPos.length);
  keyPos.forEach(([x, z], k) => { m4.makeTranslation(x, 0.024, z); keys.setMatrixAt(k, m4); });
  wafer.add(keys);

  // laser-scribed wafer ID beside the notch (in the edge exclusion)
  const idc = document.createElement('canvas'); idc.width = 1024; idc.height = 96;
  { const g = idc.getContext('2d'); g.clearRect(0, 0, 1024, 96); g.fillStyle = 'rgba(30,34,48,.85)'; g.font = '600 64px "JetBrains Mono", monospace'; g.textBaseline = 'middle'; g.fillText('LW26A07-W12  ▪▪▪ 0F3C', 8, 50); }
  const idTex = new THREE.CanvasTexture(idc); idTex.colorSpace = THREE.SRGBColorSpace; idTex.anisotropy = maxAniso;
  const idMesh = new THREE.Mesh(new THREE.PlaneGeometry(16, 1.5), new THREE.MeshBasicMaterial({ map: idTex, transparent: true, depthWrite: false }));
  idMesh.rotation.x = -Math.PI / 2; idMesh.position.set(-11.5, 0.03, R - 1.65); wafer.add(idMesh);

  // highlight of the target reticle field
  const fieldLine = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(RW, 0.01, RH)), new THREE.LineBasicMaterial({ color: '#3EE0FF', transparent: true, opacity: 0 }));
  fieldLine.position.copy(reticleCenter(TR.i, TR.j)).setY(0.02); wafer.add(fieldLine);
  // scanning inspection laser line
  const laser = new THREE.Mesh(new THREE.PlaneGeometry(2 * R, 0.6), new THREE.MeshBasicMaterial({ color: '#FF3D9A', transparent: true, opacity: .7, blending: THREE.AdditiveBlending, depthWrite: false }));
  laser.rotation.x = -Math.PI / 2; laser.position.y = 0.05; wafer.add(laser);

  // =====================================================================
  // 3D OVERLAY on the target chip — real extruded electrodes & live waveguides, aligned to the drawing
  // =====================================================================
  const chip = new THREE.Group(); chip.position.copy(T).setY(0.022); wafer.add(chip);
  const gold = new THREE.MeshPhysicalMaterial({ color: '#F2C25A', metalness: 1, roughness: .2, clearcoat: .5 });
  const siMat = new THREE.MeshPhysicalMaterial({ color: '#8592B8', metalness: .4, roughness: .3 });
  const wgMat = pulseMat('#3EE0FF', '#FF3D9A', 5, 0.55);
  const tube = (pts, r, mat = wgMat) => new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 120, r, 8), mat);
  const y = 0.012;
  LANES.forEach((zl, li) => {
    const box = (w, dz) => { const m = new THREE.Mesh(new THREE.BoxGeometry(MZ1 - MZ0, 0.012, w), gold); m.position.set(0, 0.008, zl + dz); chip.add(m); };
    box(0.3, -0.45); box(0.24, 0); box(0.3, 0.45);
    for (const sgn of [-1, 1]) {
      if (li === 2 && sgn === 1) continue;
      chip.add(tube([new THREE.Vector3(-3.6, y, zl), new THREE.Vector3(MZ0, y, zl + sgn * ARM), new THREE.Vector3(MZ1, y, zl + sgn * ARM), new THREE.Vector3(3.6, y, zl)], 0.012));
    }
    chip.add(tube([new THREE.Vector3(3.6, y, zl), new THREE.Vector3(5.1, y, zl), new THREE.Vector3(5.5, y, -1.6 + li * 0.127), new THREE.Vector3(5.8, y, -1.6 + li * 0.127)], 0.012));
  });
  chip.add(tube([new THREE.Vector3(-DW / 2 + 0.2, y, -1.3), new THREE.Vector3(-5.2, y, -1.3), new THREE.Vector3(-4.6, y, -2.0), new THREE.Vector3(-3.6, y, LANES[1])], 0.014));
  chip.add(tube([new THREE.Vector3(-5.2, y, -1.3), new THREE.Vector3(-4.6, y, -0.6), new THREE.Vector3(-3.6, y, LANES[2])], 0.014));
  const inGlow = glow('#3EE0FF', 0.9, .8); inGlow.position.set(-DW / 2 + 0.2, y, -1.3); chip.add(inGlow);

  // ---------- #1 LIVE LIGHT: photon pulses racing through all 4 lanes; speed follows today's LWLG move ----------
  const photonPaths = [];
  LANES.forEach((zl, li) => {
    const feed = li < 2 ? -2.7 : 0.1;
    for (const sgn of [-1, 1]) {
      if (li === 2 && sgn === 1) continue;
      photonPaths.push(new THREE.CatmullRomCurve3([
        new THREE.Vector3(-DW / 2 + 0.2, y + .01, -1.3), new THREE.Vector3(-5.2, y + .01, -1.3), new THREE.Vector3(-4.6, y + .01, feed),
        new THREE.Vector3(-3.6, y + .01, zl), new THREE.Vector3(MZ0, y + .01, zl + sgn * ARM), new THREE.Vector3(MZ1, y + .01, zl + sgn * ARM),
        new THREE.Vector3(3.6, y + .01, zl), new THREE.Vector3(5.1, y + .01, zl), new THREE.Vector3(5.5, y + .01, -1.6 + li * 0.127), new THREE.Vector3(5.9, y + .01, -1.6 + li * 0.127)]));
    }
  });
  const photons = [];
  photonPaths.forEach((cv, pi) => {
    for (let k = 0; k < 3; k++) {
      const trail = [];
      for (let j = 0; j < 6; j++) { const g = glow(j === 0 ? '#FFFFFF' : (pi % 2 ? '#FF3D9A' : '#3EE0FF'), (j === 0 ? 0.62 : 0.5 - j * 0.05), j === 0 ? 1 : 0.85 - j * 0.1); chip.add(g); trail.push(g); }
      photons.push({ cv, u: (k / 3 + pi * 0.13) % 1, trail });
    }
  });
  let liveK = 1, photonT = 0;
  const liveEl = root.querySelector('.fly-live');
  (async () => {
    try {
      const r = await fetch('/api/quote'); if (!r.ok) throw 0; const q = await r.json();
      if (!q.price || !q.previousClose) throw 0;
      const pct = (q.price / q.previousClose - 1) * 100;
      liveK = 1 + Math.min(Math.abs(pct), 12) * 0.22;
      if (liveEl) liveEl.innerHTML = `<i></i>Live light · LWLG ${pct >= 0 ? '+' : ''}${pct.toFixed(1)}% today · pulses ${liveK.toFixed(1)}× speed`;
    } catch (e) { if (liveEl) liveEl.innerHTML = '<i></i>Live light · pulse speed follows LWLG\'s daily move'; }
  })();

  // the zoom-target arm in detail: silicon slot waveguide filled with EO polymer
  const armZ = LANES[2] + ARM;
  const arm = new THREE.Group(); arm.position.set(0, 0.03, armZ); chip.add(arm);
  const railGeo = new THREE.BoxGeometry(MZ1 - MZ0, 0.022, 0.014);
  for (const dz of [-0.0105, 0.0105]) { const r = new THREE.Mesh(railGeo, siMat); r.position.z = dz; arm.add(r); }
  const polymer = new THREE.Mesh(new THREE.BoxGeometry(MZ1 - MZ0, 0.03, 0.05), new THREE.MeshPhysicalMaterial({ color: '#8B6CFF', emissive: '#2A1A66', transparent: true, opacity: .22, roughness: .1, depthWrite: false }));
  polymer.position.y = 0.004; arm.add(polymer);
  const slotLight = new THREE.Mesh(new THREE.BoxGeometry(MZ1 - MZ0, 0.016, 0.006), pulseMat('#3EE0FF', '#FF3D9A', 24, 0.9, 0.6)); arm.add(slotLight);
  const modeGlows = []; for (let k = 0; k < 7; k++) { const gS = glow(k % 2 ? '#FF3D9A' : '#3EE0FF', 0.05, .9); arm.add(gS); modeGlows.push(gS); }
  chip.add(tube([new THREE.Vector3(-3.6, y, LANES[2]), new THREE.Vector3(MZ0, 0.03, armZ)], 0.006));
  chip.add(tube([new THREE.Vector3(MZ1, 0.03, armZ), new THREE.Vector3(3.6, y, LANES[2])], 0.006));

  // chromophores in the gap (align with scroll) + one hero molecule
  const FOCUS_X = 0.3;
  const NM = small ? 220 : 420;
  const rodGeo = new THREE.CylinderGeometry(0.00012, 0.00012, 0.0026, 6); rodGeo.rotateZ(Math.PI / 2);
  const dGeo = new THREE.SphereGeometry(0.00042, 12, 10);
  const molMats = [new THREE.MeshStandardMaterial({ color: '#C9D3E6', metalness: .3, roughness: .4, transparent: true }), new THREE.MeshStandardMaterial({ color: '#3EE0FF', emissive: '#0D5E73', roughness: .3, transparent: true }), new THREE.MeshStandardMaterial({ color: '#FF3D9A', emissive: '#6B0D3C', roughness: .3, transparent: true })];
  const rods = new THREE.InstancedMesh(rodGeo, molMats[0], NM), donors = new THREE.InstancedMesh(dGeo, molMats[1], NM), accept = new THREE.InstancedMesh(dGeo, molMats[2], NM);
  const mols = [];
  for (let k = 0; k < NM; k++) mols.push({ p: new THREE.Vector3(FOCUS_X + (rnd() - .5) * 0.05, (rnd() - .5) * 0.014, (rnd() - .5) * 0.0068), q: new THREE.Quaternion().setFromEuler(new THREE.Euler(rnd() * 6.28, rnd() * 6.28, rnd() * 6.28)) });
  [rods, donors, accept].forEach(m => { m.frustumCulled = false; arm.add(m); });
  const qAligned = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
  const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), off = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
  let lastAlign = -1;
  function setAlign(a) {
    if (Math.abs(a - lastAlign) < 0.002) return; lastAlign = a;
    mols.forEach((m, k) => {
      tmpQ.copy(m.q).slerp(qAligned, a);
      tmpM.compose(m.p, tmpQ, one); rods.setMatrixAt(k, tmpM);
      off.set(-0.0013, 0, 0).applyQuaternion(tmpQ).add(m.p); tmpM.compose(off, tmpQ, one); donors.setMatrixAt(k, tmpM);
      off.set(0.0013, 0, 0).applyQuaternion(tmpQ).add(m.p); tmpM.compose(off, tmpQ, one); accept.setMatrixAt(k, tmpM);
    });
    rods.instanceMatrix.needsUpdate = donors.instanceMatrix.needsUpdate = accept.instanceMatrix.needsUpdate = true;
  }
  setAlign(0);
  const hero = new THREE.Group(); hero.position.set(FOCUS_X, 0.0012, 0); arm.add(hero);
  const S = 0.00045;
  const atomMat = c => new THREE.MeshPhysicalMaterial({ color: c, metalness: .1, roughness: .25, clearcoat: 1, emissive: c, emissiveIntensity: .12 });
  const atoms = [[[-9, 0, 0], '#2A3250', 1.3]];
  for (let k = 0; k < 6; k++) { const a = k / 6 * 6.283; atoms.push([[-6.4 + 1.6 * Math.cos(a), 1.6 * Math.sin(a), 0], '#DDE4F5', 1]); }
  for (let k = 0; k < 9; k++) atoms.push([[-3.6 + k * 1.3, (k % 2 ? .75 : -.75), 0], '#DDE4F5', 1]);
  [[8.4, 0, 0], [9.9, 1.2, 0], [9.9, -1.2, 0], [10.6, 2.4, 0]].forEach(p => atoms.push([p, '#FF3D9A', 1.25]));
  const aGeo = new THREE.SphereGeometry(S * 0.55, 24, 16);
  atoms.forEach(([p, c, r]) => { const m = new THREE.Mesh(aGeo, atomMat(c)); m.position.set(p[0] * S, p[1] * S, p[2] * S); m.scale.setScalar(r); hero.add(m); });
  const bonds = [[0, 4]]; for (let k = 0; k < 6; k++) bonds.push([1 + k, 1 + (k + 1) % 6]); bonds.push([1, 7]);
  for (let k = 0; k < 8; k++) bonds.push([7 + k, 8 + k]); bonds.push([15, 16], [16, 17], [16, 18], [17, 19]);
  const bMat = new THREE.MeshStandardMaterial({ color: '#8E99B5', metalness: .3, roughness: .4 });
  bonds.forEach(([a, b]) => {
    const pa = hero.children[a].position, pb = hero.children[b].position, len = pa.distanceTo(pb);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(S * .16, S * .16, len, 10), bMat);
    m.position.copy(pa).add(pb).multiplyScalar(.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), pb.clone().sub(pa).normalize()); hero.add(m);
  });
  const electron = glow('#FF3D9A', S * 6, 1); hero.add(electron);
  hero.rotation.set(0.25, 0, 0.12);

  // =====================================================================
  // THE AI FACTORY (reached through a fade)
  // =====================================================================
  const DC = new THREE.Vector3(6000, 0, 0);
  const dc = new THREE.Group(); dc.position.copy(DC); scene.add(dc);
  dc.add(new THREE.GridHelper(600, 60, '#2B3554', '#141B30'));
  const rowsN = 6, perRow = 14;
  const racks = new THREE.InstancedMesh(new THREE.BoxGeometry(8, 22, 12), new THREE.MeshPhysicalMaterial({ color: '#141A2B', metalness: .8, roughness: .35, clearcoat: .6 }), rowsN * perRow);
  const leds = new THREE.InstancedMesh(new THREE.BoxGeometry(0.3, 18, 9), new THREE.MeshBasicMaterial({ color: '#ffffff' }), rowsN * perRow);
  const palette = ['#3EE0FF', '#8B6CFF', '#FF3D9A', '#FFC44D', '#3DFFA8'].map(c => new THREE.Color(c));
  let n = 0; const rackPos = [];
  for (let r = 0; r < rowsN; r++) for (let k = 0; k < perRow; k++) {
    const x = -150 + k * 22, z = -110 + r * 44;
    tmpM.makeTranslation(x, 11, z); racks.setMatrixAt(n, tmpM);
    tmpM.makeTranslation(x + 4.2, 11, z); leds.setMatrixAt(n, tmpM); leds.setColorAt(n, palette[(r + k) % 5]);
    rackPos.push(new THREE.Vector3(x, 23, z)); n++;
  }
  dc.add(racks, leds);
  const fiberMat = pulseMat('#3EE0FF', '#FF3D9A', 3, 0.5, 0.25);
  for (let k = 0; k < 40; k++) {
    const a = rackPos[Math.floor(rnd() * rackPos.length)], b = rackPos[Math.floor(rnd() * rackPos.length)];
    if (a === b) continue;
    const mid = a.clone().add(b).multiplyScalar(.5); mid.y += 20 + a.distanceTo(b) * 0.25;
    dc.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(a, mid, b), 48, 0.5, 6), fiberMat));
  }
  const dcLight = new THREE.PointLight('#8B6CFF', 4, 0, 0); dcLight.position.set(0, 120, 0); dc.add(dcLight);

  // ---------- lights & atmosphere ----------
  const key = new THREE.DirectionalLight('#FFFFFF', 0.45); key.position.set(-200, 300, 200); scene.add(key);
  const lights = [['#3EE0FF', 0], ['#FF3D9A', 2.1], ['#FFC44D', 4.2]].map(([c, ph]) => { const l = new THREE.PointLight(c, 0.55, 0, 0); l.userData.ph = ph; scene.add(l); return l; });
  scene.add(new THREE.AmbientLight('#8090B0', 0.3));
  const starGeo = new THREE.BufferGeometry(); const sp = [], sc = [];
  for (let k = 0; k < 1400; k++) { const v = new THREE.Vector3().randomDirection().multiplyScalar(900 + Math.random() * 1600); sp.push(v.x, v.y * .6, v.z); const c = palette[k % 5]; sc.push(c.r, c.g, c.b); }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3)); starGeo.setAttribute('color', new THREE.Float32BufferAttribute(sc, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ size: 2.2, vertexColors: true, transparent: true, opacity: .5, sizeAttenuation: true, depthWrite: false }));
  scene.add(stars);

  // =====================================================================
  // CAMERA STATIONS + labelled call-outs
  // =====================================================================
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const armWorld = local => arm.localToWorld(local.clone());
  const chipPt = (x, z, yy = 0.02) => T.clone().add(V(x, yy, z));
  const RC = reticleCenter(TR.i, TR.j);
  const st = [
    { t: () => RENDER ? V(0, 0, 0) : small ? V(0, 0, -150) : V(0, 0, -98), d: V(0.05, 0.72, 1), dist: RENDER ? 470 : small ? 760 : 500, scale: '1× · 300 mm wafer', orbit: 1 },
    { t: () => V(10, 0, small ? 70 : 88), d: V(.42, .42, 1), dist: small ? 150 : 105, scale: 'Anatomy · real 300 mm specs' },
    { t: () => RC.clone().add(V(0, 0, small ? -22 : -12)), d: V(.18, 1, .62), dist: small ? 120 : 78, scale: 'Reticle · 26 × 33 mm field' },
    { t: () => T.clone().add(V(0, 0, small ? -6 : -3.8)), d: V(.1, 1, .5), dist: small ? 34 : 24, scale: '60× · one photonic chip' },
    { t: () => armWorld(V(0.6, 0.0, -ARM)), d: V(.62, .62, 1), dist: 6.2, scale: '400× · one modulator' },
    { t: () => armWorld(V(FOCUS_X, 0, 0)), d: V(1, .6, .5), dist: 0.085, scale: '20,000× · the polymer-filled gap' },
    { t: () => armWorld(V(FOCUS_X, 0, 0)), d: V(.25, 1, .35), dist: 0.022, scale: '500,000× · molecules align' },
    { t: () => armWorld(V(FOCUS_X - (small ? 0 : 0.0032), 0.0012, 0)), d: V(.12, .4, 1), dist: small ? 0.02 : 0.0155, scale: '10,000,000× · one chromophore' },
    { t: () => DC.clone().add(V(0, 10, 0)), d: V(1, .85, 1.25), dist: 300, scale: 'Zoom out · the AI factory', jump: true },
    { t: () => small ? V(0, 0, -150) : V(0, 0, -98), d: V(-.35, 1, 1.0), dist: small ? 760 : 500, scale: 'The thesis', jump: true, orbit: 1 },
  ].slice(0, N);
  st.forEach(s => s.d.normalize());

  const LABELS = [
    [1, () => V(0, 0.2, R - 0.6), 'Notch · marks the crystal orientation (1 mm, 90°)'],
    [1, () => V(38, -0.4, Math.sqrt(R * R - 38 * 38) + 0.1), '775 µm thick · polished bevelled edge'],
    [1, () => V(-48, 0, Math.sqrt((R - 1.5) ** 2 - 48 * 48)), '3 mm edge exclusion · no chips here'],
    [1, () => V(-11.5, 0, R - 1.65), 'Laser-scribed wafer ID'],
    [1, () => V(30, 0, 128), 'Partial edge chips · printed, then scrapped'],
    [2, () => RC.clone().add(V(-RW / 2, 0, -RH / 2)), 'Reticle field · 26 × 33 mm, exposed in one shot'],
    [2, () => RC.clone().add(V(0, 0, RH * 0.25)), 'Scribe lane · 0.2 mm, where the wafer is diced'],
    [2, () => RC.clone().add(V(RW / 2, 0, RH * 0.25)), 'Test keys · alignment & process monitors'],
    [3, () => chipPt(-2.0, -DH / 2 + 0.55), 'RF pads · ground-signal-ground'],
    [3, () => chipPt(0, LANES[0] - 0.4), '4 × EO-polymer modulators (gold electrodes)'],
    [3, () => chipPt(-DW / 2 + 0.3, -1.3), 'Laser input · edge coupler + splitter'],
    [3, () => chipPt(5.95, -1.4), 'Grating couplers · to the fiber'],
    [3, () => chipPt(-2.5, 3.1), 'Ring-resonator test array'],
    [3, () => chipPt(3.1, 5.3), 'Spiral delay line'],
    [3, () => chipPt(0, DH / 2 - 0.42), 'Bond pads · seal ring around the edge'],
  ];
  const labelEls = LABELS.map(([stn, , txt]) => { const d = document.createElement('div'); d.className = 'fly-label'; d.innerHTML = `<i></i><span>${txt}</span>`; labelLayer.appendChild(d); return d; });

  // ---------- rail ----------
  panels.forEach((p, i) => {
    const b = document.createElement('button'); b.type = 'button';
    b.innerHTML = `<span>${p.dataset.name}</span><i></i>`; b.tabIndex = -1; b.setAttribute('aria-hidden', 'true');
    b.onclick = () => window.LWFly(i);
    rail.appendChild(b);
  });
  window.LWFly = k => { const r = scrollRange(); scrollTo({ top: r.start + (k / (N - 1)) * r.len, behavior: reduce ? 'auto' : 'smooth' }); };
  const btns = [...rail.children];
  function scrollRange() {
    const hh = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hh')) || 0;
    const stage = root.querySelector('.fly-stage');
    return { start: root.offsetTop - hh, len: root.offsetHeight - stage.offsetHeight };
  }

  // ---------- interpolation ----------
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ease = x => x * x * (3 - 2 * x);
  const tA = new THREE.Vector3(), tB = new THREE.Vector3(), dA = new THREE.Vector3(), camT = new THREE.Vector3(), yAxis = new THREE.Vector3(0, 1, 0);
  let Pt = 0, Ps = 0, cur = -1, orbitAng = 0;

  function camAt(p) {
    const seg = Math.min(N - 2, Math.floor(p)), f = p - seg;
    const A = st[seg], B = st[seg + 1];
    const k = ease(clamp((f - 0.28) / 0.72, 0, 1));
    if (B.jump) {
      const cut = k > 0.5, S2 = cut ? B : A, kk = cut ? (k - 0.5) * 2 : k * 2;
      const dist = cut ? B.dist * Math.pow(1.6, 1 - kk) : A.dist * Math.pow(1.6, kk);
      tA.copy(S2.t()); dA.copy(S2.d); if (S2.orbit) dA.applyAxisAngle(yAxis, orbitAng);
      camera.position.copy(tA).addScaledVector(dA, dist); camT.copy(tA);
      return { fade: 1 - Math.abs(k - 0.5) * 2, dist };
    }
    tA.copy(A.t()); tB.copy(B.t());
    const kt = ease(clamp(k * 1.2, 0, 1));
    camT.copy(tA).lerp(tB, kt);
    dA.copy(A.d).lerp(B.d, k).normalize();
    const ow = (A.orbit ? 1 - k : 0) + (B.orbit ? k : 0);
    if (ow) dA.applyAxisAngle(yAxis, orbitAng * ow);
    const dist = Math.exp(Math.log(A.dist) * (1 - k) + Math.log(B.dist) * k);
    camera.position.copy(camT).addScaledVector(dA, dist);
    return { fade: 0, dist };
  }

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), small ? 0.3 : 0.38, 0.5, 0.9);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false); composer.setSize(w, h); composer.setPixelRatio(renderer.getPixelRatio());
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  addEventListener('resize', resize); resize();
  function readScroll() { const r = scrollRange(); Pt = clamp((scrollY - r.start) / r.len, 0, 1) * (N - 1); }
  addEventListener('scroll', readScroll, { passive: true }); readScroll(); Ps = Pt;

  const clock = new THREE.Clock(), proj = new THREE.Vector3();
  let visible = true;
  new IntersectionObserver(e => { visible = e[0].isIntersecting; }, { rootMargin: '-30% 0px 0px 0px' }).observe(root);

  function frame() {
    requestAnimationFrame(frame);
    if (!visible) return;
    const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
    uTime.value = t;
    Ps += (Pt - Ps) * (reduce ? 1 : Math.min(1, dt * 5));
    if (!reduce) orbitAng = Math.sin(t * 0.05) * 0.55;
    scene.updateMatrixWorld();
    const { fade: fv, dist } = camAt(Ps);
    camera.near = Math.max(dist * 0.002, 1e-6); camera.far = Math.max(dist * 60, 3000); camera.updateProjectionMatrix();
    camera.lookAt(camT);
    const ov = clamp(1 - Ps, 0, 1) + clamp(Ps - (N - 2), 0, 1);
    const lzz = ((t * 30) % (2 * (R - EXCL))) - (R - EXCL); laser.position.z = lzz; laser.scale.x = Math.sqrt(Math.max((R - EXCL) ** 2 - lzz * lzz, 1)) / R; laser.material.opacity = 0.7 * ov;
    fieldLine.material.opacity = clamp(1 - Math.abs(Ps - 2) * 1.6, 0, 1);
    const L = Math.max(dist * 0.9, 0.004);
    lights.forEach(l => { l.intensity = 0.55 * (1 - ov); const a = t * 0.35 + l.userData.ph; l.position.set(camT.x + Math.cos(a) * L * 1.6, camT.y + L * 0.7, camT.z + Math.sin(a) * L * 1.6); });
    // live photons (visible around the chip / modulator stations)
    photonT += dt * liveK;
    const pv = Ps > 2.3 && Ps < 5.4;
    photons.forEach(ph => {
      const u0 = (ph.u + photonT * 0.16) % 1;
      ph.trail.forEach((g, j) => { g.visible = pv; if (!pv) return; const u = (u0 - j * 0.006 + 1) % 1; ph.cv.getPointAt(u, g.position); });
    });
    if (myDie) { const vis = Ps < 1.6 || Ps > 8.6; myDie.visible = vis; myDie.userData.halo.material.opacity = .45 + .3 * Math.sin(t * 3); myDie.userData.frame.material.opacity = .6 + .4 * Math.sin(t * 3); }
    setAlign(ease(clamp(Ps - 5.6, 0, 1)));
    hero.visible = Ps > 5.8 && Ps < 8.2;
    const deep = ease(clamp((Ps - 5.3) / 0.7, 0, 1));
    polymer.material.opacity = 0.22 * (1 - deep) + 0.04;
    slotLight.visible = Ps < 5.75; modeGlows.forEach(g => g.visible = Ps < 5.75);
    const molO = 1 - ease(clamp((Ps - 6.35) / 0.6, 0, 1)) * 0.85;
    molMats.forEach(m => { m.opacity = molO; m.depthWrite = molO > 0.95; });
    electron.position.set(Math.sin(t * 2.2) * 9.5 * S, 0, 0);
    modeGlows.forEach((g, k) => { g.position.x = ((t * 0.6 + k / modeGlows.length) % 1) * (MZ1 - MZ0) - (MZ1 - MZ0) / 2; });
    inGlow.material.opacity = .5 + .4 * Math.sin(t * 3);
    stars.visible = dist > 5 && !RENDER;
    // call-out labels
    const w = canvas.clientWidth, h = canvas.clientHeight;
    const cTop = canvas.getBoundingClientRect().top, cp = panels[Math.round(Ps)];
    const pb = cp ? cp.getBoundingClientRect().bottom - cTop + 14 : 0;
    LABELS.forEach(([stn, pos], k) => {
      const o = clamp(1 - Math.abs(Ps - stn) * 3, 0, 1), el = labelEls[k];
      if (o <= 0.01) { el.style.opacity = 0; el.style.visibility = 'hidden'; return; }
      proj.copy(pos()).project(camera);
      const x = (proj.x * .5 + .5) * w, yy = (-proj.y * .5 + .5) * h;
      const onScreen = proj.z < 1 && x > 0 && x < w && yy > pb && yy < h - 60;
      el.style.visibility = onScreen ? 'visible' : 'hidden';
      el.style.opacity = o; el.style.transform = `translate(${x}px,${yy}px)`;
      el.classList.toggle('left', x > w * 0.72);
    });
    // panels + HUD
    const ci = Math.round(Ps);
    panels.forEach((p, i) => {
      const o = clamp(1 - Math.abs(Ps - i) * 2.2, 0, 1);
      p.style.opacity = o; p.style.visibility = o < 0.02 ? 'hidden' : 'visible';
      p.style.transform = `translateY(${(Ps - i) * -36}px)`;
    });
    if (ci !== cur) { cur = ci; btns.forEach((b, i) => b.classList.toggle('cur', i === ci)); scaleEl.textContent = st[ci].scale; if (stepEl) stepEl.textContent = String(ci + 1).padStart(2, '0') + ' / ' + String(N).padStart(2, '0'); }
    if (progEl) progEl.style.transform = `scaleX(${(Ps / (N - 1)).toFixed(4)})`;
    fade.style.opacity = fv;
    uDiff.value = 1 - ease(clamp((Ps - 2.15) / 0.85, 0, 1)) * 0.88 - (Ps > 3.6 ? 0.12 : 0);
    if (RENDER) renderer.render(scene, camera); else composer.render();
  }
  frame();
  root.classList.add('ready');
}
