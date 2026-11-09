/* #5 Earnings-day mode: a site-wide red bar plus a homepage takeover on results day.
   States: pre (day of, before the call) → live (call underway) → out (results posted in data/earnings_live.json).
   Preview any state with ?earnings=pre|live|out */
(async function () {
  const E = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  let facts, L; try { [facts, L] = await Promise.all([LW.getJSON('data/facts.json'), LW.getJSON('data/earnings_live.json')]); } catch (e) { return; }
  const ev = facts.next_event; if (!ev) return;
  const start = +new Date(ev.date), now = Date.now(), force = new URLSearchParams(location.search).get('earnings');
  const etDay = d => new Date(d).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  let state = null;
  if (force && ['pre', 'live', 'out'].includes(force)) state = force;
  else if (L.status === 'out' && now - start < 3 * 864e5) state = 'out';
  else if (etDay(now) === etDay(start) && now < start) state = 'pre';
  else if (now >= start && now < start + 2 * 3600e3) state = 'live';
  if (!state) return;
  const home = !!document.getElementById('k-number');
  const tStr = new Date(start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' }).replace('AM', 'a.m.').replace('PM', 'p.m.');
  const q = E(L.quarter || 'Quarterly');
  // ---- site-wide bar ----
  const bar = document.createElement(home ? 'div' : 'a'); bar.className = 'ed-bar ed-' + state; if (!home) bar.href = 'earnings.html';
  const label = { pre: 'EARNINGS DAY', live: 'LIVE NOW', out: 'RESULTS ARE OUT' }[state];
  const right = { pre: `${q} results &amp; business update · today ${tStr} ET · <span class="ed-cd mono"></span>`, live: `The ${q} call is on${home ? '' : ' · follow along ›'}`, out: `${q} results posted${home ? '' : ' · see the numbers ›'}` }[state];
  bar.innerHTML = `<span class="ed-dot"><i></i>${label}</span><span class="ed-r">${right}</span>`;
  const head = document.querySelector('.site-head'); head.parentNode.insertBefore(bar, head);
  const cd = bar.querySelector('.ed-cd'); const tick = () => { if (!cd) return; const s = Math.max(0, Math.floor((start - Date.now()) / 1000)); cd.textContent = `${Math.floor(s / 3600)}h ${String(Math.floor(s % 3600 / 60)).padStart(2, '0')}m ${String(s % 60).padStart(2, '0')}s`; }; tick(); setInterval(tick, 1000);
  // the "Lights on." pop-up stands down on results day: the takeover does its job
  const pop = document.getElementById('k-pop'); if (pop && state !== 'pre') pop.remove();
  if (!home) return;
  // ---- homepage takeover (sits above the 3D wafer; nothing clickable, per the homepage rule) ----
  const sec = document.createElement('section'); sec.className = 'ed-sec ed-' + state; sec.setAttribute('aria-label', 'Earnings day');
  const R = L.results || {}, v = x => x == null ? '—' : E(x);
  if (state === 'pre') {
    sec.innerHTML = `<div class="wrap center"><div class="ed-k">Today</div><h2 class="ed-h">Results day.</h2><p class="ed-p">${q} numbers and the business update go live at ${tStr} ET.</p>
      <div class="ed-cdbig">${['h', 'm', 's'].map(u => `<div><b data-u="${u}">00</b><span>${{ h: 'hours', m: 'minutes', s: 'seconds' }[u]}</span></div>`).join('')}</div>
      <div class="ed-watch">${(L.watch || []).map(w => `<div><small>What to watch</small><b>${E(w.t)}</b><span>${E(w.d)}</span></div>`).join('')}</div></div>`;
    const u = k => sec.querySelector(`[data-u="${k}"]`); const t2 = () => { const s = Math.max(0, Math.floor((start - Date.now()) / 1000)); u('h').textContent = String(Math.floor(s / 3600)).padStart(2, '0'); u('m').textContent = String(Math.floor(s % 3600 / 60)).padStart(2, '0'); u('s').textContent = String(s % 60).padStart(2, '0'); }; setTimeout(() => { t2(); setInterval(t2, 1000); });
  } else if (state === 'live') {
    const kp = L.key_points || [];
    sec.innerHTML = `<div class="wrap ed-live"><div><div class="ed-pill"><i></i>LIVE · ${tStr} ET</div><h2 class="ed-h">The call is <span class="grad">on.</span></h2><p class="ed-p">Listen on the company's webcast. Key lines appear here as they're confirmed by the press release.</p>
      <div class="ed-wave" aria-hidden="true">${Array.from({ length: 34 }, (_, i) => `<i style="animation-delay:${(i % 7) * .12}s"></i>`).join('')}</div><div class="ed-fine">Audio is on the company's webcast. This page doesn't stream it.</div></div>
      <div class="ed-kp"><div class="ed-kph">Live key points</div>${kp.length ? kp.map(k => `<div class="ed-kpi"><span class="mono">${E(k.time)}</span><div><b>${E(k.title)}</b><p>${E(k.detail || '')}</p></div></div>`).join('') : '<div class="ed-kpi"><span class="mono">…</span><div><b>Waiting for the release</b><p>New points appear here once posted.</p></div></div>'}</div></div>`;
  } else {
    sec.innerHTML = `<div class="wrap center"><div class="ed-k green">Just reported</div><h2 class="ed-h">${q}, <span class="grad">at a glance.</span></h2>
      <div class="ed-nums">${[['Cash + securities', v(R.cash), 'vs ' + E(R.cash_prev) + ' last quarter'], ['Stage 3 programs', v(R.stage3), 'vs ' + E(R.stage3_prev) + ' last quarter'], ['Stage 4 programs', v(R.stage4), 'First one would be historic'], ['Revenue', v(R.revenue), 'vs ' + E(R.revenue_prev) + ' last quarter']].map(([a, b, c]) => `<div><small>${a}</small><b>${b}</b><span>${c}</span></div>`).join('')}</div>
      <div class="ed-score">${(L.scorecard || []).map(s => `<div><span>${E(s.q)}</span><b class="${s.a == null ? 'wait' : /^y/i.test(s.a) ? 'yes' : 'no'}">${s.a == null ? 'Waiting for release' : E(s.a)}</b></div>`).join('')}</div>
      ${R.cash == null ? '<p class="ed-fine">Numbers fill in from the press release.</p>' : ''}</div>`;
  }
  const fly = document.querySelector('section.fly'); fly.parentNode.insertBefore(sec, fly);
})();
