// programacion.js — Programación de obra: tabla completa de programación por
// partida (inicio, duración, predecesor FS y avance físico), separada del
// diagrama de Gantt. Los cálculos vienen íntegros de calc.js (fechasEfectivas,
// cronogramaCalc, avanceProyecto); esta vista solo edita y valida.
import * as store from '../core/store.js';
import { arbolPlano, cronogramaCalc, fechasEfectivas, avanceProyecto, itemPorId } from '../core/calc.js';
import { fmtNum, parseNum, fmtFecha, hoyISO } from '../core/fmt.js';
import { el, icono, toast } from '../ui/components.js';

const truncar = (s, n) => { s = String(s ?? ''); return s.length > n ? s.slice(0, Math.max(1, n - 1)) + '…' : s; };

// ¿Asignar candidatoId como predecesor de itemId crearía un ciclo? Se sigue la
// cadena de predecesores desde el candidato; si se alcanza la propia partida,
// el vínculo es circular (A→B→…→A).
function creaCiclo(proyecto, itemId, candidatoId) {
  const porId = new Map(proyecto.items.filter(i => i.tipo === 'partida').map(i => [i.id, i]));
  const visitados = new Set();
  let cursor = candidatoId;
  while (cursor) {
    if (cursor === itemId) return true;
    if (visitados.has(cursor)) return false; // ciclo preexistente que no involucra a esta partida
    visitados.add(cursor);
    const nodo = porId.get(cursor);
    cursor = nodo ? (nodo.predecesorId || null) : null;
  }
  return false;
}

export function render(container) {
  const proy = store.getProyecto();
  // Guarda: sin fecha de inicio válida se usa hoy solo para calcular (no muta el store).
  const py = proy.fechaInicio ? proy : { ...proy, fechaInicio: hoyISO() };

  const plano = arbolPlano(py);
  const partidas = plano.filter(n => n.item.tipo === 'partida');

  if (!partidas.length) {
    container.append(
      cabecera(py, null, 0),
      el('div', { class: 'panel' },
        el('div', { class: 'vacio' },
          icono('programacion', 36),
          el('div', {}, 'Este proyecto aún no tiene partidas que programar.'),
          el('div', { class: 'texto-3' }, 'Crea partidas en la hoja de presupuesto y aparecerán aquí para asignarles inicio, duración, predecesor y avance.'),
          el('div', { style: { marginTop: '14px' } },
            el('button', { class: 'btn btn-primario', onclick: () => { location.hash = '#/presupuesto'; } }, 'Ir al presupuesto')))));
    return;
  }

  const crono = cronogramaCalc(py);
  const fechas = fechasEfectivas(py);
  const avance = avanceProyecto(py);
  const idsPartida = new Set(partidas.map(n => n.item.id));

  container.append(
    cabecera(py, crono, avance),
    panelKpis(py, crono, partidas, idsPartida, avance),
    panelProgramacion(py, plano, partidas, idsPartida, fechas),
    panelHitos(partidas, fechas, crono),
  );
}

// --- Cabecera ---------------------------------------------------------------
function cabecera(py, crono, avance) {
  const sub = crono
    ? `Duración total: ${fmtNum(crono.fin, 0)} días · Fin de obra: ${fmtFecha(crono.finISO)}`
    : 'Aún no hay partidas que programar.';

  return el('div', { class: 'cabecera-vista' },
    el('div', {},
      el('h1', {}, 'Programación de obra'),
      el('div', { class: 'sub' }, sub)),
    el('div', { class: 'acciones' },
      el('label', { class: 'fila', style: { gap: '8px' } },
        el('span', { class: 'texto-2', style: { fontSize: '12px', fontWeight: '600' } }, 'Inicio de obra'),
        el('input', {
          type: 'date', value: py.fechaInicio,
          onchange: e => {
            const v = e.target.value;
            if (!v) { toast('Fecha de inicio inválida', 'error'); e.target.value = py.fechaInicio; return; }
            store.update(p => { p.fechaInicio = v; });
          },
        })),
      crono ? el('span', {
        class: 'pill', title: 'Avance físico ponderado por el parcial de cada partida',
        style: { display: 'inline-flex', alignItems: 'center', gap: '6px' },
      },
        'Avance físico',
        el('b', { class: 'mono', style: { fontSize: '12px' } }, fmtNum(avance, 1) + ' %')) : null,
      el('button', { class: 'btn btn-sec', onclick: () => { location.hash = '#/gantt'; } },
        icono('cronograma', 15), 'Ver diagrama de Gantt'),
      el('button', { class: 'btn btn-sec', onclick: () => { location.hash = '#/valorizaciones'; } },
        icono('valorizacion', 15), 'Valorizaciones')));
}

// --- KPIs -------------------------------------------------------------------
function panelKpis(py, crono, partidas, idsPartida, avance) {
  const semanas = Math.ceil(crono.fin / 7);
  const enRuta = partidas.filter(n => n.item.predecesorId && idsPartida.has(n.item.predecesorId)).length;
  const av = Math.min(100, Math.max(0, avance));

  return el('div', { class: 'grid-kpi' },
    el('div', { class: 'kpi' },
      el('div', { class: 'kpi-etiqueta' }, 'Duración'),
      el('div', { class: 'kpi-valor' }, `${fmtNum(crono.fin, 0)} días`),
      el('div', { class: 'kpi-sub' }, `${semanas} ${semanas === 1 ? 'semana' : 'semanas'} · inicio ${fmtFecha(py.fechaInicio)}`)),
    el('div', { class: 'kpi verde' },
      el('div', { class: 'kpi-etiqueta' }, 'Fecha fin'),
      el('div', { class: 'kpi-valor' }, fmtFecha(crono.finISO)),
      el('div', { class: 'kpi-sub' }, `${partidas.length} ${partidas.length === 1 ? 'partida programada' : 'partidas programadas'}`)),
    el('div', { class: 'kpi violeta' },
      el('div', { class: 'kpi-etiqueta' }, 'Partidas en ruta'),
      el('div', { class: 'kpi-valor' }, fmtNum(enRuta, 0)),
      el('div', { class: 'kpi-sub' }, `de ${partidas.length} con vínculo fin→inicio (FS)`)),
    el('div', { class: 'kpi ambar' },
      el('div', { class: 'kpi-etiqueta' }, 'Avance físico'),
      el('div', { class: 'kpi-valor' }, fmtNum(avance, 1) + ' %'),
      el('div', { class: 'barra', style: { marginTop: '9px' } },
        el('span', { style: { width: av + '%' } })),
      el('div', { class: 'kpi-sub' }, 'ponderado por el parcial de cada partida')));
}

// --- Tabla de programación ---------------------------------------------------
function inputNum(valor, ancho, commit) {
  return el('input', {
    class: 'celda-input', value: String(valor), style: { width: ancho },
    onkeydown: e => { if (e.key === 'Enter') e.target.blur(); },
    onchange: e => {
      const err = commit(parseNum(e.target.value));
      if (err) { toast(err, 'error'); e.target.value = String(valor); }
    },
  });
}

function panelProgramacion(py, plano, partidas, idsPartida, fechas) {
  const filas = plano.map(n => {
    const it = n.item;

    if (it.tipo === 'titulo') {
      return el('tr', { class: 'fila-titulo' + (n.nivel === 1 ? ' nivel-1' : '') },
        el('td', { class: 'cod' }, n.codigo),
        el('td', { colspan: 7 }, el('span', { class: 'descripcion' }, it.descripcion)));
    }

    const f = fechas.get(it.id) || { inicioDias: 0, finDias: 1, inicioISO: py.fechaInicio, finISO: py.fechaInicio };
    const predValido = !!(it.predecesorId && idsPartida.has(it.predecesorId));

    // Inicio en días: editable solo sin predecesor; con predecesor es derivado.
    const celdaInicio = predValido
      ? el('div', { class: 'fila', style: { justifyContent: 'flex-end', gap: '6px' } },
          el('span', { class: 'mono', style: { fontSize: '12.5px' } }, f.inicioDias),
          el('span', { class: 'pill pill-auto', title: 'Calculado a partir del fin del predecesor' }, 'auto'))
      : inputNum(it.inicioDias ?? 0, '62px', v => {
          if (isNaN(v) || v < 0) return 'Inicio inválido: usa días ≥ 0';
          store.update(p => { const x = itemPorId(p, it.id); if (x) x.inicioDias = Math.round(v); });
        });

    const selPred = el('select', {
      style: { width: '100%', minWidth: '190px', fontSize: '12px', padding: '4px 8px' },
      onchange: e => {
        const v = e.target.value || null;
        if (v && creaCiclo(py, it.id, v)) {
          toast('Vínculo circular: esa partida ya depende, directa o indirectamente, de esta', 'error');
          e.target.value = predValido ? it.predecesorId : '';
          return;
        }
        store.update(p => { const x = itemPorId(p, it.id); if (x) x.predecesorId = v; });
      },
    },
      el('option', { value: '', selected: !predValido }, '— ninguno —'),
      partidas.filter(o => o.item.id !== it.id).map(o =>
        el('option', { value: o.item.id, selected: it.predecesorId === o.item.id },
          `${o.codigo} — ${truncar(o.item.descripcion, 34)}`)));

    const av = Math.min(100, Math.max(0, Number(it.avancePct) || 0));
    const celdaAvance = el('div', { class: 'col', style: { alignItems: 'flex-end', gap: '3px' } },
      inputNum(it.avancePct ?? 0, '56px', v => {
        if (isNaN(v) || v < 0 || v > 100) return 'Avance inválido: usa un valor entre 0 y 100';
        store.update(p => { const x = itemPorId(p, it.id); if (x) x.avancePct = v; });
      }),
      el('div', { class: 'barra', style: { width: '70px', height: '5px' }, title: `Avance físico: ${fmtNum(av, 1)} %` },
        el('span', { style: { width: av + '%' } })));

    return el('tr', { class: 'fila-partida' },
      el('td', { class: 'cod' }, n.codigo),
      el('td', {}, el('span', { class: 'descripcion' }, it.descripcion)),
      el('td', { class: 'num' }, celdaInicio),
      el('td', { class: 'num' }, inputNum(it.duracionDias ?? 1, '56px', v => {
        if (isNaN(v) || v < 1) return 'Duración inválida: mínimo 1 día';
        store.update(p => { const x = itemPorId(p, it.id); if (x) x.duracionDias = Math.round(v); });
      })),
      el('td', {}, selPred),
      el('td', { class: 'num texto-2' }, fmtFecha(f.inicioISO)),
      el('td', { class: 'num texto-2' }, fmtFecha(f.finISO)),
      el('td', { class: 'num' }, celdaAvance));
  });

  return el('div', { class: 'panel' },
    el('div', { class: 'panel-cab' },
      el('div', {},
        el('h2', {}, 'Programación por partida'),
        el('div', { class: 'sub' }, 'Vínculo fin→inicio (FS): con predecesor asignado, el inicio se calcula solo y se marca como automático'))),
    el('div', { class: 'envoltorio-tabla' },
      el('table', { class: 'tabla' },
        el('thead', {}, el('tr', {},
          el('th', {}, 'Código'),
          el('th', {}, 'Descripción'),
          el('th', { class: 'num' }, 'Inicio (días)'),
          el('th', { class: 'num' }, 'Duración (días)'),
          el('th', {}, 'Predecesor'),
          el('th', { class: 'num' }, 'Inicio'),
          el('th', { class: 'num' }, 'Fin'),
          el('th', { class: 'num' }, 'Avance %'))),
        el('tbody', {}, filas))));
}

// --- Hitos y camino ----------------------------------------------------------
function panelHitos(partidas, fechas, crono) {
  const top = partidas
    .map(n => ({ n, f: fechas.get(n.item.id) }))
    .filter(x => x.f)
    .sort((a, b) => b.f.finDias - a.f.finDias)
    .slice(0, 5);

  return el('div', { class: 'panel' },
    el('div', { class: 'panel-cab' },
      el('div', {},
        el('h2', {}, 'Hitos y camino'),
        el('div', { class: 'sub' }, 'Las cinco partidas que terminan más tarde: gobiernan la fecha de fin de obra'))),
    el('ol', { class: 'texto-2', style: { margin: '0', paddingLeft: '22px', fontSize: '12.5px', lineHeight: '2' } },
      top.map(({ n, f }) => el('li', {},
        el('span', { class: 'mono texto-3', style: { fontSize: '11.5px' } }, n.codigo),
        ` ${truncar(n.item.descripcion, 80)} — `,
        el('b', {}, fmtFecha(f.finISO)),
        el('span', { class: 'texto-3' }, ` · inicia ${fmtFecha(f.inicioISO)} · ${f.finDias - f.inicioDias} días`),
        f.finDias === crono.fin
          ? el('span', { class: 'pill pill-auto', style: { marginLeft: '8px' } }, 'fin de obra')
          : null))));
}
