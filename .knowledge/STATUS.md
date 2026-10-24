# STATUS - Kanam Sudoku iPhone

<!-- project: github.com/gonzoblasco/kanam-sudoku-iphone -->

## Fase actual

**Ciclo de definicion cerrado (2026-10-24).** Proyecto nuevo desde cero, sin
reutilizar codigo de `kanam-sudoku` ni de `kanam-logik`. Repo previsto: publico,
en GitHub Pages.

## Etapas

| Etapa | Estado | Fecha |
|---|---|---|
| Reconocimiento | Completada | 2026-10-24 |
| Discovery | Completada | 2026-10-24 |
| Specs + Knowledge | Completada | 2026-10-24 |
| Diseno (architecture, CONTEXT, data-model, ADRs) | Completada | 2026-10-24 |
| Desarrollo | Pendiente | - |
| Deploy | Pendiente | - |

## Artefactos

| Archivo | Que es |
|---|---|
| `.knowledge/DISCOVERY.md` | problema, usuarios, capacidades, prior art, decisiones |
| `.knowledge/BRIEF.md` | el contrato de una linea del producto, no-objetivos, stack |
| `.knowledge/STATUS.md` | este archivo |
| `.knowledge/KNOWLEDGE.md` | lo que el proyecto sabe y no puede olvidar |
| `.knowledge/specs/SPEC-001..006` | una spec por capacidad core |
| `.knowledge/specs/README.md` | indice + modelo conceptual compartido |
| `docs/architecture.md` | modulos, contratos, alternativas descartadas, trazabilidad, riesgos |
| `docs/CONTEXT.md` | glosario autoritativo con sinonimos rechazados |
| `docs/data-model.md` | contrato del esquema (en memoria + persistido) |
| `docs/adr/ADR-0001..0006` | decisiones duraderas + indice |

## Decisiones

| ID | Decision | Estado |
|---|---|---|
| D1 | Hosting: GitHub Pages desde repo publico | **Cerrada** (Gonzo) |
| D2 | Dificultad: por tecnica de resolucion | **Cerrada** (Gonzo) |
| D3 | Instalacion: PWA completa (manifest + service worker) | **Cerrada** (Gonzo) |
| D4 | Nombre: `kanam-sudoku-iphone` | Asumida (reversible) |
| D5 | Cronometro: si, simple | Asumida (reversible) |
| D6 | Flujo inicial: menu de bienvenida con 3 niveles | Asumida (reversible) |
| D7 | Stack: TypeScript + Vite, cero deps de runtime | Asumida (ADR-0001) |
| D8 | Visibilidad del repo: publica | Cerrada (consecuencia de D1) |

**Ninguna decision de negocio abierta.** Las asumidas (D4-D6) son reversibles
antes del primer push.

## Capacidades

`[core]` C1 generacion · C2 dificultad por tecnica · C3 validacion y conflictos ·
C4 tablero tactil · C5 teclado numerico · C6 menu y victoria · C7 PWA instalable ·
C8 estado extensible (restriccion de forma) · C9 persistencia de partida ·
C10 cronometro.

`[fuera de v1]` C11 hints · C12 notas · C13 deshacer · C14 estadisticas ·
C15 cuentas/backend · C16 variantes · C17 notificaciones.

## Verificacion hasta ahora

- **Spec validation**: las 6 specs pasan el checker del workspace.
  ```bash
  bash ~/.agents/skills/spec-driven-development/scripts/validate-spec.sh \
    ~/projects/kanam-sudoku-iphone/.knowledge/specs
  # -> "Todas las specs pasaron la validación (6 archivos)."  exit 0
  ```
- **Trazabilidad**: cada `C1`..`C17` y cada `SPEC-001`..`006` aparece en la
  tabla de trazabilidad de `docs/architecture.md` (verificado con `grep`, 0
  capacidades huerfanas).
- **Stack verificado en la maquina**: Node 26.8.1 corre TypeScript con type
  stripping nativo; `node --test test/` descubre y corre tests `.ts` sin build
  (verificado en `/tmp/tscheck`: 1 test, 0 fallos).
- **Playwright-core + Chromium headless** disponibles para el e2e
  (`~/Library/Caches/ms-playwright/chromium_headless_shell-1243`).
- **Prior art** inventariado con rutas en `DISCOVERY.md`.

## Que esta bloqueado

- (nada)

## Proximo

1. **Desarrollo** por el pipeline A/B: A escribe (`gpt-oss:120b-cloud`), B
   revisa y corrige (`deepseek-v4.1-flash:cloud`).
2. Gates: `node --test test/` (motor + estado) · `tsc --noEmit` · `npm run build`
   · e2e en Chromium a 390x844 · offline y bajo subpath · contraste AA en ambos
   temas · `axe-core` con 0 violaciones.
3. Crear el repo **publico**, habilitar Pages, verificar en el iPhone.
4. Cerrar la sesion con `HANDOFF.md` y el registro en `MEMORY.md` /
   `CHANGELOG.md` del workspace.

## Deuda

- `ask_user` fallo con payloads de varias preguntas despues de la primera tanda
  (2026-10-24). Las 3 decisiones de la segunda tanda quedaron **asumidas** (D4-D6)
  y esperando confirmacion de Gonzo. Si contesta, se ajustan antes del primer
  push: son reversibles y no tocan la arquitectura.
- El catalogo de tecnicas arranca con el subconjunto que la v1 necesita. Si
  generar "Dificil" resultara demasiado lento o el rating no alcanzara, la via es
  **ampliar el catalogo** (ADR-0002, ADR-0006), no cambiar el criterio de nivel.
- `tsc --noEmit` tiene que entrar en el CI: el type stripping de Node **no**
  verifica tipos, los borra (ADR-0001).
