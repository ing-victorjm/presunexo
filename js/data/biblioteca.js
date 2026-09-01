// biblioteca.js — Biblioteca técnica de referencia (edificación urbana, Lima).
// Valores referenciales de uso extendido (CAPECO / expedientes S10 típicos).
// Son PUNTOS DE PARTIDA editables: cada obra debe calibrarlos con sus
// condiciones reales (clima, altura, logística, sindicato, supervisión).

// ---------------------------------------------------------------------------
// RENDIMIENTOS por jornada de 8 h. cuadrilla = {cap, op, of, pe} (capataz,
// operario, oficial, peón); eq = equipos relevantes de la cuadrilla.
// ---------------------------------------------------------------------------
export const RENDIMIENTOS = [
  // --- Obras provisionales y preliminares
  { grupo: 'Preliminares', partida: 'Limpieza de terreno manual', und: 'm2', rend: 40, cuadrilla: { cap: 0.1, pe: 1 } },
  { grupo: 'Preliminares', partida: 'Trazo, niveles y replanteo con equipo', und: 'm2', rend: 500, cuadrilla: { cap: 0.25, op: 1, pe: 2 }, eq: 'Estación total' },
  { grupo: 'Preliminares', partida: 'Demolición de concreto simple c/martillo neumático', und: 'm3', rend: 6, cuadrilla: { cap: 0.1, op: 1, pe: 2 }, eq: 'Compresora + 2 martillos' },
  // --- Movimiento de tierras
  { grupo: 'Mov. de tierras', partida: 'Excavación manual en terreno normal', und: 'm3', rend: 4, cuadrilla: { cap: 0.1, pe: 1 } },
  { grupo: 'Mov. de tierras', partida: 'Excavación manual en terreno semirocoso', und: 'm3', rend: 2.5, cuadrilla: { cap: 0.1, pe: 1 } },
  { grupo: 'Mov. de tierras', partida: 'Excavación de zanja c/retroexcavadora 58 HP, terreno normal', und: 'm3', rend: 200, cuadrilla: { cap: 0.5, pe: 2 }, eq: 'Retroexcavadora' },
  { grupo: 'Mov. de tierras', partida: 'Excavación masiva c/excavadora 115-165 HP', und: 'm3', rend: 480, cuadrilla: { cap: 0.5, pe: 2 }, eq: 'Excavadora s/orugas' },
  { grupo: 'Mov. de tierras', partida: 'Relleno compactado c/material propio (plancha)', und: 'm3', rend: 8, cuadrilla: { cap: 0.1, pe: 2 }, eq: 'Plancha compactadora' },
  { grupo: 'Mov. de tierras', partida: 'Relleno compactado c/material de préstamo (plancha)', und: 'm3', rend: 10, cuadrilla: { cap: 0.1, op: 1, pe: 2 }, eq: 'Plancha compactadora' },
  { grupo: 'Mov. de tierras', partida: 'Nivelación y compactación de subrasante', und: 'm2', rend: 120, cuadrilla: { cap: 0.1, op: 1, pe: 2 }, eq: 'Plancha compactadora' },
  { grupo: 'Mov. de tierras', partida: 'Eliminación c/retro + volquetes 15 m³ (D≤10 km)', und: 'm3', rend: 120, cuadrilla: { pe: 2 }, eq: 'Retro + 2 volquetes' },
  { grupo: 'Mov. de tierras', partida: 'Acarreo interno de material (carretilla, D≤30 m)', und: 'm3', rend: 6, cuadrilla: { pe: 1 } },
  // --- Concreto simple
  { grupo: 'Concreto simple', partida: 'Solado e=0.10 m mezcla 1:12', und: 'm2', rend: 100, cuadrilla: { cap: 0.2, op: 2, of: 1, pe: 6 }, eq: 'Mezcladora' },
  { grupo: 'Concreto simple', partida: 'Cimiento corrido C:H 1:10 + 30% PG', und: 'm3', rend: 25, cuadrilla: { cap: 0.2, op: 2, of: 1, pe: 8 }, eq: 'Mezcladora' },
  { grupo: 'Concreto simple', partida: 'Sobrecimiento C:H 1:8 + 25% PM', und: 'm3', rend: 10, cuadrilla: { cap: 0.2, op: 2, of: 1, pe: 6 }, eq: 'Mezcladora' },
  { grupo: 'Concreto simple', partida: 'Falso piso e=4" mezcla 1:8', und: 'm2', rend: 120, cuadrilla: { cap: 0.2, op: 2, of: 1, pe: 6 }, eq: 'Mezcladora' },
  // --- Concreto armado (vaciado con mezcladora + winche/bomba según elemento)
  { grupo: 'Concreto armado', partida: "Concreto f'c=210 en zapatas", und: 'm3', rend: 25, cuadrilla: { cap: 0.2, op: 2, of: 1, pe: 8 }, eq: 'Mezcladora + vibrador' },
  { grupo: 'Concreto armado', partida: "Concreto f'c=210 en columnas", und: 'm3', rend: 10, cuadrilla: { cap: 0.2, op: 2, of: 1, pe: 8 }, eq: 'Mezcladora + vibrador + winche' },
  { grupo: 'Concreto armado', partida: "Concreto f'c=210 en muros/placas", und: 'm3', rend: 12, cuadrilla: { cap: 0.2, op: 2, of: 1, pe: 8 }, eq: 'Mezcladora + vibrador + winche' },
  { grupo: 'Concreto armado', partida: "Concreto f'c=210 en vigas", und: 'm3', rend: 20, cuadrilla: { cap: 0.2, op: 2, of: 1, pe: 8 }, eq: 'Mezcladora + vibrador + winche' },
  { grupo: 'Concreto armado', partida: "Concreto f'c=210 en losas aligeradas", und: 'm3', rend: 25, cuadrilla: { cap: 0.2, op: 2, of: 1, pe: 8 }, eq: 'Mezcladora + vibrador + winche' },
  { grupo: 'Concreto armado', partida: 'Concreto premezclado en losas (bomba)', und: 'm3', rend: 40, cuadrilla: { cap: 0.2, op: 2, of: 1, pe: 4 }, eq: 'Bomba estacionaria + vibrador' },
  { grupo: 'Concreto armado', partida: 'Escaleras: concreto f\'c=210', und: 'm3', rend: 12, cuadrilla: { cap: 0.2, op: 2, of: 1, pe: 8 }, eq: 'Mezcladora + vibrador' },
  // --- Encofrados
  { grupo: 'Encofrado', partida: 'Encofrado y desencofrado de zapatas', und: 'm2', rend: 14, cuadrilla: { cap: 0.1, op: 1, of: 1 } },
  { grupo: 'Encofrado', partida: 'Encofrado y desencofrado de sobrecimiento', und: 'm2', rend: 14, cuadrilla: { cap: 0.1, op: 1, of: 1 } },
  { grupo: 'Encofrado', partida: 'Encofrado y desencofrado de columnas', und: 'm2', rend: 10, cuadrilla: { cap: 0.1, op: 1, of: 1 } },
  { grupo: 'Encofrado', partida: 'Encofrado y desencofrado de placas', und: 'm2', rend: 12, cuadrilla: { cap: 0.1, op: 1, of: 1 } },
  { grupo: 'Encofrado', partida: 'Encofrado y desencofrado de vigas', und: 'm2', rend: 9, cuadrilla: { cap: 0.1, op: 1, of: 1 } },
  { grupo: 'Encofrado', partida: 'Encofrado y desencofrado de losa aligerada', und: 'm2', rend: 12, cuadrilla: { cap: 0.1, op: 1, of: 1 } },
  { grupo: 'Encofrado', partida: 'Encofrado y desencofrado de escalera', und: 'm2', rend: 6, cuadrilla: { cap: 0.1, op: 1, of: 1 } },
  // --- Acero
  { grupo: 'Acero', partida: 'Acero fy=4200: habilitación y colocación (zapatas/losas)', und: 'kg', rend: 250, cuadrilla: { op: 1, of: 1 } },
  { grupo: 'Acero', partida: 'Acero fy=4200 en columnas y placas', und: 'kg', rend: 220, cuadrilla: { op: 1, of: 1 } },
  { grupo: 'Acero', partida: 'Acero fy=4200 en vigas', und: 'kg', rend: 240, cuadrilla: { op: 1, of: 1 } },
  // --- Albañilería
  { grupo: 'Albañilería', partida: 'Muro de ladrillo KK de soga, mezcla 1:5', und: 'm2', rend: 9.5, cuadrilla: { cap: 0.1, op: 1, pe: 0.5 } },
  { grupo: 'Albañilería', partida: 'Muro de ladrillo KK de cabeza, mezcla 1:5', und: 'm2', rend: 6.5, cuadrilla: { cap: 0.1, op: 1, pe: 0.75 } },
  { grupo: 'Albañilería', partida: 'Muro de ladrillo pandereta de soga', und: 'm2', rend: 12, cuadrilla: { cap: 0.1, op: 1, pe: 0.5 } },
  { grupo: 'Albañilería', partida: 'Colocación de ladrillo hueco 15 cm en losa', und: 'und', rend: 1600, cuadrilla: { op: 1, pe: 9 } },
  // --- Revoques y acabados húmedos
  { grupo: 'Revoques', partida: 'Tarrajeo de muros interiores 1:5, e=1.5 cm', und: 'm2', rend: 20, cuadrilla: { cap: 0.1, op: 1, pe: 0.5 } },
  { grupo: 'Revoques', partida: 'Tarrajeo de muros exteriores (andamio)', und: 'm2', rend: 12, cuadrilla: { cap: 0.1, op: 1, pe: 0.75 } },
  { grupo: 'Revoques', partida: 'Tarrajeo de columnas', und: 'm2', rend: 8, cuadrilla: { cap: 0.1, op: 1, pe: 0.5 } },
  { grupo: 'Revoques', partida: 'Tarrajeo de cielorraso', und: 'm2', rend: 8, cuadrilla: { cap: 0.1, op: 1, pe: 0.75 } },
  { grupo: 'Revoques', partida: 'Contrapiso de 48 mm', und: 'm2', rend: 80, cuadrilla: { cap: 0.2, op: 3, of: 1, pe: 6 }, eq: 'Mezcladora' },
  // --- Pisos y acabados
  { grupo: 'Acabados', partida: 'Piso de cerámico 45×45 (pegamento)', und: 'm2', rend: 12, cuadrilla: { cap: 0.1, op: 1, pe: 0.5 } },
  { grupo: 'Acabados', partida: 'Zócalo de cerámico', und: 'm2', rend: 9, cuadrilla: { cap: 0.1, op: 1, pe: 0.33 } },
  { grupo: 'Acabados', partida: 'Pintura látex 2 manos en muros (incl. imprimante)', und: 'm2', rend: 35, cuadrilla: { cap: 0.1, op: 1, pe: 0.25 } },
  { grupo: 'Acabados', partida: 'Pintura látex en cielorraso', und: 'm2', rend: 30, cuadrilla: { cap: 0.1, op: 1, pe: 0.25 } },
  // --- Instalaciones (referenciales)
  { grupo: 'Instalaciones', partida: 'Salida de agua fría PVC 1/2"', und: 'pto', rend: 4, cuadrilla: { op: 1, pe: 0.5 } },
  { grupo: 'Instalaciones', partida: 'Salida de desagüe PVC 2"-4"', und: 'pto', rend: 4, cuadrilla: { op: 1, pe: 0.5 } },
  { grupo: 'Instalaciones', partida: 'Salida eléctrica de alumbrado/tomacorriente', und: 'pto', rend: 5, cuadrilla: { op: 1, pe: 0.5 } },
];

// ---------------------------------------------------------------------------
// DESPERDICIOS típicos (% sobre cantidad neta calculada).
// ---------------------------------------------------------------------------
export const DESPERDICIOS = [
  { material: 'Concreto vaciado en sitio', pct: 5, nota: 'Hasta 8 % en cimentaciones irregulares' },
  { material: 'Concreto premezclado (bomba)', pct: 3, nota: 'Incluye purga de tubería' },
  { material: 'Mortero para asentado y tarrajeo', pct: 10 },
  { material: 'Acero de refuerzo habilitado', pct: 7, nota: 'Recortes y despuntes; usar 5 % con optimización de corte' },
  { material: 'Alambre negro (amarres)', pct: 8 },
  { material: 'Clavos', pct: 15 },
  { material: 'Madera para encofrado', pct: 12, nota: 'Por número de usos reales (4-6 usos típico)' },
  { material: 'Ladrillo King Kong (muros)', pct: 5 },
  { material: 'Ladrillo pandereta', pct: 7, nota: 'Más frágil al transporte' },
  { material: 'Ladrillo hueco de techo', pct: 3 },
  { material: 'Cemento (rotura y manipuleo de bolsas)', pct: 3 },
  { material: 'Agregado fino (arena)', pct: 15, nota: 'Manipuleo y finos que se pierden' },
  { material: 'Agregado grueso (piedra)', pct: 10 },
  { material: 'Cerámicos y porcelanatos', pct: 5, nota: '10 % en colocación en diagonal' },
  { material: 'Pintura', pct: 10 },
  { material: 'Tubería PVC', pct: 5 },
  { material: 'Cable eléctrico', pct: 5 },
  { material: 'Yeso', pct: 5 },
  { material: 'Drywall (placas)', pct: 10 },
];

// ---------------------------------------------------------------------------
// DOSIFICACIONES de concreto por m³ (materiales netos, sin desperdicio;
// cemento Portland tipo I, agregados de Lima, slump 3"-4").
// ---------------------------------------------------------------------------
export const DOSIFICACIONES_CONCRETO = [
  { clave: 'fc100', nombre: "f'c=100 kg/cm² (calzaduras/rellenos)", cemento_bol: 6.0, arena_m3: 0.57, piedra_m3: 0.60, agua_m3: 0.184 },
  { clave: 'fc140', nombre: "f'c=140 kg/cm²", cemento_bol: 7.01, arena_m3: 0.56, piedra_m3: 0.57, agua_m3: 0.184 },
  { clave: 'fc175', nombre: "f'c=175 kg/cm²", cemento_bol: 8.43, arena_m3: 0.54, piedra_m3: 0.55, agua_m3: 0.185 },
  { clave: 'fc210', nombre: "f'c=210 kg/cm²", cemento_bol: 9.73, arena_m3: 0.52, piedra_m3: 0.53, agua_m3: 0.186 },
  { clave: 'fc245', nombre: "f'c=245 kg/cm²", cemento_bol: 11.50, arena_m3: 0.50, piedra_m3: 0.53, agua_m3: 0.187 },
  { clave: 'fc280', nombre: "f'c=280 kg/cm²", cemento_bol: 13.34, arena_m3: 0.48, piedra_m3: 0.51, agua_m3: 0.189 },
  { clave: 'ciclopeo110', nombre: 'Cimiento corrido C:H 1:10 + 30 % piedra grande', cemento_bol: 2.90, hormigon_m3: 0.83, piedra_grande_m3: 0.42, agua_m3: 0.105 },
  { clave: 'sobrecim18', nombre: 'Sobrecimiento C:H 1:8 + 25 % piedra mediana', cemento_bol: 3.65, hormigon_m3: 0.85, piedra_mediana_m3: 0.35, agua_m3: 0.110 },
  { clave: 'solado112', nombre: 'Solado mezcla 1:12 (por m³)', cemento_bol: 2.73, hormigon_m3: 1.15, agua_m3: 0.100 },
  { clave: 'falsopiso18', nombre: 'Falso piso mezcla 1:8 (por m³)', cemento_bol: 3.91, hormigon_m3: 1.13, agua_m3: 0.108 },
];

// Morteros por m³ (cemento : arena).
export const MORTEROS = [
  { clave: 'm1_3', nombre: 'Mortero 1:3', cemento_bol: 10.40, arena_m3: 1.00, agua_m3: 0.28 },
  { clave: 'm1_4', nombre: 'Mortero 1:4', cemento_bol: 8.66, arena_m3: 1.05, agua_m3: 0.27 },
  { clave: 'm1_5', nombre: 'Mortero 1:5', cemento_bol: 7.40, arena_m3: 1.09, agua_m3: 0.26 },
  { clave: 'm1_6', nombre: 'Mortero 1:6', cemento_bol: 6.38, arena_m3: 1.12, agua_m3: 0.25 },
];

// ---------------------------------------------------------------------------
// ACERO corrugado ASTM A615 G60: pesos y datos para metrar en kg.
// ---------------------------------------------------------------------------
export const ACEROS = [
  { diam: '6 mm', kgm: 0.222, area_cm2: 0.28, long_com: 9 },
  { diam: '8 mm', kgm: 0.395, area_cm2: 0.50, long_com: 9 },
  { diam: '3/8"', kgm: 0.560, area_cm2: 0.71, long_com: 9 },
  { diam: '12 mm', kgm: 0.888, area_cm2: 1.13, long_com: 9 },
  { diam: '1/2"', kgm: 0.994, area_cm2: 1.29, long_com: 9 },
  { diam: '5/8"', kgm: 1.552, area_cm2: 1.99, long_com: 9 },
  { diam: '3/4"', kgm: 2.235, area_cm2: 2.84, long_com: 9 },
  { diam: '1"', kgm: 3.973, area_cm2: 5.10, long_com: 9 },
  { diam: '1 3/8"', kgm: 7.907, area_cm2: 10.06, long_com: 9 },
];
// Regla práctica de traslape (zona no sísmica de anclaje): 40·db en tracción
// clase B ≈ 60·db según E.060; usar 7 % de desperdicio por despuntes.
export const ACERO_REGLAS = {
  traslape_db: 60, gancho_estribo_db: 10, recubrimientos_cm: { zapata: 7.5, columna: 4, viga: 4, losa: 2.5 },
  desperdicio_pct: 7,
};

// ---------------------------------------------------------------------------
// MUROS de ladrillo: unidades y mortero por m² (junta 1.5 cm).
// ---------------------------------------------------------------------------
export const MUROS_LADRILLO = [
  { tipo: 'King Kong 18 huecos (9×13×24)', aparejo: 'Soga', und_m2: 39, mortero_m3_m2: 0.022, espesor_cm: 13 },
  { tipo: 'King Kong 18 huecos (9×13×24)', aparejo: 'Cabeza', und_m2: 71, mortero_m3_m2: 0.058, espesor_cm: 24 },
  { tipo: 'King Kong 18 huecos (9×13×24)', aparejo: 'Canto', und_m2: 29, mortero_m3_m2: 0.013, espesor_cm: 9 },
  { tipo: 'Pandereta rayada (11×10×22)', aparejo: 'Soga', und_m2: 36, mortero_m3_m2: 0.017, espesor_cm: 11 },
  { tipo: 'Bloque de concreto (14×19×39)', aparejo: 'Soga', und_m2: 12.5, mortero_m3_m2: 0.011, espesor_cm: 14 },
  { tipo: 'Ladrillo hueco de techo 15×30×30', aparejo: 'Losa aligerada h=20', und_m2: 8.33, mortero_m3_m2: 0, espesor_cm: 15 },
];

// TARRAJEOS por m²: consumo de materiales (mezcla 1:5 salvo indicación).
export const TARRAJEOS = [
  { nombre: 'Tarrajeo de muros e=1.5 cm', cemento_bol_m2: 0.117, arena_m3_m2: 0.016, agua_m3_m2: 0.004 },
  { nombre: 'Tarrajeo de cielorraso e=1.5 cm', cemento_bol_m2: 0.140, arena_m3_m2: 0.018, agua_m3_m2: 0.005 },
  { nombre: 'Contrapiso e=48 mm (1:5)', cemento_bol_m2: 0.365, arena_m3_m2: 0.049, agua_m3_m2: 0.012 },
  { nombre: 'Asentado + fragua cerámico (pegamento)', pegamento_bol_m2: 0.20, fragua_kg_m2: 0.25 },
];

// ---------------------------------------------------------------------------
// MOVIMIENTO DE TIERRAS: esponjamiento y producción de equipos.
// ---------------------------------------------------------------------------
export const ESPONJAMIENTO = [
  { material: 'Arena seca', pct: 12 },
  { material: 'Tierra vegetal / material suelto', pct: 20 },
  { material: 'Terreno normal (limo-arcilloso)', pct: 25 },
  { material: 'Arcilla compacta', pct: 35 },
  { material: 'Conglomerado / hormigón de río', pct: 30 },
  { material: 'Roca suelta (disparada)', pct: 45 },
  { material: 'Roca fija volada', pct: 60 },
];

export const EQUIPOS_PRODUCCION = [
  { equipo: 'Retroexcavadora 58 HP (0.6 m³)', faena: 'Excavación de zanjas', prod: '25-35 m³/h banco', nota: 'Terreno normal; baja 40 % en semirocoso' },
  { equipo: 'Excavadora 115-165 HP (1.1-1.4 m³)', faena: 'Excavación masiva', prod: '60-90 m³/h banco', nota: 'Con volquetes al pie de talud' },
  { equipo: 'Cargador frontal 125 HP (2.5 m³)', faena: 'Carguío de material suelto', prod: '80-110 m³/h suelto' },
  { equipo: 'Volquete 15 m³', faena: 'Eliminación', prod: 'ver calculadora de flota', nota: 'Capacidad útil ~14 m³ sueltos' },
  { equipo: 'Rodillo liso 7-9 t', faena: 'Compactación de plataformas', prod: '250-350 m³/día', nota: 'Capas de 25 cm' },
  { equipo: 'Plancha compactadora 7 HP', faena: 'Compactación de zanjas', prod: '60-90 m³/día', nota: 'Capas de 15-20 cm' },
  { equipo: 'Mezcladora 9-11 p³', faena: 'Producción de concreto', prod: '10-14 m³/día', nota: 'Con cuadrilla completa' },
  { equipo: 'Bomba estacionaria', faena: 'Vaciado de concreto premezclado', prod: '25-40 m³/h' },
];

// Parámetros por defecto de la calculadora de flota de eliminación.
export const FLOTA_DEFAULTS = {
  capacidad_volquete_m3: 15,        // nominal
  capacidad_util_m3: 14,            // colmada real de material suelto
  velocidad_cargado_kmh: 30,        // vía urbana
  velocidad_vacio_kmh: 40,
  tiempo_descarga_min: 4,           // descarga + maniobras en botadero
  tiempo_acomodo_min: 2,            // posicionamiento bajo el cucharón
  eficiencia_jornada: 0.83,         // 50 min/h efectivos
  jornada_h: 8,
};

// Producción de carguío (m³ sueltos/hora) usada para el tiempo de carga del volquete.
export const CARGUIO = [
  { equipo: 'Retroexcavadora 58 HP', prod_mh: 35 },
  { equipo: 'Excavadora 115 HP', prod_mh: 80 },
  { equipo: 'Cargador frontal 125 HP', prod_mh: 95 },
];
