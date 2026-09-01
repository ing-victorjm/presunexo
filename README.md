# PRESUNEXO v2

Sistema local de **costos, presupuestos y valorizaciones de obra** (Perú),
inspirado en S10, Delphin Express y Presto. Funciona 100 % en tu máquina.

## Cómo iniciar

**Doble clic en `INICIAR.bat`**, o por terminal:

```bash
python -m http.server 8765 --directory "C:\Users\ingvi\Proyectos\presunexo"
```

y abre <http://localhost:8765>. Sin dependencias ni `npm install`.

## Módulos

| Módulo | Qué hace |
|---|---|
| **Panel general** | KPIs, K vigente, distribución MO/MAT/EQ/SC, curva S, incidencias, estado del sistema. |
| **Hoja de presupuesto** | Jerarquía títulos→partidas→subpartidas, códigos automáticos, metrados en línea, rollup, pie con GG/utilidad/IGV. |
| **Análisis (ACU)** | Cuadrilla × jornada / rendimiento (convención S10), herramientas %MO, **desperdicio % por material**, IU por insumo, dosificador de concreto. |
| **Insumos** | Catálogo central de precios con **índice unificado INEI** por insumo, consumo total e incidencia. |
| **Fórmula polinómica** | Monomios automáticos desde el presupuesto (DS 011-79-VC: ≤8 monomios, coef ≥0.05, Σ=1.000), K mensual con **índices INEI reales base dic-2025** (13 áreas), gestor y actualizador de índices. |
| **Programación** | Tabla de programación con dependencias FS, fechas calculadas y avance físico. |
| **Diagrama de Gantt** | Gantt SVG con meses/semanas, flechas de dependencia, avance, línea de hoy y valorización mensual. |
| **Valorizaciones** | Valorización mensual por partida (programado vs real), **reajuste K**, amortización de adelantos (Ley 32069: 10 % directo / 20 % materiales), neto + IGV, resumen acumulado. |
| **Biblioteca técnica** | Rendimientos con cuadrillas, % de desperdicio, dosificaciones por f'c, morteros, acero kg/m, ladrillos por m², tarrajeos, esponjamiento, producción de equipos. |
| **Calculadoras** | Acero→kg (con traslapes), muros de ladrillo, tarrajeo, concreto por dosificación, **flota de volquetes** (ciclos por km, viajes, N° volquetes, días). Envían el metrado a la partida. |
| **Normativa** | Ley 32069 + DS 009-2025-EF (adelantos, valorizaciones), DS 011-79-VC, norma de metrados, RNE — con fuentes oficiales. |
| **Reportes y memoria** | Memoria resumen ejecutiva, presupuesto, ACU completo, insumos, fórmula polinómica, cronograma valorizado — imprimibles y CSV. |

Extras: **buscador global Ctrl+K** (partidas, insumos, índices INEI, rendimientos,
normas), tema claro/oscuro, deshacer/rehacer, export/import JSON.

## Índices INEI reales incluidos

Serie del **Área 4 (Lima y Callao), base diciembre 2025 = 100**: dic-2025,
marzo-2026 (RJ 112-2026) y junio-2026 (RJ 171-2026), tomados de El Peruano.
Para actualizar cuando INEI publique un nuevo mes:

```bash
python actualizar_indices.py --mes 2026-07 --url https://busquedas.elperuano.pe/dispositivo/NL/XXXXXXX-1
```

y luego importa el JSON en *Fórmula polinómica → Índices INEI*. También puedes
editar valores a mano en esa misma pantalla. El PDF oficial de la relación de
índices está en `docs/Relacion_Indices_Unificados_2026.pdf`.

## Datos y respaldos

Todo se guarda en el `localStorage` del navegador. Exporta respaldos JSON desde
la barra superior. `Ctrl+Z`/`Ctrl+Y` para deshacer/rehacer.

## Advertencia de uso

Rendimientos, desperdicios, dosificaciones y precios semilla son referenciales
(Lima 2026): calíbralos con tu obra. La síntesis normativa es orientación
técnica, no asesoría legal. Arquitectura: [ARCHITECTURE.md](ARCHITECTURE.md).
