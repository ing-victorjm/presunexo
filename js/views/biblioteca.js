// biblioteca.js — Biblioteca técnica de consulta: rendimientos, desperdicios,
// dosificaciones, acero, muros y producción de equipos (js/data/biblioteca.js).
// El botón «Usar» copia un rendimiento de referencia a una partida del presupuesto.
import * as store from '../core/store.js';
import { arbolPlano, itemPorId } from '../core/calc.js';
import { fmtNum, round2 } from '../core/fmt.js';
import { el, icono, modal, toast } from '../ui/components.js';
import { RENDIMIENTOS, DESPERDICIOS, DOSIFICACIONES_CONCRETO, MORTEROS,
         ACEROS, ACERO_REGLAS, MUROS_LADRILLO, TARRAJEOS, ESPONJAMIENTO,
         EQUIPOS_PRODUCCION, FLOTA_DEFAULTS, CARGUIO } from '../data/biblioteca.js';

// --- Estado de UI (a nivel de módulo, nunca en el store) --------------------
let tab = 'rend';       // 'rend' | 'desp' | 'dosif' | 'acero' | 'equipos'
let q = '';             // búsqueda global de la vista (filtra todas las secciones)
let raiz = null;
let enfocarBusqueda = false;

const TABS = [
  { id: 'rend', label: 'Rendimientos' },
  { id: 'desp', label: 'Desperdicios' },
  { id: 'dosif', label: 'Dosificaciones' },
  { id: 'acero', label: 'Acero y muros' },
  { id: 'equipos', label: 'Equipos' },
];

function rerender() {
  if (!raiz) return;
  raiz.replaceChildren();
  render(raiz);
}

// --- Helpers de formato ------------------------------------------------------
const norm = s => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const und2 = u => ({ m2: 'm²', m3: 'm³' }[u] || u || '—');

// Número con decimales significativos (máx. maxDec), formato es-PE.
function fmtQ(v, maxDec = 3) {
  const n = Number(v);
  if (v == null || !isFinite(n)) return '—';
  const fijo = n.toFixed(maxDec).replace(/0+$/, '').replace(/\.$/, '');
  const dec = (fijo.split('.')[1] || '').length;
  return fmtNum(n, dec);
}

// {cap:0.1, op:1, pe:0.5} → "0.1 cap + 1 op + 0.5 pe"
function fmtCuadrilla(c = {}) {
  const partes = [];
  for (const k of ['cap', 'op', 'of', 'pe']) if (c[k]) partes.push(`${fmtQ(c[k])} ${k}`);
  return partes.length ? partes.join(' + ') : '—';
}

// --- Fichas de la flota de eliminación --------------------------------------
const FLOTA_FICHAS = [
  { k: 'capacidad_volquete_m3', et: 'Capacidad nominal', un: 'm³', sub: 'Volquete de eliminación estándar' },
  { k: 'capacidad_util_m3', et: 'Capacidad útil', un: 'm³', sub: 'Colmada real de material suelto' },
  { k: 'velocidad_cargado_kmh', et: 'Velocidad cargado', un: 'km/h', sub: 'Ida al botadero por vía urbana' },
  { k: 'velocidad_vacio_kmh', et: 'Velocidad vacío', un: 'km/h', sub: 'Retorno al frente de carguío' },
  { k: 'tiempo_descarga_min', et: 'Tiempo de descarga', un: 'min', sub: 'Descarga y maniobras en botadero' },
  { k: 'tiempo_acomodo_min', et: 'Tiempo de acomodo', un: 'min', sub: 'Posicionamiento bajo el cucharón' },
  { k: 'eficiencia_jornada', et: 'Eficiencia de jornada', un: '', sub: `≈ ${fmtNum(FLOTA_DEFAULTS.eficiencia_jornada * 60, 0)} min efectivos por hora` },
  { k: 'jornada_h', et: 'Jornada', un: 'h', sub: 'Horas de trabajo por día' },
];

// --- Filtro global de la vista ----------------------------------------------
function filtrar(qn) {
  const pasa = (...campos) => !qn || campos.some(c => c != null && norm(c).includes(qn));
  return {
    rend: RENDIMIENTOS.filter(r => pasa(r.grupo, r.partida, r.und, r.eq, r.nota, 'rendimiento')),
    desp: DESPERDICIOS.filter(d => pasa(d.material, d.nota, 'desperdicio')),
    concreto: DOSIFICACIONES_CONCRETO.filter(d => pasa(d.nombre, 'concreto dosificacion')),
    morteros: MORTEROS.filter(m => pasa(m.nombre, 'mortero dosificacion')),
    aceros: ACEROS.filter(a => pasa(a.diam, 'acero corrugado varilla')),
    muros: MUROS_LADRILLO.filter(m => pasa(m.tipo, m.aparejo, 'muro ladrillo')),
    tarrajeos: TARRAJEOS.filter(t => pasa(t.nombre, 'tarrajeo consumo')),
    equipos: EQUIPOS_PRODUCCION.filter(e => pasa(e.equipo, e.faena, e.prod, e.nota, 'equipo produccion')),
    esponja: ESPONJAMIENTO.filter(e => pasa(e.material, 'esponjamiento eliminacion')),
    carguio: CARGUIO.filter(c => pasa(c.equipo, 'carguio carga volquete')),
    flota: FLOTA_FICHAS.filter(f => pasa(f.et, f.sub, 'flota volquete eliminacion')),
  };
}

// --- Bloques de UI genéricos -------------------------------------------------
function seccion(titulo, sub, cuerpo, accionesCab) {
  return el('section', { class: 'panel' },
    el('div', { class: 'panel-cab' },
      el('div', {},
        el('h2', {}, titulo),
        sub ? el('div', { class: 'sub' }, sub) : null),
      accionesCab || null),
    cuerpo);
}

// cols: [{t, num?, clase?}] · filas: [tr]
function tablaEn(cols, filas) {
  return el('div', { class: 'envoltorio-tabla', style: { boxShadow: 'none' } },
    el('table', { class: 'tabla' },
      el('thead', {}, el('tr', {}, cols.map(c =>
        el('th', { class: [c.num ? 'num' : '', c.clase || ''].join(' ').trim() || null }, c.t)))),
      el('tbody', {}, filas)));
}

const tdNum = (contenido, destacado = false) =>
  el('td', { class: 'num' }, destacado ? el('strong', {}, contenido) : contenido);

const enlaceInterno = (href, texto) =>
  el('a', { href, style: { color: 'var(--acento-texto)', fontWeight: 600, textDecoration: 'none' } }, texto);

// --- Modal «Usar»: aplica un rendimiento a una partida del presupuesto -------
function abrirModalUsar(r) {
  const p = store.getProyecto();
  const nodos = arbolPlano(p).filter(n => n.item.tipo === 'partida');
  let m = null;

  if (!nodos.length) {
    m = modal({
      titulo: 'Usar rendimiento',
      contenido: el('div', { class: 'vacio' },
        icono('presupuesto', 26),
        'El presupuesto todavía no tiene partidas.', el('br'),
        'Créalas en la hoja de presupuesto y vuelve a intentarlo.',
        el('div', { style: { marginTop: '14px' } },
          el('button', { class: 'btn btn-mini', onclick: () => { m.cerrar(); location.hash = '#/presupuesto'; } },
            'Ir a la hoja de presupuesto'))),
      acciones: [{ label: 'Cerrar', clase: 'btn-sec' }],
    });
    return;
  }

  const aplicar = n => {
    m.cerrar();
    store.update(pr => {
      const it = itemPorId(pr, n.item.id);
      if (it) it.rendimiento = r.rend;
    });
    toast(`Rendimiento ${fmtQ(r.rend)} ${und2(r.und)}/día aplicado a ${n.codigo} — ${n.item.descripcion}`);
  };

  const inFiltro = el('input', {
    type: 'search', placeholder: 'Filtrar partidas por código o descripción…',
    style: { width: '100%', marginBottom: '10px' },
  });
  const lista = el('div', { style: { maxHeight: '46vh', overflowY: 'auto' } });

  const filaPartida = n => {
    const distinta = n.item.unidad !== r.und;
    return el('div', {
      class: 'paleta-item',
      title: distinta
        ? `Ojo: la partida se mide en ${und2(n.item.unidad)} y el rendimiento está en ${und2(r.und)}`
        : 'Aplicar el rendimiento a esta partida',
      onclick: () => aplicar(n),
    },
      el('span', { class: 'cod' }, n.codigo),
      el('span', {}, n.item.descripcion),
      distinta ? el('span', { class: 'alerta', title: `Unidad distinta (${und2(n.item.unidad)} vs ${und2(r.und)})` }, icono('alerta', 13)) : null,
      el('span', { class: 'detalle' }, `${und2(n.item.unidad)} · rend. actual ${fmtQ(n.item.rendimiento)}`));
  };

  const pinta = () => {
    const fq = norm(inFiltro.value);
    const vis = nodos.filter(n => !fq || norm(`${n.codigo} ${n.item.descripcion} ${n.item.unidad}`).includes(fq));
    if (vis.length) lista.replaceChildren(...vis.map(filaPartida));
    else lista.replaceChildren(el('div', { class: 'vacio', style: { padding: '24px' } }, 'Ninguna partida coincide con el filtro.'));
  };
  inFiltro.addEventListener('input', pinta); // permitido: vive dentro del modal
  pinta();

  m = modal({
    titulo: `Usar rendimiento — ${r.partida}`,
    ancho: 640,
    contenido: el('div', {},
      el('div', { class: 'nota' },
        el('b', {}, `${fmtQ(r.rend)} ${und2(r.und)}/día`),
        ` · cuadrilla ${fmtCuadrilla(r.cuadrilla)}${r.eq ? ' · ' + r.eq : ''}.`, el('br'),
        'Elige la partida destino: se le asignará este rendimiento y se recalcularán los recursos ',
        'del ACU en modo «rendimiento» (cuadrilla × jornada ÷ rendimiento). Puedes deshacer con Ctrl+Z.'),
      inFiltro, lista),
    acciones: [{ label: 'Cancelar', clase: 'btn-sec' }],
  });
}

// --- Pestaña: Rendimientos ---------------------------------------------------
function vistaRendimientos(rows) {
  const orden = [];
  const porGrupo = new Map();
  for (const r of rows) {
    if (!porGrupo.has(r.grupo)) { porGrupo.set(r.grupo, []); orden.push(r.grupo); }
    porGrupo.get(r.grupo).push(r);
  }

  const filas = [];
  for (const g of orden) {
    filas.push(el('tr', { class: 'fila-titulo' },
      el('td', { class: 'descripcion', colspan: 6 }, g)));
    for (const r of porGrupo.get(g)) {
      filas.push(el('tr', { title: r.nota || null },
        el('td', {}, r.partida),
        el('td', { class: 'cod' }, und2(r.und)),
        tdNum(fmtQ(r.rend), true),
        el('td', { class: 'texto-2', style: { whiteSpace: 'nowrap' } }, fmtCuadrilla(r.cuadrilla)),
        el('td', { class: 'texto-2' }, r.eq || '—'),
        el('td', { class: 'num no-imprimir' },
          el('button', {
            class: 'btn btn-mini',
            title: 'Aplicar este rendimiento a una partida del presupuesto',
            onclick: () => abrirModalUsar(r),
          }, 'Usar'))));
    }
  }

  return [
    el('div', { class: 'nota' },
      el('b', {}, 'Jornada de 8 h.'),
      ' Rendimientos referenciales de edificación urbana en costa (CAPECO / expedientes típicos). ',
      'El botón ', el('b', {}, '«Usar»'), ' asigna el valor a una partida del presupuesto; ',
      'calíbralo con las condiciones reales de tu obra (clima, altura, logística, supervisión).'),
    seccion('Rendimientos de mano de obra',
      `Jornada de 8 h · ${rows.length} partidas de referencia agrupadas por especialidad`,
      tablaEn([
        { t: 'Partida' }, { t: 'Und' }, { t: 'Rend/día', num: true },
        { t: 'Cuadrilla' }, { t: 'Equipo' }, { t: '', clase: 'no-imprimir' },
      ], filas)),
  ];
}

// --- Pestaña: Desperdicios ---------------------------------------------------
function vistaDesperdicios(rows) {
  return [
    el('div', { class: 'nota' },
      el('b', {}, 'Aplícalos en el ACU:'),
      ' columna Desp.% de cada material (modo directo). La cantidad efectiva se calcula como neta × (1 + desp ÷ 100).'),
    seccion('Desperdicios de materiales',
      'Porcentaje típico sobre la cantidad neta calculada — ajústalo a tu logística real',
      tablaEn(
        [{ t: 'Material' }, { t: '%', num: true }, { t: 'Nota' }],
        rows.map(d => el('tr', {},
          el('td', {}, d.material),
          tdNum(`${fmtQ(d.pct)} %`, true),
          el('td', { class: 'texto-2' }, d.nota || '—'))))),
  ];
}

// --- Pestaña: Dosificaciones -------------------------------------------------
function tablaDosif(rows) {
  const COLS = [
    { t: 'Cemento bol', get: r => r.cemento_bol },
    { t: 'Arena m³', get: r => r.arena_m3 },
    {
      t: 'Piedra m³',
      get: r => r.piedra_m3 ?? r.piedra_grande_m3 ?? r.piedra_mediana_m3,
      suf: r => r.piedra_m3 != null ? '' : r.piedra_grande_m3 != null ? 'PG' : r.piedra_mediana_m3 != null ? 'PM' : '',
    },
    { t: 'Hormigón m³', get: r => r.hormigon_m3 },
    { t: 'Agua m³', get: r => r.agua_m3 },
  ].filter(c => rows.some(r => c.get(r) != null)); // solo columnas con datos

  const filas = rows.map(r => el('tr', {},
    el('td', {}, r.nombre),
    COLS.map(c => {
      const v = c.get(r);
      if (v == null) return el('td', { class: 'num texto-3' }, '—');
      const suf = c.suf ? c.suf(r) : '';
      return el('td', { class: 'num' },
        el('strong', {}, fmtQ(v)),
        suf ? el('span', { class: 'texto-3', style: { marginLeft: '4px', fontSize: '10px', fontFamily: 'var(--fuente)' } }, suf) : null);
    })));

  return tablaEn([{ t: 'Mezcla' }, ...COLS.map(c => ({ t: c.t, num: true }))], filas);
}

function vistaDosificaciones(F) {
  const salida = [
    el('div', { class: 'nota' },
      el('b', {}, 'Cantidades netas:'),
      ' añade el desperdicio en el ACU. En ', enlaceInterno('#/calculadoras', 'Calculadoras'),
      ' puedes convertir una dosificación en materiales totales para tu metrado.'),
  ];
  if (F.concreto.length) salida.push(seccion('Concreto — dosificación por m³',
    'Cemento Portland tipo I · agregados de Lima · slump 3"–4" · PG = piedra grande, PM = piedra mediana',
    tablaDosif(F.concreto)));
  if (F.morteros.length) salida.push(seccion('Morteros — dosificación por m³',
    'Proporción cemento : arena, para asentado y tarrajeos',
    tablaDosif(F.morteros)));
  return salida;
}

// --- Pestaña: Acero y muros --------------------------------------------------
function vistaAcero(F) {
  const salida = [];

  if (F.aceros.length) {
    const R = ACERO_REGLAS;
    const recub = Object.entries(R.recubrimientos_cm).map(([k, v]) => `${k} ${fmtQ(v)} cm`).join(' · ');
    salida.push(seccion('Acero corrugado ASTM A615 Grado 60',
      'Pesos y áreas para metrar en kg — barra comercial de 9 m',
      [
        tablaEn(
          [{ t: 'Ø' }, { t: 'kg/m', num: true }, { t: 'Área cm²', num: true }, { t: 'Barra comercial', num: true }, { t: 'kg por varilla', num: true }],
          F.aceros.map(a => el('tr', {},
            el('td', { class: 'cod' }, a.diam),
            tdNum(fmtQ(a.kgm), true),
            tdNum(fmtQ(a.area_cm2)),
            tdNum(`${fmtQ(a.long_com)} m`),
            tdNum(fmtNum(round2(a.kgm * a.long_com), 2), true)))),
        el('div', { class: 'nota', style: { marginTop: '14px', marginBottom: 0 } },
          el('b', {}, 'Reglas prácticas (E.060): '),
          `traslape clase B ≈ ${R.traslape_db}·db · gancho de estribo ${R.gancho_estribo_db}·db · `,
          `desperdicio por despuntes ${fmtQ(R.desperdicio_pct)} %. Recubrimientos: ${recub}.`),
      ]));
  }

  if (F.muros.length) salida.push(seccion('Muros de ladrillo',
    'Unidades y mortero por m² de muro — junta de 1.5 cm',
    tablaEn(
      [{ t: 'Tipo' }, { t: 'Aparejo' }, { t: 'und/m²', num: true }, { t: 'Mortero m³/m²', num: true }, { t: 'Espesor', num: true }],
      F.muros.map(m => el('tr', {},
        el('td', {}, m.tipo),
        el('td', { class: 'texto-2' }, m.aparejo),
        tdNum(fmtQ(m.und_m2), true),
        tdNum(m.mortero_m3_m2 ? fmtQ(m.mortero_m3_m2) : '—'),
        tdNum(`${fmtQ(m.espesor_cm)} cm`))))));

  if (F.tarrajeos.length) {
    const COLS = [
      { t: 'Cemento bol/m²', get: t => t.cemento_bol_m2 },
      { t: 'Arena m³/m²', get: t => t.arena_m3_m2 },
      { t: 'Agua m³/m²', get: t => t.agua_m3_m2 },
      { t: 'Pegamento bol/m²', get: t => t.pegamento_bol_m2 },
      { t: 'Fragua kg/m²', get: t => t.fragua_kg_m2 },
    ].filter(c => F.tarrajeos.some(t => c.get(t) != null));
    salida.push(seccion('Tarrajeos, contrapisos y enchapes',
      'Consumo de materiales por m² (mezcla 1:5 salvo indicación)',
      tablaEn(
        [{ t: 'Partida' }, ...COLS.map(c => ({ t: c.t, num: true }))],
        F.tarrajeos.map(t => el('tr', {},
          el('td', {}, t.nombre),
          COLS.map(c => {
            const v = c.get(t);
            return v == null ? el('td', { class: 'num texto-3' }, '—') : tdNum(fmtQ(v), true);
          }))))));
  }

  return salida;
}

// --- Pestaña: Equipos --------------------------------------------------------
function vistaEquipos(F) {
  const salida = [];

  if (F.equipos.length) salida.push(seccion('Producción de equipos',
    'Producciones típicas por hora o por jornada — calibra con tus partes diarios',
    tablaEn(
      [{ t: 'Equipo' }, { t: 'Faena' }, { t: 'Producción' }, { t: 'Nota' }],
      F.equipos.map(r => el('tr', {},
        el('td', {}, r.equipo),
        el('td', { class: 'texto-2' }, r.faena),
        /calculadora/i.test(r.prod)
          ? el('td', {}, enlaceInterno('#/calculadoras', r.prod + ' →'))
          : el('td', { class: 'mono', style: { whiteSpace: 'nowrap', fontSize: '12.5px' } }, el('strong', {}, r.prod)),
        el('td', { class: 'texto-2' }, r.nota || '—'))))));

  if (F.esponja.length) salida.push(seccion('Esponjamiento de materiales',
    'De banco (m³ en corte) a suelto (m³ a eliminar): V suelto = V banco × (1 + % ÷ 100)',
    tablaEn(
      [{ t: 'Material' }, { t: 'Esponjamiento', num: true }],
      F.esponja.map(e => el('tr', {},
        el('td', {}, e.material),
        tdNum(`+${fmtQ(e.pct)} %`, true))))));

  if (F.carguio.length) salida.push(seccion('Producción de carguío',
    'm³ sueltos por hora — define el tiempo de carga del volquete en la calculadora de flota',
    tablaEn(
      [{ t: 'Equipo de carguío' }, { t: 'Producción', num: true }],
      F.carguio.map(c => el('tr', {},
        el('td', {}, c.equipo),
        tdNum(`${fmtQ(c.prod_mh)} m³/h`, true))))));

  if (F.flota.length) salida.push(seccion('Flota de eliminación — parámetros por defecto',
    'Valores iniciales de la calculadora de flota de volquetes; edítalos allí para tu obra',
    el('div', {
      class: 'grid-kpi',
      style: { marginBottom: 0, gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' },
    },
      F.flota.map(f => el('div', { class: 'kpi' },
        el('div', { class: 'kpi-etiqueta' }, f.et),
        el('div', { class: 'kpi-valor', style: { fontSize: '17.5px' } },
          `${fmtQ(FLOTA_DEFAULTS[f.k])}${f.un ? ' ' + f.un : ''}`),
        el('div', { class: 'kpi-sub' }, f.sub)))),
    el('a', { class: 'btn btn-mini no-imprimir', href: '#/calculadoras', style: { textDecoration: 'none' } },
      icono('calculadora', 14), 'Calcular flota de volquetes →')));

  return salida;
}

// --- Estado vacío de búsqueda ------------------------------------------------
function vacioBusqueda(conteos) {
  const actual = TABS.find(t => t.id === tab);
  const otras = TABS.filter(t => t.id !== tab && conteos[t.id] > 0);
  return el('div', { class: 'panel' },
    el('div', { class: 'vacio' },
      icono('buscar', 26),
      `Sin coincidencias para «${q}» en ${actual.label}.`,
      otras.length
        ? el('div', { class: 'fila no-imprimir', style: { justifyContent: 'center', marginTop: '14px', flexWrap: 'wrap' } },
            otras.map(t => el('button', {
              class: 'btn btn-mini',
              onclick: () => { tab = t.id; rerender(); },
            }, `Ver en ${t.label} (${conteos[t.id]})`)))
        : el('div', { style: { marginTop: '8px' } }, 'Tampoco hay resultados en las demás pestañas: prueba con otro término.')));
}

// --- Vista -------------------------------------------------------------------
export function render(container, params) {
  raiz = container;
  const qn = norm(q);
  const F = filtrar(qn);
  const conteos = {
    rend: F.rend.length,
    desp: F.desp.length,
    dosif: F.concreto.length + F.morteros.length,
    acero: F.aceros.length + F.muros.length + F.tarrajeos.length,
    equipos: F.equipos.length + F.esponja.length + F.carguio.length + F.flota.length,
  };

  // Cabecera con búsqueda global de la vista (commit en change/Enter).
  const inBusca = el('input', {
    type: 'search',
    value: q,
    placeholder: 'Buscar en toda la biblioteca…',
    title: 'Filtra todas las secciones · Enter para aplicar',
    style: { width: '250px' },
    onkeydown: e => { if (e.key === 'Enter') e.target.blur(); },
    onchange: e => {
      const v = e.target.value.trim();
      if (v === q) return;
      q = v;
      enfocarBusqueda = true;
      rerender();
    },
  });

  const cabecera = el('header', { class: 'cabecera-vista' },
    el('div', {},
      el('h1', {}, 'Biblioteca técnica'),
      el('div', { class: 'sub' },
        'Rendimientos, desperdicios, dosificaciones y producción de equipos — valores referenciales editables en cada ACU')),
    el('div', { class: 'acciones no-imprimir' },
      inBusca,
      el('button', { class: 'btn', title: 'Imprimir la pestaña visible', onclick: () => window.print() },
        icono('imprimir', 15), 'Imprimir')));

  const segmentos = el('div', { class: 'no-imprimir', style: { marginBottom: '18px' } },
    el('div', { class: 'segmentos' },
      TABS.map(t => el('button', {
        class: 'segmento' + (t.id === tab ? ' activo' : ''),
        onclick: () => { if (tab !== t.id) { tab = t.id; rerender(); } },
      }, t.label + (qn ? ` (${conteos[t.id]})` : '')))));

  let cuerpo;
  if (qn && !conteos[tab]) cuerpo = [vacioBusqueda(conteos)];
  else if (tab === 'rend') cuerpo = vistaRendimientos(F.rend);
  else if (tab === 'desp') cuerpo = vistaDesperdicios(F.desp);
  else if (tab === 'dosif') cuerpo = vistaDosificaciones(F);
  else if (tab === 'acero') cuerpo = vistaAcero(F);
  else cuerpo = vistaEquipos(F);

  container.append(cabecera, segmentos, ...cuerpo);

  if (enfocarBusqueda) {
    enfocarBusqueda = false;
    setTimeout(() => {
      inBusca.focus();
      const fin = inBusca.value.length;
      try { inBusca.setSelectionRange(fin, fin); } catch { /* algunos tipos no lo permiten */ }
    }, 0);
  }
}
