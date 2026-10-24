# ADR-0004: Un unico GameState con historial de mutaciones, extensible sin reescribir el nucleo

- **Status:** accepted
- **Date:** 2026-10-24
- **Deciders:** Gonzo / Kanam

## Context

El pedido tiene un requerimiento que no es una funcion, es una **restriccion de
forma**: *"Disena el estado para que mas adelante pueda agregar deshacer, notas por
celda y guardado de partida sin reescribirlo"*.

La forma habitual de hacer esto es tener un objeto `board` con 81 numeros, y
despues, cuando aparece el feature, agregar un `history` que guarda snapshots, un
`notes` con un array aparte, y un `save` que serializa el board. Cada capacidad
nueva toca todo lo anterior: el deshacer obliga a reescribir el board para que
lleve historial; las notas obligan a reescribir la serializacion; el guardado
obliga a reescribir el estado. Eso es exactamente lo que el pedido quiere evitar.

El riesgo es concreto y ya se pago en la historia del dominio: el `kanam-sudoku` v1
llego a tener **dos convenciones de mascara de candidatos conviviendo**
(`1 << (d-1)` en `analysis.js` y `1 << d` en `solver.js`, documentadas como
"ambas validas"), y el `kanam-logik` (v2 en borrador) nacio precisamente para
arreglar eso. Son symptomaticos del mismo problema: un nucleo que crece por
parches en vez de por una decision de forma.

Ademas, en la v1 hay tres capacidades que el pedido excluye pero que el estado tiene
que **dejar el lugar**: deshacer/rehacer, notas por celda y (parcialmente) mas
opciones de guardado. Si la v1 no modela esas cosas, la v2 las tiene que agregar
tocando el nucleo: el pedido lo prohibe explicitamente.

Y hay un segundo motivo, mas PRACTico: **la persistencia es la prueba de que el
estado es serializable**. Si el estado se puede guardar y restaurar, entonces es
un estado de datos y no un objeto con referencias a nodos del DOM. Esa propiedad
no se puede afirmar: se verifica.

## Decision

**Un unico `GameState`, con historial de mutaciones, y con un unico camino de
escritura.**

Concretamente:

1. **Un solo `GameState`** modela la partida en curso: grilla (81 celdas),
   conjunto de indices dados, celda seleccionada, pistas usadas, tiempo efectivo,
   historial de mutaciones y notas.
2. **Toda escritura pasa por `apply(mutacion)`**. `setValue` y `clearValue` son las
   unicas operaciones publicas de escritura, y ambas construyen una mutacion
   (`{ type: "set", index, value }` / `{ type: "clear", index }`) y la aplican.
   **No hay un segundo camino que escriba en el tablero.**
3. **El historial guarda mutaciones**, no snapshots completos, y tiene un puntero
   de posicion. `undo()` y `redo()` existen y funcionan **en la v1**, aunque la UI
   no los exponga. Una mutacion nueva descarta la rama de redo. Tope de 1000
   entradas: al pasarse se descarta la mas antigua, nunca el estado actual.
4. **Las notas existen en el estado** (`Record<indice, mascara>`), vacias en la v1.
   La UI no las renderiza; el estado las serializa. Un test demuestra el par:
   presentes en el payload, ausentes en el DOM.
5. **El almacenamiento se inyecta**: la logica no toca `localStorage` ni `window`.
   El `Storage` y el reloj (`now`) entran por parametro, lo que hace que todo sea
   testeable sin DOM y sin esperar.
6. **El formato persistido es JSON plano con `schemaVersion`**, con migracion
   desde versiones anteriores y rechazo de versiones futuras. Un payload corrupto
   no rompe la app: arranca limpio y reporta `recovered`.
7. **La partida guardada conserva la distincion dada / jugada**, y el cronometro se
   retoma **pausado** al reabrir (el tiempo con la app cerrada no cuenta).

## Alternatives considered

| Alternative | Why it was discarded |
|---|---|
| **Estado plano (`board` + `history` + `notes` + `save` como campos separados)** | Es la forma que el pedido prohibe explicitamente. Cada capacidad nueva toca todo lo anterior, y es la que produjo la doble convencion de mascara del v1. |
| **Historial de snapshots completos** (copiar el estado entero en cada paso) | Simple de implementar, pero cada entrada ocupa el estado completo (81 celdas + notas + historial) y una partida larga genera memoria notable. Ademas, con snapshots, "rehacer" y "deshacer" no tienen la granularidad de una mutacion: deshacer un `set` no puede distinguirlo de un `clear` si el valor final coincide. La alternativa de guardar **mutaciones** da el mismo comportamiento con una fraccion del tamano y con la semantica correcta. |
| **Imutabilidad total (el estado es un valor, cada operacion devuelve uno nuevo)** | Es la forma mas limpia conceptualmente, pero para un juego con 81 celdasedited y una UI que re-renderiza, significa copiar el estado completo en cada pulsacion. Se adopta una via intermedia: `apply` **no muta el estado previo** (el test lo verifica con un snapshot), pero el estado vivo se actualiza in-place para no garbage-coleccionar 81 arrays por pulsacion. La inmutabilidad del nucleo (que el test mide) se conserva; la del objeto vivo, no. |
| **Redux / Zustand / signals como gestion de estado** | Aportan trazabilidad y herramientas de devtools, pero el estado de un sudoku es un arbol de campos con dos operaciones de escritura. La libreria agrega dependencia (contra ADR-0001) y ceremonia sin resolver un problema real. La gestion de estado **de la app** (que pantalla esta activa) es un problema trivial y se resuelve con un unico objeto. |
| **Command pattern completo con comandos reificados y middleware** | Es la generalizacion de la decision tomada, y es sobreingenieria para dos operaciones (`set` y `clear`). El historial de mutaciones ya da lo que hace falta: deshacer, rehacer, y una traza de "que se hizo". |
| **Persistencia con IndexedDB** | IndexedDB es asincrono y mas potente, pero el dato a persistir es **un** objeto pequeno (una partida). `localStorage` es sincrono, suficiente, y no requiere una promesa ni un transaction wrapper. IndexedDB tiene sentido cuando hay multiples objetos o consultas; aca hay uno. |
| **Persistir solo el puzzle y reconstruir la partida** | La partida no es solo el puzzle: hay valores del jugador, la seleccion y el tiempo. Persistir solo el puzzle pierde todo eso, que es justamente lo que el jugador quiere conservar. |
| **No persistir en la v1** | El pedido no lo pide explicitamente. Pero la persistencia es (a) lo que hace que la app sea usable a diario, (b) la unica forma de **verificar** que el estado es serializable, y (c) la que prepara el "guardado de partida" que el pedido menciona como extension. Sin ella, la v2 "agrega guardado de partida" tocando el nucleo: exactamente lo que el pedido prohibe. |

## Consequences

**Positive:**
- **La extension no reescribe el nucleo**: la v2 agrega los botones de deshacer y el
  modo de anotaciones **sin tocar** `GameState`, el motor ni el render del tablero.
  Es la garantia que el pedido pide, y hay un **test que la demuestra** en vez de
  una promesa en un doc.
- **El estado es un dato, no un objeto**: se serializa, se restaura y se compara
  con `JSON.parse(JSON.stringify(...))`. Esa propiedad es lo que hace posible la
  persistencia y lo que hace testeable el estado sin DOM.
- **El historial da undo/redo de regalo** cuando la v2 lo quiera: el mecanismo ya
  esta, probado y con tope de memoria.
- **La logic es testeable sin esperar**: reloj y almacenamiento inyectados, los
  tests corren en milisegundos y son deterministas.
- **Una sola convencion**: el catalogo de tecnicas, las notas y el estado usan el
  mismo esquema de mascara, declarado en un unico modulo. Se evita la doble
  convencion que el v1 Suffert.
- **Los tests del estado son deterministas**: sin esperas, sin `Date.now` real, sin
  `localStorage` real.

**Negative / costs:**
- **Mas ceremonia que un estado plano**: `apply` + mutaciones + historial es mas
  codigo que `board[index] = value`. La ceremonia se paga una vez y compra la
  extension.
- **El historial ocupa memoria**: hasta 1000 mutaciones por partida. Es poco (unas
  decenas de KB), pero no es cero, y el estado serializado **no** incluye el
  historial (se reconstruye vacio al restaurar: perder el deshacer al reabrir es
  aceptable, perder la partida no).
- **El par (notas en el estado, notas fuera de la UI) es contraintuitivo** para
  quien lea el codigo sin el contexto: parece codigo muerto. Se mitiga con un
  comentario explicito y con el test que lo verifica.
- **"No muta el estado previo" no es inmutabilidad total**: el objeto vivo se
  actualiza in-place. Un developer que asuma inmutabilidad total (y comparta
  snapshots) puede surprising: por eso el test lo verifica explicitamente.
- **La migracion de esquema es trabajo futuro**: cuando el formato cambie, hay que
  escribir la migracion. Hoy hay una migracion 0 -> 1 que no migra nada (el
  formato v1 es el primero); el mecanismo esta probado con un fixture de version
  vieja.

## Reversibility

**Costo medio-bajo.** Quitar el historial es borrarlo del estado y de `apply`, pero
eso **rompe la promesa del pedido** (la extension sin reescribir el nucleo), asi
que no es una operacion que se vaya a hacer. Lo que si es reversible: el soporte
de notas (un campo del estado), el tope del historial (una constante) y el formato
persistido (con su `schemaVersion` y su migracion, un cambio de formato es
migrable, no rompe). Lo **irreversible** es el `schemaVersion`: una vez publicado un
formato, los clientes antiguos no pueden leer uno nuevo, y por eso el rechazo de
version futura tiene que ser un no-op silencioso y no un error.
