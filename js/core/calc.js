// calc.js — motor de cálculo PURO (sin DOM, sin store). Convenciones S10:
//   cantidad MO/EQ = cuadrilla × jornada / rendimiento   (4 decimales)
//   parcial recurso = round2(cantidad × precio)
//   PU partida      = round2(Σ parciales)
//   parcial partida = round2(metrado × PU)
import { round2, round4, addDias, isoToDate, diffDias } from './fmt.js';

export function insumoPorId(proyecto, id) {
  return proyecto.insumos.find(i => i.id === id) || null;
}

export function itemPorId(proyecto, id) {
  return proyecto.items.find(i => i.id === id) || null;
}

// Cantidad de un recurso del ACU según su modo de cálculo.
export function cantidadRecurso(rec, partida, proyecto) {
  if (rec.modo === 'rendimiento') {
    const rend = Number(partida.rendimiento) || 0;
    if (rend <= 0) return 0;
    return round4((Number(rec.cuadrilla) || 0) * (proyecto.jornada || 8) / rend);
  }
  if (rec.modo === 'pctMO') return Number(rec.pct) || 0; // se muestra como cantidad "%"
  // modo 'directo': cantidad neta × (1 + desperdicio%)
  const desp = 1 + (Number(rec.desperdicioPct) || 0) / 100;
  return round4((Number(rec.cantidad) || 0) * desp);
}

// Detalle completo del ACU de una partida.
// → { filas:[{recurso, insumo, cantidad, precio, parcial}], porTipo, totalMO, pu }
export function acuDetalle(partida, proyecto) {
  const filas = [];
  const porTipo = { MO: 0, MAT: 0, EQ: 0, SC: 0 };
  let totalMO = 0;

  // 1ª pasada: todo menos %MO (necesita el total de mano de obra)
  for (const rec of partida.acu || []) {
    const insumo = insumoPorId(proyecto, rec.insumoId);
    if (!insumo || rec.modo === 'pctMO') continue;
    const cantidad = cantidadRecurso(rec, partida, proyecto);
    const parcial = round2(cantidad * (Number(insumo.precio) || 0));
    filas.push({ recurso: rec, insumo, cantidad, precio: Number(insumo.precio) || 0, parcial });
    porTipo[insumo.tipo] = round2((porTipo[insumo.tipo] || 0) + parcial);
    if (insumo.tipo === 'MO') totalMO = round2(totalMO + parcial);
  }
  // 2ª pasada: recursos %MO (herramientas menores)
  for (const rec of partida.acu || []) {
    const insumo = insumoPorId(proyecto, rec.insumoId);
    if (!insumo || rec.modo !== 'pctMO') continue;
    const pct = Number(rec.pct) || 0;
    const parcial = round2(pct / 100 * totalMO);
    filas.push({ recurso: rec, insumo, cantidad: pct, precio: totalMO, parcial, esPctMO: true });
    porTipo[insumo.tipo] = round2((porTipo[insumo.tipo] || 0) + parcial);
  }
  const pu = round2(filas.reduce((s, f) => s + f.parcial, 0));
  return { filas, porTipo, totalMO, pu };
}

export function puPartida(partida, proyecto) {
  return acuDetalle(partida, proyecto).pu;
}

// Árbol anidado con códigos jerárquicos, nivel y parciales acumulados.
// → [{ item, codigo, nivel, parcial, pu, hijos:[...] }]
export function arbol(proyecto) {
  const porPadre = new Map();
  for (const it of proyecto.items) {
    const k = it.parentId || null;
    if (!porPadre.has(k)) porPadre.set(k, []);
    porPadre.get(k).push(it);
  }
  for (const lista of porPadre.values()) lista.sort((a, b) => a.orden - b.orden);

  const construir = (parentId, prefijo, nivel) => {
    const hijos = porPadre.get(parentId) || [];
    return hijos.map((item, idx) => {
      const codigo = prefijo ? `${prefijo}.${String(idx + 1).padStart(2, '0')}` : String(idx + 1).padStart(2, '0');
      const nodo = { item, codigo, nivel, hijos: construir(item.id, codigo, nivel + 1) };
      if (item.tipo === 'partida') {
        nodo.pu = puPartida(item, proyecto);
        nodo.parcial = round2((Number(item.metrado) || 0) * nodo.pu);
      } else {
        nodo.pu = null;
        nodo.parcial = round2(nodo.hijos.reduce((s, h) => s + h.parcial, 0));
      }
      return nodo;
    });
  };
  return construir(null, '', 1);
}

// Recorre el árbol en orden (depth-first) → lista plana de nodos.
export function arbolPlano(proyecto) {
  const salida = [];
  const visitar = nodos => nodos.forEach(n => { salida.push(n); visitar(n.hijos); });
  visitar(arbol(proyecto));
  return salida;
}

export function codigoDeItem(proyecto, itemId) {
  const n = arbolPlano(proyecto).find(n => n.item.id === itemId);
  return n ? n.codigo : '';
}

export function parcialItem(item, proyecto) {
  const n = arbolPlano(proyecto).find(n => n.item.id === item.id);
  return n ? n.parcial : 0;
}

// Pie de presupuesto.
export function resumen(proyecto) {
  const costoDirecto = round2(arbol(proyecto).reduce((s, n) => s + n.parcial, 0));
  const gg = round2(costoDirecto * (Number(proyecto.ggPct) || 0) / 100);
  const utilidad = round2(costoDirecto * (Number(proyecto.utilidadPct) || 0) / 100);
  const subtotal = round2(costoDirecto + gg + utilidad);
  const igv = round2(subtotal * (Number(proyecto.igvPct) || 0) / 100);
  const total = round2(subtotal + igv);
  return { costoDirecto, gg, utilidad, subtotal, igv, total };
}

// Distribución del costo directo por tipo de recurso (MO/MAT/EQ/SC).
export function distribucionPorTipo(proyecto) {
  const tot = { MO: 0, MAT: 0, EQ: 0, SC: 0 };
  for (const n of arbolPlano(proyecto)) {
    if (n.item.tipo !== 'partida') continue;
    const det = acuDetalle(n.item, proyecto);
    const m = Number(n.item.metrado) || 0;
    for (const t of Object.keys(tot)) tot[t] = round2(tot[t] + round2(det.porTipo[t] * m));
  }
  return tot;
}

// Consumo total por insumo en todo el presupuesto.
// → [{ insumo, cantidad, parcial, partidas:[{codigo, descripcion, cantidad}] }] ordenado por parcial desc.
export function insumosResumen(proyecto) {
  const acum = new Map();
  for (const n of arbolPlano(proyecto)) {
    if (n.item.tipo !== 'partida') continue;
    const det = acuDetalle(n.item, proyecto);
    const m = Number(n.item.metrado) || 0;
    for (const f of det.filas) {
      if (!acum.has(f.insumo.id)) acum.set(f.insumo.id, { insumo: f.insumo, cantidad: 0, parcial: 0, partidas: [] });
      const a = acum.get(f.insumo.id);
      if (f.esPctMO) {
        a.parcial = round2(a.parcial + round2(f.parcial * m));
        a.cantidad = null; // %MO no acumula cantidad física
      } else {
        a.cantidad = round4((a.cantidad || 0) + f.cantidad * m);
        a.parcial = round2(a.parcial + round2(f.parcial * m));
      }
      a.partidas.push({ codigo: n.codigo, descripcion: n.item.descripcion, cantidad: f.esPctMO ? null : round4(f.cantidad * m) });
    }
  }
  return [...acum.values()].sort((a, b) => b.parcial - a.parcial);
}

// ---------------------------------------------------------------------------
// Cronograma: fechas efectivas (predecesor FS con guardas de ciclo) y
// valorización mensual con curva S.
// ---------------------------------------------------------------------------

// → Map itemId → { inicioDias, finDias, inicioISO, finISO }
export function fechasEfectivas(proyecto) {
  const partidas = proyecto.items.filter(i => i.tipo === 'partida');
  const porId = new Map(partidas.map(i => [i.id, i]));
  const memo = new Map();
  const enCurso = new Set();

  const inicioDe = (item) => {
    if (memo.has(item.id)) return memo.get(item.id);
    if (enCurso.has(item.id)) return { inicio: Number(item.inicioDias) || 0 }; // ciclo → cae al offset manual
    enCurso.add(item.id);
    let inicio;
    const pred = item.predecesorId ? porId.get(item.predecesorId) : null;
    if (pred) inicio = inicioDe(pred).inicio + Math.max(1, Number(pred.duracionDias) || 1);
    else inicio = Number(item.inicioDias) || 0;
    enCurso.delete(item.id);
    const r = { inicio };
    memo.set(item.id, r);
    return r;
  };

  const salida = new Map();
  for (const it of partidas) {
    const inicio = inicioDe(it).inicio;
    const dur = Math.max(1, Number(it.duracionDias) || 1);
    salida.set(it.id, {
      inicioDias: inicio,
      finDias: inicio + dur,
      inicioISO: addDias(proyecto.fechaInicio, inicio),
      finISO: addDias(proyecto.fechaInicio, inicio + dur - 1),
    });
  }
  return salida;
}

// → { fin: díasTotales, finISO, meses:[{anio, mes, monto, acumulado, pctAcum}], barras }
export function cronogramaCalc(proyecto) {
  const fechas = fechasEfectivas(proyecto);
  const plano = arbolPlano(proyecto);
  const barras = [];
  let finProyecto = 0;

  for (const n of plano) {
    if (n.item.tipo !== 'partida') continue;
    const f = fechas.get(n.item.id);
    if (!f) continue;
    finProyecto = Math.max(finProyecto, f.finDias);
    barras.push({ nodo: n, ...f, montoPorDia: n.parcial / Math.max(1, f.finDias - f.inicioDias) });
  }

  // Valorización mensual: reparto uniforme por día calendario.
  const mesesMap = new Map(); // 'YYYY-MM' → monto
  for (const b of barras) {
    for (let d = b.inicioDias; d < b.finDias; d++) {
      const fecha = isoToDate(addDias(proyecto.fechaInicio, d));
      const k = `${fecha.getFullYear()}-${String(fecha.getMonth()).padStart(2, '0')}`;
      mesesMap.set(k, (mesesMap.get(k) || 0) + b.montoPorDia);
    }
  }
  const claves = [...mesesMap.keys()].sort();
  const costoDirecto = resumen(proyecto).costoDirecto;
  let acumulado = 0;
  const meses = claves.map(k => {
    const [anio, mes] = k.split('-').map(Number);
    const monto = round2(mesesMap.get(k));
    acumulado = round2(acumulado + monto);
    return { anio, mes, monto, acumulado, pctAcum: costoDirecto > 0 ? round2(acumulado / costoDirecto * 100) : 0 };
  });

  return { fin: finProyecto, finISO: addDias(proyecto.fechaInicio, Math.max(0, finProyecto - 1)), meses, barras, costoDirecto };
}

// Avance ponderado del proyecto (según avancePct manual de cada partida).
export function avanceProyecto(proyecto) {
  const plano = arbolPlano(proyecto).filter(n => n.item.tipo === 'partida');
  const cd = plano.reduce((s, n) => s + n.parcial, 0);
  if (cd <= 0) return 0;
  return round2(plano.reduce((s, n) => s + n.parcial * (Number(n.item.avancePct) || 0) / 100, 0) / cd * 100);
}

export function topPartidas(proyecto, cant = 8) {
  return arbolPlano(proyecto)
    .filter(n => n.item.tipo === 'partida')
    .sort((a, b) => b.parcial - a.parcial)
    .slice(0, cant);
}
