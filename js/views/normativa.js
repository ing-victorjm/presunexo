// normativa.js — Normativa aplicable: marco legal (acordeones por sección),
// checklist visual de valorización mensual y fuentes oficiales.
import { MARCO_LEGAL, FUENTES_OFICIALES, CHECKLIST_VALORIZACION } from '../data/normativa.js';
import { el, icono, toast } from '../ui/components.js';

// --- Estado de UI (variables de módulo; se pierde al recargar, por diseño) ---
let expandidos = new Set();   // claves 'seccion-item' de acordeones abiertos
let marcados = new Set();     // índices del checklist marcados (solo visual)
let contRef = null;

const TOTAL_ITEMS = MARCO_LEGAL.reduce((s, sec) => s + sec.items.length, 0);
const TITLE_VERIFICAR = 'Redacción sujeta a confirmación: contrasta este punto con el texto legal vigente (El Peruano / OECE) antes de aplicarlo en un contrato.';

function repintar() {
  if (!contRef) return;
  contRef.replaceChildren();
  render(contRef);
}

// --- Marco legal: acordeones -------------------------------------------------
function filaAcordeon(item, clave, esPrimera) {
  const abierto = expandidos.has(clave);

  const cabecera = el('button', {
    style: {
      display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '9px',
      width: '100%', padding: '10.5px 14px', border: 'none',
      borderTop: esPrimera ? 'none' : '1px solid var(--panel-borde)',
      background: abierto ? 'var(--fondo-3)' : 'transparent',
      fontFamily: 'inherit', fontSize: '13px', textAlign: 'left',
      color: 'var(--texto)', cursor: 'pointer',
    },
    onclick: () => {
      if (abierto) expandidos.delete(clave); else expandidos.add(clave);
      repintar();
    },
  },
    el('span', { class: 'btn-expandir' + (abierto ? ' abierto' : '') }, icono('flecha', 14)),
    el('strong', { style: { flex: '1 1 300px', lineHeight: '1.4' } }, item.titulo),
    el('span', { class: 'pill mono', style: { whiteSpace: 'nowrap' } }, item.ref),
    item.verificar
      ? el('span', { class: 'pill pill-auto', title: TITLE_VERIFICAR, style: { whiteSpace: 'nowrap' } }, 'verificar texto legal')
      : null);

  const detalle = abierto
    ? el('div', {
        style: {
          padding: '11px 16px 13px 45px', borderTop: '1px solid var(--panel-borde)',
          background: 'var(--fondo-3)', color: 'var(--texto-2)',
          fontSize: '12.75px', lineHeight: '1.6',
        },
      }, item.detalle)
    : null;

  return [cabecera, detalle];
}

function panelSeccion(sec, si) {
  const porVerificar = sec.items.filter(i => i.verificar).length;
  const sub = `${sec.items.length} referencia${sec.items.length === 1 ? '' : 's'}`
    + (porVerificar ? ` · ${porVerificar} por verificar` : '');

  if (!sec.items.length) {
    return el('div', { class: 'panel' },
      el('div', { class: 'panel-cab' },
        el('div', {}, el('h2', {}, sec.seccion))),
      el('div', { class: 'vacio' }, icono('normativa', 30), 'Sin referencias en esta sección.'));
  }

  return el('div', { class: 'panel' },
    el('div', { class: 'panel-cab' },
      el('div', {},
        el('h2', {}, sec.seccion),
        el('div', { class: 'sub' }, sub))),
    el('div', { style: { border: '1px solid var(--panel-borde)', borderRadius: '10px', overflow: 'hidden' } },
      sec.items.map((item, ii) => filaAcordeon(item, `${si}-${ii}`, ii === 0))));
}

// --- Checklist de valorización mensual (solo visual) -------------------------
function panelChecklist() {
  const total = CHECKLIST_VALORIZACION.length;
  const hechos = marcados.size;
  const pct = total ? Math.round((hechos / total) * 100) : 0;

  const filas = CHECKLIST_VALORIZACION.map((texto, i) => {
    const marcado = marcados.has(i);
    return el('label', {
      style: {
        display: 'flex', alignItems: 'flex-start', gap: '11px',
        padding: '7.5px 10px', borderRadius: '8px', cursor: 'pointer',
        background: marcado ? 'var(--ok-suave)' : 'transparent',
      },
    },
      el('input', {
        type: 'checkbox',
        checked: marcado,
        style: { width: '15px', height: '15px', margin: '2px 0 0', padding: '0', accentColor: 'var(--ok)', cursor: 'pointer', flexShrink: '0' },
        onchange: e => {
          if (e.target.checked) marcados.add(i); else marcados.delete(i);
          repintar();
        },
      }),
      el('span', { class: 'mono', style: { color: 'var(--texto-3)', fontSize: '11.5px', paddingTop: '2px', minWidth: '18px' } },
        String(i + 1).padStart(2, '0')),
      el('span', {
        style: {
          fontSize: '12.9px', lineHeight: '1.55',
          color: marcado ? 'var(--texto-3)' : 'var(--texto)',
          textDecoration: marcado ? 'line-through' : 'none',
        },
      }, texto));
  });

  return el('div', { class: 'panel' },
    el('div', { class: 'panel-cab' },
      el('div', {},
        el('h2', {}, 'Checklist de valorización mensual'),
        el('div', { class: 'sub' }, 'Guía operativa para obra pública — el estado es solo visual y no se guarda.')),
      el('div', { class: 'fila' },
        el('span', { class: 'pill mono' }, `${hechos} / ${total}`),
        el('button', {
          class: 'btn btn-mini btn-sec',
          disabled: hechos === 0,
          onclick: () => { marcados.clear(); toast('Checklist reiniciado', 'info'); repintar(); },
        }, icono('deshacer', 14), 'Reiniciar'))),
    el('div', { class: 'barra', style: { marginBottom: '12px' } },
      el('span', { style: { width: pct + '%', background: 'var(--ok)' } })),
    el('div', { class: 'col', style: { gap: '2px' } }, filas));
}

// --- Fuentes oficiales -------------------------------------------------------
function tarjetaFuente(f) {
  const esLocal = !/^https?:\/\//i.test(f.url);
  return el('a', {
    href: f.url,
    target: esLocal ? null : '_blank',
    rel: esLocal ? null : 'noopener',
    title: esLocal ? 'Documento local del proyecto' : 'Se abre en una pestaña nueva',
    style: {
      display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 15px',
      border: '1px solid var(--panel-borde)', borderRadius: '10px',
      background: 'var(--fondo-2)', textDecoration: 'none', color: 'var(--texto)',
    },
  },
    el('span', { style: { color: 'var(--acento-texto)', display: 'grid', placeItems: 'center', flexShrink: '0' } },
      icono('enlace', 16)),
    el('div', { class: 'col', style: { gap: '2px', minWidth: '0', flex: '1' } },
      el('strong', { style: { fontSize: '12.9px', lineHeight: '1.4' } }, f.nombre),
      el('span', { class: 'texto-3 mono', style: { fontSize: '10.75px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, f.url)),
    esLocal ? el('span', { class: 'pill', style: { flexShrink: '0' } }, 'PDF local') : null);
}

function panelFuentes() {
  if (!FUENTES_OFICIALES.length) {
    return el('div', { class: 'panel' },
      el('div', { class: 'panel-cab' }, el('div', {}, el('h2', {}, 'Fuentes oficiales'))),
      el('div', { class: 'vacio' }, icono('enlace', 30), 'Sin fuentes registradas.'));
  }
  return el('div', { class: 'panel' },
    el('div', { class: 'panel-cab' },
      el('div', {},
        el('h2', {}, 'Fuentes oficiales'),
        el('div', { class: 'sub' }, 'Textos legales y series de índices publicados — verifica siempre contra el original.'))),
    el('div', { class: 'grid-2-min', style: { gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: '11px' } },
      FUENTES_OFICIALES.map(tarjetaFuente)));
}

// --- Vista -------------------------------------------------------------------
export function render(container, params) {
  contRef = container;

  const todoAbierto = expandidos.size >= TOTAL_ITEMS;
  const cabecera = el('div', { class: 'cabecera-vista' },
    el('div', {},
      el('h1', {}, 'Normativa aplicable'),
      el('div', { class: 'sub' }, 'Ley 32069, reajustes DS 011-79-VC, metrados y RNE — verificado al 31-ago-2026')),
    el('div', { class: 'acciones' },
      el('button', {
        class: 'btn btn-sec btn-mini',
        onclick: () => {
          if (todoAbierto) expandidos.clear();
          else MARCO_LEGAL.forEach((sec, si) => sec.items.forEach((_, ii) => expandidos.add(`${si}-${ii}`)));
          repintar();
        },
      }, icono(todoAbierto ? 'menos' : 'mas', 14), todoAbierto ? 'Contraer todo' : 'Expandir todo')));

  container.append(
    cabecera,
    ...MARCO_LEGAL.map(panelSeccion),
    panelChecklist(),
    panelFuentes(),
    el('div', { class: 'nota', style: { marginTop: '4px' } },
      'Esta síntesis es ', el('b', {}, 'orientación técnica, no asesoría legal'),
      '; contrasta siempre con el texto publicado en ', el('b', {}, 'El Peruano'), '.'));
}
