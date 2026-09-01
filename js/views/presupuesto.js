// presupuesto.js — vista central: hoja de presupuesto jerárquica (estilo S10).
import * as store from '../core/store.js';
import { makeItem, uid, UNIDADES } from '../core/model.js';
import { arbol, arbolPlano, resumen, itemPorId } from '../core/calc.js';
import { fmtNum, parseNum, round2 } from '../core/fmt.js';
import { el, icono, confirmar, toast, menuContextual } from '../ui/components.js';

// Estado de UI a nivel de módulo (nunca en el store)
const colapsados = new Set(); // ids de títulos contraídos; por defecto todo expandido
let seleccionadoId = null;
let contRef = null;

function rerender() {
  if (contRef) { contRef.replaceChildren(); render(contRef); }
}

// --- Utilidades de estructura -----------------------------------------------

function siguienteOrden(p, parentId) {
  const hermanos = p.items.filter(i => (i.parentId || null) === (parentId || null));
  return hermanos.length ? Math.max(...hermanos.map(h => Number(h.orden) || 0)) + 1 : 0;
}

function hermanosDe(p, item) {
  return p.items
    .filter(i => (i.parentId || null) === (item.parentId || null))
    .sort((a, b) => a.orden - b.orden);
}

function idsSubarbol(p, id) {
  const ids = new Set([id]);
  let crecio = true;
  while (crecio) {
    crecio = false;
    for (const it of p.items) {
      if (it.parentId && ids.has(it.parentId) && !ids.has(it.id)) { ids.add(it.id); crecio = true; }
    }
  }
  return ids;
}

// --- Creación ---------------------------------------------------------------

function crearTituloEn(parentId) {
  if (parentId) colapsados.delete(parentId);
  store.update(p => {
    const it = makeItem({
      tipo: 'titulo', parentId: parentId || null, orden: siguienteOrden(p, parentId),
      descripcion: 'NUEVO TÍTULO', unidad: '', metrado: 0, rendimiento: 8, acu: [],
    });
    p.items.push(it);
    seleccionadoId = it.id;
  });
  toast('Título agregado');
}

function crearPartidaEn(parentId) {
  if (parentId) colapsados.delete(parentId);
  store.update(p => {
    const it = makeItem({
      tipo: 'partida', parentId: parentId || null, orden: siguienteOrden(p, parentId),
      descripcion: 'Nueva partida', unidad: 'm2', metrado: 0, rendimiento: 8, acu: [],
    });
    p.items.push(it);
    seleccionadoId = it.id;
  });
  toast('Partida agregada');
}

// "+ Partida": hija del título seleccionado, hermana de la partida seleccionada,
// o al último título raíz (a la raíz si no hay títulos).
function agregarPartidaToolbar() {
  const p0 = store.getProyecto();
  const sel = seleccionadoId ? itemPorId(p0, seleccionadoId) : null;

  if (sel && sel.tipo === 'titulo') { crearPartidaEn(sel.id); return; }

  if (sel && sel.tipo === 'partida') {
    store.update(p => {
      const ancla = itemPorId(p, sel.id);
      if (!ancla) return;
      const it = makeItem({
        tipo: 'partida', parentId: ancla.parentId || null,
        descripcion: 'Nueva partida', unidad: 'm2', metrado: 0, rendimiento: 8, acu: [],
      });
      const hermanos = hermanosDe(p, ancla);
      hermanos.splice(hermanos.findIndex(h => h.id === ancla.id) + 1, 0, it);
      hermanos.forEach((h, i) => { h.orden = i; });
      p.items.push(it);
      seleccionadoId = it.id;
    });
    toast('Partida agregada');
    return;
  }

  const titulosRaiz = p0.items.filter(i => !i.parentId && i.tipo === 'titulo').sort((a, b) => a.orden - b.orden);
  crearPartidaEn(titulosRaiz.length ? titulosRaiz[titulosRaiz.length - 1].id : null);
}

// --- Acciones de fila -------------------------------------------------------

function mover(id, dir) {
  store.update(p => {
    const item = itemPorId(p, id);
    if (!item) return;
    const hermanos = hermanosDe(p, item);
    const idx = hermanos.findIndex(h => h.id === id);
    const otro = hermanos[idx + dir];
    if (!otro) return;
    const t = item.orden; item.orden = otro.orden; otro.orden = t;
  });
}

function duplicarItem(id) {
  store.update(p => {
    const item = itemPorId(p, id);
    if (!item) return;
    const mapa = new Map(); // id viejo → id nuevo (para remapear predecesores internos)
    const nuevos = [];
    const clonar = (it, parentIdNuevo) => {
      const c = JSON.parse(JSON.stringify(it));
      c.id = uid('itm');
      mapa.set(it.id, c.id);
      c.parentId = parentIdNuevo;
      c.acu = (c.acu || []).map(rec => ({ ...rec, id: uid('rec') }));
      nuevos.push(c);
      p.items.filter(h => h.parentId === it.id).sort((a, b) => a.orden - b.orden)
        .forEach(h => clonar(h, c.id));
      return c;
    };
    const raiz = clonar(item, item.parentId || null);
    raiz.orden = siguienteOrden(p, item.parentId || null);
    raiz.descripcion = item.descripcion + (item.tipo === 'titulo' ? ' (COPIA)' : ' (copia)');
    for (const c of nuevos) {
      if (c.predecesorId && mapa.has(c.predecesorId)) c.predecesorId = mapa.get(c.predecesorId);
    }
    p.items.push(...nuevos);
    seleccionadoId = raiz.id;
  });
  toast('Elemento duplicado');
}

async function eliminarItem(id) {
  const p = store.getProyecto();
  const item = itemPorId(p, id);
  if (!item) return;
  const ids = idsSubarbol(p, id);
  const msg = item.tipo === 'titulo'
    ? `¿Eliminar el título “${item.descripcion}”? Se eliminará TODO su subárbol (${ids.size - 1} ítem${ids.size - 1 === 1 ? '' : 's'} descendiente${ids.size - 1 === 1 ? '' : 's'}). Podrás deshacerlo con Ctrl+Z.`
    : `¿Eliminar la partida “${item.descripcion}”? Podrás deshacerlo con Ctrl+Z.`;
  if (!(await confirmar(msg, { titulo: 'Eliminar', peligro: true, labelOk: 'Eliminar' }))) return;
  if (ids.has(seleccionadoId)) seleccionadoId = null;
  store.update(pr => {
    pr.items = pr.items.filter(i => !ids.has(i.id));
    // Limpiar predecesores colgantes (cronograma)
    for (const i of pr.items) if (i.predecesorId && ids.has(i.predecesorId)) i.predecesorId = null;
  });
  toast('Elemento eliminado');
}

function abrirMenuItem(x, y, item) {
  const p = store.getProyecto();
  const nodo = arbolPlano(p).find(n => n.item.id === item.id);
  const nivel = nodo ? nodo.nivel : 1;
  const hermanos = hermanosDe(p, item);
  const idx = hermanos.findIndex(h => h.id === item.id);

  const ops = [];
  if (item.tipo === 'partida') {
    ops.push({ label: 'Ver análisis (ACU)', ico: 'acu', onClick: () => { location.hash = '#/acu/' + item.id; } });
  } else {
    ops.push({ label: 'Agregar partida hija', ico: 'mas', onClick: () => crearPartidaEn(item.id) });
    if (nivel < 3) ops.push({ label: 'Agregar subtítulo', ico: 'titulo', onClick: () => crearTituloEn(item.id) });
  }
  ops.push('sep');
  if (idx > 0) ops.push({ label: 'Subir', ico: 'subir', onClick: () => mover(item.id, -1) });
  if (idx >= 0 && idx < hermanos.length - 1) ops.push({ label: 'Bajar', ico: 'bajar', onClick: () => mover(item.id, 1) });
  ops.push({ label: 'Duplicar', ico: 'duplicar', onClick: () => duplicarItem(item.id) });
  ops.push('sep');
  ops.push({ label: 'Eliminar', ico: 'papelera', peligro: true, onClick: () => eliminarItem(item.id) });
  menuContextual(x, y, ops);
}

// --- Filas de la tabla ------------------------------------------------------

function marcarSeleccion(tr, id) {
  seleccionadoId = id;
  const tabla = tr.closest('table');
  if (tabla) tabla.querySelectorAll('tr.seleccionada').forEach(f => f.classList.remove('seleccionada'));
  tr.classList.add('seleccionada');
}

function filaNodo(n) {
  const item = n.item;
  const esTitulo = item.tipo === 'titulo';
  const clase = (esTitulo ? 'fila-titulo' + (n.nivel === 1 ? ' nivel-1' : '') : 'fila-partida')
    + (item.id === seleccionadoId ? ' seleccionada' : '');
  const tr = el('tr', { class: clase });

  tr.addEventListener('click', () => marcarSeleccion(tr, item.id));
  tr.addEventListener('contextmenu', e => {
    e.preventDefault();
    marcarSeleccion(tr, item.id);
    abrirMenuItem(e.clientX, e.clientY, item);
  });
  if (!esTitulo) {
    tr.addEventListener('dblclick', e => {
      if (e.target.closest('input, select, button')) return;
      location.hash = '#/acu/' + item.id;
    });
  }

  // Descripción editable en línea
  const inputDesc = el('input', {
    class: 'celda-input izq',
    value: item.descripcion,
    title: item.descripcion,
    style: esTitulo
      ? { color: 'var(--acento-fuerte)', fontWeight: '700', textTransform: 'uppercase', fontSize: '12.5px', letterSpacing: '.03em', flex: '1' }
      : null,
    onchange: e => {
      const txt = e.target.value.trim();
      if (!txt) { toast('La descripción no puede quedar vacía', 'error'); e.target.value = item.descripcion; return; }
      if (txt === item.descripcion) return;
      store.update(pr => { const it = itemPorId(pr, item.id); if (it) it.descripcion = esTitulo ? txt.toUpperCase() : txt; });
    },
    onkeydown: e => { if (e.key === 'Enter') e.target.blur(); },
  });

  let celdaDesc;
  if (esTitulo) {
    const abierto = !colapsados.has(item.id);
    const btnExp = el('button', {
      class: 'btn-expandir' + (abierto ? ' abierto' : ''),
      title: abierto ? 'Contraer' : 'Expandir',
      onclick: e => {
        e.stopPropagation();
        if (colapsados.has(item.id)) colapsados.delete(item.id); else colapsados.add(item.id);
        rerender();
      },
    }, icono('flecha', 14));
    celdaDesc = el('td', { style: { paddingLeft: (10 + (n.nivel - 1) * 22) + 'px' } },
      el('div', { class: 'fila', style: { gap: '4px' } }, btnExp, inputDesc));
  } else {
    celdaDesc = el('td', { style: { paddingLeft: (n.nivel * 22) + 'px' } }, inputDesc);
  }

  // Unidad (select) — solo partidas
  const celdaUnd = el('td', {});
  if (!esTitulo) {
    const unidades = item.unidad && !UNIDADES.includes(item.unidad) ? [item.unidad, ...UNIDADES] : UNIDADES;
    celdaUnd.append(el('select', {
      class: 'celda-input', style: { width: '68px', textAlign: 'left', cursor: 'pointer' },
      title: 'Unidad de medida',
      onchange: e => {
        const v = e.target.value;
        store.update(pr => { const it = itemPorId(pr, item.id); if (it) it.unidad = v; });
      },
    }, unidades.map(u => el('option', { value: u, selected: u === item.unidad }, u))));
  }

  // Metrado editable — solo partidas
  const celdaMet = el('td', { class: 'num' });
  if (!esTitulo) {
    celdaMet.append(el('input', {
      class: 'celda-input',
      value: fmtNum(Number(item.metrado) || 0, 2),
      onchange: e => {
        const v = parseNum(e.target.value);
        if (isNaN(v) || v < 0) {
          toast('Metrado inválido: escribe un número mayor o igual a 0', 'error');
          e.target.value = fmtNum(Number(item.metrado) || 0, 2);
          return;
        }
        if (round2(v) === round2(Number(item.metrado) || 0)) { e.target.value = fmtNum(v, 2); return; }
        store.update(pr => { const it = itemPorId(pr, item.id); if (it) it.metrado = v; });
      },
      onkeydown: e => { if (e.key === 'Enter') e.target.blur(); },
    }));
  }

  // P.U. → navega al ACU
  const celdaPU = el('td', { class: 'num' });
  if (!esTitulo) {
    celdaPU.append(el('span', {
      title: 'Ver análisis',
      style: { cursor: 'pointer', color: 'var(--acento-fuerte)', borderBottom: '1px dotted var(--acento)' },
      onclick: e => { e.stopPropagation(); location.hash = '#/acu/' + item.id; },
    }, fmtNum(n.pu, 2)));
  }

  const celdaParcial = el('td', { class: 'num', style: esTitulo ? { fontWeight: '700' } : null }, fmtNum(n.parcial, 2));

  const celdaAcc = el('td', { style: { textAlign: 'center', padding: '3px 6px' } },
    el('button', {
      class: 'btn-icono', title: 'Acciones', style: { width: '26px', height: '26px' },
      onclick: e => {
        e.stopPropagation();
        marcarSeleccion(tr, item.id);
        const r = e.currentTarget.getBoundingClientRect();
        abrirMenuItem(r.left, r.bottom + 2, item);
      },
    }, icono('editar', 14)));

  tr.append(el('td', { class: 'cod' }, n.codigo), celdaDesc, celdaUnd, celdaMet, celdaPU, celdaParcial, celdaAcc);
  return tr;
}

// --- Pie de presupuesto -----------------------------------------------------

function panelPie(p, r) {
  const inputPct = clave => el('input', {
    class: 'celda-input', style: { width: '80px' },
    value: fmtNum(Number(p[clave]) || 0, 2),
    onchange: e => {
      const v = parseNum(e.target.value);
      if (isNaN(v) || v < 0) {
        toast('Porcentaje inválido: escribe un número mayor o igual a 0', 'error');
        e.target.value = fmtNum(Number(p[clave]) || 0, 2);
        return;
      }
      if (round2(v) === round2(Number(p[clave]) || 0)) { e.target.value = fmtNum(v, 2); return; }
      store.update(pr => { pr[clave] = v; });
    },
    onkeydown: e => { if (e.key === 'Enter') e.target.blur(); },
  });

  const fila = (etiqueta, nodoPct, monto, fuerte = false) =>
    el('tr', {},
      el('td', { style: fuerte ? { fontWeight: '600' } : null }, etiqueta),
      el('td', { class: 'num' }, nodoPct || ''),
      el('td', { class: 'num', style: fuerte ? { fontWeight: '700' } : null }, fmtNum(monto, 2)));

  return el('div', { class: 'panel' },
    el('div', { class: 'panel-cab' },
      el('div', {},
        el('h2', {}, 'Pie de presupuesto'),
        el('div', { class: 'sub' }, 'GG y utilidad se aplican sobre el costo directo; el IGV, sobre el subtotal.'))),
    el('div', { class: 'envoltorio-tabla', style: { maxWidth: '680px', marginLeft: 'auto' } },
      el('table', { class: 'tabla' },
        el('thead', {},
          el('tr', {},
            el('th', {}, 'Concepto'),
            el('th', { class: 'num', style: { width: '120px' } }, '%'),
            el('th', { class: 'num', style: { width: '160px' } }, 'Monto S/'))),
        el('tbody', {},
          fila('Costo directo', null, r.costoDirecto, true),
          fila('Gastos generales (GG)', inputPct('ggPct'), r.gg),
          fila('Utilidad', inputPct('utilidadPct'), r.utilidad),
          fila('Subtotal', null, r.subtotal, true),
          fila('IGV', inputPct('igvPct'), r.igv),
          el('tr', { class: 'fila-total' },
            el('td', { style: { letterSpacing: '.05em' } }, 'TOTAL PRESUPUESTO'),
            el('td', {}),
            el('td', { class: 'num', style: { color: 'var(--ok)', fontFamily: 'var(--mono)', fontSize: '16.5px', fontWeight: '700' } },
              fmtNum(r.total, 2)))))));
}

// --- Render principal -------------------------------------------------------

export function render(container, params) {
  contRef = container;
  container.replaceChildren();

  const p = store.getProyecto();
  const nodos = arbol(p);
  const r = resumen(p);
  const numPartidas = p.items.filter(i => i.tipo === 'partida').length;

  container.append(
    el('div', { class: 'cabecera-vista' },
      el('div', {},
        el('h1', {}, 'Presupuesto'),
        el('div', { class: 'sub' }, `${p.nombre} · ${numPartidas} partida${numPartidas === 1 ? '' : 's'}`)),
      el('div', { class: 'acciones' },
        el('button', { class: 'btn btn-primario', title: 'Agregar título al final', onclick: () => crearTituloEn(null) }, '+ Título'),
        el('button', { class: 'btn', title: 'Agregar partida según la fila seleccionada', onclick: agregarPartidaToolbar }, '+ Partida'))));

  if (!p.items.length) {
    container.append(el('div', { class: 'panel' },
      el('div', { class: 'vacio' },
        icono('presupuesto', 42),
        el('div', { style: { fontWeight: '600', color: 'var(--texto-2)', marginBottom: '4px' } }, 'Este proyecto aún no tiene ítems'),
        'Crea un título para organizar el presupuesto y luego agrega partidas con su análisis de costos unitarios.',
        el('div', { style: { marginTop: '16px' } },
          el('button', { class: 'btn btn-primario', onclick: () => crearTituloEn(null) }, '+ Crear primer título')))));
  } else {
    const filas = [];
    const recorrer = lista => {
      for (const n of lista) {
        filas.push(filaNodo(n));
        if (n.item.tipo === 'titulo' && !colapsados.has(n.item.id)) recorrer(n.hijos);
      }
    };
    recorrer(nodos);

    container.append(el('div', { class: 'envoltorio-tabla', style: { marginBottom: '18px' } },
      el('table', { class: 'tabla' },
        el('thead', {},
          el('tr', {},
            el('th', { style: { width: '86px' } }, 'Código'),
            el('th', {}, 'Descripción'),
            el('th', { style: { width: '80px' } }, 'Und'),
            el('th', { class: 'num', style: { width: '110px' } }, 'Metrado'),
            el('th', { class: 'num', style: { width: '110px' } }, 'P.U. S/'),
            el('th', { class: 'num', style: { width: '130px' } }, 'Parcial S/'),
            el('th', { style: { width: '44px', textAlign: 'center' } }, '⋯'))),
        el('tbody', {},
          filas,
          el('tr', { class: 'fila-total' },
            el('td', { colspan: '5', style: { textAlign: 'right', letterSpacing: '.05em' } }, 'COSTO DIRECTO'),
            el('td', { class: 'num', style: { fontSize: '13.5px' } }, fmtNum(r.costoDirecto, 2)),
            el('td', {}))))));
  }

  container.append(panelPie(p, r));
}
