// model.js — entidades, constantes y proyecto semilla. Sin DOM, sin estado global.

export const VERSION_ESQUEMA = 1;

export const TIPOS_INSUMO = {
  MO: { clave: 'MO', nombre: 'Mano de obra', color: 'var(--c-mo)' },
  MAT: { clave: 'MAT', nombre: 'Materiales', color: 'var(--c-mat)' },
  EQ: { clave: 'EQ', nombre: 'Equipos', color: 'var(--c-eq)' },
  SC: { clave: 'SC', nombre: 'Subcontratos', color: 'var(--c-sc)' },
};

export const UNIDADES = ['m', 'm2', 'm3', 'kg', 'und', 'glb', 'p2', 'bol', 'gal', 'hh', 'hm', 'est', 'mes', 'vje', '%MO'];

let seq = 0;
export function uid(prefijo = 'id') {
  seq = (seq + 1) % 1e6;
  return `${prefijo}_${Date.now().toString(36)}${seq.toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
}

// iu: código de Índice Unificado INEI (base dic-2025) al que aporta el insumo,
// usado para generar la fórmula polinómica. '39' = IPC (varios).
export function makeInsumo({ id, codigo = '', descripcion, tipo, unidad, precio = 0, iu = '39' }) {
  return { id: id || uid('ins'), codigo, descripcion, tipo, unidad, precio, iu };
}

// modo: 'rendimiento' (MO/EQ: cantidad = cuadrilla*jornada/rendimiento),
//       'directo' (cantidad tal cual), 'pctMO' (parcial = pct% de la MO del ACU)
// desperdicioPct: solo modo 'directo' — la cantidad efectiva es cantidad*(1+d/100).
export function makeRecurso({ id, insumoId, modo = 'directo', cuadrilla = 1, cantidad = 0, pct = 0, desperdicioPct = 0 }) {
  return { id: id || uid('rec'), insumoId, modo, cuadrilla, cantidad, pct, desperdicioPct };
}

export function makeItem({ id, parentId = null, orden = 0, tipo = 'partida', descripcion = '', unidad = 'm2',
  metrado = 0, rendimiento = 1, acu = [], inicioDias = 0, duracionDias = 5, predecesorId = null, avancePct = 0 }) {
  return { id: id || uid('itm'), parentId, orden, tipo, descripcion, unidad, metrado, rendimiento, acu, inicioDias, duracionDias, predecesorId, avancePct };
}

export function nuevoProyecto(nombre = 'Nuevo proyecto') {
  return {
    id: uid('pry'),
    nombre,
    cliente: '',
    ubicacion: '',
    moneda: 'PEN',
    fechaInicio: '2026-09-07',
    jornada: 8,
    ggPct: 10,
    utilidadPct: 8,
    igvPct: 18,
    areaGeo: 4,                 // área geográfica INEI (4 = Lima y Callao)
    adelantoDirectoPct: 10,     // tope Ley 32069 / DS 009-2025-EF art. 179
    adelantoMaterialesPct: 20,  // tope conjunto de otras modalidades
    valorizaciones: {},         // 'YYYY-MM' → { avances: {itemId: pctAcumulado}, notas }
    polinomica: null,           // null = automática; o { monomios:[{nombre, ius:[], coef}] }
    insumos: [],
    items: [],
    creado: new Date().toISOString(),
  };
}

// Migra en sitio un proyecto guardado con un esquema anterior.
export function migrarProyecto(p) {
  if (p.areaGeo == null) p.areaGeo = 4;
  if (p.adelantoDirectoPct == null) p.adelantoDirectoPct = 10;
  if (p.adelantoMaterialesPct == null) p.adelantoMaterialesPct = 20;
  if (!p.valorizaciones) p.valorizaciones = {};
  if (p.polinomica === undefined) p.polinomica = null;
  for (const ins of p.insumos || []) if (!ins.iu) ins.iu = IU_SUGERIDO(ins);
  for (const it of p.items || [])
    for (const r of it.acu || [])
      if (r.desperdicioPct == null) r.desperdicioPct = 0;
  return p;
}

// Heurística de asignación de IU para insumos antiguos sin código.
function IU_SUGERIDO(ins) {
  if (ins.tipo === 'MO') return '47';
  if (ins.tipo === 'EQ') return ins.unidad === '%MO' ? '37' : '48';
  const d = (ins.descripcion || '').toLowerCase();
  if (d.includes('cemento')) return '21';
  if (d.includes('acero') || d.includes('fierro')) return '03';
  if (d.includes('alambre') || d.includes('clavo')) return '02';
  if (d.includes('arena')) return '04';
  if (d.includes('piedra')) return '05';
  if (d.includes('hormig')) return '38';
  if (d.includes('ladrillo') || d.includes('bloque')) return '17';
  if (d.includes('madera')) return '43';
  if (d.includes('yeso')) return '30';
  if (d.includes('gasolina')) return '34';
  if (d.includes('petróleo') || d.includes('diesel') || d.includes('diésel')) return '53';
  return '39';
}

// ---------------------------------------------------------------------------
// Proyecto semilla: casco estructural de un edificio multifamiliar (Lima).
// Precios referenciales 2026; todos editables desde el catálogo de insumos.
// ---------------------------------------------------------------------------
export function proyectoSemilla() {
  const p = nuevoProyecto('Edificio Multifamiliar Los Álamos — Casco Estructural');
  p.cliente = 'Inmobiliaria Nexo SAC';
  p.ubicacion = 'Santiago de Surco, Lima';
  p.ggPct = 10;
  p.utilidadPct = 8;

  const I = (id, codigo, descripcion, tipo, unidad, precio, iu) => {
    const ins = makeInsumo({ id, codigo, descripcion, tipo, unidad, precio, iu });
    p.insumos.push(ins);
    return id;
  };

  // Mano de obra (hh) — IU 47
  I('mo-capataz', '47-001', 'Capataz', 'MO', 'hh', 30.83, '47');
  I('mo-operario', '47-002', 'Operario', 'MO', 'hh', 28.03, '47');
  I('mo-oficial', '47-003', 'Oficial', 'MO', 'hh', 22.16, '47');
  I('mo-peon', '47-004', 'Peón', 'MO', 'hh', 20.03, '47');
  // Materiales
  I('mat-cemento', '21-001', 'Cemento Portland tipo I (42.5 kg)', 'MAT', 'bol', 33.50, '21');
  I('mat-arena-gruesa', '04-001', 'Arena gruesa', 'MAT', 'm3', 65.00, '04');
  I('mat-piedra', '05-001', 'Piedra chancada 1/2"', 'MAT', 'm3', 75.00, '05');
  I('mat-hormigon', '38-001', 'Hormigón', 'MAT', 'm3', 58.00, '38');
  I('mat-agua', '39-001', 'Agua puesta en obra', 'MAT', 'm3', 9.00, '39');
  I('mat-acero', '03-001', 'Acero corrugado fy=4200 kg/cm² G60', 'MAT', 'kg', 4.35, '03');
  I('mat-alambre-16', '02-002', 'Alambre negro N° 16', 'MAT', 'kg', 5.20, '02');
  I('mat-alambre-8', '02-003', 'Alambre negro N° 8', 'MAT', 'kg', 5.20, '02');
  I('mat-clavos', '02-004', 'Clavos para madera c/cabeza 3"', 'MAT', 'kg', 5.50, '02');
  I('mat-madera', '43-001', 'Madera tornillo para encofrado', 'MAT', 'p2', 7.80, '43');
  I('mat-ladrillo-techo', '17-001', 'Ladrillo hueco de arcilla 15×30×30 cm', 'MAT', 'und', 3.20, '17');
  I('mat-yeso', '30-001', 'Yeso en bolsa de 25 kg', 'MAT', 'bol', 12.00, '30');
  I('mat-gigantografia', '39-002', 'Gigantografía impresa 4.80×3.60 m', 'MAT', 'und', 480.00, '39');
  // Equipos — 48 liviano, 49 pesado (nueva relación base dic-2025), 37 herramienta manual
  I('eq-herr', '37-001', 'Herramientas menores', 'EQ', '%MO', 0, '37');
  I('eq-mezcladora', '48-001', 'Mezcladora de concreto 9-11 p³', 'EQ', 'hm', 15.00, '48');
  I('eq-vibrador', '48-002', 'Vibrador de concreto 4 HP', 'EQ', 'hm', 8.50, '48');
  I('eq-plancha', '48-003', 'Plancha compactadora vibratoria 7 HP', 'EQ', 'hm', 20.00, '48');
  I('eq-retro', '49-001', 'Retroexcavadora s/llantas 58 HP', 'EQ', 'hm', 160.00, '49');
  I('eq-volquete', '49-002', 'Camión volquete 15 m³', 'EQ', 'hm', 180.00, '49');
  I('eq-estacion', '49-003', 'Estación total incl. prismas', 'EQ', 'hm', 25.00, '49');

  // Recursos abreviados
  const R = (insumoId, modo, v) => {
    if (modo === 'rendimiento') return makeRecurso({ insumoId, modo, cuadrilla: v });
    if (modo === 'pctMO') return makeRecurso({ insumoId, modo, pct: v });
    return makeRecurso({ insumoId, modo: 'directo', cantidad: v });
  };
  const herr = (pct = 3) => R('eq-herr', 'pctMO', pct);

  let ord = 0;
  const T = (id, parentId, descripcion) =>
    p.items.push(makeItem({ id, parentId, orden: ord++, tipo: 'titulo', descripcion, unidad: '', metrado: 0 }));
  const P = (id, parentId, descripcion, unidad, metrado, rendimiento, acu, crono = {}) =>
    p.items.push(makeItem({ id, parentId, orden: ord++, tipo: 'partida', descripcion, unidad, metrado, rendimiento, acu, ...crono }));

  T('t01', null, 'OBRAS PROVISIONALES Y TRABAJOS PRELIMINARES');
  P('p0101', 't01', 'Cartel de identificación de obra 4.80×3.60 m', 'und', 1, 1, [
    R('mo-operario', 'rendimiento', 1), R('mo-peon', 'rendimiento', 2),
    R('mat-madera', 'directo', 65), R('mat-gigantografia', 'directo', 1), R('mat-clavos', 'directo', 1.2),
    herr(),
  ], { inicioDias: 0, duracionDias: 2 });
  P('p0102', 't01', 'Limpieza de terreno manual', 'm2', 250, 40, [
    R('mo-capataz', 'rendimiento', 0.1), R('mo-peon', 'rendimiento', 1), herr(),
  ], { inicioDias: 0, duracionDias: 5 });
  P('p0103', 't01', 'Trazo, niveles y replanteo', 'm2', 250, 500, [
    R('mo-capataz', 'rendimiento', 0.25), R('mo-operario', 'rendimiento', 1), R('mo-peon', 'rendimiento', 2),
    R('mat-yeso', 'directo', 0.005), R('mat-madera', 'directo', 0.02),
    R('eq-estacion', 'rendimiento', 1), herr(),
  ], { predecesorId: 'p0102', duracionDias: 3 });

  T('t02', null, 'MOVIMIENTO DE TIERRAS');
  P('p0201', 't02', 'Excavación manual de zanjas para zapatas', 'm3', 86.40, 4, [
    R('mo-capataz', 'rendimiento', 0.1), R('mo-peon', 'rendimiento', 1), herr(),
  ], { predecesorId: 'p0103', duracionDias: 12 });
  P('p0202', 't02', 'Relleno compactado con material propio', 'm3', 34.20, 8, [
    R('mo-capataz', 'rendimiento', 0.1), R('mo-peon', 'rendimiento', 2),
    R('mat-agua', 'directo', 0.05), R('eq-plancha', 'rendimiento', 1), herr(),
  ], { predecesorId: 'p040101', duracionDias: 6 });
  P('p0203', 't02', 'Eliminación de material excedente D<10 km', 'm3', 65.30, 120, [
    R('mo-peon', 'rendimiento', 2), R('eq-retro', 'rendimiento', 1), R('eq-volquete', 'rendimiento', 2), herr(),
  ], { predecesorId: 'p0201', duracionDias: 8 });

  T('t03', null, 'OBRAS DE CONCRETO SIMPLE');
  P('p0301', 't03', 'Solado para zapatas e=0.10 m, mezcla 1:12', 'm2', 72.00, 100, [
    R('mo-capataz', 'rendimiento', 0.2), R('mo-operario', 'rendimiento', 2), R('mo-oficial', 'rendimiento', 1), R('mo-peon', 'rendimiento', 6),
    R('mat-cemento', 'directo', 0.30), R('mat-hormigon', 'directo', 0.11), R('mat-agua', 'directo', 0.01),
    R('eq-mezcladora', 'rendimiento', 1), herr(),
  ], { predecesorId: 'p0201', duracionDias: 4 });

  T('t04', null, 'OBRAS DE CONCRETO ARMADO');
  const acuConcreto210 = (rendM3) => [
    R('mo-capataz', 'rendimiento', 0.2), R('mo-operario', 'rendimiento', 2), R('mo-oficial', 'rendimiento', 1), R('mo-peon', 'rendimiento', 8),
    R('mat-cemento', 'directo', 9.73), R('mat-arena-gruesa', 'directo', 0.52), R('mat-piedra', 'directo', 0.53), R('mat-agua', 'directo', 0.186),
    R('eq-mezcladora', 'rendimiento', 1), R('eq-vibrador', 'rendimiento', 1), herr(5),
  ];
  const acuAcero = () => [
    R('mo-operario', 'rendimiento', 1), R('mo-oficial', 'rendimiento', 1),
    R('mat-acero', 'directo', 1.05), R('mat-alambre-16', 'directo', 0.06), herr(),
  ];

  T('t0401', 't04', 'ZAPATAS');
  P('p040102', 't0401', 'Acero de refuerzo fy=4200 kg/cm² en zapatas', 'kg', 2851.20, 250, acuAcero(),
    { predecesorId: 'p0301', duracionDias: 10 });
  P('p040101', 't0401', "Concreto f'c=210 kg/cm² en zapatas", 'm3', 43.20, 25, acuConcreto210(),
    { predecesorId: 'p040102', duracionDias: 6 });

  T('t0402', 't04', 'COLUMNAS');
  P('p040203', 't0402', 'Acero de refuerzo fy=4200 kg/cm² en columnas', 'kg', 4320.00, 250, acuAcero(),
    { predecesorId: 'p040101', duracionDias: 15 });
  P('p040202', 't0402', 'Encofrado y desencofrado normal en columnas', 'm2', 384.00, 10, [
    R('mo-capataz', 'rendimiento', 0.1), R('mo-operario', 'rendimiento', 1), R('mo-oficial', 'rendimiento', 1),
    R('mat-madera', 'directo', 4.07), R('mat-alambre-8', 'directo', 0.30), R('mat-clavos', 'directo', 0.17), herr(),
  ], { predecesorId: 'p040203', duracionDias: 18 });
  P('p040201', 't0402', "Concreto f'c=210 kg/cm² en columnas", 'm3', 28.80, 10, acuConcreto210(),
    { predecesorId: 'p040202', duracionDias: 10 });

  T('t0403', 't04', 'VIGAS');
  P('p040302', 't0403', 'Encofrado y desencofrado normal en vigas', 'm2', 288.00, 9, [
    R('mo-capataz', 'rendimiento', 0.1), R('mo-operario', 'rendimiento', 1), R('mo-oficial', 'rendimiento', 1),
    R('mat-madera', 'directo', 5.15), R('mat-alambre-8', 'directo', 0.10), R('mat-clavos', 'directo', 0.24), herr(),
  ], { predecesorId: 'p040201', duracionDias: 14 });
  P('p040303', 't0403', 'Acero de refuerzo fy=4200 kg/cm² en vigas', 'kg', 3974.40, 250, acuAcero(),
    { predecesorId: 'p040302', duracionDias: 12 });
  P('p040301', 't0403', "Concreto f'c=210 kg/cm² en vigas", 'm3', 34.56, 20, acuConcreto210(),
    { predecesorId: 'p040303', duracionDias: 6 });

  T('t0404', 't04', 'LOSAS ALIGERADAS');
  P('p040402', 't0404', 'Encofrado y desencofrado en losas aligeradas', 'm2', 960.00, 12, [
    R('mo-capataz', 'rendimiento', 0.1), R('mo-operario', 'rendimiento', 1), R('mo-oficial', 'rendimiento', 1),
    R('mat-madera', 'directo', 5.30), R('mat-clavos', 'directo', 0.11), herr(),
  ], { predecesorId: 'p040201', duracionDias: 20 });
  P('p040403', 't0404', 'Ladrillo hueco de arcilla 15×30×30 cm en losa', 'und', 8000, 1600, [
    R('mo-operario', 'rendimiento', 1), R('mo-peon', 'rendimiento', 9),
    R('mat-ladrillo-techo', 'directo', 1.05), herr(),
  ], { predecesorId: 'p040402', duracionDias: 8 });
  P('p040404', 't0404', 'Acero de refuerzo fy=4200 kg/cm² en losas', 'kg', 4800.00, 250, acuAcero(),
    { predecesorId: 'p040403', duracionDias: 8 });
  P('p040401', 't0404', "Concreto f'c=210 kg/cm² en losas aligeradas", 'm3', 96.00, 25, acuConcreto210(),
    { predecesorId: 'p040404', duracionDias: 6 });

  return p;
}
