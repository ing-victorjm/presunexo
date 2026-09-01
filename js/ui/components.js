// components.js — helpers de UI compartidos: el(), iconos, modal, confirmar, toast, menú contextual.

// el('div', {class:'x', onclick:fn, dataset:{id:'1'}}, hijo1, 'texto', ...)
export function el(tag, attrs = {}, ...hijos) {
  const nodo = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') nodo.addEventListener(k.slice(2), v);
    else if (k === 'dataset') Object.assign(nodo.dataset, v);
    else if (k === 'style' && typeof v === 'object') Object.assign(nodo.style, v);
    else if (k === 'html') nodo.innerHTML = v;
    else if (v === true) nodo.setAttribute(k, '');
    else nodo.setAttribute(k, v);
  }
  for (const h of hijos.flat(Infinity)) {
    if (h == null || h === false) continue;
    nodo.append(h instanceof Node ? h : document.createTextNode(String(h)));
  }
  return nodo;
}

// --- Iconos SVG (stroke, 24×24) --------------------------------------------
const PATHS = {
  dashboard: 'M3 13h8V3H3zM13 21h8V11h-8zM3 21h8v-6H3zM13 8h8V3h-8z',
  presupuesto: 'M4 4h16v16H4zM4 9h16M9 9v11M4 14h16',
  acu: 'M9 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-4M14 3h7v7M21 3l-9 9',
  insumos: 'M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16zM3.3 7l8.7 5 8.7-5M12 22V12',
  cronograma: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM8 14h3M8 18h6',
  reportes: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M9 15l2 2 4-4',
  mas: 'M12 5v14M5 12h14',
  menos: 'M5 12h14',
  papelera: 'M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6',
  editar: 'M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z',
  duplicar: 'M8 8h12v12H8zM16 8V4H4v12h4',
  subir: 'M12 19V5M5 12l7-7 7 7',
  bajar: 'M12 5v14M19 12l-7 7-7-7',
  deshacer: 'M3 7v6h6M3 13a9 9 0 1 0 3-7.7L3 8',
  rehacer: 'M21 7v6h-6M21 13a9 9 0 1 1-3-7.7L21 8',
  exportar: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
  importar: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 8l5-5 5 5M12 3v12',
  cerrar: 'M18 6 6 18M6 6l12 12',
  flecha: 'M9 18l6-6-6-6',
  imprimir: 'M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z',
  buscar: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.35-4.35',
  carpeta: 'M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z',
  alerta: 'M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01',
  check: 'M20 6 9 17l-5-5',
  titulo: 'M4 6h16M4 12h10M4 18h16',
  enlace: 'M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7',
  polinomica: 'M4 20h16M4 20L9 8l4 8 3-5 4 9M7 4h10',
  programacion: 'M3 5h18M3 10h12M3 15h15M3 20h9M19 13v8M16 18l3 3 3-3',
  valorizacion: 'M12 2v20M17 6H9.5a3 3 0 0 0 0 6h5a3 3 0 0 1 0 6H6',
  biblioteca: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20V2H6.5A2.5 2.5 0 0 0 4 4.5zM9 7h6M9 11h6',
  calculadora: 'M5 2h14a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zM8 6h8M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 19h.01M12 19h.01M16 19h.01',
  normativa: 'M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7zM9 12l2 2 4-4',
  tema: 'M12 3a9 9 0 1 0 9 9c0-.46-.04-.92-.1-1.36a5.4 5.4 0 0 1-7.54-7.54A9.2 9.2 0 0 0 12 3z',
};

export function icono(nombre, tam = 18) {
  const span = document.createElement('span');
  span.className = 'ico';
  span.innerHTML = `<svg width="${tam}" height="${tam}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${PATHS[nombre] || PATHS.alerta}"/></svg>`;
  return span;
}

// --- Modal ------------------------------------------------------------------
// modal({ titulo, contenido: Node|string, ancho, acciones:[{label, clase, onClick}] }) → { cerrar, cuerpo }
export function modal({ titulo = '', contenido = '', ancho = 520, acciones = [] }) {
  const overlay = el('div', { class: 'modal-overlay' });
  const cuerpo = el('div', { class: 'modal-cuerpo' });
  if (typeof contenido === 'string') cuerpo.innerHTML = contenido;
  else cuerpo.append(contenido);

  const cerrar = () => { overlay.remove(); document.removeEventListener('keydown', escuchaEsc); };
  const escuchaEsc = e => { if (e.key === 'Escape') cerrar(); };
  document.addEventListener('keydown', escuchaEsc);

  const pie = acciones.length
    ? el('div', { class: 'modal-pie' },
        acciones.map(a => el('button', {
          class: `btn ${a.clase || ''}`,
          onclick: () => { const r = a.onClick ? a.onClick() : undefined; if (r !== false) cerrar(); },
        }, a.label)))
    : null;

  const caja = el('div', { class: 'modal-caja', style: { maxWidth: ancho + 'px' } },
    el('div', { class: 'modal-cab' },
      el('h3', {}, titulo),
      el('button', { class: 'btn-icono', onclick: cerrar, title: 'Cerrar (Esc)' }, icono('cerrar', 16))),
    cuerpo, pie);

  overlay.addEventListener('mousedown', e => { if (e.target === overlay) cerrar(); });
  overlay.append(caja);
  document.body.append(overlay);
  const primero = caja.querySelector('input, select, textarea, button.btn');
  if (primero) setTimeout(() => primero.focus(), 30);
  return { cerrar, cuerpo };
}

export function confirmar(mensaje, { titulo = 'Confirmar', peligro = false, labelOk = 'Aceptar' } = {}) {
  return new Promise(resolver => {
    modal({
      titulo,
      contenido: el('p', { class: 'texto-confirmacion' }, mensaje),
      acciones: [
        { label: 'Cancelar', clase: 'btn-sec', onClick: () => resolver(false) },
        { label: labelOk, clase: peligro ? 'btn-peligro' : 'btn-primario', onClick: () => resolver(true) },
      ],
    });
  });
}

// --- Toast ------------------------------------------------------------------
let zonaToast = null;
export function toast(mensaje, tipo = 'ok') { // 'ok' | 'error' | 'info'
  if (!zonaToast) { zonaToast = el('div', { class: 'zona-toast' }); document.body.append(zonaToast); }
  const t = el('div', { class: `toast toast-${tipo}` },
    icono(tipo === 'error' ? 'alerta' : 'check', 15), el('span', {}, mensaje));
  zonaToast.append(t);
  setTimeout(() => t.classList.add('visible'), 10);
  setTimeout(() => { t.classList.remove('visible'); setTimeout(() => t.remove(), 300); }, 3200);
}

// --- Menú contextual --------------------------------------------------------
// menuContextual(x, y, [{label, ico, peligro, onClick}, 'sep', ...])
export function menuContextual(x, y, opciones) {
  document.querySelectorAll('.menu-ctx').forEach(m => m.remove());
  const menu = el('div', { class: 'menu-ctx' },
    opciones.map(o => o === 'sep'
      ? el('div', { class: 'menu-sep' })
      : el('button', {
          class: `menu-item ${o.peligro ? 'peligro' : ''}`,
          onclick: () => { menu.remove(); o.onClick && o.onClick(); },
        }, o.ico ? icono(o.ico, 15) : null, el('span', {}, o.label))));
  document.body.append(menu);
  const r = menu.getBoundingClientRect();
  menu.style.left = Math.min(x, window.innerWidth - r.width - 8) + 'px';
  menu.style.top = Math.min(y, window.innerHeight - r.height - 8) + 'px';
  const cerrar = e => { if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('mousedown', cerrar); } };
  setTimeout(() => document.addEventListener('mousedown', cerrar), 10);
  return menu;
}

// Descarga un texto como archivo.
export function descargar(nombreArchivo, contenido, mime = 'application/json') {
  const blob = new Blob([contenido], { type: mime + ';charset=utf-8' });
  const a = el('a', { href: URL.createObjectURL(blob), download: nombreArchivo });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

// Campo de formulario etiquetado.
export function campo(etiqueta, inputNode, ayuda = '') {
  return el('label', { class: 'campo' },
    el('span', { class: 'campo-etiqueta' }, etiqueta),
    inputNode,
    ayuda ? el('span', { class: 'campo-ayuda' }, ayuda) : null);
}
