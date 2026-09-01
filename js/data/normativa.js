// normativa.js — resumen estructurado del marco normativo peruano aplicable a
// presupuestos, valorizaciones y reajustes de obra. Verificado contra fuentes
// oficiales al 31-ago-2026. Los ítems marcados verificar:true deben
// contrastarse con el texto legal antes de usarse en un contrato.

export const MARCO_LEGAL = [
  {
    seccion: 'Contratación pública (obra estatal)',
    items: [
      {
        titulo: 'Ley N° 32069 — Ley General de Contrataciones Públicas',
        detalle: 'Publicada el 24-jun-2024; vigente desde el 22-abr-2025. Deroga la Ley 30225. Rige todo el ciclo: actuaciones preparatorias, selección y ejecución contractual.',
        ref: 'Ley 32069',
      },
      {
        titulo: 'Reglamento — DS 009-2025-EF',
        detalle: 'Publicado el 22-ene-2025. Modificado por DS 001-2026-EF (El Peruano, 08-ene-2026). Desarrolla valorizaciones, adelantos, reajustes, penalidades y recepción de obra.',
        ref: 'DS 009-2025-EF y DS 001-2026-EF',
      },
      {
        titulo: 'Adelanto directo en obras: hasta 10 % del monto contractual',
        detalle: 'El contratista puede solicitar su entrega dentro de los 8 días siguientes al perfeccionamiento del contrato, adjuntando la garantía. El plazo se computa en días calendario (Opinión D000003-2026-OECE-DTN).',
        ref: 'Reglamento, arts. 178-179',
      },
      {
        titulo: 'Adelanto para materiales e insumos: las demás modalidades en conjunto no exceden el 20 %',
        detalle: 'Se entrega de forma progresiva según los porcentajes definidos en las bases y el calendario de adquisición de materiales.',
        ref: 'Reglamento, art. 181',
      },
      {
        titulo: 'Valorizaciones de obra: periodicidad mensual salvo pacto distinto',
        detalle: 'Se elaboran en función de los metrados ejecutados con los precios del presupuesto contratado, más reajuste. El inspector/supervisor y el contratista las formulan y la Entidad paga en los plazos del reglamento; la demora genera intereses legales.',
        ref: 'Reglamento (capítulo de valorizaciones)',
        verificar: true,
      },
      {
        titulo: 'Penalidad por mora',
        detalle: 'Penalidad diaria = 0.10 × monto vigente / (F × plazo vigente en días). Tope usual: 10 % del monto contractual. Verificar el factor F aplicable (según objeto y plazo) en el reglamento vigente.',
        ref: 'Reglamento (penalidades)',
        verificar: true,
      },
    ],
  },
  {
    seccion: 'Reajuste de precios (fórmula polinómica)',
    items: [
      {
        titulo: 'DS 011-79-VC — Sistema de fórmulas polinómicas',
        detalle: 'Máximo 8 monomios por fórmula; cada coeficiente de incidencia ≥ 0.050 (5 %); la suma de coeficientes es 1.000. Un monomio puede agrupar hasta 3 índices unificados (monomio compuesto). Cada obra puede tener hasta 4 fórmulas por tipo de obra (máx. 8 por contrato).',
        ref: 'DS 011-79-VC, arts. 2-4',
      },
      {
        titulo: 'K = Σ [coef × (I_actual / I_base)]',
        detalle: 'El coeficiente de reajuste K se calcula con los Índices Unificados INEI del mes de la valorización (área geográfica de la obra) sobre los del mes del valor referencial. Cuando el índice del mes aún no se publica, se reajusta provisionalmente con el último conocido y se regulariza después.',
        ref: 'DS 011-79-VC, art. 1; práctica OECE',
      },
      {
        titulo: 'Nueva base de índices: diciembre 2025 = 100',
        detalle: 'La RJ 016-2026-INEI fijó nueva base (dic-2025=100), amplió a 13 áreas geográficas y aprobó la nueva Relación de 95 Índices Unificados con su Diccionario de Elementos, de uso obligatorio para elaborar fórmulas polinómicas. Incluye el nuevo IU 47-1 (mano de obra de alta especialización) y separa maquinaria liviana (48) y pesada (49). Lima y Callao = Área 4.',
        ref: 'RJ 016-2026-INEI',
      },
      {
        titulo: 'Publicación mensual de índices',
        detalle: 'El INEI aprueba los IU de cada mes por Resolución Jefatural publicada en El Peruano a mediados del mes siguiente. Último cargado en esta app: junio 2026 (RJ 171-2026-INEI).',
        ref: 'RJ mensuales INEI',
      },
    ],
  },
  {
    seccion: 'Metrados y expediente técnico',
    items: [
      {
        titulo: 'Norma Técnica de Metrados para Obras de Edificación y Habilitaciones Urbanas',
        detalle: 'Estandariza la codificación de partidas (OE.1 obras provisionales, OE.2 estructuras, OE.3 arquitectura, OE.4 IISS, OE.5 IIEE…) y la forma de metrar cada partida: concreto en m³, encofrado en m² de superficie en contacto, acero en kg, muros en m² descontando vanos, tarrajeos en m² de superficie neta.',
        ref: 'RD 073-2010/VIVIENDA/VMCS-DNC',
      },
      {
        titulo: 'Reglamento Nacional de Edificaciones (RNE)',
        detalle: 'Diseño y calidad: E.020 cargas, E.030 sismorresistente (ed. 2026), E.050 suelos, E.060 concreto armado (traslapes, recubrimientos), E.070 albañilería (tipos de unidad, mortero), IS.010 y EM.010 instalaciones.',
        ref: 'RNE',
      },
      {
        titulo: 'Presupuesto de obra pública: estructura',
        detalle: 'Costo directo (partidas con ACU) + gastos generales (fijos y variables desagregados) + utilidad + IGV. Los ACU no incluyen IGV. La fórmula polinómica se formula sobre el monto sin IGV.',
        ref: 'Directivas OECE / práctica de expedientes',
      },
    ],
  },
];

export const FUENTES_OFICIALES = [
  { nombre: 'OECE — Ley 32069 y reglamento compilados', url: 'https://www.gob.pe/institucion/oece/colecciones/45029-ley-n-32069-ley-general-de-contrataciones-publicas-y-su-reglamento' },
  { nombre: 'El Peruano — RJ 016-2026-INEI (nueva base y relación de IU)', url: 'https://busquedas.elperuano.pe/dispositivo/NL/2478262-1' },
  { nombre: 'El Peruano — RJ 171-2026-INEI (índices junio 2026)', url: 'https://busquedas.elperuano.pe/dispositivo/NL/2535771-1' },
  { nombre: 'El Peruano — DS 001-2026-EF (modifica el reglamento)', url: 'https://busquedas.elperuano.pe/dispositivo/NL/2474920-3' },
  { nombre: 'INEI — Índices unificados (informes mensuales)', url: 'https://www.gob.pe/institucion/inei/informes-publicaciones/4025211' },
  { nombre: 'PDF local: Relación de Índices Unificados 2026', url: 'docs/Relacion_Indices_Unificados_2026.pdf' },
];

// Checklist operativo para armar una valorización mensual de obra pública.
export const CHECKLIST_VALORIZACION = [
  'Metrados realmente ejecutados en el período, sustentados con planilla de metrados y protocolos.',
  'Precios unitarios del presupuesto contratado (sin IGV).',
  'Reajuste: K del mes con índices INEI del área geográfica de la obra (provisional si el índice no está publicado).',
  'Amortización del adelanto directo (proporcional a la valorización bruta).',
  'Amortización del adelanto de materiales según fórmula de agotamiento.',
  'Deducción del reajuste que no corresponde por adelantos otorgados.',
  'IGV sobre el neto resultante.',
  'Conformidad del supervisor y remisión a la Entidad dentro del plazo contractual.',
];
