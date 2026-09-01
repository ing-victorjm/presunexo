# Prompt maestro (por si quieres regenerar esta app en otra IA)

> Actúa como arquitecto de software senior especializado en costos y presupuestos
> de construcción (Perú). Construye una aplicación **local** (localhost, sin
> internet, sin backend) llamada PRESUNEXO, inspirada en S10, Delphin Express y
> Presto, con estas capacidades:
>
> 1. **Presupuesto jerárquico**: títulos, partidas y subpartidas con códigos
>    automáticos (01, 01.01, 01.01.01), unidad, metrado, precio unitario y
>    parcial con rollup automático hacia los títulos.
> 2. **ACU (Análisis de Costos Unitarios)** por partida: recursos de mano de
>    obra, materiales, equipos y subcontratos. Mano de obra y equipo calculados
>    con cuadrilla × jornada / rendimiento (convención S10); herramientas
>    menores como % de la mano de obra. PU redondeado a 2 decimales.
> 3. **Catálogo de insumos** con precios centralizados: cambiar un precio
>    recalcula todos los ACU que lo usan; vista de consumo total por insumo.
> 4. **Pie de presupuesto**: costo directo, gastos generales %, utilidad %,
>    IGV 18 %, total. Moneda S/ con formato es-PE.
> 5. **Cronograma Gantt valorizado**: duración y predecesor FS por partida,
>    valorización mensual y curva S acumulada.
> 6. **Reportes imprimibles** (presupuesto, ACU, insumos, cronograma valorizado)
>    y exportación CSV + backup JSON.
>
> Restricciones técnicas: SPA de módulos ES sin build ni dependencias,
> persistencia en localStorage con undo/redo, motor de cálculo en funciones
> puras separadas del DOM, tema oscuro profesional con estilos de impresión en
> claro, datos semilla realistas de un edificio multifamiliar peruano.
> Sé crítico: documenta qué dejas fuera del MVP y por qué.

En este repositorio el prompt ya está ejecutado; ver `ARCHITECTURE.md`.
