// HERA Studio: perfil de cliente, Huella IA, reel y copiar correo. Sin cookies, sin peticiones de red.
(() => {
  const root = document.documentElement;
  const $ = (s) => document.querySelector(s);
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} },
  };

  // Perfil: la portada y el orden de servicios se adaptan a quién mira. Se guarda solo en este navegador.
  const PERFILES = {
    marcas: { sub: 'Campañas de belleza y lujo con IA, con el producto intacto y cada imagen declarada.', asunto: 'Campaña para mi marca' },
    agencias: { sub: 'Producción de imagen con IA que tu agencia suma a un rodaje sin riesgo legal: originales a salvo y cada pieza declarada.', asunto: 'Colaboración con mi agencia' },
    hoteles: { sub: 'Que ChatGPT, Gemini y Perplexity recomienden tu casa, y que las imágenes estén a su altura.', asunto: 'Visibilidad e imagen para mi hotel o restaurante' },
    pequenas: { sub: 'Retoque de piel por foto para marcas de cosmética que empiezan: textura real y precio por imagen.', asunto: 'Retoque para mi marca' },
  };
  const sub = $('#hero-sub');
  const subBase = sub ? sub.textContent : '';
  const cta = $('#cta-mail');
  const chips = [...document.querySelectorAll('[data-who]')];
  const cards = [...document.querySelectorAll('#svc-grid .card')];

  function aplicar(who) {
    const p = PERFILES[who];
    chips.forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.who === who)));
    if (p) root.dataset.who = who; else delete root.dataset.who;
    cards.forEach((c) => c.classList.toggle('is-match', !!p && (c.dataset.for || '').split(' ').includes(who)));
    if (sub) sub.textContent = p ? p.sub : subBase;
    if (cta) cta.href = 'mailto:denno@heraaistudio.com?subject=' + encodeURIComponent(p ? p.asunto : 'Proyecto con HERA Studio');
    store.set('hera-who', p ? who : null);
  }
  chips.forEach((c) => c.addEventListener('click', () => aplicar(c.getAttribute('aria-pressed') === 'true' ? null : c.dataset.who)));
  const guardado = store.get('hera-who');
  if (guardado && PERFILES[guardado]) aplicar(guardado);

  // Huella IA
  const huella = $('#huella');
  function setHuella(on) {
    root.dataset.huella = on ? 'on' : 'off';
    if (huella) huella.setAttribute('aria-pressed', String(on));
    store.set('hera-huella', on ? 'on' : null);
  }
  if (huella) huella.addEventListener('click', () => setHuella(root.dataset.huella !== 'on'));
  if (store.get('hera-huella') === 'on') setHuella(true);

  // Reel: no arranca solo; respeta a quien pide menos movimiento.
  const reel = $('#reel');
  const play = $('#reel-play');
  if (reel && play) {
    play.addEventListener('click', () => {
      if (reel.paused) { reel.play().catch(() => {}); } else { reel.pause(); }
    });
    reel.addEventListener('play', () => { play.textContent = 'Pausar'; play.setAttribute('aria-pressed', 'true'); });
    reel.addEventListener('pause', () => { play.textContent = 'Reproducir'; play.setAttribute('aria-pressed', 'false'); });
    const quieto = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!quieto && 'IntersectionObserver' in window) {
      new IntersectionObserver(([e]) => {
        if (e.isIntersecting && e.intersectionRatio > 0.6) reel.play().catch(() => {});
        else if (!e.isIntersecting) reel.pause();
      }, { threshold: [0, 0.6] }).observe(reel);
    }
  }

  // Copiar correo
  const copy = $('#copy-mail');
  const ok = $('#copy-ok');
  if (copy) copy.addEventListener('click', () => {
    const txt = copy.dataset.copy;
    const done = (m) => { if (ok) { ok.textContent = m; setTimeout(() => { ok.textContent = ''; }, 2500); } };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(() => done('Copiado'), () => { seleccionar(); done('Selecciónalo y copia'); });
    } else { seleccionar(); done('Selecciónalo y copia'); }
  });
  function seleccionar() {
    const a = $('#mail-addr');
    if (!a) return;
    const r = document.createRange(); r.selectNodeContents(a);
    const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
  }

  const y = $('#year');
  if (y) y.textContent = String(new Date().getFullYear());
})();
