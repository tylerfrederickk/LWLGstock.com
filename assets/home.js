/* Homepage data blocks. */
(async function () {
  const E = LW.esc, $ = id => document.getElementById(id);
  const stat = (n, l, accent) => `<div class="stat card glowcard" data-reveal><div class="n${accent ? ' grad' : ''}">${n}</div><div class="l">${l}</div></div>`;
  try {
    const inv = await LW.getJSON('data/investor.json');
    $('snapshot').innerHTML = stat('$95.9M', 'Cash + securities, Jun 30, 2026') + stat('5', 'Fortune Global 500 programs in Stage 3', 1) + stat('67', 'Patents granted worldwide') + stat('2H 2027', 'Volume production target', 1);
    const ev = inv.upcoming_events.slice(0, 4);
    $('next-events').innerHTML = ev.map((e, i) => {
      const iso = /^\d{4}-\d{2}-\d{2}$/.test(e.date.trim());
      return `<div class="row-item"><div><div class="mono note">${E(iso ? LW.fmtDate(e.date) : 'Est. ' + LW.fmtDate(e.date.replace(/\s*\(.*\)/, '')))}</div><b>${E(e.event.split('(')[0].replace(/,\s*$/, ''))}</b></div><div class="mono cd ${i === 0 ? 'hot' : ''}" ${iso ? `data-countdown="${e.date}T16:30:00-05:00"` : ''}>${iso ? '' : 'TBA'}</div></div>`;
    }).join('');
    document.querySelectorAll('#next-events [data-countdown]').forEach(LW.countdown);
  } catch (e) { }
  try {
    const ind = await LW.getJSON('data/industry.json');
    $('whynow').innerHTML = ind.why_now.slice(0, 7).map((w, i) => `<div class="why-item" data-reveal><span class="why-n mono">${String(i + 1).padStart(2, '0')}</span><div><h3>${E(w.stat)}</h3><p>${E(w.detail)}</p>${LW.srcLink(w.source, (w.date || 'Source') + ' ↗')}</div></div>`).join('');
  } catch (e) { }
  try {
    const r = await LW.liveOrSnapshot('/api/filings', 'data/filings.json');
    $('latest-filings').innerHTML = r.data.filings.slice(0, 5).map(f => `<a class="row-item" href="${E(f.url)}" target="_blank" rel="noopener"><div><div class="mono note">${E(f.date)}</div><b>${E(f.name)}</b></div><span class="tag ${/^(8-K|10-K|10-Q)$/.test(f.form) ? 'fill' : ''}">${E(f.form)}</span></a>`).join('') + `<p class="note" style="margin-top:12px">${r.live ? 'Live from SEC EDGAR.' : 'Snapshot — updates automatically on the live site.'}</p>`;
  } catch (e) { }
  LW.reveal && LW.reveal();
})();
