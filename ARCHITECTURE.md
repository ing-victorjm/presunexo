# PRESUNEXO — Arquitectura

Sistema local de presupuestos de obra (inspirado en S10, Delphin Express, Presto).
SPA estática, sin build, sin dependencias. Se sirve con `python -m http.server`.

## Decisiones críticas

| Decisión | Elección | Por qué (y qué se descartó) |
|---|---|---|
| Stack | HTML + ES Modules + CSS puro | Cero fricción en Windows. Se descartó React/Vite (build) y Express+SQLite (instalación nativa frágil, innecesario monousuario). |
| Persistencia | `localStorage` + export/import JSON | Un presupuesto completo pesa < 2 MB. Se descartó SQLite: sin backend no hay acceso; IndexedDB: complejidad sin beneficio a esta escala. |
| Redondeo | PU = round2(Σ parciales ACU); Parcial = round2(metrado × PU) | Convención S10. El redondeo se hace en el PU, no al final, para que el presupuesto impreso cuadre línea a línea. |
| Cantidad MO/EQ | `cuadrilla × jornada / rendimiento` (4 dec) | Convención S10/CAPECO. Herramientas menores como %MO. |
| Jerarquía | Lista plana con `parentId` + `orden`; códigos (01.02.03) calculados | Mover/insertar items no reescribe códigos a mano. Árbol anidado se descartó: CRUD más frágil. |
| Cronograma | Offset en días + duración + predecesor FS opcional; valorización uniforme por día | CPM completo (holguras, FF/SS) queda fuera del MVP a propósito. |
| Re-render | Vistas stateless re-renderizadas en cada cambio de store; commit de inputs en blur/Enter | Virtual DOM innecesario; la regla de commit evita perder foco al escribir. |

## Estructura

```
presunexo/
  index.html            Shell: sidebar, topbar, contenedor de vista
  css/app.css           Design system (tokens, tabla-árbol, gantt, print)
  js/core/model.js      Entidades, constantes, proyecto semilla realista
  js/core/store.js      Estado, persistencia, pub/sub, undo/redo, import/export
  js/core/calc.js       Motor de cálculo PURO (sin DOM): ACU, rollup, resumen, insumos, cronograma
  js/core/fmt.js        Formato es-PE (S/, números, fechas), parseo, redondeos
  js/ui/components.js   modal, confirmar, toast, menú contextual, el(), iconos SVG
  js/app.js             Router hash, montaje de vistas, atajos, undo/redo UI
  js/views/*.js         dashboard, presupuesto, acu, insumos, cronograma, reportes
```

## Contrato de vistas

Cada vista exporta `render(container, params)` y se re-invoca en cada cambio de
estado o de ruta. Estado de UI (nodos expandidos, mes seleccionado) vive a nivel
de módulo. Mutaciones SOLO vía `store.update(p => { ...mutar proyecto... })`.

## Motor de cálculo (calc.js) — API

- `acuDetalle(partida, proyecto)` → `{ filas, porTipo:{MO,MAT,EQ,SC}, totalMO, pu }`
- `puPartida(partida, proyecto)` → número (2 dec)
- `arbol(proyecto)` → árbol anidado con `codigo`, `nivel`, `parcial`, `hijos`
- `parcialItem(item, proyecto)` → partida: metrado×PU; título: Σ hijos
- `resumen(proyecto)` → `{ costoDirecto, gg, utilidad, subtotal, igv, total }`
- `insumosResumen(proyecto)` → consumo total por insumo + subtotales por tipo
- `cronogramaCalc(proyecto)` → fechas por partida, meses, valorización mensual, curva S
- Sin acceso al DOM ni al store: funciones puras testeables.

## Fuera de alcance (deliberado)

Multiusuario, BD de precios CAPECO integrada, fórmula polinómica completa,
CPM con holguras, exportación XLSX nativa (se exporta CSV/print). Cada uno es
un módulo futuro, no una omisión accidental.
