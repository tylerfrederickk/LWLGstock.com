/* #9 Narrated tour of the homepage: auto-scrolls, flies the 3D wafer, speaks each step (Web Speech API) with captions. */
(function () {
  const head = document.querySelector('.site-head .nav, .site-head nav'); if (!document.getElementById('k-number')) return;
  const STEPS = [
    { fly: 0, say: "Welcome to the LWLG Investor Index. This is a real 300 millimetre silicon wafer, and we're going to zoom all the way into a single molecule." },
    { fly: 3, say: "Sixty times closer: one photonic chip. Laser light comes in on the left, splits into four lanes, and races through modulators under gold electrodes." },
    { fly: 4, say: "Each modulator turns electrical signals into pulses of light. The material doing the switching is Lightwave Logic's polymer." },
    { fly: 6, say: "Half a million times closer. The polymer is packed with chromophore molecules. A strong field lines them up, and that's what lets them switch light with a tiny voltage." },
    { fly: 8, say: "Now zoom out to an AI data center. Every glowing line is an optical link, and every link needs modulators." },
    { el: 'k-number', say: "Five Fortune Global 500 programs are in Stage 3, designing Perkinamine into their own chips. None has reached Stage 4 yet. That's the milestone to watch." },
    { el: 'k-foundry', say: "And it's in the foundry. Design kits at Tower, GlobalFoundries and SilTerra let chip designers drop these modulators into standard flows." },
    { el: 'k-compare', say: "Compared with silicon and thin-film lithium niobate, the polymer's pitch is low voltage, high speed and a tiny footprint." },
    { el: 'k-avail', say: "The company is targeting volume production from the second half of 2027." },
    { el: 'perkinamine', say: "This is Perkinamine, the product itself. Drag the vial to spin it." },
    { el: 'pk-grades', say: "There are two grades: one for today's silicon photonics transceivers, and one in development for co-packaged optics next to AI chips." },
    { el: 'k-connections', say: "And here are the unverified connections: every rumour and what-if the community has floated. Remember, none of it is confirmed." },
    { el: 'explore', say: "That's the tour. Everything else is one click away below. Thanks for watching." },
  ];
  const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'nav-top tour-btn'; btn.innerHTML = '<span aria-hidden="true">▶</span> Tour';
  btn.setAttribute('aria-label', 'Play a narrated tour of this page');
  (head || document.querySelector('.site-head')).appendChild(btn);
  const bar = document.createElement('div'); bar.className = 'tour-bar'; bar.hidden = true; bar.setAttribute('role', 'region'); bar.setAttribute('aria-label', 'Tour captions');
  bar.innerHTML = '<div class="tour-cap" aria-live="polite"></div><div class="tour-row"><div class="tour-prog"><i></i></div><span class="tour-n mono"></span><button type="button" class="tour-mute">Sound on</button><button type="button" class="tour-stop">Stop tour</button></div>';
  document.body.appendChild(bar);
  const cap = bar.querySelector('.tour-cap'), prog = bar.querySelector('.tour-prog i'), num = bar.querySelector('.tour-n'), muteB = bar.querySelector('.tour-mute');
  const synth = 'speechSynthesis' in window ? speechSynthesis : null;
  let run = 0, muted = !synth, voice = null;
  const pickVoice = () => { if (!synth) return; const vs = synth.getVoices(); voice = vs.find(v => /Samantha|Google US English|Microsoft (Aria|Jenny)/i.test(v.name)) || vs.find(v => /^en(-|_)US/i.test(v.lang)) || vs.find(v => /^en/i.test(v.lang)) || null; };
  if (synth) { pickVoice(); synth.onvoiceschanged = pickVoice; }
  muteB.textContent = muted ? 'Sound off' : 'Sound on'; if (!synth) muteB.hidden = true;
  muteB.onclick = () => { muted = !muted; muteB.textContent = muted ? 'Sound off' : 'Sound on'; if (muted && synth) synth.cancel(); };
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const speak = (text, id) => new Promise(res => {
    const ms = Math.max(3500, text.split(' ').length * 380);
    if (muted || !synth) { wait(ms).then(res); return; }
    const u = new SpeechSynthesisUtterance(text); if (voice) u.voice = voice; u.rate = 1.0; u.pitch = 1;
    let done = false; const fin = () => { if (!done) { done = true; res(); } };
    u.onend = fin; u.onerror = fin; synth.cancel(); synth.speak(u); setTimeout(fin, ms + 6000);
  });
  async function play() {
    const id = ++run; bar.hidden = false; btn.classList.add('on'); document.documentElement.classList.add('touring');
    for (let k = 0; k < STEPS.length; k++) {
      if (id !== run) return; const s = STEPS[k];
      num.textContent = `${k + 1} / ${STEPS.length}`; prog.style.transform = `scaleX(${(k + 1) / STEPS.length})`; cap.textContent = s.say;
      if ('fly' in s && window.LWFly) window.LWFly(s.fly);
      else if (s.el) { const e = document.getElementById(s.el); if (e) e.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
      await wait(900); if (id !== run) return;
      await speak(s.say, id); if (id !== run) return; await wait(500);
    }
    stop();
  }
  function stop() { run++; if (synth) synth.cancel(); bar.hidden = true; btn.classList.remove('on'); document.documentElement.classList.remove('touring'); }
  btn.onclick = () => (btn.classList.contains('on') ? stop() : play());
  bar.querySelector('.tour-stop').onclick = stop;
  addEventListener('keydown', e => { if (e.key === 'Escape' && !bar.hidden) stop(); });
  ['wheel', 'touchstart'].forEach(ev => addEventListener(ev, () => { if (!bar.hidden) stop(); }, { passive: true }));
})();
