// insumos.js — Catálogo de insumos: precios centralizados del presupuesto.
// Editar un precio aquí recalcula todos los ACU, parciales y el pie del presupuesto.
// Cada insumo aporta además a un Índice Unificado INEI (campo .iu), del que se
// genera automáticamente la fórmula polinómica (#/polinomica).
import * as store from '../core/store.js';
import { makeInsumo, TIPOS_INSUMO, UNIDADES } from '../core/model.js';
import { resumen, distribucionPorTipo, insumosResumen, insumoPorId } from '../core/calc.js';
import { fmtMoney, fmtNum, parseNum, round2 } from '../core/fmt.js';
import { el, icono, modal, confirmar, toast, campo } from '../ui/components.js';
import { IU_CATALOGO } from '../data/indices.js';

// --- Estado de UI (a nivel de módulo, nunca en el store) --------------------
let filtroTexto = '';
let filtroTipo = 'TODOS'; // 'TODOS' | 'MO' | 'MAT' | 'EQ' | 'SC'
let raiz = null;
let enfocarBusqueda = false;

// IU más frecuentes en presupuestos de edificación (van primero en el select).
const IU_MAS_USADOS = ['47', '21', '03', '02', '04', '05', '38', '43', '17', '30', '34', '37', '48', '49', '39'];
const IU_DEFECTO = '39'; // IPC (varios)
// Sugerencia de IU al cambiar el tipo en el modal de creación.
const IU_POR_TIPO = { MO: '47', EQ: '48', SC: '39', MAT: '39' };

function rerender() {
  if (!raiz) return;
  raiz.replaceChildren();
  render(raiz);
}

function nombreIU(cod) {
  const entrada = IU_CATALOGO[cod];
  return entrada ? entrada.nombre : 'No catalogado — verificar relación oficial';
}

// Partidas cuyo ACU contiene el insumo.
function partidasQueUsan(p, insumoId) {
  return (p.items || []).filter(it => it.tipo === 'partida' && (it.acu || []).some(r => r.insumoId === insumoId));
}

// --- Selector de Índice Unificado (mini modal filtrable) --------------------
function abrirSelectorIU(insumoId) {
  const p = store.getProyecto();
  const ins = insumoPorId(p, insumoId);
  if (!ins) return;
  const actual = ins.iu || IU_DEFECTO;

  const inFiltro = el('input', {
    type: 'search',
    placeholder: 'Filtrar por código o nombre… (ej. 21, cemento)',
    style: { width: '100%' },
  });
  const lista = el('div', { style: { maxHeight: '340px', overflowY: 'auto', marginTop: '10px' } });
  const entradas = Object.entries(IU_CATALOGO);

  const elegir = cod => {
    m.cerrar();
    if (cod === actual) return;
    store.update(pr => { const i = insumoPorId(pr, insumoId); if (i) i.iu = cod; });
    toast('IU actualizado — la fórmula polinómica se regenera', 'info');
  };

  const filaIU = (cod, v) => el('div', {
    class: 'fila-esp',
    style: {
      padding: '7px 9px', borderRadius: '9px', cursor: 'pointer', marginBottom: '2px',
      background: cod === actual ? 'var(--acento-suave)' : 'transparent',
    },
    title: cod === actual ? 'Índice actual del insumo' : `Asignar IU ${cod} al insumo`,
    onmouseenter: e => { if (cod !== actual) e.currentTarget.style.background = 'var(--panel-hover)'; },
    onmouseleave: e => { if (cod !== actual) e.currentTarget.style.background = 'transparent'; },
    onclick: () => elegir(cod),
  },
    el('div', { class: 'fila', style: { gap: '9px', minWidth: 0, flexWrap: 'wrap' } },
      el('span', { class: 'badge badge-iu' }, cod),
      el('span', { style: { fontSize: '12.5px' } }, v.nombre),
      v.confirmar ? el('span', { class: 'pill pill-auto', title: 'Nombre por verificar contra la relación oficial RJ 016-2026-INEI' }, 'por confirmar') : null),
    cod === actual ? icono('check', 14) : null);

  const pinta = () => {
    const q = inFiltro.value.trim().toLowerCase();
    const visibles = entradas.filter(([cod, v]) =>
      !q || cod.toLowerCase().includes(q) || v.nombre.toLowerCase().includes(q));
    if (!visibles.length) {
      lista.replaceChildren(el('div', { class: 'vacio', style: { padding: '26px' } }, 'Ningún índice coincide con el filtro.'));
      return;
    }
    lista.replaceChildren(...visibles.map(([cod, v]) => filaIU(cod, v)));
  };

  const m = modal({
    titulo: 'Índice unificado del insumo',
    ancho: 540,
    contenido: el('div', {},
      el('div', { class: 'texto-2', style: { fontSize: '12.5px', marginBottom: '10px' } },
        el('strong', {}, ins.descripcion),
        el('span', { class: 'texto-3' }, ` · actual: IU ${actual} — ${nombreIU(actual)}`)),
      inFiltro,
      lista),
  });
  // Dentro de un modal sí se permite filtrar con 'input' (no hay re-render de vista).
  inFiltro.addEventListener('input', pinta);
  pinta();
}

// Select de IU para el modal crear/editar: los más usados primero, luego el resto.
function selectIU(valorInicial) {
  const resto = Object.keys(IU_CATALOGO).filter(c => !IU_MAS_USADOS.includes(c));
  const opcion = cod => {
    const v = IU_CATALOGO[cod];
    return el('option', { value: cod, selected: cod === valorInicial },
      `${cod} — ${v ? v.nombre : 'No catalogado'}${v && v.confirmar ? ' (por confirmar)' : ''}`);
  };
  const hijos = [];
  if (valorInicial && !IU_CATALOGO[valorInicial]) {
    hijos.push(el('option', { value: valorInicial, selected: true }, `${valorInicial} — (no catalogado)`));
  }
  hijos.push(
    el('optgroup', { label: 'IU más usados' }, IU_MAS_USADOS.map(opcion)),
    el('optgroup', { label: 'Resto del catálogo INEI' }, resto.map(opcion)));
  return el('select', { style: { width: '100%' } }, hijos);
}

// --- Modal crear / editar ---------------------------------------------------
function abrirModalInsumo(insumoId = null) {
  const p = store.getProyecto();
  const orig = insumoId ? insumoPorId(p, insumoId) : null;

  const inCodigo = el('input', { type: 'text', value: orig ? (orig.codigo || '') : '', placeholder: 'Ej. 21-001', style: { width: '100%' } });
  const inDesc = el('input', { type: 'text', value: orig ? orig.descripcion : '', placeholder: 'Ej. Cemento Portland tipo I (42.5 kg)', style: { width: '100%' } });
  const selTipo = el('select', { style: { width: '100%' } },
    Object.values(TIPOS_INSUMO).map(t =>
      el('option', { value: t.clave, selected: orig ? orig.tipo === t.clave : t.clave === 'MAT' }, `${t.clave} — ${t.nombre}`)));
  const selUnidad = el('select', { style: { width: '100%' } },
    UNIDADES.map(u => el('option', { value: u, selected: orig ? orig.unidad === u : u === 'und' }, u)));
  const inPrecio = el('input', { type: 'text', class: 'mono', value: orig ? String(Number(orig.precio) || 0) : '0', style: { width: '100%' } });
  const selIU = selectIU(orig ? (orig.iu || IU_DEFECTO) : IU_DEFECTO);

  // En un insumo nuevo, cambiar el tipo sugiere el IU típico mientras el
  // usuario no haya elegido uno a mano.
  let iuTocado = !!orig;
  selIU.addEventListener('change', () => { iuTocado = true; });
  selTipo.addEventListener('change', () => {
    if (!iuTocado) selIU.value = IU_POR_TIPO[selTipo.value] || IU_DEFECTO;
  });

  modal({
    titulo: orig ? 'Editar insumo' : 'Nuevo insumo',
    ancho: 520,
    contenido: el('div', {},
      campo('Descripción', inDesc),
      el('div', { class: 'grid-2' },
        campo('Código', inCodigo, 'Opcional'),
        campo('Tipo', selTipo)),
      el('div', { class: 'grid-2' },
        campo('Unidad', selUnidad),
        campo('Precio unitario (S/)', inPrecio, orig ? 'Al guardar se recalcula todo el presupuesto' : '')),
      campo('Índice unificado INEI (IU)', selIU, 'Determina el monomio al que aporta en la fórmula polinómica')),
    acciones: [
      { label: 'Cancelar', clase: 'btn-sec' },
      {
        label: orig ? 'Guardar cambios' : 'Crear insumo',
        clase: 'btn-primario',
        onClick: () => {
          const descripcion = inDesc.value.trim();
          const precio = parseNum(inPrecio.value);
          if (!descripcion) { toast('La descripción no puede estar vacía', 'error'); return false; }
          if (isNaN(precio) || precio < 0) { toast('El precio debe ser un número mayor o igual a 0', 'error'); return false; }
          const datos = {
            codigo: inCodigo.value.trim(), descripcion, tipo: selTipo.value,
            unidad: selUnidad.value, precio: round2(precio), iu: selIU.value,
          };
          if (orig) {
            const cambioIU = (orig.iu || IU_DEFECTO) !== datos.iu;
            store.update(pr => { const i = insumoPorId(pr, orig.id); if (i) Object.assign(i, datos); });
            toast(cambioIU ? 'Insumo actualizado — la fórmula polinómica se regenera' : 'Insumo actualizado. Presupuesto recalculado', 'info');
          } else {
            store.update(pr => { pr.insumos.push(makeInsumo(datos)); });
            toast('Insumo creado');
          }
        },
      },
    ],
  });
}

// --- Eliminar ---------------------------------------------------------------
async function eliminarInsumo(insumoId) {
  const p = store.getProyecto();
  const ins = insumoPorId(p, insumoId);
  if (!ins) return;
  const usos = partidasQueUsan(p, insumoId);
  const mensaje = usos.length
    ? `“${ins.descripcion}” se usa en ${usos.length} partida${usos.length === 1 ? '' : 's'}. Al eliminarlo también se quitará de esos análisis de costos y el presupuesto se recalculará.`
    : `¿Eliminar el insumo “${ins.descripcion}”? No se usa en ninguna partida.`;
  const ok = await confirmar(mensaje, { titulo: 'Eliminar insumo', peligro: true, labelOk: 'Eliminar' });
  if (!ok) return;
  store.update(pr => {
    pr.insumos = pr.insumos.filter(i => i.id !== insumoId);
    for (const it of pr.items || []) {
      if (Array.isArray(it.acu)) it.acu = it.acu.filter(r => r.insumoId !== insumoId);
    }
  });
  toast(usos.length ? 'Insumo eliminado. Presupuesto recalculado' : 'Insumo eliminado');
}

// --- Celda de precio editable ----------------------------------------------
function inputPrecio(ins) {
  return el('input', {
    class: 'celda-input',
    value: (Number(ins.precio) || 0).toFixed(2),
    title: 'Editar precio · Enter para confirmar',
    onkeydown: e => { if (e.key === 'Enter') e.target.blur(); },
    onchange: e => {
      const v = parseNum(e.target.value);
      if (isNaN(v) || v < 0) {
        toast('Precio inválido: debe ser un número mayor o igual a 0', 'error');
        e.target.value = (Number(ins.precio) || 0).toFixed(2);
        return;
      }
      if (round2(v) === (Number(ins.precio) || 0)) { e.target.value = round2(v).toFixed(2); return; }
      store.update(pr => { const i = insumoPorId(pr, ins.id); if (i) i.precio = round2(v); });
      toast('Presupuesto recalculado', 'info');
    },
  });
}

// --- Badge IU clickeable (celda de la tabla) --------------------------------
function badgeIU(ins) {
  const iu = ins.iu || IU_DEFECTO;
  const porConfirmar = IU_CATALOGO[iu] && IU_CATALOGO[iu].confirmar;
  return el('button', {
    class: 'badge badge-iu',
    title: `IU ${iu} — ${nombreIU(iu)}${porConfirmar ? ' (nombre por confirmar)' : ''} · clic para cambiar`,
    style: { cursor: 'pointer', border: 'none' },
    onclick: () => abrirSelectorIU(ins.id),
  }, iu);
}

// --- Vista ------------------------------------------------------------------
export function render(container, params) {
  raiz = container;
  const p = store.getProyecto();
  const insumos = p.insumos || [];

  container.append(
    el('div', { class: 'cabecera-vista' },
      el('div', {},
        el('h1', {}, 'Catálogo de insumos'),
        el('div', { class: 'sub' }, 'Precios centralizados: al editar un precio se recalcula todo el presupuesto')),
      el('div', { class: 'acciones' },
        el('button', { class: 'btn btn-primario', onclick: () => abrirModalInsumo() }, icono('mas', 15), 'Nuevo insumo'))));

  container.append(el('div', { class: 'nota' },
    'Cada insumo aporta a un ', el('b', {}, 'Índice Unificado INEI'),
    '; de ahí sale la fórmula polinómica automáticamente. ',
    el('a', {
      href: '#/polinomica',
      style: { color: 'var(--acento-texto)', fontWeight: '600', textDecoration: 'none' },
    }, 'Ver fórmula polinómica →')));

  // Proyecto sin insumos → estado vacío.
  if (!insumos.length) {
    container.append(el('div', { class: 'panel' },
      el('div', { class: 'vacio' },
        icono('insumos', 36),
        el('div', {}, 'Este proyecto aún no tiene insumos.'),
        el('div', { class: 'texto-3', style: { margin: '4px 0 16px' } },
          'Registra mano de obra, materiales, equipos o subcontratos para armar los análisis de costos unitarios.'),
        el('button', { class: 'btn btn-primario', onclick: () => abrirModalInsumo() }, icono('mas', 15), 'Crear primer insumo'))));
    return;
  }

  const dist = distribucionPorTipo(p);
  const cd = resumen(p).costoDirecto;
  const resu = insumosResumen(p); // ya ordenado por parcial desc
  const usoPorId = new Map(resu.map(r => [r.insumo.id, r]));
  const enUso = insumos.filter(i => usoPorId.has(i.id)).length;
  const pctDe = m => cd > 0 ? `${fmtNum(m / cd * 100, 1)} % del costo directo` : 'Sin partidas valorizadas';

  // IU distintos: en uso = aportan monto a la fórmula polinómica.
  const iusEnUso = new Set(insumos.filter(i => usoPorId.has(i.id)).map(i => i.iu || IU_DEFECTO));
  const iusCatalogo = new Set(insumos.map(i => i.iu || IU_DEFECTO));

  const kpi = (variante, etiqueta, valor, sub) =>
    el('div', { class: 'kpi' + (variante ? ' ' + variante : '') },
      el('div', { class: 'kpi-etiqueta' }, etiqueta),
      el('div', { class: 'kpi-valor' }, valor),
      el('div', { class: 'kpi-sub' }, sub));

  container.append(el('div', { class: 'grid-kpi' },
    kpi('', 'Insumos en catálogo', String(insumos.length), `${enUso} en uso · ${insumos.length - enUso} sin uso`),
    kpi('', 'Mano de obra (MO)', fmtMoney(dist.MO), pctDe(dist.MO)),
    kpi('verde', 'Materiales (MAT)', fmtMoney(dist.MAT), pctDe(dist.MAT)),
    kpi('ambar', 'Equipos y subcontratos (EQ+SC)', fmtMoney(round2(dist.EQ + dist.SC)), pctDe(dist.EQ + dist.SC)),
    kpi('violeta', 'IU distintos en uso', String(iusEnUso.size),
      `${iusCatalogo.size} en catálogo · alimentan la fórmula polinómica`)));

  // Filtrado.
  const texto = filtroTexto.toLowerCase();
  const coincide = i =>
    (filtroTipo === 'TODOS' || i.tipo === filtroTipo) &&
    (!texto || (i.descripcion || '').toLowerCase().includes(texto) || (i.codigo || '').toLowerCase().includes(texto));

  const usados = resu.filter(r => coincide(r.insumo));
  const sinUso = insumos
    .filter(i => !usoPorId.has(i.id) && coincide(i))
    .sort((a, b) => (a.descripcion || '').localeCompare(b.descripcion || '', 'es'));
  const filas = [
    ...usados.map(r => ({ insumo: r.insumo, uso: r })),
    ...sinUso.map(i => ({ insumo: i, uso: null })),
  ];
  const maxParcial = usados.reduce((m, r) => Math.max(m, r.parcial), 0);

  // Barra de filtros.
  const inBusqueda = el('input', {
    type: 'search',
    placeholder: 'Buscar por descripción o código…',
    value: filtroTexto,
    style: { width: '280px' },
    onkeydown: e => { if (e.key === 'Enter') e.target.blur(); },
    onchange: e => { filtroTexto = e.target.value.trim(); enfocarBusqueda = true; rerender(); },
  });
  const btnTipo = (clave, label, title) => el('button', {
    class: 'btn btn-mini' + (filtroTipo === clave ? ' btn-primario' : ''),
    title,
    onclick: () => { filtroTipo = clave; rerender(); },
  }, label);

  container.append(el('div', { class: 'fila no-imprimir', style: { marginBottom: '14px', flexWrap: 'wrap' } },
    inBusqueda,
    el('div', { class: 'fila', style: { gap: '6px' } },
      btnTipo('TODOS', 'Todos', 'Todos los tipos'),
      Object.values(TIPOS_INSUMO).map(t => btnTipo(t.clave, t.clave, t.nombre))),
    el('span', { class: 'pill' }, `${filas.length} de ${insumos.length} insumos`)));

  // Tabla.
  const cabecera = el('thead', {}, el('tr', {},
    el('th', {}, 'Código'),
    el('th', {}, 'Descripción'),
    el('th', {}, 'Tipo'),
    el('th', { title: 'Índice Unificado INEI · clic en el badge para cambiarlo' }, 'IU'),
    el('th', {}, 'Und'),
    el('th', { class: 'num', style: { width: '110px' } }, 'Precio S/'),
    el('th', { class: 'num' }, 'Cant. requerida'),
    el('th', { class: 'num' }, 'Parcial S/'),
    el('th', {}, 'Incidencia'),
    el('th', { class: 'no-imprimir' }, '')));

  const cuerpo = el('tbody', {});
  if (!filas.length) {
    cuerpo.append(el('tr', {}, el('td', { colspan: 10 },
      el('div', { class: 'vacio' },
        icono('buscar', 28),
        el('div', {}, 'Ningún insumo coincide con la búsqueda o el filtro.'),
        el('button', {
          class: 'btn btn-mini btn-sec', style: { marginTop: '10px' },
          onclick: () => { filtroTexto = ''; filtroTipo = 'TODOS'; rerender(); },
        }, 'Limpiar filtros')))));
  }

  for (const { insumo: ins, uso } of filas) {
    const t = TIPOS_INSUMO[ins.tipo] || { clave: ins.tipo || '?', nombre: ins.tipo || 'Otro', color: 'var(--acento)' };
    const parcial = uso ? uso.parcial : 0;
    const pctBarra = maxParcial > 0 && parcial > 0 ? Math.max(parcial / maxParcial * 100, 2) : 0;
    const nPartidas = uso ? new Set(uso.partidas.map(x => x.codigo)).size : 0;

    cuerpo.append(el('tr', {},
      el('td', { class: 'cod' }, ins.codigo || '—'),
      el('td', { title: uso ? uso.partidas.map(x => `${x.codigo} ${x.descripcion}`).join('\n') : 'No se usa en ninguna partida' },
        el('span', { class: 'descripcion' }, ins.descripcion),
        el('span', { class: 'texto-3', style: { fontSize: '11px', marginLeft: '8px', whiteSpace: 'nowrap' } },
          nPartidas ? `${nPartidas} part.` : 'sin uso')),
      el('td', {}, el('span', { class: `badge badge-${t.clave}` }, t.clave)),
      el('td', {}, badgeIU(ins)),
      el('td', { class: 'texto-2' }, ins.unidad || '—'),
      el('td', { class: 'num' }, inputPrecio(ins)),
      el('td', { class: 'num', title: uso && uso.cantidad != null ? `Total requerido en ${ins.unidad || 'und'}` : '' },
        uso && uso.cantidad != null ? fmtNum(uso.cantidad, 2) : '—'),
      el('td', { class: 'num' }, uso ? fmtMoney(parcial) : '—'),
      el('td', { title: cd > 0 ? `${fmtNum(parcial / cd * 100, 1)} % del costo directo` : '' },
        el('div', { class: 'barra', style: { width: '84px' } },
          el('span', { style: { width: pctBarra + '%', background: t.color } }))),
      el('td', { class: 'no-imprimir', style: { whiteSpace: 'nowrap', textAlign: 'right' } },
        el('button', { class: 'btn-icono', title: 'Editar insumo', onclick: () => abrirModalInsumo(ins.id) }, icono('editar', 15)),
        el('button', { class: 'btn-icono', title: 'Eliminar insumo', onclick: () => eliminarInsumo(ins.id) }, icono('papelera', 15)))));
  }

  const pie = el('tfoot', {}, el('tr', { class: 'fila-total' },
    el('td', { colspan: 7 }, 'Costo directo total del presupuesto'),
    el('td', { class: 'num' }, fmtMoney(cd)),
    el('td', { colspan: 2 })));

  container.append(el('div', { class: 'envoltorio-tabla' },
    el('table', { class: 'tabla' }, cabecera, cuerpo, pie)));

  // Devolver el foco a la búsqueda tras un re-render disparado por ella.
  if (enfocarBusqueda) {
    enfocarBusqueda = false;
    setTimeout(() => {
      inBusqueda.focus();
      try { inBusqueda.setSelectionRange(inBusqueda.value.length, inBusqueda.value.length); } catch (e) { /* tipos sin selección */ }
    }, 0);
  }
}
