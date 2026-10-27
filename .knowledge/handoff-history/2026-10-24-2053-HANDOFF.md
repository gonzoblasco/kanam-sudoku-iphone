# HANDOFF - Kanam Sudoku iPhone

<!-- project: github.com/gonzoblasco/kanam-sudoku-iphone -->

Estado al cierre de la sesion del **2026-10-24**. La verificacion que sigue es
**reproducida**: el comando y su salida, no la interpretacion.

**Publicado:** https://github.com/gonzoblasco/kanam-sudoku-iphone (publico) ->
https://gonzoblasco.github.io/kanam-sudoku-iphone/ (CI verde, deploy verde,
sitio verificado en Chromium real: 81 celdas, escritura funcionando, 0 errores
de consola).

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
ℹ tests 91
ℹ suites 11
ℹ pass 91
ℹ fail 0
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
dist/index.html                  1.17 kB │ gzip: 0.57 kB
dist/assets/index-BV-NXUUz.css   3.24 kB │ gzip: 1.20 kB
dist/assets/index-rC5Dqnj-.js   23.82 kB │ gzip: 7.96 kB
✓ built in 101ms
Service worker generated at .../dist/sw.js with version c1147ab3
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
node test/e2e.board.mjs     # e2e.board: 27/27 checks passed
node test/e2e.keypad.mjs    # e2e.keypad: 34/34 checks passed
node test/e2e.pwa.mjs       # e2e.pwa: 61/61 checks passed
node test/e2e.a11y.mjs      # e2e.a11y: 11/11 checks passed
node test/e2e.notes.mjs     # e2e.notes: 40/40 checks passed
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
| Bundle | 23.8 kB (7.96 kB gzip), **cero dependencias de runtime** |
| Celda del tablero | 43.33px a 390px de viewport, 44px exactos a 430px, sin recorte ni solape |

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

## Sistema de notas (2026-10-24, a pedido de Gonzo)

Capacidad C12, que la v1 dejo fuera de alcance. Se agrego entera: **modo notas**,
**candidatos automaticos** ("Auto") y **limpieza** de anotaciones, mas el render de
la grilla 3x3 clasica y la persistencia (que ya estaba en el payload).

La decision de diseno que la hace coherente: **una nota no es una jugada**. No
cambia el valor de una celda y no entra al historial de deshacer (ADR-0007). Por
eso su API (`setNote`, `toggleNote`) esta separada de `apply` desde el primer dia.

**Fue la primera prueba real de ADR-0004**: la capacidad entro y **el nucleo no
cambio de forma**. Eso es lo que la decision original compraba, y ahora esta
demostrado en vez de declarado.

Verificacion: `npm test` 91/91 (11 suites), `node test/e2e.notes.mjs` 40/40, y los
otros cuatro e2e siguen en verde (27/34/61/11). El bundle paso de 23.8 kB a
26.8 kB (8.76 kB gzip).

## La revision B (paso B del pipeline A/B) encontro 18 bugs reales

Todos corregidos y verificados. Los que importan:

1. **El tablero estaba TRANSPUESTO**: las celdas se apendaban a contenedores
   `role="row"` que el CSS apilaba en vertical, asi que filas y columnas estaban
   invertidas. **Ningun test lo veia** porque todos median geometria y nunca
   comparaban el dato con la pantalla.
2. **`.sr-only` no existia**: la region `aria-live` se pintaba visible debajo del
   teclado.
3. **Tres tecnicas con deducciones falsas** (`x_wing` eliminaba el digito de las
   cuatro esquinas de su propio patron, `swordfish` mal calculaba las columnas,
   `unique_rectangle` borraba un tercer digito cualquiera). Reescritas y fuzzeadas
   contra la solucion real: 447 eliminaciones, 0 incorrectas.
4. **El generador resembra con `base + n*stride`**, que es exactamente la
   actualizacion de estado de mulberry32: un seed malo seguia malo cientos de
   intentos. Corregido con un solo stream sembrado por corrida.
5. **`matched:false` mentia el nivel**: reportaba el nivel medido *con el cap
   pedido*. Corregido (re-rating sin cap).
6. **`undo` roto tras el tope del historial**: recalculaba el valor previo
   escaneando hacia atras y, al caer la entrada que escribio la celda, restauraba
   `0` sobre un valor real. Corregido capturando el `prev` por entrada.
7. **El cronometro se reseteaba** al continuar, y **no pausaba en background**
   (10 minutos en otra app contaban como 10 de juego).
8. **La partida ganada quedaba guardada**: al recargar ofrecía "Continuar" sobre
   un tablero ya ganado.
9. **`gen-sw.mjs` precacheaba su propio `sw.js`**, asi que la version derivada
   del contenido cambiaba en cada corrida.
10. **`generate-icons.mjs` usaba `sips`** (macOS-only, contra ADR-0003) y los tres
    iconos eran byte-identicos. Reescrito con `node:zlib` puro.

## Lo que sigue

1. **Verificar en el iPhone** (lo unico que no se puede medir desde aca): abrir la
   URL en Safari, Compartir -> Anadir a pantalla de inicio, confirmar el icono
   propio, la apertura sin barra de Safari, y jugar sin datos moviles.
2. **Confirmar D4-D6** (nombre del repo, cronometro, menu inicial) si se quiere
   cambiar alguno: son reversibles, pero el nombre ya esta publicado.
3. **Cerrar la sesion del workspace**: `MEMORY.md` y `docs/CHANGELOG.md` tienen la
   entrada; falta el daily (`skills/session-lifecycle/scripts/session-end.sh`).

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
5. **Un test que mide geometria no ve un tablero transpuesto**: la revision B
   encontro que el sudoku se dibujaba con filas y columnas invertidas, y todos
   los tests pasaban, porque ninguno comparaba el valor de una celda con el dato
   del motor. El e2e ahora lee el puzzle del DOM y lo resuelve.
6. **La aritmetica de la spec puede ser imposible**: nueve celdas de 44px
   necesitan 396px y el viewport de referencia tiene 390px. B respeto los 44px y
   recorto el tablero (la ultima columna se perdia; en un iPhone SE, una columna
   entera). Resuelto: el tablero es fluido (`min(100%, 396px)`) y la celda es un
   noveno de la fila, con base porcentual para que el borde quede dentro de la
   celda. Medido: 390px -> 43.33px, 375px -> 41.66px, 430px -> 44px exactos, sin
   solape. La spec, el e2e y el AGENTS.md quedaron reconciliados con la aritmetica.
7. **Un typecheck puede depender del entorno**: `tsc` resolvia los tipos de Node
   desde el `node_modules` del workspace padre, asi que pasaba local y fallaba en
   CI. `@types/node` es ahora una devDependency del proyecto.
