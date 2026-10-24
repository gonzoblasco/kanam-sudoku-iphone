# Architecture - Kanam Sudoku iPhone

<!-- project: github.com/gonzoblasco/kanam-sudoku-iphone -->

Diseno tecnico del proyecto. Este documento responde: **que modulos existen, que
contratos tienen, que decisiones se tomaron (y que alternativa se descarto), que
riesgos hay y donde vive cada requisito de las specs**.

Quien construye, no necesita leer nada mas que este archivo, `docs/CONTEXT.md`,
`docs/data-model.md` y las specs.

---

## 1. La forma del sistema

Una app web de una sola pantalla, con tres capas y una regla que atraviesa todas:

```
┌─────────────────────────────────────────────────────────┐
│  ui/            DOM. Cablea. No calcula.                │
│                 app.ts (menu|generating|playing|victory)│
│                 render.ts · keypad.ts · menu.ts · victory│
└────────────────────────┬────────────────────────────────┘
                         │  llama a funciones puras
┌────────────────────────┴────────────────────────────────┐
│  state/          GameState · apply(mutation) · undo/redo │
│                 persistence.ts · timer.ts                │
│                 (almacenamiento y reloj INYECTADOS)      │
└────────────────────────┬────────────────────────────────┘
                         │  usa
┌────────────────────────┴────────────────────────────────┐
│  core/           Motor puro. Sin DOM. node --test.       │
│                 grid · geometry · mask · solver          │
│                 techniques · analysis · rater            │
│                 generator · validator                    │
└─────────────────────────────────────────────────────────┘
```

**La regla que atraviesa las tres capas:** *la logica no sabe que existe el DOM, y
el DOM no calcula nada*. Cada calculo (conflictos, resaltados, nivel, victoria) vive
en `core/` o `state/`, y la UI recibe resultados ya calculados. Es la que hace que
el motor sea testeable sin navegador (que es donde estan los bugs caros) y que la
UI se pueda verificar en Chromium real (que es donde estan los bugs de layout).

**La segunda regla:** *el estado de juego se escribe por un unico camino*
(`apply(mutacion)`), y *el nucleo no depende del entorno* (el `Storage` y el reloj
entran por parametro). Ver ADR-0004.

## 2. Limites (boundaries)

| Modulo | Que contiene | Que NO contiene |
|---|---|---|
| `core/` | Logica de sudoku pura: grilla, geometria, mascara, solver, tecnicas, analisis, rating, generador, validador | DOM, `window`, `localStorage`, `Date.now` sin inyectar, aleatoriedad sin sembrar, ninguna dependencia de runtime |
| `state/` | Estado de juego: `GameState`, mutaciones, historial, persistencia, tiempo | DOM, acceso directo a `localStorage` o a `window`, decisiones de presentacion |
| `ui/` | DOM: render, teclado, menu, victoria, maquina de estados de la app, registro del SW | Calculos de dominio (no reimplementa conflictos, ni nivel, ni victoria), estado de negocio (no guarda la grilla: la pide al `state/`) |
| `sw/` + `scripts/` | Service worker e iconos: artefactos de build | Logica de juego |

**Fronteras nuevas y su justificacion:**

- **`core/` separado de `state/`**: `core` responde "que es un puzzle valido y
  como se clasifica"; `state` responde "como esta mi partida". Son capacidades de
  negocio distintas (el puzzle es generado; la partida es jugada) y sus ciclos de
  vida son distintos (el puzzle se genera una vez; la partida se muta muchas).
  Fusionarlas fue lo que hizo el v1: `GameState` mezclaba reglas de juego con
  estado de UI, y el motor y la UI se contaminaron.
- **`ui/` con maquina de estados de la app** (`menu | generating | playing |
  victory`): porque hay una pantalla de **generacion** que puede tardar, y el
  estado de la app ("en que pantalla estoy") es distinto del estado de juego
  ("como esta mi tablero"). Son dos preguntas distintas con dos dueñas.
- **`scripts/` separado de `src/`**: los scripts de build (iconos, service worker)
  no son codigo de la app: corren en Node, en el build, y no se empaquetan. Meterlos
  en `src/` los haria parte del bundle.
- **`sw/` separado**: el service worker se emite desde una plantilla en el build
  (ADR-0003); no es codigo de la app.

## 3. Contratos

### 3.1 `core/mask.ts` - la mascara de candidatos

```ts
type Mask = number;   // 9 bits

const bitFor = (digit: 1|2|3|4|5|6|7|8|9): Mask => 1 << (digit - 1);
const maskOf = (...digits: number[]): Mask => ...
const hasDigit = (mask: Mask, digit: number): boolean => ...
const digitsOf = (mask: Mask): number[] => ...
```

**Una sola convencion en todo el arbol: `bit (d - 1)`.** Este modulo es el unico
lugar donde se construye una mascara. El criterio de aceptacion de `spec-001`
(RF-9) verifica que no exista una segunda forma.

> Contexto: el v1 de este dominio sufrio dos convenciones conviviendo
> (`1 << (d-1)` y `1 << d`), documentadas como "ambas validas". Es la razon por la
> que aqui el esquema es un modulo unico y verificado.

### 3.2 `core/geometry.ts` - las 27 unidades

```ts
const UNITS: number[][];              // 27 unidades de 9 celdas
const UNITS_OF_CELL: number[][];      // celda -> indices de sus 3 unidades
const PEERS: number[][];              // celda -> 20 celdas que la ven
const rowOf = (i: number) => number;  // 0..8
const colOf = (i: number) => number;  // 0..8
const blockOf = (i: number) => number;// 0..8
```

Se calcula **una vez** al cargar el modulo. La validacion (spec-002) y el analisis
(tecnicas) lo comparten: no recalculan geometria.

### 3.3 `core/solver.ts` - resolver y contar

```ts
solve(grid: Grid): { status: "solved" | "invalid" | "unsolvable"; solution: Grid | null };
countSolutions(grid: Grid, cap: number): number;
```

- `solve` y `countSolutions` **no mutan** la entrada y aceptan `Grid` (o una copia
  propia). Backtracking con heuristica MRV (la celda con menos candidatos primero).
- `countSolutions` corta en `cap`: el generador solo necesita saber "hay mas de
  una?".

### 3.4 `core/techniques.ts` - el catalogo

```ts
interface Technique {
  id: string;              // "hidden_pair", "x_wing", ...
  tier: number;            // 0, 1, 2... (ADR-0002)
  detect(ctx: AnalysisState): Deduction | null;
  verify(deduction: Deduction): boolean;   // la justificacion es real
}

interface Deduction {
  technique: string;
  tier: number;
  cells: number[];         // celdas implicadas
  digits: number[];
  value?: number;          // si placement
  candidates?: { index: number; mask: Mask }[];  // si eliminacion
  text?: string;           // explicacion (v2; en la v1 se puede omitir)
}

findDeduction(ctx, maxTier?): Deduction | null;   // la mas simple disponible
```

El **tier es propiedad de la tecnica**, no un heuristico por puzzle (ADR-0002).

### 3.5 `core/rater.ts` - medir

```ts
ratePuzzle(puzzle: Puzzle): Rating;
```

Resuelve el puzzle con el catalogo, aplicando deducciones hasta que no queda mas.
Devuelve nivel, tier maximo, pasos y conteo por tecnica. Si el catalogo no alcanza:
`solved: false` y el tier alcanzado, **sin** inventar uno mayor.

### 3.6 `core/generator.ts` - generar

```ts
generatePuzzle(difficulty: Difficulty, options?: {
  seed?: number;
  maxAttempts?: number;
}): GenerateResult;
```

Grilla completa (backtracking con MRV) -> quita celdas **verificando unicidad
despues de cada quitada** (`countSolutions(grid, 2) === 1`) -> mide el resultado
-> si el nivel no coincide, descarta y prueba otra semilla derivada. Acotado por
`maxAttempts`. Al agotar los intentos: `matched: false` con el nivel realmente
medido.

**Determinista** dada la semilla: el motor no usa `Math.random`; usa un PRNG
sembrado (mulberry32).

### 3.7 `core/validator.ts` - conflictos

```ts
findConflicts(grid: Grid): Conflict[];
conflictCells(grid: Grid): number[];
conflictedUnits(grid: Grid): { kind: UnitKind; index: number }[];
isComplete(grid: Grid): boolean;
isSolved(grid: Grid): boolean;
```

Un mismo digito en tres celdas de una unidad produce **un** conflicto con tres
celdas. No muta la entrada.

### 3.8 `state/state.ts` - el nucleo del estado

```ts
createGameState(puzzle: Puzzle): GameState;
getValue(state: GameState, index: number): Cell;
setValue(state: GameState, index: number, value: Cell): GameState;   // no-op si es dada
clearValue(state: GameState, index: number): GameState;
selectCell(state: GameState, index: number | null): GameState;
apply(state: GameState, mutation: Mutation): GameState;
undo(state: GameState): GameState;
redo(state: GameState): GameState;
```

- `apply` **no muta el estado previo** (verificado con un snapshot en el test).
- El historial guarda **mutaciones**, con puntero de posicion. `LIMIT = 1000`.
- Una mutacion nueva **descarta la rama de redo**.
- `setValue` sobre un indice de `givens` es un **no-op**: no cambia el valor ni
  agrega historial.
- `notes` existe en el estado (vacio en la v1) y **se serializa** (spec-005).
- Una mutacion que no cambia nada (escribir el mismo valor) **no** genera entrada
  de historial.

### 3.9 `state/persistence.ts` - guardar y restaurar

```ts
serialize(state: GameState): SavedGame;
deserialize(payload: unknown): { state: GameState | null; recovered: boolean };
save(state: GameState, storage: Storage): void;    // captura errores
load(storage: Storage): { state: GameState | null; recovered: boolean };
clearSaved(storage: Storage): void;
```

- `schemaVersion: 1`. Migracion 0 -> 1. Version futura se rechaza. Payload
  corrupto -> estado vacio + `recovered: true`, **sin lanzar**.
- El historial **no** se serializa.
- Los errores del `Storage` se capturan en la frontera: la app sigue jugable.
- El `Storage` es **inyectado**: la logica no toca `localStorage`.

### 3.10 `state/timer.ts` - el tiempo

```ts
createTimer(now: () => number): Timer;
start(timer) / pause(timer) / resume(timer) / stop(timer);
elapsedOf(timer): number;
```

El reloj es inyectado. El tiempo **efectivo** (la pausa no suma) es lo que se
persiste. Al reabrir una partida, el cronometro arranca **pausado**.

### 3.11 `ui/app.ts` - la maquina de estados de la app

```ts
type Phase = "menu" | "generating" | "playing" | "victory";
```

| Transicion | Disparador |
|---|---|
| `menu -> generating` | El jugador elige un nivel |
| `generating -> playing` | El generador devuelve un puzzle del nivel pedido (`matched: true`) |
| `generating -> menu` | El generador no pudo (`matched: false`) y el jugador elige otro nivel, o se muestra el mensaje honesto |
| `menu -> playing` | "Continuar" (partida en curso restaurada) |
| `playing -> victory` | El tablero queda completo y sin conflictos |
| `victory -> generating` | "Jugar de nuevo" (mismo nivel) |
| `victory -> menu` | "Elegir otro nivel" |

**La generacion no bloquea la UI:** se resuelve en una microtask/promise y la UI
muestra "Generando...". Si falla, la app lo dice (spec-006) y no queda en un
spinner eterno.

### 3.12 `ui/render.ts` - dibujar

```ts
renderBoard(container: HTMLElement, views: CellView[]): void;
```

Recibe `CellView[]` ya calculados. **No calcula conflictos, ni resaltados, ni
niveles.** Solo aplica `data-*` y contenido. La precedencia de `highlight` (un
unico valor) la aplica el modulo que arma las vistas, no el render.

### 3.13 `ui/keypad.ts` - el teclado

Botones **HTML nativos** (`<button>`), en un `role="group"` con nombre accesible.
Cada tecla: `1`-`9` y "Borrar". Escribe en la celda seleccionada; sin seleccion, no
hace nada; sobre una dada, no hace nada.

### 3.14 `scripts/generate-icons.mjs` - los iconos

Escribe los PNG **sin dependencias** (compresion zlib de `node:zlib`). Salida
determinista: dos corridas producen archivos identicos. El build falla si los
iconos no existen o no tienen firma PNG valida.

### 3.15 `scripts/gen-sw.mjs` - el service worker

Emite el service worker con la **lista de precache real del build** y la **version
de cache derivada del contenido** de esa lista. Rutas relativas (`./index.html`,
`./assets/...`). El fallback de navegacion offline sirve `./index.html`
precacheado, **no** `./` (ADR-0005).

## 4. Decisiones con su alternativa descartada

Las decisiones durables estan en los ADRs (con su alternativa en detalle). Aca el
resumen operativo, con el **criterio de aceptacion** que la verifica:

| Decision | Alternativa descartada | Criterio que la verifica |
|---|---|---|
| TypeScript + Vite, cero deps de runtime | React/Preact/Svelte; JS sin tipos; WASM; Vitest | `node --test test/` corre los tests `.ts` **sin build** (verificado en `/tmp/tscheck`); el bundle no tiene dependencias de runtime |
| Dificultad por tecnica | Por cantidad de vacias; mixto; por tiempo estimado; 4 niveles | `spec-001`: el nivel de cada puzzle entregado coincide con el pedido, medido |
| PWA manual, sin plugin | `vite-plugin-pwa`; solo meta tags de Apple; CDN de PWA; Network-First | `spec-006`: el manifest parsea, el SW registra con fetch handler, la app carga offline y bajo subpath, la version de cache cambia con el contenido |
| Un `GameState` con historial | Estado plano con campos separados; snapshots; Redux/Zustand; IndexedDB; no persistir | `spec-005`: undo/redo ida y vuelta exacta, no-mutacion del estado previo, ida y vuelta de serializacion, notas presentes en el estado y ausentes en el DOM |
| `base: "./"` y rutas relativas | Dominio propio; base absoluto; base vacio; rutas a mano | `spec-006`: la app carga y juega bajo el subpath, online y offline, con el scope del SW correcto |
| Proyecto desde cero | Forkear `kanam-sudoku`; retomar `kanam-logik`; importar el motor; libreria OSS | `spec-001` RF-9: una sola convencion de mascara en el arbol; cero lineas copiadas (verificable con `git log` del proyecto) |

## 5. Migracion y compatibilidad

- **Formato persistido:** `schemaVersion: 1`. Hay migracion 0 -> 1 probada con un
  fixture. Un payload de version futura se rechaza sin crashear.
- **Rutas:** relativas, validas en la raiz y en el subpath (ADR-0005).
- **Sin API publica:** el proyecto no expone una API a terceros. Los contratos
  (seccion 3) son **internos al repo** y pueden cambiar; los ADRs registran las
  decisiones durables.
- **Compatibilidad de navegador:** Safari iOS 16+ (objetivo), Chrome/Edge/Firefox
  recientes. APIs usadas: `localStorage`, `navigator.serviceWorker`, CSS
  `prefers-color-scheme`, `dvh`, `env(safe-area-inset-*)`. **Ninguna** API que
  requiera un polyfill.
- **Sin migracion de codigo pendiente:** el proyecto arranca desde cero.

## 6. Dominio (evaluacion de disparadores DDD)

Las cinco senales, evaluadas:

| Senal | ¿Dispara? | Evidencia |
|---|---|---|
| 1. Un invariante que debe sostenerse en mas de una operacion o en cada escritura | **Si** | "Un puzzle tiene exactamente una solucion" (generacion), "una dada no se edita" (escritura), "el nivel es el medido" (clasificacion). Cada uno con su test |
| 2. Una entidad con identidad y ciclo de vida | **Si** | La **partida en curso** tiene identidad (la clave de guardado), ciclo de vida (menu -> generando -> jugando -> ganada -> abandonada) y transiciones |
| 3. Un termino que el cambio define o redefine | **Si** | Todo el vocabulario: puzzle, givens, jugada, unidad, conflicto, tier, nivel, rating, mutacion, historial, notas, esquema de persistencia. **Dos terminos que el motor previo usaba distinto** ("region" por "unidad"; "nivel" y "tier" confundidos) |
| 4. Un limite entre dos capacidades de negocio | **Si** | **Generar** (el motor produce un puzzle) vs **Jugar** (la partida usa un puzzle). El limite es el `Puzzle`: el motor no sabe de partidas, el estado no sabe generar |
| 5. Deriva de vocabulario ya presente | **No** | El proyecto es nuevo: no hay corpus previo con el que deriva. La deriva que se evita es la **heredada** del motor previo, y por eso el glosario es explicito y con sinonimos rechazados |

**Dispara.** Por lo tanto el dominio esta modelado: el vocabulario vive en
`docs/CONTEXT.md` (un termino por concepto, con los sinonimos rechazados), las
entidades y sus invariantes en `docs/data-model.md`, y los limites en la seccion 2
de este documento.

**Entidades y agregados:**

| Entidad | Identidad | Invariantes | Aggregate |
|---|---|---|---|
| **Puzzle** | su grilla + semilla | solucion unica; solucion valida; las givens coinciden con la solucion | raiz del agregado de generacion |
| **Partida en curso** | la clave de guardado | grilla de 81; givens ⊆ celdas con valor; `elapsedMs` no decrece; una dada no cambia; el historial esta acotado | raiz del agregado de juego |
| **Unidad** | (tipo, indice) | exactamente 9 celdas; las 27 unidades cubren cada celda 3 veces | parte del dominio, sin estado propio |
| **Tecnica** | su `id` | tier fijo y declarado; su `verify` confirma la justificacion | catalogo |
| **Rating** | derivado, no tiene identidad propia | el nivel deriva del tier maximo | valor derivado |

**Limites entre capacidades:**

| Capacidad | Expone | No sabe de |
|---|---|---|
| Generar (motor) | `Puzzle`, `Rating` | partidas, jugadas, DOM, la UI |
| Jugar (estado) | `GameState` | como se genero el puzzle, como se ve en pantalla |
| Mostrar (UI) | nada (es el destino) | como se genera, como se clasifica la dificultad |

## 7. Trazabilidad: donde vive cada requisito

| Spec | Capacidad | Donde vive | Contrato | Invariantes que lo sostienen |
|---|---|---|---|---|
| [SPEC-001](../.knowledge/specs/SPEC-001-motor-generacion.md) | C1 generacion, C2 dificultad | `core/generator.ts`, `core/rater.ts`, `core/techniques.ts`, `core/solver.ts`, `core/mask.ts` | `generatePuzzle`, `ratePuzzle`, `findDeduction`, `countSolutions` | solucion unica (verificada por quitada); nivel = tier medido; `matched: false` honesto; determinismo por semilla; una sola convencion de mascara |
| [SPEC-002](../.knowledge/specs/SPEC-002-validacion-conflictos.md) | C3 validacion | `core/validator.ts`, `core/geometry.ts` | `findConflicts`, `conflictCells`, `conflictedUnits`, `isComplete`, `isSolved` | un conflicto por unidad (no por par); `complete` y `solved` son criterios distintos; la entrada no se muta |
| [SPEC-003](../.knowledge/specs/SPEC-003-tablero-tactil.md) | C4 tablero tactil | `ui/render.ts`, `ui/styles.css`, `state/state.ts` | `renderBoard`, `CellView`, `selectCell` | el tablero es cuadrado y no scrollea; celda >= 44px; estados con canal propio mas alla del color; las givens no se editan |
| [SPEC-004](../.knowledge/specs/SPEC-004-teclado-victoria.md) | C5 teclado, C6 victoria | `ui/keypad.ts`, `ui/victory.ts`, `state/state.ts` | teclas nativas, `setValue`, `clearValue`, `isSolved` | la tecla escribe en la seleccion; sin seleccion no hace nada; victoria solo con `complete && solved` |
| [SPEC-005](../.knowledge/specs/SPEC-005-estado-persistencia.md) | C8 estado extensible, C9 persistencia | `state/state.ts`, `state/persistence.ts`, `state/timer.ts` | `apply`, `undo`, `redo`, `serialize`, `deserialize`, `save`, `load` | un solo camino de escritura; el estado previo no se muta; el historial esta acotado; las notas existen en el estado; version de esquema con migracion y rechazo |
| [SPEC-006](../.knowledge/specs/SPEC-006-pwa-menu.md) | C7 PWA, C6 menu, C10 cronometro | `public/manifest.webmanifest`, `scripts/gen-sw.mjs`, `scripts/generate-icons.mjs`, `ui/pwa.ts`, `ui/menu.ts`, `state/timer.ts` | manifest, `registerSW`, maquina de estados de la app | el precache es el real del build; la version deriva del contenido; el fallback offline sirve `./index.html`; la app juega sin SW; la generacion fallida se dice, no se disimula |

**Capacidades fuera de la v1** (del discovery), nombradas para que no se confundan
con olvidas:

| Capacidad | Estado | Donde landingria en el futuro |
|---|---|---|
| C11 hints que explican la tecnica | Fuera de v1 | `core/techniques.ts` ya expone `technique` y `verify`; la v2 agrega `explain` y la UI del hint |
| C12 notas por celda | **En la v1 desde el 2026-10-24** (SPEC-007) | `core/candidates.ts` (digitos legales), `state/state.ts` (`setNote`, `toggleNote`, `setAutoNotes`), `ui/notes-controls.ts`, `ui/render.ts` (grilla 3x3) |
| C13 deshacer/rehacer | Fuera de v1 (el mecanismo **si** esta) | `state/state.ts` ya tiene `undo`/`redo` y el historial |
| C14 estadisticas | Fuera de v1 | `state/persistence.ts` (una clave nueva, `kanam.sudoku.iphone.stats`) |
| C15 cuentas / backend / telemetria | Fuera de v1 | fuera del modelo de datos: no existe backend |
| C16 variantes (6x6, 12x12, killer) | Fuera de v1 | `core/geometry.ts` esta parametrizado por tamano, pero el resto del motor asume 9x9 |
| C17 notificaciones | Fuera de v1 | el service worker podria soportarlas, pero no hay permisos ni caso de uso |

**El hueco, buscado con `grep`.** Cada ID de capacidad (`C1`..`C17`) y cada ID de
spec aparece **una vez** en la tabla de arriba. Ninguna capacidad de la v1 queda
sin lugar.

## 8. Verificacion

| Que | Como | Donde |
|---|---|---|
| Logica de juego (motor + estado) | `node --test test/` - **sin build** (Node 26, type stripping nativo) | `test/*.test.ts` |
| Tipos | `tsc --noEmit` en el CI (type stripping **no** verifica tipos: borra las anotaciones) | `tsconfig.json` |
| UI en navegador real | e2e con Chromium (Playwright-core de la maquina), viewport **390x844** | `test/e2e.*.mjs` |
| Accesibilidad | `axe-core` sobre la app viva (cargado desde CDN en el test, no en el bundle) | `test/e2e.a11y.mjs` |
| Contraste | script que mide cada par texto/fondo de la hoja de estilos, en **ambos** temas | `scripts/check-contrast.mjs` |
| PWA | e2e con el contexto offline del navegador, en **raiz y subpath** | `test/e2e.pwa.mjs` |
| Icons | el build falla si los PNG no existen o no tienen firma valida | `scripts/generate-icons.mjs` |

**El CI** corre, en este orden: `npm ci` -> `tsc --noEmit` -> `node --test test/`
-> `npm run build` -> los e2e -> el deploy a Pages (si es `main`).

## 9. Riesgos tecnicos y de proceso

| Riesgo | Impacto | Mitigacion | Verificado por |
|---|---|---|---|
| El generador no converge en "Dificil" | El menu se queda esperando | Tope de intentos + `matched: false` + mensaje honesto; medir el tiempo real en el iPhone | `spec-001`, `spec-006` |
| El catalogo de tecnicas no cubre un patron y el rating falla | "Dificil" mal clasificado | `solved: false` explicito (nunca un tier inventado) | `spec-001` |
| El teclado tapa el tablero en un iPhone chico | La app es injugable | Layout con `dvh` + `min-height: 0` + `safe-area-inset`; medir en 390x844 | `spec-003`, `spec-004` |
| El type stripping no verifica tipos | Un error de tipo llega a produccion | `tsc --noEmit` en el CI (ADR-0001) | CI |
| El SW sirve una version vieja | El usuario ve un bug ya corregido | Version de cache derivada del contenido; se regenera sola | `spec-006` |
| iOS purga la cache del sitio | La app no abre offline | Arranque limpio y sin error; el menu sigue funcionando | `spec-006` |
| Un payload corrupto rompe la app | Se pierde la partida | `deserialize` devuelve estado vacio + `recovered`, sin lanzar | `spec-005` |
| El estado crece sin limite en una partida larga | Memoria | Tope de 1000 entradas en el historial; se descarta la mas antigua | `spec-005` |
| Dos motores de sudoku divergen en el workspace | Confusion | Cada repo con su ADR; el alcance de cada uno esta declarado | ADR-0006 |
| El e2e depende de Playwright de la maquina | El CI falla en otra maquina | La maquina del CI instala `playwright-core` + Chromium como devDependencies **del entorno de CI**, no del proyecto | workflow |

## 10. Decisiones abiertas

**Ninguna** que bloquee la construccion. Las que quedan son para la v2 y estan
listadas en `.knowledge/KNOWLEDGE.md` ("Preguntas abiertas"): los limites exactos
de cada nivel, si el menu recuerda el ultimo nivel, y si el cronometro necesita
pausa manual.
