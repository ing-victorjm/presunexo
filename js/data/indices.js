// indices.js — Índices Unificados de Precios de la Construcción (INEI).
// Nueva base: DICIEMBRE 2025 = 100, trece áreas geográficas (RJ 016-2026-INEI).
// Valores reales del Área 4 (Lima y Callao) tomados de las RJ publicadas en
// El Peruano. Los meses faltantes se completan con el editor de la app o con
// el script actualizar_indices.py.
//
// Fuentes:
//  - RJ 016-2026-INEI (base dic-2025=100, relación de IU y diccionario)
//  - RJ 112-2026-INEI (marzo 2026)   → El Peruano NL/2507461-1
//  - RJ 171-2026-INEI (junio 2026)   → El Peruano NL/2535771-1

export const AREAS_GEO = {
  1: 'Lambayeque, Piura y Tumbes',
  2: 'Cajamarca y La Libertad',
  3: 'Áncash',
  4: 'Lima y Callao',
  5: 'Ica',
  6: 'Arequipa, Moquegua y Tacna',
  7: 'Amazonas y San Martín',
  8: 'Huánuco, Junín y Pasco',
  9: 'Ayacucho y Huancavelica',
  10: 'Apurímac, Cusco y Madre de Dios',
  11: 'Puno',
  12: 'Loreto',
  13: 'Ucayali',
};

// Relación de Índices Unificados (base dic-2025). Los nombres 01-47 provienen
// de la relación clásica contrastada con la RJ 016-2026; en los códigos nuevos
// o reordenados (marcados confirmar:true) verifica contra el PDF oficial en
// docs/Relacion_Indices_Unificados_2026.pdf antes de usarlos en una fórmula
// polinómica contractual.
export const IU_CATALOGO = {
  '01': { nombre: 'Aceite y lubricante' },
  '02': { nombre: 'Acero de construcción liso' },
  '03': { nombre: 'Acero de construcción corrugado' },
  '04': { nombre: 'Agregado fino' },
  '05': { nombre: 'Agregado grueso' },
  '06': { nombre: 'Alambre y cable tipo TW y THW', confirmar: true },
  '07': { nombre: 'Alambre y cable tipo WP', confirmar: true },
  '08': { nombre: 'Alambre y cable LSOH', confirmar: true },
  '09': { nombre: 'Alcantarilla metálica y guardavía', confirmar: true },
  '10': { nombre: 'Aparato sanitario con grifería' },
  '11': { nombre: 'Artefacto de alumbrado interior' },
  '12': { nombre: 'Artefacto de alumbrado exterior', confirmar: true },
  '13': { nombre: 'Asfalto' },
  '14': { nombre: 'Baldosa acústica y termoacústica', confirmar: true },
  '16': { nombre: 'Bloque y adoquín de concreto', confirmar: true },
  '17': { nombre: 'Bloque y ladrillo de arcilla' },
  '18': { nombre: 'Cable NYY y NKY', confirmar: true },
  '19': { nombre: 'Cable telefónico y de energía', confirmar: true },
  '20': { nombre: 'Cemento asfáltico', confirmar: true },
  '21': { nombre: 'Cemento Portland e hidráulico' },
  '24': { nombre: 'Cerámica esmaltada y porcelanato' },
  '26': { nombre: 'Cerrajería nacional' },
  '27': { nombre: 'Detonante y explosivo', confirmar: true },
  '28': { nombre: 'Drywall y placa de yeso', confirmar: true },
  '30': { nombre: 'Yeso' },
  '31': { nombre: 'Ducto y accesorio eléctrico', confirmar: true },
  '32': { nombre: 'Flete terrestre' },
  '33': { nombre: 'Flete fluvial y aéreo', confirmar: true },
  '34': { nombre: 'Gasolina y gasohol' },
  '37': { nombre: 'Herramienta manual' },
  '38': { nombre: 'Hormigón y afirmado' },
  '39': { nombre: 'Índice de Precios al Consumidor (IPC)' },
  '40': { nombre: 'Loseta y terrazo', confirmar: true },
  '41': { nombre: 'Madera importada para encofrado', confirmar: true },
  '42': { nombre: 'Madera nacional en tiras para piso', confirmar: true },
  '43': { nombre: 'Madera nacional para encofrado y carpintería' },
  '44': { nombre: 'Madera terciada para encofrado' },
  '46': { nombre: 'Malla de acero', confirmar: true },
  '47': { nombre: 'Mano de obra (incluye leyes sociales)' },
  '47-1': { nombre: 'Mano de obra de alta especialización (incluye leyes sociales)' },
  '48': { nombre: 'Maquinaria y equipo de construcción liviano' },
  '49': { nombre: 'Maquinaria y equipo de construcción pesado' },
  '50': { nombre: 'Marco y tapa de fierro', confirmar: true },
  '51': { nombre: 'Perfil de acero al carbono', confirmar: true },
  '52': { nombre: 'Perfil de aluminio', confirmar: true },
  '53': { nombre: 'Petróleo diésel', confirmar: true },
  '54': { nombre: 'Pintura látex' },
  '55': { nombre: 'Pintura anticorrosiva', confirmar: true },
  '56': { nombre: 'Pintura esmalte', confirmar: true },
  '57': { nombre: 'Pintura de tráfico', confirmar: true },
  '59': { nombre: 'Plancha de fibrocemento y yeso', confirmar: true },
  '60': { nombre: 'Plancha galvanizada', confirmar: true },
  '61': { nombre: 'Plancha de poliuretano y termoaislante', confirmar: true },
  '62': { nombre: 'Plancha de zinc', confirmar: true },
  '65': { nombre: 'Poste de concreto y fierro', confirmar: true },
  '66': { nombre: 'Puerta y ventana de aluminio', confirmar: true },
  '68': { nombre: 'Tubería de cobre', confirmar: true },
  '71': { nombre: 'Tubería de fierro fundido y dúctil', confirmar: true },
  '72': { nombre: 'Tubería de PVC para agua' },
  '77': { nombre: 'Válvula de bronce y latón', confirmar: true },
  '78': { nombre: 'Válvula de hierro y acero', confirmar: true },
  '79': { nombre: 'Vidrio nacional', confirmar: true },
  '80': { nombre: 'Concreto premezclado', confirmar: true },
  '81': { nombre: 'Aditivo de concreto y similar' },
  '82': { nombre: 'Alambre y cable de aluminio' },
  '83': { nombre: 'Implemento y accesorio de seguridad' },
  '84': { nombre: 'Madera terciada importada' },
  '85': { nombre: 'Perfil de acero galvanizado' },
  '86': { nombre: 'Pintura esmalte y epóxica' },
  '87': { nombre: 'Plancha con cubierta de aluzinc' },
  '88': { nombre: 'Plancha y cobertura plástica' },
  '89': { nombre: 'IU 89 (ver relación oficial)', confirmar: true },
  '90': { nombre: 'IU 90 (ver relación oficial)', confirmar: true },
  '91': { nombre: 'IU 91 (ver relación oficial)', confirmar: true },
  '93': { nombre: 'IU 93 (ver relación oficial)', confirmar: true },
  '94': { nombre: 'IU 94 (ver relación oficial)', confirmar: true },
  '95': { nombre: 'IU 95 (ver relación oficial)', confirmar: true },
};

// Serie mensual del ÁREA 4 (Lima y Callao). Clave 'YYYY-MM' → { iu: valor }.
// Diciembre 2025 = 100.00 en todos los índices por definición de la base.
export const SERIE_AREA4 = {
  '2025-12': Object.fromEntries(Object.keys(IU_CATALOGO).map(k => [k, 100])),
  '2026-01': {
    '01': 99.32, '02': 99.42, '03': 99.50, '04': 99.92, '06': 101.26,
    '07': 100.67, '08': 101.35, '09': 99.71, '10': 99.91, '11': 99.59,
    '12': 99.82, '13': 100.00, '14': 100.32, '16': 100.00, '17': 100.01,
    '18': 99.64, '19': 100.31, '20': 100.00, '21': 99.99, '24': 99.98,
    '26': 100.01, '27': 98.93, '28': 99.81, '30': 99.67, '32': 100.00,
    '33': 99.68, '34': 99.60, '37': 99.83, '39': 100.10, '40': 99.67,
    '41': 99.90, '42': 99.53, '43': 100.15, '44': 99.82, '46': 99.87,
    '47': 101.35, '47-1': 101.75, '48': 99.82, '49': 101.15, '50': 99.96,
    '51': 99.71, '52': 100.11, '53': 99.32, '54': 100.00, '55': 100.00,
    '56': 99.53, '57': 99.94, '59': 99.81, '60': 100.24, '61': 99.79,
    '62': 99.89, '65': 99.87, '66': 99.77, '68': 100.29, '71': 100.00,
    '72': 99.45, '77': 100.17, '78': 100.04, '79': 100.19, '80': 100.00,
    '81': 100.05, '82': 100.41, '83': 100.00, '84': 99.89, '85': 99.30,
    '86': 99.98, '87': 100.40, '88': 99.32, '89': 99.56, '90': 99.86,
    '91': 100.24, '93': 96.98, '94': 99.97, '95': 100.08,
  },
  '2026-02': {
    '01': 98.81, '02': 97.04, '03': 98.06, '04': 99.62, '06': 104.50,
    '07': 102.54, '08': 103.40, '09': 99.61, '10': 99.94, '11': 98.81,
    '12': 99.83, '13': 100.00, '14': 100.96, '16': 100.12, '17': 99.46,
    '18': 99.94, '19': 102.47, '20': 100.00, '21': 99.96, '24': 99.66,
    '26': 99.78, '27': 98.73, '28': 100.53, '30': 100.50, '32': 100.00,
    '33': 99.68, '34': 103.26, '37': 99.88, '39': 100.79, '40': 99.52,
    '41': 100.21, '42': 98.77, '43': 100.73, '44': 99.91, '46': 99.87,
    '47': 101.35, '47-1': 101.75, '48': 100.21, '49': 101.27, '50': 99.96,
    '51': 98.86, '52': 101.58, '53': 99.25, '54': 99.87, '55': 100.00,
    '56': 98.37, '57': 99.33, '59': 99.93, '60': 100.69, '61': 99.76,
    '62': 99.80, '65': 100.03, '66': 99.76, '68': 102.83, '71': 100.05,
    '72': 99.40, '77': 100.74, '78': 100.44, '79': 100.98, '80': 100.04,
    '81': 101.47, '82': 101.26, '83': 100.00, '84': 99.60, '85': 99.85,
    '86': 99.58, '87': 101.27, '88': 98.89, '89': 98.93, '90': 99.88,
    '91': 100.07, '93': 97.74, '94': 100.86, '95': 100.64,
  },
  '2026-03': {
    '01': 100.79, '02': 95.73, '03': 98.12, '04': 102.23, '05': 101.58,
    '06': 107.24, '07': 109.35, '08': 113.31, '09': 102.21, '10': 99.80,
    '11': 98.31, '12': 100.50, '13': 110.49, '14': 104.11, '16': 100.31,
    '17': 106.38, '18': 101.61, '19': 106.85, '20': 108.32, '21': 100.40,
    '24': 99.60, '26': 99.62, '27': 101.93, '28': 103.16, '30': 104.30,
    '31': 100.17, '32': 105.38, '33': 102.39, '34': 136.74, '37': 100.28,
    '38': 100.56, '39': 103.19, '40': 100.49, '41': 98.73, '42': 98.16,
    '43': 102.01, '44': 100.27, '46': 100.82, '47': 101.35, '47-1': 101.75,
    '48': 102.30, '49': 103.89, '50': 101.95, '51': 99.09, '52': 103.66,
    '53': 131.98, '54': 98.52, '55': 100.00, '56': 100.05, '57': 99.96,
    '59': 101.15, '60': 101.29, '61': 101.81, '62': 100.03, '65': 101.30,
    '66': 101.86, '68': 106.91, '71': 100.10, '72': 105.20, '77': 102.03,
    '78': 101.63, '79': 102.59, '80': 99.96, '81': 102.79, '82': 102.01,
    '83': 100.00, '84': 99.34, '85': 100.31, '86': 96.82, '87': 100.84,
    '88': 102.60, '89': 100.47, '90': 106.69, '91': 102.21, '93': 96.36,
    '94': 101.27, '95': 102.65,
  },
  '2026-04': {
    '01': 104.66, '02': 96.52, '03': 99.02, '04': 105.56, '06': 107.84,
    '07': 116.52, '08': 115.64, '09': 99.53, '10': 99.37, '11': 98.44,
    '12': 100.20, '13': 118.95, '14': 105.12, '16': 100.31, '17': 114.46,
    '18': 102.42, '19': 107.96, '20': 126.09, '21': 101.13, '24': 99.27,
    '26': 99.78, '27': 101.15, '28': 102.20, '30': 105.07, '32': 105.38,
    '33': 102.28, '34': 142.46, '37': 100.83, '39': 103.72, '40': 100.34,
    '41': 99.04, '42': 98.19, '43': 102.96, '44': 100.61, '46': 100.72,
    '47': 101.35, '47-1': 101.75, '48': 102.34, '49': 104.15, '50': 104.74,
    '51': 99.01, '52': 104.02, '53': 151.43, '54': 98.70, '55': 100.36,
    '56': 101.37, '57': 100.82, '59': 101.58, '60': 101.14, '61': 102.49,
    '62': 100.24, '65': 102.18, '66': 105.46, '68': 109.86, '71': 100.10,
    '72': 110.53, '77': 102.89, '78': 102.59, '79': 104.39, '80': 99.98,
    '81': 103.00, '82': 103.58, '83': 100.00, '84': 99.55, '85': 100.63,
    '86': 96.27, '87': 99.94, '88': 103.53, '89': 101.63, '90': 112.72,
    '91': 105.55, '93': 97.41, '94': 101.27, '95': 103.82,
  },
  '2026-05': {
    '01': 106.98, '02': 97.74, '03': 99.79, '04': 107.76, '06': 108.97,
    '07': 118.65, '08': 115.22, '09': 96.72, '10': 98.73, '11': 99.26,
    '12': 100.09, '13': 118.68, '14': 105.30, '16': 100.32, '17': 117.02,
    '18': 102.68, '19': 108.40, '20': 122.51, '21': 101.73, '24': 98.66,
    '26': 99.50, '27': 101.38, '28': 102.17, '30': 105.45, '32': 105.38,
    '33': 104.06, '34': 143.26, '37': 101.11, '39': 103.56, '40': 99.93,
    '41': 99.58, '42': 97.63, '43': 104.27, '44': 101.26, '46': 100.40,
    '47': 101.35, '47-1': 101.75, '48': 101.98, '49': 103.82, '50': 106.64,
    '51': 98.45, '52': 104.36, '53': 149.62, '54': 99.06, '55': 99.78,
    '56': 100.93, '57': 98.94, '59': 102.09, '60': 104.69, '61': 101.92,
    '62': 100.20, '65': 102.14, '66': 110.55, '68': 113.91, '71': 103.09,
    '72': 116.36, '77': 103.00, '78': 104.53, '79': 105.07, '80': 100.12,
    '81': 103.00, '82': 104.91, '83': 100.00, '84': 99.32, '85': 100.49,
    '86': 95.84, '87': 100.14, '88': 103.12, '89': 101.75, '90': 114.68,
    '91': 106.77, '93': 97.10, '94': 101.06, '95': 104.29,
  },
  '2026-06': {
    '01': 109.29, '02': 97.85, '03': 100.03, '04': 108.09, '05': 108.32,
    '06': 110.03, '07': 121.59, '08': 118.14, '09': 95.81, '10': 99.06,
    '11': 99.41, '12': 100.35, '13': 117.78, '14': 105.81, '16': 100.32,
    '17': 119.63, '18': 103.73, '19': 110.23, '20': 120.23, '21': 102.71,
    '24': 98.80, '26': 99.83, '27': 98.63, '28': 102.03, '30': 104.14,
    '31': 107.46, '32': 107.03, '33': 104.67, '34': 133.94, '37': 101.30,
    '38': 106.86, '39': 103.79, '40': 99.76, '41': 99.77, '42': 97.94,
    '43': 105.35, '44': 101.93, '46': 100.10, '47': 101.35, '47-1': 101.75,
    '48': 101.43, '49': 102.96, '50': 105.79, '51': 97.67, '52': 104.36,
    '53': 139.86, '54': 99.13, '55': 99.47, '56': 100.63, '57': 96.94,
    '59': 102.82, '60': 105.89, '61': 99.82, '62': 100.12, '65': 101.86,
    '66': 112.73, '68': 114.75, '71': 103.60, '72': 121.28, '77': 103.19,
    '78': 105.66, '79': 105.86, '80': 100.84, '81': 103.15, '82': 105.76,
    '83': 100.00, '84': 99.11, '85': 100.34, '86': 96.04, '87': 100.11,
    '88': 103.96, '89': 101.70, '90': 120.36, '91': 105.95, '93': 97.44,
    '94': 100.87, '95': 104.18,
  },
};

export const METADATA_INDICES = {
  base: 'Diciembre 2025 = 100',
  areaSerie: 4,
  ultimoPublicado: '2026-06',
  fuentes: [
    { rj: 'RJ 016-2026-INEI', detalle: 'Nueva base dic-2025, relación de IU y diccionario', url: 'https://busquedas.elperuano.pe/dispositivo/NL/2478262-1' },
    { rj: 'RJ 051-2026-INEI', detalle: 'Índices de enero 2026', url: 'https://busquedas.elperuano.pe/dispositivo/NL/2488364-1' },
    { rj: 'RJ 072-2026-INEI', detalle: 'Índices de febrero 2026', url: 'https://busquedas.elperuano.pe/dispositivo/NL/2496946-1' },
    { rj: 'RJ 112-2026-INEI', detalle: 'Índices de marzo 2026', url: 'https://busquedas.elperuano.pe/dispositivo/NL/2507461-1' },
    { rj: 'RJ 125-2026-INEI', detalle: 'Índices de abril 2026', url: 'https://busquedas.elperuano.pe/dispositivo/NL/2516442-1' },
    { rj: 'RJ 149-2026-INEI', detalle: 'Índices de mayo 2026', url: 'https://busquedas.elperuano.pe/dispositivo/NL/2526641-1' },
    { rj: 'RJ 171-2026-INEI', detalle: 'Índices de junio 2026', url: 'https://busquedas.elperuano.pe/dispositivo/NL/2535771-1' },
  ],
  notas: 'Serie completa dic-2025 → jun-2026 extraída de las RJ publicadas en El Peruano (ene/feb/abr/may vía actualizar_indices.py; el IU 05 no se pudo extraer en esos 4 meses y usa el último valor disponible). INEI publica cada mes a mediados del mes siguiente: actualiza con actualizar_indices.py o edita desde Fórmula polinómica → Índices INEI.',
};

// --- Acceso a la serie (con superposiciones guardadas por el usuario) -------

// Los valores editados en la app se guardan en localStorage bajo esta clave y
// tienen prioridad sobre los seed de arriba.
const CLAVE_LOCAL = 'presunexo.indices.v1';

export function serieCompleta() {
  let extra = {};
  try { extra = JSON.parse(localStorage.getItem(CLAVE_LOCAL) || '{}'); } catch { extra = {}; }
  const meses = { ...SERIE_AREA4 };
  for (const [mes, valores] of Object.entries(extra)) {
    meses[mes] = { ...(meses[mes] || {}), ...valores };
  }
  return meses;
}

export function guardarIndicesMes(mesKey, valores) {
  let extra = {};
  try { extra = JSON.parse(localStorage.getItem(CLAVE_LOCAL) || '{}'); } catch { extra = {}; }
  extra[mesKey] = { ...(extra[mesKey] || {}), ...valores };
  localStorage.setItem(CLAVE_LOCAL, JSON.stringify(extra));
}

export function mesesDisponibles() {
  return Object.keys(serieCompleta()).sort();
}

// Valor de un IU en un mes; si no está publicado, cae al último disponible ≤ mes
// (práctica usual: reajuste provisional con el último índice conocido).
export function indiceIU(iu, mesKey) {
  const serie = serieCompleta();
  const meses = Object.keys(serie).sort();
  let mejor = null;
  for (const m of meses) {
    if (m > mesKey) break;
    if (serie[m][iu] != null) mejor = { mes: m, valor: serie[m][iu] };
  }
  return mejor; // null si nunca se publicó
}
