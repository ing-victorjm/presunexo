// reportes.js — vista de reportes imprimibles y exportables a CSV.
// Reportes: memoria resumen, presupuesto, ACU completo, insumos, fórmula
// polinómica y cronograma con valorización.
import * as store from '../core/store.js';
import { TIPOS_INSUMO } from '../core/model.js';
import { arbolPlano, resumen, acuDetalle, insumosResumen, cronogramaCalc,
         distribucionPorTipo, topPartidas } from '../core/calc.js';
import { polinomicaEfectiva, coeficienteK, serieK, mesBase, validarMonomios } from '../core/polinomica.js';
import { mesesProyecto, resumenValorizaciones } from '../core/valorizacion.js';
import { AREAS_GEO, IU_CATALOGO, METADATA_INDICES, indiceIU, mesesDisponibles } from '../data/indices.js';
import { fmtMoney, fmtNum, fmtFecha, fmtMesAnio, hoyISO, round2 } from '../core/fmt.js';
import { el, icono, toast, descargar } from '../ui/components.js';

const REPORTES = [
  { id: 'memoria', nombre: 'Memoria resumen' },
  { id: 'presupuesto', nombre: 'Presupuesto' },
  { id: 'acu', nombre: 'ACU completo' },
  { id: 'insumos', nombre: 'Insumos' },
  { id: 'polinomica', nombre: 'Fórmula polinómica' },
  { id: 'cronograma', nombre: 'Cronograma y valorización' },
];

// Estado de UI (pestaña activa) a nivel de módulo: sobrevive a los re-render.
let pestana = 'memoria';

// 'YYYY-MM' → 'Ago 2026' (las claves de mes usan mes 1-12).
const fmtMesKey = k => {
  if (!k) return '—';
  const [y, m] = k.split('-').map(Number);
  return fmtMesAnio(y, m - 1);
};

export function render(container, params) {
  const p = store.getProyecto();
  if (!REPORTES.some(r => r.id === pestana)) pestana = 'memoria';
  const rerender = () => { container.replaceChildren(); render(container, params); };

  container.append(
    el('div', { class: 'cabecera-vista' },
      el('div', {},
        el('h1', {}, 'Reportes y memoria'),
        el('div', { class: 'sub' }, 'Documentos del presupuesto listos para imprimir o exportar')),
      el('div', { class: 'acciones' },
        el('button', { class: 'btn', onclick: () => exportarCSV(p) }, icono('exportar', 16), 'Exportar CSV'),
        el('button', { class: 'btn btn-primario', onclick: () => window.print() }, icono('imprimir', 16), 'Imprimir / PDF'))),

    el('div', { class: 'no-imprimir', style: { marginBottom: '16px' } },
      el('div', { class: 'segmentos', style: { flexWrap: 'wrap' } },
        REPORTES.map(r => el('button', {
          class: 'segmento' + (r.id === pestana ? ' activo' : ''),
          onclick: () => { pestana = r.id; rerender(); },
        }, r.nombre)))),

    cabeceraReporte(p));

  const cuerpos = {
    memoria: reporteMemoria,
    presupuesto: reportePresupuesto,
    acu: reporteACU,
    insumos: reporteInsumos,
    polinomica: reportePolinomica,
    cronograma: reporteCronograma,
  };
  container.append(...[].concat(cuerpos[pestana](p)));
}

// --- Cabecera imprimible del reporte ----------------------------------------
function cabeceraReporte(p) {
  const nombreReporte = (REPORTES.find(r => r.id === pestana) || REPORTES[0]).nombre;
  const areaNombre = AREAS_GEO[p.areaGeo] || 'sin definir';
  const personalizada = !!(p.polinomica && Array.isArray(p.polinomica.monomios) && p.polinomica.monomios.length);
  const dato = (etq, val) => el('div', { class: 'fila-esp', style: { padding: '3px 0' } },
    el('span', { class: 'texto-3' }, etq),
    el('span', { style: { textAlign: 'right' } }, val || '—'));

  return el('div', { class: 'panel' },
    el('div', { class: 'panel-cab' },
      el('div', {},
        el('h2', {}, p.nombre),
        el('div', { class: 'sub' }, 'Reporte: ' + nombreReporte)),
      el('span', { class: 'pill' }, 'PRESUNEXO')),
    el('div', { class: 'grid-2' },
      dato('Cliente', p.cliente),
      dato('Ubicación', p.ubicacion),
      dato('Área geográfica INEI', `${p.areaGeo} — ${areaNombre}`),
      dato('Fórmula polinómica', personalizada ? 'Personalizada' : 'Automática'),
      dato('Fecha de emisión', fmtFecha(hoyISO())),
      dato('Moneda', 'Soles (S/)')));
}

function vacio(mensaje) {
  return el('div', { class: 'panel' },
    el('div', { class: 'vacio' },
      icono('alerta', 30),
      el('div', {}, mensaje),
      el('div', { class: 'no-imprimir', style: { marginTop: '12px' } },
        el('a', { href: '#/presupuesto', class: 'btn btn-mini' }, 'Ir al presupuesto'))));
}

// ============================================================================
// 0) MEMORIA RESUMEN — reporte ejecutivo del proyecto
// ============================================================================
function reporteMemoria(p) {
  const plano = arbolPlano(p);
  if (!plano.length) return vacio('Este proyecto aún no tiene ítems. Crea títulos y partidas en la vista Presupuesto para generar la memoria.');

  const r = resumen(p);
  const cr = cronogramaCalc(p);
  const dist = distribucionPorTipo(p);
  const top = topPartidas(p, 10);
  const nPartidas = plano.filter(n => n.item.tipo === 'partida').length;

  return [
    memoriaKpis(p, r, cr, nPartidas),
    memoriaFicha(p, cr),
    el('div', { class: 'grid-2-min' },
      memoriaEconomico(p, r),
      memoriaEstructura(r, dist)),
    memoriaTop(top, r),
    memoriaPolinomica(p),
    memoriaCronograma(cr),
    memoriaSupuestos(p),
  ];
}

function memoriaKpis(p, r, cr, nPartidas) {
  const kpi = (etq, valor, sub, clase) => el('div', { class: 'kpi' + (clase ? ' ' + clase : '') },
    el('div', { class: 'kpi-etiqueta' }, etq),
    el('div', { class: 'kpi-valor' }, valor),
    sub ? el('div', { class: 'kpi-sub' }, sub) : null);

  return el('div', { class: 'grid-kpi' },
    kpi('Total presupuesto', fmtMoney(r.total), 'Incluye IGV', 'verde'),
    kpi('Costo directo', fmtMoney(r.costoDirecto), `GG + utilidad: ${fmtMoney(round2(r.gg + r.utilidad))}`),
    kpi('Plazo de ejecución', cr.fin > 0 ? `${cr.fin} días` : '—',
      cr.fin > 0 ? `Del ${fmtFecha(p.fechaInicio)} al ${fmtFecha(cr.finISO)}` : 'Sin programación', 'ambar'),
    kpi('Partidas', String(nPartidas), `${p.insumos.length} insumos en catálogo`, 'violeta'));
}

function memoriaFicha(p, cr) {
  const dato = (etq, val) => el('div', { class: 'fila-esp', style: { padding: '3px 0' } },
    el('span', { class: 'texto-3' }, etq),
    el('span', { style: { textAlign: 'right' } }, val || '—'));

  return el('div', { class: 'panel' },
    el('div', { class: 'panel-cab' },
      el('h2', {}, 'Ficha del proyecto')),
    el('div', { class: 'grid-2' },
      dato('Cliente', p.cliente),
      dato('Ubicación', p.ubicacion),
      dato('Inicio de obra', fmtFecha(p.fechaInicio)),
      dato('Fin estimado', cr.fin > 0 ? fmtFecha(cr.finISO) : '—'),
      dato('Plazo', cr.fin > 0 ? `${cr.fin} días calendario` : '—'),
      dato('Área geográfica INEI', `${p.areaGeo} — ${AREAS_GEO[p.areaGeo] || 'sin definir'}`)));
}

function memoriaEconomico(p, r) {
  const fila = (etq, monto, esTotal) => el('tr', { class: esTotal ? 'fila-total' : '' },
    el('td', {}, etq),
    el('td', { class: 'num', style: esTotal ? { fontSize: '13.5px' } : null }, fmtNum(monto, 2)),
    el('td', { class: 'num' }, r.total > 0 ? fmtNum(monto / r.total * 100, 2) + ' %' : '—'));

  return el('div', { class: 'panel' },
    el('div', { class: 'panel-cab' },
      el('h2', {}, 'Resumen económico'),
      el('span', { class: 'pill mono' }, fmtMoney(r.total))),
    el('div', { class: 'envoltorio-tabla' },
      el('table', { class: 'tabla' },
        el('thead', {}, el('tr', {},
          el('th', {}, 'Concepto'), el('th', { class: 'num' }, 'Monto (S/)'), el('th', { class: 'num' }, '% del total'))),
        el('tbody', {},
          fila('Costo directo', r.costoDirecto),
          fila(`Gastos generales (${fmtNum(Number(p.ggPct) || 0, 2)}%)`, r.gg),
          fila(`Utilidad (${fmtNum(Number(p.utilidadPct) || 0, 2)}%)`, r.utilidad),
          fila('Subtotal', r.subtotal),
          fila(`IGV (${fmtNum(Number(p.igvPct) || 0, 2)}%)`, r.igv),
          fila('TOTAL PRESUPUESTO', r.total, true)))));
}

function memoriaEstructura(r, dist) {
  const cd = r.costoDirecto;
  const tipos = Object.keys(TIPOS_INSUMO);
  const pct = t => (cd > 0 ? dist[t] / cd * 100 : 0);

  return el('div', { class: 'panel' },
    el('div', { class: 'panel-cab' },
      el('h2', {}, 'Estructura del costo directo'),
      el('span', { class: 'pill mono' }, fmtMoney(cd))),
    el('div', { class: 'barra-apilada', style: { marginBottom: '12px' } },
      tipos.filter(t => pct(t) > 0).map(t =>
        el('span', { style: { width: pct(t) + '%', background: TIPOS_INSUMO[t].color }, title: `${TIPOS_INSUMO[t].nombre}: ${fmtNum(pct(t), 1)} %` }))),
    el('div', { class: 'leyenda' },
      tipos.map(t => el('span', {},
        el('span', { class: 'punto', style: { background: TIPOS_INSUMO[t].color } }),
        `${TIPOS_INSUMO[t].nombre} ${fmtNum(pct(t), 1)} %`))),
    el('div', { class: 'envoltorio-tabla', style: { marginTop: '12px' } },
      el('table', { class: 'tabla' },
        el('thead', {}, el('tr', {},
          el('th', {}, 'Tipo'), el('th', { class: 'num' }, 'Monto (S/)'), el('th', { class: 'num' }, '% del C.D.'))),
        el('tbody', {},
          tipos.map(t => el('tr', {},
            el('td', {}, el('span', { class: `badge badge-${t}`, style: { marginRight: '8px' } }, t), TIPOS_INSUMO[t].nombre),
            el('td', { class: 'num' }, fmtNum(dist[t], 2)),
            el('td', { class: 'num' }, fmtNum(pct(t), 2) + ' %')))))));
}

function memoriaTop(top, r) {
  if (!top.length) return null;
  const cd = r.costoDirecto;
  return el('div', { class: 'panel' },
    el('div', { class: 'panel-cab' },
      el('div', {},
        el('h2', {}, 'Partidas de mayor incidencia'),
        el('div', { class: 'sub' }, `Top ${top.length} sobre el costo directo`))),
    el('div', { class: 'envoltorio-tabla' },
      el('table', { class: 'tabla' },
        el('thead', {}, el('tr', {},
          el('th', {}, 'Ítem'), el('th', {}, 'Descripción'), el('th', {}, 'Und'),
          el('th', { class: 'num' }, 'Parcial (S/)'), el('th', { class: 'num' }, 'Incidencia'), el('th', {}, ''))),
        el('tbody', {},
          top.map(n => {
            const pct = cd > 0 ? n.parcial / cd * 100 : 0;
            return el('tr', {},
              el('td', { class: 'cod' }, n.codigo),
              el('td', {}, n.item.descripcion),
              el('td', {}, n.item.unidad),
              el('td', { class: 'num' }, fmtNum(n.parcial, 2)),
              el('td', { class: 'num' }, fmtNum(pct, 2) + ' %'),
              el('td', { style: { width: '110px' } },
                el('div', { class: 'barra' }, el('span', { style: { width: Math.min(100, pct) + '%' } }))));
          })))));
}

function memoriaPolinomica(p) {
  const ef = polinomicaEfectiva(p);
  const contenido = [];

  if (!ef.monomios.length) {
    contenido.push(el('div', { class: 'vacio', style: { padding: '18px' } }, 'Sin monomios: el presupuesto no tiene montos que generen la fórmula.'));
  } else {
    const meses = mesesProyecto(p);
    const serie = meses.length ? serieK(p, meses) : [];

    const tMonomios = el('div', { class: 'envoltorio-tabla' },
      el('table', { class: 'tabla' },
        el('thead', {}, el('tr', {},
          el('th', {}, 'Monomio'), el('th', {}, 'Índices'), el('th', { class: 'num' }, 'Coef.'))),
        el('tbody', {},
          ef.monomios.map(m => el('tr', {},
            el('td', {}, m.nombre),
            el('td', {}, [...(m.ius || []), ...(m.iusExtra || [])].map(iu =>
              el('span', { class: 'badge-iu', style: { marginRight: '4px' } }, iu))),
            el('td', { class: 'num' }, (Number(m.coef) || 0).toFixed(3)))),
          el('tr', { class: 'fila-total' },
            el('td', { colspan: 2, style: { textAlign: 'right' } }, 'Σ coeficientes'),
            el('td', { class: 'num' }, ef.monomios.reduce((s, m) => s + (Number(m.coef) || 0), 0).toFixed(3))))));

    const tSerie = serie.length
      ? el('div', { class: 'envoltorio-tabla' },
          el('table', { class: 'tabla' },
            el('thead', {}, el('tr', {},
              el('th', {}, 'Mes'), el('th', { class: 'num' }, 'K'), el('th', {}, 'Estado'))),
            el('tbody', {},
              serie.map(s => el('tr', {},
                el('td', {}, fmtMesKey(s.mes)),
                el('td', { class: 'num' }, s.k.toFixed(3)),
                el('td', {}, s.incompleto
                  ? el('span', { class: 'pill pill-auto' }, 'provisional')
                  : el('span', { class: 'texto-3' }, 'con índice publicado')))))))
      : el('div', { class: 'vacio', style: { padding: '18px' } }, 'Sin cronograma: no hay meses para calcular la serie de K.');

    contenido.push(el('div', { class: 'grid-2-min' }, tMonomios, tSerie));
  }

  return el('div', { class: 'panel' },
    el('div', { class: 'panel-cab' },
      el('div', {},
        el('h2', {}, 'Fórmula polinómica de reajuste'),
        el('div', { class: 'sub' }, `Mes base (Io): ${fmtMesKey(mesBase(p))} · DS 011-79-VC · base de índices ${METADATA_INDICES.base}`)),
      ef.personalizada
        ? el('span', { class: 'pill' }, 'PERSONALIZADA')
        : el('span', { class: 'pill pill-auto' }, 'AUTOMÁTICA')),
    contenido);
}

function memoriaCronograma(cr) {
  if (!cr.meses.length) {
    return el('div', { class: 'panel' },
      el('div', { class: 'panel-cab' }, el('h2', {}, 'Cronograma valorizado')),
      el('div', { class: 'vacio', style: { padding: '18px' } }, 'No hay partidas programadas. Define duraciones en la vista Programación.'));
  }
  return el('div', { class: 'panel' },
    el('div', { class: 'panel-cab' },
      el('h2', {}, 'Cronograma valorizado mensual'),
      el('span', { class: 'pill' }, `${cr.meses.length} ${cr.meses.length === 1 ? 'mes' : 'meses'}`)),
    el('div', { class: 'envoltorio-tabla' },
      el('table', { class: 'tabla' },
        el('thead', {}, el('tr', {},
          el('th', {}, 'Mes'), el('th', { class: 'num' }, 'Valorización (S/)'), el('th', { class: 'num' }, '% Acumulado'))),
        el('tbody', {},
          cr.meses.map(m => el('tr', {},
            el('td', {}, fmtMesAnio(m.anio, m.mes)),
            el('td', { class: 'num' }, fmtNum(m.monto, 2)),
            el('td', { class: 'num' }, fmtNum(m.pctAcum, 2) + ' %'))),
          el('tr', { class: 'fila-total' },
            el('td', {}, 'COSTO DIRECTO'),
            el('td', { class: 'num' }, fmtNum(cr.costoDirecto, 2)),
            el('td', { class: 'num' }, '100.00 %'))))));
}

function memoriaSupuestos(p) {
  const b = (txt) => el('b', {}, txt);
  return el('div', { class: 'panel' },
    el('div', { class: 'panel-cab' }, el('h2', {}, 'Supuestos y notas')),
    el('div', { class: 'col', style: { gap: '10px' } },
      el('div', { class: 'nota' },
        'Parámetros del presupuesto: jornada de ', b(`${fmtNum(p.jornada || 8, 2)} h`),
        ', gastos generales ', b(`${fmtNum(Number(p.ggPct) || 0, 2)} %`),
        ', utilidad ', b(`${fmtNum(Number(p.utilidadPct) || 0, 2)} %`),
        ', IGV ', b(`${fmtNum(Number(p.igvPct) || 0, 2)} %`),
        '. Adelanto directo ', b(`${fmtNum(Number(p.adelantoDirectoPct) || 0, 2)} %`),
        ' y adelanto para materiales ', b(`${fmtNum(Number(p.adelantoMaterialesPct) || 0, 2)} %`), '.'),
      el('div', { class: 'nota' },
        'Índices de precios: ', b(METADATA_INDICES.base),
        ` · serie del área geográfica ${METADATA_INDICES.areaSerie} · último mes publicado `,
        b(fmtMesKey(METADATA_INDICES.ultimoPublicado)), '. Fuentes: ',
        METADATA_INDICES.fuentes.map((f, i) => [i > 0 ? ' · ' : '', b(f.rj), ` (${f.detalle})`]), '.'),
      p.areaGeo !== METADATA_INDICES.areaSerie
        ? el('div', { class: 'nota nota-alerta' },
            'El proyecto está en el área geográfica ', b(String(p.areaGeo)),
            ` (${AREAS_GEO[p.areaGeo] || 'sin definir'}), pero la serie de índices cargada corresponde al área ${METADATA_INDICES.areaSerie} (${AREAS_GEO[METADATA_INDICES.areaSerie]}). ` +
            'Registra los índices de tu área desde Fórmula polinómica → Índices INEI antes de usar el reajuste en un contrato.')
        : null,
      el('div', { class: 'nota' },
        'Los rendimientos, cuadrillas y porcentajes de desperdicio provienen de valores referenciales de la biblioteca técnica ' +
        '(edificación urbana en costa, jornada de 8 h); deben validarse contra las condiciones reales de la obra. ' +
        'Los precios de insumos no incluyen IGV y corresponden a la fecha de elaboración del presupuesto.')));
}

// ============================================================================
// 1) REPORTE PRESUPUESTO
// ============================================================================
function reportePresupuesto(p) {
  const plano = arbolPlano(p);
  if (!plano.length) return vacio('Este proyecto aún no tiene ítems. Crea títulos y partidas en la vista Presupuesto.');
  const r = resumen(p);

  const filas = plano.map(n => {
    const esTitulo = n.item.tipo === 'titulo';
    return el('tr', { class: esTitulo ? 'fila-titulo' + (n.nivel === 1 ? ' nivel-1' : '') : 'fila-partida' },
      el('td', { class: 'cod' }, n.codigo),
      el('td', {}, el('span', { class: 'descripcion', style: { paddingLeft: ((n.nivel - 1) * 18) + 'px' } }, n.item.descripcion)),
      el('td', {}, esTitulo ? '' : n.item.unidad),
      el('td', { class: 'num' }, esTitulo ? '' : fmtNum(n.item.metrado, 2)),
      el('td', { class: 'num' }, esTitulo ? '' : fmtNum(n.pu, 2)),
      el('td', { class: 'num' }, fmtNum(n.parcial, 2)));
  });

  const pie = (etq, monto, esTotal) => el('tr', { class: esTotal ? 'fila-total' : '' },
    el('td', { colspan: 5, style: { textAlign: 'right', fontWeight: '600' } }, etq),
    el('td', { class: 'num', style: esTotal ? { fontSize: '13.5px' } : null }, fmtNum(monto, 2)));

  return el('div', { class: 'envoltorio-tabla' },
    el('table', { class: 'tabla' },
      el('thead', {}, el('tr', {},
        el('th', {}, 'Ítem'), el('th', {}, 'Descripción'), el('th', {}, 'Und'),
        el('th', { class: 'num' }, 'Metrado'), el('th', { class: 'num' }, 'P.U. (S/)'), el('th', { class: 'num' }, 'Parcial (S/)'))),
      el('tbody', {},
        filas,
        pie('COSTO DIRECTO', r.costoDirecto),
        pie(`GASTOS GENERALES (${fmtNum(Number(p.ggPct) || 0, 2)}%)`, r.gg),
        pie(`UTILIDAD (${fmtNum(Number(p.utilidadPct) || 0, 2)}%)`, r.utilidad),
        pie('SUBTOTAL', r.subtotal),
        pie(`IGV (${fmtNum(Number(p.igvPct) || 0, 2)}%)`, r.igv),
        pie('TOTAL PRESUPUESTO', r.total, true))));
}

// ============================================================================
// 2) REPORTE ACU COMPLETO
// ============================================================================
function reporteACU(p) {
  const partidas = arbolPlano(p).filter(n => n.item.tipo === 'partida');
  if (!partidas.length) return vacio('No hay partidas con análisis de costos. Crea partidas en la vista Presupuesto.');

  const hayDesperdicio = partidas.some(n =>
    (n.item.acu || []).some(rec => rec.modo === 'directo' && Number(rec.desperdicioPct) > 0));

  const paneles = partidas.map(n => {
    const it = n.item;
    const det = acuDetalle(it, p);
    return el('div', { class: 'panel' },
      el('div', { class: 'panel-cab' },
        el('div', {},
          el('h2', {}, el('span', { class: 'cod', style: { marginRight: '8px' } }, n.codigo), it.descripcion),
          el('div', { class: 'sub' },
            `Unidad: ${it.unidad || '—'} · Metrado: ${fmtNum(it.metrado, 2)} · ` +
            `Rendimiento: ${fmtNum(it.rendimiento, 2)} ${it.unidad || 'und'}/día · Jornada: ${fmtNum(p.jornada || 8, 2)} h`)),
        el('span', { class: 'pill mono' }, 'P.U. ' + fmtMoney(det.pu))),
      tablaACU(det));
  });

  return [
    hayDesperdicio
      ? el('div', { class: 'nota', style: { marginBottom: '16px' } },
          'En los recursos con ', el('b', {}, 'Desp. %'), ' la cantidad mostrada ya incluye el desperdicio (cantidad neta × (1 + d/100)).')
      : null,
    ...paneles,
  ];
}

function tablaACU(det) {
  if (!det.filas.length) {
    return el('div', { class: 'vacio', style: { padding: '18px' } }, 'Esta partida no tiene recursos en su ACU.');
  }
  const desp = f => (f.recurso.modo === 'directo' && Number(f.recurso.desperdicioPct) > 0
    ? fmtNum(f.recurso.desperdicioPct, 2) + ' %' : '');
  const cuerpo = [];
  for (const t of Object.keys(TIPOS_INSUMO)) {
    const filas = det.filas.filter(f => f.insumo.tipo === t);
    if (!filas.length) continue;
    cuerpo.push(el('tr', { class: 'fila-titulo' },
      el('td', { colspan: 7 }, el('span', { class: 'descripcion' }, TIPOS_INSUMO[t].nombre))));
    for (const f of filas) {
      cuerpo.push(el('tr', {},
        el('td', {}, f.insumo.descripcion),
        el('td', {}, f.insumo.unidad),
        el('td', { class: 'num' }, f.recurso.modo === 'rendimiento' ? fmtNum(f.recurso.cuadrilla, 2) : '—'),
        el('td', { class: 'num' }, f.esPctMO ? fmtNum(f.cantidad, 2) + ' %' : fmtNum(f.cantidad, 4)),
        el('td', { class: 'num' }, desp(f)),
        el('td', { class: 'num' }, fmtNum(f.precio, 2)),
        el('td', { class: 'num' }, fmtNum(f.parcial, 2))));
    }
    cuerpo.push(el('tr', {},
      el('td', { colspan: 6, style: { textAlign: 'right' }, class: 'texto-2' }, 'Subtotal ' + TIPOS_INSUMO[t].nombre.toLowerCase()),
      el('td', { class: 'num', style: { fontWeight: '600' } }, fmtNum(det.porTipo[t], 2))));
  }
  cuerpo.push(el('tr', { class: 'fila-total' },
    el('td', { colspan: 6, style: { textAlign: 'right' } }, 'Costo unitario directo'),
    el('td', { class: 'num' }, fmtNum(det.pu, 2))));

  return el('div', { class: 'envoltorio-tabla' },
    el('table', { class: 'tabla' },
      el('thead', {}, el('tr', {},
        el('th', {}, 'Recurso'), el('th', {}, 'Und'), el('th', { class: 'num' }, 'Cuadrilla'),
        el('th', { class: 'num' }, 'Cantidad'), el('th', { class: 'num' }, 'Desp. %'),
        el('th', { class: 'num' }, 'Precio (S/)'), el('th', { class: 'num' }, 'Parcial (S/)'))),
      el('tbody', {}, cuerpo)));
}

// ============================================================================
// 3) REPORTE INSUMOS
// ============================================================================
function reporteInsumos(p) {
  const res = insumosResumen(p);
  if (!res.length) return vacio('No hay insumos utilizados en el presupuesto. Agrega recursos a los ACU de tus partidas.');

  const salida = [];
  let totalGeneral = 0;
  for (const t of Object.keys(TIPOS_INSUMO)) {
    const filas = res.filter(f => f.insumo.tipo === t);
    if (!filas.length) continue;
    const subtotal = round2(filas.reduce((s, f) => s + f.parcial, 0));
    totalGeneral = round2(totalGeneral + subtotal);

    salida.push(el('div', { class: 'panel' },
      el('div', { class: 'panel-cab' },
        el('h2', {}, el('span', { class: `badge badge-${t}`, style: { marginRight: '8px' } }, t), TIPOS_INSUMO[t].nombre),
        el('span', { class: 'pill mono' }, fmtMoney(subtotal))),
      el('div', { class: 'envoltorio-tabla' },
        el('table', { class: 'tabla' },
          el('thead', {}, el('tr', {},
            el('th', {}, 'Código'), el('th', {}, 'IU'), el('th', {}, 'Descripción'), el('th', {}, 'Und'),
            el('th', { class: 'num' }, 'Precio (S/)'), el('th', { class: 'num' }, 'Cantidad requerida'), el('th', { class: 'num' }, 'Parcial (S/)'))),
          el('tbody', {},
            filas.map(f => el('tr', {},
              el('td', { class: 'cod' }, f.insumo.codigo || '—'),
              el('td', {}, el('span', { class: 'badge-iu', title: IU_CATALOGO[f.insumo.iu]?.nombre || '' }, f.insumo.iu || '—')),
              el('td', {}, f.insumo.descripcion),
              el('td', {}, f.insumo.unidad),
              el('td', { class: 'num' }, fmtNum(f.insumo.precio, 2)),
              el('td', { class: 'num' }, f.cantidad == null ? '— (%MO)' : fmtNum(f.cantidad, 4)),
              el('td', { class: 'num' }, fmtNum(f.parcial, 2)))),
            el('tr', { class: 'fila-total' },
              el('td', { colspan: 6, style: { textAlign: 'right' } }, 'Subtotal ' + TIPOS_INSUMO[t].nombre.toLowerCase()),
              el('td', { class: 'num' }, fmtNum(subtotal, 2))))))));
  }

  salida.push(el('div', { class: 'panel' },
    el('div', { class: 'fila-esp' },
      el('strong', {}, 'TOTAL GENERAL DE INSUMOS (costo directo)'),
      el('strong', { class: 'mono' }, fmtMoney(totalGeneral)))));
  return salida;
}

// ============================================================================
// 4) REPORTE FÓRMULA POLINÓMICA
// ============================================================================
function reportePolinomica(p) {
  const ef = polinomicaEfectiva(p);
  if (!ef.monomios.length) return vacio('El presupuesto no tiene montos suficientes para generar la fórmula polinómica.');

  const base = mesBase(p);
  const errores = validarMonomios(ef.monomios);
  const meses = mesesProyecto(p);
  const serie = meses.length ? serieK(p, meses) : [];
  const ultimoMes = mesesDisponibles().slice(-1)[0] || METADATA_INDICES.ultimoPublicado;
  const sumaCoef = ef.monomios.reduce((s, m) => s + (Number(m.coef) || 0), 0);

  // --- Monomios --------------------------------------------------------------
  const tMonomios = el('div', { class: 'panel' },
    el('div', { class: 'panel-cab' },
      el('div', {},
        el('h2', {}, 'Monomios de la fórmula'),
        el('div', { class: 'sub' }, `DS 011-79-VC: máximo 8 monomios, coeficiente ≥ 0.050, Σ = 1.000 · Mes base (Io): ${fmtMesKey(base)}`)),
      ef.personalizada
        ? el('span', { class: 'pill' }, 'PERSONALIZADA')
        : el('span', { class: 'pill pill-auto' }, 'AUTOMÁTICA')),
    el('div', { class: 'envoltorio-tabla' },
      el('table', { class: 'tabla' },
        el('thead', {}, el('tr', {},
          el('th', {}, 'N°'), el('th', {}, 'Monomio'), el('th', {}, 'Índices agrupados'),
          el('th', {}, 'IU de cálculo'), el('th', { class: 'num' }, 'Coeficiente'), el('th', { class: 'num' }, 'Monto (S/)'))),
        el('tbody', {},
          ef.monomios.map((m, i) => el('tr', {},
            el('td', { class: 'cod' }, String(i + 1)),
            el('td', {}, m.nombre),
            el('td', {},
              (m.ius || []).map(iu => el('span', { class: 'badge-iu', style: { marginRight: '4px' }, title: IU_CATALOGO[iu]?.nombre || '' }, iu)),
              (m.iusExtra || []).length
                ? el('span', { class: 'texto-3', title: 'Absorbidos en el monomio: ' + m.iusExtra.join(', ') }, `+${m.iusExtra.length}`)
                : null),
            el('td', {}, el('span', { class: 'badge-iu' }, m.iuCalculo || (m.ius && m.ius[0]) || '—')),
            el('td', { class: 'num' }, (Number(m.coef) || 0).toFixed(3)),
            el('td', { class: 'num' }, m.monto != null ? fmtNum(m.monto, 2) : '—'))),
          el('tr', { class: 'fila-total' },
            el('td', { colspan: 4, style: { textAlign: 'right' } }, 'Σ coeficientes'),
            el('td', { class: 'num' }, sumaCoef.toFixed(3)),
            el('td', { class: 'num' }, ''))))),
    errores.length
      ? el('div', { class: 'nota nota-alerta', style: { marginTop: '12px' } },
          el('b', {}, 'Fórmula no conforme al DS 011-79-VC: '), errores.join(' '))
      : null);

  // --- Notación K = … --------------------------------------------------------
  const terminos = ef.monomios.map(m => {
    const iu = m.iuCalculo || (m.ius && m.ius[0]) || '39';
    return `${(Number(m.coef) || 0).toFixed(3)}·(I${iu}<sub>r</sub>/I${iu}<sub>o</sub>)`;
  }).join(' + ');
  const fFormula = el('div', { class: 'panel' },
    el('div', { class: 'panel-cab' },
      el('div', {},
        el('h2', {}, 'Expresión de la fórmula'),
        el('div', { class: 'sub' }, 'Ir = índice del mes de reajuste · Io = índice del mes base'))),
    el('div', {
      class: 'mono',
      style: { fontSize: '13px', lineHeight: '2', padding: '6px 2px', overflowWrap: 'anywhere' },
      html: 'K = ' + terminos,
    }));

  // --- Índices usados (base y último) ---------------------------------------
  const iusUsados = [...new Set(ef.monomios.map(m => m.iuCalculo || (m.ius && m.ius[0]) || '39'))];
  const tIndices = el('div', { class: 'panel' },
    el('div', { class: 'panel-cab' },
      el('div', {},
        el('h2', {}, 'Índices unificados utilizados'),
        el('div', { class: 'sub' },
          `Serie del área ${METADATA_INDICES.areaSerie} (${AREAS_GEO[METADATA_INDICES.areaSerie]}) · ${METADATA_INDICES.base} · último publicado: ${fmtMesKey(ultimoMes)}`))),
    el('div', { class: 'envoltorio-tabla' },
      el('table', { class: 'tabla' },
        el('thead', {}, el('tr', {},
          el('th', {}, 'IU'), el('th', {}, 'Descripción'),
          el('th', { class: 'num' }, `Índice base (${fmtMesKey(base)})`),
          el('th', { class: 'num' }, 'Último índice'), el('th', { class: 'num' }, 'Variación'))),
        el('tbody', {},
          iusUsados.map(iu => {
            const cat = IU_CATALOGO[iu];
            const iBase = indiceIU(iu, base);
            const iUlt = indiceIU(iu, ultimoMes);
            const varPct = iBase && iUlt && iBase.valor > 0 ? (iUlt.valor / iBase.valor - 1) * 100 : null;
            return el('tr', {},
              el('td', {}, el('span', { class: 'badge-iu' }, iu)),
              el('td', {}, (cat?.nombre || `IU ${iu}`),
                cat?.confirmar ? el('span', { class: 'texto-3' }, ' (verificar en la relación oficial)') : null),
              el('td', { class: 'num' }, iBase ? `${fmtNum(iBase.valor, 2)} (${fmtMesKey(iBase.mes)})` : '—'),
              el('td', { class: 'num' }, iUlt ? `${fmtNum(iUlt.valor, 2)} (${fmtMesKey(iUlt.mes)})` : '—'),
              el('td', { class: 'num' }, varPct == null ? '—' : (varPct >= 0 ? '+' : '') + fmtNum(varPct, 2) + ' %'));
          })))));

  // --- Serie de K mensual ----------------------------------------------------
  const tSerie = el('div', { class: 'panel' },
    el('div', { class: 'panel-cab' },
      el('div', {},
        el('h2', {}, 'Serie de K mensual'),
        el('div', { class: 'sub' }, 'K a 3 decimales sobre los meses del cronograma del proyecto'))),
    serie.length
      ? el('div', { class: 'envoltorio-tabla' },
          el('table', { class: 'tabla' },
            el('thead', {}, el('tr', {},
              el('th', {}, 'Mes'), el('th', { class: 'num' }, 'K'), el('th', {}, 'Estado de índices'))),
            el('tbody', {},
              serie.map(s => el('tr', {},
                el('td', {}, fmtMesKey(s.mes)),
                el('td', { class: 'num' }, s.k.toFixed(3)),
                el('td', {}, s.incompleto
                  ? el('span', { class: 'pill pill-auto' }, 'provisional (último índice disponible)')
                  : el('span', { class: 'texto-3' }, 'índices publicados')))))))
      : el('div', { class: 'vacio', style: { padding: '18px' } }, 'Sin cronograma: no hay meses del proyecto para calcular K.'),
    serie.some(s => s.incompleto)
      ? el('div', { class: 'nota', style: { marginTop: '12px' } },
          'En los meses marcados como provisionales el INEI aún no publica el índice del mes; el K usa el último índice disponible y deberá recalcularse al publicarse (práctica usual de reajuste provisional).')
      : null);

  return [tMonomios, fFormula, tIndices, tSerie];
}

// ============================================================================
// 5) REPORTE CRONOGRAMA Y VALORIZACIÓN
// ============================================================================
function reporteCronograma(p) {
  const cr = cronogramaCalc(p);
  if (!cr.barras.length) return vacio('No hay partidas programadas. Define duraciones y fechas en la vista Programación.');

  const tPartidas = el('div', { class: 'panel' },
    el('div', { class: 'panel-cab' },
      el('div', {},
        el('h2', {}, 'Programación de partidas'),
        el('div', { class: 'sub' }, `Inicio de obra: ${fmtFecha(p.fechaInicio)} · Fin estimado: ${fmtFecha(cr.finISO)} · ${cr.fin} días calendario`))),
    el('div', { class: 'envoltorio-tabla' },
      el('table', { class: 'tabla' },
        el('thead', {}, el('tr', {},
          el('th', {}, 'Ítem'), el('th', {}, 'Partida'), el('th', {}, 'Inicio'), el('th', {}, 'Fin'),
          el('th', { class: 'num' }, 'Duración (d)'), el('th', { class: 'num' }, 'Parcial (S/)'))),
        el('tbody', {},
          cr.barras.map(b => el('tr', {},
            el('td', { class: 'cod' }, b.nodo.codigo),
            el('td', {}, b.nodo.item.descripcion),
            el('td', {}, fmtFecha(b.inicioISO)),
            el('td', {}, fmtFecha(b.finISO)),
            el('td', { class: 'num' }, fmtNum(b.finDias - b.inicioDias, 0)),
            el('td', { class: 'num' }, fmtNum(b.nodo.parcial, 2)))),
          el('tr', { class: 'fila-total' },
            el('td', { colspan: 5, style: { textAlign: 'right' } }, 'COSTO DIRECTO'),
            el('td', { class: 'num' }, fmtNum(cr.costoDirecto, 2)))))));

  const tMeses = el('div', { class: 'panel' },
    el('div', { class: 'panel-cab' },
      el('h2', {}, 'Cronograma valorizado (programado)'),
      el('span', { class: 'pill' }, `${cr.meses.length} ${cr.meses.length === 1 ? 'mes' : 'meses'}`)),
    el('div', { class: 'envoltorio-tabla' },
      el('table', { class: 'tabla' },
        el('thead', {}, el('tr', {},
          el('th', {}, 'Mes'), el('th', { class: 'num' }, 'Valorización (S/)'),
          el('th', { class: 'num' }, 'Acumulado (S/)'), el('th', { class: 'num' }, '% Acumulado'))),
        el('tbody', {},
          cr.meses.map(m => el('tr', {},
            el('td', {}, fmtMesAnio(m.anio, m.mes)),
            el('td', { class: 'num' }, fmtNum(m.monto, 2)),
            el('td', { class: 'num' }, fmtNum(m.acumulado, 2)),
            el('td', { class: 'num' }, fmtNum(m.pctAcum, 2) + ' %')))))));

  // --- Resumen de valorizaciones (bruta, reajuste, neto, total, saldo) -------
  const rv = resumenValorizaciones(p);
  const algunIncompleto = rv.meses.some(v => v.kIncompleto);
  let sBruta = 0, sReaj = 0, sAmort = 0, sNeto = 0, sIgv = 0, sTotal = 0;
  const filasRV = rv.meses.map(v => {
    const amort = round2(v.amortAD + v.amortAM);
    sBruta = round2(sBruta + v.bruta); sReaj = round2(sReaj + v.reajuste);
    sAmort = round2(sAmort + amort); sNeto = round2(sNeto + v.neto);
    sIgv = round2(sIgv + v.igv); sTotal = round2(sTotal + v.total);
    return el('tr', {},
      el('td', {}, fmtMesKey(v.mes)),
      el('td', { class: 'num' }, fmtNum(v.bruta, 2)),
      el('td', { class: 'num' }, v.k.toFixed(3) + (v.kIncompleto ? ' *' : '')),
      el('td', { class: 'num' }, fmtNum(v.reajuste, 2)),
      el('td', { class: 'num' }, fmtNum(amort, 2)),
      el('td', { class: 'num' }, fmtNum(v.neto, 2)),
      el('td', { class: 'num' }, fmtNum(v.igv, 2)),
      el('td', { class: 'num' }, fmtNum(v.total, 2)),
      el('td', { class: 'num' }, fmtNum(v.acumBruta, 2)),
      el('td', { class: 'num' }, fmtNum(v.pctAvance, 2) + ' %'),
      el('td', { class: 'num' }, fmtNum(v.saldo, 2)));
  });
  const ultimoRV = rv.meses[rv.meses.length - 1];

  const tValorizaciones = el('div', { class: 'panel' },
    el('div', { class: 'panel-cab' },
      el('div', {},
        el('h2', {}, 'Resumen de valorizaciones'),
        el('div', { class: 'sub' },
          `Reajuste con fórmula polinómica (mes base ${fmtMesKey(mesBase(p))}) y amortización de adelantos · ` +
          'Neto = Bruta + Reajuste − Amortizaciones · Total = Neto + IGV'))),
    rv.meses.length
      ? el('div', { class: 'envoltorio-tabla' },
          el('table', { class: 'tabla' },
            el('thead', {}, el('tr', {},
              el('th', {}, 'Mes'), el('th', { class: 'num' }, 'Bruta (S/)'), el('th', { class: 'num' }, 'K'),
              el('th', { class: 'num' }, 'Reajuste (S/)'), el('th', { class: 'num' }, 'Amort. (S/)'),
              el('th', { class: 'num' }, 'Neto (S/)'), el('th', { class: 'num' }, 'IGV (S/)'),
              el('th', { class: 'num' }, 'Total (S/)'), el('th', { class: 'num' }, 'Acum. bruta (S/)'),
              el('th', { class: 'num' }, '% Avance'), el('th', { class: 'num' }, 'Saldo C.D. (S/)'))),
            el('tbody', {},
              filasRV,
              el('tr', { class: 'fila-total' },
                el('td', {}, 'TOTAL'),
                el('td', { class: 'num' }, fmtNum(sBruta, 2)),
                el('td', { class: 'num' }, ''),
                el('td', { class: 'num' }, fmtNum(sReaj, 2)),
                el('td', { class: 'num' }, fmtNum(sAmort, 2)),
                el('td', { class: 'num' }, fmtNum(sNeto, 2)),
                el('td', { class: 'num' }, fmtNum(sIgv, 2)),
                el('td', { class: 'num' }, fmtNum(sTotal, 2)),
                el('td', { class: 'num' }, ultimoRV ? fmtNum(ultimoRV.acumBruta, 2) : ''),
                el('td', { class: 'num' }, ultimoRV ? fmtNum(ultimoRV.pctAvance, 2) + ' %' : ''),
                el('td', { class: 'num' }, ultimoRV ? fmtNum(ultimoRV.saldo, 2) : '')))))
      : el('div', { class: 'vacio', style: { padding: '18px' } }, 'Sin meses de valorización.'),
    algunIncompleto
      ? el('div', { class: 'nota', style: { marginTop: '12px' } },
          '* K provisional: el INEI aún no publica índices de ese mes; se usa el último disponible y el reajuste deberá regularizarse.')
      : null);

  return [tPartidas, tMeses, tValorizaciones];
}

// ============================================================================
// Exportación CSV (separador ';', punto decimal, BOM UTF-8)
// ============================================================================
const q = s => `"${String(s == null ? '' : s).replace(/"/g, '""')}"`;
const n2 = v => (isFinite(Number(v)) ? Number(v) : 0).toFixed(2);
const n4 = v => (isFinite(Number(v)) ? Number(v) : 0).toFixed(4);

function bajarCSV(nombre, lineas) {
  descargar(nombre, '﻿' + lineas.join('\r\n'), 'text/csv');
  toast(`CSV exportado: ${nombre}`);
}

function exportarCSV(p) {
  const fecha = hoyISO();
  if (pestana === 'memoria') return csvPresupuesto(p, fecha);   // la memoria exporta el presupuesto
  if (pestana === 'presupuesto') return csvPresupuesto(p, fecha);
  if (pestana === 'acu') return csvACU(p, fecha);
  if (pestana === 'insumos') return csvInsumos(p, fecha);
  if (pestana === 'polinomica') return csvPolinomica(p, fecha);
  return csvCronograma(p, fecha);
}

function csvPresupuesto(p, fecha) {
  const plano = arbolPlano(p);
  if (!plano.length) return toast('No hay ítems para exportar', 'error');
  const r = resumen(p);
  const lineas = ['Ítem;Descripción;Und;Metrado;P.U.;Parcial'];
  for (const n of plano) {
    const esTitulo = n.item.tipo === 'titulo';
    lineas.push([
      q(n.codigo), q(n.item.descripcion), q(esTitulo ? '' : n.item.unidad),
      esTitulo ? '' : n4(n.item.metrado), esTitulo ? '' : n2(n.pu), n2(n.parcial),
    ].join(';'));
  }
  const pie = (etq, monto) => lineas.push([q(''), q(etq), q(''), '', '', n2(monto)].join(';'));
  pie('COSTO DIRECTO', r.costoDirecto);
  pie(`GASTOS GENERALES (${n2(Number(p.ggPct) || 0)}%)`, r.gg);
  pie(`UTILIDAD (${n2(Number(p.utilidadPct) || 0)}%)`, r.utilidad);
  pie('SUBTOTAL', r.subtotal);
  pie(`IGV (${n2(Number(p.igvPct) || 0)}%)`, r.igv);
  pie('TOTAL PRESUPUESTO', r.total);
  bajarCSV(`presupuesto-${fecha}.csv`, lineas);
}

function csvACU(p, fecha) {
  const partidas = arbolPlano(p).filter(n => n.item.tipo === 'partida');
  if (!partidas.length) return toast('No hay partidas para exportar', 'error');
  const lineas = ['Ítem;Partida;Und;Metrado;Rendimiento;P.U.;Tipo;Recurso;Und recurso;Cuadrilla;Cantidad;Desp. %;Precio;Parcial'];
  for (const n of partidas) {
    const it = n.item;
    const det = acuDetalle(it, p);
    const base = [q(n.codigo), q(it.descripcion), q(it.unidad), n4(it.metrado), n2(it.rendimiento), n2(det.pu)];
    if (!det.filas.length) {
      lineas.push([...base, q(''), q(''), q(''), '', '', '', '', ''].join(';'));
      continue;
    }
    for (const f of det.filas) {
      lineas.push([...base,
        q(f.insumo.tipo), q(f.insumo.descripcion), q(f.insumo.unidad),
        f.recurso.modo === 'rendimiento' ? n2(f.recurso.cuadrilla) : '',
        n4(f.cantidad),
        f.recurso.modo === 'directo' && Number(f.recurso.desperdicioPct) > 0 ? n2(f.recurso.desperdicioPct) : '',
        n2(f.precio), n2(f.parcial),
      ].join(';'));
    }
  }
  bajarCSV(`acu-${fecha}.csv`, lineas);
}

function csvInsumos(p, fecha) {
  const res = insumosResumen(p);
  if (!res.length) return toast('No hay insumos para exportar', 'error');
  const lineas = ['Tipo;Código;IU;Descripción;Und;Precio;Cantidad requerida;Parcial'];
  let totalGeneral = 0;
  for (const t of Object.keys(TIPOS_INSUMO)) {
    const filas = res.filter(f => f.insumo.tipo === t);
    if (!filas.length) continue;
    const subtotal = round2(filas.reduce((s, f) => s + f.parcial, 0));
    totalGeneral = round2(totalGeneral + subtotal);
    for (const f of filas) {
      lineas.push([
        q(t), q(f.insumo.codigo), q(f.insumo.iu || ''), q(f.insumo.descripcion), q(f.insumo.unidad),
        n2(f.insumo.precio), f.cantidad == null ? '' : n4(f.cantidad), n2(f.parcial),
      ].join(';'));
    }
    lineas.push([q(t), q(''), q(''), q(`SUBTOTAL ${TIPOS_INSUMO[t].nombre.toUpperCase()}`), q(''), '', '', n2(subtotal)].join(';'));
  }
  lineas.push([q(''), q(''), q(''), q('TOTAL GENERAL'), q(''), '', '', n2(totalGeneral)].join(';'));
  bajarCSV(`insumos-${fecha}.csv`, lineas);
}

function csvPolinomica(p, fecha) {
  const ef = polinomicaEfectiva(p);
  if (!ef.monomios.length) return toast('No hay monomios para exportar', 'error');
  const lineas = ['N°;Monomio;Índices agrupados;IU de cálculo;Coeficiente;Monto (S/)'];
  ef.monomios.forEach((m, i) => {
    lineas.push([
      i + 1, q(m.nombre),
      q([...(m.ius || []), ...(m.iusExtra || [])].join(' ')),
      q(m.iuCalculo || (m.ius && m.ius[0]) || ''),
      (Number(m.coef) || 0).toFixed(3),
      m.monto != null ? n2(m.monto) : '',
    ].join(';'));
  });
  const suma = ef.monomios.reduce((s, m) => s + (Number(m.coef) || 0), 0);
  lineas.push(['', q('Σ COEFICIENTES'), q(''), q(''), suma.toFixed(3), ''].join(';'));
  lineas.push(['', q('MES BASE (Io)'), q(fmtMesKey(mesBase(p))), q(''), '', ''].join(';'));
  bajarCSV(`polinomica-${fecha}.csv`, lineas);
}

function csvCronograma(p, fecha) {
  const rv = resumenValorizaciones(p);
  if (!rv.meses.length) return toast('No hay valorización mensual para exportar', 'error');
  const cr = cronogramaCalc(p);
  const prog = new Map(cr.meses.map(m => [`${m.anio}-${String(m.mes + 1).padStart(2, '0')}`, m]));
  const lineas = ['Mes;Programado;Programado acumulado;% Programado acum.;Bruta;K;Reajuste;Amort. adelanto directo;Amort. materiales;Neto;IGV;Total;Acumulado bruta;% Avance;Saldo C.D.'];
  for (const v of rv.meses) {
    const pm = prog.get(v.mes);
    lineas.push([
      q(fmtMesKey(v.mes)),
      pm ? n2(pm.monto) : '', pm ? n2(pm.acumulado) : '', pm ? n2(pm.pctAcum) : '',
      n2(v.bruta), v.k.toFixed(3), n2(v.reajuste), n2(v.amortAD), n2(v.amortAM),
      n2(v.neto), n2(v.igv), n2(v.total), n2(v.acumBruta), n2(v.pctAvance), n2(v.saldo),
    ].join(';'));
  }
  bajarCSV(`cronograma-valorizacion-${fecha}.csv`, lineas);
}
