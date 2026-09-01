// valorizacion.js — valorizaciones mensuales de obra con reajuste polinómico
// y amortización de adelantos. Funciones puras sobre el proyecto.
//
// Modelo (transparente y auditable, documentado en la vista):
//   V bruta   = Σ parcial_partida × Δ%avance del mes
//   Reajuste  = V × (K − 1)                       [K del mes, fórmula polinómica]
//   Amort. AD = V × (% adelanto directo / 100)    [proporcional a la valorización]
//   Amort. AM = monto manual del mes              [según agotamiento de materiales]
//   Neto      = V + Reajuste − Amort.AD − Amort.AM
//   IGV       = Neto × IGV%   ·   Total = Neto + IGV
import { round2, isoToDate, addDias } from './fmt.js';
import { arbolPlano, resumen, fechasEfectivas } from './calc.js';
import { coeficienteK } from './polinomica.js';

export function mesKeyDeISO(iso) {
  return iso.slice(0, 7);
}

// Meses calendario que cubre el cronograma. → ['YYYY-MM', …]
export function mesesProyecto(proyecto) {
  const fechas = fechasEfectivas(proyecto);
  let min = null, max = null;
  for (const f of fechas.values()) {
    if (min == null || f.inicioDias < min) min = f.inicioDias;
    if (max == null || f.finDias > max) max = f.finDias;
  }
  if (min == null) return [];
  const salida = [];
  let d = isoToDate(addDias(proyecto.fechaInicio, min));
  const fin = isoToDate(addDias(proyecto.fechaInicio, Math.max(min, max - 1)));
  d = new Date(d.getFullYear(), d.getMonth(), 1);
  while (d <= fin) {
    salida.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    d = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  }
  return salida;
}

// % programado ACUMULADO de cada partida al cierre de un mes (reparto uniforme
// por día calendario dentro de su duración). → Map itemId → pct 0-100
export function programadoAcumulado(proyecto, mesKey) {
  const fechas = fechasEfectivas(proyecto);
  const [y, m] = mesKey.split('-').map(Number);
  const finMes = new Date(y, m, 0); // último día del mes
  const out = new Map();
  for (const [id, f] of fechas.entries()) {
    const ini = isoToDate(f.inicioISO);
    const fin = isoToDate(f.finISO);
    const durDias = Math.max(1, f.finDias - f.inicioDias);
    let pct;
    if (finMes < ini) pct = 0;
    else if (finMes >= fin) pct = 100;
    else pct = Math.min(100, Math.max(0, ((finMes - ini) / 86400000 + 1) / durDias * 100));
    out.set(id, Math.round(pct * 100) / 100);
  }
  return out;
}

// Avance real ACUMULADO al cierre del mes: lo registrado en
// proyecto.valorizaciones[mes].avances o, en su defecto, el programado.
export function avanceRealAcumulado(proyecto, mesKey) {
  const prog = programadoAcumulado(proyecto, mesKey);
  const reg = proyecto.valorizaciones?.[mesKey]?.avances || {};
  const out = new Map();
  for (const [id, pctProg] of prog.entries()) {
    out.set(id, reg[id] != null ? Number(reg[id]) : pctProg);
  }
  return out;
}

function mesAnterior(mesKey) {
  const [y, m] = mesKey.split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// Valorización completa de un mes.
export function valorizacionMes(proyecto, mesKey) {
  const plano = arbolPlano(proyecto).filter(n => n.item.tipo === 'partida');
  const acumAct = avanceRealAcumulado(proyecto, mesKey);
  const acumAnt = avanceRealAcumulado(proyecto, mesAnterior(mesKey));
  const progAct = programadoAcumulado(proyecto, mesKey);
  const cfg = proyecto.valorizaciones?.[mesKey] || {};

  const filas = plano.map(n => {
    const a1 = Math.min(100, Math.max(0, acumAnt.get(n.item.id) ?? 0));
    const a2 = Math.min(100, Math.max(0, acumAct.get(n.item.id) ?? 0));
    const delta = Math.max(0, a2 - a1);
    return {
      nodo: n,
      acumAnterior: a1, acumActual: a2, deltaPct: Math.round(delta * 100) / 100,
      progActual: progAct.get(n.item.id) ?? 0,
      montoMes: round2(n.parcial * delta / 100),
      montoAcum: round2(n.parcial * a2 / 100),
    };
  });

  const bruta = round2(filas.reduce((s, f) => s + f.montoMes, 0));
  const { k, mesBase, incompleto } = coeficienteK(proyecto, mesKey);
  const reajuste = round2(bruta * (k - 1));
  const amortAD = round2(bruta * (Number(proyecto.adelantoDirectoPct) || 0) / 100 *
    (cfg.aplicaAdelantoDirecto === false ? 0 : 1));
  const amortAM = round2(Number(cfg.amortMateriales) || 0);
  const neto = round2(bruta + reajuste - amortAD - amortAM);
  const igv = round2(neto * (Number(proyecto.igvPct) || 0) / 100);

  return {
    mes: mesKey, filas, bruta, k, mesBaseK: mesBase, kIncompleto: incompleto,
    reajuste, amortAD, amortAM, neto, igv, total: round2(neto + igv),
  };
}

// Resumen de todas las valorizaciones del proyecto con acumulados y saldo.
export function resumenValorizaciones(proyecto) {
  const meses = mesesProyecto(proyecto);
  const cd = resumen(proyecto).costoDirecto;
  let acumBruta = 0;
  const lista = meses.map(m => {
    const v = valorizacionMes(proyecto, m);
    acumBruta = round2(acumBruta + v.bruta);
    return {
      ...v,
      acumBruta,
      pctAvance: cd > 0 ? Math.round(acumBruta / cd * 10000) / 100 : 0,
      saldo: round2(cd - acumBruta),
    };
  });
  return { meses: lista, costoDirecto: cd };
}
