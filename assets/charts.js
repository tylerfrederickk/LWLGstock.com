/* Small, dependency-free SVG charts: one series per chart, single hue, hover tooltips, table fallback. */
(function () {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function niceMax(v) { if (v <= 0) return 1; const p = Math.pow(10, Math.floor(Math.log10(v))); const n = v / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p; }

  function chart(el, pts, opt = {}) {
    const W = 760, H = 300, L = 64, R = 16, T = 18, B = 40;
    const kind = opt.kind || 'line', color = opt.color || '#8B6CFF', fmt = opt.fmt || (v => v.toLocaleString());
    const vals = pts.map(p => p.y).filter(v => v != null);
    const min = opt.zero === false ? Math.min(...vals) * 0.9 : 0, max = niceMax(Math.max(...vals) * 1.05);
    const iw = W - L - R, ih = H - T - B, n = pts.length;
    const x = i => L + (kind === 'bar' ? (i + 0.5) * iw / n : (n === 1 ? iw / 2 : i * iw / (n - 1)));
    const y = v => T + ih - (v - min) / (max - min) * ih;
    let g = '';
    for (let k = 0; k <= 4; k++) { const v = min + (max - min) * k / 4, yy = y(v); g += `<line x1="${L}" x2="${W - R}" y1="${yy}" y2="${yy}" stroke="rgba(255,255,255,${k ? .07 : .22})"/><text x="${L - 10}" y="${yy + 4}" text-anchor="end" font-size="11" fill="#7C88A3">${esc(fmt(v, true))}</text>`; }
    const step = Math.ceil(n / 8);
    pts.forEach((p, i) => { if (i % step === 0 || i === n - 1) g += `<text x="${x(i)}" y="${H - 14}" text-anchor="middle" font-size="11" fill="#7C88A3">${esc(p.x)}</text>`; });
    if (kind === 'bar') {
      const bw = Math.max(4, iw / n - 6);
      pts.forEach((p, i) => { if (p.y == null) return; const top = y(p.y), h = y(min) - top; g += `<path d="M${x(i) - bw / 2},${y(min)} V${top + 4} q0,-4 4,-4 h${bw - 8} q4,0 4,4 V${y(min)} Z" fill="${p.color || color}" opacity="${p.dim ? .45 : 1}"/>`; });
    } else {
      const d = pts.map((p, i) => p.y == null ? '' : `${i && pts[i - 1].y != null ? 'L' : 'M'}${x(i)},${y(p.y)}`).join(' ');
      g += `<path d="${d} L${x(n - 1)},${y(min)} L${x(0)},${y(min)} Z" fill="${color}" opacity=".12"/><path d="${d}" fill="none" stroke="${color}" stroke-width="2.25" stroke-linejoin="round"/>`;
      const last = n - 1; g += `<circle cx="${x(last)}" cy="${y(pts[last].y)}" r="4.5" fill="${color}" stroke="#0C1120" stroke-width="2"/>`;
    }
    g += `<line class="xh" x1="0" x2="0" y1="${T}" y2="${T + ih}" stroke="rgba(255,255,255,.35)" stroke-dasharray="3 3" opacity="0"/><circle class="xd" r="5" fill="${color}" stroke="#fff" stroke-width="2" opacity="0"/>`;
    el.classList.add('chartbox');
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opt.label || 'Chart')}" style="width:100%;height:auto;display:block;font-family:'JetBrains Mono',monospace">${g}<rect class="hit" x="${L}" y="${T}" width="${iw}" height="${ih}" fill="transparent"/></svg><div class="ctip" hidden></div>
      <details class="ctable"><summary>View as table</summary><div class="tablebox"><table><thead><tr><th scope="col">Period</th><th scope="col">${esc(opt.label || 'Value')}</th></tr></thead><tbody>${pts.map(p => `<tr><td>${esc(p.x)}</td><td>${p.y == null ? '—' : esc(fmt(p.y))}</td></tr>`).join('')}</tbody></table></div></details>`;
    const svg = el.querySelector('svg'), tip = el.querySelector('.ctip'), xh = svg.querySelector('.xh'), xd = svg.querySelector('.xd');
    const move = e => {
      const r = svg.getBoundingClientRect(), sx = (e.clientX - r.left) / r.width * W;
      let i = kind === 'bar' ? Math.floor((sx - L) / (iw / n)) : Math.round((sx - L) / (iw / Math.max(1, n - 1)));
      i = Math.max(0, Math.min(n - 1, i)); const p = pts[i]; if (p.y == null) return;
      xh.setAttribute('x1', x(i)); xh.setAttribute('x2', x(i)); xh.setAttribute('opacity', 1);
      xd.setAttribute('cx', x(i)); xd.setAttribute('cy', y(p.y)); xd.setAttribute('opacity', kind === 'bar' ? 0 : 1);
      tip.hidden = false; tip.innerHTML = `<b>${esc(fmt(p.y))}</b><span>${esc(p.x)}${p.note ? ' · ' + esc(p.note) : ''}</span>`;
      const px = x(i) / W * r.width; tip.style.left = Math.min(Math.max(px, 70), r.width - 70) + 'px'; tip.style.top = (y(p.y) / H * r.height - 12) + 'px';
    };
    svg.addEventListener('pointermove', move); svg.addEventListener('pointerleave', () => { tip.hidden = true; xh.setAttribute('opacity', 0); xd.setAttribute('opacity', 0); });
  }
  window.LWChart = chart;
})();
