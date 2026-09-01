// app.js — shell v2: sidebar agrupado, topbar, tema claro/oscuro, router hash
// y buscador global (Ctrl+K).
import * as store from './core/store.js';
import './core/nube.js'; // guardado por cuenta cuando se abre desde el campus
import { resumen, arbolPlano } from './core/calc.js';
import { fmtMoney, fmtNum } from './core/fmt.js';
import { el, icono, modal, confirmar, toast, descargar, campo } from './ui/components.js';
import { IU_CATALOGO, METADATA_INDICES } from './data/indices.js';
import { RENDIMIENTOS, DESPERDICIOS, DOSIFICACIONES_CONCRETO } from './data/biblioteca.js';
import { MARCO_LEGAL } from './data/normativa.js';

import * as vDashboard from './views/dashboard.js';
import * as vPresupuesto from './views/presupuesto.js';
import * as vAcu from './views/acu.js';
import * as vInsumos from './views/insumos.js';
import * as vPolinomica from './views/polinomica.js';
import * as vProgramacion from './views/programacion.js';
import * as vGantt from './views/gantt.js';
import * as vValorizaciones from './views/valorizaciones.js';
import * as vBiblioteca from './views/biblioteca.js';
import * as vCalculadoras from './views/calculadoras.js';
import * as vNormativa from './views/normativa.js';
import * as vReportes from './views/reportes.js';

const NAV = [
  { seccion: 'Inicio', rutas: [
    { hash: '#/dashboard', nombre: 'Panel general', ico: 'dashboard', vista: vDashboard },
  ]},
  { seccion: 'Presupuesto', rutas: [
    { hash: '#/presupuesto', nombre: 'Hoja de presupuesto', ico: 'presupuesto', vista: vPresupuesto },
    { hash: '#/acu', nombre: 'Análisis (ACU)', ico: 'acu', vista: vAcu },
    { hash: '#/insumos', nombre: 'Insumos', ico: 'insumos', vista: vInsumos },
    { hash: '#/polinomica', nombre: 'Fórmula polinómica', ico: 'polinomica', vista: vPolinomica },
  ]},
  { seccion: 'Planificación', rutas: [
    { hash: '#/programacion', nombre: 'Programación', ico: 'programacion', vista: vProgramacion },
    { hash: '#/gantt', nombre: 'Diagrama de Gantt', ico: 'cronograma', vista: vGantt },
    { hash: '#/valorizaciones', nombre: 'Valorizaciones', ico: 'valorizacion', vista: vValorizaciones },
  ]},
  { seccion: 'Consulta técnica', rutas: [
    { hash: '#/biblioteca', nombre: 'Biblioteca técnica', ico: 'biblioteca', vista: vBiblioteca },
    { hash: '#/calculadoras', nombre: 'Calculadoras', ico: 'calculadora', vista: vCalculadoras },
    { hash: '#/normativa', nombre: 'Normativa', ico: 'normativa', vista: vNormativa },
  ]},
  { seccion: 'Salidas', rutas: [
    { hash: '#/reportes', nombre: 'Reportes y memoria', ico: 'reportes', vista: vReportes },
  ]},
];
const RUTAS = NAV.flatMap(s => s.rutas);

// Isotipo PRESUNEXO: nodos enlazados que ascienden (el "nexo" de la familia de
// marcas) con el gradiente de ConstructorIA — cian #26F4F4 a índigo #6B71CE.
const LOGO_SVG = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs><linearGradient id="pnx" x1="0" y1=".15" x2="1" y2=".85">
    <stop offset="0" stop-color="#26F4F4"/><stop offset=".55" stop-color="#4BA3D7"/><stop offset="1" stop-color="#6B71CE"/>
  </linearGradient></defs>
  <rect width="100" height="100" rx="24" fill="url(#pnx)"/>
  <path d="M27 70L46 51L62 60L76 34" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="27" cy="70" r="8" fill="#fff"/><circle cx="46" cy="51" r="6.5" fill="#fff"/>
  <circle cx="62" cy="60" r="6.5" fill="#fff"/><circle cx="76" cy="34" r="9" fill="#fff"/>
</svg>`;
const ALIAS = { '#/cronograma': '#/gantt' };

function rutaActual() {
  let h = location.hash || '#/dashboard';
  const base0 = '#/' + h.split('/')[1];
  if (ALIAS[base0]) { h = ALIAS[base0]; }
  const base = '#/' + h.split('/')[1];
  const ruta = RUTAS.find(r => r.hash === base) || RUTAS[0];
  const params = (location.hash || '').split('/').slice(2);
  return { ruta, params };
}

// --- Tema -------------------------------------------------------------------
const CLAVE_TEMA = 'presunexo.tema';
function temaActual() { return localStorage.getItem(CLAVE_TEMA) || 'claro'; }
function aplicarTema() {
  document.documentElement.dataset.theme = temaActual() === 'oscuro' ? 'dark' : '';
  if (temaActual() !== 'oscuro') document.documentElement.removeAttribute('data-theme');
}
function alternarTema() {
  localStorage.setItem(CLAVE_TEMA, temaActual() === 'oscuro' ? 'claro' : 'oscuro');
  aplicarTema();
  renderTodo();
}

// --- Sidebar ----------------------------------------------------------------
function renderSidebar() {
  const { ruta } = rutaActual();
  const sb = document.getElementById('sidebar');
  sb.replaceChildren(
    el('div', { class: 'logo' },
      el('div', { class: 'logo-marca', html: LOGO_SVG }),
      el('div', {},
        el('div', { class: 'logo-nombre', html: 'PRESU<b>NEXO</b>' }),
        el('div', { class: 'logo-sub' }, 'Costos · Valorizaciones'))),
    el('nav', { class: 'nav' },
      NAV.map(sec => [
        el('div', { class: 'nav-seccion' }, sec.seccion),
        sec.rutas.map(r => el('a', {
          class: 'nav-item' + (r === ruta ? ' activo' : ''),
          href: r.hash,
        }, icono(r.ico), el('span', {}, r.nombre))),
      ])),
    el('div', { class: 'sidebar-pie' },
      `Índices INEI: base dic-2025 · último ${METADATA_INDICES.ultimoPublicado}`, el('br'),
      'Datos locales · exporta respaldos JSON.'));
}

// --- Topbar -----------------------------------------------------------------
function renderTopbar() {
  const p = store.getProyecto();
  const r = resumen(p);
  const tb = document.getElementById('topbar');
  tb.replaceChildren(
    el('div', { class: 'selector-proyecto', onclick: abrirGestorProyectos, title: 'Cambiar de proyecto' },
      icono('carpeta', 16),
      el('span', { class: 'nombre' }, p.nombre),
      icono('flecha', 14)),
    el('div', { class: 'buscador-global', onclick: abrirPaleta, title: 'Buscar en todo (Ctrl+K)' },
      icono('buscar', 15),
      el('span', {}, 'Buscar en todo…'),
      el('kbd', {}, 'Ctrl K')),
    el('div', { class: 'topbar-acciones', style: { marginLeft: 'auto' } },
      el('button', { class: 'btn-icono', title: temaActual() === 'oscuro' ? 'Tema claro' : 'Tema oscuro', onclick: alternarTema }, icono('tema', 17)),
      el('button', { class: 'btn-icono', title: 'Deshacer (Ctrl+Z)', disabled: !store.puedeUndo(), onclick: () => store.undo() }, icono('deshacer', 17)),
      el('button', { class: 'btn-icono', title: 'Rehacer (Ctrl+Y)', disabled: !store.puedeRedo(), onclick: () => store.redo() }, icono('rehacer', 17)),
      el('button', { class: 'btn-icono', title: 'Exportar respaldo JSON', onclick: exportarBackup }, icono('exportar', 17)),
      el('button', { class: 'btn-icono', title: 'Importar respaldo JSON', onclick: importarBackup }, icono('importar', 17))),
    el('div', { class: 'topbar-total' },
      el('div', { class: 'etiqueta' }, 'Total presupuesto (inc. IGV)'),
      el('div', { class: 'monto' }, fmtMoney(r.total))));
}

// --- Gestor de proyectos ----------------------------------------------------
function abrirGestorProyectos() {
  const est = store.getEstado();
  const lista = el('div', {},
    est.proyectos.map(p => el('div', {
      class: 'fila-esp',
      style: { padding: '9px 10px', borderRadius: '9px', cursor: 'pointer', background: p.id === est.activoId ? 'var(--acento-suave)' : 'transparent', marginBottom: '4px' },
      onclick: () => { store.setActivo(p.id); m.cerrar(); toast(`Proyecto activo: ${p.nombre}`, 'info'); },
    },
      el('div', { class: 'col' },
        el('strong', {}, p.nombre),
        el('span', { class: 'texto-3', style: { fontSize: '11.5px' } }, `${p.items.filter(i => i.tipo === 'partida').length} partidas · ${p.insumos.length} insumos`)),
      el('div', { class: 'fila' },
        el('button', {
          class: 'btn-icono', title: 'Duplicar',
          onclick: e => { e.stopPropagation(); store.duplicarProyecto(p.id); m.cerrar(); toast('Proyecto duplicado'); },
        }, icono('duplicar', 15)),
        el('button', {
          class: 'btn-icono', title: 'Eliminar',
          onclick: async e => {
            e.stopPropagation(); m.cerrar();
            if (await confirmar(`¿Eliminar el proyecto “${p.nombre}”? Puedes deshacer con Ctrl+Z.`, { peligro: true, labelOk: 'Eliminar' })) {
              store.eliminarProyecto(p.id); toast('Proyecto eliminado');
            }
          },
        }, icono('papelera', 15))))));

  const m = modal({
    titulo: 'Proyectos',
    ancho: 560,
    contenido: lista,
    acciones: [
      { label: 'Proyecto demo', clase: 'btn-sec', onClick: () => { store.nuevoProyectoDemo(); toast('Proyecto demo creado'); } },
      { label: 'Nuevo proyecto', clase: 'btn-primario', onClick: () => { crearProyectoModal(); } },
    ],
  });
}

function crearProyectoModal() {
  const inNombre = el('input', { type: 'text', placeholder: 'Ej. Edificio San Martín — Estructuras', style: { width: '100%' } });
  const inCliente = el('input', { type: 'text', placeholder: 'Cliente (opcional)', style: { width: '100%' } });
  modal({
    titulo: 'Nuevo proyecto',
    contenido: el('div', {}, campo('Nombre del proyecto', inNombre), campo('Cliente', inCliente)),
    acciones: [
      { label: 'Cancelar', clase: 'btn-sec' },
      {
        label: 'Crear', clase: 'btn-primario',
        onClick: () => {
          const nombre = inNombre.value.trim();
          if (!nombre) { toast('Escribe un nombre para el proyecto', 'error'); return false; }
          const p = store.nuevoProyecto(nombre);
          store.update(pr => { pr.cliente = inCliente.value.trim(); }, { registrarUndo: false });
          location.hash = '#/presupuesto';
          toast(`Proyecto “${p.nombre}” creado`);
        },
      },
    ],
  });
}

// --- Backup -----------------------------------------------------------------
function exportarBackup() {
  const fecha = new Date().toISOString().slice(0, 10);
  descargar(`presunexo-respaldo-${fecha}.json`, store.exportJSON());
  toast('Respaldo exportado');
}

function importarBackup() {
  const input = el('input', { type: 'file', accept: '.json,application/json' });
  input.addEventListener('change', async () => {
    const archivo = input.files[0];
    if (!archivo) return;
    try {
      store.importJSON(await archivo.text());
      toast('Respaldo importado correctamente');
    } catch (e) {
      toast(e.message || 'No se pudo importar el archivo', 'error');
    }
  });
  input.click();
}

// --- Buscador global (Ctrl+K) ----------------------------------------------
function indiceBusqueda() {
  const p = store.getProyecto();
  const grupos = [];
  grupos.push({
    nombre: 'Partidas del presupuesto',
    items: arbolPlano(p).filter(n => n.item.tipo === 'partida').map(n => ({
      texto: `${n.codigo} ${n.item.descripcion}`,
      detalle: fmtMoney(n.parcial),
      ir: () => { location.hash = '#/acu/' + n.item.id; },
    })),
  });
  grupos.push({
    nombre: 'Insumos',
    items: p.insumos.map(i => ({
      texto: `${i.descripcion} (${i.unidad})`,
      detalle: fmtMoney(i.precio),
      ir: () => { location.hash = '#/insumos'; },
    })),
  });
  grupos.push({
    nombre: 'Índices unificados INEI',
    items: Object.entries(IU_CATALOGO).map(([cod, v]) => ({
      texto: `IU ${cod} — ${v.nombre}`,
      detalle: 'índices',
      ir: () => { location.hash = '#/polinomica'; },
    })),
  });
  grupos.push({
    nombre: 'Rendimientos',
    items: RENDIMIENTOS.map(r => ({
      texto: `${r.partida}`,
      detalle: `${fmtNum(r.rend, 0)} ${r.und}/día`,
      ir: () => { location.hash = '#/biblioteca'; },
    })),
  });
  grupos.push({
    nombre: 'Desperdicios y dosificaciones',
    items: [
      ...DESPERDICIOS.map(d => ({ texto: `Desperdicio: ${d.material}`, detalle: `${d.pct} %`, ir: () => { location.hash = '#/biblioteca'; } })),
      ...DOSIFICACIONES_CONCRETO.map(d => ({ texto: `Dosificación: ${d.nombre}`, detalle: `${d.cemento_bol} bol/m³`, ir: () => { location.hash = '#/biblioteca'; } })),
    ],
  });
  grupos.push({
    nombre: 'Normativa',
    items: MARCO_LEGAL.flatMap(s => s.items.map(i => ({
      texto: i.titulo,
      detalle: i.ref,
      ir: () => { location.hash = '#/normativa'; },
    }))),
  });
  grupos.push({
    nombre: 'Ir a…',
    items: RUTAS.map(r => ({ texto: r.nombre, detalle: 'vista', ir: () => { location.hash = r.hash; } })),
  });
  return grupos;
}

let paletaAbierta = null;
function abrirPaleta() {
  if (paletaAbierta) return;
  const grupos = indiceBusqueda();
  const input = el('input', { type: 'text', placeholder: 'Buscar partidas, insumos, índices INEI, rendimientos, normas…' });
  const lista = el('div', { class: 'paleta-lista' });
  let visibles = [];
  let activo = 0;

  const pinta = () => {
    const q = input.value.trim().toLowerCase();
    lista.replaceChildren();
    visibles = [];
    for (const g of grupos) {
      const coincide = g.items.filter(i => !q || i.texto.toLowerCase().includes(q)).slice(0, q ? 8 : 4);
      if (!coincide.length) continue;
      lista.append(el('div', { class: 'paleta-grupo' }, g.nombre));
      for (const item of coincide) {
        const idx = visibles.length;
        const nodo = el('div', {
          class: 'paleta-item' + (idx === activo ? ' activo' : ''),
          onclick: () => { cerrar(); item.ir(); },
          onmouseenter: () => { activo = idx; refrescaActivo(); },
        },
          el('span', {}, item.texto),
          el('span', { class: 'detalle' }, item.detalle));
        visibles.push({ item, nodo });
        lista.append(nodo);
      }
    }
    if (!visibles.length) lista.append(el('div', { class: 'vacio', style: { padding: '26px' } }, 'Sin resultados.'));
    activo = Math.min(activo, Math.max(0, visibles.length - 1));
    refrescaActivo();
  };
  const refrescaActivo = () => {
    visibles.forEach((v, i) => v.nodo.classList.toggle('activo', i === activo));
  };

  const overlay = el('div', { class: 'paleta-overlay' },
    el('div', { class: 'paleta' },
      el('div', { class: 'paleta-input' }, icono('buscar', 17), input),
      lista));
  const cerrar = () => { overlay.remove(); document.removeEventListener('keydown', teclas, true); paletaAbierta = null; };
  const teclas = e => {
    if (e.key === 'Escape') { e.preventDefault(); cerrar(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); activo = Math.min(activo + 1, visibles.length - 1); refrescaActivo(); visibles[activo]?.nodo.scrollIntoView({ block: 'nearest' }); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); activo = Math.max(activo - 1, 0); refrescaActivo(); visibles[activo]?.nodo.scrollIntoView({ block: 'nearest' }); }
    else if (e.key === 'Enter') { e.preventDefault(); const v = visibles[activo]; if (v) { cerrar(); v.item.ir(); } }
  };
  overlay.addEventListener('mousedown', e => { if (e.target === overlay) cerrar(); });
  input.addEventListener('input', () => { activo = 0; pinta(); });
  document.addEventListener('keydown', teclas, true);
  document.body.append(overlay);
  paletaAbierta = overlay;
  pinta();
  setTimeout(() => input.focus(), 20);
}

// --- Router + render --------------------------------------------------------
let renderizando = false;
function renderTodo() {
  if (renderizando) return;
  renderizando = true;
  try {
    const { ruta, params } = rutaActual();
    renderSidebar();
    renderTopbar();
    const vista = document.getElementById('vista');
    vista.replaceChildren();
    ruta.vista.render(vista, params);
  } finally {
    renderizando = false;
  }
}

window.addEventListener('hashchange', () => { document.getElementById('vista').scrollTop = 0; renderTodo(); });
store.suscribir(renderTodo);

document.addEventListener('keydown', e => {
  const enInput = /INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName || '');
  if (e.ctrlKey && e.key.toLowerCase() === 'k') { e.preventDefault(); abrirPaleta(); return; }
  if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === 'z' && !enInput) { e.preventDefault(); store.undo(); }
  if (e.ctrlKey && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z')) && !enInput) { e.preventDefault(); store.redo(); }
});

aplicarTema();
store.iniciar();
if (!location.hash) location.hash = '#/dashboard';
renderTodo();
