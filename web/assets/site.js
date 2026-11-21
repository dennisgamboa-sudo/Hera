// HERA Studio: scroll suave, recorrido de la piel, filtro de servicios, vista previa flotante, reel, reloj y copiar.
// Sin cookies ni peticiones de red.
(() => {
  const root = document.documentElement;
  const $ = (s) => document.querySelector(s);
  const quiet = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(pointer: fine)').matches;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch {} },
  };

  // Scroll suave (Lenis), salvo para quien pide menos movimiento
  let lenis = null;
  if (!quiet && window.Lenis) {
    lenis = new window.Lenis({ lerp: 0.09, smoothWheel: true });
    const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
    document.querySelectorAll('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      if (id.length < 2) return;
      const el = document.querySelector(id);
      if (!el) return;
      e.preventDefault();
      lenis.scrollTo(el, { offset: -8 });
      history.replaceState(null, '', id);
    }));
  }

  // Recorrido de la piel: portada, luego las seis señales, luego fundido a negro
  const skin = $('#piel');
  const sigs = [...document.querySelectorAll('#sig > li')];
  const rail = $('#rail');
  const hero = document.querySelector('.hero');
  const A = 0.08, B = 0.94, SEG = (B - A) / sigs.length;
  let lastIdx = -2;
  function onScroll() {
    if (!skin) return;
    const r = skin.getBoundingClientRect();
    const span = Math.max(1, r.height - innerHeight);
    const p = clamp(-r.top / span, 0, 1);
    const s = (p - A) / SEG;                         // 0 = intro, 1..6 = señales
    const gl = window.heraSkin;
    if (gl) {
      gl.fix = clamp(s - 0.6, 0, 6);
      gl.lensOn = 1 - clamp((p - A * 0.6) / (A * 0.9), 0, 1);
      gl.dark = clamp((p - B) / (1 - B), 0, 1);
      if (gl.redraw) gl.redraw();
    }
    if (hero) hero.style.setProperty('--out', String(clamp(p / A, 0, 1)));
    root.classList.toggle('on-skin', r.bottom > 64 && p < B + (1 - B) * 0.5);
    const idx = p < A ? -1 : (p > B ? -1 : clamp(Math.floor(s), 0, sigs.length - 1));
    if (idx !== lastIdx) { sigs.forEach((li, i) => li.classList.toggle('is-on', i === idx)); lastIdx = idx; }
    if (rail) rail.style.transform = `scaleX(${clamp((p - A) / (B - A), 0, 1)})`;
  }
  if (lenis) lenis.on('scroll', onScroll); else addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll, { passive: true });
  onScroll();

  // Pista de la lupa: se va cuando alguien la usa
  const hint = $('#hint');
  if (hint && !fine) hint.lastChild.textContent = 'Toca y arrastra sobre la piel';

  // Filtro por tipo de cliente
  const btns = [...document.querySelectorAll('[data-who]')];
  const rows = [...document.querySelectorAll('#list .row')];
  function filtrar(who) {
    btns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.who === who)));
    rows.forEach((r) => r.classList.toggle('is-dim', !!who && !(r.dataset.for || '').split(' ').includes(who)));
    store.set('hera-who', who);
  }
  btns.forEach((b) => b.addEventListener('click', () => filtrar(b.dataset.who)));
  const saved = store.get('hera-who');
  if (saved && btns.some((b) => b.dataset.who === saved)) filtrar(saved);

  // Vista previa que sigue al cursor sobre la lista de servicios
  const peek = $('#peek'), img = $('#peek-img'), mock = $('#peek-mock');
  if (peek && fine && !quiet) {
    let x = 0, y = 0, tx = 0, ty = 0, on = false, raf = 0;
    const tick = () => {
      x += (tx - x) * 0.14; y += (ty - y) * 0.14;
      peek.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%) rotate(${clamp((tx - x) * 0.04, -6, 6)}deg)`;
      raf = on || Math.abs(tx - x) > 0.5 ? requestAnimationFrame(tick) : 0;
    };
    rows.forEach((row) => {
      row.addEventListener('pointerenter', (e) => {
        const isMock = row.dataset.mock === 'ia';
        mock.hidden = !isMock; img.hidden = isMock;
        if (!isMock && img.getAttribute('src') !== row.dataset.img) img.src = row.dataset.img;
        if (!on) { x = tx = e.clientX; y = ty = e.clientY; }
        on = true; peek.classList.add('is-on');
        if (!raf) raf = requestAnimationFrame(tick);
      });
      row.addEventListener('pointerleave', () => { on = false; peek.classList.remove('is-on'); });
    });
    addEventListener('pointermove', (e) => { tx = e.clientX; ty = e.clientY; }, { passive: true });
  }

  // Reel: arranca al verse, se para al salir, y nunca para quien pide menos movimiento
  const reel = $('#reel'), play = $('#reel-play');
  if (reel && play) {
    play.addEventListener('click', () => { reel.paused ? reel.play().catch(() => {}) : reel.pause(); });
    reel.addEventListener('play', () => { play.textContent = 'Pausar'; play.setAttribute('aria-pressed', 'true'); });
    reel.addEventListener('pause', () => { play.textContent = 'Reproducir'; play.setAttribute('aria-pressed', 'false'); });
    if (!quiet) new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { reel.preload = 'auto'; reel.play().catch(() => {}); } else reel.pause();
    }, { threshold: 0.35 }).observe(reel);
  }

  // Botón magnético del correo
  const mail = $('#mail');
  if (mail && fine && !quiet) {
    mail.addEventListener('pointermove', (e) => {
      const r = mail.getBoundingClientRect();
      mail.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.08}px, ${(e.clientY - r.top - r.height / 2) * 0.2}px)`;
    });
    mail.addEventListener('pointerleave', () => { mail.style.transform = ''; });
  }

  // Copiar correo
  const copy = $('#copy'), ok = $('#copy-ok');
  const say = (m) => { if (ok) { ok.textContent = m; setTimeout(() => { ok.textContent = ''; }, 2500); } };
  const select = () => { const r = document.createRange(); r.selectNodeContents(mail); const s = getSelection(); s.removeAllRanges(); s.addRange(r); };
  if (copy) copy.addEventListener('click', () => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(copy.dataset.copy).then(() => say('Copiado'), () => { select(); say('Selecciónalo y copia'); });
    } else { select(); say('Selecciónalo y copia'); }
  });

  // Hora de Madrid
  const clock = $('#clock');
  if (clock) {
    const f = new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' });
    const tick = () => { clock.textContent = f.format(new Date()); };
    tick(); setInterval(tick, 15000);
  }
  const y = $('#year'); if (y) y.textContent = String(new Date().getFullYear());
})();
