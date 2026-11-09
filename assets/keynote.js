/* Keynote homepage: event pop-up (once per visit) + fly-to cards. */
(async function () {
  document.querySelectorAll('[data-fly]').forEach(a => a.addEventListener('click', e => {
    if (window.LWFly) { e.preventDefault(); window.LWFly(+a.dataset.fly); }
  }));
  const pop = document.getElementById('k-pop'); if (!pop) return;
  document.body.appendChild(pop);
  let ev = null;
  try { ev = (await LW.getJSON('data/facts.json')).next_event; } catch (e) { }
  if (!ev || !ev.date) return;
  const start = new Date(ev.date);
  if (isNaN(start) || Date.now() > start.getTime() + 2 * 3600e3) return;   // event over: no pop-up
  let seen = null; try { seen = sessionStorage.getItem('lwlg-pop'); } catch (e) { }
  if (seen === ev.date) return;
  const d = start.toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'America/New_York' });
  const t = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' }).replace('AM', 'a.m.').replace('PM', 'p.m.');
  document.getElementById('k-pop-d').textContent = `${d} · ${t} ET`;
  document.getElementById('k-pop-s').textContent = ev.label;
  const z = x => x.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const ics = `BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nDTSTART:${z(start)}\nDTEND:${z(new Date(start.getTime() + 3600e3))}\nSUMMARY:LWLG ${ev.label}\nEND:VEVENT\nEND:VCALENDAR`;
  document.getElementById('k-pop-ics').href = 'data:text/calendar;charset=utf-8,' + encodeURIComponent(ics);
  const cd = document.getElementById('k-cd'), u = k => cd.querySelector(`[data-u="${k}"]`);
  const tick = () => {
    let ms = Math.max(0, start - Date.now()); const s = Math.floor(ms / 1000);
    if (ms <= 0) { cd.innerHTML = '<div class="k-live">Live now</div>'; clearInterval(tm); return; }
    u('d').textContent = Math.floor(s / 86400); u('h').textContent = String(Math.floor(s % 86400 / 3600)).padStart(2, '0');
    u('m').textContent = String(Math.floor(s % 3600 / 60)).padStart(2, '0'); u('s').textContent = String(s % 60).padStart(2, '0');
  };
  const tm = setInterval(tick, 1000); tick();
  const prev = document.activeElement;
  const close = () => {
    pop.classList.remove('on'); setTimeout(() => { pop.hidden = true; }, 450);
    document.documentElement.classList.remove('k-lock');
    try { sessionStorage.setItem('lwlg-pop', ev.date); } catch (e) { }
    document.removeEventListener('keydown', key); prev && prev.focus && prev.focus();
  };
  const key = e => { if (e.key === 'Escape') close(); };
  pop.querySelector('.k-x').onclick = close;
  pop.querySelector('.k-enter').onclick = close;
  pop.addEventListener('click', e => { if (e.target === pop) close(); });
  setTimeout(() => {
    pop.hidden = false; document.documentElement.classList.add('k-lock');
    setTimeout(() => pop.classList.add('on'), 30);
    pop.querySelector('.k-x').focus(); document.addEventListener('keydown', key);
  }, 700);
})();
