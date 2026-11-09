/* Data widgets: #13 runway clock, #14 ownership map, #15 insider heartbeat, #16 short-interest gauge.
   Drop a <div data-w="runway|owners|heartbeat|short"></div> anywhere; this file fills it from the site's sourced data. */
(async function () {
  const els = [...document.querySelectorAll('[data-w]')]; if (!els.length) return;
  const E = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const num = s => { const m = String(s).replace(/,/g, '').match(/[\d.]+/); return m ? +m[0] : 0; };
  const fmt$ = n => '$' + Math.round(n).toLocaleString('en-US');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let inv, hist;
  try { [inv, hist] = await Promise.all([LW.getJSON('data/investor.json'), LW.getJSON('data/history.json')]); } catch (e) { return; }
  const ns = 'http://www.w3.org/2000/svg';

  // ---------- #13 runway clock ----------
  function runway(el) {
    const q = hist.quarterly[hist.quarterly.length - 1];          // latest reported quarter
    const cash0 = q.cash_and_securities_usd, burnQ = q.operating_cash_used_quarter_usd;
    const t0 = new Date((q.period_end || '2026-06-30') + 'T23:59:59Z').getTime();
    const perMs = burnQ / (91.3 * 864e5);
    el.classList.add('w-card', 'w-runway');
    el.innerHTML = `<div class="w-k">Runway clock</div><div class="w-big mono" aria-live="off"></div><div class="w-sub">estimated cash left today</div>
      <div class="w-row"><div><b class="w-mo"></b><span>months at the current burn</span></div><div><b>Dec 2027+</b><span>company says it's funded through at least</span></div></div>
      <div class="w-bar"><i></i></div>
      <p class="w-fine">Estimate: ${fmt$(cash0)} reported at ${E(q.period_end || 'Jun 30, 2026')} minus the latest quarter's operating cash burn (${fmt$(burnQ)}), ticking every second. Not a company figure; raises or a change in spending move it.</p>`;
    const big = el.querySelector('.w-big'), mo = el.querySelector('.w-mo'), bar = el.querySelector('.w-bar i');
    const tick = () => {
      const left = Math.max(0, cash0 - perMs * (Date.now() - t0));
      big.textContent = fmt$(left); const months = left / (burnQ / 3); mo.textContent = months.toFixed(1);
      bar.style.transform = `scaleX(${Math.min(1, left / cash0).toFixed(4)})`;
    };
    tick(); setInterval(tick, reduce ? 60000 : 1000);
  }

  // ---------- #16 short-interest gauge ----------
  function short(el) {
    const si = inv.short_interest, pct = num(si.pct_float), dtc = num(si.days_to_cover);
    const h = si.history.slice().sort((a, b) => a.date.localeCompare(b.date));
    const last = num(h[h.length - 1].shares_short), prev = num(h[h.length - 2].shares_short), ch = (last / prev - 1) * 100;
    const max = 40, ang = p => Math.PI * (1 - Math.min(p, max) / max);
    const R = 120, cx = 150, cy = 150, pt = (p, r = R) => [cx + r * Math.cos(ang(p)), cy - r * Math.sin(ang(p))];
    const arc = (a, b, c) => { const [x0, y0] = pt(a), [x1, y1] = pt(b); return `<path d="M${x0},${y0} A${R},${R} 0 0 1 ${x1},${y1}" stroke="${c}" stroke-width="18" fill="none" stroke-linecap="butt"/>`; };
    const ticks = [0, 10, 20, 30, 40].map(p => { const [x, y] = pt(p, R + 22); return `<text x="${x}" y="${y + 4}" text-anchor="middle" font-size="11" fill="#8E8E93">${p}%</text>`; }).join('');
    el.classList.add('w-card', 'w-short');
    el.innerHTML = `<div class="w-k">Short-interest gauge</div>
      <svg viewBox="0 0 300 175" role="img" aria-label="${pct}% of the float is sold short">${arc(0, 10, '#30D158')}${arc(10, 20, '#FFD60A')}${arc(20, 30, '#FF9F0A')}${arc(30, 40, '#FF453A')}${ticks}
      <g class="w-needle" style="transform-origin:${cx}px ${cy}px"><line x1="${cx}" y1="${cy}" x2="${cx - R + 14}" y2="${cy}" stroke="#F5F5F7" stroke-width="4" stroke-linecap="round"/><circle cx="${cx}" cy="${cy}" r="9" fill="#F5F5F7"/></g></svg>
      <div class="w-big">${pct.toFixed(1)}%<small> of float sold short</small></div>
      <div class="w-row"><div><b>${dtc.toFixed(1)}</b><span>days to cover</span></div><div><b class="${ch >= 0 ? 'up' : 'down'}">${ch >= 0 ? '▲' : '▼'} ${Math.abs(ch).toFixed(1)}%</b><span>vs prior report</span></div></div>
      <p class="w-fine">${E(si.shares_short)} shares short as of ${E(si.as_of)} (FINRA, twice monthly). High short interest means more people are betting against the stock.</p>`;
    const nd = el.querySelector('.w-needle'), deg = (Math.min(pct, max) / max) * 180;
    if (reduce) nd.style.transform = `rotate(${deg}deg)`;
    else new IntersectionObserver((e, o) => { if (!e[0].isIntersecting) return; o.disconnect(); nd.style.transition = 'transform 1.8s cubic-bezier(.2,1.4,.4,1)'; requestAnimationFrame(() => nd.style.transform = `rotate(${deg}deg)`); }, { threshold: .4 }).observe(el);
  }

  // ---------- #15 insider heartbeat ----------
  function heartbeat(el) {
    const T = inv.insider_trades.map(t => ({ ...t, ts: +new Date(t.date), n: num(t.shares), kind: /sell/i.test(t.type) ? 'sell' : /buy|purchase/i.test(t.type) ? 'buy' : /exercise/i.test(t.type) ? 'ex' : 'grant' })).sort((a, b) => a.ts - b.ts);
    const t0 = T[0].ts - 20 * 864e5, t1 = Date.now(), W = 1000, H = 240, mid = 120;
    const X = ts => 20 + (W - 40) * (ts - t0) / (t1 - t0);
    const amp = t => Math.min(95, 18 + Math.log10(Math.max(t.n, 10)) * 14);
    let d = `M20,${mid}`; T.forEach(t => { const x = X(t.ts), a = amp(t) * (t.kind === 'sell' ? 1 : -1) * (t.kind === 'grant' ? .55 : 1);
      d += ` L${x - 9},${mid} L${x - 5},${mid - a * .25} L${x},${mid + a} L${x + 5},${mid - a * .35} L${x + 9},${mid}`; });
    d += ` L${W - 20},${mid}`;
    const col = { sell: '#FF453A', buy: '#30D158', grant: '#2997FF', ex: '#FFD60A' };
    const dots = T.map((t, i) => { const x = X(t.ts), a = amp(t) * (t.kind === 'sell' ? 1 : -1) * (t.kind === 'grant' ? .55 : 1); return `<circle class="hb-dot" data-i="${i}" cx="${x}" cy="${mid + a}" r="7" fill="${col[t.kind]}" tabindex="0"/>`; }).join('');
    const yrs = []; for (let y = new Date(t0).getFullYear(); y <= new Date(t1).getFullYear(); y++) { const ts = +new Date(y + '-01-01'); if (ts > t0) yrs.push(`<line x1="${X(ts)}" y1="20" x2="${X(ts)}" y2="${H - 20}" stroke="#2C2C2E"/><text x="${X(ts) + 6}" y="${H - 8}" font-size="12" fill="#8E8E93">${y}</text>`); }
    const sells = T.filter(t => t.kind === 'sell').length, buys = T.filter(t => t.kind === 'buy').length;
    el.classList.add('w-card', 'w-heart');
    el.innerHTML = `<div class="w-k">Insider heartbeat</div><div class="w-sub" style="margin:4px 0 8px">Every insider filing as a heartbeat: <span style="color:#FF453A">● sales</span> dip down, <span style="color:#30D158">● buys</span> and <span style="color:#2997FF">● grants</span> jump up, <span style="color:#FFD60A">● option exercises</span> in yellow.</div>
      <div class="hb-wrap"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Insider transactions over time: ${sells} sales, ${buys} open-market buys">
      ${yrs.join('')}<line x1="20" y1="${mid}" x2="${W - 20}" y2="${mid}" stroke="#2C2C2E"/>
      <path d="${d}" fill="none" stroke="#30D158" stroke-width="2.4" stroke-linejoin="round" class="hb-line"/>
      <rect class="hb-scan" x="0" y="0" width="60" height="${H}" fill="url(#hbg)"/><defs><linearGradient id="hbg"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#30D158" stop-opacity=".25"/></linearGradient></defs>
      ${dots}</svg><div class="hb-tip" hidden></div></div>
      <div class="w-row"><div><b>${sells}</b><span>sales in the period</span></div><div><b>${buys}</b><span>open-market buys</span></div></div>
      <p class="w-fine">${E(inv.insider_trades_note || '')}</p>`;
    const tip = el.querySelector('.hb-tip'), wrap = el.querySelector('.hb-wrap');
    el.querySelectorAll('.hb-dot').forEach(c => { const show = () => { const t = T[+c.dataset.i], r = wrap.getBoundingClientRect(), b = c.getBoundingClientRect();
      tip.innerHTML = `<b>${E(t.insider)}</b><div class="note">${E(t.role || '')}</div><div>${E(t.date)} · ${E(t.type)} · ${E(t.shares)}${t.price && t.price !== '$0' ? ' @ ' + E(t.price) : ''}</div>`; tip.hidden = false;
      tip.style.left = Math.min(Math.max(b.left - r.left - 120, 0), r.width - 260) + 'px'; tip.style.top = (b.top - r.top > 120 ? b.top - r.top - 90 : b.top - r.top + 22) + 'px'; };
      c.addEventListener('mouseenter', show); c.addEventListener('focus', show); c.addEventListener('mouseleave', () => tip.hidden = true); c.addEventListener('blur', () => tip.hidden = true); });
  }

  // ---------- #14 ownership map (treemap) ----------
  function owners(el) {
    const so = num(inv.financial_snapshot.shares_outstanding) || 154167255;
    const H = inv.institutions.holders.map(h => ({ name: h.name.replace(/, Inc\.| Corp(oration)?| Group( AG)?| LLP| LLC|Management|International|Advisors|Investment/g, '').replace(/\(all entities\)/, '').trim(), full: h.name, v: num(h.shares) * (/Vanguard/.test(h.name) ? 0 : 1) || 0, src: h.source, note: h.shares, ch: h.change }));
    const vg = inv.institutions.holders.find(h => /Vanguard/.test(h.name)); if (vg) { const m = String(vg.shares).match(/[\d,]{6,}/g) || []; const sum = m.slice(0, 3).reduce((a, b) => a + num(b), 0); const v = H.find(h => /Vanguard/.test(h.full)); if (v) v.v = sum; }
    const instPct = num(inv.institutions.institutional_pct) / 100 || .27, instTotal = so * instPct;
    const top = H.filter(h => h.v > 0), topSum = top.reduce((a, b) => a + b.v, 0);
    const insiders = so * .0221, otherInst = Math.max(0, instTotal - topSum), retail = Math.max(0, so - instTotal - insiders);
    const items = [{ name: 'Retail & everyone else', v: retail, c: '#3A3A3C', k: 'retail' }, { name: 'Other institutions', v: otherInst, c: '#1F3A5F', k: 'inst' }, ...top.map((h, i) => ({ ...h, c: `hsl(${200 + i * 3},${85 - i * 3}%,${56 - i * 2.2}%)`, k: 'top' })), { name: 'Insiders', v: insiders, c: '#BF5AF2', k: 'ins' }].sort((a, b) => b.v - a.v);
    // squarified treemap
    function squarify(items, x, y, w, h) {
      const out = [], total = items.reduce((a, b) => a + b.v, 0), scale = (w * h) / total; let rest = items.map(i => ({ ...i, a: i.v * scale }));
      while (rest.length) {
        const short = Math.min(w, h); let row = [rest[0]], best = worst(row, short);
        for (let i = 1; i < rest.length; i++) { const r2 = row.concat(rest[i]), w2 = worst(r2, short); if (w2 <= best) { row = r2; best = w2; } else break; }
        const s = row.reduce((a, b) => a + b.a, 0), thick = s / short; let off = 0;
        row.forEach(r => { const len = r.a / thick; if (w >= h) out.push({ ...r, x, y: y + off, w: thick, h: len }); else out.push({ ...r, x: x + off, y, w: len, h: thick }); off += len; });
        if (w >= h) { x += thick; w -= thick; } else { y += thick; h -= thick; } rest = rest.slice(row.length);
      }
      return out;
      function worst(row, short) { const s = row.reduce((a, b) => a + b.a, 0), mx = Math.max(...row.map(r => r.a)), mn = Math.min(...row.map(r => r.a)); return Math.max(short * short * mx / (s * s), (s * s) / (short * short * mn)); }
    }
    const R = squarify(items, 0, 0, 1000, 460);
    el.classList.add('w-card', 'w-own');
    el.innerHTML = `<div class="w-k">Ownership map</div><div class="w-sub" style="margin:4px 0 12px">Who owns LWLG's ${Math.round(so / 1e6)}M shares. Box size = number of shares.</div>
      <div class="own-map" role="img" aria-label="Treemap of LWLG ownership: about ${Math.round(instPct * 100)}% institutions, 2% insiders, the rest retail and others.">${R.map(r => { const pc = r.v / so * 100; const big = r.w > 120 && r.h > 54;
        return `<div class="own-cell ${r.k}" style="left:${r.x / 10}%;top:${r.y / 4.6}%;width:${r.w / 10}%;height:${r.h / 4.6}%;background:${r.c}" title="${E(r.full || r.name)}: ${Math.round(r.v).toLocaleString('en-US')} shares (${pc.toFixed(1)}%)">${big ? `<b>${E(r.name)}</b><span>${pc.toFixed(1)}%</span>` : (r.w > 50 && r.h > 30 ? `<span>${pc.toFixed(1)}%</span>` : '')}</div>`; }).join('')}</div>
      <div class="w-row"><div><b>${Math.round(instPct * 100)}%</b><span>institutions</span></div><div><b>2.2%</b><span>insiders</span></div><div><b>${Math.round(retail / so * 100)}%</b><span>retail & others</span></div></div>
      <p class="w-fine">Holder share counts from 13F/13G filings (period ${E(inv.institutions.as_of)}); totals from MarketBeat. Hover a box for exact shares. Estimates, not a full register.</p>`;
  }


  // ---------- #18 sentiment weather ----------
  async function sentiment(el) {
    el.classList.add('w-card', 'w-sent');
    const wx = sc => sc >= .75 ? ['sunny', 'Sunny', 'Mostly bullish chatter'] : sc >= .6 ? ['psunny', 'Mostly sunny', 'Leaning bullish'] : sc >= .45 ? ['cloudy', 'Partly cloudy', 'Mixed feelings'] : sc >= .3 ? ['rain', 'Showers', 'Leaning bearish'] : ['storm', 'Stormy', 'Mostly bearish chatter'];
    const icon = k => `<svg viewBox="0 0 120 90" class="wx wx-${k}" aria-hidden="true">${/sunny|psunny/.test(k) ? '<g class="wx-sun"><circle cx="' + (k === 'sunny' ? 60 : 46) + '" cy="40" r="20" fill="#FFD60A"/>' + [0, 45, 90, 135, 180, 225, 270, 315].map(a => `<line x1="${(k === 'sunny' ? 60 : 46) + Math.cos(a * Math.PI / 180) * 27}" y1="${40 + Math.sin(a * Math.PI / 180) * 27}" x2="${(k === 'sunny' ? 60 : 46) + Math.cos(a * Math.PI / 180) * 35}" y2="${40 + Math.sin(a * Math.PI / 180) * 35}" stroke="#FFD60A" stroke-width="4" stroke-linecap="round"/>`).join('') + '</g>' : ''}${k !== 'sunny' ? `<path d="M30 70 h56 a16 16 0 0 0 -4 -31 a22 22 0 0 0 -42 6 a13 13 0 0 0 -10 25z" fill="${k === 'storm' ? '#48484A' : k === 'rain' ? '#636366' : '#D1D1D6'}"/>` : ''}${k === 'rain' ? '<g class="wx-rain" stroke="#64D2FF" stroke-width="3" stroke-linecap="round"><line x1="44" y1="76" x2="40" y2="86"/><line x1="58" y1="76" x2="54" y2="86"/><line x1="72" y1="76" x2="68" y2="86"/></g>' : ''}${k === 'storm' ? '<path class="wx-bolt" d="M60 70 l-8 12 h8 l-4 10 l14 -16 h-8 l4 -6z" fill="#FFD60A"/>' : ''}</svg>`;
    let d = null; try { const r = await fetch('/api/sentiment'); if (r.ok) d = await r.json(); if (d && d.error) d = null; } catch (e) { }
    if (!d) { el.innerHTML = `<div class="w-k">Sentiment weather</div>${icon('psunny')}<div class="w-big">Forecast loading</div><div class="w-sub">Today's mood from Stocktwits posts that authors tag Bullish or Bearish.</div><p class="w-fine">Live on LWLGstock.com: updated hourly. Not shown in this preview.</p>`; return; }
    const [k, label, sub] = wx(d.score), pct = Math.round(d.score * 100);
    const strip = (d.history || []).map(h => `<div class="wx-day"><span>${new Date(h.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' })}</span>${icon(wx(h.score)[0])}<b>${Math.round(h.score * 100)}%</b></div>`).join('');
    el.innerHTML = `<div class="w-k">Sentiment weather</div>${icon(k)}<div class="w-big">${label}</div><div class="w-sub">${sub} · ${pct}% bullish of ${d.bull + d.bear} tagged posts</div>${strip ? `<div class="wx-strip">${strip}</div>` : ''}<p class="w-fine">From the latest ${d.sampled} public $LWLG posts on Stocktwits that authors tagged Bullish or Bearish. A mood reading, not a forecast of the price.</p>`;
  }

  const F = { runway, short, heartbeat, owners, sentiment };
  els.forEach(el => { try { F[el.dataset.w] && F[el.dataset.w](el); } catch (e) { console.warn('widget', el.dataset.w, e); } });
})();
