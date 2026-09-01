// gantt.js — Diagrama de Gantt (v2, #/gantt): cabecera temporal de dos niveles
// (meses + semanas/días), columna de partidas dentro del propio SVG, barras
// coloreadas por título raíz con overlay de avance físico, flechas de
// dependencia fin→inicio, fila de valorización mensual alineada a la escala,
// línea "hoy", leyenda con resumen y curva S del avance programado.
// Todos los cálculos vienen de calc.js; esta vista no reimplementa nada.
import * as store from '../core/store.js';
import { arbolPlano, cronogramaCalc, fechasEfectivas, avanceProyecto } from '../core/calc.js';
import { fmtMoney, fmtNum, fmtFecha, fmtMesAnio, hoyISO, addDias, diffDias, isoToDate, MESES_CORTO } from '../core/fmt.js';
import { el, icono } from '../ui/components.js';

// Paleta que rota por cada título de nivel 1.
const PALETA = ['var(--c-mo)', 'var(--c-mat)', 'var(--c-eq)', 'var(--c-sc)', 'var(--acento)'];

// Geometría del SVG.
const ANCHO_TXT = 350;                 // columna izquierda (código + descripción)
const FILA = 28;                       // alto de cada fila del árbol
const H_MES = 22, H_SUB = 20, H_VAL = 34;
const CAB = H_MES + H_SUB + H_VAL;     // cabecera total: meses + semanas/días + valorización

// Estado de UI (persiste entre re-renders; jamás en el store).
let zoom = 'semanas'; // 'semanas' ≈ 8 px/día | 'meses' ≈ 3 px/día

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const truncar = (s, n) => { s = String(s ?? ''); return s.length > n ? s.slice(0, Math.max(1, n - 1)) + '…' : s; };
const r1 = v => Math.round(v * 10) / 10;

export function render(container) {
  const proy = store.getProyecto();
  // Guarda: sin fecha de inicio válida se usa hoy solo para calcular (no muta el store).
  const py = proy.fechaInicio ? proy : { ...proy, fechaInicio: hoyISO() };

  const plano = arbolPlano(py);
  const partidas = plano.filter(n => n.item.tipo === 'partida');

  if (!partidas.length) {
    container.append(
      el('div', { class: 'cabecera-vista' },
        el('div', {},
          el('h1', {}, 'Diagrama de Gantt'),
          el('div', { class: 'sub' }, 'Sin partidas programadas'))),
      el('div', { class: 'panel' },
        el('div', { class: 'vacio' },
          icono('cronograma', 36),
          el('div', {}, 'Este proyecto aún no tiene partidas que graficar.'),
          el('div', { class: 'texto-3' }, 'Crea partidas en el presupuesto y asígnales duración y predecesor en Programación; el Gantt se dibujará aquí automáticamente.'),
          el('div', { style: { marginTop: '14px' } },
            el('button', { class: 'btn btn-primario', onclick: () => { location.hash = '#/presupuesto'; } }, 'Ir al presupuesto')))));
    return;
  }

  const crono = cronogramaCalc(py);
  const fechas = fechasEfectivas(py);

  container.append(
    cabecera(py, crono, container),
    panelGantt(py, plano, crono, fechas),
    panelLeyenda(py, plano, crono, partidas.length),
    panelCurvaS(crono),
  );
}

// --- Cabecera de vista -------------------------------------------------------
function cabecera(py, crono, container) {
  const semanas = Math.ceil(crono.fin / 7);
  const sub = `${fmtFecha(py.fechaInicio)} → ${fmtFecha(crono.finISO)} · ${crono.fin} ${crono.fin === 1 ? 'día' : 'días'} (${semanas} ${semanas === 1 ? 'semana' : 'semanas'})`;

  const seg = (id, etiqueta) => el('button', {
    class: 'segmento' + (zoom === id ? ' activo' : ''),
    onclick: () => { if (zoom !== id) { zoom = id; container.replaceChildren(); render(container); } },
  }, etiqueta);

  return el('div', { class: 'cabecera-vista' },
    el('div', {},
      el('h1', {}, 'Diagrama de Gantt'),
      el('div', { class: 'sub' }, sub)),
    el('div', { class: 'acciones' },
      el('div', { class: 'segmentos', title: 'Escala del diagrama' }, seg('semanas', 'Semanas'), seg('meses', 'Meses')),
      el('button', { class: 'btn', onclick: () => window.print() }, icono('imprimir', 15), 'Imprimir')));
}

// --- Meses del rango: [{anio, mes(0-11), d0, d1, diaInicial}] (d1 exclusivo) --
function segmentosMes(inicioISO, finDias) {
  const segs = [];
  let d = 0;
  while (d < finDias) {
    const f = isoToDate(addDias(inicioISO, d));
    const sig = new Date(f.getFullYear(), f.getMonth() + 1, 1);
    const isoSig = `${sig.getFullYear()}-${String(sig.getMonth() + 1).padStart(2, '0')}-01`;
    const dSig = d + diffDias(addDias(inicioISO, d), isoSig);
    segs.push({ anio: f.getFullYear(), mes: f.getMonth(), d0: d, d1: Math.min(finDias, dSig), diaInicial: f.getDate() });
    d = dSig;
  }
  return segs;
}

// --- Panel principal: el Gantt en un único SVG -------------------------------
function panelGantt(py, plano, crono, fechas) {
  const DIA = zoom === 'semanas' ? 8 : 3;
  const fin = Math.max(crono.fin, 7);
  const X = d => ANCHO_TXT + d * DIA;
  const totalW = Math.max(880, X(fin) + 26);
  const totalH = CAB + plano.length * FILA + 10;
  const segs = segmentosMes(py.fechaInicio, fin);

  // Color por título raíz: la paleta rota con cada título de nivel 1.
  let raiz = -1;
  const colorFila = [];
  for (const n of plano) {
    if (n.nivel === 1 && n.item.tipo === 'titulo') raiz++;
    colorFila.push(PALETA[Math.max(0, raiz) % PALETA.length]);
  }

  const fondo = [], grid = [], cont = [], flechas = [], encima = [];

  // — Fila 1: meses (celdas sombreadas alternas + tinte sutil de columna) —
  segs.forEach((s, i) => {
    const x0 = X(s.d0), w = X(s.d1) - X(s.d0);
    if (i % 2 === 1) {
      fondo.push(`<rect x="${x0}" y="0" width="${w}" height="${H_MES}" fill="var(--fondo-3)"/>`);
      fondo.push(`<rect x="${x0}" y="${CAB}" width="${w}" height="${totalH - CAB}" fill="var(--texto-3)" opacity=".045"/>`);
    }
    if (i > 0) grid.push(`<line class="gantt-linea" x1="${x0}" y1="0" x2="${x0}" y2="${totalH}"/>`);
    if (w > 34) cont.push(`<text x="${x0 + 6}" y="15" style="fill:var(--texto-2);font-size:10.5px;font-weight:600">${esc(truncar(fmtMesAnio(s.anio, s.mes), Math.max(3, Math.floor(w / 6.2))))}</text>`);
  });

  // — Fila 2: semanas "S1…" (zoom semanas) o números de día 1/8/15/22 (zoom meses) —
  if (zoom === 'semanas') {
    for (let w = 0; w * 7 < fin; w++) {
      const x = X(w * 7);
      if (w > 0) grid.push(`<line class="gantt-linea" x1="${x}" y1="${H_MES}" x2="${x}" y2="${totalH}" opacity=".55"/>`);
      cont.push(`<text x="${x + 3}" y="${H_MES + 14}" style="fill:var(--texto-3);font-family:var(--mono);font-size:9.5px">S${w + 1}</text>`);
    }
  } else {
    for (const s of segs) {
      for (const dia of [1, 8, 15, 22]) {
        const off = s.d0 + (dia - s.diaInicial);
        if (off < s.d0 || off >= s.d1) continue;
        const x = X(off);
        if (off > s.d0) grid.push(`<line class="gantt-linea" x1="${x}" y1="${H_MES}" x2="${x}" y2="${totalH}" opacity=".45"/>`);
        cont.push(`<text x="${x + 2}" y="${H_MES + 14}" style="fill:var(--texto-3);font-family:var(--mono);font-size:9px">${dia}</text>`);
      }
    }
  }

  // — Separadores de cabecera y columna izquierda —
  grid.push(`<line class="gantt-linea" x1="0" y1="${H_MES}" x2="${totalW}" y2="${H_MES}"/>`);
  grid.push(`<line class="gantt-linea" x1="0" y1="${H_MES + H_SUB}" x2="${totalW}" y2="${H_MES + H_SUB}"/>`);
  grid.push(`<line class="gantt-linea" x1="0" y1="${CAB}" x2="${totalW}" y2="${CAB}"/>`);
  grid.push(`<line class="gantt-linea" x1="${ANCHO_TXT}" y1="0" x2="${ANCHO_TXT}" y2="${totalH}"/>`);
  cont.push(`<text x="10" y="15" style="fill:var(--texto-3);font-size:9.5px;font-weight:700;letter-spacing:.08em">CÓDIGO · DESCRIPCIÓN</text>`);
  cont.push(`<text x="10" y="${H_MES + H_SUB + 20}" style="fill:var(--texto-3);font-size:9.5px;font-weight:700;letter-spacing:.08em">VALORIZACIÓN MENSUAL (S/)</text>`);

  // — Fila 3: mini barras del monto mensual, alineadas a la escala —
  const maxMonto = Math.max(0, ...crono.meses.map(m => m.monto));
  if (maxMonto > 0) {
    const segPorMes = new Map(segs.map(s => [`${s.anio}-${s.mes}`, s]));
    const yBase = CAB - 4;
    for (const m of crono.meses) {
      const s = segPorMes.get(`${m.anio}-${m.mes}`);
      if (!s) continue;
      const x0 = r1(X(s.d0) + 1.5), w = r1(Math.max(2, (s.d1 - s.d0) * DIA - 3));
      const h = r1(4 + 22 * m.monto / maxMonto); // máx. 26 px
      const tip = `${fmtMesAnio(m.anio, m.mes)}\nValorización: ${fmtMoney(m.monto)}\nAcumulado: ${fmtMoney(m.acumulado)} (${fmtNum(m.pctAcum, 1)} %)`;
      cont.push(`<rect x="${x0}" y="${r1(yBase - h)}" width="${w}" height="${h}" rx="2" fill="var(--acento)" opacity=".45"><title>${esc(tip)}</title></rect>`);
    }
  }

  // — Filas del árbol: títulos, partidas y barras —
  plano.forEach((n, i) => {
    const y = CAB + i * FILA;
    const it = n.item;
    const sang = 10 + (n.nivel - 1) * 13;
    if (i > 0) grid.push(`<line x1="0" y1="${y}" x2="${totalW}" y2="${y}" stroke="var(--panel-borde)" opacity=".55"/>`);

    if (it.tipo === 'titulo') {
      fondo.push(`<rect x="0" y="${y}" width="${totalW}" height="${FILA}" fill="var(--acento-suave)"/>`);
      if (n.nivel === 1) fondo.push(`<rect x="0" y="${y}" width="3.5" height="${FILA}" fill="${colorFila[i]}"/>`);
      const max = Math.floor((ANCHO_TXT - sang - 12) / 6.4);
      cont.push(`<text x="${sang}" y="${y + 18}" style="fill:var(--acento-texto);font-size:11px;font-weight:700;letter-spacing:.03em">${esc(truncar(`${n.codigo}  ${String(it.descripcion).toUpperCase()}`, max))}</text>`);
      return;
    }

    const max = Math.floor((ANCHO_TXT - sang - 64) / 5.9);
    cont.push(`<text x="${sang}" y="${y + 18}" style="fill:var(--texto-3);font-family:var(--mono);font-size:10px">${esc(n.codigo)}</text>`);
    cont.push(`<text x="${sang + 56}" y="${y + 18}" style="fill:var(--texto);font-size:11.5px">${esc(truncar(it.descripcion, max))}</text>`);

    const f = fechas.get(it.id);
    if (!f) return;
    const bx = X(f.inicioDias);
    const bw = Math.max(3, (f.finDias - f.inicioDias) * DIA);
    const av = Math.min(100, Math.max(0, Number(it.avancePct) || 0));
    const dur = f.finDias - f.inicioDias;
    const tip = `${n.codigo} — ${it.descripcion}\n${fmtFecha(f.inicioISO)} → ${fmtFecha(f.finISO)} · ${dur} ${dur === 1 ? 'día' : 'días'}\nParcial: ${fmtMoney(n.parcial)} · Avance físico: ${fmtNum(av, 0)} %`;
    cont.push(`<rect x="${bx}" y="${y + 5}" width="${r1(bw)}" height="18" rx="5" fill="${colorFila[i]}" opacity=".9"><title>${esc(tip)}</title></rect>`);
    if (av > 0) {
      cont.push(`<rect x="${bx}" y="${y + 5}" width="${r1(Math.max(2, bw * av / 100))}" height="18" rx="5" fill="#fff" opacity=".35" pointer-events="none"/>`);
      cont.push(`<text x="${r1(bx + bw + 5)}" y="${y + 18}" style="fill:var(--texto-3);font-family:var(--mono);font-size:9.5px">${fmtNum(av, 0)}%</text>`);
    }
  });

  // — Flechas de dependencia fin→inicio (esquinas rectas + punta triangular) —
  const filaDe = new Map();
  plano.forEach((n, i) => filaDe.set(n.item.id, i));
  const trazos = [], puntas = [];
  for (const n of plano) {
    const it = n.item;
    if (it.tipo !== 'partida' || !it.predecesorId) continue;
    const fS = fechas.get(it.id), fP = fechas.get(it.predecesorId);
    const iS = filaDe.get(it.id), iP = filaDe.get(it.predecesorId);
    if (!fS || !fP || iS == null || iP == null || iS === iP) continue;
    const x1 = X(fP.finDias), y1 = CAB + iP * FILA + FILA / 2;
    const x2 = X(fS.inicioDias), y2 = CAB + iS * FILA + FILA / 2;
    let d;
    if (x2 >= x1 + 10) {
      d = `M ${x1} ${y1} H ${r1(x2 - 5)} V ${y2} H ${r1(x2 - 4)}`;
    } else {
      // La sucesora arranca antes del fin del predecesor: rodeo por el borde de fila.
      const yb = iS > iP ? CAB + iS * FILA : CAB + (iS + 1) * FILA;
      d = `M ${x1} ${y1} H ${r1(x1 + 7)} V ${yb} H ${r1(x2 - 8)} V ${y2} H ${r1(x2 - 4)}`;
    }
    trazos.push(`<path d="${d}"/>`);
    puntas.push(`<polygon points="${r1(x2 - 5)},${y2 - 3.5} ${r1(x2 - 5)},${y2 + 3.5} ${x2},${y2}"/>`);
  }
  if (trazos.length) {
    flechas.push(`<g fill="none" stroke="var(--texto-3)" stroke-width="1.3" opacity=".55">${trazos.join('')}</g>`);
    flechas.push(`<g fill="var(--texto-3)" opacity=".55">${puntas.join('')}</g>`);
  }

  // — Línea "hoy" si cae dentro del rango del proyecto —
  const hd = diffDias(py.fechaInicio, hoyISO());
  if (hd >= 0 && hd <= fin) {
    const x = X(hd);
    encima.push(`<line class="gantt-hoy" x1="${x}" y1="${H_MES}" x2="${x}" y2="${totalH}"/>`);
    encima.push(`<text x="${x + 4}" y="${H_MES + 12}" style="fill:var(--peligro);font-size:9.5px;font-weight:700">Hoy</text>`);
  }

  const svg = `<svg class="gantt-svg" width="${totalW}" height="${totalH}" viewBox="0 0 ${totalW} ${totalH}" xmlns="http://www.w3.org/2000/svg">${fondo.join('')}${grid.join('')}${cont.join('')}${flechas.join('')}${encima.join('')}</svg>`;

  return el('div', { class: 'panel' },
    el('div', { class: 'panel-cab' },
      el('div', {},
        el('h2', {}, 'Cronograma de barras'),
        el('div', { class: 'sub' },
          `Escala ${zoom === 'semanas' ? 'semanal (≈8 px/día)' : 'mensual (≈3 px/día)'} · el brillo sobre cada barra es el avance físico · las flechas indican precedencia fin→inicio`))),
    el('div', { class: 'gantt-envoltorio' }, el('div', { html: svg })));
}

// --- Leyenda por título raíz + resumen ---------------------------------------
function kpi(etiqueta, valor, sub = '', clase = '') {
  return el('div', { class: clase ? `kpi ${clase}` : 'kpi' },
    el('div', { class: 'kpi-etiqueta' }, etiqueta),
    el('div', { class: 'kpi-valor' }, valor),
    sub ? el('div', { class: 'kpi-sub' }, sub) : null);
}

function panelLeyenda(py, plano, crono, nPartidas) {
  const leyenda = [];
  let raiz = -1;
  for (const n of plano) {
    if (n.nivel === 1 && n.item.tipo === 'titulo') {
      raiz++;
      leyenda.push({ nombre: `${n.codigo}  ${n.item.descripcion}`, color: PALETA[raiz % PALETA.length], monto: n.parcial });
    }
  }
  return el('div', { class: 'panel' },
    el('div', { class: 'panel-cab' },
      el('div', {},
        el('h2', {}, 'Leyenda y resumen'),
        el('div', { class: 'sub' }, 'Un color por título de nivel 1 · métricas del cronograma vigente'))),
    el('div', { class: 'grid-kpi', style: { marginBottom: leyenda.length ? '14px' : '0' } },
      kpi('Costo directo programado', fmtMoney(crono.costoDirecto)),
      kpi('Duración', `${crono.fin} ${crono.fin === 1 ? 'día' : 'días'}`, `${fmtFecha(py.fechaInicio)} → ${fmtFecha(crono.finISO)}`, 'violeta'),
      kpi('Partidas programadas', fmtNum(nPartidas, 0), `${crono.meses.length} ${crono.meses.length === 1 ? 'mes valorizado' : 'meses valorizados'}`, 'verde'),
      kpi('Avance físico', fmtNum(avanceProyecto(py), 1) + ' %', 'ponderado por parcial de partida', 'ambar')),
    leyenda.length ? el('div', { class: 'leyenda', style: { marginTop: '0' } },
      leyenda.map(l => el('span', { title: `Parcial: ${fmtMoney(l.monto)}` },
        el('span', { class: 'punto', style: { background: l.color } }),
        truncar(l.nombre, 46)))) : null);
}

// --- Curva S: % acumulado programado por mes ---------------------------------
function panelCurvaS(crono) {
  return el('div', { class: 'panel' },
    el('div', { class: 'panel-cab' },
      el('div', {},
        el('h2', {}, 'Curva S — avance programado'),
        el('div', { class: 'sub' }, '% del costo directo acumulado al cierre de cada mes según el cronograma de barras'))),
    el('div', { html: svgCurvaS(crono.meses) }));
}

function svgCurvaS(meses) {
  const n = meses.length;
  if (!n) return '<div class="vacio">Sin meses valorizados que graficar.</div>';
  const W = 900, H = 280, padL = 46, padR = 20, padT = 26, padB = 36;
  const pw = W - padL - padR, ph = H - padT - padB;
  const X = i => r1(padL + (n === 1 ? pw / 2 : i * pw / (n - 1)));
  const Y = pct => r1(padT + ph * (1 - pct / 100));
  const s = [];

  // Rejilla 0–100 % y eje.
  for (const g of [0, 25, 50, 75, 100]) {
    const y = Y(g);
    s.push(`<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="var(--panel-borde)"${g ? ' stroke-dasharray="3 4"' : ''}/>`);
    s.push(`<text x="${padL - 8}" y="${y + 3.5}" text-anchor="end" style="fill:var(--texto-3);font-size:10px;font-family:var(--mono)">${g}%</text>`);
  }
  s.push(`<line x1="${padL}" y1="${padT}" x2="${padL}" y2="${Y(0)}" stroke="var(--panel-borde)"/>`);

  const pts = meses.map((m, i) => [X(i), Y(m.pctAcum)]);

  // Trazo suave (Catmull-Rom → Bézier, con control acotado a 0–100 %).
  if (n > 1) {
    const acota = y => Math.min(Y(0), Math.max(Y(100), y));
    let linea = `M ${pts[0][0]} ${pts[0][1]}`;
    for (let i = 0; i < n - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n - 1, i + 2)];
      const c1x = r1(p1[0] + (p2[0] - p0[0]) / 6), c1y = r1(acota(p1[1] + (p2[1] - p0[1]) / 6));
      const c2x = r1(p2[0] - (p3[0] - p1[0]) / 6), c2y = r1(acota(p2[1] - (p3[1] - p1[1]) / 6));
      linea += ` C ${c1x} ${c1y} ${c2x} ${c2y} ${p2[0]} ${p2[1]}`;
    }
    s.push(`<path d="${linea} L ${pts[n - 1][0]} ${Y(0)} L ${pts[0][0]} ${Y(0)} Z" fill="var(--acento)" fill-opacity=".12" stroke="none"/>`);
    s.push(`<path d="${linea}" fill="none" stroke="var(--acento)" stroke-width="2.2" stroke-linecap="round"/>`);
  }

  // Puntos etiquetados (con muchos meses, etiquetas alternas).
  const paso = n > 14 ? 2 : 1;
  meses.forEach((m, i) => {
    const [x, y] = pts[i];
    const tip = `${fmtMesAnio(m.anio, m.mes)}\nValorización: ${fmtMoney(m.monto)}\nAcumulado: ${fmtMoney(m.acumulado)} (${fmtNum(m.pctAcum, 1)} %)`;
    s.push(`<circle cx="${x}" cy="${y}" r="3.6" fill="var(--acento-fuerte)" stroke="var(--panel)" stroke-width="1.4"><title>${esc(tip)}</title></circle>`);
    if (i % paso === 0 || i === n - 1) {
      s.push(`<text x="${x}" y="${y - 10}" text-anchor="middle" style="fill:var(--texto-2);font-size:10px;font-family:var(--mono);font-weight:600">${fmtNum(m.pctAcum, 0)}%</text>`);
      const lbl = MESES_CORTO[m.mes] + (i === 0 || m.mes === 0 ? ` ${String(m.anio).slice(-2)}` : '');
      s.push(`<text x="${x}" y="${H - 12}" text-anchor="middle" style="fill:var(--texto-3);font-size:10px">${lbl}</text>`);
    }
  });

  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block" xmlns="http://www.w3.org/2000/svg">${s.join('')}</svg>`;
}
