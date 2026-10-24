# Indice de ADRs - Kanam Sudoku iPhone

<!-- project: github.com/gonzoblasco/kanam-sudoku-iphone -->

Decisiones duraderas del proyecto. Cada ADR tiene 5 secciones: **Contexto**,
**Decision**, **Alternativas consideradas**, **Consecuencias** y
**Reversibilidad**. Los ADRs son **append-only**: una decision que cambia se
registra como un ADR nuevo que **supersede** al anterior, no editando el viejo.

| ADR | Decision | Estado | Fecha |
|---|---|---|---|
| [ADR-0001](ADR-0001-stack-typescript-vite.md) | TypeScript + Vite, con cero dependencias de runtime | Aceptado | 2026-10-24 |
| [ADR-0002](ADR-0002-dificultad-por-tecnica.md) | La dificultad se define por la tecnica de resolucion, no por la cantidad de celdas vacias | Aceptado | 2026-10-24 |
| [ADR-0003](ADR-0003-pwa-manual-sin-plugin.md) | PWA con manifest y service worker escritos a mano, sin plugin de PWA | Aceptado | 2026-10-24 |
| [ADR-0004](ADR-0004-estado-nucleo-extensible.md) | Un unico `GameState` con historial de mutaciones, extensible sin reescribir el nucleo | Aceptado | 2026-10-24 |
| [ADR-0005](ADR-0005-github-pages-base-relativa.md) | GitHub Pages con `base: "./"` y rutas relativas | Aceptado | 2026-10-24 |
| [ADR-0006](ADR-0006-proyecto-desde-cero.md) | Proyecto nuevo desde cero, sin reutilizar el motor de `kanam-sudoku` | Aceptado | 2026-10-24 |
| [ADR-0007](ADR-0007-notas-no-son-jugadas.md) | Las notas por celda no son jugadas: viven fuera del historial de mutaciones | Aceptado | 2026-10-24 |

**Sin superseded.** Los siete ADRs estan vigentes y son consistentes entre si.

## Como se relacionan

- **ADR-0001** (stack) y **ADR-0003** (PWA manual) estan apalados: los dos
  descartan dependencias de runtime. Un plugin de PWA seria una devDependency
  mas; el stack se decide primero.
- **ADR-0006** (proyecto desde cero) es la precondicion de **ADR-0001**: si el
  motor se escribiera desde cero, el stack se elige por lo que el codigo nuevo
  necesita, no por lo que hacia el codigo viejo.
- **ADR-0004** (estado extensible) es la consecuencia deirecta de **ADR-0002**:
  la clasificacion por tecnica necesita un historial de mutaciones, porque medir
  un puzzle es aplicar y revertir deducciones.
- **ADR-0005** (rutas relativas) condiciona a **ADR-0003**: el precache y el
  fallback offline tienen que ser relativos, o el SW no encuentra nada bajo el
  subpath de Pages.
- **ADR-0007** (las notas no son jugadas) es la **primera prueba de ADR-0004**:
  la capacidad entro en la v1 y el nucleo (`core/`, `state/state.ts`) no cambio de
  forma, porque el estado ya tenia `notes` y su API propia. Por eso la promesa de
  ADR-0004 ("deshacer, notas y guardado se agregan sin reescribir el nucleo")
  quedo cumplida, no solo declarada.
