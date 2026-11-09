/* Unverified connections: rainbow arc chart (Research page + homepage). */
(async function () {
  const E = LW.esc, svg = document.getElementById('cx-svg'); if (!svg) return;
  const LINKS = svg.dataset.sources !== 'off';
  const d = await LW.getJSON('data/connections.json');
  const N = d.nodes, idx = Object.fromEntries(N.map((n, i) => [n.id, i]));
  const W = 1240, H = 720, base = 470, x0 = 40, x1 = W - 40;
  const X = i => x0 + (x1 - x0) * (i / (N.length - 1));
  const deg = {}; d.links.forEach(l => { deg[l.a] = (deg[l.a] || 0) + 1; deg[l.b] = (deg[l.b] || 0) + 1; });
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const ns = 'http://www.w3.org/2000/svg', el = (t, a) => { const e = document.createElementNS(ns, t); for (const k in a) e.setAttribute(k, a[k]); return e; };
  const span = l => Math.abs(idx[l.a] - idx[l.b]) / (N.length - 1);
  const hue = s => 130 + s * 190;                                 // green (short) -> violet (long), like the Bible chart
  const arc = (xa, xb, lift) => { const r = Math.abs(xb - xa) / 2; return `M${xa},${base} A${r},${r * lift} 0 0 1 ${xb},${base}`; };
  // seeded jitter for the "bundle" look
  let sd = 7; const rnd = () => (sd = sd * 16807 % 2147483647) / 2147483647;
  const gAll = el('g', {}); svg.appendChild(gAll);
  const groups = [];
  d.links.forEach((l, k) => {
    let xa = X(idx[l.a]), xb = X(idx[l.b]); if (xa > xb) [xa, xb] = [xb, xa];
    const s = span(l), h = hue(s), g = el('g', { class: 'cx-l k-' + l.kind, 'data-i': k });
    const strands = l.kind === 'confirmed' ? 3 : l.kind === 'whatif' ? 10 : 26;
    for (let j = 0; j < strands; j++) {
      const ja = (rnd() - .5) * 14, jb = (rnd() - .5) * 14, lift = 0.86 + rnd() * 0.2;
      const p = el('path', { d: arc(xa + ja, xb + jb, lift), fill: 'none' });
      if (l.kind === 'confirmed') { p.setAttribute('stroke', 'rgba(245,245,247,.55)'); p.setAttribute('stroke-width', '1'); }
      else if (l.status === 'called') { p.setAttribute('stroke', `hsla(${44 + (rnd() - .5) * 10},100%,${55 + rnd() * 12}%,.6)`); p.setAttribute('stroke-width', (0.8 + rnd()).toFixed(2)); }
      else { p.setAttribute('stroke', `hsla(${h + (rnd() - .5) * 24},90%,${58 + rnd() * 10}%,${l.kind === 'whatif' ? .5 : .32})`); p.setAttribute('stroke-width', (0.6 + rnd() * 0.9).toFixed(2)); if (l.kind === 'whatif') p.setAttribute('stroke-dasharray', '5 5'); }
      g.appendChild(p);
    }
    const hit = el('path', { d: arc(xa, xb, .96), fill: 'none', stroke: 'transparent', 'stroke-width': 14, class: 'cx-hit', tabindex: 0, role: 'button', 'aria-label': l.title });
    g.appendChild(hit); gAll.appendChild(g); groups.push(g);
  });
  // baseline: bars (height = how often a name comes up) + labels
  const gb = el('g', {}); svg.appendChild(gb);
  gb.appendChild(el('rect', { x: x0 - 12, y: base, width: x1 - x0 + 24, height: 10, fill: '#2C2C2E', rx: 2 }));
  const gcol = { core: '#BF5AF2', foundry: '#64D2FF', chip: '#30D158', cloud: '#FFD60A', market: '#FF9F0A', dream: '#FF375F' };
  N.forEach((n, i) => {
    const x = X(i), g = el('g', { class: 'cx-n', 'data-n': n.id, tabindex: 0, role: 'button', 'aria-label': n.label });
    g.appendChild(el('rect', { x: x - 4, y: base + 12, width: 8, height: 6 + Math.min((deg[n.id] || 0) * 5, 50), fill: gcol[n.group], rx: 1.5, opacity: .85 }));
    const ty = base + 30 + Math.min((deg[n.id] || 0) * 5, 50); const t = el('text', { x: x + 4, y: ty, transform: `rotate(62 ${x + 4} ${ty})`, fill: gcol[n.group], 'font-size': 15, 'font-weight': 600, 'font-family': 'Inter, system-ui, sans-serif' }); t.textContent = n.label;
    g.appendChild(t); gb.appendChild(g);
  });
  // interaction
  const card = document.getElementById('cx-card');
  const badge = (k, st) => st === 'called' ? '<span class="st delivered">Called it</span>' : st === 'debunked' ? '<span class="st missed">Debunked</span>' : k === 'confirmed' ? '<span class="st delivered">Confirmed</span>' : k === 'whatif' ? '<span class="st changed">Our what-if</span>' : '<span class="st pending">Unverified</span>';
  const show = l => {
    card.innerHTML = `<div class="cx-c-top">${badge(l.kind, l.status)}<span class="mono note">${E(N[idx[l.a]].label)} ⟷ ${E(N[idx[l.b]].label)}</span></div><h3>${E(l.title)}</h3><p>${E(l.claim)}</p><div class="cx-reality"><b>What's actually known:</b> ${E(l.reality)}</div>${l.status === 'called' || l.status === 'debunked' ? `<div class="cx-resolved ${l.status}">${l.status === 'called' ? '✓ Came true' : '✕ Debunked'}${l.resolved ? ' on ' + E(l.resolved) : ''}${l.resolved_source && LINKS ? ` · <a href="${E(l.resolved_source)}" target="_blank" rel="noopener">Proof ↗</a>` : ''}</div>` : ''}<div class="cx-meta">${E(l.who)} · ${E(l.where)}${l.date ? ' · ' + E(l.date) : ''} ${LINKS ? `· <a href="${E(l.url)}" target="_blank" rel="noopener">Source ↗</a>` : ''}</div>`;
  };
  let filter = 'all';
  const focus = ids => { groups.forEach((g, k) => { const l = d.links[k], vis = filter === 'all' || l.kind === filter; g.classList.toggle('off', !vis); g.classList.toggle('dim', vis && ids && !ids.includes(k)); g.classList.toggle('hot', vis && ids && ids.includes(k)); }); };
  groups.forEach((g, k) => {
    const on = () => { focus([k]); show(d.links[k]); };
    g.addEventListener('mouseenter', on); g.addEventListener('focusin', on); g.addEventListener('click', on);
    g.addEventListener('mouseleave', () => focus(null));
  });
  gb.querySelectorAll('.cx-n').forEach(g => {
    const id = g.dataset.n, ks = d.links.map((l, k) => (l.a === id || l.b === id) ? k : -1).filter(k => k >= 0);
    const on = () => { focus(ks); const n = N[idx[id]]; card.innerHTML = `<div class="cx-c-top"><span class="mono note">${ks.length} connection${ks.length === 1 ? '' : 's'}</span></div><h3>${E(n.label)}</h3><ul class="cx-ul">${ks.map(k => `<li>${badge(d.links[k].kind, d.links[k].status)} ${E(d.links[k].title)}</li>`).join('')}</ul>`; };
    g.addEventListener('mouseenter', on); g.addEventListener('focus', on); g.addEventListener('click', on);
    g.addEventListener('mouseleave', () => focus(null));
  });
  document.querySelectorAll('.cx-filters button').forEach(b => b.onclick = () => {
    filter = b.dataset.k; document.querySelectorAll('.cx-filters button').forEach(x => x.setAttribute('aria-pressed', x === b)); focus(null); renderList();
  });
  // full list
  const order = { rumor: 0, whatif: 1, confirmed: 2 }, head = { rumor: 'Community claims · unverified', whatif: 'Our what-ifs', confirmed: 'Confirmed facts they build on' };
  function renderList() {
    const listEl = document.getElementById('cx-list'); if (!listEl) return;
    const by = {}; d.links.forEach(l => { if (filter === 'all' || l.kind === filter) (by[l.kind] = by[l.kind] || []).push(l); });
    listEl.innerHTML = Object.keys(by).sort((a, b) => order[a] - order[b]).map(k => `<h3 class="cx-gh">${head[k]} <span class="note">(${by[k].length})</span></h3>` + by[k].map(l => `<article class="cx-item k-${l.kind}"><div class="cx-c-top">${badge(l.kind, l.status)}<span class="mono note">${E(N[idx[l.a]].label)} ⟷ ${E(N[idx[l.b]].label)}</span></div><h4>${E(l.title)}</h4><p>${E(l.claim)}</p><div class="cx-reality"><b>What's actually known:</b> ${E(l.reality)}</div>${l.status === 'called' || l.status === 'debunked' ? `<div class="cx-resolved ${l.status}">${l.status === 'called' ? '✓ Came true' : '✕ Debunked'}${l.resolved ? ' on ' + E(l.resolved) : ''}${l.resolved_source && LINKS ? ` · <a href="${E(l.resolved_source)}" target="_blank" rel="noopener">Proof ↗</a>` : ''}</div>` : ''}<div class="cx-meta">${E(l.who)} · ${E(l.where)}${l.date ? ' · ' + E(l.date) : ''} · <a href="${E(l.url)}" target="_blank" rel="noopener">Source ↗</a></div></article>`).join('')).join('');
  }
  const sb = document.getElementById('cx-score');
  if (sb) { const R = d.links.filter(l => l.kind === 'rumor'), n = st => R.filter(l => (l.status || 'open') === st).length;
    sb.innerHTML = `<div class="cx-sb"><div class="called"><b>${n('called')}</b><span>Called it ✓</span></div><div class="open"><b>${n('open')}</b><span>Still open</span></div><div class="deb"><b>${n('debunked')}</b><span>Debunked ✕</span></div></div><p class="note">When a rumour comes true it flips to <b style="color:#FFD60A">Called it</b> and its arc turns gold, with the date and proof. So far, none of the community claims has been confirmed.</p>`; }
  renderList(); focus(null);
  // draw-in animation
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) { svg.classList.add('draw'); requestAnimationFrame(() => setTimeout(() => svg.classList.add('in'), 60)); }
})();
