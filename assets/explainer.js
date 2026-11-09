/* #8 The 60-second explainer: six auto-playing scenes, silent, loops. Pauses when off screen. */
(function () {
  const box = document.getElementById('xpl'); if (!box) return;
  const scenes = [...box.querySelectorAll('.xs')], cap = box.querySelector('.xpl-cap'), bar = box.querySelector('.xpl-bar i'), dots = box.querySelector('.xpl-dots');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const DUR = 10000; let i = 0, t0 = performance.now(), paused = false, onscreen = true, held = 0;
  scenes.forEach((_, k) => { const d = document.createElement('span'); dots.appendChild(d); });
  const ds = [...dots.children];
  function go(k) { i = (k + scenes.length) % scenes.length; scenes.forEach((s, j) => s.classList.toggle('on', j === i)); ds.forEach((d, j) => d.classList.toggle('on', j === i)); cap.textContent = scenes[i].dataset.cap; t0 = performance.now(); }
  go(0);
  new IntersectionObserver(e => { onscreen = e[0].isIntersecting; }).observe(box);
  box.addEventListener('mouseenter', () => { paused = true; held = performance.now() - t0; });
  box.addEventListener('mouseleave', () => { paused = false; t0 = performance.now() - held; });
  if (reduce) box.classList.add('still');
  (function tick(now) {
    requestAnimationFrame(tick);
    if (paused || !onscreen) { if (!paused) t0 = now - (bar._p || 0) * DUR; return; }
    const p = Math.min(1, (now - t0) / DUR); bar._p = p; bar.style.transform = `scaleX(${((i + p) / scenes.length).toFixed(4)})`;
    if (p >= 1) go(i + 1);
  })(performance.now());
})();
