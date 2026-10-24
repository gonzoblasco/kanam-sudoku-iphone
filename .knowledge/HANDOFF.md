# HANDOFF - Kanam Sudoku iPhone

<!-- project: github.com/gonzoblasco/kanam-sudoku-iphone -->

Estado al cierre de la sesion del **2026-10-24**. La verificacion que sigue es
**reproducida**: el comando y su salida, no la interpretacion.

## Que esta hecho

Un sudoku 9x9 **mobile-first para iPhone**: PWA instalable, jugable offline,
teclado en pantalla, tres dificultades medidas por tecnica de resolucion, y
resaltado de fila/columna/bloque/mismo-numero. Sin cuentas, sin backend, sin
telemetria, sin anuncios.

Repo: `projects/kanam-sudoku-iphone/` (su propio repo git). Publicacion en
GitHub Pages pendiente del paso final.

## Verificacion reproducida

```bash
cd ~/projects/kanam-sudoku-iphone
npm install
npm test
```

```
ℹ tests 61
ℹ pass 61
ℹ fail 0
ℹ duration_ms 1585.082209
```

```bash
npm run typecheck
```

```
npm notice run typecheck
npm notice run tsc --noEmit
```

(sin salida: sin errores de tipos)

```bash
npm run build
node scripts/gen-sw.mjs
```

```
dist/index.html                  0.82 kB │ gzip: 0.42 kB
dist/assets/index-DFtabczO.css   2.39 kB │ gzip: 0.85 kB
dist/assets/index-BcioKX2A.js   20.20 kB │ gzip: 6.96 kB
✓ built in 100ms
Service worker generated at .../dist/sw.js with version 1d201e30
```

```bash
node scripts/check-contrast.mjs
```

```
light theme:  9/9 pares AA (minimo 3.95:1)
dark theme:   9/9 pares AA (minimo 4.16:1)
All colour pairs meet WCAG AA.
```

```bash
node test/e2e.board.mjs     # e2e.board: 19/19 checks passed
node test/e2e.keypad.mjs    # e2e.keypad: 23/23 checks passed
node test/e2e.pwa.mjs       # e2e.pwa: 45/45 checks passed
node test/e2e.a11y.mjs      # e2e.a11y: 7/7 checks passed
```

```bash
grep -rn "1 <<" src/ | grep -v "src/core/mask.ts"
```

(vacio: una sola convencion de mascara en todo el arbol)

## Comportamiento medido del motor

| Medida | Valor |
|---|---|
| Celdas vacias por puzzle | 55-57 |
| Unicidad | `countSolutions(puzzle, 2) === 1` para los 3 niveles |
| Nivel medido vs pedido | facil=tier 1, medio=tier 2, dificil=tier 3 |
| Tiempo por puzzle | 13 ms (facil) · 13 ms (medio) · 105 ms (dificil) |
| Bundle | 20.2 kB (6.96 kB gzip), **cero dependencias de runtime** |

## Mapa del proyecto

```
src/core/     motor puro: grid, geometry, mask, analysis, techniques, solver,
              rater, generator, validator
src/state/    GameState (apply/undo/redo), persistence, timer
src/ui/       render, keypad, menu, victory, app (maquina de estados), styles
src/sw/       plantilla del service worker (se emite en el build)
scripts/      generate-icons.mjs, gen-sw.mjs, check-contrast.mjs
test/         3 suites node --test + 4 e2e en Chromium real (390x844)
.knowledge/   DISCOVERY, BRIEF, STATUS, KNOWLEDGE, specs/ (6 specs)
docs/         architecture, CONTEXT, data-model, adr/ (6 ADRs)
```

## Lo que sigue

1. **Publicar**: crear el repo publico `gonzoblasco/kanam-sudoku-iphone`,
   `git push -u origin main`, y habilitar Pages (Settings -> Pages -> Source:
   **GitHub Actions**). El workflow `.github/workflows/deploy.yml` ya esta listo.
2. **Verificar en el iPhone**: abrir la URL en Safari, Compartir -> Anadir a
   pantalla de inicio, confirmar icono propio y apertura sin barra, y probar sin
   datos moviles.
3. **Cerrar la sesion del workspace**: `MEMORY.md` y `docs/CHANGELOG.md` ya
   tienen la entrada; falta el daily (`skills/session-lifecycle/scripts/session-end.sh`).

## Deuda que queda (con nombre)

- **D4-D6 sin confirmar por Gonzo**: nombre del repo, cronometro y menu inicial
  son decisiones **asumidas**. Reversibles antes/despues del primer push: son el
  nombre de la URL, un reloj discreto y la pantalla de arranque.
- **El techo de dificultad es el del catalogo** (tier 4: swordfish, unique
  rectangle). "Dificil" es alcanzable y medido, pero no llega a las cadenas
  X-Chain/Skyscraper. ADR-0002 lo dice explicitamente: la via para subirlo es
  **ampliar el catalogo**, no cambiar el criterio de nivel.
- **La UI no restaura `elapsedMs`/`paused`** al continuar: el estado y el payload
  los guardan, pero la UI reinicia el cronometro (que arranca pausado, como pide
  SPEC-005). Sin impacto en la v1.
- **`playwright-core` no es dependencia del proyecto**: el e2e lo resuelve en
  runtime (por nombre en CI, por ruta del cache en la maquina) y el binario de
  Chromium se pasa por `executablePath` porque el build instalado (1243) no es el
  que Playwright 1.62.1 espera (1234).

## Lecciones de esta sesion (para el proximo)

1. **Un auto-reporte no es un hecho.** El primer agente reporto 33 tests
   ejecutados y 6 archivos de test creados: **no existia el directorio `test/`**.
   Verificar el repo real (`git status`, correr los gates) antes de aceptar
   cualquier resultado.
2. **Un test que no asserta nada es peor que un test ausente**: el generador
   devolvia 0 celdas vacias y el test pasaba igual, porque el assert estaba
   dentro de un `if (result.matched)`.
3. **Un e2e que solo loguea no verifica nada**: los cuatro e2e iniciales
   imprimian sus checks y salian con codigo 0 siempre. Ahora usan un harness que
   sale con 1 cuando un check falla.
4. **Dos convenciones para el mismo dato rompen el codigo**: la mascara 0
   significaba "resuelta" en el analisis y "sin candidatos" en el solver. Con una
   grilla valida y una celda vacia, el solver la daba por irresoluble. El solver
   ahora tiene su propia convencion.
