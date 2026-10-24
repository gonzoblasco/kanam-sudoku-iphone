# kanam-spec

**ID:** SPEC-202610240002
**Title:** Validacion de reglas y marcado de conflictos
**Owner:** Gonzo
**Status:** Draft
**Priority:** P1

## Intent & Context

### Problema

El jugador escribe numeros y la app tiene que decirle, al instante, si ese numero
**rompe las reglas**: un 5 repetido en la misma fila, en la misma columna o en el
mismo bloque 3x3. El pedido lo pide explicitamente: *"Marcar en rojo los numeros
que rompen las reglas (repetidos en fila, columna o bloque)"*.

La trampa de este requerimiento es la **amplitud del marcado**. El error comun es
marcar solo la celda que el jugador acaba de escribir, dejando en rojo las demas
celdas del mismo conflicto, que tambien estan mal. Si el jugador puso un 7 en F3 y
hay otro 7 en F7, **las dos** estan en conflicto: las dos deben verse en rojo, y
al borrar una, la otra deja de estar en conflicto.

Ademas, la app necesita saber cuando el tablero esta **completo y correcto** (para
la pantalla de victoria), y cuando esta **completo pero incorrecto** (no debe
celebrar).

### Objetivo

Un modulo puro de validacion que:

1. Detecte conflictos concretos: que valor, en que celdas, en que unidades.
2. Exponga el conjunto de celdas en conflicto (no solo la ultima tocada).
3. Separe "pistas" de "jugada del jugador": una pista inicial nunca esta en
   conflicto por definicion (el generador garantiza un puzzle coherente).
4. Determine si el tablero esta resuelto.

### No-objetivo

- No es el generador (SPEC-001) ni el rating.
- No detecta puzzles con solucion multiple: eso es del motor de generacion.
- No renderiza: no sabe de DOM ni de clases CSS. Solo describe el estado.

### Modelo conceptual compartido

- **Unidad**: fila, columna o bloque 3x3 (27 en total).
- **Conflicto**: un mismo digito presente en dos o mas celdas de una misma unidad.
- **Celda en conflicto**: celda que participa en al menos un conflicto.
- **Tablero resuelto**: las 81 celdas con valor y sin ningun conflicto.
- **Pista (dada)**: celda con valor inicial, inmutable.
- **Jugada**: celda con valor puesto por el jugador.

## Requisitos funcionales

- **RF-1.** `findConflicts(grid)` devuelve la lista de conflictos: cada uno con el
  valor, el tipo de unidad (fila / columna / bloque), el indice de la unidad y el
  indice de cada celda participante.
- **RF-2.** `conflictCells(grid)` devuelve el conjunto de **todas** las celdas que
  participan en al menos un conflicto.
- **RF-3.** Un mismo valor que aparece 3 veces en una fila produce **un** conflicto
  con 3 celdas, no tres conflictos de a dos celdas.
- **RF-4.** `isSolved(grid)` es `true` solo si las 81 celdas tienen valor y no hay
  ningun conflicto.
- **RF-5.** `isComplete(grid)` es `true` si las 81 celdas tienen valor, **con o sin**
  conflictos. Un tablero completo pero con conflictos **no** es victoria.
- **RF-6.** `conflictedUnits(grid)` devuelve el conjunto de unidades que tienen
  algun conflicto, para poder resaltar la unidad entera y no solo las celdas.
- **RF-7.** La validacion distingue givens de jugadas: el resultado incluye que
  celdas son givens. Un conflicto **siempre** incluye al menos una jugada (un
  puzzle generado no tiene givens en conflicto).
- **RF-8.** El modulo es puro: no muta la grilla que recibe.

## Restricciones tecnicas

- TypeScript, sin build (Node 26 con type stripping).
- Cero dependencias de runtime.
- Sin DOM, sin `window`, sin timers.
- Las 27 unidades y las relaciones de peer (celdas que se ven entre si) se
  calculan **una vez** en un modulo de geometria compartido, no en cada validacion.
- Una grilla es siempre un array de 81 elementos con valores `0..9` (`0` = vacia).

## Modelo de datos minimo

```ts
type Cell = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
type Grid = Cell[];

type UnitKind = "row" | "column" | "block";

interface Conflict {
  value: number;                 // el digito en conflicto
  kind: UnitKind;
  unitIndex: number;             // 0..8 fila, 0..8 columna, 0..8 bloque
  cells: number[];               // indices de celdas (0..80)
}

interface ValidationResult {
  conflicts: Conflict[];
  conflictCells: number[];       // todas las celdas en conflicto
  conflictedUnits: { kind: UnitKind; index: number }[];
  complete: boolean;             // 81 celdas con valor
  solved: boolean;               // complete y sin conflictos
}
```

## 5. Acceptance Criteria

- Una grilla con un 5 repetido en una fila devuelve **exactamente un** conflicto de
  tipo `row`, con `value: 5` y **dos** celdas en `cells`.
- Una grilla con un 5 repetido **tres** veces en la fila devuelve **un** conflicto
  con **tres** celdas, no tres conflictos.
- Un 5 repetido en fila y en columna (dos unidades distintas) devuelve **dos**
  conflictos, uno por unidad.
- `conflictCells` devuelve la union de todas las celdas de todos los conflictos, sin
  duplicados.
- Borrar la celda que causaba el conflicto **elimina** el conflicto: el mismo
  `grid` con una celda en `0` deja de reportar ese conflicto y `conflictCells` no la
  incluye. El test es el par (grilla con conflicto, grilla sin) sobre la misma
  funcion.
- `isSolved` es `false` si el tablero esta completo pero tiene un conflicto, y
  `true` solo con las 81 celdas llenas y sin conflictos.
- `isComplete` es `true` con 81 valores y al menos un conflicto, mientras
  `isSolved` es `false` en ese mismo tablero. Los dos criterios se testean
  juntos.
- `findConflicts` **no muta** el array que recibe: el test compara una copia del
  array antes y despues de la llamada.
- `conflictedUnits` incluye cada unidad con conflicto una sola vez.
- Una grilla vacia (todo `0`) devuelve `conflicts: []`, `complete: false`,
  `solved: false`.
- Un tablero resuelto (la solucion de un puzzle generado) devuelve
  `conflicts: []` y `solved: true`.
- El modulo corre en `node --test` sin build ni jsdom.

## 6. Edge Cases & Error Handling

- **Grilla con valores fuera de rango** (`> 9` o negativos): la validacion los
  ignora como valores (no son digitos validos) y no los reporta como conflicto.
  La grilla se asume bien formada; el chequeo de forma es del modulo de tablero.
- **Grilla de largo distinto de 81**: error explicito, no un comportamiento
  indefinido.
- **Los givens nunca estan en conflicto por generacion**: si por un bug llegaran,
  el conflicto se reporta igual (la validacion no miente por cortesia) pero el
  test verifica que en los puzzles generados no ocurre.
- **Un valor repetido en una celda vacia**: una celda vacia no genera conflicto; el
  `0` no es un digito.
- **Celdas aisladas con un valor valido**: no hay conflicto, y tampoco hay unidad
  "conflictuada".
- **Board con dos valores iguales en unidades que no se ven** (por ejemplo, dos
  5 en filas distintas y columnas distintas): no hay conflicto, porque no
  comparten fila, columna ni bloque. El test lo cubre explicitamente.

## 7. Verification Plan

**Automatico** (motor puro, sin DOM):

```bash
cd ~/projects/kanam-sudoku-iphone
node --test test/
```

El suite debe incluir: conflicto simple de fila, de columna y de bloque; el caso de
tres valores iguales en una unidad; dos unidades en conflicto a la vez; la union sin
duplicados de `conflictCells`; el par (con conflicto, sin conflicto) al borrar una
celda; `complete` vs `solved`; la no-mutacion de la entrada; la grilla vacia; y una
solucion real de un puzzle generado que reporta `solved: true`.

**Evidencia a citar en el cierre:** la salida cruda de `node --test test/` con el
conteo de tests.
