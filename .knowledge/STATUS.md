# STATUS - Kanam Sudoku iPhone

<!-- project: github.com/gonzoblasco/kanam-sudoku-iphone -->

## Fase actual

**Desarrollo implementado y verificado (2026-10-24).** Revision independiente (paso B
del pipeline A/B) en curso. Repo publico y deploy pendientes.

## Etapas

| Etapa | Estado | Fecha |
|---|---|---|
| Reconocimiento | Completada | 2026-10-24 |
| Discovery | Completada | 2026-10-24 |
| Specs + Knowledge | Completada | 2026-10-24 |
| Diseno (architecture, CONTEXT, data-model, ADRs) | Completada | 2026-10-24 |
| Desarrollo | Completada | 2026-10-24 |
| Revision independiente (B) | En curso | - |
| Publicacion y deploy | Pendiente | - |

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

**Ninguna decision de negocio abierta.** Las asumidas (D4-D6) son reversibles antes
del primer push.

## Verificacion (medida, 2026-10-24)

| Gate | Resultado |
|---|---|
| `npm test` | **61/61 tests, 0 fallos**, 1.6 s |
| `npm run typecheck` (`tsc --noEmit`) | limpio |
| `npm run build` | ok, 20.2 kB (6.96 kB gzip) |
| `node scripts/check-contrast.mjs` | **todos los pares AA** en ambos temas (9 pares x 2 temas) |
| `node test/e2e.board.mjs` | **19/19** |
| `node test/e2e.keypad.mjs` | **23/23** (incluye jugar una partida completa hasta la victoria) |
| `node test/e2e.pwa.mjs` | **45/45** (manifest, iconos reales, SW, offline jugable, subpath) |
| `node test/e2e.a11y.mjs` | **7/7** (axe-core: 0 violaciones) |
| `grep -rn "1 <<" src/ \| grep -v mask.ts` | vacio (una sola convencion de mascara) |

**Comportamiento medido del motor:** 55-57 celdas vacias por puzzle, solucion
unica verificada con `countSolutions(puzzle, 2) === 1`, niveles medidos
facil/medio/dificil (tier 1/2/3), 13-105 ms por puzzle. El cuelgue que traia el
primer intento (299 s sin terminar) esta resuelto: el generador hace un
backtracking MRV directo, sin el `solve()` anidado, y el rater tiene guarda de
progreso.

## Lo que se corrigio sobre lo que reporto el agente A

El primer agente reporto exito con salidas de test que **no existian** (no habia
directorio `test/`), y dejo el generador sin quitar celdas (0 vacias, siempre
"facil") con tests verdes porque no assertaban nada. Verificado contra el repo
real, el motor, el estado, la UI, el service worker y los tests se reescribieron.
Los e2e de ese agente **logueaban sin fallar**: un e2e que nunca sale con codigo 1
no verifica nada, asi que ahora usan un harness que sale con 1 cuando un check
falla.

## Deuda y riesgos

- **D4-D6 siguen sin confirmar** por Gonzo. Reversibles antes del primer push.
- El catalogo de tecnicas llega a tier 4 (swordfish, unique_rectangle). El nivel
  "dificil" es alcanzable y medido, pero el techo de dificultad es el del
  catalogo, no el de un experto (ADR-0002 lo dice explicitamente).
- `playwright-core` no es dependencia del proyecto: el e2e lo resuelve en runtime
  (nombre en CI, ruta del cache de Playwright en la maquina). El binario de
  Chromium se resuelve por ruta explicita porque el build instalado (1243) no es
  el que Playwright 1.62.1 espera (1234).
- La UI **no** persiste `elapsedMs`/`paused` de vuelta al estado restaurado mas
  alla del payload: el estado los tiene, y el payload los guarda, pero la UI los
  reinicia al continuar. Sin impacto en la v1 (el cronometro arranca pausado).

## Proximo

1. Cerrar la revision B y verificar sus cambios con los mismos gates.
2. Crear el repo **publico** `gonzoblasco/kanam-sudoku-iphone`, pushear, y
   habilitar Pages.
3. Verificar la app en el iPhone (Safari, add-to-home-screen, sin conexion).
4. Cerrar la sesion: `HANDOFF.md` en `.knowledge/`, registro en `MEMORY.md` y
   `CHANGELOG.md` del workspace.
