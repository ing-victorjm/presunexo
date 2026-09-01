// valorizaciones.js — Valorizaciones mensuales de obra: avance por partida,
// reajuste polinómico, amortización de adelantos y resumen del contrato.
import * as store from '../core/store.js';
import { mesesProyecto, valorizacionMes, resumenValorizaciones } from '../core/valorizacion.js';
import { fmtMoney, fmtNum, parseNum, fmtMesAnio, MESES } from '../core/fmt.js';
import { el, icono, confirmar, toast } from '../ui/components.js';

const UMBRAL_DESVIO = 5; // puntos porcentuales real vs programado

// --- Helpers ----------------------------------------------------------------
function etiquetaMes(mesKey) {
  if (!mesKey) return '—';
  const [y, m] = mesKey.split('-').map(Number);
  return fmtMesAnio(y, m - 1);
}

function etiquetaMesLarga(mesKey) {
  const [y, m] = mesKey.split('-').map(Number);
  return `${MESES[m - 1]} ${y}`;
}

function techoBonito(v) {
  if (v <= 0) return 1;
  const pot = Math.pow(10, Math.floor(Math.log10(v)));
  const b = v / pot;
  return (b <= 1 ? 1 : b <= 2 ? 2 : b <= 5 ? 5 : 10) * pot;
}

function montoCorto(v) {
  if (v >= 1e6) return fmtNum(v / 1e6, 1) + ' M';
  if (v >= 1e3) return fmtNum(v / 1e3, 0) + ' k';
  return fmtNum(v, 0);
}

// Escribe la config del mes preservando lo ya registrado.
function actualizarMes(mes, cambios) {
  store.update(p => {
    p.valorizaciones[mes] = { ...(p.valorizaciones[mes] || {}), ...cambios };
  });
}

// --- Cabecera ----------------------------------------------------------------
function cabecera(meses, mes) {
  return el('div', { class: 'cabecera-vista' },
    el('div', {},
      el('h1', {}, 'Valorizaciones de obra'),
      el('div', { class: 'sub' }, 'Reajuste polinómico + amortización de adelantos · Ley 32069')),
    el('div', { class: 'acciones' },
      el('div', { class: 'segmentos', style: { flexWrap: 'wrap' } },
        meses.map(m => el('button', {
          class: 'segmento' + (m === mes ? ' activo' : ''),
          title: etiquetaMesLarga(m),
          onclick: () => { location.hash = '#/valorizaciones/' + m; },
        }, etiquetaMes(m))))));
}

// --- KPIs del mes ------------------------------------------------------------
function bloqueKpis(v) {
  const amortTotal = v.amortAD + v.amortAM;
  return el('div', { class: 'grid-kpi' },
    el('div', { class: 'kpi' },
      el('div', { class: 'kpi-etiqueta' }, 'Valorización bruta'),
      el('div', { class: 'kpi-valor' }, fmtMoney(v.bruta)),
      el('div', { class: 'kpi-sub' }, 'Σ parcial × Δ % de avance del mes')),
    el('div', { class: 'kpi violeta' },
      el('div', { class: 'kpi-etiqueta' }, 'K del mes'),
      el('div', { class: 'kpi-valor' }, fmtNum(v.k, 3)),
      el('div', { class: 'kpi-sub' },
        `Mes base: ${etiquetaMes(v.mesBaseK)} `,
        v.kIncompleto
          ? el('span', {
              class: 'pill pill-auto',
              title: 'Faltan índices INEI del mes: el K usa el último índice publicado disponible.',
            }, 'índices incompletos')
          : null)),
    el('div', { class: 'kpi ambar' },
      el('div', { class: 'kpi-etiqueta' }, 'Reajuste'),
      el('div', { class: 'kpi-valor' }, fmtMoney(v.reajuste)),
      el('div', { class: 'kpi-sub' }, `V × (K − 1) = V × ${fmtNum(v.k - 1, 3)}`)),
    el('div', { class: 'kpi rojo' },
      el('div', { class: 'kpi-etiqueta' }, 'Amortizaciones'),
      el('div', { class: 'kpi-valor' }, fmtMoney(amortTotal)),
      el('div', { class: 'kpi-sub' }, `AD ${fmtMoney(v.amortAD)} · AM ${fmtMoney(v.amortAM)}`)),
    el('div', { class: 'kpi verde' },
      el('div', { class: 'kpi-etiqueta' }, 'Neto a facturar'),
      el('div', { class: 'kpi-valor ok' }, fmtMoney(v.neto)),
      el('div', { class: 'kpi-sub' }, `+ IGV ${fmtMoney(v.igv)} → total ${fmtMoney(v.total)}`)));
}

// --- Avance por partida ------------------------------------------------------
function celdaAvanceReal(f, mes) {
  const desvio = f.acumActual - f.progActual;
  const atrasado = desvio < -UMBRAL_DESVIO;
  const adelantado = desvio > UMBRAL_DESVIO;

  const input = el('input', {
    class: 'celda-input',
    value: fmtNum(f.acumActual, 2),
    title: (atrasado || adelantado)
      ? `Desvío vs programado: ${desvio > 0 ? '+' : ''}${fmtNum(desvio, 1)} puntos (${atrasado ? 'atrasado' : 'adelantado'})`
      : '% real acumulado al cierre del mes (editable)',
    style: (atrasado || adelantado)
      ? { color: atrasado ? 'var(--peligro)' : 'var(--ok)', fontWeight: '700' }
      : null,
    onchange: e => {
      const val = parseNum(e.target.value);
      if (isNaN(val)) {
        toast('Avance inválido: escribe un número entre 0 y 100', 'error');
        e.target.value = fmtNum(f.acumActual, 2);
        return;
      }
      if (val < 0 || val > 100) {
        toast('El avance acumulado debe estar entre 0 y 100 %', 'error');
        e.target.value = fmtNum(f.acumActual, 2);
        return;
      }
      if (val < f.acumAnterior) {
        toast(`No puede ser menor que el acumulado del mes anterior (${fmtNum(f.acumAnterior, 2)} %): la valorización del mes sería negativa`, 'error');
        e.target.value = fmtNum(f.acumActual, 2);
        return;
      }
      const itemId = f.nodo.item.id;
      store.update(p => {
        p.valorizaciones[mes] = {
          ...(p.valorizaciones[mes] || {}),
          avances: { ...(p.valorizaciones[mes]?.avances || {}), [itemId]: val },
        };
      });
    },
    onkeydown: e => { if (e.key === 'Enter') e.target.blur(); },
  });
  return el('td', { class: 'num', style: { width: '96px' } }, input);
}

function panelAvance(p, v, mes) {
  const hayManual = Object.keys(p.valorizaciones?.[mes]?.avances || {}).length > 0;

  const cab = el('div', { class: 'panel-cab' },
    el('div', {},
      el('h2', {}, `Avance por partida — ${etiquetaMesLarga(mes)}`),
      el('div', { class: 'sub' }, 'El % real acumulado se edita en línea; sin registro manual se asume el programado')),
    el('button', {
      class: 'btn btn-mini',
      disabled: !hayManual,
      title: hayManual ? 'Descartar los avances registrados y volver al % programado' : 'Este mes no tiene avances manuales registrados',
      onclick: async () => {
        if (await confirmar(
          `¿Descartar los avances registrados de ${etiquetaMesLarga(mes)}? Las partidas volverán al % programado del cronograma.`,
          { peligro: true, labelOk: 'Usar programado' })) {
          store.update(pr => { const c = pr.valorizaciones[mes]; if (c) delete c.avances; });
          toast('Avances del mes restablecidos al programado');
        }
      },
    }, icono('deshacer', 14), 'Usar programado'));

  if (!v.filas.length) {
    return el('div', { class: 'panel' }, cab,
      el('div', { class: 'vacio' },
        icono('valorizacion', 30),
        'No hay partidas que valorizar.', el('br'),
        el('a', { href: '#/presupuesto', style: { color: 'var(--acento-fuerte)' } }, 'Crea partidas en la hoja de presupuesto.')));
  }

  const totalParcial = v.filas.reduce((s, f) => s + f.nodo.parcial, 0);
  const pond = campo => totalParcial > 0
    ? v.filas.reduce((s, f) => s + f.nodo.parcial * f[campo], 0) / totalParcial
    : 0;

  const filas = v.filas.map(f => el('tr', {},
    el('td', { class: 'cod' }, f.nodo.codigo),
    el('td', {}, f.nodo.item.descripcion),
    el('td', { class: 'num' }, fmtMoney(f.nodo.parcial)),
    el('td', { class: 'num texto-3' }, fmtNum(f.progActual, 2) + ' %'),
    el('td', { class: 'num texto-3' }, fmtNum(f.acumAnterior, 2) + ' %'),
    celdaAvanceReal(f, mes),
    el('td', { class: 'num' }, fmtNum(f.deltaPct, 2) + ' %'),
    el('td', { class: 'num' }, fmtMoney(f.montoMes))));

  const filaTotal = el('tr', { class: 'fila-total' },
    el('td', { colspan: 2 }, 'TOTAL'),
    el('td', { class: 'num' }, fmtMoney(totalParcial)),
    el('td', { class: 'num texto-3' }, fmtNum(pond('progActual'), 2) + ' %'),
    el('td', { class: 'num texto-3' }, fmtNum(pond('acumAnterior'), 2) + ' %'),
    el('td', { class: 'num' }, fmtNum(pond('acumActual'), 2) + ' %'),
    el('td', { class: 'num' }, fmtNum(totalParcial > 0 ? v.bruta / totalParcial * 100 : 0, 2) + ' %'),
    el('td', { class: 'num' }, fmtMoney(v.bruta)));

  return el('div', { class: 'panel' }, cab,
    el('div', { class: 'envoltorio-tabla' },
      el('table', { class: 'tabla' },
        el('thead', {}, el('tr', {},
          el('th', {}, 'Código'),
          el('th', {}, 'Partida'),
          el('th', { class: 'num' }, 'Parcial S/'),
          el('th', { class: 'num', title: '% programado acumulado según cronograma' }, '% Prog. acum'),
          el('th', { class: 'num', title: '% real acumulado al cierre del mes anterior' }, '% Real anterior'),
          el('th', { class: 'num', title: '% real acumulado al cierre de este mes (editable)' }, '% Real actual'),
          el('th', { class: 'num' }, 'Δ % del mes'),
          el('th', { class: 'num' }, 'Valorizado mes S/'))),
        el('tbody', {}, filas, filaTotal))),
    el('div', { class: 'leyenda', style: { marginTop: '10px' } },
      el('span', {}, el('span', { class: 'punto', style: { background: 'var(--peligro)' } }), `Atraso > ${UMBRAL_DESVIO} puntos vs programado`),
      el('span', {}, el('span', { class: 'punto', style: { background: 'var(--ok)' } }), `Adelanto > ${UMBRAL_DESVIO} puntos vs programado`)));
}

// --- Liquidación del mes -----------------------------------------------------
function panelLiquidacion(p, v, mes) {
  const cfg = p.valorizaciones?.[mes] || {};
  const aplicaAD = cfg.aplicaAdelantoDirecto !== false;

  const chkAD = el('input', {
    type: 'checkbox',
    checked: aplicaAD,
    style: { width: 'auto', padding: '0', cursor: 'pointer', accentColor: 'var(--acento)' },
    onchange: e => {
      actualizarMes(mes, { aplicaAdelantoDirecto: e.target.checked });
      toast(e.target.checked ? 'Amortización del adelanto directo aplicada' : 'Amortización del adelanto directo suspendida este mes', 'info');
    },
  });

  const inAM = el('input', {
    class: 'celda-input',
    style: { width: '120px', display: 'inline-block' },
    value: fmtNum(v.amortAM, 2),
    title: 'Monto manual del mes según agotamiento del adelanto de materiales',
    onchange: e => {
      const val = parseNum(e.target.value);
      if (isNaN(val) || val < 0) {
        toast('Amortización de materiales inválida: escribe un monto mayor o igual a 0', 'error');
        e.target.value = fmtNum(v.amortAM, 2);
        return;
      }
      actualizarMes(mes, { amortMateriales: val });
    },
    onkeydown: e => { if (e.key === 'Enter') e.target.blur(); },
  });

  const inputPct = (valor, tope, nombre, commit) => el('input', {
    type: 'number', step: '0.1', min: '0', max: '100',
    value: valor,
    style: { width: '86px', padding: '5px 8px' },
    onchange: e => {
      const val = parseNum(e.target.value);
      if (isNaN(val) || val < 0 || val > 100) {
        toast(`${nombre} inválido: escribe un porcentaje entre 0 y 100`, 'error');
        e.target.value = valor;
        return;
      }
      if (val > tope) toast(`${nombre}: ${fmtNum(val, 1)} % supera el tope legal de ${tope} %`, 'info');
      commit(val);
    },
    onkeydown: e => { if (e.key === 'Enter') e.target.blur(); },
  });

  const filaMonto = (concepto, monto, opts = {}) => el('tr', { class: opts.total ? 'fila-total' : null },
    el('td', {}, opts.strong ? el('strong', {}, concepto) : concepto),
    el('td', { class: 'num' + (opts.verde ? ' ok' : '') + (opts.rojo ? ' peligro' : '') },
      opts.strong && !opts.total ? el('strong', {}, monto) : monto));

  return el('div', { class: 'panel' },
    el('div', { class: 'panel-cab' },
      el('div', {},
        el('h2', {}, `Liquidación del mes — ${etiquetaMesLarga(mes)}`),
        el('div', { class: 'sub' }, 'Estado de pago: reajuste y deducciones sobre la valorización bruta'))),
    el('div', { class: 'envoltorio-tabla', style: { maxWidth: '640px' } },
      el('table', { class: 'tabla' },
        el('tbody', {},
          filaMonto('Valorización bruta del mes (V)', fmtMoney(v.bruta)),
          el('tr', {},
            el('td', {},
              `Reajuste por fórmula polinómica — K = ${fmtNum(v.k, 3)} `,
              el('span', { class: 'texto-3' }, `· (K − 1) × V`)),
            el('td', { class: 'num' }, fmtMoney(v.reajuste))),
          el('tr', {},
            el('td', {},
              el('label', { class: 'fila', style: { gap: '8px', cursor: 'pointer' } },
                chkAD,
                el('span', {}, `Amortización adelanto directo (${fmtNum(Number(p.adelantoDirectoPct) || 0, 1)} % de V)`),
                el('span', { class: 'texto-3', style: { fontSize: '11.5px' } }, 'aplicar'))),
            el('td', { class: 'num peligro' }, aplicaAD && v.amortAD > 0 ? '− ' + fmtMoney(v.amortAD) : fmtMoney(0))),
          el('tr', {},
            el('td', {}, 'Amortización adelanto de materiales ',
              el('span', { class: 'texto-3' }, '· monto manual del mes')),
            el('td', { class: 'num peligro' }, '− ', inAM)),
          filaMonto('NETO A FACTURAR', fmtMoney(v.neto), { strong: true }),
          filaMonto(`IGV (${fmtNum(Number(p.igvPct) || 0)} %)`, fmtMoney(v.igv)),
          filaMonto('TOTAL A PAGAR', fmtMoney(v.total), { total: true, verde: true })))),
    el('div', { class: 'fila', style: { marginTop: '14px', flexWrap: 'wrap', gap: '14px' } },
      el('span', { class: 'texto-2', style: { fontSize: '12px', fontWeight: '600' } }, 'Adelanto directo (%)'),
      inputPct(Number(p.adelantoDirectoPct) || 0, 10, 'Adelanto directo',
        val => store.update(pr => { pr.adelantoDirectoPct = val; })),
      el('span', { class: 'texto-2', style: { fontSize: '12px', fontWeight: '600' } }, 'Adelanto de materiales (%)'),
      inputPct(Number(p.adelantoMaterialesPct) || 0, 20, 'Adelanto de materiales',
        val => store.update(pr => { pr.adelantoMaterialesPct = val; }))),
    el('div', { class: 'nota', style: { marginTop: '12px', marginBottom: '0' } },
      el('b', {}, 'Topes de adelantos: '),
      '10 % del monto contractual para el adelanto directo y 20 % conjunto para las demás modalidades — Reglamento de la Ley 32069, arts. 178-181.'));
}

// --- Resumen de valorizaciones ----------------------------------------------
function graficoResumen(rv, mesActivo) {
  const ms = rv.meses;
  const n = ms.length;
  const padL = 58, padR = 52, padT = 16, padB = 34, H = 232;
  const paso = Math.max(54, Math.min(96, Math.round(720 / n)));
  const W = padL + padR + n * paso;
  const plotH = H - padT - padB;
  const barW = Math.min(38, paso - 16);
  const maxB = techoBonito(Math.max(...ms.map(m => m.bruta), 1));

  const partes = [];
  partes.push(`<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg" style="display:block;font-family:var(--mono)">`);

  // Rejilla + doble eje (S/ a la izquierda, % a la derecha)
  for (const f of [0, 0.25, 0.5, 0.75, 1]) {
    const y = (padT + plotH * (1 - f)).toFixed(1);
    partes.push(`<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" style="stroke:var(--panel-borde);stroke-width:1" />`);
    partes.push(`<text x="${padL - 8}" y="${y}" dy="3.5" text-anchor="end" style="fill:var(--texto-3);font-size:10px">${montoCorto(maxB * f)}</text>`);
    partes.push(`<text x="${W - padR + 8}" y="${y}" dy="3.5" text-anchor="start" style="fill:var(--ok);font-size:10px">${Math.round(f * 100)} %</text>`);
  }

  // Barras de valorización bruta
  const puntos = [];
  ms.forEach((m, i) => {
    const cx = padL + i * paso + paso / 2;
    const h = plotH * (m.bruta / maxB);
    const x = (cx - barW / 2).toFixed(1);
    const y = (padT + plotH - h).toFixed(1);
    const activo = m.mes === mesActivo;
    partes.push(`<g><title>${etiquetaMesLarga(m.mes)} — Bruta ${fmtMoney(m.bruta)} · Avance acumulado ${fmtNum(m.pctAvance, 1)} %</title>`);
    partes.push(`<rect x="${x}" y="${y}" width="${barW}" height="${Math.max(0, h).toFixed(1)}" rx="3" style="fill:var(--acento);fill-opacity:${activo ? '1' : '.5'}" />`);
    partes.push('</g>');
    partes.push(`<text x="${cx}" y="${H - padB + 16}" text-anchor="middle" style="fill:${activo ? 'var(--texto)' : 'var(--texto-3)'};font-size:10.5px;font-weight:${activo ? '700' : '400'}">${etiquetaMes(m.mes)}</text>`);
    puntos.push({ cx, cy: padT + plotH * (1 - Math.min(100, Math.max(0, m.pctAvance)) / 100), m });
  });

  // Línea de % de avance acumulado (escala derecha)
  if (puntos.length > 1) {
    partes.push(`<polyline points="${puntos.map(pt => `${pt.cx.toFixed(1)},${pt.cy.toFixed(1)}`).join(' ')}" style="fill:none;stroke:var(--ok);stroke-width:2" />`);
  }
  for (const pt of puntos) {
    partes.push(`<g><title>${etiquetaMesLarga(pt.m.mes)} — ${fmtNum(pt.m.pctAvance, 1)} % acumulado</title>`);
    partes.push(`<circle cx="${pt.cx.toFixed(1)}" cy="${pt.cy.toFixed(1)}" r="3.2" style="fill:var(--ok);stroke:var(--panel);stroke-width:1.5" />`);
    partes.push('</g>');
  }
  partes.push('</svg>');

  return el('div', {},
    el('div', { style: { overflowX: 'auto', marginTop: '16px' } }, el('div', { html: partes.join('') })),
    el('div', { class: 'leyenda' },
      el('span', {}, el('span', { class: 'punto', style: { background: 'var(--acento)' } }), 'Valorización bruta mensual (escala izquierda, S/)'),
      el('span', {}, el('span', { class: 'punto', style: { background: 'var(--ok)' } }), '% de avance acumulado (escala derecha)')));
}

function panelResumen(rv, mesActivo) {
  const filas = rv.meses.map(m => el('tr', {
    class: m.mes === mesActivo ? 'seleccionada' : null,
    style: { cursor: 'pointer' },
    title: 'Ver la valorización de ' + etiquetaMesLarga(m.mes),
    onclick: () => { location.hash = '#/valorizaciones/' + m.mes; },
  },
    el('td', { class: 'cod' }, etiquetaMes(m.mes)),
    el('td', { class: 'num' }, fmtMoney(m.bruta)),
    el('td', { class: 'num' }, fmtMoney(m.reajuste)),
    el('td', { class: 'num' }, fmtMoney(m.neto)),
    el('td', { class: 'num' }, fmtMoney(m.total)),
    el('td', { class: 'num' }, fmtMoney(m.acumBruta)),
    el('td', { class: 'num' }, fmtNum(m.pctAvance, 1) + ' %'),
    el('td', { class: 'num' }, fmtMoney(m.saldo))));

  const suma = campo => rv.meses.reduce((s, m) => s + m[campo], 0);
  const ultimo = rv.meses[rv.meses.length - 1];
  const filaTotal = el('tr', { class: 'fila-total' },
    el('td', {}, 'TOTAL'),
    el('td', { class: 'num' }, fmtMoney(suma('bruta'))),
    el('td', { class: 'num' }, fmtMoney(suma('reajuste'))),
    el('td', { class: 'num' }, fmtMoney(suma('neto'))),
    el('td', { class: 'num ok' }, fmtMoney(suma('total'))),
    el('td', { class: 'num' }, fmtMoney(ultimo.acumBruta)),
    el('td', { class: 'num' }, fmtNum(ultimo.pctAvance, 1) + ' %'),
    el('td', { class: 'num' }, fmtMoney(ultimo.saldo)));

  return el('div', { class: 'panel' },
    el('div', { class: 'panel-cab' },
      el('div', {},
        el('h2', {}, 'Resumen de valorizaciones'),
        el('div', { class: 'sub' },
          `Costo directo: ${fmtMoney(rv.costoDirecto)} · ${rv.meses.length} mes${rv.meses.length === 1 ? '' : 'es'} de ejecución · clic en un mes para abrirlo`))),
    el('div', { class: 'envoltorio-tabla' },
      el('table', { class: 'tabla' },
        el('thead', {}, el('tr', {},
          el('th', {}, 'Mes'),
          el('th', { class: 'num' }, 'Bruta'),
          el('th', { class: 'num' }, 'Reajuste'),
          el('th', { class: 'num' }, 'Neto'),
          el('th', { class: 'num' }, 'Total c/IGV'),
          el('th', { class: 'num' }, 'Acumulada'),
          el('th', { class: 'num' }, '% Avance'),
          el('th', { class: 'num' }, 'Saldo por valorizar'))),
        el('tbody', {}, filas, filaTotal))),
    graficoResumen(rv, mesActivo));
}

// --- Nota metodológica -------------------------------------------------------
function notaModelo() {
  const linea = (formula, glosa) => el('div', {},
    el('span', { class: 'mono', style: { fontSize: '12px' } }, formula),
    glosa ? el('span', { class: 'texto-3' }, `  — ${glosa}`) : null);
  return el('div', { class: 'nota' },
    el('b', {}, 'Modelo de cálculo (transparente y auditable):'),
    el('div', { style: { marginTop: '7px', display: 'flex', flexDirection: 'column', gap: '3px' } },
      linea('V bruta   = Σ parcial de partida × Δ % de avance del mes'),
      linea('Reajuste  = V × (K − 1)', 'K del mes según la fórmula polinómica'),
      linea('Amort. AD = V × (% adelanto directo / 100)', 'proporcional a la valorización'),
      linea('Amort. AM = monto manual del mes', 'según agotamiento del adelanto de materiales'),
      linea('Neto      = V + Reajuste − Amort. AD − Amort. AM'),
      linea('IGV       = Neto × IGV %   ·   Total = Neto + IGV')),
    el('div', { style: { marginTop: '9px' } },
      el('b', {}, 'Recuerda: '),
      'la deducción del reajuste que no corresponde por los adelantos otorgados no está automatizada; si aplica a tu contrato, regístrala como parte de la amortización manual del mes.'));
}

// --- Render principal --------------------------------------------------------
export function render(container, params) {
  const p = store.getProyecto();
  const meses = mesesProyecto(p);

  if (!meses.length) {
    container.append(
      cabecera([], null),
      el('div', { class: 'panel' },
        el('div', { class: 'vacio' },
          icono('valorizacion', 32),
          'Aún no hay meses que valorizar: el cronograma no tiene partidas programadas.', el('br'),
          el('a', { href: '#/programacion', style: { color: 'var(--acento-fuerte)' } }, 'Programa las partidas para generar el calendario de valorizaciones.'))));
    return;
  }

  const mes = meses.includes(params?.[0]) ? params[0] : meses[0];
  const v = valorizacionMes(p, mes);
  const rv = resumenValorizaciones(p);

  container.append(
    cabecera(meses, mes),
    bloqueKpis(v),
    panelAvance(p, v, mes),
    panelLiquidacion(p, v, mes),
    panelResumen(rv, mes),
    notaModelo());
}
