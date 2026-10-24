# STATUS - Kanam Sudoku iPhone

<!-- project: github.com/gonzoblasco/kanam-sudoku-iphone -->

## Fase actual

**Publicado y en vivo (2026-10-24).** Revision independiente (paso B) cerrada con 18
bugs corregidos. Repo publico en GitHub Pages, verificado en el sitio desplegado.

## Etapas

| Etapa | Estado | Fecha |
|---|---|---|
| Reconocimiento | Completada | 2026-10-24 |
| Discovery | Completada | 2026-10-24 |
| Specs + Knowledge | Completada | 2026-10-24 |
| Diseno (architecture, CONTEXT, data-model, ADRs) | Completada | 2026-10-24 |
| Desarrollo | Completada | 2026-10-24 |
| Revision independiente (B) | Completada (18 bugs) | 2026-10-24 |
| Publicacion y deploy | Completada | 2026-10-24 |

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
| `npm test` | **73/73 tests, 0 fallos**, 1.6 s |
| `npm run typecheck` (`tsc --noEmit`) | limpio |
| `npm run build` | ok, 20.2 kB (6.96 kB gzip) |
| `node scripts/check-contrast.mjs` | **todos los pares AA** en ambos temas (9 pares x 2 temas) |
| `node test/e2e.board.mjs` | **27/27** |
| `node test/e2e.keypad.mjs` | **34/34** (incluye jugar una partida completa hasta la victoria) |
| `node test/e2e.pwa.mjs` | **61/61** (manifest, iconos reales, SW, offline jugable, subpath) |
| `node test/e2e.a11y.mjs` | **11/11** (axe-core: 0 violaciones) |
| CI en GitHub | **verde** (typecheck, tests, build, e2e, contraste) |
| Deploy en GitHub Pages | **verde** |
| Sitio desplegado | HTTP 200, 81 celdas, escritura funciona, 0 errores de consola |
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

1. **Verificar en el iPhone** (lo unico que no se puede medir desde aca):
   Safari -> Compartir -> Anadir a pantalla de inicio, confirmar el icono propio,
   la apertura sin barra de Safari, y jugar sin datos moviles.
2. **Confirmar D4-D6** (nombre del repo, cronometro, menu inicial) si se quiere
   cambiar alguno: son reversibles, pero el nombre ya esta publicado.
3. **Cerrar la sesion del workspace**: `MEMORY.md` y `docs/CHANGELOG.md` tienen la
   entrada; falta el daily (`skills/session-lifecycle/scripts/session-end.sh`).

## Publicacion

- Repo: https://github.com/gonzoblasco/kanam-sudoku-iphone (**publico**)
- Sitio: https://gonzoblasco.github.io/kanam-sudoku-iphone/
- Pages: `build_type: workflow`, deploy verde.
