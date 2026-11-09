/* LWLG Investor Index — shared behaviour. Independent site, not affiliated with Lightwave Logic, Inc. */
(function () {
  'use strict';

  // ---------- data loading: live API (Netlify functions) first, bundled snapshot as fallback ----------
  const cache = {};
  async function getJSON(url) {
    if (cache[url]) return cache[url];
    const p = fetch(url, { headers: { 'Accept': 'application/json' } }).then(r => {
      if (!r.ok) throw new Error(url + ' ' + r.status);
      return r.json();
    });
    cache[url] = p;
    return p;
  }
  async function liveOrSnapshot(apiUrl, snapshotUrl) {
    try {
      const d = await getJSON(apiUrl);
      return { data: d, live: true };
    } catch (e) {
      const d = await getJSON(snapshotUrl);
      return { data: d, live: false };
    }
  }

  // ---------- helpers ----------
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtDate = d => {
    if (!d) return '';
    const parts = String(d).split('-');
    const m = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    if (parts.length === 1) return parts[0];
    if (parts.length === 2) return m[+parts[1] - 1] + ' ' + parts[0];
    return m[+parts[1] - 1] + ' ' + (+parts[2]) + ', ' + parts[0];
  };
  const srcLink = (u, label) => u ? `<a class="src" href="${esc(u)}" target="_blank" rel="noopener">${esc(label || 'Source ↗')}</a>` : '';

  function countdown(el) {
    const t = new Date(el.dataset.countdown).getTime();
    if (isNaN(t)) { el.textContent = 'Date TBA'; return; }
    function tick() {
      const ms = t - Date.now();
      if (ms <= 0) { el.textContent = 'Passed'; return; }
      const d = Math.floor(ms / 864e5), h = Math.floor(ms % 864e5 / 36e5), m = Math.floor(ms % 36e5 / 6e4);
      el.textContent = `${d}d ${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m`;
    }
    tick(); setInterval(tick, 30000);
  }

  // ---------- mobile nav ----------
  function initNav() {
    const b = document.querySelector('.nav-toggle'), n = document.querySelector('.nav');
    if (b && n) b.addEventListener('click', () => { const o = n.classList.toggle('open'); b.setAttribute('aria-expanded', o); });
    document.querySelectorAll('.nav-group > button').forEach(btn => btn.addEventListener('click', () => {
      const g = btn.parentElement, o = !g.classList.contains('open');
      document.querySelectorAll('.nav-group.open').forEach(x => { if (x !== g) { x.classList.remove('open'); x.firstElementChild.setAttribute('aria-expanded', 'false'); } });
      g.classList.toggle('open', o); btn.setAttribute('aria-expanded', o);
    }));
    document.addEventListener('click', e => { if (!e.target.closest('.nav-group')) document.querySelectorAll('.nav-group.open').forEach(x => { x.classList.remove('open'); x.firstElementChild.setAttribute('aria-expanded', 'false'); }); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') document.querySelectorAll('.nav-group.open').forEach(x => { x.classList.remove('open'); x.firstElementChild.setAttribute('aria-expanded', 'false'); x.firstElementChild.focus(); }); });
  }

  // ---------- at-a-glance strip + fact cards (one data file: data/facts.json) ----------
  async function initGlance() {
    let f; try { f = await getJSON('data/facts.json'); } catch (e) { return; }
    const pick = l => (f.facts.find(x => x.label === l) || {}).value || '';
    const g = document.getElementById('glance');
    if (g) {
      const ev = f.next_event;
      g.innerHTML = `<div class="glance-in"><span class="gk">LWLG at a glance</span>` +
        [['Cash', 'Cash + securities'], ['Shares', 'Shares outstanding'], ['Stage 3', 'Programs in Stage 3'], ['Stage 4', 'Programs in Stage 4'], ['Patents', 'Patents'], ['Volume target', 'Volume production target']]
          .map(([s, l]) => `<span>${s}<b>${esc(pick(l).replace(' granted · 80+ pending', ''))}</b></span>`).join('') +
        `<a class="gnext" href="${esc(ev.link)}">${esc(ev.label.split('&')[0].trim())} <b data-countdown="${esc(ev.date)}"></b></a></div>`;
      g.querySelectorAll('[data-countdown]').forEach(countdown);
    }
    document.querySelectorAll('[data-factcard]').forEach(el => {
      el.innerHTML = '<dl class="factcard">' + f.facts.map(x => `<div><dt>${esc(x.label)}</dt><dd>${esc(x.value)}</dd>${x.as_of || x.source ? `<small>${x.as_of ? 'As of ' + esc(x.as_of) : ''}${x.source ? ` · <a class="src" href="${esc(x.source)}"${/^http/.test(x.source) ? ' target="_blank" rel="noopener"' : ''}>source</a>` : ''}</small>` : ''}</div>`).join('') + '</dl>' +
        `<p class="note" style="margin-top:10px">Last checked ${esc(fmtDate(f.updated))}. ${esc(f.note)}</p>`;
    });
  }

  // ---------- glossary: auto-mark first use of each term in main content ----------
  async function initGlossary() {
    let terms;
    try { terms = await getJSON('data/glossary.json'); } catch (e) { return; }
    if (!Array.isArray(terms) || !terms.length) return;
    const tip = document.createElement('div');
    tip.className = 'gl-tip'; tip.setAttribute('role', 'tooltip'); tip.id = 'gl-tip';
    document.body.appendChild(tip);
    const map = new Map();
    terms.forEach(t => (t.keys || [t.term]).forEach(k => map.set(k.toLowerCase(), t)));
    const sorted = [...map.keys()].sort((a, b) => b.length - a.length);
    const re = new RegExp('(?<![\\w-])(' + sorted.map(s => s.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&')).join('|') + ')s?(?![\\w-])', 'i');
    const used = new Set();
    const root = document.querySelector('main');
    if (!root || document.body.dataset.noGlossary) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        const p = n.parentElement;
        if (!p || p.closest('a,button,h1,.mega,script,style,.gl,input,textarea,select,svg,.no-gl,th,label')) return NodeFilter.FILTER_REJECT;
        return re.test(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
      }
    });
    const nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(node => {
      const m = node.nodeValue.match(re);
      if (!m) return;
      const key = m[1].toLowerCase();
      if (!map.has(key)) return;
      const tkey = map.get(key).term;
      if (used.has(tkey)) return;
      used.add(tkey);
      const span = document.createElement('span');
      span.className = 'gl'; span.tabIndex = 0; span.dataset.term = key; span.textContent = m[1];
      span.setAttribute('aria-describedby', 'gl-tip');
      const after = node.splitText(m.index);
      after.nodeValue = after.nodeValue.slice(m[1].length);
      node.parentNode.insertBefore(span, after);
    });
    function show(e) {
      const t = map.get(e.currentTarget.dataset.term); if (!t) return;
      tip.innerHTML = `<b>${esc(t.term)}</b>${esc(t.definition)}`;
      const r = e.currentTarget.getBoundingClientRect();
      tip.classList.add('on');
      const w = tip.offsetWidth;
      tip.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.left)) + 'px';
      tip.style.top = (r.bottom + 8 + tip.offsetHeight > innerHeight ? r.top - tip.offsetHeight - 8 : r.bottom + 8) + 'px';
    }
    const hide = () => tip.classList.remove('on');
    document.querySelectorAll('.gl').forEach(s => {
      s.addEventListener('mouseenter', show); s.addEventListener('focus', show);
      s.addEventListener('mouseleave', hide); s.addEventListener('blur', hide);
    });
  }

  // ---------- alerts signup (Netlify Forms; falls back to a message) ----------
  function initAlerts() {
    document.querySelectorAll('form[data-alerts]').forEach(f => {
      f.addEventListener('submit', async e => {
        e.preventDefault();
        const out = f.querySelector('[data-out]');
        const body = new URLSearchParams(new FormData(f)).toString();
        try {
          const r = await fetch('/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
          if (!r.ok) throw new Error(r.status);
          out.textContent = f.dataset.ok || 'You’re on the list. We’ll alert you on new filings and press releases.';
          f.reset();
        } catch (err) {
          out.textContent = 'Sign-ups open when the site is live at LWLGstock.com.';
        }
      });
    });
  }

  // ---------- TradingView embeds ----------
  function tv(el, widget, config) {
    if (!el) return;
    const host = document.createElement('div');
    host.className = 'tradingview-widget-container';
    host.innerHTML = '<div class="tradingview-widget-container__widget"></div>';
    const s = document.createElement('script');
    s.src = `https://s3.tradingview.com/external-embedding/embed-widget-${widget}.js`;
    s.async = true;
    s.textContent = JSON.stringify(config);
    host.appendChild(s);
    el.appendChild(host);
  }
  function initTradingView() {
    document.querySelectorAll('[data-tv]').forEach(el => {
      const kind = el.dataset.tv;
      const base = { colorTheme: 'dark', isTransparent: true, locale: 'en' };
      if (kind === 'chart') tv(el, 'advanced-chart', { ...base, symbol: 'NASDAQ:LWLG', interval: 'D', autosize: true, timezone: 'America/New_York', style: '1', hide_side_toolbar: false, allow_symbol_change: false, support_host: 'https://www.tradingview.com' });
      if (kind === 'quote') tv(el, 'single-quote', { ...base, symbol: 'NASDAQ:LWLG', width: '100%' });
      if (kind === 'overview') tv(el, 'symbol-overview', { ...base, symbols: [['Lightwave Logic', 'NASDAQ:LWLG|1D']], chartOnly: false, width: '100%', height: '100%', autosize: true, chartType: 'area', lineColor: '#8B6CFF', topColor: 'rgba(139,108,255,.35)', bottomColor: 'rgba(62,224,255,0)' });
      if (kind === 'financials') tv(el, 'financials', { ...base, symbol: 'NASDAQ:LWLG', displayMode: 'regular', width: '100%', height: '100%' });
      if (kind === 'tape') tv(el, 'ticker-tape', { ...base, symbols: [{ proName: 'NASDAQ:LWLG', title: 'LWLG' }, { proName: 'NASDAQ:NVDA', title: 'NVDA' }, { proName: 'NASDAQ:COHR', title: 'COHR' }, { proName: 'NASDAQ:LITE', title: 'LITE' }, { proName: 'NASDAQ:AVGO', title: 'AVGO' }, { proName: 'NASDAQ:GFS', title: 'GFS' }, { proName: 'NASDAQ:POET', title: 'POET' }], displayMode: 'compact' });
    });
  }

  // ---------- reveal on scroll (also picks up content rendered later) ----------
  let io = null;
  function reveal() {
    const els = document.querySelectorAll('[data-reveal]:not(.in):not([data-ro])');
    if (!('IntersectionObserver' in window)) { els.forEach(e => e.classList.add('in')); return; }
    io = io || new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } }), { threshold: .1, rootMargin: '0px 0px -5% 0px' });
    els.forEach((e, i) => { e.dataset.ro = 1; e.style.transitionDelay = (Math.min(i % 6, 5) * 70) + 'ms'; io.observe(e); });
  }
  // cursor-follow glow on cards
  document.addEventListener('pointermove', e => {
    const c = e.target.closest && e.target.closest('.glowcard'); if (!c) return;
    const r = c.getBoundingClientRect(); c.style.setProperty('--mx', (e.clientX - r.left) + 'px'); c.style.setProperty('--my', (e.clientY - r.top) + 'px');
  }, { passive: true });

  window.LW = { getJSON, liveOrSnapshot, esc, fmtDate, srcLink, countdown, reveal };

  function headerHeight() {
    const h = document.querySelector('.site-head');
    if (h) document.documentElement.style.setProperty('--hh', h.offsetHeight + 'px');
  }
  addEventListener('resize', headerHeight);

  document.addEventListener('DOMContentLoaded', () => {
    headerHeight(); setTimeout(headerHeight, 1500);
    initNav(); initGlance(); initAlerts(); initTradingView(); reveal(); let rq = 0; new MutationObserver(() => { if (!rq) rq = requestAnimationFrame(() => { rq = 0; reveal(); }); }).observe(document.body, { childList: true, subtree: true });
    document.querySelectorAll('[data-countdown]').forEach(countdown);
    // glossary runs after page scripts render content
    setTimeout(initGlossary, 1500);
  });
})();
