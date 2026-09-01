// polinomica.js — fórmula polinómica según DS 011-79-VC sobre la nueva base
// de Índices Unificados INEI (dic-2025 = 100). Funciones puras.
//   K = Σ [ coef_i × ( I_i(mes) / I_i(base) ) ]
// Reglas: máx. 8 monomios, coeficiente ≥ 0.050, Σ coef = 1.000 (3 decimales).
import { round2 } from './fmt.js';
import { arbolPlano, acuDetalle, resumen } from './calc.js';
import { indiceIU, IU_CATALOGO } from '../data/indices.js';

const COEF_MIN = 0.05;
const MAX_MONOMIOS = 8;

// Monto que aporta cada IU al presupuesto (costo directo por insumo + GGU→39).
// → { porIU: Map iu→monto, base: CD+GG+UT }
export function incidenciasPorIU(proyecto) {
  const porIU = new Map();
  for (const n of arbolPlano(proyecto)) {
    if (n.item.tipo !== 'partida') continue;
    const det = acuDetalle(n.item, proyecto);
    const m = Number(n.item.metrado) || 0;
    for (const f of det.filas) {
      const iu = (f.insumo.iu || '39');
      porIU.set(iu, (porIU.get(iu) || 0) + round2(f.parcial * m));
    }
  }
  const r = resumen(proyecto);
  // Gastos generales y utilidad → monomio GGU con el IPC (IU 39).
  porIU.set('39', (porIU.get('39') || 0) + r.gg + r.utilidad);
  return { porIU, base: r.subtotal, ggu: r.gg + r.utilidad };
}

// Familias de afinidad para absorber IU menores en un monomio compuesto.
const FAMILIA = {
  '02': '03', '46': '03', '51': '03', '85': '03',   // aceros
  '04': '21', '05': '21', '38': '21', '80': '21',   // cemento y agregados
  '30': '21', '81': '21',
  '44': '43', '41': '43', '84': '43',               // maderas
  '16': '17',                                        // bloques/ladrillos
  '34': '49', '53': '49', '01': '49',               // combustibles → maq. pesada
  '37': '48', '83': '48',                            // herramienta/seguridad → maq. liviana
  '47-1': '47',
};

// Genera monomios automáticos: IU con incidencia ≥ 5 % → monomio propio; los
// menores se absorben en el monomio afín (monomio compuesto, máx. 3 IU
// listados) y el remanente en "Varios y GGU" (IU 39). El cálculo del monomio
// usa su IU principal (iuCalculo).
// → [{ nombre, ius:[iu…], iusExtra:[…], iuCalculo, coef, monto }]
export function generarMonomios(proyecto) {
  const { porIU, base } = incidenciasPorIU(proyecto);
  if (base <= 0) return [];

  const entradas = [...porIU.entries()].sort((a, b) => b[1] - a[1]);
  const propios = [];
  const menores = [];
  for (const [iu, monto] of entradas) {
    if (iu !== '39' && monto / base >= COEF_MIN && propios.length < MAX_MONOMIOS - 1) {
      propios.push({ ius: [iu], iusExtra: [], iuCalculo: iu, monto });
    } else if (iu !== '39') {
      menores.push({ iu, monto });
    }
  }
  const varios = { ius: ['39'], iusExtra: [], iuCalculo: '39', monto: porIU.get('39') || 0, esVarios: true };

  for (const men of menores) {
    const objetivo =
      propios.find(p => p.iuCalculo === FAMILIA[men.iu]) ||   // familia directa
      (FAMILIA[men.iu] && propios.find(p => p.ius.includes(FAMILIA[men.iu]))) ||
      varios;
    objetivo.monto += men.monto;
    if (objetivo.ius.length < 3) objetivo.ius.push(men.iu);
    else objetivo.iusExtra.push(men.iu);
  }
  const monomios = [...propios, varios];

  // Coeficientes a 3 decimales con ajuste para que sumen exactamente 1.000.
  let suma = 0;
  for (const m of monomios) {
    m.coef = Math.round(m.monto / base * 1000) / 1000;
    suma = Math.round((suma + m.coef) * 1000) / 1000;
  }
  const mayor = monomios.reduce((a, b) => (a.coef >= b.coef ? a : b));
  mayor.coef = Math.round((mayor.coef + (1 - suma)) * 1000) / 1000;

  for (const m of monomios) {
    m.nombre = m.esVarios
      ? 'Varios y GGU (IPC)'
      : (IU_CATALOGO[m.iuCalculo]?.nombre || `IU ${m.iuCalculo}`);
  }
  return monomios;
}

// Fórmula efectiva: la personalizada del proyecto o la automática.
export function polinomicaEfectiva(proyecto) {
  if (proyecto.polinomica && Array.isArray(proyecto.polinomica.monomios) && proyecto.polinomica.monomios.length) {
    return { monomios: proyecto.polinomica.monomios, personalizada: true };
  }
  return { monomios: generarMonomios(proyecto), personalizada: false };
}

// Mes base de la fórmula: mes del valor referencial (por defecto, el mes
// anterior al inicio de obra; configurable en proyecto.polinomica.mesBase).
export function mesBase(proyecto) {
  if (proyecto.polinomica?.mesBase) return proyecto.polinomica.mesBase;
  const [y, m] = (proyecto.fechaInicio || '2026-01-01').split('-').map(Number);
  const prev = new Date(y, m - 2, 1); // mes anterior al de inicio
  return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
}

// Coeficiente K del mes (3 decimales). → { k, detalle:[…], mesBase, incompleto }
export function coeficienteK(proyecto, mesKey, mesBaseKey = null) {
  const base = mesBaseKey || mesBase(proyecto);
  const { monomios } = polinomicaEfectiva(proyecto);
  let k = 0;
  let incompleto = false;
  const detalle = monomios.map(m => {
    const iu = m.iuCalculo || (m.ius && m.ius[0]) || '39';
    const iAct = indiceIU(iu, mesKey);
    const iBase = indiceIU(iu, base);
    let factor = 1;
    if (iAct && iBase && iBase.valor > 0) factor = iAct.valor / iBase.valor;
    else incompleto = true;
    return {
      nombre: m.nombre, iu, coef: m.coef,
      indiceBase: iBase?.valor ?? null, mesIndiceBase: iBase?.mes ?? null,
      indiceActual: iAct?.valor ?? null, mesIndiceActual: iAct?.mes ?? null,
      aporte: m.coef * factor,
    };
  });
  k = detalle.reduce((s, d) => s + d.aporte, 0);
  return { k: Math.round(k * 1000) / 1000, detalle, mesBase: base, incompleto };
}

// Serie de K para un rango de meses ['YYYY-MM', …].
export function serieK(proyecto, meses) {
  return meses.map(m => ({ mes: m, ...coeficienteK(proyecto, m) }));
}

export function validarMonomios(monomios) {
  const errores = [];
  if (monomios.length > MAX_MONOMIOS) errores.push(`Máximo ${MAX_MONOMIOS} monomios (hay ${monomios.length}).`);
  const suma = Math.round(monomios.reduce((s, m) => s + (Number(m.coef) || 0), 0) * 1000) / 1000;
  if (suma !== 1) errores.push(`Los coeficientes suman ${suma.toFixed(3)}; deben sumar 1.000.`);
  for (const m of monomios) {
    if ((Number(m.coef) || 0) < COEF_MIN) errores.push(`"${m.nombre}": coeficiente ${Number(m.coef).toFixed(3)} < 0.050.`);
    if ((m.ius || []).length > 3) errores.push(`"${m.nombre}": un monomio agrupa como máximo 3 índices.`);
  }
  return errores;
}
