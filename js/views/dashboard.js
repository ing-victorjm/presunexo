// dashboard.js — Panel general: KPIs (costo, total, K, plazo, avance, valorizado),
// distribución del CD, curva S + fórmula polinómica, top de partidas, estado del
// sistema y accesos rápidos.
import * as store from '../core/store.js';
import { TIPOS_INSUMO } from '../core/model.js';
import { resumen, distribucionPorTipo, cronogramaCalc, avanceProyecto, topPartidas } from '../core/calc.js';
import { polinomicaEfectiva, coeficienteK, validarMonomios } from '../core/polinomica.js';
import { resumenValorizaciones, mesKeyDeISO } from '../core/valorizacion.js';
import { AREAS_GEO, METADATA_INDICES, mesesDisponibles } from '../data/indices.js';
import { RENDIMIENTOS, DOSIFICACIONES_CONCRETO, MORTEROS } from '../data/biblioteca.js';
import { fmtMoney, fmtNum, parseNum, fmtFecha, hoyISO, MESES_CORTO } from '../core/fmt.js';
import { el, icono, modal, toast, campo } from '../ui/components.js';

// --- Utilidades locales ------------------------------------------------------
function fmtMesKey(mesKey) {
  if (!mesKey) return '—';
  const [y, m] = mesKey.split('-').map(Number);
  return `${MESES_CORTO[m - 1]} ${y}`;
}

// --- Modal de edición de datos generales ------------------------------------
function abrirEditarDatos() {
  const p = store.getProyecto();
  const inNombre = el('input', { type: 'text', value: p.nombre, style: { width: '100%' } });
  const inCliente = el('input', { type: 'text', value: p.cliente || '', style: { width: '100%' } });
  const inUbicacion = el('input', { type: 'text', value: p.ubicacion || '', style: { width: '100%' } });
  const inFecha = el('input', { type: 'date', value: p.fechaInicio || '', style: { width: '100%' } });
  const inJornada = el('input', { type: 'number', step: '0.5', min: '1', value: p.jornada, style: { width: '100%' } });
  const inGG = el('input', { type: 'number', step: '0.01', min: '0', value: p.ggPct, style: { width: '100%' } });
  const inUtil = el('input', { type: 'number', step: '0.01', min: '0', value: p.utilidadPct, style: { width: '100%' } });
  const inIGV = el('input', { type: 'number', step: '0.01', min: '0', value: p.igvPct, style: { width: '100%' } });
  const inAdelD = el('input', { type: 'number', step: '0.01', min: '0', max: '100', value: p.adelantoDirectoPct ?? 10, style: { width: '100%' } });
  const inAdelM = el('input', { type: 'number', step: '0.01', min: '0', max: '100', value: p.adelantoMaterialesPct ?? 20, style: { width: '100%' } });
  const selArea = el('select', { style: { width: '100%' } },
    Object.entries(AREAS_GEO).map(([cod, nombre]) =>
      el('option', { value: cod, selected: Number(cod) === Number(p.areaGeo ?? 4) }, `Área ${cod} — ${nombre}`)));

  modal({
    titulo: 'Editar datos del proyecto',
    ancho: 580,
    contenido: el('div', {},
      campo('Nombre del proyecto', inNombre),
      el('div', { class: 'grid-2' },
        campo('Cliente', inCliente),
        campo('Ubicación', inUbicacion)),
      el('div', { class: 'grid-2' },
        campo('Fecha de inicio', inFecha),
        campo('Jornada laboral (h/día)', inJornada, 'Afecta las cantidades de MO y EQ por rendimiento.')),
      campo('Área geográfica INEI', selArea,
        'Determina la serie de índices unificados del reajuste. La serie incluida corresponde al Área 4 (Lima y Callao).'),
      el('div', { class: 'grid-2' },
        campo('Gastos generales (%)', inGG),
        campo('Utilidad (%)', inUtil)),
      el('div', { class: 'grid-2' },
        campo('IGV (%)', inIGV),
        el('div')),
      el('div', { class: 'grid-2' },
        campo('Adelanto directo (%)', inAdelD, 'Tope legal: 10 % del monto contractual (Reglamento, art. 179).'),
        campo('Adelanto para materiales (%)', inAdelM, 'Las demás modalidades en conjunto no exceden el 20 % (art. 181).'))),
    acciones: [
      { label: 'Cancelar', clase: 'btn-sec' },
      {
        label: 'Guardar', clase: 'btn-primario',
        onClick: () => {
          const nombre = inNombre.value.trim();
          if (!nombre) { toast('El nombre del proyecto no puede estar vacío', 'error'); return false; }
          if (!inFecha.value) { toast('Selecciona una fecha de inicio válida', 'error'); return false; }
          const jornada = parseNum(inJornada.value);
          if (isNaN(jornada) || jornada <= 0) { toast('Jornada inválida: debe ser un número mayor que 0', 'error'); return false; }
          const pcts = [
            ['Gastos generales', parseNum(inGG.value)],
            ['Utilidad', parseNum(inUtil.value)],
            ['IGV', parseNum(inIGV.value)],
            ['Adelanto directo', parseNum(inAdelD.value)],
            ['Adelanto para materiales', parseNum(inAdelM.value)],
          ];
          for (const [nom, v] of pcts) {
            if (isNaN(v) || v < 0 || v > 100) { toast(`Porcentaje de ${nom} inválido (0–100)`, 'error'); return false; }
          }
          store.update(pr => {
            pr.nombre = nombre;
            pr.cliente = inCliente.value.trim();
            pr.ubicacion = inUbicacion.value.trim();
            pr.fechaInicio = inFecha.value;
            pr.jornada = jornada;
            pr.ggPct = pcts[0][1];
            pr.utilidadPct = pcts[1][1];
            pr.igvPct = pcts[2][1];
            pr.adelantoDirectoPct = pcts[3][1];
            pr.adelantoMaterialesPct = pcts[4][1];
            pr.areaGeo = Number(selArea.value);
          });
          toast('Datos del proyecto actualizados');
          if (pcts[3][1] > 10 || pcts[4][1] > 20) {
            toast('Aviso: los adelantos superan los topes del Reglamento (10 % directo · 20 % materiales)', 'info');
          }
        },
      },
    ],
  });
}

// --- Fila de KPIs ------------------------------------------------------------
function bloqueKpis(p, r, crono, kHoy, hoyMes) {
  const nPartidas = p.items.filter(i => i.tipo === 'partida').length;
  const avance = avanceProyecto(p);

  // Valorizado acumulado según avances reales: última bruta acumulada ≤ mes de hoy.
  const rv = resumenValorizaciones(p);
  const pasados = rv.meses.filter(v => v.mes <= hoyMes);
  const ultVal = pasados.length ? pasados[pasados.length - 1] : null;

  const kpiValorizado = () => {
    if (!rv.meses.length) return [el('div', { class: 'kpi-valor' }, '—'), el('div', { class: 'kpi-sub' }, 'Sin cronograma valorizable')];
    if (!ultVal) return [
      el('div', { class: 'kpi-valor' }, 'Por iniciar'),
      el('div', { class: 'kpi-sub' }, `Primera valorización: ${fmtMesKey(rv.meses[0].mes)}`)];
    return [
      el('div', { class: 'kpi-valor' }, fmtMoney(ultVal.acumBruta)),
      el('div', { class: 'kpi-sub' }, `${fmtNum(ultVal.pctAvance, 1)} % del CD · al cierre de ${fmtMesKey(ultVal.mes)}`)];
  };

  const tieneK = kHoy.detalle.length > 0;

  return el('div', { class: 'grid-kpi' },
    el('div', { class: 'kpi' },
      el('div', { class: 'kpi-etiqueta' }, 'Costo directo'),
      el('div', { class: 'kpi-valor' }, fmtMoney(r.costoDirecto)),
      el('div', { class: 'kpi-sub' }, `${nPartidas} partida${nPartidas === 1 ? '' : 's'} · GG ${fmtNum(p.ggPct)} % · Ut. ${fmtNum(p.utilidadPct)} %`)),
    el('div', { class: 'kpi verde' },
      el('div', { class: 'kpi-etiqueta' }, 'Total inc. IGV'),
      el('div', { class: 'kpi-valor ok' }, fmtMoney(r.total)),
      el('div', { class: 'kpi-sub' }, `IGV ${fmtNum(p.igvPct)} % sobre subtotal`)),
    el('div', { class: 'kpi violeta' },
      el('div', { class: 'kpi-etiqueta' }, `Coeficiente K — ${fmtMesKey(hoyMes)}`),
      el('div', { class: 'kpi-valor' }, tieneK ? fmtNum(kHoy.k, 3) : '—'),
      tieneK
        ? el('div', { class: 'kpi-sub fila', style: { gap: '6px', flexWrap: 'wrap' } },
            el('span', { class: 'pill' }, `Mes base: ${fmtMesKey(kHoy.mesBase)}`),
            kHoy.incompleto ? el('span', { class: 'pill pill-auto' }, 'Índice provisional') : null)
        : el('div', { class: 'kpi-sub' }, 'Se genera con las incidencias del presupuesto')),
    el('div', { class: 'kpi ambar' },
      el('div', { class: 'kpi-etiqueta' }, 'Duración del proyecto'),
      el('div', { class: 'kpi-valor' }, crono.fin > 0 ? `${crono.fin} días` : '—'),
      el('div', { class: 'kpi-sub' }, crono.fin > 0 ? `Fin estimado: ${fmtFecha(crono.finISO)}` : 'Sin partidas programadas')),
    el('div', { class: 'kpi' },
      el('div', { class: 'kpi-etiqueta' }, 'Avance físico'),
      el('div', { class: 'kpi-valor' }, `${fmtNum(avance, 1)} %`),
      el('div', { class: 'barra', style: { marginTop: '9px' } },
        el('span', { style: { width: Math.min(100, Math.max(0, avance)) + '%', background: 'var(--c-sc)' } }))),
    el('div', { class: 'kpi' },
      el('div', { class: 'kpi-etiqueta' }, 'Valorizado acumulado'),
      kpiValorizado()));
}

// --- Distribución del costo directo -----------------------------------------
function bloqueDistribucion(p) {
  const dist = distribucionPorTipo(p);
  const total = Object.values(dist).reduce((s, v) => s + v, 0);

  const cab = el('div', { class: 'panel-cab' },
    el('div', {},
      el('h2', {}, 'Distribución del costo directo'),
      el('div', { class: 'sub' }, 'Por tipo de recurso según los ACU y metrados')));

  if (total <= 0) {
    return el('div', { class: 'panel' }, cab,
      el('div', { class: 'vacio' },
        icono('presupuesto', 30),
        'Aún no hay costo directo que distribuir.', el('br'),
        el('a', { href: '#/presupuesto', style: { color: 'var(--acento-fuerte)' } }, 'Crea partidas con sus ACU en el presupuesto.')));
  }

  const barra = el('div', { class: 'barra-apilada', title: 'MO / MAT / EQ / SC' });
  const leyenda = el('div', { class: 'leyenda' });
  for (const t of Object.values(TIPOS_INSUMO)) {
    const monto = dist[t.clave] || 0;
    if (monto <= 0) continue;
    const pct = monto / total * 100;
    barra.append(el('span', { style: { width: pct.toFixed(3) + '%', background: t.color }, title: `${t.nombre}: ${fmtMoney(monto)} (${fmtNum(pct, 1)} %)` }));
    leyenda.append(el('span', {},
      el('span', { class: 'punto', style: { background: t.color } }),
      `${t.nombre}: `,
      el('strong', { class: 'mono' }, fmtMoney(monto)),
      el('span', { class: 'texto-3' }, ` (${fmtNum(pct, 1)} %)`)));
  }
  return el('div', { class: 'panel' }, cab, barra, leyenda);
}

// --- Curva S mini (SVG a mano, vía contenedor con html:) --------------------
function svgCurvaS(meses) {
  const W = 640, H = 220, padL = 46, padR = 14, padT = 18, padB = 34;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const n = meses.length;
  const maxMonto = Math.max(...meses.map(m => m.monto), 1);
  const slot = plotW / n;
  const barW = Math.min(46, slot * 0.58);
  const xC = i => padL + slot * i + slot / 2;
  const yMonto = v => padT + plotH - (v / maxMonto) * plotH;
  const yPct = v => padT + plotH - (v / 100) * plotH;
  const cada = Math.max(1, Math.ceil(n / 10));

  let s = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Curva S del proyecto" style="width:100%;height:auto;display:block">`;

  // Rejilla horizontal con escala de % acumulado.
  for (const g of [0, 25, 50, 75, 100]) {
    const y = yPct(g).toFixed(1);
    s += `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="var(--panel-borde)" stroke-width="1"${g > 0 ? ' stroke-dasharray="3 4"' : ''}/>`;
    s += `<text x="${padL - 7}" y="${(yPct(g) + 3.5).toFixed(1)}" text-anchor="end" font-size="10" font-family="var(--mono)" fill="var(--texto-3)">${g}%</text>`;
  }

  // Barras mensuales del costo directo programado.
  meses.forEach((m, i) => {
    const x = (xC(i) - barW / 2).toFixed(1);
    const y = yMonto(m.monto);
    s += `<rect x="${x}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${(padT + plotH - y).toFixed(1)}" rx="3" fill="var(--acento)" opacity="0.5">`
      + `<title>${MESES_CORTO[m.mes]} ${m.anio}: ${fmtMoney(m.monto)} · ${fmtNum(m.pctAcum, 1)} % acumulado</title></rect>`;
    if (i % cada === 0 || i === n - 1) {
      s += `<text x="${xC(i).toFixed(1)}" y="${H - padB + 16}" text-anchor="middle" font-size="10" font-family="var(--fuente)" fill="var(--texto-3)">${MESES_CORTO[m.mes]} ${String(m.anio).slice(2)}</text>`;
    }
  });

  // Marcador de hoy (si el mes actual cae dentro del cronograma).
  const hoy = hoyISO();
  const idxHoy = meses.findIndex(m => m.anio === Number(hoy.slice(0, 4)) && m.mes === Number(hoy.slice(5, 7)) - 1);
  if (idxHoy >= 0) {
    const x = xC(idxHoy).toFixed(1);
    s += `<line x1="${x}" y1="${padT - 3}" x2="${x}" y2="${padT + plotH}" stroke="var(--peligro)" stroke-width="1.2" stroke-dasharray="4 3" opacity="0.75"/>`;
    s += `<text x="${x}" y="${padT - 7}" text-anchor="middle" font-size="9.5" font-family="var(--fuente)" fill="var(--peligro)">hoy</text>`;
  }

  // Línea de % acumulado (curva S) con puntos.
  const pts = meses.map((m, i) => `${xC(i).toFixed(1)},${yPct(m.pctAcum).toFixed(1)}`).join(' ');
  s += `<polyline points="${pts}" fill="none" stroke="var(--c-sc)" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>`;
  meses.forEach((m, i) => {
    s += `<circle cx="${xC(i).toFixed(1)}" cy="${yPct(m.pctAcum).toFixed(1)}" r="3" fill="var(--c-sc)">`
      + `<title>${MESES_CORTO[m.mes]} ${m.anio}: ${fmtNum(m.pctAcum, 1)} % acumulado</title></circle>`;
  });

  s += '</svg>';
  return el('div', { html: s });
}

// --- Panel doble: curva S + fórmula polinómica -------------------------------
function bloqueCurvaYPolinomica(p, crono, kHoy, hoyMes) {
  // (a) Curva S y valorización.
  const cabCurva = el('div', { class: 'panel-cab' },
    el('div', {},
      el('h2', {}, 'Curva S y valorización'),
      el('div', { class: 'sub' }, 'Costo directo programado por mes y avance acumulado')),
    el('button', { class: 'btn btn-mini', onclick: () => { location.hash = '#/gantt'; } }, icono('cronograma', 14), 'Ver Gantt'));

  const panelCurva = el('div', { class: 'panel', style: { marginBottom: '0' } }, cabCurva,
    crono.meses.length
      ? [svgCurvaS(crono.meses),
         el('div', { class: 'leyenda' },
           el('span', {}, el('span', { class: 'punto', style: { background: 'var(--acento)' } }), 'CD programado del mes'),
           el('span', {}, el('span', { class: 'punto', style: { background: 'var(--c-sc)' } }), '% acumulado (curva S)'))]
      : el('div', { class: 'vacio' },
          icono('cronograma', 30),
          'Sin cronograma que graficar.', el('br'),
          el('a', { href: '#/programacion', style: { color: 'var(--acento-fuerte)' } }, 'Programa las partidas para ver la curva S.')));

  // (b) Fórmula polinómica: monomios con coeficiente + K actual.
  const ef = polinomicaEfectiva(p);
  const cabPoli = el('div', { class: 'panel-cab' },
    el('div', {},
      el('h2', {}, 'Fórmula polinómica'),
      el('div', { class: 'sub' }, ef.monomios.length
        ? `${ef.monomios.length} monomio${ef.monomios.length === 1 ? '' : 's'} · ${ef.personalizada ? 'definida por el usuario' : 'generada automáticamente'}`
        : 'Reajuste de precios DS 011-79-VC')),
    el('button', { class: 'btn btn-mini', onclick: () => { location.hash = '#/polinomica'; } }, icono('polinomica', 14), 'Abrir'));

  let cuerpoPoli;
  if (!ef.monomios.length) {
    cuerpoPoli = el('div', { class: 'vacio' },
      icono('polinomica', 30),
      'Sin costo directo no hay fórmula que generar.', el('br'),
      el('a', { href: '#/presupuesto', style: { color: 'var(--acento-fuerte)' } }, 'Crea partidas para obtener la fórmula automática.'));
  } else {
    const errores = validarMonomios(ef.monomios);
    const suma = Math.round(ef.monomios.reduce((s, m) => s + (Number(m.coef) || 0), 0) * 1000) / 1000;

    const kGrande = el('div', { class: 'fila', style: { gap: '14px', alignItems: 'baseline', flexWrap: 'wrap', marginBottom: '12px' } },
      el('span', { class: 'mono', style: { fontSize: '30px', fontWeight: '700', letterSpacing: '-.02em' } }, fmtNum(kHoy.k, 3)),
      el('div', { class: 'col', style: { gap: '2px' } },
        el('span', { class: 'texto-3', style: { fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: '600' } },
          `K de ${fmtMesKey(hoyMes)}`),
        el('span', { class: 'texto-2', style: { fontSize: '11.5px' } },
          `Reajuste ${kHoy.k >= 1 ? '+' : ''}${fmtNum((kHoy.k - 1) * 100, 2)} % sobre el mes base ${fmtMesKey(kHoy.mesBase)}`)),
      el('span', { class: 'pill' + (ef.personalizada ? '' : ' pill-auto') }, ef.personalizada ? 'Personalizada' : 'Automática'),
      kHoy.incompleto ? el('span', { class: 'pill pill-auto' }, 'Índice provisional') : null);

    const filas = ef.monomios.map(m => el('tr', {},
      el('td', {},
        m.nombre,
        (m.ius || []).map(iu => el('span', { class: 'badge badge-iu', style: { marginLeft: '5px' } }, iu)),
        (m.iusExtra && m.iusExtra.length)
          ? el('span', { class: 'pill', style: { marginLeft: '5px' }, title: 'IU absorbidos: ' + m.iusExtra.join(', ') }, `+${m.iusExtra.length}`)
          : null),
      el('td', { class: 'num' }, fmtNum(Number(m.coef) || 0, 3))));

    cuerpoPoli = el('div', {},
      kGrande,
      errores.length
        ? el('div', { class: 'nota nota-alerta' },
            el('b', {}, `${errores.length} observación${errores.length === 1 ? '' : 'es'}: `),
            'la fórmula no cumple aún el DS 011-79-VC. Revísala en la vista Fórmula polinómica.')
        : null,
      el('div', { class: 'envoltorio-tabla', style: { boxShadow: 'none' } },
        el('table', { class: 'tabla' },
          el('thead', {}, el('tr', {},
            el('th', {}, 'Monomio'),
            el('th', { class: 'num' }, 'Coef.'))),
          el('tbody', {},
            filas,
            el('tr', { class: 'fila-total' },
              el('td', {}, 'Σ coeficientes'),
              el('td', { class: 'num' }, fmtNum(suma, 3)))))));
  }

  const panelPoli = el('div', { class: 'panel', style: { marginBottom: '0' } }, cabPoli, cuerpoPoli);

  return el('div', { class: 'grid-2-min', style: { marginBottom: '18px' } }, panelCurva, panelPoli);
}

// --- Top de partidas ---------------------------------------------------------
function bloqueTopPartidas(p, r) {
  const top = topPartidas(p, 8);
  const cab = el('div', { class: 'panel-cab' },
    el('div', {},
      el('h2', {}, 'Partidas de mayor incidencia'),
      el('div', { class: 'sub' }, 'Top 8 por parcial · clic en la descripción abre su ACU')));

  if (!top.length || r.costoDirecto <= 0) {
    return el('div', { class: 'panel' }, cab,
      el('div', { class: 'vacio' },
        icono('acu', 30),
        'No hay partidas con costo todavía.', el('br'),
        el('a', { href: '#/presupuesto', style: { color: 'var(--acento-fuerte)' } }, 'Ir al presupuesto para crearlas.')));
  }

  const maxParcial = Math.max(...top.map(n => n.parcial), 1);
  const filas = top.map(n => {
    const pctCD = r.costoDirecto > 0 ? n.parcial / r.costoDirecto * 100 : 0;
    return el('tr', {},
      el('td', { class: 'cod' }, n.codigo),
      el('td', {},
        el('span', {
          class: 'descripcion',
          style: { cursor: 'pointer' },
          title: 'Abrir análisis de costo unitario',
          onclick: () => { location.hash = '#/acu/' + n.item.id; },
        }, n.item.descripcion)),
      el('td', { class: 'num' }, fmtMoney(n.parcial)),
      el('td', { class: 'num' }, fmtNum(pctCD, 1) + ' %'),
      el('td', { style: { width: '30%', minWidth: '140px' } },
        el('div', { class: 'barra' },
          el('span', { style: { width: (n.parcial / maxParcial * 100).toFixed(1) + '%' } }))));
  });

  return el('div', { class: 'panel' }, cab,
    el('div', { class: 'envoltorio-tabla' },
      el('table', { class: 'tabla' },
        el('thead', {}, el('tr', {},
          el('th', {}, 'Código'), el('th', {}, 'Descripción'),
          el('th', { class: 'num' }, 'Parcial'), el('th', { class: 'num' }, '% del CD'),
          el('th', {}, 'Incidencia'))),
        el('tbody', {}, filas))));
}

// --- Estado del sistema ------------------------------------------------------
function bloqueEstadoSistema() {
  const ficha = (ico, titulo, detalle, hash, labelBtn) =>
    el('div', {
      style: {
        border: '1px solid var(--panel-borde)', borderRadius: '10px', padding: '14px 16px',
        background: 'var(--fondo-3)', display: 'flex', flexDirection: 'column', gap: '7px',
      },
    },
      el('div', { class: 'fila', style: { gap: '8px' } },
        icono(ico, 16),
        el('strong', { style: { fontSize: '12.5px' } }, titulo)),
      el('div', { class: 'texto-2', style: { fontSize: '12px', lineHeight: '1.55', flex: '1' } }, detalle),
      el('div', {},
        el('button', { class: 'btn btn-mini', onclick: () => { location.hash = hash; } }, labelBtn)));

  const nMesesIdx = mesesDisponibles().length;

  return el('div', { class: 'panel' },
    el('div', { class: 'panel-cab' },
      el('div', {},
        el('h2', {}, 'Estado del sistema'),
        el('div', { class: 'sub' }, 'Datos de referencia cargados en la aplicación'))),
    el('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '12px' } },
      ficha('polinomica', 'Índices INEI',
        [`Base ${METADATA_INDICES.base} · ${nMesesIdx} mes${nMesesIdx === 1 ? '' : 'es'} cargado${nMesesIdx === 1 ? '' : 's'}. Último publicado: `,
         el('strong', {}, fmtMesKey(METADATA_INDICES.ultimoPublicado)), '.'],
        '#/polinomica', 'Ver índices'),
      ficha('normativa', 'Normativa',
        [el('strong', {}, 'Ley 32069'), ' vigente (desde abr-2025) con su Reglamento DS 009-2025-EF, modificado por DS 001-2026-EF.'],
        '#/normativa', 'Ver normativa'),
      ficha('biblioteca', 'Biblioteca técnica',
        `${RENDIMIENTOS.length} rendimientos CAPECO · ${DOSIFICACIONES_CONCRETO.length} dosificaciones de concreto · ${MORTEROS.length} morteros.`,
        '#/biblioteca', 'Abrir biblioteca')));
}

// --- Accesos rápidos ---------------------------------------------------------
function bloqueAccesos() {
  const acceso = (hash, ico, etiqueta) =>
    el('button', {
      class: 'btn',
      style: { flex: '1', justifyContent: 'center', padding: '14px 16px', fontSize: '13.5px' },
      onclick: () => { location.hash = hash; },
    }, icono(ico, 18), etiqueta);

  return el('div', { class: 'fila no-imprimir', style: { gap: '12px', flexWrap: 'wrap' } },
    acceso('#/presupuesto', 'presupuesto', 'Presupuesto'),
    acceso('#/gantt', 'cronograma', 'Diagrama de Gantt'),
    acceso('#/valorizaciones', 'valorizacion', 'Valorizaciones'),
    acceso('#/reportes', 'reportes', 'Reportes'));
}

// --- Render principal -------------------------------------------------------
export function render(container) {
  const p = store.getProyecto();
  const r = resumen(p);
  const crono = cronogramaCalc(p);
  const hoyMes = mesKeyDeISO(hoyISO());
  const kHoy = coeficienteK(p, hoyMes);

  const sub = [p.cliente, p.ubicacion, `Inicio: ${fmtFecha(p.fechaInicio)}`].filter(Boolean).join(' · ');

  container.append(
    el('div', { class: 'cabecera-vista' },
      el('div', {},
        el('h1', {}, p.nombre),
        el('div', { class: 'sub' }, sub)),
      el('div', { class: 'acciones' },
        el('button', { class: 'btn', onclick: abrirEditarDatos }, icono('editar', 15), 'Editar datos'))),
    bloqueKpis(p, r, crono, kHoy, hoyMes),
    bloqueDistribucion(p),
    bloqueCurvaYPolinomica(p, crono, kHoy, hoyMes),
    bloqueTopPartidas(p, r),
    bloqueEstadoSistema(),
    bloqueAccesos());
}
