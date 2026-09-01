// calculadoras.js — Calculadoras de metrados y equipos (#/calculadoras).
// Cinco utilitarios con resultados en vivo: acero→kg, muro de ladrillo,
// tarrajeo, concreto por dosificación y eliminación con flota de volquetes.
// Las calculadoras NO tocan el store: sólo el botón «Enviar a partida…»
// escribe item.metrado vía store.update(). El estado vive en variables de
// módulo y los resultados se re-renderizan localmente (permitido usar 'input').
import * as store from '../core/store.js';
import { arbolPlano, itemPorId } from '../core/calc.js';
import { fmtMoney, fmtNum, parseNum, round2 } from '../core/fmt.js';
import { el, icono, modal, toast, campo } from '../ui/components.js';
import { ACEROS, ACERO_REGLAS, MUROS_LADRILLO, MORTEROS, TARRAJEOS,
         DOSIFICACIONES_CONCRETO, ESPONJAMIENTO, FLOTA_DEFAULTS, CARGUIO } from '../data/biblioteca.js';

// --- Estado de UI (a nivel de módulo, nunca en el store) --------------------
let raiz = null;
let calcActiva = 'acero';

const stAcero = {
  filas: [{ aceroIdx: 4, elems: 1, varillas: 4, largo: 0 }], // Ø 1/2" por defecto
  despPct: ACERO_REGLAS.desperdicio_pct,
  traslapes: false,
};
const stMuro = {
  muroIdx: 0, modoArea: 'dims', largo: 0, alto: 0, areaDirecta: 0, vanos: 0,
  despLad: 5, despMort: 10, morteroIdx: 2, // mortero 1:5
};
const stTarrajeo = { tarIdx: 0, largo: 0, alto: 0, vanos: 0, desp: 10 };
const stConcreto = { dosIdx: 3, vol: 0, desp: 5 }; // f'c=210 por defecto
const stFlota = {
  banco: 0, espIdx: 2, esp: ESPONJAMIENTO[2].pct, dist: 10, carguioIdx: 0,
  cap: FLOTA_DEFAULTS.capacidad_util_m3,
  vc: FLOTA_DEFAULTS.velocidad_cargado_kmh, vv: FLOTA_DEFAULTS.velocidad_vacio_kmh,
  tDesc: FLOTA_DEFAULTS.tiempo_descarga_min, tAcom: FLOTA_DEFAULTS.tiempo_acomodo_min,
  jornada: FLOTA_DEFAULTS.jornada_h, efic: FLOTA_DEFAULTS.eficiencia_jornada,
};

function rerender() {
  if (!raiz) return;
  raiz.replaceChildren();
  render(raiz);
}

// --- Helpers de UI ----------------------------------------------------------
function kpi(variante, etiqueta, valor, sub) {
  return el('div', { class: 'kpi' + (variante ? ' ' + variante : '') },
    el('div', { class: 'kpi-etiqueta' }, etiqueta),
    el('div', { class: 'kpi-valor' }, valor),
    sub ? el('div', { class: 'kpi-sub' }, sub) : null);
}

// Input numérico ligado a un objeto de estado. Recalcula en vivo ('input':
// permitido aquí porque NO pasa por el store) y valida/normaliza en 'change'.
function inputNumerico(st, clave, recalc) {
  return el('input', {
    type: 'text', value: String(st[clave]), style: { width: '100%' },
    onkeydown: e => { if (e.key === 'Enter') e.target.blur(); },
    oninput: e => {
      const v = parseNum(e.target.value);
      if (!isNaN(v) && v >= 0) { st[clave] = v; recalc(); }
    },
    onchange: e => {
      const v = parseNum(e.target.value);
      if (isNaN(v) || v < 0) {
        toast('Valor inválido: escribe un número mayor o igual a 0', 'error');
        e.target.value = String(st[clave]);
        return;
      }
      st[clave] = v; e.target.value = String(v); recalc();
    },
  });
}

function tituloCalc(titulo, fuente) {
  return el('div', { style: { marginBottom: '14px' } },
    el('h2', { style: { fontSize: '16.5px', fontWeight: '700', letterSpacing: '-.015em' } }, titulo),
    el('div', { class: 'texto-3', style: { fontSize: '12px', marginTop: '3px' } }, fuente));
}

function panelResultadosVacio(mensaje) {
  return el('div', { class: 'panel' },
    el('div', { class: 'vacio' },
      icono('calculadora', 30),
      el('div', {}, mensaje)));
}

function tablaDesglose(cabeceras, filasTr) {
  return el('div', { class: 'envoltorio-tabla', style: { boxShadow: 'none' } },
    el('table', { class: 'tabla' },
      el('thead', {}, el('tr', {}, cabeceras.map(c =>
        el('th', { class: c.num ? 'num' : null }, c.texto ?? c)))),
      el('tbody', {}, filasTr)));
}

// --- «Enviar a partida…» ----------------------------------------------------
function abrirEnviarAPartida(valor, unidad) {
  const p = store.getProyecto();
  const partidas = arbolPlano(p).filter(n => n.item.tipo === 'partida');
  if (!(valor > 0)) { toast('El resultado actual es 0: completa los datos de la calculadora', 'error'); return; }
  if (!partidas.length) { toast('El proyecto no tiene partidas: créalas en la hoja de presupuesto', 'error'); return; }

  const v = round2(valor);
  const inFiltro = el('input', {
    type: 'search', placeholder: 'Filtrar por código o descripción…',
    style: { width: '100%', marginBottom: '10px' },
  });
  const lista = el('div', { style: { maxHeight: '340px', overflowY: 'auto' } });

  const filaPartida = n => el('div', {
    class: 'fila-esp',
    style: { padding: '8px 11px', borderRadius: '9px', cursor: 'pointer', border: '1px solid var(--panel-borde)', marginBottom: '6px' },
    onmouseenter: e => { e.currentTarget.style.background = 'var(--panel-hover)'; },
    onmouseleave: e => { e.currentTarget.style.background = 'transparent'; },
    onclick: () => {
      m.cerrar();
      store.update(pr => { const it = itemPorId(pr, n.item.id); if (it) it.metrado = v; });
      toast(`Metrado ${fmtNum(v)} ${unidad} aplicado a la partida ${n.codigo}`);
    },
  },
    el('div', { class: 'col', style: { gap: '2px', minWidth: '0' } },
      el('div', { class: 'fila', style: { gap: '8px' } },
        el('span', { class: 'cod', style: { fontFamily: 'var(--mono)', fontSize: '12px', color: 'var(--texto-2)' } }, n.codigo),
        el('span', { style: { fontSize: '13px' } }, n.item.descripcion)),
      el('span', { class: 'texto-3', style: { fontSize: '11.5px' } },
        `Metrado actual: ${fmtNum(Number(n.item.metrado) || 0)} ${n.item.unidad || '—'}`)),
    n.item.unidad !== unidad
      ? el('span', { class: 'pill pill-auto', title: 'La unidad de la partida no coincide con la del resultado' }, `partida en ${n.item.unidad || '—'}`)
      : el('span', { class: 'pill' }, unidad));

  const pinta = () => {
    const q = inFiltro.value.trim().toLowerCase();
    const vis = partidas.filter(n => !q || `${n.codigo} ${n.item.descripcion}`.toLowerCase().includes(q));
    lista.replaceChildren(...(vis.length
      ? vis.map(filaPartida)
      : [el('div', { class: 'vacio', style: { padding: '26px' } }, 'Ninguna partida coincide con el filtro.')]));
  };
  inFiltro.addEventListener('input', pinta); // permitido: vive dentro del modal

  const m = modal({
    titulo: 'Enviar metrado a partida',
    ancho: 620,
    contenido: el('div', {},
      el('div', { class: 'nota', style: { marginBottom: '12px' } },
        'Se asignará ', el('b', {}, `metrado = ${fmtNum(v)} ${unidad}`),
        ' a la partida elegida (reemplaza el metrado actual; puedes deshacer con Ctrl+Z).'),
      inFiltro, lista),
    acciones: [{ label: 'Cancelar', clase: 'btn-sec' }],
  });
  pinta();
}

function btnEnviar(obtenerValor, unidad) {
  return el('button', {
    class: 'btn btn-primario', style: { marginTop: '12px' },
    onclick: () => abrirEnviarAPartida(obtenerValor(), unidad),
  }, icono('acu', 15), 'Enviar a partida…');
}

// ============================================================================
// A) ACERO → KG
// ============================================================================
function calcularAcero() {
  const f = 1 + (Number(stAcero.despPct) || 0) / 100;
  const porDiam = new Map();
  let neto = 0;
  const detalles = stAcero.filas.map(fila => {
    const a = ACEROS[fila.aceroIdx];
    const db = Math.sqrt(4 * a.area_cm2 / Math.PI) / 100; // diámetro en m desde el área
    let nTras = 0;
    if (stAcero.traslapes && fila.largo > a.long_com) nTras = Math.ceil(fila.largo / a.long_com - 1);
    const largoEf = fila.largo + nTras * ACERO_REGLAS.traslape_db * db;
    const kg = fila.elems * fila.varillas * largoEf * a.kgm;
    neto += kg;
    porDiam.set(fila.aceroIdx, (porDiam.get(fila.aceroIdx) || 0) + kg);
    return { kg, nTras, largoEf };
  });
  let varillasTot = 0;
  const desgloses = [...porDiam.entries()].sort((x, y) => x[0] - y[0]).map(([idx, kg]) => {
    const a = ACEROS[idx];
    const kgDesp = kg * f;
    const varillas = a.kgm > 0 ? Math.ceil(kgDesp / (a.kgm * a.long_com)) : 0;
    varillasTot += varillas;
    return { a, kg, kgDesp, varillas };
  });
  return { detalles, neto, conDesp: neto * f, varillasTot, desgloses };
}

function calcAcero() {
  const res = el('div', {});
  const refsKg = []; // celdas «kg» de cada fila, actualizadas en vivo

  const recalc = () => {
    const r = calcularAcero();
    r.detalles.forEach((d, i) => {
      const td = refsKg[i];
      if (!td) return;
      td.textContent = fmtNum(d.kg);
      td.title = d.nTras > 0
        ? `Incluye ${d.nTras} traslape(s) de ${ACERO_REGLAS.traslape_db}·db por varilla (long. efectiva ${fmtNum(d.largoEf)} m)`
        : '';
    });
    if (!(r.neto > 0)) {
      res.replaceChildren(panelResultadosVacio('Ingresa elementos, varillas y longitudes para ver los kilogramos.'));
      return;
    }
    res.replaceChildren(
      el('div', { class: 'grid-kpi', style: { marginBottom: '14px' } },
        kpi('', 'Acero neto', `${fmtNum(r.neto)} kg`, `${stAcero.filas.length} fila(s) de metrado`),
        kpi('verde', `Con desperdicio ${fmtNum(stAcero.despPct, 1)} %`, `${fmtNum(r.conDesp)} kg`, 'Valor sugerido para el metrado'),
        kpi('ambar', 'Varillas comerciales', fmtNum(r.varillasTot, 0), 'Equivalente en varillas de 9 m')),
      el('div', { class: 'panel' },
        el('div', { class: 'panel-cab' }, el('h2', {}, 'Desglose por diámetro')),
        tablaDesglose(
          ['Ø', { texto: 'kg/m', num: true }, { texto: 'kg netos', num: true }, { texto: 'kg + desperdicio', num: true }, { texto: 'Varillas 9 m', num: true }],
          r.desgloses.map(d => el('tr', {},
            el('td', { class: 'cod' }, `Ø ${d.a.diam}`),
            el('td', { class: 'num' }, fmtNum(d.a.kgm, 3)),
            el('td', { class: 'num' }, fmtNum(d.kg)),
            el('td', { class: 'num' }, fmtNum(d.kgDesp)),
            el('td', { class: 'num' }, fmtNum(d.varillas, 0))))),
        btnEnviar(() => calcularAcero().conDesp, 'kg')));
  };

  const celdaNum = (fila, clave) => el('input', {
    class: 'celda-input', value: String(fila[clave]), style: { width: '84px' },
    onkeydown: e => { if (e.key === 'Enter') e.target.blur(); },
    oninput: e => { const v = parseNum(e.target.value); if (!isNaN(v) && v >= 0) { fila[clave] = v; recalc(); } },
    onchange: e => {
      const v = parseNum(e.target.value);
      if (isNaN(v) || v < 0) { toast('Valor inválido: escribe un número mayor o igual a 0', 'error'); e.target.value = String(fila[clave]); return; }
      fila[clave] = v; e.target.value = String(v); recalc();
    },
  });

  const filasTr = stAcero.filas.map((fila, i) => {
    const tdKg = el('td', { class: 'num' }, '—');
    refsKg.push(tdKg);
    return el('tr', {},
      el('td', { class: 'cod' }, String(i + 1)),
      el('td', {},
        el('select', {
          style: { width: '100%', minWidth: '150px' },
          onchange: e => { fila.aceroIdx = Number(e.target.value); recalc(); },
        }, ACEROS.map((a, idx) => el('option', { value: idx, selected: idx === fila.aceroIdx ? true : null },
          `Ø ${a.diam} · ${fmtNum(a.kgm, 3)} kg/m`)))),
      el('td', { class: 'num' }, celdaNum(fila, 'elems')),
      el('td', { class: 'num' }, celdaNum(fila, 'varillas')),
      el('td', { class: 'num' }, celdaNum(fila, 'largo')),
      tdKg,
      el('td', { class: 'no-imprimir', style: { width: '36px' } },
        el('button', {
          class: 'btn-icono', title: stAcero.filas.length === 1 ? 'Debe quedar al menos una fila' : 'Quitar fila',
          disabled: stAcero.filas.length === 1 ? true : null,
          onclick: () => { stAcero.filas.splice(i, 1); rerender(); },
        }, icono('papelera', 14))));
  });

  const form = el('div', { class: 'panel' },
    el('div', { class: 'panel-cab' },
      el('div', {},
        el('h2', {}, 'Filas de metrado'),
        el('div', { class: 'sub' }, 'kg = elementos × varillas × longitud × (kg/m)')),
      el('button', {
        class: 'btn btn-mini btn-sec',
        onclick: () => {
          const ult = stAcero.filas[stAcero.filas.length - 1];
          stAcero.filas.push({ aceroIdx: ult ? ult.aceroIdx : 4, elems: 1, varillas: 1, largo: 0 });
          rerender();
        },
      }, icono('mas', 13), 'Agregar fila')),
    tablaDesglose(
      ['#', 'Diámetro', { texto: 'N° elem.', num: true }, { texto: 'Var./elem.', num: true }, { texto: 'Long. m', num: true }, { texto: 'kg', num: true }, ''],
      filasTr),
    el('div', { class: 'grid-2', style: { marginTop: '14px' } },
      campo('Desperdicio (%)', inputNumerico(stAcero, 'despPct', recalc), 'Recortes y despuntes'),
      el('label', { class: 'fila', style: { gap: '8px', fontSize: '13px', cursor: 'pointer', alignItems: 'flex-start', paddingTop: '22px' } },
        el('input', {
          type: 'checkbox', checked: stAcero.traslapes ? true : null,
          onchange: e => { stAcero.traslapes = e.target.checked; recalc(); },
        }),
        el('span', {}, `Incluir traslapes cada 9 m (${ACERO_REGLAS.traslape_db}·db por traslape)`))));

  recalc();
  return el('div', {},
    tituloCalc('Acero de refuerzo → kilogramos',
      `Biblioteca técnica: pesos ASTM A615 G60 y reglas de acero (desperdicio ${ACERO_REGLAS.desperdicio_pct} %, traslape ${ACERO_REGLAS.traslape_db}·db según E.060). Valores referenciales, calibrar en obra.`),
    el('div', { class: 'grid-2-min' }, form,
      el('div', {}, res,
        el('div', { class: 'nota', style: { marginTop: '14px' } },
          el('b', {}, 'Fórmulas: '), 'kg por fila = n·v·L·(kg/m). Si L > 9 m y se activan traslapes, se añaden ⌈L/9 − 1⌉ traslapes de ',
          `${ACERO_REGLAS.traslape_db}·db por varilla. Varillas comerciales = ⌈kg con desperdicio ÷ (kg/m × 9 m)⌉ por diámetro.`))));
}

// ============================================================================
// B) MURO DE LADRILLO
// ============================================================================
function calcularMuro() {
  const m = MUROS_LADRILLO[stMuro.muroIdx];
  const bruta = stMuro.modoArea === 'dims' ? stMuro.largo * stMuro.alto : stMuro.areaDirecta;
  const neto = Math.max(0, bruta - stMuro.vanos);
  const ladrillos = Math.ceil(neto * m.und_m2 * (1 + stMuro.despLad / 100));
  const morteroM3 = neto * m.mortero_m3_m2 * (1 + stMuro.despMort / 100);
  const mo = MORTEROS[stMuro.morteroIdx];
  return {
    m, mo, bruta, neto, ladrillos, morteroM3,
    cemento: morteroM3 * mo.cemento_bol,
    arena: morteroM3 * mo.arena_m3,
    agua: morteroM3 * mo.agua_m3,
  };
}

function calcMuro() {
  const res = el('div', {});
  const recalc = () => {
    const r = calcularMuro();
    if (!(r.neto > 0)) {
      res.replaceChildren(panelResultadosVacio('Ingresa las dimensiones del muro (o el área directa) para ver ladrillos y mortero.'));
      return;
    }
    res.replaceChildren(
      el('div', { class: 'grid-kpi', style: { marginBottom: '14px' } },
        kpi('', 'Área neta de muro', `${fmtNum(r.neto)} m²`, `Espesor ${fmtNum(r.m.espesor_cm, 0)} cm · bruta ${fmtNum(r.bruta)} m² − vanos ${fmtNum(stMuro.vanos)} m²`),
        kpi('verde', `Ladrillos (+${fmtNum(stMuro.despLad, 0)} %)`, fmtNum(r.ladrillos, 0), `${fmtNum(r.m.und_m2, 1)} und/m² · junta 1.5 cm`),
        kpi('ambar', `Mortero (+${fmtNum(stMuro.despMort, 0)} %)`, `${fmtNum(r.morteroM3, 3)} m³`, `${fmtNum(r.m.mortero_m3_m2, 3)} m³/m² · ${r.mo.nombre}`)),
      el('div', { class: 'panel' },
        el('div', { class: 'panel-cab' }, el('h2', {}, 'Materiales')),
        tablaDesglose(
          ['Concepto', { texto: 'Cantidad', num: true }, 'Und'],
          [
            el('tr', {}, el('td', {}, `Ladrillo ${r.m.tipo} — ${r.m.aparejo}`), el('td', { class: 'num' }, fmtNum(r.ladrillos, 0)), el('td', {}, 'und')),
            el('tr', {}, el('td', {}, `Mortero ${r.mo.nombre.replace('Mortero ', '')} (asentado)`), el('td', { class: 'num' }, fmtNum(r.morteroM3, 3)), el('td', {}, 'm³')),
            el('tr', {}, el('td', {}, 'Cemento Portland tipo I'), el('td', { class: 'num' }, fmtNum(r.cemento)), el('td', {}, 'bol')),
            el('tr', {}, el('td', {}, 'Arena gruesa'), el('td', { class: 'num' }, fmtNum(r.arena, 3)), el('td', {}, 'm³')),
            el('tr', {}, el('td', {}, 'Agua'), el('td', { class: 'num' }, fmtNum(r.agua, 3)), el('td', {}, 'm³')),
          ]),
        btnEnviar(() => calcularMuro().neto, 'm2')));
  };

  const selMuro = el('select', {
    style: { width: '100%' },
    onchange: e => { stMuro.muroIdx = Number(e.target.value); recalc(); },
  }, MUROS_LADRILLO.map((m, i) => el('option', { value: i, selected: i === stMuro.muroIdx ? true : null },
    `${m.tipo} — ${m.aparejo} (${fmtNum(m.und_m2, 1)} und/m²)`)));

  const selMortero = el('select', {
    style: { width: '100%' },
    onchange: e => { stMuro.morteroIdx = Number(e.target.value); recalc(); },
  }, MORTEROS.map((m, i) => el('option', { value: i, selected: i === stMuro.morteroIdx ? true : null },
    `${m.nombre} (${fmtNum(m.cemento_bol)} bol/m³)`)));

  const toggleArea = el('div', { class: 'segmentos', style: { marginBottom: '13px' } },
    [['dims', 'Largo × alto'], ['directa', 'Área directa']].map(([modo, nombre]) =>
      el('button', {
        class: 'segmento' + (stMuro.modoArea === modo ? ' activo' : ''),
        onclick: () => { if (stMuro.modoArea !== modo) { stMuro.modoArea = modo; rerender(); } },
      }, nombre)));

  const form = el('div', { class: 'panel' },
    el('div', { class: 'panel-cab' }, el('h2', {}, 'Datos del muro')),
    campo('Tipo de ladrillo y aparejo', selMuro),
    toggleArea,
    stMuro.modoArea === 'dims'
      ? el('div', { class: 'grid-2' },
          campo('Largo (m)', inputNumerico(stMuro, 'largo', recalc)),
          campo('Alto (m)', inputNumerico(stMuro, 'alto', recalc)))
      : campo('Área de muro (m²)', inputNumerico(stMuro, 'areaDirecta', recalc)),
    campo('Área de vanos a descontar (m²)', inputNumerico(stMuro, 'vanos', recalc), 'Puertas y ventanas'),
    el('div', { class: 'grid-2' },
      campo('Desperdicio de ladrillo (%)', inputNumerico(stMuro, 'despLad', recalc)),
      campo('Desperdicio de mortero (%)', inputNumerico(stMuro, 'despMort', recalc))),
    campo('Mortero de asentado', selMortero));

  recalc();
  return el('div', {},
    tituloCalc('Muro de ladrillo',
      'Biblioteca técnica: unidades y mortero por m² con junta de 1.5 cm; desperdicios por defecto 5 % ladrillo y 10 % mortero. Valores referenciales, calibrar en obra.'),
    el('div', { class: 'grid-2-min' }, form,
      el('div', {}, res,
        el('div', { class: 'nota', style: { marginTop: '14px' } },
          el('b', {}, 'Fórmulas: '), 'área neta = área bruta − vanos · ladrillos = neta × (und/m²) × (1 + desp.) · mortero = neta × (m³/m²) × (1 + desp.) · materiales según dosificación del mortero elegido.'))));
}

// ============================================================================
// C) TARRAJEO
// ============================================================================
const MATERIALES_TARRAJEO = [
  { k: 'cemento_bol_m2', nombre: 'Cemento Portland tipo I', und: 'bol' },
  { k: 'arena_m3_m2', nombre: 'Arena fina', und: 'm³' },
  { k: 'agua_m3_m2', nombre: 'Agua', und: 'm³' },
  { k: 'pegamento_bol_m2', nombre: 'Pegamento en polvo', und: 'bol' },
  { k: 'fragua_kg_m2', nombre: 'Fragua', und: 'kg' },
];

function calcularTarrajeo() {
  const t = TARRAJEOS[stTarrajeo.tarIdx];
  const m2 = Math.max(0, stTarrajeo.largo * stTarrajeo.alto - stTarrajeo.vanos);
  const f = 1 + (Number(stTarrajeo.desp) || 0) / 100;
  const materiales = MATERIALES_TARRAJEO
    .filter(m => t[m.k] != null)
    .map(m => ({ ...m, porM2: t[m.k], total: m2 * t[m.k] * f }));
  return { t, m2, materiales };
}

function calcTarrajeo() {
  const res = el('div', {});
  const recalc = () => {
    const r = calcularTarrajeo();
    if (!(r.m2 > 0)) {
      res.replaceChildren(panelResultadosVacio('Ingresa largo y alto de la superficie para ver los materiales.'));
      return;
    }
    const [m1, m2mat] = r.materiales;
    res.replaceChildren(
      el('div', { class: 'grid-kpi', style: { marginBottom: '14px' } },
        kpi('', 'Superficie neta', `${fmtNum(r.m2)} m²`, `${fmtNum(stTarrajeo.largo)} × ${fmtNum(stTarrajeo.alto)} − ${fmtNum(stTarrajeo.vanos)} m² de vanos`),
        m1 ? kpi('verde', `${m1.nombre} (+${fmtNum(stTarrajeo.desp, 0)} %)`, `${fmtNum(m1.total)} ${m1.und}`, `${fmtNum(m1.porM2, 3)} ${m1.und}/m²`) : null,
        m2mat ? kpi('ambar', `${m2mat.nombre} (+${fmtNum(stTarrajeo.desp, 0)} %)`, `${fmtNum(m2mat.total, 3)} ${m2mat.und}`, `${fmtNum(m2mat.porM2, 3)} ${m2mat.und}/m²`) : null),
      el('div', { class: 'panel' },
        el('div', { class: 'panel-cab' }, el('h2', {}, 'Materiales'), el('span', { class: 'pill' }, r.t.nombre)),
        tablaDesglose(
          ['Material', { texto: 'Consumo/m²', num: true }, { texto: 'Total', num: true }, 'Und'],
          r.materiales.map(m => el('tr', {},
            el('td', {}, m.nombre),
            el('td', { class: 'num' }, fmtNum(m.porM2, 3)),
            el('td', { class: 'num' }, fmtNum(m.total, 3)),
            el('td', {}, m.und))))));
  };

  const selTar = el('select', {
    style: { width: '100%' },
    onchange: e => { stTarrajeo.tarIdx = Number(e.target.value); recalc(); },
  }, TARRAJEOS.map((t, i) => el('option', { value: i, selected: i === stTarrajeo.tarIdx ? true : null }, t.nombre)));

  const form = el('div', { class: 'panel' },
    el('div', { class: 'panel-cab' }, el('h2', {}, 'Datos de la superficie')),
    campo('Tipo de tarrajeo / revoque', selTar),
    el('div', { class: 'grid-2' },
      campo('Largo (m)', inputNumerico(stTarrajeo, 'largo', recalc)),
      campo('Alto (m)', inputNumerico(stTarrajeo, 'alto', recalc))),
    el('div', { class: 'grid-2' },
      campo('Área de vanos (m²)', inputNumerico(stTarrajeo, 'vanos', recalc)),
      campo('Desperdicio (%)', inputNumerico(stTarrajeo, 'desp', recalc), 'Mortero: 10 % típico')));

  recalc();
  return el('div', {},
    tituloCalc('Tarrajeo y revoques',
      'Biblioteca técnica: consumos por m² en mezcla 1:5 (salvo indicación) y desperdicio por defecto 10 %. Valores referenciales, calibrar en obra.'),
    el('div', { class: 'grid-2-min' }, form,
      el('div', {}, res,
        el('div', { class: 'nota', style: { marginTop: '14px' } },
          el('b', {}, 'Fórmulas: '), 'm² = largo × alto − vanos · material = m² × (consumo/m²) × (1 + desperdicio).'))));
}

// ============================================================================
// D) CONCRETO POR DOSIFICACIÓN
// ============================================================================
const MATERIALES_CONCRETO = [
  { k: 'cemento_bol', nombre: 'Cemento Portland tipo I', und: 'bol', rx: /cemento/i },
  { k: 'arena_m3', nombre: 'Arena gruesa', und: 'm³', rx: /arena/i },
  { k: 'piedra_m3', nombre: 'Piedra chancada', und: 'm³', rx: /piedra|chancad/i },
  { k: 'piedra_grande_m3', nombre: 'Piedra grande', und: 'm³', rx: /piedra/i },
  { k: 'piedra_mediana_m3', nombre: 'Piedra mediana', und: 'm³', rx: /piedra/i },
  { k: 'hormigon_m3', nombre: 'Hormigón', und: 'm³', rx: /hormig/i },
  { k: 'agua_m3', nombre: 'Agua', und: 'm³', rx: /agua/i },
];

function calcularConcreto() {
  const dos = DOSIFICACIONES_CONCRETO[stConcreto.dosIdx];
  const f = 1 + (Number(stConcreto.desp) || 0) / 100;
  const insumos = store.getProyecto().insumos || [];
  const buscar = rx => insumos.find(i => i.tipo === 'MAT' && rx.test(i.descripcion || ''))
    || insumos.find(i => rx.test(i.descripcion || ''));
  let costo = 0, hayPrecios = false;
  const materiales = MATERIALES_CONCRETO
    .filter(m => dos[m.k] != null)
    .map(m => {
      const total = stConcreto.vol * dos[m.k] * f;
      const ins = buscar(m.rx);
      const parcial = ins ? total * (Number(ins.precio) || 0) : null;
      if (ins) { hayPrecios = true; costo += parcial; }
      return { ...m, porM3: dos[m.k], total, ins, parcial };
    });
  return { dos, materiales, hayPrecios, costo: round2(costo), volDesp: stConcreto.vol * f };
}

function calcConcreto() {
  const res = el('div', {});
  const recalc = () => {
    const r = calcularConcreto();
    if (!(stConcreto.vol > 0)) {
      res.replaceChildren(panelResultadosVacio('Ingresa el volumen de la partida para ver los materiales totales.'));
      return;
    }
    const cem = r.materiales.find(m => m.k === 'cemento_bol');
    const cab = ['Material', { texto: 'Und', num: false }, { texto: 'Por m³', num: true }, { texto: 'Total', num: true }];
    if (r.hayPrecios) { cab.push({ texto: 'Precio S/', num: true }, { texto: 'Parcial S/', num: true }); }
    const filas = r.materiales.map(m => el('tr', {},
      el('td', {}, m.nombre, m.ins ? el('span', { class: 'texto-3', style: { fontSize: '11px' } }, ` · ${m.ins.descripcion}`) : null),
      el('td', {}, m.und),
      el('td', { class: 'num' }, fmtNum(m.porM3, 3)),
      el('td', { class: 'num' }, fmtNum(m.total, m.und === 'bol' ? 2 : 3)),
      r.hayPrecios ? el('td', { class: 'num' }, m.ins ? fmtNum(m.ins.precio) : '—') : null,
      r.hayPrecios ? el('td', { class: 'num' }, m.parcial != null ? fmtNum(round2(m.parcial)) : '—') : null));
    if (r.hayPrecios) {
      filas.push(el('tr', { class: 'fila-total' },
        el('td', { colspan: 5 }, 'Costo estimado de materiales (con precios del proyecto)'),
        el('td', { class: 'num' }, fmtNum(r.costo))));
    }
    res.replaceChildren(
      el('div', { class: 'grid-kpi', style: { marginBottom: '14px' } },
        kpi('', 'Volumen a producir', `${fmtNum(r.volDesp)} m³`, `Metrado ${fmtNum(stConcreto.vol)} m³ + ${fmtNum(stConcreto.desp, 0)} % de desperdicio`),
        cem ? kpi('verde', 'Cemento', `${fmtNum(cem.total)} bol`, `${fmtNum(cem.porM3)} bol/m³`) : null,
        r.hayPrecios ? kpi('ambar', 'Costo de materiales', fmtMoney(r.costo), 'Con precios del catálogo de insumos') : null),
      el('div', { class: 'panel' },
        el('div', { class: 'panel-cab' }, el('h2', {}, 'Materiales totales'), el('span', { class: 'pill' }, r.dos.nombre)),
        tablaDesglose(cab, filas),
        !r.hayPrecios
          ? el('div', { class: 'texto-3', style: { fontSize: '12px', marginTop: '10px' } },
              'No se hallaron insumos equivalentes (cemento, arena, piedra, hormigón, agua) en el proyecto: se omite el costo estimado.')
          : null,
        btnEnviar(() => stConcreto.vol, 'm3')));
  };

  const selDos = el('select', {
    style: { width: '100%' },
    onchange: e => { stConcreto.dosIdx = Number(e.target.value); recalc(); },
  }, DOSIFICACIONES_CONCRETO.map((d, i) => el('option', { value: i, selected: i === stConcreto.dosIdx ? true : null },
    `${d.nombre} (${fmtNum(d.cemento_bol)} bol/m³)`)));

  const form = el('div', { class: 'panel' },
    el('div', { class: 'panel-cab' }, el('h2', {}, 'Datos del vaciado')),
    campo('Mezcla / dosificación', selDos),
    el('div', { class: 'grid-2' },
      campo('Volumen de la partida (m³)', inputNumerico(stConcreto, 'vol', recalc)),
      campo('Desperdicio (%)', inputNumerico(stConcreto, 'desp', recalc), 'Vaciado en sitio: 5 % típico')));

  recalc();
  return el('div', {},
    tituloCalc('Concreto por dosificación',
      'Biblioteca técnica: dosificaciones por m³ (cemento tipo I, agregados de Lima, slump 3"–4"); desperdicio por defecto 5 %. Valores referenciales, calibrar en obra.'),
    el('div', { class: 'grid-2-min' }, form,
      el('div', {}, res,
        el('div', { class: 'nota', style: { marginTop: '14px' } },
          el('b', {}, 'Fórmulas: '), 'material = volumen × (dosificación por m³) × (1 + desperdicio). El costo multiplica cada total por el precio del insumo equivalente hallado en el catálogo del proyecto (por descripción).'))));
}

// ============================================================================
// E) ELIMINACIÓN Y FLOTA DE VOLQUETES
// ============================================================================
function calcularFlota() {
  const s = stFlota;
  const prodC = CARGUIO[s.carguioIdx].prod_mh; // m³ sueltos/h
  const valido = s.banco > 0 && s.dist > 0 && s.cap > 0 && s.vc > 0 && s.vv > 0
    && s.jornada > 0 && s.efic > 0 && s.efic <= 1 && prodC > 0;
  if (!valido) return { valido: false };
  const volSuelto = s.banco * (1 + s.esp / 100);
  const tCarga = s.cap / prodC * 60;
  const tIda = s.dist / s.vc * 60;
  const tVuelta = s.dist / s.vv * 60;
  const ciclo = tCarga + tIda + s.tDesc + tVuelta + s.tAcom;
  const viajesDia = (s.jornada * 60 * s.efic) / ciclo;
  const prodVolqDia = viajesDia * s.cap;
  const prodCarguioDia = prodC * s.jornada * s.efic;
  const nVolq = Math.ceil(prodCarguioDia / prodVolqDia);
  const prodFlotaDia = Math.min(nVolq * prodVolqDia, prodCarguioDia);
  const dias = volSuelto / prodFlotaDia;
  const viajesTot = Math.ceil(volSuelto / s.cap);
  return { valido: true, prodC, volSuelto, tCarga, tIda, tVuelta, ciclo, viajesDia, prodVolqDia, prodCarguioDia, nVolq, prodFlotaDia, dias, viajesTot };
}

function calcFlota() {
  const res = el('div', {});
  const recalc = () => {
    const s = stFlota;
    const r = calcularFlota();
    if (!r.valido) {
      res.replaceChildren(panelResultadosVacio('Completa volumen en banco, distancia, capacidad, velocidades, jornada y eficiencia (0–1) para dimensionar la flota.'));
      return;
    }
    const paso = (n, concepto, calculo, resultado) => el('tr', {},
      el('td', { class: 'cod' }, String(n)),
      el('td', {}, concepto),
      el('td', { class: 'cod', style: { whiteSpace: 'normal' } }, calculo),
      el('td', { class: 'num' }, resultado));
    res.replaceChildren(
      el('div', { class: 'grid-kpi', style: { marginBottom: '14px' } },
        kpi('', 'Volquetes requeridos', fmtNum(r.nVolq, 0), `Saturan ${CARGUIO[s.carguioIdx].equipo}`),
        kpi('verde', 'Viajes totales', fmtNum(r.viajesTot, 0), `${fmtNum(r.viajesDia, 1)} viajes/día por volquete`),
        kpi('ambar', 'Días de eliminación', fmtNum(Math.ceil(r.dias), 0), `${fmtNum(r.dias, 2)} días exactos con la flota completa`),
        kpi('violeta', 'Producción de la flota', `${fmtNum(r.prodFlotaDia, 1)} m³/día`, 'Material suelto')),
      el('div', { class: 'panel' },
        el('div', { class: 'panel-cab' }, el('h2', {}, 'Cálculo paso a paso')),
        tablaDesglose(
          ['#', 'Concepto', 'Cálculo', { texto: 'Resultado', num: true }],
          [
            paso(1, 'Volumen suelto', `${fmtNum(s.banco)} m³ banco × (1 + ${fmtNum(s.esp, 0)} %)`, `${fmtNum(r.volSuelto)} m³`),
            paso(2, 'Tiempo de carga', `${fmtNum(s.cap, 1)} m³ ÷ ${fmtNum(r.prodC, 0)} m³/h × 60`, `${fmtNum(r.tCarga, 1)} min`),
            paso(3, 'Ida al botadero (cargado)', `${fmtNum(s.dist, 1)} km ÷ ${fmtNum(s.vc, 0)} km/h × 60`, `${fmtNum(r.tIda, 1)} min`),
            paso(4, 'Retorno (vacío)', `${fmtNum(s.dist, 1)} km ÷ ${fmtNum(s.vv, 0)} km/h × 60`, `${fmtNum(r.tVuelta, 1)} min`),
            paso(5, 'Ciclo del volquete', `carga + ida + descarga (${fmtNum(s.tDesc, 0)}) + retorno + acomodo (${fmtNum(s.tAcom, 0)})`, `${fmtNum(r.ciclo, 1)} min`),
            paso(6, 'Viajes/día por volquete', `${fmtNum(s.jornada, 0)} h × 60 × ${fmtNum(s.efic, 2)} ÷ ${fmtNum(r.ciclo, 1)} min`, `${fmtNum(r.viajesDia, 2)} viajes`),
            paso(7, 'Producción por volquete', `${fmtNum(r.viajesDia, 2)} viajes × ${fmtNum(s.cap, 1)} m³`, `${fmtNum(r.prodVolqDia, 1)} m³/día`),
            paso(8, 'Producción del carguío', `${fmtNum(r.prodC, 0)} m³/h × ${fmtNum(s.jornada, 0)} h × ${fmtNum(s.efic, 2)}`, `${fmtNum(r.prodCarguioDia, 1)} m³/día`),
            paso(9, 'Volquetes para saturar el carguío', `⌈${fmtNum(r.prodCarguioDia, 1)} ÷ ${fmtNum(r.prodVolqDia, 1)}⌉`, `${fmtNum(r.nVolq, 0)} und`),
            paso(10, 'Producción de la flota', `mín(${fmtNum(r.nVolq, 0)} × ${fmtNum(r.prodVolqDia, 1)}; ${fmtNum(r.prodCarguioDia, 1)})`, `${fmtNum(r.prodFlotaDia, 1)} m³/día`),
            paso(11, 'Días de eliminación', `${fmtNum(r.volSuelto)} m³ ÷ ${fmtNum(r.prodFlotaDia, 1)} m³/día`, `${fmtNum(r.dias, 2)} días`),
            paso(12, 'Viajes totales', `⌈${fmtNum(r.volSuelto)} m³ ÷ ${fmtNum(s.cap, 1)} m³⌉`, `${fmtNum(r.viajesTot, 0)} viajes`),
          ])));
  };

  const inpEsp = inputNumerico(stFlota, 'esp', recalc);
  const selEsp = el('select', {
    style: { width: '100%' },
    onchange: e => {
      const i = Number(e.target.value);
      stFlota.espIdx = i;
      if (i >= 0) { stFlota.esp = ESPONJAMIENTO[i].pct; inpEsp.value = String(stFlota.esp); }
      recalc();
    },
  },
    ESPONJAMIENTO.map((m, i) => el('option', { value: i, selected: i === stFlota.espIdx ? true : null }, `${m.material} (${m.pct} %)`)),
    el('option', { value: -1, selected: stFlota.espIdx === -1 ? true : null }, 'Personalizado (manual)'));
  inpEsp.addEventListener('input', () => { stFlota.espIdx = -1; selEsp.value = '-1'; });

  const selCarguio = el('select', {
    style: { width: '100%' },
    onchange: e => { stFlota.carguioIdx = Number(e.target.value); recalc(); },
  }, CARGUIO.map((c, i) => el('option', { value: i, selected: i === stFlota.carguioIdx ? true : null },
    `${c.equipo} (${fmtNum(c.prod_mh, 0)} m³/h suelto)`)));

  const form = el('div', { class: 'panel' },
    el('div', { class: 'panel-cab' }, el('h2', {}, 'Datos de la eliminación')),
    el('div', { class: 'grid-2' },
      campo('Volumen en banco (m³)', inputNumerico(stFlota, 'banco', recalc), 'Volumen excavado, sin esponjar'),
      campo('Distancia al botadero (km)', inputNumerico(stFlota, 'dist', recalc))),
    campo('Esponjamiento del material', selEsp),
    el('div', { class: 'grid-2' },
      campo('Esponjamiento (%)', inpEsp, 'Editable: pasa a «personalizado»'),
      campo('Capacidad útil del volquete (m³)', inputNumerico(stFlota, 'cap', recalc), `Nominal ${FLOTA_DEFAULTS.capacidad_volquete_m3} m³ → útil ~${FLOTA_DEFAULTS.capacidad_util_m3} m³ suelto`)),
    campo('Equipo de carguío', selCarguio),
    el('div', { class: 'grid-2' },
      campo('Velocidad cargado (km/h)', inputNumerico(stFlota, 'vc', recalc)),
      campo('Velocidad vacío (km/h)', inputNumerico(stFlota, 'vv', recalc))),
    el('div', { class: 'grid-2' },
      campo('Descarga y maniobras (min)', inputNumerico(stFlota, 'tDesc', recalc)),
      campo('Acomodo bajo cucharón (min)', inputNumerico(stFlota, 'tAcom', recalc))),
    el('div', { class: 'grid-2' },
      campo('Jornada (h)', inputNumerico(stFlota, 'jornada', recalc)),
      campo('Eficiencia de jornada (0–1)', inputNumerico(stFlota, 'efic', recalc), '0.83 ≈ 50 min efectivos/hora')));

  recalc();
  return el('div', {},
    tituloCalc('Eliminación de material y flota de volquetes',
      'Biblioteca técnica: esponjamientos, producción de carguío y parámetros de flota (volquete 15 m³ → 14 m³ útiles, eficiencia 0.83, jornada 8 h). Valores referenciales, calibrar en obra.'),
    el('div', { class: 'grid-2-min' }, form,
      el('div', {}, res,
        el('div', { class: 'nota', style: { marginTop: '14px' } },
          el('b', {}, 'Fórmulas: '),
          'V. suelto = banco × (1 + e) · t. carga = cap ÷ prod. carguío × 60 · t. viaje = d ÷ v × 60 · ',
          'ciclo = carga + ida + descarga + retorno + acomodo · viajes/día = jornada × 60 × ef ÷ ciclo · ',
          'N° volquetes = ⌈prod. diaria del carguío ÷ prod. diaria del volquete⌉ · días = V. suelto ÷ prod. flota · viajes totales = ⌈V. suelto ÷ cap⌉.'))));
}

// ============================================================================
// Vista
// ============================================================================
const CALCS = [
  { id: 'acero', nombre: 'Acero → kg', construir: calcAcero },
  { id: 'muro', nombre: 'Muro de ladrillo', construir: calcMuro },
  { id: 'tarrajeo', nombre: 'Tarrajeo', construir: calcTarrajeo },
  { id: 'concreto', nombre: 'Concreto', construir: calcConcreto },
  { id: 'flota', nombre: 'Eliminación y flota', construir: calcFlota },
];

export function render(container, params) {
  raiz = container;
  if (params && params[0] && CALCS.some(c => c.id === params[0])) calcActiva = params[0];
  const activa = CALCS.find(c => c.id === calcActiva) || CALCS[0];

  container.append(
    el('div', { class: 'cabecera-vista' },
      el('div', {},
        el('h1', {}, 'Calculadoras de metrados y equipos'),
        el('div', { class: 'sub' }, 'Metrados auxiliares con resultados en vivo; envía el resultado directo al metrado de una partida del presupuesto')),
      el('div', { class: 'acciones' },
        el('a', { class: 'btn btn-sec', href: '#/biblioteca' }, icono('biblioteca', 15), 'Ver biblioteca técnica'))),
    el('div', { class: 'segmentos no-imprimir', style: { marginBottom: '18px' } },
      CALCS.map(c => el('button', {
        class: 'segmento' + (c === activa ? ' activo' : ''),
        onclick: () => {
          calcActiva = c.id;
          const destino = '#/calculadoras/' + c.id;
          if (location.hash !== destino) location.hash = destino; else rerender();
        },
      }, c.nombre))),
    activa.construir());
}
