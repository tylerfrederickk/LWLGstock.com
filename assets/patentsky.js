/* #17 Patent constellation: every granted patent as a star, clustered by topic. Drag to orbit, hover to read, click to open. */
import * as THREE from 'three';
const box = document.getElementById('psky'); if (box) init();
async function init() {
  const data = await (await fetch('data/patents.json')).json();
  const P = data.patents;
  const canvas = box.querySelector('canvas'), tip = box.querySelector('.psky-tip'), labels = box.querySelector('.psky-labels');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(50, 1, .1, 500);
  const CAT = {
    'chemistry': { c: '#BF5AF2', p: [-12, 2, 0], name: 'Chemistry' },
    'device design': { c: '#2997FF', p: [11, 3, -3], name: 'Device design' },
    'packaging': { c: '#30D158', p: [4, -8, 6], name: 'Packaging' },
    'fabrication': { c: '#FFD60A', p: [-4, -7, -9], name: 'Fabrication' },
    'other': { c: '#FF375F', p: [0, 10, 7], name: 'Other' },
  };
  let sd = 11; const rnd = () => (sd = sd * 16807 % 2147483647) / 2147483647;
  const glowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.18, 'rgba(255,255,255,.85)'); gr.addColorStop(.45, 'rgba(255,255,255,.18)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
  const root = new THREE.Group(); scene.add(root);
  // background dust
  const dust = new Float32Array(1800 * 3); for (let i = 0; i < dust.length; i++) dust[i] = (rnd() - .5) * 140;
  const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(dust, 3));
  root.add(new THREE.Points(dg, new THREE.PointsMaterial({ size: .18, color: '#8E8E93', transparent: true, opacity: .5, depthWrite: false })));
  const stars = [], byCat = {};
  const newest = Math.max(...P.map(p => +new Date(p.granted || '2000-01-01')));
  P.forEach((p, i) => {
    const k = CAT[p.category] ? p.category : 'other', C = CAT[k];
    const r = 1.4 + rnd() * 5, th = rnd() * Math.PI * 2, ph = Math.acos(2 * rnd() - 1);
    const pos = new THREE.Vector3(C.p[0] + r * Math.sin(ph) * Math.cos(th), C.p[1] + r * Math.cos(ph) * .7, C.p[2] + r * Math.sin(ph) * Math.sin(th));
    const age = (newest - +new Date(p.granted || '2000-01-01')) / (365 * 864e5);   // years
    const s = 1.1 + Math.max(0, 2.2 - age * .25);                                // newer = bigger
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: C.c, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    sp.position.copy(pos); sp.scale.setScalar(s); sp.userData = { i, base: s, ph: rnd() * 6 }; root.add(sp); stars.push(sp);
    (byCat[k] = byCat[k] || []).push(sp);
  });
  // constellation lines: link each star to its nearest neighbour(s) in the same topic
  Object.entries(byCat).forEach(([k, arr]) => {
    const pts = [];
    arr.forEach((a, ai) => {
      const d = arr.map((b, bi) => [bi, a.position.distanceToSquared(b.position)]).filter(x => x[0] !== ai).sort((x, y) => x[1] - y[1]).slice(0, 2);
      d.forEach(([bi]) => { if (bi > ai || d.length < 2) pts.push(a.position, arr[bi].position); });
    });
    const g = new THREE.BufferGeometry().setFromPoints(pts);
    root.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: CAT[k].c, transparent: true, opacity: .28, depthWrite: false })));
  });
  // topic labels
  const labEls = Object.entries(CAT).filter(([k]) => byCat[k]).map(([k, C]) => { const e = document.createElement('div'); e.className = 'psky-lab'; e.style.color = C.c; e.textContent = `${C.name} · ${byCat[k].length}`; labels.appendChild(e); return { e, p: new THREE.Vector3(...C.p).add(new THREE.Vector3(0, 6.2, 0)) }; });
  // camera orbit (drag) + idle drift
  let yaw = .4, pitch = .18, vy = 0, vp = 0, dist = 25, drag = false, lx = 0, ly = 0, idle = 0, moved = 0;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  canvas.addEventListener('pointerdown', e => { drag = true; moved = 0; lx = e.clientX; ly = e.clientY; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', e => {
    if (drag) { const dx = e.clientX - lx, dy = e.clientY - ly; lx = e.clientX; ly = e.clientY; moved += Math.abs(dx) + Math.abs(dy); vy = dx * .006; vp = dy * .004; yaw += vy; pitch = Math.max(-1, Math.min(1, pitch + vp)); idle = 0; }
    hover(e);
  });
  canvas.addEventListener('pointerup', e => { drag = false; if (moved < 6) pick(e); });
  canvas.addEventListener('pointerleave', () => { tip.hidden = true; hot = null; });
  canvas.addEventListener('wheel', e => { e.preventDefault(); dist = Math.max(16, Math.min(60, dist + e.deltaY * .02)); }, { passive: false });
  const ray = new THREE.Raycaster(), m = new THREE.Vector2(); let hot = null;
  const at = e => { const r = canvas.getBoundingClientRect(); m.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1); ray.setFromCamera(m, camera); const h = ray.intersectObjects(stars)[0]; return h ? h.object : null; };
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function hover(e) {
    const o = at(e); hot = o; canvas.style.cursor = o ? 'pointer' : (drag ? 'grabbing' : 'grab');
    if (!o) { tip.hidden = true; return; }
    const p = P[o.userData.i], r = box.getBoundingClientRect();
    tip.innerHTML = `<div class="mono note">${esc(p.number)}${p.granted ? ' · granted ' + esc(p.granted) : ''}</div><b>${esc(p.title)}</b><p>${esc(p.plain_english)}</p><div class="note">Click to open the full card</div>`;
    tip.hidden = false; tip.style.left = Math.min(e.clientX - r.left + 16, r.width - 340) + 'px'; tip.style.top = Math.max(e.clientY - r.top - 20, 10) + 'px';
  }
  function pick(e) {
    const o = at(e); if (!o) return; const p = P[o.userData.i];
    const card = [...document.querySelectorAll('#dies .die-t')].find(d => d.textContent.includes(p.number));
    if (card) { card.click(); card.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' }); }
  }
  const size = () => { const w = box.clientWidth, h = box.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); };
  size(); new ResizeObserver(size).observe(box);
  let visible = true; new IntersectionObserver(en => { visible = en[0].isIntersecting; }).observe(box);
  const clock = new THREE.Clock(), v = new THREE.Vector3();
  (function frame() {
    requestAnimationFrame(frame); if (!visible) return;
    const dt = Math.min(clock.getDelta(), .05), t = clock.elapsedTime; idle += dt;
    if (!drag) { vy *= .94; vp *= .9; yaw += vy; if (!reduce && idle > 1.5) yaw += dt * .06; }
    camera.position.set(Math.sin(yaw) * Math.cos(pitch) * dist, Math.sin(pitch) * dist, Math.cos(yaw) * Math.cos(pitch) * dist); camera.lookAt(0, 0, 0);
    stars.forEach(s => { const tw = reduce ? 1 : 1 + Math.sin(t * 2 + s.userData.ph) * .12; s.scale.setScalar(s.userData.base * tw * (s === hot ? 1.8 : 1)); });
    renderer.render(scene, camera);
    const w = box.clientWidth, h = box.clientHeight;
    labEls.forEach(L => { v.copy(L.p).project(camera); L.e.style.transform = `translate(${(v.x * .5 + .5) * w}px,${(-v.y * .5 + .5) * h}px) translate(-50%,-50%)`; L.e.style.opacity = v.z < 1 ? 1 : 0; });
  })();
}
