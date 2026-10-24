# kanam-spec

**ID:** SPEC-202610240005
**Title:** Estado de juego extensible y persistencia de la partida en curso
**Owner:** Gonzo
**Status:** Draft
**Priority:** P1

## Intent & Context

### Problema

El pedido tiene un requerimiento que no es una funcion, es una **restriccion de
forma**: *"Disena el estado para que mas adelante pueda agregar deshacer, notas por
celda y guardado de partida sin reescribirlo"*.

Ese "sin reescribirlo" es el punto. La forma habitual de hacer un juego de sudoku
es tener un objeto `board` con el array de 81 numeros y, aparte, un `history` que
guarda snapshots, y otro `notes` con un array aparte, y otro `save` que serializa el
board. Cuando aparece el deshacer, hay que reescribir el board para que guarde el
historial; cuando aparecen las notas, hay que reescribir la serializacion; cuando
aparece el guardado, hay que reescribir el estado otra vez. Cada capacidad nueva
toca todo lo anterior.

La forma que no reescribe es: **un unico estado de juego con un historial de
mutaciones y una forma de aplicar/revertir**. Todo lo demas (deshacer, rehacer,
notas, guardado) se construye encima sin tocar el nucleo.

Y el segundo punto: si el jugador cierra la app a mitad de una partida y la vuelve
a abrir, **no pierde la partida**. El pedido no lo pide explicitamente, pero el
escenario de uso ("lo uso en Safari y lo agrego a la pantalla de inicio") lo
implica: una PWA que se usa a diario y pierde el progreso al cerrar es un toy. Y de
paso, la persistencia es la **unica forma de verificar que el estado es
serializable**, que es justamente lo que el "sin reescribirlo" exige.

### Objetivo

1. Un unico `GameState` que modela **la partida**, con historial de mutaciones
   (undo/redo-ready) y con soporte de notas (notes-ready) **ya en la estructura**,
   aunque la v1 no los exponga en la UI.
2. Un **mecanismo de mutacion unico**: toda escritura pasa por `apply(mutacion)`.
   No hay un segundo camino que escriba en el tablero.
3. Un **almacenamiento** con esquema versionado, que persiste la partida en curso
   y la restaura al reabrir.
4. Que la **extensibilidad sea verificable**, no una promesa: un test demuestra que
   la v2 puede agregar deshacer, notas y guardado **sin modificar el nucleo**.

### No-objetivo

- **La v1 no expone deshacer, notas ni rehacer en la UI.** La estructura los
  soporta; la interfaz no los muestra. Esta separacion es deliberada: el pedido
  los deja como extension futura.
- No hay backend, ni sincronizacion, ni cuentas, ni telemetria.
- No hay "guardar partida" manual con nombre: se guarda **una** partida en curso.
- No hay ranking ni records mas alla del tiempo de la partida en curso.

### Modelo conceptual compartido

- **Estado de juego (GameState)**: la partida en curso: grilla, givens, celda
  seleccionada, pistas usadas, tiempo, historial de mutaciones.
- **Mutacion**: una operacion con efecto reversible (`{ type: "set", index, value }`,
  `{ type: "clear", index }`). Toda escritura al tablero es una mutacion.
- **Historial**: pila de mutaciones aplicadas, con un puntero de posicion para
  deshacer y rehacer.
- **Notas (notes)**: mapa celda -> mascara de candidatos. **Presente en el
  estado**, vacio en la v1.
- **Partida en curso**: el estado completo de una partida, serializable.
- **Esquema de persistencia**: la version del formato de guardado, para poder
  migrar cuando el formato cambie.
- **Recovered**: la partida que se restauro del almacenamiento al reabrir.

## Requisitos funcionales

- **RF-1.** Existe un unico `GameState` con: grilla (81), conjunto de indices
  dados, celda seleccionada, contador de pistas usadas, tiempo transcurrido e
  historial.
- **RF-2.** Toda escritura pasa por `apply(mutacion)`. `setValue` y `clearValue`
  son las unicas operaciones publicas de escritura, y ambas construyen una
  mutacion y la aplican.
- **RF-3.** `apply` **no** muta un estado previo: cada mutacion produce un estado
  nuevo (o una version nueva del mismo estado con un historial consistente). El
  test lo verifica Comparing snapshots.
- **RF-4.** El historial guarda las mutaciones aplicadas y permite **deshacer** y
  **rehacer** (los metodos existen y funcionan, aunque la v1 no los exponga en la
  UI). Un test los ejercita.
- **RF-5.** Una mutacion nueva **descarta la rama de rehacer**: si se deshace y se
  escribe algo distinto, el "rehacer" deja de estar disponible.
- **RF-6.** El estado tiene un campo de **notas** (`notes`), con la misma forma que
  usaria la v2. En la v1 queda vacio y no se renderiza. Un test escribe una nota
  programaticamente, verifica que no aparece en el DOM y que al serializar el
  estado **si** esta.
- **RF-7.** El estado se **serializa** a un payload JSON con `schemaVersion`, y se
  **restaura** desde ese payload.
- **RF-8.** La partida en curso se guarda en `localStorage` con una clave propia, y
  se restaura al reabrir la app.
- **RF-9.** La persistencia **migra** de una version anterior del esquema cuando es
  posible, y **rechaza** un payload de version futura sin crashear.
- **RF-10.** Un `localStorage` **corrupto**, ausente o con un payload invalido no
  rompe la app: arranca limpio y reporta que hubo una recuperacion.
- **RF-11.** La partida guardada conserva **solo las pistas iniciales** y los
  valores que el jugador cargo, de forma distinguible: al restaurar, una dada
  sigue siendo dada (no editable) y una jugada sigue siendo editable.
- **RF-12.** Al reabrir, el **cronometro se retoma pausado**: el tiempo con la app
  cerrada no cuenta, y el jugador decide cuando seguir. (D5, cronometro simple.)
- **RF-13.** Abandonar una partida (volver al menu y empezar otra) **borra** lo
  guardado y **no** deja basura.
- **RF-14.** El tiempo transcurrido se guarda como **tiempo efectivo de juego**, no
  como reloj de pared: el tiempo en pausa no suma.
- **RF-15.** El estado es **testeable sin DOM**: la logica de juego no toca el DOM,
  y el almacenamiento se inyecta (no se accede a `localStorage` directamente desde
  la logica).

## Restricciones tecnicas

- TypeScript, sin build (Node 26 con type stripping).
- Cero dependencias de runtime.
- El acceso al almacenamiento es **inyectado** (`Storage` como parametro): la
  logica no toca `localStorage` ni `window` directamente. Eso la hace testeable con
  un almacen en memoria.
- El reloj es **inyectado** (`now`): los tests no esperan ni duermen.
- El historial tiene un **tope** (`LIMIT = 1000` entradas): una partida larguisima
  no crece la memoria sin limite; al pasarse, se descarta la entrada mas vieja,
  nunca el estado actual.
- El formato serializado es **JSON plano** (nada de clases, nada de funciones): lo
  que se guarda es lo que se puede inspeccionar.
- El estado guardado **no** es un snapshot de la UI: no tiene estilos, ni
  posiciones, ni referencias a nodos.

## Modelo de datos minimo

```ts
type Cell = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

type Mutation =
  | { type: "set"; index: number; value: Cell }
  | { type: "clear"; index: number };

interface GameState {
  grid: Cell[];               // 81
  givens: number[];           // indices de las pistas iniciales
  selected: number | null;
  hintsUsed: number;
  elapsedMs: number;          // tiempo efectivo de juego
  paused: boolean;
  history: { entries: Mutation[]; pointer: number };
  notes: Record<number, number>;   // celda -> mascara de 9 bits (vacia en v1)
}

interface SavedGame {
  schemaVersion: number;
  grid: Cell[];
  givens: number[];
  selected: number | null;
  hintsUsed: number;
  elapsedMs: number;
  notes: Record<number, number>;
}
```

## 5. Acceptance Criteria

- `setValue(4, 7)` seguido de `getValue(4)` devuelve `7`, y el **historial** tiene
  1 entrada.
- `setValue` sobre un indice que es una **dada** no cambia el valor y **no** agrega
  una entrada al historial.
- El estado **anterior** a una mutacion no cambia al aplicarla: el test guarda un
  snapshot del estado, aplica 20 mutaciones mixtas y verifica que el snapshot
  original sigue identico.
- `undo()` revierte la ultima mutacion y `redo()` la vuelve a aplicar: el estado
  vuelve a ser exactamente el inicial (comparacion profunda de la grilla y del
  resto de los campos).
- Tras deshacer y aplicar una mutacion **distinta**, `redo()` no tiene nada que
  rehacer: el estado final es el de la mutacion nueva.
- El historial **no crece sin limite**: tras aplicar mas de `LIMIT` mutaciones, el
  tamano del historial es `<= LIMIT` y el estado actual es correcto.
- El estado tiene un campo `notes` y, escribiendo en el a traves de la API del
  estado, **no aparece en el DOM** (el e2e lo comprueba) pero **si** aparece en el
  payload serializado. Ese par es la prueba de que la extension no requiere
  reescribir la UI.
- `serialize(state)` produce un JSON con `schemaVersion` y **sin** funciones ni
  referencias a nodos: el test hace `JSON.parse(JSON.stringify(payload))` y compara
  con el original.
- `deserialize` de un payload valido devuelve un estado equivalente al original.
- `deserialize` de un payload con `schemaVersion` **futuro** devuelve `null` (o un
  estado vacio) **sin lanzar**.
- `deserialize` de un payload **corrupto** (texto que no es JSON, o JSON que no
  tiene la forma) devuelve un estado vacio y marca `recovered: true`, sin lanzar.
- El almacenamiento se puede inyectar: un almacen en memoria de la API `Storage`
  (con `getItem`/`setItem`/`removeItem`) alcanza para testear todo el guardado y
  la restauracion, **sin tocar `localStorage` real**.
- Guardar y restaurar en un almacen en memoria **preserva** la grilla, el
  conjunto de givens, la seleccion, las pistas usadas y el tiempo.
- Tras restaurar, una celda que era dada sigue siendo **dada** (sigue en `givens` y
  no es editable) y una celda que era jugada sigue siendo editable.
- El tiempo guardado es el **tiempo efectivo**: con el reloj inyectado, un tramo en
  pausa no suma al `elapsedMs`.
- Al reabrir con una partida guardada, el cronometro arranca **pausado**:
  `paused === true` en el estado restaurado.
- Abandonar la partida **borra** el payload del almacenamiento: `getItem` devuelve
  `null` despues de abandonar.

## 6. Edge Cases & Error Handling

- **`localStorage` no disponible** (modo privado en algunos navegadores, o
  permisos): la app arranca igual, sin guardado, y reporta que no puede guardar.
  No crashea.
- **`localStorage` lanza al escribir** (cuota llena): la escritura falla, la app
  sigue jugable y reporta el fallo. El error no se propaga a la UI.
- **Payload de una version de esquema anterior**: se migra si la forma es
  reconocible; si no, se descarta y se arranca limpio.
- **Payload con `grid` de largo distinto de 81**: se descarta, no se intenta
  "rellenar".
- **Payload con indices de givens fuera de rango**: se descartan los invalidos, y
  si el payload queda inconsistente, se descarta entero.
- **`selected` guardado fuera de rango o `null`**: se normaliza a `null`.
- **Historial con una mutacion corrupta** (al deserializar): se descarta el
  historial y se conserva la partida. Perder el deshacer es mejor que perder la
  partida.
- **Dos mutaciones identicas consecutivas** (escribir 7 dos veces): la segunda es
  un no-op y **no** agrega entrada al historial. (El estado no cambia, y el
  historial no se infla con ruido.)
- **Deshacer cuando el historial esta vacio**: no-op, sin error.
- **Rehacer cuando no hay rama de rehacer**: no-op, sin error.
- **Escribir en una celda con indice fuera de rango (0..80)**: error explicito en
  la API del estado; la UI nunca lo produce.
- **El reloj inyectado retrocede** (o se llama dos veces en el mismo tick): el
  `elapsedMs` **nunca** decrece.

## 7. Verification Plan

**Automatico** (motor puro, sin DOM, con almacen y reloj inyectados):

```bash
cd ~/projects/kanam-sudoku-iphone
node --test test/
```

El suite debe incluir: mutacion y no-mutacion del estado previo; undo/redo ida y
vuelta exacta; descarte de la rama de redo; el tope del historial; el par
(notas presentes en el estado, ausentes en el DOM) —la parte del DOM, en el
e2e—; la ida y vuelta de serializacion; el rechazo de version futura; el payload
corrupto; la migracion de version vieja; la restauracion con givens distinguidos; el
tiempo que no suma en pausa; el reloj que no retrocede; y el borrado al abandonar.

**Manual**:

- En el iPhone: empezar una partida, escribir varios digitos, **cerrar la app
  desde el multitarea**, reabrirla, y confirmar que la partida esta intacta, con
  el cronometro pausado.

**Evidencia a citar en el cierre:** la salida cruda de `node --test test/` con el
conteo de tests, y el resultado del e2e de persistencia (recargar y recuperar).
