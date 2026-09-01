# Contrato para vistas v2 (js/views/*.js)

Cada vista exporta `render(container, params)`. Se re-invoca COMPLETA en cada
cambio de estado y de ruta (no hay virtual DOM). Reglas:

1. Estado de UI (pestañas, filtros, mes seleccionado, colapsados) → variables a
   nivel de módulo, NUNCA en el store.
2. Inputs editables: commit en `change`/`blur`/Enter (nunca `input`), porque tras
   `store.update()` la vista se re-renderiza y el foco se pierde. Excepción:
   dentro de un modal (vive en document.body y no se re-renderiza) sí se puede
   filtrar con `input`.
3. Mutaciones SOLO con `store.update(p => { ...mutar proyecto... })`.
4. Números de usuario: `parseNum()`; si `isNaN` → `toast('...', 'error')` y no mutar.
5. UI en español, profesional y densa. Sin librerías externas; SVG a mano
   (OJO: `el()` crea nodos HTML — para SVG usa un contenedor div con `html:`).
6. APIs nativas del DOM (`replaceChildren`, `append`) NO aplanan arrays: usa
   spread. `el()` sí aplana arrays de hijos.
7. Estados vacíos elegantes con `.vacio` (proyecto sin partidas no rompe nada).
8. JavaScript puro, módulos ES.

## Núcleo (js/core/)

```js
import * as store from '../core/store.js';
// getProyecto(), getEstado(), update(fn), suscribir, undo/redo, setActivo,
// nuevoProyecto, duplicarProyecto, eliminarProyecto, exportJSON, importJSON

import { uid, makeItem, makeRecurso, makeInsumo, TIPOS_INSUMO, UNIDADES } from '../core/model.js';
// Insumo ahora tiene .iu (código de índice unificado INEI, string, ej. '21', '47-1').
// Recurso modo 'directo' tiene .desperdicioPct (cantidad efectiva = cantidad×(1+d/100)).
// Proyecto v2: areaGeo (4=Lima), adelantoDirectoPct, adelantoMaterialesPct,
//   valorizaciones {'YYYY-MM': {avances:{itemId:pctAcum}, amortMateriales, aplicaAdelantoDirecto}},
//   polinomica (null=automática | {monomios:[...], mesBase:'YYYY-MM'}).

import { acuDetalle, puPartida, arbol, arbolPlano, resumen, distribucionPorTipo,
         insumosResumen, cronogramaCalc, fechasEfectivas, avanceProyecto,
         topPartidas, insumoPorId, itemPorId, codigoDeItem } from '../core/calc.js';
// (igual que v1; cronogramaCalc → {fin, finISO, meses, barras, costoDirecto})

import { generarMonomios, polinomicaEfectiva, incidenciasPorIU, coeficienteK,
         serieK, mesBase, validarMonomios } from '../core/polinomica.js';
// generarMonomios(p) → [{nombre, ius:[iu], iusExtra:[iu], iuCalculo, coef, monto, esVarios?}]
// coeficienteK(p, 'YYYY-MM', mesBase?) → {k, detalle:[{nombre, iu, coef, indiceBase,
//   mesIndiceBase, indiceActual, mesIndiceActual, aporte}], mesBase, incompleto}
// validarMonomios(monomios) → [errores string] (vacío = fórmula válida DS 011-79-VC)

import { mesesProyecto, programadoAcumulado, avanceRealAcumulado,
         valorizacionMes, resumenValorizaciones, mesKeyDeISO } from '../core/valorizacion.js';
// valorizacionMes(p, 'YYYY-MM') → {mes, filas:[{nodo, acumAnterior, acumActual,
//   deltaPct, progActual, montoMes, montoAcum}], bruta, k, mesBaseK, kIncompleto,
//   reajuste, amortAD, amortAM, neto, igv, total}
// resumenValorizaciones(p) → {meses:[valorizacionMes + {acumBruta, pctAvance, saldo}], costoDirecto}

import { fmtMoney, fmtNum, parseNum, round2, round4, fmtFecha, fmtMesAnio,
         addDias, diffDias, isoToDate, hoyISO, MESES, MESES_CORTO } from '../core/fmt.js';
```

## Datos de referencia (js/data/)

```js
import { IU_CATALOGO, AREAS_GEO, SERIE_AREA4, METADATA_INDICES,
         serieCompleta, guardarIndicesMes, mesesDisponibles, indiceIU } from '../data/indices.js';
// IU_CATALOGO: {'21': {nombre, confirmar?}, …} — confirmar:true = nombre por verificar.
// serieCompleta() → {'YYYY-MM': {iu: valor}} (seed + ediciones del usuario).
// guardarIndicesMes('2026-07', {'21': 103.1, …}) persiste ediciones locales.
// indiceIU('21', '2026-09') → {mes:'2026-06', valor:102.71} | null (cae al último ≤ mes).

import { RENDIMIENTOS, DESPERDICIOS, DOSIFICACIONES_CONCRETO, MORTEROS,
         ACEROS, ACERO_REGLAS, MUROS_LADRILLO, TARRAJEOS, ESPONJAMIENTO,
         EQUIPOS_PRODUCCION, FLOTA_DEFAULTS, CARGUIO } from '../data/biblioteca.js';
// RENDIMIENTOS: [{grupo, partida, und, rend, cuadrilla:{cap?,op?,of?,pe?}, eq?, nota?}]
// ACEROS: [{diam, kgm, area_cm2, long_com}] · MUROS_LADRILLO: [{tipo, aparejo, und_m2, mortero_m3_m2, espesor_cm}]
// DOSIFICACIONES_CONCRETO: [{clave, nombre, cemento_bol, arena_m3?, piedra_m3?, hormigon_m3?, agua_m3, …}]
// FLOTA_DEFAULTS/CARGUIO: parámetros de la calculadora de eliminación.

import { MARCO_LEGAL, FUENTES_OFICIALES, CHECKLIST_VALORIZACION } from '../data/normativa.js';
// MARCO_LEGAL: [{seccion, items:[{titulo, detalle, ref, verificar?}]}]
```

## UI compartida (js/ui/components.js)

```js
import { el, icono, modal, confirmar, toast, menuContextual, descargar, campo } from '../ui/components.js';
```
Iconos disponibles: dashboard presupuesto acu insumos cronograma reportes mas
menos papelera editar duplicar subir bajar deshacer rehacer exportar importar
cerrar flecha imprimir buscar carpeta alerta check titulo enlace polinomica
programacion valorizacion biblioteca calculadora normativa tema.

## Clases CSS (css/app.css — tema claro por defecto, oscuro con data-theme)

Todas las de v1 siguen vigentes (`.cabecera-vista`, `.panel`, `.grid-kpi`/`.kpi`
(+`.verde .ambar .violeta .rojo`), `.envoltorio-tabla`/`table.tabla` (`.num`,
`.cod`, `.fila-total`), árbol (`.fila-titulo` `.fila-partida` `.seleccionada`
`.btn-expandir`), `.badge-MO|MAT|EQ|SC`, `.barra`, `.barra-apilada`, `.leyenda`,
botones, `.celda-input`, gantt, `.vacio`, `.pill`, `.no-imprimir`). Nuevas:
- `.segmentos` > `.segmento` (+`.activo`) — pestañas/selector segmentado.
- `.badge-iu` — badge monoespaciado para códigos IU.
- `.pill-auto` — pill ámbar para valores calculados automáticamente.
- `.nota` / `.nota-alerta` — cajas informativas.
- `.grid-2-min` — grid responsivo de 2 columnas.

## Rutas

`#/dashboard` `#/presupuesto` `#/acu[/:itemId]` `#/insumos` `#/polinomica`
`#/programacion` `#/gantt` `#/valorizaciones[/:mes]` `#/biblioteca`
`#/calculadoras` `#/normativa` `#/reportes`. (`#/cronograma` redirige a gantt.)

## Convenciones de cálculo

No reimplementar: usar calc/polinomica/valorizacion. PU = round2(Σ ACU);
parcial = round2(metrado×PU); K a 3 decimales; montos a 2 con round2.
