/* #25 Ask LWLG: a chat panel on every page. Uses /api/ask (Claude, answers only from this site's sourced data) on the live site;
   falls back to on-device search of the FAQ, glossary, facts and trackers when that isn't available. */
(function () {
  const E = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const nav = document.querySelector('.site-head nav') || document.querySelector('.site-head'); if (!nav) return;
  const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'nav-top ask-btn'; btn.innerHTML = '<span aria-hidden="true">✦</span> Ask';
  btn.setAttribute('aria-label', 'Ask a question about Lightwave Logic'); btn.setAttribute('aria-expanded', 'false'); nav.appendChild(btn);
  const P = document.createElement('div'); P.className = 'ask-panel'; P.hidden = true; P.setAttribute('role', 'dialog'); P.setAttribute('aria-label', 'Ask LWLG');
  P.innerHTML = `<div class="ask-head"><div><b>Ask LWLG</b><span>Answers come only from this site's sourced data. Not financial advice.</span></div><button type="button" class="ask-x" aria-label="Close">×</button></div>
    <div class="ask-log" aria-live="polite"><div class="ask-msg bot">Hi! Ask me anything about Lightwave Logic: the tech, the numbers, the customers, the rumours.</div>
    <div class="ask-sugs">${['What does Lightwave Logic make?', 'How much cash do they have?', 'What is Stage 3?', 'Who are the customers?', 'Is the Nvidia rumour true?', 'When is volume production?'].map(s => `<button type="button">${E(s)}</button>`).join('')}</div></div>
    <form class="ask-form"><input type="text" maxlength="500" placeholder="Ask a question…" aria-label="Your question" required><button type="submit">Send</button></form>`;
  document.body.appendChild(P);
  const log = P.querySelector('.ask-log'), form = P.querySelector('form'), inp = form.querySelector('input'); const hist = [];
  const open = v => { P.hidden = !v; btn.setAttribute('aria-expanded', v); if (v) setTimeout(() => inp.focus(), 50); };
  btn.onclick = () => open(P.hidden); P.querySelector('.ask-x').onclick = () => { open(false); btn.focus(); };
  addEventListener('keydown', e => { if (e.key === 'Escape' && !P.hidden) { open(false); btn.focus(); } });
  P.querySelectorAll('.ask-sugs button').forEach(b => b.onclick = () => { inp.value = b.textContent; form.requestSubmit(); });
  const add = (cls, html) => { const d = document.createElement('div'); d.className = 'ask-msg ' + cls; d.innerHTML = html; log.appendChild(d); log.scrollTop = log.scrollHeight; return d; };
  // ----- on-device fallback search -----
  let docs = null;
  async function local() {
    if (docs) return docs; const g = f => LW.getJSON('data/' + f).catch(() => null);
    const [faq, gl, facts, hist2, cx, tl] = await Promise.all(['faq.json', 'glossary.json', 'facts.json', 'history.json', 'connections.json', 'timeline.json'].map(g)); docs = [];
    (faq || []).forEach(q => docs.push({ t: q.q, a: q.a, u: q.link || 'faq.html', k: 'FAQ' }));
    (gl || []).forEach(x => docs.push({ t: 'What is ' + x.term + '?', a: x.definition, u: 'glossary.html', k: 'Glossary' }));
    (facts?.facts || []).forEach(f => docs.push({ t: f.label, a: f.value + (f.as_of ? ' (as of ' + f.as_of + ')' : ''), u: f.source || 'start.html', k: 'Fact' }));
    (hist2?.promises || []).forEach(p => docs.push({ t: p.promise, a: `Said ${p.said_on} by ${p.who}. Status: ${p.status}. ${p.outcome || ''}`, u: 'promises.html', k: 'Promise tracker' }));
    (cx?.links || []).forEach(l => docs.push({ t: l.title, a: (l.kind === 'confirmed' ? '' : l.kind === 'whatif' ? 'Hypothetical: ' : 'Unverified: ') + l.claim + ' What is known: ' + l.reality, u: 'connections.html', k: l.kind === 'confirmed' ? 'Confirmed' : 'Unverified connections' }));
    (tl?.milestones || []).forEach(m => docs.push({ t: m.date + ': ' + m.title, a: m.detail || '', u: 'timeline.html', k: 'Timeline' }));
    return docs;
  }
  const tok = s => (String(s).toLowerCase().match(/[a-z0-9]+/g) || []).filter(w => w.length > 2 && !['the', 'and', 'what', 'how', 'does', 'lwlg', 'lightwave', 'logic', 'are', 'about', 'with', 'for', 'they', 'who', 'when', 'is'].includes(w));
  async function localAnswer(q) {
    const D = await local(), qs = new Set(tok(q));
    const top = D.map(d => { let s = 0; tok(d.t).forEach(w => qs.has(w) && (s += 3)); tok(d.a).forEach(w => qs.has(w) && (s += 1)); return [s, d]; }).filter(x => x[0] > 0).sort((a, b) => b[0] - a[0]).slice(0, 3).map(x => x[1]);
    if (!top.length) return `I couldn't find that on the site. Try the <a href="faq.html">FAQ</a> or <a href="start.html">Start here</a>.`;
    return `Here's what the site says:` + top.map(d => `<div class="ask-hit"><span class="ask-k">${E(d.k)}</span><b>${E(d.t)}</b><p>${E(d.a).slice(0, 420)}</p><a href="${E(d.u)}"${/^https?:/.test(d.u) ? ' target="_blank" rel="noopener"' : ''}>Open ${/^https?:/.test(d.u) ? 'source ↗' : 'page ›'}</a></div>`).join('');
  }
  form.addEventListener('submit', async e => {
    e.preventDefault(); const q = inp.value.trim(); if (!q) return; inp.value = '';
    P.querySelector('.ask-sugs')?.remove(); add('me', E(q)); const wait = add('bot typing', '<i></i><i></i><i></i>');
    let html;
    try {
      const r = await fetch('/api/ask', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ q, history: hist }) });
      if (!r.ok) throw r.status; const j = await r.json(); if (!j.answer) throw 0;
      hist.push({ role: 'user', content: q }, { role: 'assistant', content: j.answer });
      const used = new Set((j.answer.match(/\[(\d+)\]/g) || []).map(x => +x.slice(1, -1)));
      const src = (j.sources || []).filter(s => used.has(s.n)).slice(0, 5);
      html = E(j.answer).replace(/\n/g, '<br>').replace(/\[(\d+)\]/g, '<sup>$1</sup>') + (src.length ? `<div class="ask-src">${src.map(s => `<a href="${E(s.url || s.page)}"${s.url ? ' target="_blank" rel="noopener"' : ''}><sup>${s.n}</sup> ${E(s.title).slice(0, 70)}</a>`).join('')}</div>` : '');
    } catch (err) { html = await localAnswer(q); }
    wait.remove(); add('bot', html);
  });
})();
