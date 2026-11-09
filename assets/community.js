/* Community: #22 Bull vs Bear poll, #21 "I was here" wall, #19 prediction board. Shared via /api/community on the live site;
   in a static preview it falls back to this device only and says so. */
(async function () {
  const E = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const els = { poll: document.querySelectorAll('[data-c="poll"]'), wall: document.querySelectorAll('[data-c="wall"]'), predict: document.querySelectorAll('[data-c="predict"]') };
  if (!els.poll.length && !els.wall.length && !els.predict.length) return;
  const LS = { get: (k, d) => { try { return JSON.parse(localStorage.getItem('lwlg-' + k)) ?? d; } catch { return d; } }, set: (k, v) => { try { localStorage.setItem('lwlg-' + k, JSON.stringify(v)); } catch { } } };
  let live = true, state = { poll: { bull: 0, bear: 0 }, pins: [], predictions: {} };
  try { const r = await fetch('/api/community', { cache: 'no-store' }); if (!r.ok) throw 0; state = await r.json(); } catch { live = false; }
  const post = async body => { if (!live) return { ok: true, local: true }; const r = await fetch('/api/community', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); const j = await r.json().catch(() => ({})); return r.ok ? j : { ok: false, ...j }; };
  const today = new Date().toISOString().slice(0, 10);
  const localNote = '<p class="c-local">Preview mode: your answer is saved on this device. Shared results from everyone go live on LWLGstock.com.</p>';

  // ---------- #22 poll ----------
  els.poll.forEach(el => {
    const voted = LS.get('vote-' + today, null);
    const draw = (p, mine) => {
      const t = p.bull + p.bear, pb = t ? Math.round(p.bull / t * 100) : 0;
      el.innerHTML = `<div class="c-k">Today's poll</div><h3 class="c-h">Bull or bear on LWLG today?</h3>
        ${mine ? `<div class="c-res"><div class="c-bar"><i style="width:${t ? pb : 50}%"></i></div><div class="c-row"><span class="bull">🐂 Bull ${t ? pb + '%' : ''}</span><span class="bear">${t ? (100 - pb) + '%' : ''} Bear 🐻</span></div><div class="c-note">${t ? t.toLocaleString('en-US') + ' vote' + (t === 1 ? '' : 's') + ' today' : ''} · You voted ${mine === 'bull' ? 'bull' : 'bear'}. New poll every day.</div></div>`
        : `<div class="c-btns"><button type="button" class="c-vote bull" data-s="bull">🐂 Bull</button><button type="button" class="c-vote bear" data-s="bear">🐻 Bear</button></div><div class="c-note">One vote per person per day. Just for fun, not advice.</div>`}
        ${live ? '' : localNote}`;
      el.querySelectorAll('.c-vote').forEach(b => b.onclick = async () => {
        const s = b.dataset.s; el.querySelectorAll('.c-vote').forEach(x => x.disabled = true);
        const r = await post({ action: 'vote', side: s });
        if (r.ok || r.error === 'already') { LS.set('vote-' + today, s); const p = r.poll || (live ? state.poll : { bull: s === 'bull' ? 1 : 0, bear: s === 'bear' ? 1 : 0 }); draw(p, s); }
        else { el.querySelectorAll('.c-vote').forEach(x => x.disabled = false); }
      });
    };
    draw(live ? state.poll : (voted ? { bull: voted === 'bull' ? 1 : 0, bear: voted === 'bear' ? 1 : 0 } : { bull: 0, bear: 0 }), voted);
  });

  // ---------- #21 I was here ----------
  if (els.wall.length) {
    let dots; try { dots = await (await fetch('data/worlddots.json')).json(); } catch { dots = { pts: [], step: 2.4 }; }
    const W = 1000, H = 470, X = lon => (lon + 180) / 360 * W, Y = lat => (85 - lat) / 145 * H;
    const base = dots.pts.map(([lo, la]) => `<circle cx="${X(lo).toFixed(1)}" cy="${Y(la).toFixed(1)}" r="2.6"/>`).join('');
    const yc = y => `hsl(${(2026 - y) * 18 % 360 + 200},90%,62%)`;
    els.wall.forEach(el => {
      const mine = LS.get('pin', null);
      let pins = live ? state.pins.slice() : (mine ? [mine] : []);
      const yrs = []; for (let y = new Date().getFullYear(); y >= 2005; y--) yrs.push(y);
      el.innerHTML = `<div class="c-k">I was here</div><h3 class="c-h">Where in the world are LWLG investors?</h3>
        <p class="c-note">Tap roughly where you are, pick the year you first bought, and add your light. Location is rounded to about 50 km and nothing else is stored.</p>
        <div class="c-map"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="World map of investor pins"><g class="c-land">${base}</g><g class="c-pins"></g><g class="c-new"></g></svg></div>
        <div class="c-form" hidden><label>First bought in <select>${yrs.map(y => `<option>${y}</option>`).join('')}</select></label><button type="button" class="c-add">Add my light</button><button type="button" class="c-cancel">Cancel</button></div>
        <div class="c-row c-stats"><span class="c-count"></span><span class="c-legend">Colour = year first bought</span></div>${live ? '' : localNote}`;
      const g = el.querySelector('.c-pins'), gn = el.querySelector('.c-new'), form = el.querySelector('.c-form'), svg = el.querySelector('svg'), cnt = el.querySelector('.c-count');
      const drawPins = () => { g.innerHTML = pins.map(([lo, la, y]) => `<circle cx="${X(lo)}" cy="${Y(la)}" r="5" fill="${yc(y)}"><title>Since ${y}</title></circle>`).join(''); cnt.textContent = `${pins.length.toLocaleString('en-US')} investor${pins.length === 1 ? '' : 's'} on the map`; };
      drawPins();
      let pick = null;
      if (mine) { form.hidden = true; } 
      svg.addEventListener('click', e => {
        if (LS.get('pin', null)) return;
        const r = svg.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * W, y = (e.clientY - r.top) / r.height * H;
        pick = [x / W * 360 - 180, 85 - y / H * 145]; gn.innerHTML = `<circle cx="${x}" cy="${y}" r="9" class="c-pick"/>`; form.hidden = false;
      });
      el.querySelector('.c-cancel').onclick = () => { pick = null; gn.innerHTML = ''; form.hidden = true; };
      el.querySelector('.c-add').onclick = async () => {
        if (!pick) return; const year = +el.querySelector('select').value;
        const r = await post({ action: 'pin', lon: pick[0], lat: pick[1], year });
        if (r.ok || r.error === 'already') { const p = [Math.round(pick[0] * 2) / 2, Math.round(pick[1] * 2) / 2, year]; LS.set('pin', p); pins.push(p); drawPins(); gn.innerHTML = ''; form.hidden = true; el.querySelector('.c-note').textContent = 'Your light is on the map. Thanks!'; }
      };
    });
  }

  // ---------- #19 predictions ----------
  if (els.predict.length) {
    let Q; try { Q = await (await fetch('data/predictions.json')).json(); } catch { return; }
    els.predict.forEach(el => {
      const mineAll = LS.get('preds', {});
      el.innerHTML = `<div class="c-k">Prediction board</div><h3 class="c-h">Call it before it happens.</h3><p class="c-note">One guess per question. When the real answer comes out, the closest calls rise to the top.</p>
        <div class="c-qs">${Q.questions.map(q => {
          const entries = (live ? (state.predictions[q.id] || []) : (mineAll[q.id] ? [mineAll[q.id]] : []));
          const closed = Date.now() > +new Date(q.closes), mine = mineAll[q.id];
          let board = '';
          if (q.answer != null) {
            const dist = e => q.type === 'date' ? Math.abs(+new Date(e.guess) - +new Date(q.answer)) : Math.abs(parseFloat(e.guess) - q.answer);
            const top = entries.filter(e => !isNaN(dist(e))).sort((a, b) => dist(a) - dist(b)).slice(0, 5);
            board = `<div class="c-ans">Answer: <b>${E(q.answer)}${q.unit && q.type !== 'date' ? ' ' + E(q.unit) : ''}</b></div><ol class="c-lb">${top.map(e => `<li><b>${E(e.name)}</b> guessed ${E(e.guess)}</li>`).join('')}</ol>`;
          } else if (entries.length) {
            const nums = entries.map(e => parseFloat(e.guess)).filter(n => !isNaN(n)).sort((a, b) => a - b), med = nums.length ? nums[Math.floor(nums.length / 2)] : null;
            board = `<div class="c-note">${entries.length.toLocaleString('en-US')} guess${entries.length === 1 ? '' : 'es'}${q.type === 'number' && med != null ? ` · crowd median ${med}${q.unit === '$M' ? 'M' : ''}` : ''}. Leaderboard appears when the answer is known.</div>`;
          }
          return `<div class="c-q" data-q="${q.id}"><div class="c-qq">${E(q.q)}</div>
            ${mine ? `<div class="c-mine">Your call: <b>${E(mine.guess)}</b> as ${E(mine.name)}</div>` : closed ? '<div class="c-note">Closed for new guesses.</div>' :
              `<div class="c-in"><input type="${q.type === 'date' ? 'month' : 'number'}" step="any" aria-label="Your guess" placeholder="${q.type === 'date' ? '' : 'Your guess' + (q.unit ? ' (' + q.unit + ')' : '')}"><input type="text" maxlength="20" aria-label="Display name" placeholder="Display name"><button type="button">Lock it in</button></div><div class="c-err" aria-live="polite"></div>`}
            ${board}</div>`;
        }).join('')}</div>${live ? '' : localNote}`;
      el.querySelectorAll('.c-q').forEach(box => {
        const b = box.querySelector('button'); if (!b) return;
        b.onclick = async () => {
          const [g, n] = box.querySelectorAll('input'), err = box.querySelector('.c-err');
          if (!g.value || !n.value.trim()) { err.textContent = 'Add a guess and a display name.'; return; }
          b.disabled = true; const r = await post({ action: 'predict', q: box.dataset.q, name: n.value, guess: g.value });
          if (r.ok || r.error === 'already') { const m = LS.get('preds', {}); m[box.dataset.q] = { name: n.value.trim().slice(0, 20), guess: g.value }; LS.set('preds', m); box.querySelector('.c-in').outerHTML = `<div class="c-mine">Your call: <b>${E(g.value)}</b> as ${E(n.value.trim())}</div>`; err.remove(); }
          else { err.textContent = r.message || 'Could not save that. Try again later.'; b.disabled = false; }
        };
      });
    });
  }
})();
