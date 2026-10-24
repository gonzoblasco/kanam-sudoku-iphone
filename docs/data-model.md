# Data Model - Kanam Sudoku iPhone

<!-- project: github.com/gonzoblasco/kanam-sudoku-iphone -->

Contrato del esquema de datos. Este proyecto **no tiene base de datos**: el
"esquema" son las estructuras en memoria del motor y el formato persistido en
`localStorage`. No hay backend, no hay cuentas, no hay telemetria (fuera de
alcance, ADR-0001 y el BRIEF).

---

## 1. Nucleo del dominio (en memoria, por partida)

### 1.1 Grilla

```ts
type Cell = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;   // 0 = vacia
type Grid = Cell[];                                     // siempre 81 elementos
```

- Una grilla es **siempre** un array de 81 elementos. Los indices son 0..80, en
  orden de lectura (fila 0 = indices 0-8, fila 1 = 9-17, ...).
- El valor `0` significa "vacia". Ningun otro valor representa vacio.
- Una grilla **nunca** contiene valores fuera de `0..9`: el tipo lo garantiza y el
  validador de forma (longitud) falla explicito si no se cumple.
- `Grid` no tiene metodos: son datos. Las operaciones viven en funciones.

### 1.2 Puzzle

```ts
interface Puzzle {
  grid: Grid;        // las pistas: 0 en las celdas vacias
  solution: Grid;    // la solucion completa (verificada, unica)
  seed: number;      // semilla del PRNG, uint32
}
```

| Regla | Constraint | Test que falla al violarla |
|---|---|---|
| `grid` tiene 81 elementos | longitud exacta | `spec-001` |
| `solution` esta completa | 81 valores, ninguno `0` | `spec-001` |
| `solution` es valida | sin conflictos | `spec-002` sobre `solution` |
| `puzzle.grid` y `puzzle.solution` coinciden en las givens | para todo indice con `grid[i] != 0`, `solution[i] == grid[i]` | `spec-001` |
| `puzzle` tiene solucion unica | `countSolutions(grid, 2) === 1` | `spec-001` |

**Nota sobre `givens`:** el puzzle **no** guarda el conjunto de indices dados
aparte. Las givens son derivables: `grid[i] != 0`. El `GameState` si guarda el
conjunto, porque en el estado la distincion dada/jugada importa (una dada no se
edita) y ahi ambas tienen valor.

### 1.3 Estado de juego

```ts
type Mutation =
  | { type: "set"; index: number; value: Cell }
  | { type: "clear"; index: number };

interface GameState {
  grid: Grid;                    // 81, incluye givens y jugadas
  givens: number[];              // indices de las pistas (orden ascendente, sin duplicados)
  selected: number | null;       // celda seleccionada, o null
  hintsUsed: number;             // pistas usadas (contador; los hints son v2)
  elapsedMs: number;             // tiempo EFECTIVO de juego (la pausa no suma)
  paused: boolean;               // el cronometro esta pausado
  history: { entries: Mutation[]; pointer: number };
  notes: Record<number, number>; // celda -> mascara de 9 bits. VACIA en la v1
}
```

| Regla | Constraint | Test que falla al violarla |
|---|---|---|
| `grid.length === 81` | longitud exacta | `spec-005` |
| `givens` ⊂ indices validos | todo indice en 0..80, sin duplicados | `spec-005` |
| `givens` ⊆ celdas con valor | `grid[i] != 0` para todo `i` en `givens` | `spec-005` |
| `selected` valido o null | `null` o en 0..80 | `spec-005` |
| `elapsedMs` nunca decrece | monotonico no decreciente | `spec-005` |
| `history.pointer` en rango | `0 <= pointer <= entries.length` | `spec-005` |
| `history` acotado | `entries.length <= LIMIT` (1000) | `spec-005` |
| `notes` mapea indices validos | toda clave en 0..80, valor en 0..511 (9 bits) | `spec-005` |
| una dada no cambia | `setValue` sobre indice de `givens` es no-op, sin entrada de historial | `spec-005` |

**Mascara de candidatos (notas):** 9 bits, un bit por digito, con la convencion
**`bit (d - 1)`**: el digito 1 es el bit 0 (`1 << 0`), el digito 9 es el bit 8
(`1 << 8`). El valor `0` significa "sin candidatos". Rango valido: `0..511`.

> **Una sola convencion en todo el arbol.** El motor (candidatos, tecnicas), el
> estado (notas) y cualquier helper usan `bit (d - 1)`. No existe `1 << d` en
> ningun modulo. Este es un criterio de aceptacion explicito de `spec-001` (RF-9):
> el v1 de este dominio sufrio exactamente este problema (dos convenciones
> conviviendo, documentadas como "ambas validas"), y por eso aqui se verifica.

### 1.4 Rating

```ts
type Difficulty = "facil" | "medio" | "dificil";

interface Rating {
  difficulty: Difficulty;              // nivel MEDIDO
  maxTier: number;                     // tier mas alto necesario
  steps: number;                       // pasos de resolucion
  techniqueCounts: Record<string, number>;  // nombre de tecnica -> veces usada
  solved: boolean;                     // false si el catalogo no pudo resolverlo
}
```

| Regla | Constraint | Test que falla al violarla |
|---|---|---|
| `difficulty` deriva de `maxTier` | mapeo unico y total (tabla de umbrales) | `spec-001` |
| `steps >= 1` si `solved` | coherencia | `spec-001` |
| `maxTier` es el maximo de las tecnicas usadas | coherencia con `techniqueCounts` | `spec-001` |
| `solved: false` no inventa tier | `maxTier` = tier alcanzado, no uno mayor | `spec-001` |

### 1.5 Resultado de generacion

```ts
interface GenerateResult {
  puzzle: Puzzle;
  rating: Rating;
  matched: boolean;   // false = el nivel pedido NO se logro
}
```

`matched: false` con `rating.difficulty` distinto del pedido es un resultado
**valido** y honesto. La UI (spec-006) lo muestra; no se disimula.

### 1.6 Validacion

```ts
type UnitKind = "row" | "column" | "block";

interface Conflict {
  value: number;       // digito en conflicto (1..9)
  kind: UnitKind;
  unitIndex: number;   // 0..8
  cells: number[];     // indices de celdas participantes (2 o mas)
}

interface ValidationResult {
  conflicts: Conflict[];
  conflictCells: number[];              // todas las celdas en conflicto, sin duplicados
  conflictedUnits: { kind: UnitKind; index: number }[];
  complete: boolean;                    // 81 celdas con valor
  solved: boolean;                      // complete && conflicts.length === 0
}
```

### 1.7 Vista de celda (derivada, para render)

```ts
type HighlightKind = "row" | "column" | "block" | "same";

interface CellView {
  index: number;
  value: Cell;
  given: boolean;
  selected: boolean;
  conflict: boolean;
  highlight: HighlightKind | null;   // UN valor, nunca una combinacion
  notes: Mask;                       // 0 = sin notas (SPEC-007)
  row: number;    // 0..8
  column: number; // 0..8
  block: number;  // 0..8
}
```

`CellView` es **derivada**: se calcula desde `GameState` + `ValidationResult` +
la seleccion. No se persiste y no se muta: se recalcula en cada render.

**Invariante de `highlight`:** es un unico valor, no un conjunto. Los cuatro
contextos se distinguen por `data-highlight="row|column|block|same"`, y una celda
que pertenece a mas de uno (por ejemplo, la seleccionada, que esta en su fila, su
columna y su bloque) toma **la precedencia fija**: `same` > `block` > `column` >
`row`. La precedencia esta en un unico modulo, para que el render no la invente.

## 2. Formato persistido (`localStorage`)

### 2.1 Claves

| Clave | Contenido |
|---|---|
| `kanam.sudoku.iphone.game` | la partida en curso (un objeto) |
| `kanam.sudoku.iphone.prefs` | preferencias (ultimo nivel usado; vacio en la v1) |

Las claves llevan el prefijo del proyecto, no el del dominio generico: el juego
vive en `gonzoblasco.github.io`, que es un subpath, y los `localStorage` de un
dominio se comparten entre paths. El prefijo evita colisiones con otra app del
mismo dominio.

### 2.2 Payload de la partida

```ts
interface SavedGame {
  schemaVersion: number;   // hoy: 1
  grid: Grid;              // 81
  givens: number[];        // indices
  selected: number | null;
  hintsUsed: number;
  elapsedMs: number;
  notes: Record<number, number>;
}
```

| Regla | Constraint | Test que falla al violarla |
|---|---|---|
| `schemaVersion` presente y <= la actual | una version futura se rechaza (no crashea) | `spec-005` |
| `grid.length === 81` | longitud exacta | `spec-005` |
| `givens` sin indices fuera de rango | 0..80 | `spec-005` |
| `selected` null o en 0..80 | se normaliza a `null` si es invalido | `spec-005` |
| `elapsedMs >= 0` | nunca negativo | `spec-005` |
| `notes` con claves en 0..80 | indices validos | `spec-005` |
| payload **no** incluye el historial | el historial no se persiste | `spec-005` |

**El historial NO se persiste.** Al reabrir, el historial arranca vacio: perder el
deshacer al reabrir es aceptable, perder la partida no. (El historial es de
memoria, y su tope de 1000 entradas no justify el costo de serializarlo en cada
guardado.)

### 2.3 Politica de version de esquema

- `schemaVersion: 1` es el formato actual.
- La migracion 0 -> 1 acepta payloads **sin** `schemaVersion` (el formato previo
  de la v1: `{ board, elapsed }`), tomando el board como grilla y el elapsed como
  tiempo. Es una migracion real, probada con un fixture.
- Un `schemaVersion` **futuro** (mayor que el actual) se **rechaza**: se descarta
  el payload y se arranca limpio. **Nunca** se intenta interpretar un formato
  desconocido.
- Un payload **corrupto** (no es JSON, o no tiene la forma) se descarta: se arranca
  limpio y se reporta `recovered: true`.

### 2.4 Almacenamiento inyectado

```ts
interface Storage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
```

La logica de juego **recibe** el `Storage` por parametro y **nunca** accede a
`localStorage` ni a `window` directamente. En el navegador se le pasa
`window.localStorage`; en los tests, un almacen en memoria. Consecuencia directa:
**todo el guardado y la restauracion son testeables sin DOM**.

Los errores del almacenamiento (cuota llena, permisos denegados, `localStorage`
inexistente) se capturan en la frontera: la app sigue jugable y reporta que no
puede guardar. **No** se propagan a la UI como una excepcion.

## 3. Lo que NO existe (y por que)

| No existe | Motivo |
|---|---|
| Base de datos / servidor / API | Fuera de alcance por pedido. El juego es local-first y sin cuentas (BRIEF, no-objetivos) |
| Cuentas, sesiones de usuario, telemetria | Fuera de alcance por pedido |
| Tablas, RLS, migraciones SQL | No hay base de datos. La "migracion" es la de `schemaVersion`, en un unico payload |
| Historial de partidas, records, ranking | Fuera de alcance (estadisticas). La v1 guarda **una** partida en curso |
| Multiplayer / estado compartido | Fuera de alcance |
| Cache del service worker como "esquema" | El precache es de archivos, no de datos. Su version se deriva del contenido de los archivos, y es ortogonal al `schemaVersion` del payload |

## 4. Donde vive cada cosa

```
src/
  core/            motor puro, sin DOM, testeado con node --test
    grid.ts        tipo Grid, validacion de forma (longitud, rango)
    candidates.ts  digitos legales por celda: la base de las notas automaticas
    geometry.ts    UNIDADES (27), PEERS, indice <-> (fila, columna, bloque)
    mask.ts        la mascara de 9 bits. UNICA convencion del arbol: bit (d-1)
    solver.ts      backtracking con MRV, solve() y countSolutions(grid, cap)
    techniques.ts  catalogo de tecnicas, cada una con su tier
    analysis.ts    estado de analisis: candidatos por celda, propagacion
    rater.ts       rating de un puzzle: nivel, tier, pasos, tecnicas
    generator.ts   generatePuzzle(difficulty, { seed, maxAttempts })
    validator.ts   findConflicts, conflictCells, isComplete, isSolved
  state/           estado de juego (puro, sin DOM)
    state.ts       GameState, apply(mutation), undo, redo
    persistence.ts serialize/deserialize + guardado con Storage inyectado
    timer.ts       tiempo efectivo de juego, con reloj inyectado
  ui/              capa DOM (cablea, no calcula)
    render.ts      dibuja el tablero desde CellView[] (valor en .cell-value, notas en .note-grid)
    notes-controls.ts  boton de modo notas, Auto y Limpiar
    keypad.ts      teclado 1-9 + borrar
    menu.ts        menu de niveles + estado de generacion
    victory.ts     pantalla de victoria
    app.ts         maquina de estados de la app: menu | generating | playing | victory
    pwa.ts         registro del service worker (solo en produccion)
  sw/              plantilla del service worker
scripts/
  generate-icons.mjs   escribe los PNG de los iconos (node:zlib, sin deps)
  gen-sw.mjs           emite el service worker con el precache real del build
```

| Dato | Dueno | Se serializa |
|---|---|---|
| `Grid` | `core/grid.ts` | si (en `SavedGame`) |
| `givens` | `state/state.ts` | si |
| `selected` | `state/state.ts` | si |
| `elapsedMs` | `state/timer.ts` | si |
| `notes` | `state/state.ts` | si (vacia en la v1) |
| `history` | `state/state.ts` | **no** |
| `CellView` | derivado | **no** |
| `CellView.notes` | derivado de `GameState.notes` | **no** |
| `Rating` | `core/rater.ts` | **no** (es de la generacion, no de la partida) |
| `Puzzle.solution` | `core/generator.ts` | **no** (se puede rederivar del puzzle) |
| Conflictos | derivado, `core/validator.ts` | **no** |
