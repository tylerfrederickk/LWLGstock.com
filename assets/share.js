/* #27 Shareable stat cards: adds a Share button to key numbers (not on the homepage's main scroll).
   Makes a 1080×1080 image and opens the phone's share sheet, or downloads it on desktop. */
(function () {
  const home = /(^\/$|index\.html$)/.test(location.pathname);
  const collect = () => { const targets = [];
  document.querySelectorAll('.chart-card').forEach(c => targets.push({ el: c, k: () => c.querySelector('h3')?.textContent, v: () => c.querySelector('.big')?.textContent, s: () => c.querySelector('.delta')?.textContent }));
  if (!home) document.querySelectorAll('.w-card').forEach(c => targets.push({ el: c, k: () => c.querySelector('.w-k')?.textContent, v: () => c.querySelector('.w-big')?.childNodes[0]?.textContent, s: () => c.querySelector('.w-sub')?.textContent }));
  document.querySelectorAll('[data-share]').forEach(c => targets.push({ el: c, k: () => c.dataset.shareK, v: () => c.dataset.shareV || c.querySelector('[data-share-v]')?.textContent, s: () => c.dataset.shareS }));
  return targets; };
  const later = () => collect().forEach(t => {
    if (t.el.querySelector('.sh-btn')) return;
    const b = document.createElement('button'); b.type = 'button'; b.className = 'sh-btn'; b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg><span>Share</span>';
    b.setAttribute('aria-label', 'Share this number as an image'); if (getComputedStyle(t.el).position === 'static') t.el.style.position = 'relative';
    b.onclick = () => make((t.k() || '').trim(), (t.v() || '').trim(), (t.s() || '').trim()); t.el.appendChild(b);
  });
  [1200, 3000, 6000].forEach(ms => setTimeout(later, ms));
  async function make(k, v, s) {
    await document.fonts.ready;
    const c = document.createElement('canvas'); c.width = c.height = 1080; const g = c.getContext('2d');
    g.fillStyle = '#000'; g.fillRect(0, 0, 1080, 1080);
    const rg = g.createRadialGradient(780, 260, 40, 780, 260, 760); rg.addColorStop(0, 'rgba(191,90,242,.45)'); rg.addColorStop(.5, 'rgba(41,151,255,.18)'); rg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = rg; g.fillRect(0, 0, 1080, 1080);
    const lg = g.createLinearGradient(80, 0, 1000, 0); lg.addColorStop(0, '#2997FF'); lg.addColorStop(.55, '#BF5AF2'); lg.addColorStop(1, '#FF375F');
    g.fillStyle = lg; g.fillRect(80, 92, 70, 8);
    g.fillStyle = '#F5F5F7'; g.font = '700 44px Inter, system-ui, sans-serif'; g.fillText('LWLG', 80, 170); const lw = g.measureText('LWLG').width; g.fillStyle = '#86868B'; g.font = '500 30px Inter, system-ui, sans-serif'; g.fillText('Lightwave Logic · NASDAQ', 80 + lw + 22, 168);
    g.fillStyle = '#BF5AF2'; g.font = '600 40px Inter, system-ui, sans-serif'; wrap(g, k, 80, 400, 920, 50, 2);
    let size = 200; g.font = `800 ${size}px Inter, system-ui, sans-serif`; while (g.measureText(v).width > 920 && size > 70) { size -= 8; g.font = `800 ${size}px Inter, system-ui, sans-serif`; }
    g.fillStyle = lg; g.fillText(v, 76, 420 + size * .95);
    g.fillStyle = '#A1A1A6'; g.font = '500 34px Inter, system-ui, sans-serif'; wrap(g, s, 80, 520 + size, 920, 46, 4);
    g.fillStyle = '#6E6E73'; g.font = '500 26px Inter, system-ui, sans-serif'; g.fillText('LWLGstock.com · independent, not affiliated · not advice', 80, 1000);
    const blob = await new Promise(r => c.toBlob(r, 'image/png')), file = new File([blob], 'lwlg-' + (k || 'stat').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40) + '.png', { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], title: k, text: `${k}: ${v} · LWLGstock.com` }); return; } catch (e) { if (e.name === 'AbortError') return; } }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = file.name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  function wrap(g, t, x, y, w, lh, max) { const words = String(t || '').split(/\s+/); let line = '', n = 0; for (const wd of words) { const tst = line ? line + ' ' + wd : wd; if (g.measureText(tst).width > w && line) { g.fillText(line, x, y); y += lh; line = wd; if (++n >= max - 1) { break; } } else line = tst; } if (line) g.fillText(line, x, y); }
  window.LWShare = make;
})();
