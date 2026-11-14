# Tabbed layout: Material · Piezas · Resultado

Date: 2026-11-08
Status: approved by the maintainer

## Problem

The page uses a two-column grid (`lg:grid-cols-12`, left `col-span-5` ≈ 500 px inside a
`max-w-7xl` container). The left column holds both the sheet configuration (step 1) and the
piece editor (step 2). The piece editor is an 8-column table (furniture group, piece, length,
width, quantity, rotation, edge banding, actions) plus a quick-add form, and it does not fit:

- the table is clipped on the right and needs horizontal scrolling to reach quantity, rotation,
  banding and delete;
- the quick-add "Añadir" button is cut off;
- the "Regla de Entrepaños" hint takes three permanent lines between the form and the table.

## Goal

Give each task its own full-width space while keeping instant feedback on the optimization
result, for the usual workflow: enter the whole cut list first, then make small adjustments.

## Design

### Structure and navigation

```
Header (unchanged)
Sticky bar:  [1 Material] [2 Piezas] [3 Resultado]        45.1% · 1 lámina · 7/7 ✓
Active tab content, full width
```

- `App.tsx` keeps an `activeTab` state (`'material' | 'pieces' | 'result'`) and replaces the
  two-column grid with the content of the active tab.
- The tab bar sits directly under the header and stays visible on scroll (sticky).
- The right side of the bar shows a live summary: overall efficiency, sheet count and
  placed/requested pieces. When any piece is unplaced the summary turns red and shows a warning
  (e.g. `5/7 ⚠`); clicking it switches to the Resultado tab.
- The app opens on **Piezas**. Loading a furniture preset also switches to **Piezas**.
- The calculation stays automatic (current `useMemo`), so the summary updates on every edit.

### Tab 1 — Material

`SheetConfigPanel` content laid out in a 3-column grid on wide screens:

1. standard formats, sheet length and width;
2. kerf, trim margin, edge banding thickness;
3. grain direction, price per sheet, usable area.

Collapses to one column on narrow screens.

### Tab 2 — Piezas

`PieceListEditor` at full width, all current features kept (CSV paste/import, export, clear,
furniture group filter, color, rotation, edge banding, delete, footer totals):

- quick-add form in a single row: group, name, length, width, quantity, rotation, add button
  fully visible;
- **Enter adds the piece** when the form is valid, then focuses the name field again, keeping
  the selected group and rotation, so a list can be typed without the mouse;
- table shows every column without horizontal scrolling at desktop width;
- furniture group filter shown as small tabs above the table, as today;
- "Regla de Entrepaños" becomes an ⓘ toggle that expands the hint on demand;
- on narrow screens the form wraps to two rows and the table keeps horizontal scrolling as a
  fallback.

Piece logic, CSV import and the paste modal are unchanged.

### Tab 3 — Resultado

Everything currently in the right column, same order, full width: `OptimizerControls`,
`ResultDashboard`, `SheetCanvasView`, `PiecesReportTable`, `Furniture3DViewer`.

## Components

| Unit | Responsibility |
|------|----------------|
| `src/utils/resultSummary.ts` (new) | `summarizeResult(result)`: pure; returns efficiency label, sheet count, placed/requested counts and `hasUnplaced`. |
| `src/components/StepTabs.tsx` (new) | Presentational: renders the three tabs and the summary; props `activeTab`, `onChange`, `summary`. No state. |
| `src/App.tsx` | Owns `activeTab`, switches content, switches to Piezas on preset load. |
| `src/components/PieceListEditor.tsx` | Layout classes for full width, Enter-to-add, collapsible shelf rule. |
| `src/components/SheetConfigPanel.tsx` | 3-column grid layout. |

## Testing

- `summarizeResult` is developed test-first with Vitest: all pieces placed, some unplaced,
  empty result (no pieces), multiple sheets.
- The project has no component test setup; adding one is out of scope. Layout, sticky bar,
  tab switching, preset → Piezas, Enter-to-add and the shelf-rule toggle are verified manually
  in the browser at desktop and mobile widths.
- The existing 59 tests, `tsc --noEmit` and `vite build` must keep passing.

## Out of scope

- Remembering the active tab across reloads.
- Redesigning the 3D viewer.
- Changes to colors or visual style.

## Implementado después del merge (2026-11-14)

Registro de en qué se apartó la implementación de este diseño, para que el documento no contradiga al
código:

- La suite pasó de 59 a 63 pruebas: las 4 nuevas de `summarizeResult`.
- En móvil el formulario rápido se parte en **tres** filas, no dos: los siete controles no caben en dos
  a 390 px sin recortar medidas de cuatro cifras, así que el grupo y el nombre comparten la primera
  fila, largo/ancho/cantidad/giro la segunda, y "Añadir" ocupa el ancho completo en la tercera.
- La cabecera **no** queda fija en móvil: se desplaza y solo la barra de pasos sigue visible, porque el
  bloque fijo completo ocupaba el 34% de la pantalla. Desde `md` se fijan cabecera y pestañas. En
  teléfonos se muestra una versión corta del subtítulo en lugar del texto completo.
- Las pestañas y el resumen comparten **una sola fila** por debajo de `sm`, sin los números de paso.
- La regla de entrepaños permanece en una línea incluso a 360 px: el texto se recorta y "ver detalle"
  queda anclado a la derecha.
- La verificación de maquetación ya no vive fuera del repositorio: `scripts/smoke.mjs` la ejecuta el CI
  en cada push, sin dependencias nuevas, contra el build de producción.
