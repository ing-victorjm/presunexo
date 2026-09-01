// polinomica.js — Fórmula polinómica (#/polinomica): monomios según DS 011-79-VC,
// coeficiente K por mes con gráfico, detalle auditable del K y gestor de
// Índices Unificados INEI (base dic-2025 = 100).
import * as store from '../core/store.js';
import { resumen } from '../core/calc.js';
import { polinomicaEfectiva, coeficienteK, serieK, mesBase, validarMonomios } from '../core/polinomica.js';
import { mesesProyecto } from '../core/valorizacion.js';
import { fmtMoney, fmtNum, parseNum, MESES_CORTO } from '../core/fmt.js';
import { el, icono, modal, toast, confirmar, campo } from '../ui/components.js';
import { IU_CATALOGO, AREAS_GEO, METADATA_INDICES, serieCompleta,
         guardarIndicesMes, mesesDisponibles, indiceIU } from '../data/indices.js';

// --- Estado de UI (a nivel de módulo, nunca en el store) --------------------
let raiz = null;
let mesDetalle = null;   // mes elegido en "Detalle del K de un mes"
let mesGestor = null;    // mes elegido en el gestor de índices
let verTodos = false;    // gestor: mostrar la relación completa de IU

function rerender() { if (raiz) { raiz.replaceChildren(); render(raiz); } }

// --- Utilidades locales ------------------------------------------------------
// 'YYYY-MM' → 'jun-2026'
function mesCorto(key) {
  if (!key) return '—';
  const [y, m] = key.split('-').map(Number);
  return `${(MESES_CORTO[m - 1] || '?').toLowerCase()}-${y}`;
}

function mesSiguiente(key) {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// Ordena códigos IU tipo '02', '47-1'.
const ordenIU = (a, b) => (parseFloat(a) - parseFloat(b)) || String(a).localeCompare(String(b));

// Letras únicas para la notación K = a(Jr/Jo) + … a partir del nombre del monomio.
function letrasMonomios(monomios) {
  const usadas = new Set();
  return monomios.map(m => {
    const base = (m.nombre || 'X').normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^A-Za-z]/g, '').toUpperCase() || 'X';
    let letra = base[0];
    for (let i = 1; usadas.has(letra) && i < base.length; i++) letra = base[i];
    if (usadas.has(letra)) { let n = 2; while (usadas.has(base[0] + n)) n++; letra = base[0] + n; }
    usadas.add(letra);
    return letra;
  });
}

// --- Gráfico SVG de la serie K ----------------------------------------------
function svgSerieK(serie) {
  const n = serie.length;
  const W = Math.max(460, 72 * n + 84), H = 232;
  const padL = 54, padR = 22, padT = 24, padB = 38;
  const ks = serie.map(s => s.k);
  let min = Math.min(...ks, 1), max = Math.max(...ks, 1);
  if (max - min < 0.01) { min -= 0.01; max += 0.01; }
  const holgura = (max - min) * 0.14;
  min -= holgura; max += holgura;
  const X = i => n === 1 ? padL + (W - padL - padR) / 2 : padL + i * (W - padL - padR) / (n - 1);
  const Y = v => padT + (max - v) * (H - padT - padB) / (max - min);

  let s = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="display:block" role="img" aria-label="Evolución del coeficiente K por mes">`;
  for (let t = 0; t <= 4; t++) {
    const v = min + (max - min) * t / 4;
    const y = Y(v);
    s += `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="var(--panel-borde)" stroke-width="1"/>`;
    s += `<text x="${padL - 8}" y="${y + 3.5}" text-anchor="end" font-size="10" font-family="var(--mono)" fill="var(--texto-3)">${v.toFixed(3)}</text>`;
  }
  const y1 = Y(1);
  s += `<line x1="${padL}" y1="${y1}" x2="${W - padR}" y2="${y1}" stroke="var(--texto-3)" stroke-width="1" stroke-dasharray="5 4"/>`;
  s += `<text x="${W - padR}" y="${y1 - 5}" text-anchor="end" font-size="9.5" font-family="var(--fuente)" fill="var(--texto-3)">K = 1.000</text>`;
  s += `<polyline points="${serie.map((sk, i) => `${X(i)},${Y(sk.k)}`).join(' ')}" fill="none" stroke="var(--acento)" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>`;
  serie.forEach((sk, i) => {
    const x = X(i), y = Y(sk.k);
    s += `<g><circle cx="${x}" cy="${y}" r="4" fill="${sk.incompleto ? 'var(--alerta)' : 'var(--acento)'}" stroke="var(--panel)" stroke-width="1.6"/>`;
    s += `<text x="${x}" y="${y - 9}" text-anchor="middle" font-size="10" font-family="var(--mono)" font-weight="600" fill="var(--texto-2)">${sk.k.toFixed(3)}</text>`;
    s += `<text x="${x}" y="${H - padB + 17}" text-anchor="middle" font-size="10" font-family="var(--fuente)" fill="var(--texto-3)">${mesCorto(sk.mes)}</text>`;
    s += `<title>${mesCorto(sk.mes)} · K = ${sk.k.toFixed(3)}${sk.incompleto ? ' (índice provisional)' : ''}</title></g>`;
  });
  return s + '</svg>';
}

// --- Modales del gestor de índices ------------------------------------------
function abrirModalAgregarMes() {
  const ultimo = mesesDisponibles().slice(-1)[0] || '2025-12';
  const inMes = el('input', { type: 'month', value: mesSiguiente(ultimo), min: '2025-12', style: { width: '100%' } });
  modal({
    titulo: 'Agregar mes de índices',
    ancho: 430,
    contenido: el('div', {},
      campo('Mes (YYYY-MM)', inMes, 'El mes se crea vacío: luego edita los valores en la tabla o impórtalos con el JSON de actualizar_indices.py.')),
    acciones: [
      { label: 'Cancelar', clase: 'btn-sec' },
      {
        label: 'Agregar mes', clase: 'btn-primario',
        onClick: () => {
          const v = (inMes.value || '').trim();
          if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(v)) { toast('Escribe el mes en formato YYYY-MM, p. ej. 2026-09', 'error'); return false; }
          if (mesesDisponibles().includes(v)) toast(`El mes ${mesCorto(v)} ya existe: se muestra en la tabla`, 'info');
          else { guardarIndicesMes(v, {}); toast(`Mes ${mesCorto(v)} agregado`); }
          mesGestor = v;
          rerender();
        },
      },
    ],
  });
}

function importarIndicesJSON() {
  const input = el('input', { type: 'file', accept: '.json,application/json' });
  input.addEventListener('change', async () => {
    const archivo = input.files[0];
    if (!archivo) return;
    try {
      const dato = JSON.parse(await archivo.text());
      if (!dato || typeof dato.mes !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(dato.mes) ||
          !dato.valores || typeof dato.valores !== 'object' || Array.isArray(dato.valores)) {
        throw new Error('Formato esperado: { "mes": "YYYY-MM", "valores": { "21": 103.1, … } } (lo genera actualizar_indices.py).');
      }
      const limpios = {};
      let n = 0;
      for (const [iu, v] of Object.entries(dato.valores)) {
        const num = parseNum(v);
        if (!isNaN(num) && num > 0) { limpios[iu] = Math.round(num * 100) / 100; n++; }
      }
      if (!n) throw new Error('El archivo no contiene valores numéricos de índices.');
      guardarIndicesMes(dato.mes, limpios);
      mesGestor = dato.mes;
      toast(`${n} índices importados para ${mesCorto(dato.mes)}`);
      rerender();
    } catch (e) {
      toast(e.message || 'No se pudo importar el archivo', 'error');
    }
  });
  input.click();
}

function abrirModalComoActualizar() {
  const codigo = txt => el('code', {
    class: 'mono',
    style: { background: 'var(--fondo-3)', border: '1px solid var(--panel-borde)', padding: '2px 7px', borderRadius: '6px', fontSize: '11.5px' },
  }, txt);
  modal({
    titulo: 'Cómo actualizar los índices INEI',
    ancho: 580,
    contenido: el('div', {},
      el('ol', { style: { paddingLeft: '20px', color: 'var(--texto-2)', fontSize: '13px', lineHeight: '1.7', display: 'flex', flexDirection: 'column', gap: '9px', margin: '4px 0' } },
        el('li', {}, 'Busca en El Peruano la Resolución Jefatural del INEI con los Índices Unificados del mes. Se publica a mediados del mes siguiente (p. ej., los índices de julio salen hacia el 15 de agosto).'),
        el('li', {}, 'Ejecuta el script incluido en el proyecto: ', codigo('python actualizar_indices.py --mes YYYY-MM --url <enlace de El Peruano>'),
          ' — genera un JSON con el formato ', codigo('{ "mes": "YYYY-MM", "valores": { "21": 103.1, … } }'), '.'),
        el('li', {}, 'Vuelve a esta vista y usa “Importar JSON”, o escribe los valores directamente en la tabla del gestor (se guardan en este navegador y priman sobre los datos de fábrica).')),
      el('div', { class: 'texto-3', style: { margin: '14px 0 6px', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.08em' } }, 'Fuentes oficiales'),
      el('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px' } },
        METADATA_INDICES.fuentes.map(f =>
          el('a', {
            href: f.url, target: '_blank', rel: 'noopener',
            style: { display: 'inline-flex', alignItems: 'center', gap: '7px', color: 'var(--acento-texto)', fontSize: '12.5px', textDecoration: 'none' },
          }, icono('enlace', 13), `${f.rj} — ${f.detalle}`)))),
    acciones: [{ label: 'Entendido', clase: 'btn-primario' }],
  });
}

// Celda editable de valor de índice.
function inputIndice(iu, mesKey) {
  const directo = (serieCompleta()[mesKey] || {})[iu];
  const mostrado = directo != null ? Number(directo).toFixed(2) : '';
  const fb = indiceIU(iu, mesKey);
  return el('input', {
    class: 'celda-input',
    value: mostrado,
    placeholder: fb ? `${Number(fb.valor).toFixed(2)} (${mesCorto(fb.mes)})` : '—',
    title: directo == null && fb
      ? `Sin valor propio en ${mesCorto(mesKey)}: el cálculo usa ${Number(fb.valor).toFixed(2)} de ${mesCorto(fb.mes)}. Escribe el valor oficial y pulsa Enter.`
      : 'Editar valor · Enter para guardar',
    onkeydown: e => { if (e.key === 'Enter') e.target.blur(); },
    onchange: e => {
      const txt = e.target.value.trim();
      if (txt === '') { e.target.value = mostrado; return; }
      const v = parseNum(txt);
      if (isNaN(v) || v <= 0) {
        toast('Valor inválido: el índice debe ser un número mayor que 0', 'error');
        e.target.value = mostrado;
        return;
      }
      guardarIndicesMes(mesKey, { [iu]: Math.round(v * 100) / 100 });
      toast(`IU ${iu} · ${mesCorto(mesKey)} = ${(Math.round(v * 100) / 100).toFixed(2)} guardado`);
      rerender();
    },
  });
}

// --- Vista ------------------------------------------------------------------
export function render(container, params) {
  raiz = container;
  const p = store.getProyecto();
  const r = resumen(p);
  const baseMonto = r.subtotal; // CD + GG + UT: base de las incidencias
  const { monomios, personalizada } = polinomicaEfectiva(p);
  const errores = monomios.length ? validarMonomios(monomios) : [];
  const letras = letrasMonomios(monomios);
  const base = mesBase(p);
  const disponibles = mesesDisponibles();
  const mesesObra = mesesProyecto(p);

  // ---- 1 · Cabecera --------------------------------------------------------
  const grupo = (etiqueta, nodo) => el('label', { class: 'fila', style: { gap: '7px' } },
    el('span', { class: 'texto-3', style: { fontSize: '10.5px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.08em' } }, etiqueta),
    nodo);

  const selArea = el('select', { title: 'Área geográfica INEI del proyecto (RJ 016-2026-INEI)' },
    Object.entries(AREAS_GEO).map(([k, nom]) =>
      el('option', { value: k, selected: Number(k) === Number(p.areaGeo) }, `Área ${k} — ${nom}`)));
  selArea.addEventListener('change', e => {
    const v = Number(e.target.value);
    store.update(pr => { pr.areaGeo = v; });
    toast(`Área geográfica del proyecto: ${AREAS_GEO[v]}`, 'info');
  });

  const opcionesBase = [...new Set([...disponibles, base])].sort();
  const selBase = el('select', { title: 'Mes base Io de la fórmula (mes del valor referencial)' },
    opcionesBase.map(m => el('option', { value: m, selected: m === base }, mesCorto(m))));
  selBase.addEventListener('change', e => {
    const v = e.target.value;
    store.update(pr => { pr.polinomica = { ...(pr.polinomica || {}), mesBase: v }; });
    toast(`Mes base de la fórmula: ${mesCorto(v)}`, 'info');
  });

  container.append(el('div', { class: 'cabecera-vista' },
    el('div', {},
      el('h1', {}, 'Fórmula polinómica'),
      el('div', { class: 'sub' },
        `DS 011-79-VC · Índices Unificados INEI base dic-2025 = 100 · Área geográfica: ${AREAS_GEO[p.areaGeo] || '—'}`)),
    el('div', { class: 'acciones' },
      grupo('Área geográfica', selArea),
      grupo('Mes base (Io)', selBase))));

  if (Number(p.areaGeo) !== METADATA_INDICES.areaSerie) {
    container.append(el('div', { class: 'nota nota-alerta' },
      el('b', {}, 'Atención: '),
      `los índices precargados corresponden al área ${METADATA_INDICES.areaSerie} (${AREAS_GEO[METADATA_INDICES.areaSerie]}). `,
      `Para el área ${p.areaGeo} (${AREAS_GEO[p.areaGeo] || '—'}) debes cargar los valores oficiales de tu área en el gestor `,
      '“Índices Unificados INEI” de esta misma vista (importa el JSON del script o edítalos a mano); mientras tanto, el K se calcula con la serie de Lima y Callao.'));
  }

  // ---- 2 · Nota metodológica ----------------------------------------------
  container.append(el('div', {
    class: 'nota',
    html: '<b>K = Σ coef<sub>i</sub> × ( I<sub>i</sub>(mes) / I<sub>i</sub>(base) )</b>. ' +
      'Los coeficientes de incidencia no se inventan: salen del presupuesto real — el costo directo de cada insumo se agrupa por su ' +
      'Índice Unificado, y los gastos generales y la utilidad (GGU) se asignan al IPC (IU 39). ' +
      'Reglas del DS 011-79-VC: máximo <b>8 monomios</b>, cada coeficiente ≥ <b>0.050</b> y la suma exactamente <b>1.000</b> (3 decimales).',
  }));

  // ---- 3 · Panel: Monomios de la fórmula ----------------------------------
  const btnRegenerar = el('button', {
    class: 'btn btn-mini',
    title: 'Descarta los monomios personalizados y vuelve a la fórmula automática por incidencias',
    onclick: async () => {
      if (!personalizada) { toast('La fórmula ya es automática: se recalcula sola con cada cambio del presupuesto', 'info'); return; }
      const ok = await confirmar(
        'Se descartará la fórmula personalizada y se regenerará automáticamente a partir de las incidencias del presupuesto. Puedes deshacer con Ctrl+Z.',
        { titulo: 'Regenerar fórmula', labelOk: 'Regenerar' });
      if (!ok) return;
      store.update(pr => { if (pr.polinomica) delete pr.polinomica.monomios; });
      toast('Fórmula regenerada a partir de las incidencias del presupuesto');
    },
  }, icono('rehacer', 14), 'Regenerar automática');

  const panelMonomios = el('div', { class: 'panel' },
    el('div', { class: 'panel-cab' },
      el('div', {},
        el('h2', {}, 'Monomios de la fórmula'),
        el('div', { class: 'sub' }, 'Incidencia real de cada Índice Unificado sobre CD + GG + UT')),
      el('div', { class: 'fila no-imprimir' },
        personalizada
          ? el('span', { class: 'pill', title: 'Monomios definidos manualmente en el proyecto' }, 'personalizada')
          : el('span', { class: 'pill pill-auto', title: 'Generada automáticamente desde las incidencias del presupuesto: se actualiza sola al editar partidas, metrados o precios' }, 'automática'),
        btnRegenerar)));

  if (!monomios.length) {
    panelMonomios.append(el('div', { class: 'vacio' },
      icono('polinomica', 36),
      el('div', {}, 'Aún no hay fórmula polinómica.'),
      el('div', { class: 'texto-3', style: { marginTop: '4px' } },
        'Agrega partidas con metrados y análisis de costos en el presupuesto: los monomios se generan solos a partir de las incidencias.')));
  } else {
    const sumaCoef = Math.round(monomios.reduce((s, m) => s + (Number(m.coef) || 0), 0) * 1000) / 1000;
    const sumaMonto = monomios.reduce((s, m) => s + (Number(m.monto) || 0), 0);

    const filas = monomios.map((m, i) => {
      const ius = m.ius || [];
      const extra = m.iusExtra || [];
      const iuCalc = m.iuCalculo || ius[0];
      return el('tr', {},
        el('td', { class: 'cod' }, String(i + 1)),
        el('td', {},
          el('span', { class: 'descripcion' }, m.nombre || `Monomio ${i + 1}`),
          el('span', { class: 'texto-3', style: { fontSize: '11px', marginLeft: '8px', fontFamily: 'var(--mono)' } }, `(${letras[i]})`)),
        el('td', {},
          el('div', { class: 'fila', style: { gap: '4px', flexWrap: 'wrap' } },
            ius.map(iu => el('span', {
              class: 'badge badge-iu',
              style: iu === iuCalc ? { fontWeight: '700' } : null,
              title: (IU_CATALOGO[iu]?.nombre || `IU ${iu}`) + (iu === iuCalc ? ' · IU con el que se calcula el monomio' : ''),
            }, iu)),
            extra.length ? el('span', {
              class: 'pill',
              title: 'También agrupa: ' + extra.map(x => `${x} ${(IU_CATALOGO[x]?.nombre || '')}`.trim()).join(' · '),
            }, `+${extra.length} más`) : null)),
        el('td', { class: 'num' }, (Number(m.coef) || 0).toFixed(3)),
        el('td', { class: 'num' }, m.monto != null ? fmtMoney(m.monto) : '—'),
        el('td', { class: 'num texto-2' },
          m.monto != null && baseMonto > 0 ? fmtNum(m.monto / baseMonto * 100, 2) + ' %' : '—'));
    });

    panelMonomios.append(
      el('div', { class: 'envoltorio-tabla', style: { boxShadow: 'none' } },
        el('table', { class: 'tabla' },
          el('thead', {}, el('tr', {},
            el('th', { style: { width: '36px' } }, '#'),
            el('th', {}, 'Monomio'),
            el('th', {}, 'IU agrupados'),
            el('th', { class: 'num' }, 'Coeficiente'),
            el('th', { class: 'num' }, 'Incidencia S/'),
            el('th', { class: 'num' }, '%'))),
          el('tbody', {}, filas),
          el('tfoot', {}, el('tr', { class: 'fila-total' },
            el('td', { colspan: 3 }, 'Σ coeficientes (debe ser 1.000)'),
            el('td', { class: 'num', style: { color: sumaCoef === 1 ? 'var(--ok)' : 'var(--peligro)' } }, sumaCoef.toFixed(3)),
            el('td', { class: 'num' }, sumaMonto > 0 ? fmtMoney(sumaMonto) : '—'),
            el('td', { class: 'num' }, sumaMonto > 0 && baseMonto > 0 ? fmtNum(sumaMonto / baseMonto * 100, 2) + ' %' : '—'))))),
      errores.length
        ? el('div', { class: 'nota nota-alerta', style: { marginTop: '14px', marginBottom: '0' } },
            el('b', {}, 'La fórmula no cumple el DS 011-79-VC:'),
            el('ul', { style: { margin: '6px 0 0 18px' } }, errores.map(e2 => el('li', { style: { marginTop: '2px' } }, e2))))
        : '',
      el('div', { class: 'mono', style: {
        fontSize: '15.5px', lineHeight: '2.05', padding: '15px 19px', marginTop: '15px',
        background: 'var(--fondo-3)', border: '1px solid var(--panel-borde)', borderRadius: '10px',
        display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', columnGap: '2px',
      } },
        el('span', { style: { fontWeight: '700', marginRight: '6px' } }, 'K ='),
        monomios.map((m, i) => [
          i > 0 ? el('span', { class: 'texto-3', style: { margin: '0 8px' } }, '+') : null,
          el('span', { title: `${m.nombre} · IU ${m.iuCalculo || (m.ius || [])[0] || '—'}`, style: { whiteSpace: 'nowrap' } },
            el('b', { style: { color: 'var(--acento-texto)' } }, (Number(m.coef) || 0).toFixed(3)),
            ' (', letras[i], el('sub', {}, 'r'), ' / ', letras[i], el('sub', {}, 'o'), ')'),
        ])),
      el('div', { class: 'texto-3', style: { fontSize: '11.5px', marginTop: '9px', lineHeight: '1.65' } },
        monomios.map((m, i) => `${letras[i]} = ${m.nombre}`).join('  ·  '),
        `. Subíndice r = índice del mes que se reajusta · subíndice o = índice del mes base (${mesCorto(base)}).`));
  }
  container.append(panelMonomios);

  // ---- 4 · Panel: Coeficiente K por mes -----------------------------------
  const panelSerie = el('div', { class: 'panel' });
  const serie = (monomios.length && mesesObra.length) ? serieK(p, mesesObra) : [];
  const hayProvisional = serie.some(s => s.incompleto);
  panelSerie.append(el('div', { class: 'panel-cab' },
    el('div', {},
      el('h2', {}, 'Coeficiente K por mes'),
      el('div', { class: 'sub' }, `Meses del cronograma de obra · mes base ${mesCorto(base)}`)),
    hayProvisional ? el('span', {
      class: 'pill pill-auto',
      title: 'En los meses marcados, INEI aún no publica índices: se usa el último valor disponible (K provisional, se regulariza al publicarse la RJ del mes).',
    }, 'incluye índices provisionales') : null));

  if (!monomios.length) {
    panelSerie.append(el('div', { class: 'vacio' }, 'Sin monomios no hay K: completa primero el presupuesto.'));
  } else if (!mesesObra.length) {
    panelSerie.append(el('div', { class: 'vacio' },
      icono('cronograma', 32),
      el('div', {}, 'El proyecto aún no tiene cronograma.'),
      el('div', { class: 'texto-3', style: { marginTop: '4px' } }, 'Define duraciones en Programación para proyectar el K mes a mes.')));
  } else {
    panelSerie.append(el('div', { class: 'grid-2-min' },
      el('div', { class: 'envoltorio-tabla', style: { boxShadow: 'none', alignSelf: 'start' } },
        el('table', { class: 'tabla' },
          el('thead', {}, el('tr', {},
            el('th', {}, 'Mes'),
            el('th', { class: 'num' }, 'K'),
            el('th', { class: 'num' }, 'Δ % vs 1.000'))),
          el('tbody', {}, serie.map(s => el('tr', {},
            el('td', {},
              mesCorto(s.mes),
              s.incompleto ? el('span', {
                class: 'pill pill-auto', style: { marginLeft: '8px' },
                title: 'INEI aún no publica los índices de este mes: se usa el último disponible (reajuste provisional).',
              }, 'índice provisional') : null),
            el('td', { class: 'num' }, s.k.toFixed(3)),
            el('td', { class: 'num', style: { color: s.k >= 1 ? 'var(--ok)' : 'var(--peligro)' } },
              (s.k >= 1 ? '+' : '') + fmtNum((s.k - 1) * 100, 2) + ' %')))))),
      el('div', {},
        el('div', { style: { overflowX: 'auto' }, html: svgSerieK(serie) }),
        el('div', { class: 'texto-3', style: { fontSize: '11px', marginTop: '6px' } },
          'La línea punteada marca K = 1.000 (sin reajuste). Los puntos ámbar usan el último índice publicado.'))));
  }
  container.append(panelSerie);

  // ---- 5 · Panel: Detalle del K de un mes ---------------------------------
  const panelDetalle = el('div', { class: 'panel' });
  const opcionesDetalle = mesesObra.length ? mesesObra : disponibles;
  if (!opcionesDetalle.includes(mesDetalle)) mesDetalle = opcionesDetalle[opcionesDetalle.length - 1] || null;

  if (!monomios.length || !mesDetalle) {
    panelDetalle.append(
      el('div', { class: 'panel-cab' }, el('div', {}, el('h2', {}, 'Detalle del K de un mes'))),
      el('div', { class: 'vacio' }, 'Cuando exista la fórmula podrás auditar aquí el K de cualquier mes, monomio por monomio.'));
  } else {
    const selMesDet = el('select', {},
      opcionesDetalle.map(m => el('option', { value: m, selected: m === mesDetalle }, mesCorto(m))));
    selMesDet.addEventListener('change', e => { mesDetalle = e.target.value; rerender(); });

    const det = coeficienteK(p, mesDetalle);
    const celdaIndice = (valor, mesReal, mesPedido) =>
      valor != null
        ? [fmtNum(valor, 2),
           mesReal && mesReal !== mesPedido
             ? el('span', { class: 'texto-3', style: { marginLeft: '6px', fontFamily: 'var(--fuente)', fontSize: '11px' } }, `(${mesCorto(mesReal)})`)
             : null]
        : el('span', { class: 'pill', title: 'Este IU no tiene ningún valor en la serie local: se asume factor 1 hasta cargarlo.' }, 'sin índice');

    panelDetalle.append(
      el('div', { class: 'panel-cab' },
        el('div', {},
          el('h2', {}, 'Detalle del K de un mes'),
          el('div', { class: 'sub' }, `Auditoría monomio por monomio · mes base ${mesCorto(det.mesBase)}`)),
        el('div', { class: 'fila no-imprimir' },
          grupo('Mes', selMesDet),
          det.incompleto ? el('span', {
            class: 'pill pill-auto',
            title: 'INEI aún no publica todos los índices de este mes: se usa el último valor disponible.',
          }, 'índice provisional') : null)),
      el('div', { class: 'envoltorio-tabla', style: { boxShadow: 'none' } },
        el('table', { class: 'tabla' },
          el('thead', {}, el('tr', {},
            el('th', {}, 'Monomio'),
            el('th', { class: 'num' }, 'Coef.'),
            el('th', { class: 'num' }, `I base (${mesCorto(det.mesBase)})`),
            el('th', { class: 'num' }, `I actual (${mesCorto(mesDetalle)})`),
            el('th', { class: 'num' }, 'Factor I / Io'),
            el('th', { class: 'num' }, 'Aporte coef × factor'))),
          el('tbody', {}, det.detalle.map(d => {
            const factor = (d.indiceActual != null && d.indiceBase > 0) ? d.indiceActual / d.indiceBase : 1;
            return el('tr', {},
              el('td', {},
                el('span', { class: 'descripcion' }, d.nombre),
                el('span', { class: 'badge badge-iu', style: { marginLeft: '8px' }, title: IU_CATALOGO[d.iu]?.nombre || `IU ${d.iu}` }, d.iu)),
              el('td', { class: 'num' }, (Number(d.coef) || 0).toFixed(3)),
              el('td', { class: 'num' }, celdaIndice(d.indiceBase, d.mesIndiceBase, det.mesBase)),
              el('td', { class: 'num' }, celdaIndice(d.indiceActual, d.mesIndiceActual, mesDetalle)),
              el('td', { class: 'num' }, fmtNum(factor, 4)),
              el('td', { class: 'num' }, fmtNum(d.aporte, 4)));
          })),
          el('tfoot', {}, el('tr', { class: 'fila-total' },
            el('td', { colspan: 5 }, `Coeficiente K de ${mesCorto(mesDetalle)} (redondeado a 3 decimales)`),
            el('td', { class: 'num', style: { fontSize: '13.5px' } }, det.k.toFixed(3)))))));
  }
  container.append(panelDetalle);

  // ---- 6 · Panel: gestor de Índices Unificados INEI -----------------------
  if (!disponibles.includes(mesGestor)) mesGestor = disponibles[disponibles.length - 1] || null;

  const relevantes = new Set();
  for (const m of monomios) {
    for (const iu of m.ius || []) relevantes.add(iu);
    for (const iu of m.iusExtra || []) relevantes.add(iu);
    if (m.iuCalculo) relevantes.add(m.iuCalculo);
  }
  const listaRelevantes = [...relevantes].sort(ordenIU);
  const totalCatalogo = Object.keys(IU_CATALOGO).length;
  const mostrandoTodos = verTodos || !listaRelevantes.length;
  const listaIU = mostrandoTodos
    ? [...listaRelevantes, ...Object.keys(IU_CATALOGO).filter(c => !relevantes.has(c)).sort(ordenIU)]
    : listaRelevantes;

  const selMesGestor = el('select', {},
    disponibles.map(m => el('option', { value: m, selected: m === mesGestor }, mesCorto(m))));
  selMesGestor.addEventListener('change', e => { mesGestor = e.target.value; rerender(); });

  const panelGestor = el('div', { class: 'panel' },
    el('div', { class: 'panel-cab' },
      el('div', {},
        el('h2', {}, 'Índices Unificados INEI'),
        el('div', { class: 'sub' }, `Base ${METADATA_INDICES.base} · serie de fábrica del área ${METADATA_INDICES.areaSerie} · las ediciones se guardan en este navegador y priman sobre la serie`)),
      el('div', { class: 'fila no-imprimir', style: { flexWrap: 'wrap' } },
        grupo('Mes', selMesGestor),
        el('button', { class: 'btn btn-mini', onclick: abrirModalAgregarMes }, icono('mas', 14), 'Agregar mes'),
        el('button', { class: 'btn btn-mini', onclick: importarIndicesJSON, title: 'Importa el JSON {mes, valores} generado por actualizar_indices.py' }, icono('importar', 14), 'Importar JSON'),
        el('button', { class: 'btn btn-mini btn-sec', onclick: abrirModalComoActualizar }, 'Cómo actualizar'))),
    el('div', { class: 'fila no-imprimir', style: { marginBottom: '13px' } },
      el('div', { class: 'segmentos' },
        el('button', {
          class: 'segmento' + (!mostrandoTodos ? ' activo' : ''),
          disabled: !listaRelevantes.length,
          title: 'Solo los IU que intervienen en los monomios de la fórmula',
          onclick: () => { verTodos = false; rerender(); },
        }, `IU del proyecto (${listaRelevantes.length})`),
        el('button', {
          class: 'segmento' + (mostrandoTodos ? ' activo' : ''),
          title: 'Relación completa de Índices Unificados del catálogo',
          onclick: () => { verTodos = true; rerender(); },
        }, `Ver los 95 (${totalCatalogo} en catálogo)`)),
      mesGestor ? el('span', { class: 'pill' }, `${Object.keys(serieCompleta()[mesGestor] || {}).length} valores cargados en ${mesCorto(mesGestor)}`) : null));

  if (!mesGestor) {
    panelGestor.append(el('div', { class: 'vacio' }, 'No hay meses en la serie: agrega uno con “Agregar mes”.'));
  } else {
    panelGestor.append(el('div', { class: 'envoltorio-tabla', style: { boxShadow: 'none' } },
      el('table', { class: 'tabla' },
        el('thead', {}, el('tr', {},
          el('th', { style: { width: '70px' } }, 'IU'),
          el('th', {}, 'Nombre'),
          el('th', { class: 'num', style: { width: '170px' } }, `Valor ${mesCorto(mesGestor)}`))),
        el('tbody', {}, listaIU.map(iu => {
          const cat = IU_CATALOGO[iu];
          return el('tr', {},
            el('td', {}, el('span', { class: 'badge badge-iu' }, iu)),
            el('td', {},
              el('span', { class: 'descripcion' }, cat?.nombre || `IU ${iu}`),
              cat?.confirmar ? el('span', {
                class: 'pill', style: { marginLeft: '8px' },
                title: 'Nombre por confirmar con la relación oficial de la RJ 016-2026-INEI',
              }, 'por confirmar') : null,
              mostrandoTodos && relevantes.has(iu) ? el('span', {
                class: 'pill pill-auto', style: { marginLeft: '8px' },
                title: 'Este IU interviene en la fórmula polinómica del proyecto',
              }, 'en fórmula') : null),
            el('td', { class: 'num' }, inputIndice(iu, mesGestor)));
        })))));
  }
  container.append(panelGestor);

  // ---- 7 · Pie: fuentes ----------------------------------------------------
  container.append(el('div', { class: 'texto-3', style: { fontSize: '11.5px', lineHeight: '1.7', marginTop: '2px' } },
    `Base: ${METADATA_INDICES.base} · Serie de fábrica: área ${METADATA_INDICES.areaSerie} (${AREAS_GEO[METADATA_INDICES.areaSerie]}) · Último mes publicado: ${mesCorto(METADATA_INDICES.ultimoPublicado)}. `,
    METADATA_INDICES.notas, el('br'),
    'Fuentes: ',
    METADATA_INDICES.fuentes.map((f, i) => [
      i > 0 ? ' · ' : '',
      el('a', { href: f.url, target: '_blank', rel: 'noopener', style: { color: 'inherit' } }, f.rj),
      ` (${f.detalle})`,
    ])));
}
