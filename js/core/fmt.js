// fmt.js — formato es-PE, parseo y redondeos. Sin DOM, sin estado.

const nfMoney = new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }
export function round4(n) { return Math.round((n + Number.EPSILON) * 10000) / 10000; }

export function fmtMoney(n) {
  if (n == null || isNaN(n)) return '—';
  return 'S/ ' + nfMoney.format(round2(n));
}

export function fmtNum(n, dec = 2) {
  if (n == null || isNaN(n)) return '—';
  return new Intl.NumberFormat('es-PE', { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(n);
}

// Acepta "1,234.56" y "1234,56"; devuelve NaN si no es número.
export function parseNum(str) {
  if (typeof str === 'number') return str;
  if (str == null) return NaN;
  let s = String(str).trim().replace(/\s|S\/\s?/g, '');
  if (s === '') return NaN;
  if (/,\d{1,2}$/.test(s) && !/\.\d+$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
  else s = s.replace(/,/g, '');
  return Number(s);
}

export const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
export const MESES_CORTO = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

// Fechas como 'YYYY-MM-DD' (siempre local, sin zonas horarias).
export function hoyISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function isoToDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDias(iso, dias) {
  const d = isoToDate(iso);
  d.setDate(d.getDate() + dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function diffDias(isoA, isoB) {
  return Math.round((isoToDate(isoB) - isoToDate(isoA)) / 86400000);
}

export function fmtFecha(iso) {
  if (!iso) return '—';
  const d = isoToDate(iso);
  return `${String(d.getDate()).padStart(2, '0')} ${MESES_CORTO[d.getMonth()]} ${d.getFullYear()}`;
}

export function fmtMesAnio(anio, mesIdx) {
  return `${MESES_CORTO[mesIdx]} ${anio}`;
}
