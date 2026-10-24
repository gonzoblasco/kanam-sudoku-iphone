# KNOWLEDGE - Kanam Sudoku iPhone

<!-- project: github.com/gonzoblasco/kanam-sudoku-iphone -->

Un lector nuevo tiene que entender este proyecto sin abrir los otros archivos. Esto
es lo que hay que saber.

## Para quien se construye

Para **Gonzo**, en su iPhone. Un solo usuario, un solo dispositivo. El juego es una
rutina diaria: lo abre en Safari, lo agrega a la pantalla de inicio, y juega un
sudoku.

El repo es **publico** (D1): es la pieza de portfolio. El segundo lector es
cualquiera que abra la URL de GitHub Pages o el codigo.

## De donde sale el dato

De **ningun lado**: no hay backend, no hay cuentas, no hay telemetria, no hay
redondeos a ningun servicio. Los puzzles se **generan en el dispositivo**, en el
momento de empezar la partida, con un PRNG sembrado. La unica persistencia es
`localStorage` (la partida en curso y las preferencias).

Consecuencia de arquitectura: **todo lo que el juego necesita saber lo sabe el
navegador**. No hay un backend que "traiga" el puzzle. Por eso la generacion
tiene que ser rapida y acotada: el usuario la espera en la pantalla.

## Dominio

### Vocabulario

El glosario autoritativo vive en [`docs/CONTEXT.md`](../../docs/CONTEXT.md). El
resumen minimo:

- **Puzzle**: grilla 9x9 con celdas vacias y **una unica** solucion.
- **Givens (pistas)**: las celdas con el valor inicial. Inmutables para el jugador.
- **Jugada**: celda con valor puesto por el jugador. Editable.
- **Unidad**: fila, columna o bloque 3x3 (27 en total).
- **Conflicto**: un mismo digito en dos o mas celdas de la misma unidad.
- **Tecnica**: patron de deduccion (candidato unico, par naked, X-Wing, rectangulo
  unico...). **Tier**: la dificultad de una tecnica. **Nivel**: el del puzzle, que
  se deriva del tier maximo.
- **Estado de juego**: la partida en curso (grilla, givens, seleccion, pistas
  usadas, tiempo, historial).

### Reglas del dominio, y el invariante de cada una

| Regla | Invariante | Test que falla al violarla |
|---|---|---|
| Un puzzle tiene exactamente una solucion | `countSolutions(puzzle, 2) === 1` para todo puzzle entregado | `spec-001`: unicidad real sobre 10 puzzles por nivel |
| Un puzzle no tiene dos celdas con el mismo digito en una unidad | Ningun valor aparece dos veces en una fila, columna o bloque | `spec-001`: la grilla generada es valida |
| Una dada no se edita ni se borra | `setValue` sobre un indice de `givens` es un no-op y no genera historial | `spec-005`: mutacion sobre dada no cambia el valor ni el historial |
| Un tablero completo con conflictos no es una victoria | `solved === complete && conflicts.length === 0` | `spec-002`: `complete` y `solved` se testean por separado |
| Borrar un numero no rompe el estado | El estado tras un `clear` es consistente: la celda vale 0, no hay conflicto con ella, y las pistas usadas no se alteran | `spec-005`: el par (grilla con conflicto, grilla sin) |
| El nivel de un puzzle es el medido | `rating.difficulty` sale del tier maximo medido, nunca de una constante de "vacias" | `spec-001`: el rating de puzzles de cada nivel |
| El generador no miente | Si no encuentra un puzzle del nivel pedido, devuelve `matched: false` | `spec-001`: `maxAttempts` adverso devuelve `matched: false` |
| El tiempo guardado es tiempo de juego | `elapsedMs` no avanza mientras esta en pausa | `spec-005`: reloj inyectado, tramo en pausa |
| El estado es serializable y restaurable | `deserialize(serialize(s))` produce un estado equivalente a `s` | `spec-005`: ida y vuelta |
| Un payload de version futura no rompe la app | `deserialize` devuelve estado vacio, sin lanzar | `spec-005`: version futura y payload corrupto |

### La escalera de niveles (derivada, no escrita a mano)

El nivel sale del **tier maximo** que hace falta para resolver el puzzle. Los tres
niveles que expone la UI:

| Nivel | Se resuelve con | Que siente el jugador |
|---|---|---|
| **Facil** | Tecnicas de tier bajo: candidato unico (visible y oculto), pares y trios naked y hidden | "Se deduce solo" |
| **Medio** | Tecnicas de nivel intermedio: candidatos apuntados/reclamados, X-Wing, Swordfish | "Hay que pensar el par" |
| **Dificil** | Tecnicas avanzadas: rectangulo unico, cadenas (X-Chain, XY-Chain), Skyscraper, W-Wing, Jellyfish, colores | "Hay que ver la estructura" |

La tabla de tier por tecnica **si** es explicita (es knowledge tecnico, no un
heuristico), pero el **mapeo tier -> nivel** se aplica de forma uniforme, y el
generador **mide** el puzzle y lo clasifica: no le pone la etiqueta a un puzzle y
espera que sea cierto.

## Decisiones cerradas

| ADR | Decision | Consecuencia principal |
|---|---|---|
| [ADR-0001](../../docs/adr/ADR-0001-stack-typescript-vite.md) | TypeScript + Vite, cero dependencias de runtime | Bundle chico, logica testeable sin DOM, Node 26 corre los tests sin build |
| [ADR-0002](../../docs/adr/ADR-0002-dificultad-por-tecnica.md) | La dificultad se define por la tecnica de resolucion | "Dificil" es de verdad mas dificil, no "mas vacias" |
| [ADR-0003](../../docs/adr/ADR-0003-pwa-manual-sin-plugin.md) | Manifest + service worker escritos a mano, sin plugin de PWA | Control del precache y de la version de cache; cero dependencias |
| [ADR-0004](../../docs/adr/ADR-0004-estado-nucleo-extensible.md) | Un unico `GameState` con historial de mutaciones | Deshacer, notas y guardado se agregan sin reescribir el nucleo |
| [ADR-0005](../../docs/adr/ADR-0005-github-pages-base-relativa.md) | GitHub Pages con `base: "./"` y rutas relativas | Funciona bajo el subpath `/kanam-sudoku-iphone/` y en la raiz |
| [ADR-0006](../../docs/adr/ADR-0006-proyecto-desde-cero.md) | Proyecto nuevo desde cero, sin reutilizar el motor previo | Un solo motor en el repo, con una convencion de mascara; el v1 viejo queda como prehistoria |

**Notas por celda (agregadas el 2026-10-24, a pedido de Gonzo):** capability C12,
que la v1 dejo fuera de alcance. La decision de diseno que la hace coherente con
el resto: **una nota no es una jugada**. No cambia el valor de una celda y no
entra al historial de deshacer, asi que su API (`setNote`, `toggleNote`) esta
separada de `apply` desde el primer dia (ADR-0004). El nucleo de las notas es
`src/core/candidates.ts` (los digitos legales de una celda, los mismos que el
motor de tecnicas calcula) y `src/state/state.ts` (las mascaras). En la UI, el
valor de una celda y sus notas viven en elementos distintos (`.cell-value` y
`.note-grid`).

## Que se reutiliza, y de donde

| Pieza | De donde | Como |
|---|---|---|
| Estructura de proyecto (`.knowledge/`, `docs/adr/`, specs) | Convencion del workspace | Plantilla de `kanam-spec` + los ADRs del workspace |
| Validador de specs | `~/.agents/skills/spec-driven-development/scripts/validate-spec.sh` | El CI corre el mismo script |
| Playwright-core + Chromium | Ya instalados en la maquina (`~/Library/Caches/ms-playwright/`) | E2E en navegador real, sin agregar dependencias al proyecto |
| `axe-core` para a11y | Disponible via CDN en el e2e | Se carga solo en el test, no en el bundle |

**Lo que NO se reutiliza:** nada del motor de `kanam-sudoku`. Cero lineas copiadas.
Motivo en ADR-0006.

## Riesgos y mitigaciones

| Riesgo | Mitigacion |
|---|---|
| El generador no converge en un nivel pedido | Tope de intentos + `matched: false` explicito + reintento con semillas derivadas; la UI lo dice (spec-006) |
| El tablero no entra con el teclado en 390x844 | Layout con `dvh` + `min-height: 0` + `safe-area-inset`; verificado por e2e con las dos mediciones (scroll y celda >= 44px) |
| Safari iOS no abre a pantalla completa | Meta tags de Apple, no solo `display: standalone` del manifest (spec-006) |
| Un estado viejo en cache muestra un bug | Version de cache derivada del **contenido** del precache; se regenera sola |
| La extension futura (deshacer/notas) obliga a reescribir | El nucleo tiene historial y notas desde el dia 1, y hay un test que lo prueba (spec-005) |
| Un puzzle con solucion multiple llega a la UI | El generador verifica unicidad despues de cada quitada; la validacion de la UI es la ultima linea |

## Preguntas abiertas

Ninguna bloqueante. Las que quedan son para la v2:

- **Que nivel exacto mapea cada tier a que nivel.** La tabla de arriba es la regla
  vigente, pero los limites concretos por nivel (que tier es "medio" y cual es
  "dificil") se ajustan con la evidencia de uso, no antes.
- **Si el menu inicial lleva la opcion de nivel por defecto.** La v1 pide el nivel
  cada vez; con uso diario, quiz convenga recordar el ultimo.
- **Si el cronometro merece pausa manual.** Hoy el tiempo se retoma pausado al
  reabrir, pero no hay un boton de pausa durante la partida.
