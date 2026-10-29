// Simulador de Foodzy: la app recreada en el navegador. Todo lo que pasa aquí
// se guarda solo en el localStorage de quien lo usa; no hay servidor, ni
// Firebase, ni IA real (la lectura de la factura de ejemplo ya viene hecha).
(() => {
  'use strict';

  const CLAVE = 'foodzy-demo-v1';
  const LIMITE_GRATIS = 15; // usos de IA del plan gratuito (como en la app)
  const UBICACIONES = {
    nevera: { nombre: 'Nevera', emoji: '🧊', i: 0 },
    congelador: { nombre: 'Congelador', emoji: '❄️', i: 1 },
    alacena: { nombre: 'Alacena', emoji: '🗄️', i: 2 },
  };
  const ORDEN_UBIC = ['nevera', 'congelador', 'alacena'];
  const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

  // ── Utilidades ─────────────────────────────────────────────────────────
  const pad = (n) => String(n).padStart(2, '0');
  const hoy = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
  const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const enDias = (n) => { const d = hoy(); d.setDate(d.getDate() + n); return iso(d); };
  const desdeIso = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  // Días de calendario hasta [s]; se resta en UTC para no perder un día por horario de verano.
  const diasHasta = (s) => {
    const f = desdeIso(s), h = hoy();
    return Math.round((Date.UTC(f.getFullYear(), f.getMonth(), f.getDate()) - Date.UTC(h.getFullYear(), h.getMonth(), h.getDate())) / 864e5);
  };
  const fechaCorta = (s) => { const f = desdeIso(s); return `${f.getDate()} ${MESES[f.getMonth()]} ${f.getFullYear()}`; };
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const clave = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  const pesos = (n) => '$' + Math.round(n).toLocaleString('es-CO');
  const num = (n) => (Math.round(n * 100) / 100).toLocaleString('es-CO', { maximumFractionDigits: 2 });
  const cantidad = (a) => `${num(a.cantidad)} ${a.unidad}`;
  let ultimoId = 0;
  const nuevoId = () => { let t = Date.now(); if (t <= ultimoId) t = ultimoId + 1; ultimoId = t; return String(t); };

  // ── Datos (solo en este navegador) ─────────────────────────────────────
  function estadoInicial() {
    return {
      v: 1,
      alimentos: DESPENSA_INICIAL.map(([nombre, categoria, emoji, cant, unidad, dias, ubicacion, origen, precio], i) => ({
        id: 'demo-' + i, nombre, categoria, emoji, cantidad: cant, unidad, precio,
        vence: dias === null ? null : enDias(dias), noVence: dias === null,
        origen, ubicacion, estado: 'disponible', cierre: null, factura: false, compra: enDias(-3),
      })),
      lista: LISTA_INICIAL.map((nombre, i) => ({ id: 'l' + i, nombre, comprado: false, porFactura: false })),
      ajustes: { modo: 'sistema', diasAviso: 2 },
      escaneos: 0,
    };
  }
  function cargar() {
    try {
      const o = JSON.parse(localStorage.getItem(CLAVE) || 'null');
      if (o && o.v === 1 && Array.isArray(o.alimentos)) return o;
    } catch { /* sin almacenamiento: la demo funciona igual, sin recordar */ }
    return estadoInicial();
  }
  let S = cargar();
  const guardar = () => { try { localStorage.setItem(CLAVE, JSON.stringify(S)); } catch { /* nada */ } };

  const disponibles = () => S.alimentos.filter((a) => a.estado === 'disponible');
  const porId = (id) => S.alimentos.find((a) => a.id === id);
  const urgencia = (a) => (a.noVence ? 1e6 : a.vence ? diasHasta(a.vence) : -1e6);
  const venceEn = (a, d) => a.estado === 'disponible' && !a.noVence && a.vence && diasHasta(a.vence) <= d;
  const vencido = (a) => venceEn(a, -1);

  // La misma lectura de estados que la app (estado_visual.dart).
  function estadoVisual(a) {
    if (a.estado === 'consumido') return { texto: 'Consumido', c: '#3b82f6', ico: 'check_circle' };
    if (a.estado === 'desechado') return { texto: 'Desechado', c: '#78716c', ico: 'delete' };
    if (a.noVence) return { texto: 'No vence', c: 'var(--e-nunca)', ico: 'all_inclusive' };
    if (!a.vence) return { texto: 'Sin fecha', c: 'var(--e-sin)', ico: 'event_busy' };
    const d = diasHasta(a.vence);
    let e;
    if (d < 0) e = { texto: d === -1 ? 'Venció ayer' : `Venció hace ${-d} días`, c: 'var(--e-vencido)', ico: 'warning' };
    else if (d === 0) e = { texto: 'Vence hoy', c: 'var(--e-hoy)', ico: 'timer' };
    else if (d <= 3) e = { texto: d === 1 ? 'Vence mañana' : `Vence en ${d} días`, c: 'var(--e-pronto)', ico: 'schedule' };
    else e = { texto: `Vence en ${d} días`, c: 'var(--e-bien)', ico: 'eco' };
    if (a.origen === 'estimada') e.texto = '≈ ' + e.texto;
    return e;
  }

  // ── Estado de la interfaz (no se guarda) ───────────────────────────────
  const U = {
    pestana: 'inicio',
    rutas: [],          // pantallas abiertas encima de las pestañas
    busqueda: '',
    filtro: 'todos',
    ubic: null,
    comida: 'Todas',
    hoja: null,
    snack: null,
    notif: null,
    confirmarReinicio: false,
  };
  const ruta = () => U.rutas[U.rutas.length - 1];

  // ── Piezas ─────────────────────────────────────────────────────────────
  const ms = (nombre, extra = '') => `<span class="ms ${extra}" aria-hidden="true">${nombre}</span>`;
  const foto = (a, t = 52) =>
    `<span class="foto-alimento" style="width:${t}px;height:${t}px"><span class="emoji" style="font-size:${Math.round(t * 0.52)}px">${esc(a.emoji || '🍽️')}</span></span>`;
  const chipEstado = (a) => { const e = estadoVisual(a); return `<span class="estado" style="--c:${e.c}">${ms(e.ico)}${esc(e.texto)}</span>`; };
  const barraApp = (titulo, extra = '') =>
    `<header class="barra-app"><button class="icono-btn" data-a="atras" aria-label="Volver">${ms('arrow_back')}</button><h2>${esc(titulo)}</h2>${extra}</header>`;

  function tarjeta(a) {
    const u = a.ubicacion ? ` · ${UBICACIONES[a.ubicacion].emoji} ${UBICACIONES[a.ubicacion].nombre}` : '';
    return `<button class="tarjeta" data-a="detalle" data-id="${esc(a.id)}">${foto(a)}
      <span class="cuerpo"><span class="titulo">${esc(a.nombre)}</span>
      <span class="detalle">${esc(cantidad(a))}${esc(u)}</span>${chipEstado(a)}</span>${ms('chevron_right')}</button>`;
  }

  // ── Pantallas ──────────────────────────────────────────────────────────
  function pantallaInicio() {
    const disp = disponibles();
    const vencidos = disp.filter(vencido).length;
    const porVencer = disp.filter((a) => venceEn(a, 3) && !vencido(a)).length;
    const pronto = disp.filter((a) => venceEn(a, 7)).sort((a, b) => urgencia(a) - urgencia(b)).slice(0, 6);
    const h = new Date().getHours();
    const saludo = h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
    const lista = S.lista.filter((i) => !i.comprado).length;
    return `<div class="desplazable" data-scroll="inicio">
      <section class="inicio-cabecera">
        <canvas data-anim="cascada" aria-hidden="true"></canvas>
        <p class="saludo">${saludo},</p>
        <p class="nombre">Invitado <span class="emoji">👋</span></p>
        <div class="cifras">
          <div class="cifra" style="--c:var(--a-primario)">${ms('kitchen')}<b>${disp.length}</b><span>En despensa</span></div>
          <div class="cifra" style="--c:var(--e-pronto)">${ms('schedule')}<b>${porVencer}</b><span>Por vencer</span></div>
          <div class="cifra" style="--c:var(--e-vencido)">${ms('warning')}<b>${vencidos}</b><span>Vencidos</span></div>
        </div>
      </section>
      ${vencidos + porVencer > 0 ? `<div class="bloque"><button class="aviso-inicio" data-a="pestana" data-p="recetas">
        <span class="emoji">🍳</span><span><b>${vencidos + porVencer} alimento${vencidos + porVencer === 1 ? '' : 's'} necesita${vencidos + porVencer === 1 ? '' : 'n'} atención</b>
        <span>Mira recetas para aprovecharlos a tiempo</span></span></button></div>` : ''}
      <div class="bloque">
        <div class="titulo-bloque"><h3>Acciones rápidas</h3></div>
        <div class="acciones-rapidas">
          <button class="accion" data-a="hoja-anadir">${ms('shopping_basket')}Compra</button>
          <button class="accion" data-a="camara">${ms('receipt_long')}Factura</button>
          <button class="accion" data-a="solo-app" data-que="Sacar comida con una foto">${ms('outbox')}Sacar</button>
          <div class="media">
            <button class="accion" data-a="ir" data-r="lista">${ms('checklist')}<span>Lista de compras<small>${lista} pendiente${lista === 1 ? '' : 's'}</small></span></button>
            <button class="accion" data-a="ir" data-r="numeros">${ms('bar_chart')}<span>Tus números<small>Gasto y desperdicio</small></span></button>
          </div>
        </div>
      </div>
      <div class="bloque">
        <div class="titulo-bloque"><h3>Vence pronto</h3><button class="enlace-app" data-a="pestana" data-p="despensa">Ver todo</button></div>
        ${pronto.length ? `<div class="rejilla-pronto">${pronto.map((a) => `<button class="mini entra" data-a="detalle" data-id="${esc(a.id)}">
          <span style="display:flex;gap:8px;align-items:center">${foto(a, 36)}<span class="nombre-mini">${esc(a.nombre)}</span></span>${chipEstado(a)}</button>`).join('')}</div>`
          : `<div class="vacio"><span class="emoji">🎉</span><b>Nada vence esta semana</b><span>Escanea tu próxima compra y te avisamos a tiempo.</span></div>`}
      </div>
    </div>`;
  }

  function filtrar() {
    const q = clave(U.busqueda);
    return disponibles()
      .filter((a) => {
        if (U.filtro === 'vigentes' && vencido(a)) return false;
        if (U.filtro === 'vencidos' && !vencido(a)) return false;
        if (U.ubic && a.ubicacion !== U.ubic) return false;
        return !q || clave(a.nombre).includes(q) || clave(a.categoria).includes(q);
      })
      .sort((a, b) => urgencia(a) - urgencia(b));
  }

  function pantallaDespensa() {
    const items = filtrar();
    const chips = [['todos', 'Todos'], ['vigentes', 'Vigentes'], ['vencidos', 'Vencidos']]
      .map(([v, t]) => `<button class="chip ${U.filtro === v ? 'activo' : ''}" data-a="filtro" data-v="${v}">${U.filtro === v ? ms('check') : ''}${t}</button>`).join('');
    const ubic = ORDEN_UBIC.map((u) => `<button class="chip ${U.ubic === u ? 'activo' : ''}" data-a="ubic" data-v="${u}"><span class="emoji">${UBICACIONES[u].emoji}</span>${UBICACIONES[u].nombre}</button>`).join('');
    return `<header class="barra-app" style="padding-left:18px"><h2>Mi despensa</h2>
        <button class="icono-btn" data-a="ir" data-r="historial" aria-label="Historial">${ms('history')}</button></header>
      <div class="buscador">${ms('search')}<input id="sim-busqueda" type="search" placeholder="Buscar alimento o categoría..." value="${esc(U.busqueda)}" autocomplete="off" aria-label="Buscar en la despensa">
        ${U.busqueda ? `<button class="icono-btn" data-a="limpiar-busqueda" aria-label="Borrar búsqueda">${ms('close')}</button>` : ''}</div>
      <div class="filtros">${chips}${ubic}</div>
      <div class="desplazable" data-scroll="despensa">
        ${items.length ? `<div class="lista">${items.map(tarjeta).join('')}</div>`
          : `<div class="vacio"><span class="emoji">🔎</span><b>No hay alimentos con ese filtro</b><span>Prueba otro filtro o escanea la factura de ejemplo.</span></div>`}
      </div>`;
  }

  // Recetas: cuáles se pueden hacer con lo que hay y qué aprovechan.
  function evaluar(r) {
    // Como en la app: lo vencido no se propone para cocinar.
    const disp = disponibles().filter((a) => !vencido(a)).sort((a, b) => urgencia(a) - urgencia(b));
    const ing = r.ingredientes.map(([k, texto]) => ({ texto, item: disp.find((a) => clave(a.nombre).includes(k)) || null }));
    const tengo = ing.filter((i) => i.item);
    const urgentes = tengo.filter((i) => venceEn(i.item, 3));
    return { ing, tengo, urgentes, puntaje: urgentes.length * 10 + tengo.length / ing.length * 5 };
  }

  function pantallaRecetas() {
    const comidas = ['Todas', 'Desayuno', 'Almuerzo', 'Cena', 'Algo rápido'];
    const recetas = RECETAS.filter((r) => U.comida === 'Todas' || r.comida === U.comida)
      .map((r) => ({ r, e: evaluar(r) }))
      .filter(({ e }) => e.tengo.length > 0)
      .sort((a, b) => b.e.puntaje - a.e.puntaje);
    return `<header class="barra-app" style="padding-left:18px"><h2>Recetas</h2></header>
      <div class="filtros">${comidas.map((c) => `<button class="chip ${U.comida === c ? 'activo' : ''}" data-a="comida" data-v="${c}">${c}</button>`).join('')}</div>
      <div class="desplazable" data-scroll="recetas"><div class="lista">
        ${recetas.length ? recetas.map(({ r, e }) => `<button class="receta entra" data-a="ir" data-r="receta" data-id="${r.id}">
          <span class="cabeza"><span class="emoji-grande emoji">${r.emoji}</span><span><b>${esc(r.nombre)}</b><small>${r.minutos} min · ${r.comida} · tienes ${e.tengo.length} de ${e.ing.length}</small></span></span>
          ${e.urgentes.length ? `<span class="usa">Aprovecha: ${e.urgentes.map((i) => `<strong>${esc(i.item.nombre)}</strong> (${esc(estadoVisual(i.item).texto.replace('≈ ', '').toLowerCase())})`).join(', ')}</span>` : `<span class="usa">Con lo que ya tienes en casa</span>`}
        </button>`).join('') : `<div class="vacio"><span class="emoji">🧺</span><b>Tu despensa está casi vacía</b><span>Escanea la factura de ejemplo y aparecen recetas.</span></div>`}
        <p class="detalle" style="text-align:center;font-size:12px;color:var(--a-texto-2);padding:6px 10px 0">En la app, la IA crea recetas nuevas con tu despensa y puede armarte el menú de la semana.</p>
      </div></div>`;
  }

  function pantallaAjustes() {
    const modo = S.ajustes.modo;
    const usados = Math.min(S.escaneos, LIMITE_GRATIS);
    return `<header class="barra-app" style="padding-left:18px"><h2>Ajustes</h2></header>
      <div class="desplazable" data-scroll="ajustes">
        <div class="tarjeta-ajuste"><h4>${ms('person')}Invitado</h4><p>Estás usando el simulador. En la app entras con tu correo o con Google y compartes la despensa con tu hogar usando un código.</p></div>
        <div class="tarjeta-ajuste"><h4>${ms('palette')}Apariencia</h4>
          <div class="segmentado" role="group" aria-label="Tema del simulador">
            ${[['sistema', 'Sistema'], ['claro', 'Claro'], ['oscuro', 'Oscuro']].map(([v, t]) => `<button class="${modo === v ? 'activo' : ''}" data-a="modo" data-v="${v}" aria-pressed="${modo === v}">${t}</button>`).join('')}
          </div></div>
        <div class="tarjeta-ajuste"><h4>${ms('notifications')}Avisos de vencimiento</h4>
          <p>Te avisamos estos días antes de que venza, a las 9:00 a. m.</p>
          <div class="paso-num"><button data-a="dias" data-v="-1" aria-label="Un día menos">${ms('remove')}</button><b>${S.ajustes.diasAviso}</b><span>día${S.ajustes.diasAviso === 1 ? '' : 's'} antes</span><button data-a="dias" data-v="1" aria-label="Un día más">${ms('add')}</button></div>
          <button class="boton-app tonal" data-a="probar-aviso">${ms('notifications_active')}Ver un aviso de ejemplo</button></div>
        <div class="tarjeta-ajuste"><h4>${ms('auto_awesome')}Plan gratuito</h4>
          <p>Usaste ${usados} de ${LIMITE_GRATIS} escaneos con IA de este mes. Premium no tiene límite.</p>
          <div class="barra-cupo"><span style="width:${usados / LIMITE_GRATIS * 100}%"></span></div></div>
        <div class="tarjeta-ajuste"><h4>${ms('lock')}Datos de esta demo</h4>
          <p>Todo lo que haces aquí se guarda solo en este navegador. No se envía a ningún servidor ni a la base de datos de Foodzy.</p>
          ${U.confirmarReinicio ? `<div class="confirmar"><b style="font-size:13px">¿Borrar tus cambios y volver a la despensa de ejemplo?</b>
              <div class="botonera dos" style="padding:0"><button class="boton-app borde" data-a="reinicio-no">Cancelar</button><button class="boton-app peligro" data-a="reinicio-si">Sí, reiniciar</button></div></div>`
            : `<button class="boton-app borde" data-a="reinicio">${ms('restart_alt')}Reiniciar la demo</button>`}</div>
      </div>`;
  }

  function pantallaCamara() {
    return `<div class="vista camara">
      <button class="icono-btn cerrar" data-a="atras" aria-label="Cerrar cámara">${ms('close')}</button>
      <div class="visor"><img src="img/factura-ejemplo.jpg" alt="Factura de ejemplo del Supermercado El Buen Sabor con 40 productos">
        <span class="marco"></span><span class="esquina a"></span><span class="esquina b"></span><span class="esquina c"></span><span class="esquina d"></span><span class="linea"></span></div>
      <p class="pista">Encuadra la factura completa y toma la foto</p>
      <div class="controles"><button class="lateral" data-a="solo-app" data-que="Elegir una foto de tu galería" aria-label="Galería">${ms('photo_library')}</button>
        <button class="disparador" data-a="disparar" aria-label="Tomar foto"><span></span></button>
        <button class="lateral" data-a="solo-app" data-que="El flash de la cámara" aria-label="Flash">${ms('flash_off')}</button></div>
    </div>`;
  }

  function pantallaProcesando(r) {
    return `${barraApp('Revisión de factura')}
      <div class="portada-factura"><img src="img/factura-ejemplo.jpg" alt=""></div>
      <div class="cargando"><canvas data-anim="cargando" width="72" height="72" aria-hidden="true"></canvas>
        <b>Leyendo los productos de tu factura...</b>
        <div class="progreso"><span id="sim-progreso" style="width:${r.progreso || 0}%"></span></div>
        <small id="sim-paso">${esc(r.paso || 'Enviando la foto')}</small></div>`;
  }

  function pantallaRevision(r) {
    const total = r.items.reduce((s, i) => s + i.precio, 0);
    return `${barraApp('Revisión de factura')}
      <div class="desplazable" data-scroll="revision">
        <div class="portada-factura"><img src="img/factura-ejemplo.jpg" alt="Factura de ejemplo"></div>
        <div class="resumen-lectura">${ms('auto_awesome')}<span>Leí <b>${r.items.length} productos</b> de ${esc(FACTURA_EJEMPLO.tienda)} por <b>${pesos(total)}</b>. Revisa y toca lo que quieras cambiar.</span></div>
        <div class="lista">${r.items.map((it, i) => {
          const a = itemComoAlimento(it);
          const e = estadoVisual(a);
          const u = UBICACIONES[it.ubicacion];
          return `<div class="detectado">${foto(a, 46)}
            <div class="cuerpo"><span class="titulo">${esc(it.nombre)}</span><span class="detalle">${esc(it.categoria)} · ${esc(cantidad(a))}</span>
              <div class="fila-chips">
                <button class="chip-mini fecha" style="--c:${e.c}" data-a="fecha-item" data-i="${i}">${ms(e.ico)}${esc(e.texto)}</button>
                <button class="chip-mini" data-a="ubic-item" data-i="${i}" title="Cambiar dónde se guarda"><span class="emoji">${u.emoji}</span>${u.nombre}</button>
                <span class="chip-mini" style="cursor:default">${pesos(it.precio)}</span>
              </div></div>
            <button class="quitar" data-a="quitar-item" data-i="${i}" aria-label="Quitar ${esc(it.nombre)}">${ms('close')}</button></div>`;
        }).join('')}</div>
      </div>
      <div class="pie-accion"><button class="boton-app" data-a="guardar-factura" ${r.items.length ? '' : 'disabled'}>${ms('check')}Guardar ${r.items.length} alimentos</button></div>`;
  }

  function pantallaDetalle(a) {
    if (!a) return barraApp('Alimento') + `<div class="vacio"><b>Este alimento ya no está.</b></div>`;
    const u = a.ubicacion ? UBICACIONES[a.ubicacion] : null;
    const origen = a.noVence ? '' : a.origen === 'estimada' ? ' (estimada)' : a.origen === 'leida' ? ' (leída del empaque)' : '';
    const disp = a.estado === 'disponible';
    return `${barraApp('Detalle')}
      <div class="desplazable" data-scroll="detalle-${esc(a.id)}">
        <div class="detalle-cabeza">${foto(a, 88)}<h3>${esc(a.nombre)}</h3>${chipEstado(a)}</div>
        <div class="datos">
          <div class="dato">${ms('scale')}<span>Cantidad</span><b>${esc(cantidad(a))}</b></div>
          <div class="dato">${ms('event')}<span>Vencimiento</span><b>${a.noVence ? 'No vence' : a.vence ? esc(fechaCorta(a.vence) + origen) : 'Sin fecha'}</b></div>
          <div class="dato">${ms('kitchen')}<span>Se guarda en</span><b>${u ? `<span class="emoji">${u.emoji}</span> ${u.nombre}` : '—'}</b></div>
          <div class="dato">${ms('category')}<span>Categoría</span><b>${esc(a.categoria)}</b></div>
          ${a.precio ? `<div class="dato">${ms('payments')}<span>Precio</span><b>${pesos(a.precio)}</b></div>` : ''}
        </div>
        <div class="botonera">
          ${disp ? `<button class="boton-app" data-a="consumir" data-id="${esc(a.id)}">${ms('restaurant')}Me lo comí todo</button>
          <div class="dos"><button class="boton-app tonal" data-a="parte" data-id="${esc(a.id)}">${ms('remove_circle')}Una parte</button>
            <button class="boton-app tonal" data-a="fecha-alimento" data-id="${esc(a.id)}">${ms('edit_calendar')}Fecha</button></div>` : ''}
          ${a.factura ? `<button class="boton-app borde" data-a="ver-factura">${ms('receipt_long')}Ver factura</button>` : ''}
          ${disp ? `<button class="boton-app peligro" data-a="desechar" data-id="${esc(a.id)}">${ms('delete')}Desechar</button>` : ''}
        </div>
      </div>`;
  }

  function pantallaHistorial() {
    const h = S.alimentos.filter((a) => a.estado !== 'disponible').sort((a, b) => (b.cierre || '').localeCompare(a.cierre || ''));
    return `${barraApp('Historial')}
      <div class="desplazable" data-scroll="historial">
        ${h.length ? `<div class="lista">${h.map(tarjeta).join('')}</div>` : `<div class="vacio"><span class="emoji">📭</span><b>Aún no hay historial</b><span>Lo que consumas o deseches aparece aquí.</span></div>`}
      </div>`;
  }

  function pantallaReceta(id) {
    const r = RECETAS.find((x) => x.id === id);
    const e = evaluar(r);
    const faltan = e.ing.filter((i) => !i.item);
    return `${barraApp(r.nombre)}
      <div class="desplazable" data-scroll="receta-${id}">
        <div class="detalle-cabeza"><span class="foto-alimento" style="width:88px;height:88px"><span class="emoji" style="font-size:46px">${r.emoji}</span></span>
          <span class="estado" style="--c:var(--a-primario)">${ms('timer')}${r.minutos} min · ${r.comida}</span></div>
        <div class="tarjeta-ajuste"><h4>${ms('shopping_basket')}Ingredientes</h4><div>
          ${e.ing.map((i) => `<div class="ingrediente">${i.item ? ms('check_circle', 'lleno tengo') : ms('radio_button_unchecked', 'falta')}<span>${esc(i.texto)}</span>
            <small>${i.item ? esc(estadoVisual(i.item).texto) : 'No lo tienes'}</small></div>`).join('')}
        </div></div>
        <div class="tarjeta-ajuste"><h4>${ms('menu_book')}Preparación</h4><ol class="pasos-receta">${r.pasos.map((p) => `<li>${esc(p)}</li>`).join('')}</ol></div>
        <div class="botonera">
          <button class="boton-app" data-a="cocinar" data-id="${id}">${ms('skillet')}Cocinar y descontar de la despensa</button>
          ${faltan.length ? `<button class="boton-app tonal" data-a="faltantes" data-id="${id}">${ms('add_shopping_cart')}Agregar ${faltan.length} a la lista de compras</button>` : ''}
        </div>
      </div>`;
  }

  function pantallaLista() {
    const items = [...S.lista].sort((a, b) => a.comprado - b.comprado);
    const comprados = S.lista.some((i) => i.comprado);
    return `${barraApp('Lista de compras', comprados ? `<button class="enlace-app" data-a="limpiar-lista">Limpiar</button>` : '')}
      <form class="agregar" data-form="lista"><input id="sim-nuevo" placeholder="¿Qué hace falta?" autocomplete="off" aria-label="Producto para la lista"><button type="submit" aria-label="Agregar">${ms('add')}</button></form>
      <div class="desplazable" data-scroll="lista"><div class="lista">
        ${items.length ? items.map((i) => `<div class="renglon-lista ${i.comprado ? 'hecho' : ''}">
          <button class="caja" data-a="tachar" data-id="${esc(i.id)}" aria-label="${i.comprado ? 'Desmarcar' : 'Marcar como comprado'} ${esc(i.nombre)}">${i.comprado ? ms('check') : ''}</button>
          <span class="texto">${esc(i.nombre)}${i.porFactura ? '<small>Tachado al escanear la factura</small>' : ''}</span>
          <button class="quitar" data-a="borrar-lista" data-id="${esc(i.id)}" aria-label="Quitar ${esc(i.nombre)}">${ms('close')}</button></div>`).join('')
          : `<div class="vacio"><span class="emoji">🛒</span><b>Tu lista está vacía</b><span>Agrega lo que haga falta o pásalo desde una receta.</span></div>`}
      </div></div>`;
  }

  function pantallaNumeros() {
    const suma = (f) => S.alimentos.filter(f).reduce((s, a) => s + (a.precio || 0), 0);
    const despensa = suma((a) => a.estado === 'disponible');
    const comido = suma((a) => a.estado === 'consumido');
    const botado = suma((a) => a.estado === 'desechado');
    const enRiesgo = suma((a) => venceEn(a, 3));
    const porCat = {};
    S.alimentos.forEach((a) => { porCat[a.categoria] = (porCat[a.categoria] || 0) + (a.precio || 0); });
    const top = Object.entries(porCat).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const max = top.length ? top[0][1] : 1;
    return `${barraApp('Tus números')}
      <div class="desplazable" data-scroll="numeros">
        <div class="numeros">
          <div class="numero"><span>En tu despensa</span><b>${pesos(despensa)}</b></div>
          <div class="numero"><span>En riesgo (vence en 3 días)</span><b style="color:var(--e-hoy)">${pesos(enRiesgo)}</b></div>
          <div class="numero"><span>Aprovechado</span><b style="color:var(--a-primario)">${pesos(comido)}</b></div>
          <div class="numero"><span>Botado</span><b style="color:var(--e-vencido)">${pesos(botado)}</b></div>
        </div>
        <div class="titulo-bloque" style="margin:18px 18px 8px"><h3>En qué gastas</h3></div>
        <div class="barras">${top.map(([c, v]) => `<div class="barra-cat"><span>${esc(c)}</span><span class="riel"><span style="width:${v / max * 100}%"></span></span><b>${pesos(v)}</b></div>`).join('')}</div>
      </div>`;
  }

  // ── Escaneo de la factura de ejemplo ───────────────────────────────────
  function itemsDeFactura() {
    return FACTURA_EJEMPLO.productos.map(([nombre, categoria, emoji, cant, unidad, precio, ubicacion, dias]) =>
      ({ nombre, categoria, emoji, cantidad: cant, unidad, precio, ubicacion, dias, fechaManual: null }));
  }
  function itemComoAlimento(it) {
    const noVence = it.dias === null && !it.fechaManual;
    return {
      nombre: it.nombre, categoria: it.categoria, emoji: it.emoji, cantidad: it.cantidad, unidad: it.unidad,
      precio: it.precio, ubicacion: it.ubicacion, estado: 'disponible', noVence,
      vence: it.fechaManual || (noVence ? null : enDias(it.dias[UBICACIONES[it.ubicacion].i])),
      origen: it.fechaManual ? 'manual' : 'estimada',
    };
  }

  let temporizadorEscaneo = null;
  function escanear() {
    if (S.escaneos >= LIMITE_GRATIS) {
      U.hoja = { tipo: 'cupo' };
      return render();
    }
    const r = { r: 'procesando', progreso: 0, paso: 'Enviando la foto' };
    U.rutas[U.rutas.length - 1] = r; // la cámara se cierra al tomar la foto
    render();
    const pasos = [[18, 'Leyendo los renglones del ticket'], [45, 'Reconociendo cada producto'], [72, 'Estimando cuándo vence cada uno'], [92, 'Eligiendo dónde se guarda'], [100, 'Listo']];
    let i = 0;
    clearInterval(temporizadorEscaneo);
    temporizadorEscaneo = setInterval(() => {
      if (ruta() !== r) { clearInterval(temporizadorEscaneo); return; }
      const [p, texto] = pasos[i++];
      r.progreso = p; r.paso = texto;
      const barra = document.getElementById('sim-progreso');
      const paso = document.getElementById('sim-paso');
      if (barra) barra.style.width = p + '%';
      if (paso) paso.textContent = texto;
      if (i === pasos.length) {
        clearInterval(temporizadorEscaneo);
        setTimeout(() => {
          if (ruta() !== r) return;
          U.rutas[U.rutas.length - 1] = { r: 'revision', items: itemsDeFactura() };
          render();
        }, 350);
      }
    }, 700);
  }

  function guardarFactura(r) {
    const base = Date.now();
    const nuevos = r.items.map((it, n) => {
      const a = itemComoAlimento(it);
      return { ...a, id: `f${base}-${n}`, cierre: null, factura: true, compra: iso(hoy()) };
    });
    S.alimentos.push(...nuevos);
    S.escaneos += 1;
    // Lo que estaba en la lista y se compró, se tacha solo.
    const claves = new Set(nuevos.map((a) => clave(a.nombre)));
    let tachados = 0;
    S.lista.forEach((i) => {
      if (!i.comprado && claves.has(clave(i.nombre))) { i.comprado = true; i.porFactura = true; tachados++; }
    });
    guardar();
    U.rutas = [];
    U.pestana = 'despensa';
    U.filtro = 'todos'; U.ubic = null; U.busqueda = '';
    mostrarSnack(`Se guardaron ${nuevos.length} alimentos${tachados ? ` y se tacharon ${tachados} de tu lista` : ''}.`);
    render();
    // El primer aviso que mandaría la app con esta compra.
    const primero = nuevos.filter((a) => a.vence).sort((a, b) => urgencia(a) - urgencia(b))[0];
    if (primero) setTimeout(() => avisar(primero), 2200);
  }

  // ── Acciones sobre alimentos (con deshacer, como en la app) ────────────
  function conDeshacer(texto) {
    const antes = JSON.stringify(S.alimentos);
    return () => mostrarSnack(texto, 'Deshacer', () => { S.alimentos = JSON.parse(antes); guardar(); render(); });
  }
  function cerrar(a, estado) {
    const ofrecerDeshacer = conDeshacer(estado === 'consumido' ? `Marcaste ${a.nombre} como consumido.` : `${a.nombre} pasó al historial como desechado.`);
    a.estado = estado; a.cierre = iso(hoy());
    guardar(); U.rutas.pop(); ofrecerDeshacer(); render();
  }
  function consumirParte(a) {
    const paso = a.unidad === 'u' ? 1 : a.unidad === 'kg' || a.unidad === 'L' ? 0.25 : Math.max(a.cantidad / 4, 1);
    const ofrecerDeshacer = conDeshacer('');
    const resto = Math.round((a.cantidad - paso) * 100) / 100;
    if (resto <= 0.001) { a.estado = 'consumido'; a.cierre = iso(hoy()); U.rutas.pop(); }
    else a.cantidad = resto;
    guardar();
    U.snack = null;
    ofrecerDeshacer();
    U.snack.texto = resto <= 0.001 ? `Se acabó ${a.nombre}: pasó al historial.` : `Quedan ${num(resto)} ${a.unidad} de ${a.nombre}.`;
    render();
  }
  function cocinar(r) {
    const e = evaluar(r);
    if (!e.tengo.length) return mostrarSnack('No tienes ningún ingrediente de esta receta.');
    const ofrecerDeshacer = conDeshacer('');
    e.tengo.forEach(({ item: a }) => {
      const usa = a.unidad === 'u' ? (a.cantidad > 1 ? 1 : a.cantidad) : Math.min(0.25, a.cantidad);
      const resto = Math.round((a.cantidad - usa) * 100) / 100;
      if (resto <= 0.001) { a.estado = 'consumido'; a.cierre = iso(hoy()); } else a.cantidad = resto;
    });
    guardar();
    U.rutas.pop();
    ofrecerDeshacer();
    U.snack.texto = `¡Buen provecho! Se descontó de tu despensa: ${e.tengo.map((i) => i.item.nombre).join(', ')}.`;
    render();
  }

  // ── Capas ──────────────────────────────────────────────────────────────
  let temporizadorSnack = null;
  function mostrarSnack(texto, accion = null, alTocar = null) {
    U.snack = { texto, accion, alTocar };
    clearTimeout(temporizadorSnack);
    temporizadorSnack = setTimeout(() => { U.snack = null; pintarCapas(); }, 4800);
    pintarCapas();
  }
  let temporizadorNotif = null;
  function avisar(a) {
    const e = estadoVisual(a);
    const cuando = e.texto.replace('≈ ', '').toLowerCase();
    U.notif = a.origen === 'estimada'
      ? { id: a.id, titulo: `⏰ ${a.nombre} podría estar por vencerse`, texto: `Según lo estimado, ${cuando}. Toca para confirmarlo.` }
      : { id: a.id, titulo: `⏰ ${a.nombre} está por vencerse`, texto: `${cuando[0].toUpperCase()}${cuando.slice(1)}. Toca para decidir qué hacer con él.` };
    clearTimeout(temporizadorNotif);
    temporizadorNotif = setTimeout(() => { U.notif = null; pintarCapas(); }, 6500);
    pintarCapas();
  }

  function hojaHtml() {
    const h = U.hoja;
    if (!h) return '';
    let dentro = '';
    if (h.tipo === 'anadir') {
      dentro = `<h3>¿Qué quieres hacer?</h3>
        <button class="opcion" data-a="camara"><img class="miniatura" src="img/factura-ejemplo.jpg" alt=""><span><b>Escanear factura</b><small>Prueba con la factura de ejemplo: 40 productos</small></span></button>
        ${[['shopping_basket', 'Foto de mi compra', 'Reconoce cada alimento y recorta su foto'], ['qr_code_scanner', 'Código de barras', 'Escanea varios productos seguidos'], ['outbox', 'Sacar comida', 'Muestra lo que sacaste y se descuenta solo'], ['edit', 'Ingreso manual', 'Escribe el alimento tú mismo']]
          .map(([ico, t, d]) => `<button class="opcion" disabled><span class="ico">${ms(ico)}</span><span><b>${t}</b><small>${d}</small></span><span class="marca-app">En la app</span></button>`).join('')}`;
    } else if (h.tipo === 'fecha') {
      const actual = h.valor || enDias(7);
      dentro = `<h3>Fecha de vencimiento</h3>
        <p style="font-size:13px;color:var(--a-texto-2);margin-bottom:12px">${esc(h.nombre)}. En la app también puedes fotografiar la fecha impresa y la IA la lee.</p>
        <label style="display:grid;gap:6px;font-size:13px;font-weight:600">Vence el
          <input id="sim-fecha" type="date" value="${actual}" min="${enDias(-30)}" style="height:48px;border-radius:14px;border:1px solid var(--a-borde);background:var(--a-sup);color:var(--a-texto);padding:0 12px;font:inherit"></label>
        <div class="botonera" style="padding:14px 0 0"><button class="boton-app" data-a="fecha-ok">Guardar fecha</button>
          <button class="boton-app borde" data-a="fecha-nunca">No vence</button></div>`;
    } else if (h.tipo === 'factura') {
      dentro = `<h3>Factura</h3><img src="img/factura-ejemplo.jpg" alt="Factura de ejemplo del Supermercado El Buen Sabor" style="border-radius:12px;width:100%">`;
    } else if (h.tipo === 'solo-app') {
      dentro = `<h3>Esto lo pruebas en la app</h3><p style="font-size:13.5px;color:var(--a-texto-2)">${esc(h.que)} usa la cámara de tu celular, así que no está en el simulador. Aquí puedes escanear la factura de ejemplo.</p>
        <div class="botonera" style="padding:14px 0 0"><button class="boton-app" data-a="camara">${ms('receipt_long')}Escanear la factura de ejemplo</button></div>`;
    } else if (h.tipo === 'cupo') {
      dentro = `<h3>Usaste tus ${LIMITE_GRATIS} escaneos gratis</h3><p style="font-size:13.5px;color:var(--a-texto-2)">Así funciona el plan gratuito de la app: ${LIMITE_GRATIS} usos de IA al mes; Premium no tiene límite. En esta demo puedes reiniciar todo desde Ajustes.</p>
        <div class="botonera" style="padding:14px 0 0"><button class="boton-app" data-a="pestana" data-p="ajustes">Ir a Ajustes</button></div>`;
    }
    return `<div class="velo" data-a="cerrar-hoja"></div><div class="hoja" role="dialog" aria-modal="true"><div class="asa"></div>${dentro}</div>`;
  }

  function pintarCapas() {
    const capas = raiz.querySelector('#sim-capas');
    if (!capas) return;
    const conNav = !U.rutas.length;
    capas.innerHTML = hojaHtml()
      + (U.snack ? `<div class="snack ${conNav ? '' : 'sin-nav'}" role="status"><span>${esc(U.snack.texto)}</span>${U.snack.accion ? `<button data-a="snack">${esc(U.snack.accion)}</button>` : ''}</div>` : '')
      + (U.notif ? `<button class="notificacion" data-a="abrir-notif"><img src="img/icono-64.png" alt=""><span><span class="app-nombre">Foodzy · ahora</span><b>${esc(U.notif.titulo)}</b><p>${esc(U.notif.texto)}</p></span></button>` : '');
  }

  // ── Pintar ─────────────────────────────────────────────────────────────
  const raiz = document.getElementById('app');
  const scrolls = {};

  function render() {
    const actual = raiz.querySelector('.desplazable');
    if (actual) scrolls[actual.dataset.scroll] = actual.scrollTop;
    const enfocado = document.activeElement && raiz.contains(document.activeElement) ? document.activeElement.id : null;

    raiz.dataset.modo = S.ajustes.modo;
    const r = ruta();
    let html;
    let oscuro = false;
    if (!r) {
      html = `<div class="vista con-nav">${{ inicio: pantallaInicio, despensa: pantallaDespensa, recetas: pantallaRecetas, ajustes: pantallaAjustes }[U.pestana]()}</div>
        ${U.pestana === 'inicio' ? `<button class="fab ${S.escaneos ? '' : 'fab-pulso'}" data-a="hoja-anadir">${ms('add_a_photo')}Escanear</button>` : ''}
        ${U.pestana === 'despensa' ? `<button class="fab solo-icono" data-a="hoja-anadir" aria-label="Escanear">${ms('add_a_photo')}</button>` : ''}
        <nav class="nav-inferior" aria-label="Secciones de la app">${[['inicio', 'home', 'Inicio'], ['despensa', 'kitchen', 'Despensa'], ['recetas', 'restaurant_menu', 'Recetas'], ['ajustes', 'tune', 'Ajustes']]
          .map(([p, ico, t]) => `<button class="${U.pestana === p ? 'activo' : ''}" data-a="pestana" data-p="${p}" aria-current="${U.pestana === p ? 'page' : 'false'}"><span class="pildora">${ms(ico)}</span>${t}</button>`).join('')}</nav>`;
    } else if (r.r === 'camara') { html = pantallaCamara(); oscuro = true; }
    else {
      const cuerpo = {
        procesando: () => pantallaProcesando(r),
        revision: () => pantallaRevision(r),
        detalle: () => pantallaDetalle(porId(r.id)),
        historial: pantallaHistorial,
        receta: () => pantallaReceta(r.id),
        lista: pantallaLista,
        numeros: pantallaNumeros,
      }[r.r]();
      html = `<div class="vista">${cuerpo}</div>`;
    }
    raiz.innerHTML = `${html}<div class="barra-estado ${oscuro ? 'sobre-oscuro' : ''}"><span id="sim-hora">${hora()}</span><span class="isla"></span>
      <span class="iconos">${ms('signal_cellular_alt')}${ms('wifi')}${ms('battery_full')}</span></div><div id="sim-capas"></div>`;

    const nuevo = raiz.querySelector('.desplazable');
    if (nuevo && scrolls[nuevo.dataset.scroll]) nuevo.scrollTop = scrolls[nuevo.dataset.scroll];
    if (enfocado) { const el = document.getElementById(enfocado); if (el) { el.focus(); if (el.setSelectionRange && el.value) el.setSelectionRange(el.value.length, el.value.length); } }
    pintarCapas();
    animar();
  }
  const hora = () => { const d = new Date(); return `${d.getHours()}:${pad(d.getMinutes())}`; };
  setInterval(() => { const h = document.getElementById('sim-hora'); if (h) h.textContent = hora(); }, 20000);

  // ── Eventos ────────────────────────────────────────────────────────────
  raiz.addEventListener('click', (ev) => {
    const el = ev.target.closest('[data-a]');
    if (!el || !raiz.contains(el) || el.disabled) return;
    const d = el.dataset;
    const r = ruta();
    switch (d.a) {
      case 'pestana': U.pestana = d.p; U.rutas = []; U.hoja = null; U.confirmarReinicio = false; break;
      case 'atras': clearInterval(temporizadorEscaneo); U.rutas.pop(); break;
      case 'ir': U.rutas.push({ r: d.r, id: d.id }); break;
      case 'detalle': U.rutas.push({ r: 'detalle', id: d.id }); break;
      case 'hoja-anadir': U.hoja = { tipo: 'anadir' }; return pintarCapas();
      case 'cerrar-hoja': U.hoja = null; return pintarCapas();
      case 'camara': U.hoja = null; U.rutas.push({ r: 'camara' }); break;
      case 'disparar': return escanear();
      case 'solo-app': U.hoja = { tipo: 'solo-app', que: d.que }; return pintarCapas();
      case 'filtro': U.filtro = d.v; break;
      case 'ubic': U.ubic = U.ubic === d.v ? null : d.v; break;
      case 'comida': U.comida = d.v; break;
      case 'limpiar-busqueda': U.busqueda = ''; break;
      case 'quitar-item': r.items.splice(+d.i, 1); break;
      case 'ubic-item': {
        const it = r.items[+d.i];
        it.ubicacion = ORDEN_UBIC[(UBICACIONES[it.ubicacion].i + 1) % 3];
        it.fechaManual = null; // se vuelve a estimar para el nuevo lugar
        break;
      }
      case 'fecha-item': {
        const it = r.items[+d.i];
        U.hoja = { tipo: 'fecha', item: +d.i, nombre: it.nombre, valor: itemComoAlimento(it).vence };
        return pintarCapas();
      }
      case 'fecha-alimento': {
        const a = porId(d.id);
        U.hoja = { tipo: 'fecha', id: a.id, nombre: a.nombre, valor: a.vence };
        return pintarCapas();
      }
      case 'fecha-ok':
      case 'fecha-nunca': {
        const h = U.hoja;
        const valor = d.a === 'fecha-ok' ? (document.getElementById('sim-fecha')?.value || null) : null;
        if (d.a === 'fecha-ok' && !valor) return;
        if (h.item !== undefined) {
          const it = r.items[h.item];
          if (valor) { it.fechaManual = valor; } else { it.fechaManual = null; it.dias = null; }
        } else {
          const a = porId(h.id);
          a.vence = valor; a.noVence = !valor; a.origen = 'manual';
          guardar();
        }
        U.hoja = null;
        break;
      }
      case 'guardar-factura': return guardarFactura(r);
      case 'ver-factura': U.hoja = { tipo: 'factura' }; return pintarCapas();
      case 'consumir': return cerrar(porId(d.id), 'consumido');
      case 'desechar': return cerrar(porId(d.id), 'desechado');
      case 'parte': return consumirParte(porId(d.id));
      case 'cocinar': return cocinar(RECETAS.find((x) => x.id === d.id));
      case 'faltantes': {
        const e = evaluar(RECETAS.find((x) => x.id === d.id));
        const nuevos = e.ing.filter((i) => !i.item && !S.lista.some((l) => !l.comprado && clave(l.nombre) === clave(i.texto)));
        nuevos.forEach((i) => S.lista.push({ id: nuevoId(), nombre: i.texto, comprado: false, porFactura: false }));
        guardar();
        mostrarSnack(nuevos.length ? `Se agregaron ${nuevos.length} a tu lista de compras.` : 'Eso ya estaba en tu lista.');
        break;
      }
      case 'tachar': { const i = S.lista.find((x) => x.id === d.id); i.comprado = !i.comprado; i.porFactura = false; guardar(); break; }
      case 'borrar-lista': S.lista = S.lista.filter((x) => x.id !== d.id); guardar(); break;
      case 'limpiar-lista': S.lista = S.lista.filter((x) => !x.comprado); guardar(); break;
      case 'modo': S.ajustes.modo = d.v; guardar(); break;
      case 'dias': S.ajustes.diasAviso = Math.min(7, Math.max(1, S.ajustes.diasAviso + +d.v)); guardar(); break;
      case 'probar-aviso': {
        const a = disponibles().filter((x) => x.vence && !x.noVence).sort((x, y) => urgencia(x) - urgencia(y)).find((x) => diasHasta(x.vence) >= 0);
        if (a) avisar(a); else mostrarSnack('No hay nada por vencer para avisarte.');
        return;
      }
      case 'reinicio': U.confirmarReinicio = true; break;
      case 'reinicio-no': U.confirmarReinicio = false; break;
      case 'reinicio-si':
        S = estadoInicial(); guardar(); U.confirmarReinicio = false; U.rutas = []; U.pestana = 'inicio';
        mostrarSnack('Listo: la demo volvió a la despensa de ejemplo.');
        break;
      case 'snack': { const f = U.snack?.alTocar; U.snack = null; if (f) f(); else pintarCapas(); return; }
      case 'abrir-notif': {
        const id = U.notif?.id; U.notif = null;
        if (id && porId(id)) { U.hoja = null; U.rutas = [{ r: 'detalle', id }]; }
        break;
      }
      default: return;
    }
    render();
  });

  raiz.addEventListener('input', (ev) => {
    if (ev.target.id === 'sim-busqueda') {
      U.busqueda = ev.target.value;
      const lista = raiz.querySelector('.desplazable');
      const items = filtrar();
      lista.innerHTML = items.length ? `<div class="lista">${items.map(tarjeta).join('')}</div>`
        : `<div class="vacio"><span class="emoji">🔎</span><b>No encontré "${esc(U.busqueda)}"</b><span>Busca por nombre o por categoría, con o sin tildes.</span></div>`;
    }
  });
  raiz.addEventListener('submit', (ev) => {
    ev.preventDefault();
    if (ev.target.dataset.form === 'lista') {
      const campo = document.getElementById('sim-nuevo');
      const nombre = campo.value.trim();
      if (!nombre) return;
      if (S.lista.some((i) => !i.comprado && clave(i.nombre) === clave(nombre))) {
        mostrarSnack(`${nombre} ya está en tu lista.`);
      } else {
        S.lista.unshift({ id: nuevoId(), nombre, comprado: false, porFactura: false });
        guardar();
      }
      render();
      document.getElementById('sim-nuevo')?.focus();
    }
  });
  raiz.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && U.hoja) { U.hoja = null; pintarCapas(); }
  });

  // ── Animaciones: la cascada de Inicio y el indicador de carga ──────────
  const formas = Object.fromEntries(Object.entries(SILUETAS).map(([k, d]) => [k, new Path2D(d)]));
  const comida = Object.keys(formas).filter((k) => k !== 'corona');
  const sinMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)');
  let visible = true;
  let cuadro = null;

  function prepararCanvas(c) {
    const r = c.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(r.width * dpr), h = Math.round(r.height * dpr);
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    return { ctx: c.getContext('2d'), w: r.width, h: r.height, dpr };
  }

  // Columnas de siluetas que caen, como el encabezado de la app.
  const rejillas = new WeakMap();
  function dibujarCascada(c, t) {
    const { ctx, w, h, dpr } = prepararCanvas(c);
    if (!w || !h) return;
    let g = rejillas.get(c);
    if (!g || g.w !== w) {
      let semilla = 7;
      const azar = () => { semilla = (semilla * 16807) % 2147483647; return semilla / 2147483647; };
      const celda = 46, cols = Math.max(1, Math.round(w / celda)), filas = Math.ceil((h + celda) / celda) + 1;
      g = { w, celda, cols, largo: filas * celda, vel: [], s: [] };
      for (let i = 0; i < cols; i++) g.vel.push(7 + azar() * 9);
      for (let i = 0; i < cols; i++) {
        const inicio = Math.floor(azar() * comida.length);
        for (let f = 0; f < filas; f++) {
          g.s.push({ forma: formas[comida[(inicio + f * 7) % comida.length]], col: i, dx: 0.5 + (azar() - 0.5) * 0.3,
            y0: f * celda + azar() * celda * 0.3 + (i % 2 ? celda / 2 : 0), tam: celda * (0.4 + azar() * 0.4), giro: (azar() - 0.5) * 1.2, fase: azar() * 6.28 });
        }
      }
      rejillas.set(c, g);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = getComputedStyle(raiz).getPropertyValue('--a-silueta').trim() || 'rgba(21,128,61,.3)';
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const ancho = w / g.cols;
    for (const s of g.s) {
      const y = ((s.y0 + t * g.vel[s.col]) % g.largo) - g.celda;
      ctx.save();
      ctx.translate((s.col + s.dx) * ancho, y);
      ctx.rotate(s.giro + Math.sin(t * 0.35 + s.fase) * 0.18);
      ctx.scale(s.tam, s.tam);
      ctx.translate(-0.5, -0.5);
      ctx.lineWidth = 1.8 / s.tam;
      ctx.stroke(s.forma);
      ctx.restore();
    }
  }

  // Una silueta gira como moneda y, de canto, cambia al siguiente alimento.
  function dibujarCargando(c, t) {
    const { ctx, w, h, dpr } = prepararCanvas(c);
    const ciclo = 1.4, quieto = 0.35;
    const vuelta = Math.floor(t / ciclo), p = (t % ciclo) / ciclo;
    const giro = p < quieto ? 0 : (p - quieto) / (1 - quieto);
    const indice = (vuelta + (giro > 0.5 ? 1 : 0)) % comida.length;
    const escalaX = Math.abs(Math.cos(giro * Math.PI));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = getComputedStyle(raiz).getPropertyValue('--a-primario').trim();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.translate(w / 2, h / 2);
    ctx.scale(Math.max(escalaX, 0.02) * w * 0.8, h * 0.8);
    ctx.translate(-0.5, -0.5);
    ctx.lineWidth = 3 / (w * 0.8);
    ctx.stroke(formas[comida[indice]]);
  }

  const inicioAnim = performance.now();
  function animar() {
    if (cuadro) return;
    const paso = (ahora) => {
      cuadro = null;
      const lienzos = raiz.querySelectorAll('canvas[data-anim]');
      if (!lienzos.length) return;
      const t = sinMovimiento.matches ? 4 : (ahora - inicioAnim) / 1000;
      lienzos.forEach((c) => (c.dataset.anim === 'cascada' ? dibujarCascada(c, t) : dibujarCargando(c, t)));
      if (visible && !sinMovimiento.matches && !document.hidden) cuadro = requestAnimationFrame(paso);
    };
    cuadro = requestAnimationFrame(paso);
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) animar(); });

  // El teléfono se escala para caber en la pantalla, y no anima si no se ve.
  const escala = document.getElementById('telefono-escala');
  function ajustarEscala() {
    const ancho = escala.parentElement.clientWidth;
    const alto = window.innerHeight - 96;
    const e = Math.min(1, ancho / 384, Math.max(0.7, alto / 780));
    escala.style.setProperty('--escala', e.toFixed(3));
  }
  ajustarEscala();
  window.addEventListener('resize', ajustarEscala);
  if ('IntersectionObserver' in window) {
    let primerAviso = false;
    new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible) animar();
      // La primera vez que se ve el teléfono, llega un aviso como los de la app.
      if (visible && !primerAviso) {
        primerAviso = true;
        setTimeout(() => {
          const a = disponibles().filter((x) => x.vence && !x.noVence && diasHasta(x.vence) >= 0).sort((x, y) => urgencia(x) - urgencia(y))[0];
          if (a && !U.notif && !U.rutas.length) avisar(a);
        }, 2600);
      }
    }, { threshold: 0.3 }).observe(escala);
  }

  // La página puede abrir el escáner desde sus botones.
  window.foodzySimulador = {
    escanear() { U.hoja = null; U.rutas = [{ r: 'camara' }]; render(); },
    inicio() { U.rutas = []; U.pestana = 'inicio'; render(); },
  };

  render();
})();
