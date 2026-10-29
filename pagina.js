// Lo de la página (no del simulador): tema, cascada de la portada y botones.
(() => {
  'use strict';

  // Enlace de descarga de la app. Cuando esté en Google Play (o haya un APK
  // publicado), pega aquí la dirección y los botones "Descargar" se activan.
  const ENLACE_DESCARGA = '';

  // ── Tema: sistema → claro → oscuro ─────────────────────────────────────
  const raiz = document.documentElement;
  const botonTema = document.getElementById('tema');
  const iconos = { sistema: 'contrast', claro: 'light_mode', oscuro: 'dark_mode' };
  const nombres = { sistema: 'Tema del sistema', claro: 'Tema claro', oscuro: 'Tema oscuro' };
  let tema = 'sistema';
  try { tema = localStorage.getItem('foodzy-web-tema') || 'sistema'; } catch { /* sin almacenamiento */ }
  function aplicarTema() {
    if (tema === 'sistema') raiz.removeAttribute('data-theme');
    else raiz.setAttribute('data-theme', tema === 'oscuro' ? 'dark' : 'light');
    botonTema.querySelector('.ms').textContent = iconos[tema];
    botonTema.setAttribute('aria-label', `${nombres[tema]} (cambiar)`);
    botonTema.title = nombres[tema];
  }
  botonTema.addEventListener('click', () => {
    tema = { sistema: 'claro', claro: 'oscuro', oscuro: 'sistema' }[tema];
    try { localStorage.setItem('foodzy-web-tema', tema); } catch { /* nada */ }
    aplicarTema();
  });
  aplicarTema();

  // ── Botones que llevan al simulador ────────────────────────────────────
  const simulador = document.getElementById('simulador');
  document.querySelectorAll('[data-probar]').forEach((b) => b.addEventListener('click', (ev) => {
    ev.preventDefault();
    simulador.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
    if (b.dataset.probar === 'escanear') setTimeout(() => window.foodzySimulador?.escanear(), 450);
  }));

  // ── Descarga ───────────────────────────────────────────────────────────
  document.querySelectorAll('[data-descargar]').forEach((a) => {
    if (ENLACE_DESCARGA) {
      a.href = ENLACE_DESCARGA;
      a.target = '_blank';
      a.rel = 'noopener';
    } else {
      a.removeAttribute('href');
      a.setAttribute('aria-disabled', 'true');
      a.classList.add('pronto');
      a.querySelector('[data-texto]').textContent = 'Muy pronto en Google Play';
    }
  });

  document.getElementById('anio').textContent = new Date().getFullYear();

  // ── Cascada de siluetas en la portada (como el encabezado de la app) ───
  const lienzo = document.getElementById('cascada');
  const formas = Object.entries(SILUETAS).filter(([k]) => k !== 'corona').map(([, d]) => new Path2D(d));
  const quieto = matchMedia('(prefers-reduced-motion: reduce)');
  let rejilla = null, visible = true, cuadro = null;
  const t0 = performance.now();

  function armar(w, h) {
    let semilla = 11;
    const azar = () => { semilla = (semilla * 16807) % 2147483647; return semilla / 2147483647; };
    const celda = w < 700 ? 58 : 76;
    const cols = Math.max(1, Math.round(w / celda));
    const filas = Math.ceil((h + celda) / celda) + 1;
    const g = { w, h, celda, cols, largo: filas * celda, vel: [], s: [] };
    for (let c = 0; c < cols; c++) g.vel.push(6 + azar() * 10);
    for (let c = 0; c < cols; c++) {
      const inicio = Math.floor(azar() * formas.length);
      for (let f = 0; f < filas; f++) {
        g.s.push({ forma: formas[(inicio + f * 7) % formas.length], col: c, dx: 0.5 + (azar() - 0.5) * 0.35,
          y0: f * celda + azar() * celda * 0.3 + (c % 2 ? celda / 2 : 0), tam: celda * (0.38 + azar() * 0.36),
          giro: (azar() - 0.5) * 1.2, fase: azar() * 6.28, brillo: azar() });
      }
    }
    return g;
  }

  function dibujar(ahora) {
    cuadro = null;
    const r = lienzo.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (!r.width || !r.height) return;
    const w = Math.round(r.width * dpr), h = Math.round(r.height * dpr);
    if (lienzo.width !== w || lienzo.height !== h) { lienzo.width = w; lienzo.height = h; }
    if (!rejilla || rejilla.w !== r.width || rejilla.h !== r.height) rejilla = armar(r.width, r.height);
    const ctx = lienzo.getContext('2d');
    const t = quieto.matches ? 6 : (ahora - t0) / 1000;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, r.width, r.height);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const ancho = r.width / rejilla.cols;
    for (const s of rejilla.s) {
      const y = ((s.y0 + t * rejilla.vel[s.col]) % rejilla.largo) - rejilla.celda;
      ctx.save();
      ctx.translate((s.col + s.dx) * ancho, y);
      ctx.rotate(s.giro + Math.sin(t * 0.35 + s.fase) * 0.18);
      ctx.scale(s.tam, s.tam);
      ctx.translate(-0.5, -0.5);
      ctx.lineWidth = 1.6 / s.tam;
      ctx.strokeStyle = s.brillo > 0.86 ? 'rgba(253, 186, 116, 0.2)' : 'rgba(74, 222, 128, 0.14)';
      ctx.stroke(s.forma);
      ctx.restore();
    }
    if (visible && !quieto.matches && !document.hidden) cuadro = requestAnimationFrame(dibujar);
  }
  const arrancar = () => { if (!cuadro) cuadro = requestAnimationFrame(dibujar); };
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) arrancar(); }).observe(lienzo);
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) arrancar(); });
  window.addEventListener('resize', arrancar);
  quieto.addEventListener?.('change', arrancar);
  arrancar();
})();
