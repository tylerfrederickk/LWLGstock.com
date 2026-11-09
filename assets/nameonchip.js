/* #6 Your name on a chip: etch a name onto one die of the 3D wafer (stays on this device) and make a share image. */
(function () {
  const box = document.getElementById('chipname'); if (!box) return;
  const E = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const form = box.querySelector('form'), inp = form.querySelector('input'), out = box.querySelector('.cn-out'), cv = box.querySelector('canvas');
  const img = new Image(); img.src = 'assets/img/chip.jpg';
  const dieNo = n => { let h = 2166136261; for (const ch of n.toUpperCase()) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return Math.abs(h) % 64 + 1; };
  async function draw(name, die) {
    await img.decode().catch(() => { }); await document.fonts.ready;
    const W = cv.width = 1080, H = cv.height = 1080, g = cv.getContext('2d');
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    const s = Math.max(W / img.width, H / img.height) * 1.35; g.drawImage(img, (W - img.width * s) * .42, (H - img.height * s) * .78, img.width * s, img.height * s);
    const vg = g.createRadialGradient(W / 2, H * .62, 120, W / 2, H * .62, 760); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.7)'); g.fillStyle = vg; g.fillRect(0, 0, W, H);
    // etched name, in the chip's perspective
    g.save(); g.translate(170, 860); g.transform(1, -0.44, 0.38, 1, 0, 0);
    const t = name.toUpperCase().slice(0, 16); let fs = 108; g.font = `700 ${fs}px "DejaVu Sans Mono", ui-monospace, monospace`; while (g.measureText(t).width > 760 && fs > 40) { fs -= 6; g.font = `700 ${fs}px "DejaVu Sans Mono", ui-monospace, monospace`; }
    g.shadowColor = 'rgba(120,190,255,.9)'; g.shadowBlur = 22; g.lineWidth = 2.4; g.strokeStyle = 'rgba(232,240,255,.9)'; g.strokeText(t, 0, 0);
    g.shadowBlur = 0; g.fillStyle = 'rgba(200,220,255,.12)'; g.fillText(t, 0, 0);
    g.font = '500 26px "DejaVu Sans Mono", monospace'; g.fillStyle = 'rgba(230,236,255,.75)'; g.fillText(`DIE ${die} · ${new Date().toISOString().slice(0, 10)} · LWLG`, 4, 52); g.restore();
    // frame
    g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(0, 0, W, 130);
    g.fillStyle = '#F5F5F7'; g.font = '700 40px Inter, system-ui, sans-serif'; g.fillText(`${name} · die ${die}`, 60, 80);
    g.fillStyle = '#A1A1A6'; g.font = '500 24px Inter, system-ui, sans-serif'; g.fillText('LWLGstock.com · concept render', 60, 1040);
  }
  async function etch(name) {
    name = name.replace(/[^\p{L}\p{N} .'-]/gu, '').trim().slice(0, 16); if (!name) return;
    const die = window.LWMarkDie ? (window.LWMarkDie(name) || dieNo(name)) : dieNo(name);
    try { localStorage.setItem('lwlg-chipname', name); } catch (e) { }
    await draw(name, die); out.hidden = false; box.querySelector('.cn-ph').hidden = true;
    box.querySelector('.cn-title').innerHTML = `${E(name)},<br><span class="grad">die ${die}.</span>`;
  }
  form.addEventListener('submit', e => { e.preventDefault(); etch(inp.value); });
  box.querySelector('.cn-share').onclick = async () => {
    const blob = await new Promise(r => cv.toBlob(r, 'image/png')), file = new File([blob], 'my-lwlg-chip.png', { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], text: 'My name, etched on a chip · LWLGstock.com' }); return; } catch (e) { if (e.name === 'AbortError') return; } }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = file.name; document.body.appendChild(a); a.click(); a.remove();
  };
  box.querySelector('.cn-fly').onclick = () => { if (window.LWFly) window.LWFly(0); scrollTo({ top: 0, behavior: 'smooth' }); };
  try { const saved = localStorage.getItem('lwlg-chipname'); if (saved) { inp.value = saved; etch(saved); } } catch (e) { }
})();
