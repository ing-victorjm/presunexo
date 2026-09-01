// acu.js — vista Análisis de Costos Unitarios (por partida).
import * as store from '../core/store.js';
import { makeRecurso, TIPOS_INSUMO, UNIDADES } from '../core/model.js';
import { acuDetalle, arbolPlano, itemPorId } from '../core/calc.js';
import { fmtMoney, fmtNum, parseNum, round4 } from '../core/fmt.js';
import { el, icono, modal, confirmar, toast, campo } from '../ui/components.js';
import { DOSIFICACIONES_CONCRETO } from '../data/biblioteca.js';
import { IU_CATALOGO } from '../data/indices.js';

const ORDEN_TIPOS = ['MO', 'MAT', 'EQ', 'SC'];

// Componentes de una dosificación de concreto → término de búsqueda en el
// catálogo de insumos del proyecto (case-insensitive, primero el más específico).
const COMPONENTES_MEZCLA = [
  { clave: 'cemento_bol', etiqueta: 'Cemento', unidad: 'bol', terminos: ['cemento'] },
  { clave: 'arena_m3', etiqueta: 'Arena', unidad: 'm3', terminos: ['arena'] },
  { clave: 'piedra_m3', etiqueta: 'Piedra', unidad: 'm3', terminos: ['piedra'] },
  { clave: 'piedra_grande_m3', etiqueta: 'Piedra grande', unidad: 'm3', terminos: ['piedra grande', 'piedra'] },
  { clave: 'piedra_mediana_m3', etiqueta: 'Piedra mediana', unidad: 'm3', terminos: ['piedra mediana', 'piedra'] },
  { clave: 'hormigon_m3', etiqueta: 'Hormigón', unidad: 'm3', terminos: ['hormig'] },
  { clave: 'agua_m3', etiqueta: 'Agua', unidad: 'm3', terminos: ['agua'] },
];

// Estado de UI: última partida vista (sobrevive a los re-render).
let ultimaPartidaId = null;

// Input con commit en change/blur/Enter. alCommit devuelve false → restaurar valor.
function inputCommit(valor, alCommit, attrs = {}) {
  const inp = el('input', { type: 'text', value: valor, ...attrs });
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') inp.blur(); });
  inp.addEventListener('change', () => { if (alCommit(inp.value) === false) inp.value = valor; });
  return inp;
}

// Parsea un número del usuario; opciones: min, minExclusivo y max. Inválido → toast y null.
function numeroValido(txt, etiqueta, { min = 0, minExclusivo = false, max = null } = {}) {
  const v = parseNum(txt);
  if (isNaN(v)) { toast(`Valor no válido en ${etiqueta}`, 'error'); return null; }
  if (minExclusivo ? v <= min : v < min) {
    toast(`${etiqueta} debe ser ${minExclusivo ? 'mayor que' : 'como mínimo'} ${min}`, 'error');
    return null;
  }
  if (max != null && v > max) {
    toast(`${etiqueta} debe estar entre ${min} y ${max}`, 'error');
    return null;
  }
  return v;
}

// Badge del índice unificado INEI del insumo (tooltip con el nombre del catálogo).
function badgeIU(insumo) {
  if (!insumo.iu) return null;
  const cat = IU_CATALOGO[insumo.iu];
  return el('span', {
    class: 'badge badge-iu',
    title: `Índice unificado ${insumo.iu}${cat && cat.nombre ? ' — ' + cat.nombre : ''}`,
  }, insumo.iu);
}

export function render(container, params) {
  const proyecto = store.getProyecto();
  const partidas = arbolPlano(proyecto).filter(n => n.item.tipo === 'partida');

  // --- Sin partidas → estado vacío -----------------------------------------
  if (!partidas.length) {
    container.append(
      cabecera(null, partidas),
      el('div', { class: 'panel' },
        el('div', { class: 'vacio' },
          icono('acu', 34),
          el('div', {}, 'Este proyecto aún no tiene partidas que analizar.'),
          el('div', { style: { marginTop: '14px' } },
            el('button', { class: 'btn btn-primario', onclick: () => { location.hash = '#/presupuesto'; } },
              icono('presupuesto', 15), 'Ir al presupuesto y crear partidas')))));
    return;
  }

  // --- Resolución de la partida activa: params → última vista → primera ----
  let id = params && params[0];
  if (!partidas.some(n => n.item.id === id)) id = null;
  if (!id && ultimaPartidaId && partidas.some(n => n.item.id === ultimaPartidaId)) id = ultimaPartidaId;
  if (!id) id = partidas[0].item.id;
  ultimaPartidaId = id;

  const nodo = partidas.find(n => n.item.id === id);
  const partida = nodo.item;
  const det = acuDetalle(partida, proyecto);

  container.append(
    cabecera(id, partidas),
    panelPartida(proyecto, nodo, det),
    el('div', { class: 'texto-3', style: { margin: '-6px 0 12px', fontSize: '11.5px' } },
      'Cantidad de MO/EQ = cuadrilla × jornada / rendimiento · Herramientas: % de la mano de obra · Materiales: cantidad efectiva = neta × (1 + desperdicio %)'),
    tablaAcu(partida, det),
    el('div', { class: 'texto-3', style: { marginTop: '10px', fontSize: '11.5px' } },
      el('a', { href: '#/biblioteca', style: { color: 'var(--acento)', textDecoration: 'none' } },
        'Rendimientos y desperdicios de referencia'),
      ' · ',
      el('a', { href: '#/calculadoras', style: { color: 'var(--acento)', textDecoration: 'none' } },
        'Calculadoras de metrados')),
    el('div', { style: { marginTop: '12px' } },
      el('button', { class: 'btn btn-primario', onclick: () => abrirModalAgregar(partida.id) },
        icono('mas', 15), 'Agregar recurso')));
}

// --- Cabecera con selector de partida ---------------------------------------
function cabecera(idActiva, partidas) {
  const sel = el('select', { style: { maxWidth: '460px', width: '100%' } },
    partidas.map(n => el('option', { value: n.item.id }, `${n.codigo} — ${n.item.descripcion}`)));
  if (idActiva) sel.value = idActiva;
  sel.addEventListener('change', () => { location.hash = '#/acu/' + sel.value; });

  return el('div', { class: 'cabecera-vista' },
    el('div', {},
      el('h1', {}, 'Análisis de Costos Unitarios'),
      el('div', { class: 'sub' }, 'Recursos, cuadrillas y rendimientos de cada partida')),
    el('div', { class: 'acciones', style: { flex: '1 1 300px', justifyContent: 'flex-end' } },
      partidas.length ? sel : null));
}

// --- Panel de datos de la partida -------------------------------------------
function panelPartida(proyecto, nodo, det) {
  const partida = nodo.item;

  const inDesc = inputCommit(partida.descripcion, txt => {
    const v = txt.trim();
    if (!v) { toast('La descripción no puede quedar vacía', 'error'); return false; }
    store.update(p => { const it = itemPorId(p, partida.id); if (it) it.descripcion = v; });
  }, { style: { width: '100%', fontWeight: '600', fontSize: '14px' } });

  const selUnidad = el('select', { style: { width: '100%' } },
    (UNIDADES.includes(partida.unidad) ? UNIDADES : [partida.unidad, ...UNIDADES])
      .map(u => el('option', { value: u }, u || '—')));
  selUnidad.value = partida.unidad;
  selUnidad.addEventListener('change', () => {
    store.update(p => { const it = itemPorId(p, partida.id); if (it) it.unidad = selUnidad.value; });
  });

  const numStyle = { width: '100%', fontFamily: 'var(--mono)', textAlign: 'right' };
  const inMetrado = inputCommit(String(Number(partida.metrado) || 0), txt => {
    const v = numeroValido(txt, 'Metrado');
    if (v == null) return false;
    store.update(p => { const it = itemPorId(p, partida.id); if (it) it.metrado = v; });
  }, { style: numStyle });

  const inRend = inputCommit(String(Number(partida.rendimiento) || 0), txt => {
    const v = numeroValido(txt, 'Rendimiento', { min: 0, minExclusivo: true });
    if (v == null) return false;
    store.update(p => { const it = itemPorId(p, partida.id); if (it) it.rendimiento = v; });
  }, { style: numStyle });
  const filaRend = el('div', { class: 'fila', style: { gap: '8px' } },
    inRend,
    el('span', { class: 'texto-3', style: { whiteSpace: 'nowrap', fontSize: '12px' } }, `${partida.unidad || 'und'}/día`));

  const inJornada = inputCommit(String(Number(proyecto.jornada) || 8), txt => {
    const v = numeroValido(txt, 'Jornada', { min: 0, minExclusivo: true });
    if (v == null) return false;
    store.update(p => { p.jornada = v; });
  }, { style: numStyle });

  return el('div', { class: 'panel' },
    el('div', { class: 'fila-esp', style: { alignItems: 'flex-start', gap: '20px', flexWrap: 'wrap' } },
      el('div', { style: { flex: '1 1 320px', minWidth: '260px' } },
        el('div', { class: 'fila', style: { marginBottom: '8px', gap: '8px' } },
          el('span', { class: 'pill mono' }, nodo.codigo),
          el('span', { class: 'texto-3', style: { fontSize: '11px', textTransform: 'uppercase', letterSpacing: '.08em' } }, 'Partida')),
        inDesc),
      el('div', { class: 'fila', style: { gap: '24px', flexWrap: 'wrap', alignItems: 'center' } },
        el('button', {
          class: 'btn btn-sec',
          title: 'Reemplaza los materiales de la mezcla del ACU según una dosificación de la Biblioteca técnica',
          onclick: () => abrirModalDosificar(partida.id),
        }, icono('calculadora', 15), 'Dosificar concreto…'),
        el('div', { class: 'col', style: { alignItems: 'flex-end', gap: '3px' } },
          el('span', { class: 'kpi-etiqueta' }, 'Precio unitario (P.U.)'),
          el('span', { class: 'mono', style: { fontSize: '23px', fontWeight: '600', color: 'var(--acento-fuerte)' } }, fmtMoney(det.pu))),
        el('div', { class: 'col', style: { alignItems: 'flex-end', gap: '3px' } },
          el('span', { class: 'kpi-etiqueta' }, 'Parcial (metrado × P.U.)'),
          el('span', { class: 'mono', style: { fontSize: '23px', fontWeight: '600', color: 'var(--ok)' } }, fmtMoney(nodo.parcial))))),
    el('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0 16px', marginTop: '12px' } },
      campo('Unidad', selUnidad),
      campo('Metrado', inMetrado, partida.unidad ? `en ${partida.unidad}` : ''),
      campo('Rendimiento', filaRend, 'producción por día'),
      campo('Jornada', inJornada, 'horas/día (todo el proyecto)')));
}

// --- Tabla del ACU agrupada por tipo ----------------------------------------
function tablaAcu(partida, det) {
  const cuerpo = [];

  for (const tipo of ORDEN_TIPOS) {
    const filas = det.filas.filter(f => f.insumo.tipo === tipo);
    if (!filas.length) continue;
    cuerpo.push(el('tr', {},
      el('td', { colspan: 8, style: { background: 'var(--fondo-2)' } },
        el('div', { class: 'fila-esp' },
          el('span', { class: 'badge badge-' + tipo }, TIPOS_INSUMO[tipo].nombre),
          el('span', { class: 'mono', style: { fontSize: '12.5px', fontWeight: '600' } }, fmtNum(det.porTipo[tipo], 2))))));
    for (const f of filas) cuerpo.push(filaRecurso(partida, det, f));
  }

  if (!det.filas.length) {
    cuerpo.push(el('tr', {},
      el('td', { colspan: 8, class: 'texto-3', style: { textAlign: 'center', padding: '26px' } },
        'Esta partida no tiene recursos. Usa «Agregar recurso» para armar su análisis.')));
  }

  cuerpo.push(el('tr', { class: 'fila-total' },
    el('td', { colspan: 6 }, 'COSTO UNITARIO DIRECTO'),
    el('td', { class: 'num ok', style: { fontSize: '13.5px' } }, fmtNum(det.pu, 2)),
    el('td', {})));

  return el('div', { class: 'envoltorio-tabla' },
    el('table', { class: 'tabla' },
      el('thead', {},
        el('tr', {},
          el('th', {}, 'Descripción del recurso'),
          el('th', { style: { width: '58px' } }, 'Und'),
          el('th', { class: 'num', style: { width: '88px' } }, 'Cuadrilla'),
          el('th', { class: 'num', style: { width: '108px' } }, 'Cantidad'),
          el('th', { class: 'num', style: { width: '78px' }, title: 'Desperdicio sobre la cantidad neta — valores típicos en Biblioteca técnica' }, 'Desp. %'),
          el('th', { class: 'num', style: { width: '104px' } }, 'Precio S/'),
          el('th', { class: 'num', style: { width: '112px' } }, 'Parcial S/'),
          el('th', { style: { width: '40px' } }, ''))),
      el('tbody', {}, cuerpo)));
}

function filaRecurso(partida, det, f) {
  const rec = f.recurso;

  // Cuadrilla: editable solo en modo rendimiento.
  const tdCuadrilla = rec.modo === 'rendimiento'
    ? el('td', { class: 'num' }, inputCommit(String(Number(rec.cuadrilla) || 0), txt => {
        const v = numeroValido(txt, 'Cuadrilla');
        if (v == null) return false;
        store.update(p => {
          const it = itemPorId(p, partida.id);
          const r = it && (it.acu || []).find(x => x.id === rec.id);
          if (r) r.cuadrilla = v;
        });
      }, { class: 'celda-input' }))
    : el('td', { class: 'num texto-3' }, '—');

  // Cantidad según modo.
  let tdCantidad;
  if (rec.modo === 'rendimiento') {
    tdCantidad = el('td', { class: 'num texto-2', title: 'Calculada: cuadrilla × jornada / rendimiento' }, fmtNum(f.cantidad, 4));
  } else if (rec.modo === 'pctMO') {
    tdCantidad = el('td', { class: 'num' }, inputCommit(fmtNum(Number(rec.pct) || 0, 2) + ' %', txt => {
      const v = numeroValido(txt.replace(/%/g, ''), 'Porcentaje de MO');
      if (v == null) return false;
      store.update(p => {
        const it = itemPorId(p, partida.id);
        const r = it && (it.acu || []).find(x => x.id === rec.id);
        if (r) r.pct = v;
      });
    }, { class: 'celda-input' }));
  } else {
    // Modo directo: se muestra la cantidad EFECTIVA (calc ya aplica el desperdicio);
    // lo que se escribe en el input se registra como cantidad NETA.
    const desp = Number(rec.desperdicioPct) || 0;
    tdCantidad = el('td', { class: 'num' },
      inputCommit(String(round4(f.cantidad)), txt => {
        const v = numeroValido(txt, 'Cantidad');
        if (v == null) return false;
        store.update(p => {
          const it = itemPorId(p, partida.id);
          const r = it && (it.acu || []).find(x => x.id === rec.id);
          if (r) r.cantidad = v;
        });
      }, {
        class: 'celda-input',
        title: desp > 0 ? 'Cantidad efectiva = neta × (1 + desperdicio/100). Al editar se registra la cantidad neta.' : null,
      }),
      desp > 0
        ? el('div', { class: 'texto-3', style: { fontSize: '10.5px', marginTop: '2px' } },
            `neta: ${fmtNum(round4(Number(rec.cantidad) || 0), 4)}`)
        : null);
  }

  // Desperdicio %: editable solo en modo directo (0–50).
  const tdDesp = rec.modo === 'directo'
    ? el('td', { class: 'num' }, inputCommit(String(round4(Number(rec.desperdicioPct) || 0)), txt => {
        const v = numeroValido(txt.replace(/%/g, ''), 'Desperdicio', { min: 0, max: 50 });
        if (v == null) return false;
        store.update(p => {
          const it = itemPorId(p, partida.id);
          const r = it && (it.acu || []).find(x => x.id === rec.id);
          if (r) r.desperdicioPct = v;
        });
      }, { class: 'celda-input', title: 'Desperdicio sobre la cantidad neta — valores típicos en Biblioteca técnica' }))
    : el('td', { class: 'num texto-3' }, '—');

  // Precio: editable (catálogo central) salvo %MO, que muestra la base (total MO).
  const tdPrecio = f.esPctMO
    ? el('td', { class: 'num texto-2', title: 'Base: subtotal de mano de obra del ACU' }, fmtNum(det.totalMO, 2))
    : el('td', { class: 'num' }, inputCommit((Number(f.insumo.precio) || 0).toFixed(2), txt => {
        const v = numeroValido(txt, 'Precio');
        if (v == null) return false;
        store.update(p => {
          const ins = p.insumos.find(i => i.id === f.insumo.id);
          if (ins) ins.precio = v;
        });
        toast('Precio actualizado en el catálogo — recalculado todo el proyecto', 'info');
      }, { class: 'celda-input' }));

  return el('tr', {},
    el('td', {},
      el('div', { class: 'fila', style: { gap: '8px' } },
        el('span', { class: 'descripcion' }, f.insumo.descripcion),
        badgeIU(f.insumo),
        f.insumo.codigo ? el('span', { class: 'cod' }, f.insumo.codigo) : null)),
    el('td', { class: 'texto-2', style: { fontSize: '12px' } }, f.insumo.unidad),
    tdCuadrilla,
    tdCantidad,
    tdDesp,
    tdPrecio,
    el('td', { class: 'num' }, fmtNum(f.parcial, 2)),
    el('td', { style: { textAlign: 'center' } },
      el('button', {
        class: 'btn-icono', title: 'Quitar recurso (Ctrl+Z deshace)',
        style: { width: '26px', height: '26px' },
        onclick: () => {
          store.update(p => {
            const it = itemPorId(p, partida.id);
            if (it) it.acu = (it.acu || []).filter(x => x.id !== rec.id);
          });
          toast('Recurso quitado del análisis');
        },
      }, icono('cerrar', 13))));
}

// --- Modal: dosificar concreto ----------------------------------------------
// Busca el primer insumo MAT del proyecto cuya descripción contenga alguno de
// los términos (en orden: primero el más específico).
function buscarInsumoMezcla(proyecto, terminos) {
  for (const t of terminos) {
    const ins = proyecto.insumos.find(i => i.tipo === 'MAT' && String(i.descripcion).toLowerCase().includes(t));
    if (ins) return ins;
  }
  return null;
}

// Componentes presentes en una dosificación → [{componente, consumo, insumo|null}].
function componentesDeDosificacion(proyecto, dosif) {
  const salida = [];
  for (const c of COMPONENTES_MEZCLA) {
    const consumo = Number(dosif[c.clave]);
    if (!consumo) continue;
    salida.push({ componente: c, consumo, insumo: buscarInsumoMezcla(proyecto, c.terminos) });
  }
  return salida;
}

function abrirModalDosificar(idPartida) {
  const proyecto = store.getProyecto();
  const partida = itemPorId(proyecto, idPartida);
  if (!partida) return;

  const sel = el('select', { style: { width: '100%' } },
    DOSIFICACIONES_CONCRETO.map(d => el('option', { value: d.clave }, d.nombre)));
  // Heurística: preseleccionar el f'c que aparece en la descripción de la partida.
  const mFc = /f'?c\s*=?\s*(\d{3})/i.exec(partida.descripcion || '');
  if (mFc && DOSIFICACIONES_CONCRETO.some(d => d.clave === 'fc' + mFc[1])) sel.value = 'fc' + mFc[1];

  const inDesp = el('input', { type: 'text', value: '5', style: { width: '100%', fontFamily: 'var(--mono)', textAlign: 'right' } });

  const prev = el('div', { style: { marginTop: '4px' } });
  const pintaPrev = () => {
    const d = DOSIFICACIONES_CONCRETO.find(x => x.clave === sel.value);
    const comps = componentesDeDosificacion(proyecto, d);
    prev.replaceChildren(...comps.map(c => el('div', { class: 'fila-esp', style: { padding: '4px 0', fontSize: '12.5px', borderBottom: '1px solid var(--panel-borde)' } },
      c.insumo
        ? el('span', {}, c.insumo.descripcion)
        : el('span', { class: 'texto-3' }, `${c.componente.etiqueta} — sin insumo en el proyecto`),
      el('span', { class: 'mono texto-2', style: { flexShrink: '0' } },
        `${fmtNum(c.consumo, 2)} ${c.componente.unidad}/m³`))));
  };
  sel.addEventListener('change', pintaPrev);
  pintaPrev();

  modal({
    titulo: 'Dosificar concreto',
    ancho: 560,
    contenido: el('div', {},
      el('div', { class: 'nota', style: { marginBottom: '12px' } },
        'Reemplaza en el ACU los materiales de la mezcla (cemento, arena, piedra, hormigón y agua que existan en el catálogo) con el consumo por m³ de la dosificación elegida, en modo directo y con el desperdicio indicado.'),
      partida.unidad !== 'm3'
        ? el('div', { class: 'nota nota-alerta', style: { marginBottom: '12px' } },
            el('span', { html: `Esta partida se mide en <b>${partida.unidad || '—'}</b>; los consumos de la dosificación son por <b>m³ de concreto</b>. Verifica las cantidades resultantes.` }))
        : null,
      el('div', { class: 'grid-2-min', style: { gridTemplateColumns: '1fr 140px', gap: '0 12px' } },
        campo('Dosificación', sel),
        campo('Desperdicio %', inDesp, 'sobre la cantidad neta')),
      el('div', { class: 'campo-etiqueta', style: { fontSize: '12px', fontWeight: '600', color: 'var(--texto-2)', marginBottom: '2px' } }, 'Materiales de la mezcla'),
      prev),
    acciones: [
      { label: 'Cancelar', clase: 'btn-sec' },
      {
        label: 'Aplicar dosificación', clase: 'btn-primario',
        onClick: () => {
          const d = DOSIFICACIONES_CONCRETO.find(x => x.clave === sel.value);
          if (!d) return false;
          const desp = numeroValido(inDesp.value, 'Desperdicio', { min: 0, max: 50 });
          if (desp == null) return false;

          const comps = componentesDeDosificacion(store.getProyecto(), d);
          const objetivos = [];
          const faltantes = [];
          for (const c of comps) {
            if (!c.insumo) { faltantes.push(c.componente.etiqueta); continue; }
            if (objetivos.some(o => o.insumoId === c.insumo.id)) continue; // sin duplicados
            objetivos.push({ insumoId: c.insumo.id, descripcion: c.insumo.descripcion, cantidad: c.consumo });
          }
          if (!objetivos.length) {
            toast('Ningún insumo del proyecto coincide con la mezcla — créalos en Insumos', 'error');
            return false;
          }

          const part = itemPorId(store.getProyecto(), idPartida);
          if (!part) return; // la partida ya no existe: solo cerrar
          const existentes = objetivos.filter(o => (part.acu || []).some(r => r.insumoId === o.insumoId));

          const aplicar = () => {
            store.update(p => {
              const it = itemPorId(p, idPartida);
              if (!it) return;
              it.acu = it.acu || [];
              for (const o of objetivos) {
                const r = it.acu.find(x => x.insumoId === o.insumoId);
                if (r) { r.modo = 'directo'; r.cantidad = o.cantidad; r.desperdicioPct = desp; }
                else it.acu.push(makeRecurso({ insumoId: o.insumoId, modo: 'directo', cantidad: o.cantidad, desperdicioPct: desp }));
              }
            });
            toast(`Dosificación «${d.nombre}» aplicada: ${objetivos.length} materiales con ${fmtNum(desp, 0)} % de desperdicio`);
            if (faltantes.length) {
              toast(`Sin insumo en el proyecto para: ${faltantes.join(', ')} — puedes crearlos en Insumos`, 'info');
            }
          };

          if (existentes.length) {
            // El modal se cierra al retornar; la confirmación se abre encima.
            confirmar(
              `El ACU ya contiene ${existentes.length === 1 ? 'un material' : existentes.length + ' materiales'} de la mezcla (${existentes.map(o => o.descripcion).join(', ')}). Se reemplazarán su cantidad, modo y desperdicio. ¿Continuar?`,
              { titulo: 'Reemplazar materiales', labelOk: 'Reemplazar' },
            ).then(ok => { if (ok) aplicar(); });
          } else {
            aplicar();
          }
        },
      },
    ],
  });
}

// --- Modal: agregar recurso desde el catálogo -------------------------------
function abrirModalAgregar(idPartida) {
  const inBuscar = el('input', { type: 'text', placeholder: 'Buscar por descripción, código o tipo…', style: { width: '100%' } });
  const lista = el('div', { style: { maxHeight: '46vh', overflowY: 'auto', marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '2px' } });

  const elegir = (ins) => {
    const part = itemPorId(store.getProyecto(), idPartida);
    if (!part) { m.cerrar(); return; }
    if ((part.acu || []).some(r => r.insumoId === ins.id)) {
      toast('Ese insumo ya está en el análisis de esta partida', 'error');
      return;
    }
    let rec;
    if (ins.unidad === '%MO') rec = makeRecurso({ insumoId: ins.id, modo: 'pctMO', pct: 3 });
    else if (ins.tipo === 'MO' || ins.tipo === 'EQ') rec = makeRecurso({ insumoId: ins.id, modo: 'rendimiento', cuadrilla: 1 });
    else rec = makeRecurso({ insumoId: ins.id, modo: 'directo', cantidad: 1 });
    m.cerrar();
    store.update(p => {
      const it = itemPorId(p, idPartida);
      if (it) (it.acu = it.acu || []).push(rec);
    });
    toast(`«${ins.descripcion}» agregado al análisis`);
  };

  const filaInsumo = (ins) => el('div', {
    class: 'fila',
    style: { padding: '8px 10px', borderRadius: '8px', cursor: 'pointer', gap: '10px' },
    onmouseenter: e => { e.currentTarget.style.background = 'var(--panel-hover)'; },
    onmouseleave: e => { e.currentTarget.style.background = 'transparent'; },
    onclick: () => elegir(ins),
  },
    el('span', { class: 'badge badge-' + ins.tipo, style: { flexShrink: '0' } }, ins.tipo),
    el('span', { style: { flex: '1', minWidth: '0' } }, ins.descripcion),
    el('span', { class: 'pill', style: { flexShrink: '0' } }, ins.unidad),
    el('span', { class: 'mono texto-2', style: { fontSize: '12px', flexShrink: '0', minWidth: '76px', textAlign: 'right' } },
      ins.unidad === '%MO' ? '% de MO' : fmtMoney(Number(ins.precio) || 0)));

  // Filtrado en vivo: el modal no se re-renderiza, aquí sí se puede usar 'input'.
  const pinta = () => {
    const q = inBuscar.value.trim().toLowerCase();
    const insumos = store.getProyecto().insumos
      .filter(i => !q || `${i.descripcion} ${i.codigo} ${i.tipo} ${(TIPOS_INSUMO[i.tipo] || {}).nombre || ''}`.toLowerCase().includes(q))
      .slice()
      .sort((a, b) => (ORDEN_TIPOS.indexOf(a.tipo) - ORDEN_TIPOS.indexOf(b.tipo))
        || String(a.descripcion).localeCompare(String(b.descripcion), 'es'));
    lista.replaceChildren(...(insumos.length
      ? insumos.map(filaInsumo)
      : [el('div', { class: 'vacio', style: { padding: '24px 12px' } },
          store.getProyecto().insumos.length ? 'Sin resultados para la búsqueda.' : 'El catálogo de insumos está vacío.')]));
  };
  inBuscar.addEventListener('input', pinta);
  pinta();

  const m = modal({
    titulo: 'Agregar recurso al ACU',
    ancho: 620,
    contenido: el('div', {}, inBuscar, lista),
    acciones: [
      { label: 'Crear insumo nuevo…', clase: 'btn-sec', onClick: () => { location.hash = '#/insumos'; } },
      { label: 'Cancelar', clase: 'btn-sec' },
    ],
  });
}
