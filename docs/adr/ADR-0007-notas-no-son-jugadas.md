# ADR-0007: Las notas por celda no son jugadas: viven fuera del historial de mutaciones

- **Status:** accepted
- **Date:** 2026-10-24
- **Deciders:** Gonzo / Kanam

## Context

Las notas por celda (la capacidad C12) quedaron **fuera de la v1** por decision de
producto: el pedido original las excluia y `SPEC-005` las declaraba como
extension futura. Gonzo las pidio el 2026-10-24, ya publicado el juego.

La v1 las tenía **preparadas**, no implementadas. `GameState.notes` existia desde
el primer dia, el payload persistido ya las contemplaba desde `schemaVersion` 1, y
la API `setNote`/`getNote` estaba escrita y testeada. La razon era ADR-0004: el
nucleo tiene que permitir agregar deshacer, notas y guardado **sin reescribirlo**,
y esa promesa solo se cumple si la extension llega y el nucleo no cambia.

La pregunta de diseno que decide el resto es: **una nota es parte de la partida o
es una ayuda de trabajo?**

Si fuera parte de la partida, tendria su propia historia: el jugador deshiciera
"marcar el 5" como deshace "poner el 5". En la practica eso es molesto: el
deshacer de una nota casi no se usa, porque un candidato equivocado se corrige
marcando y desmarcando, que es mas rapido que dos pulsaciones de deshacer. Y
mezclar las dos historias en un solo historial hace que el undo del tablero mueva
cosas que el jugador no relaciona.

Hay una razon tecnica mas: la nota **no cambia el valor de la celda**. Si
entrara al historial de mutaciones, `apply` tendria que distinguir dos tipos de
mutacion (una que cambia el valor y una que no), y el invariante de SPEC-005
("apply no muta el estado previo, y una mutacion que no cambia nada no genera
entrada") se volveria mas dificil de sostener.

## Decision

**Una nota no es una jugada: no cambia el valor de una celda y no entra al
historial de deshacer.**

Concretamente:

- `setNote`, `toggleNote`, `setAutoNotes` y `clearNotes` viven **fuera** de
  `apply` y **no** agregan entradas al historial de mutaciones.
- `apply` sigue siendo **el unico camino de escritura del valor de una celda**,
  y el historial sigue siendo el historial de las jugadas.
- Las notas **se guardan** con la partida (el payload ya las contemplaba) y se
  recuperan al continuar.
- Los **candidatos automaticos** ("Auto") se calculan con el **mismo motor** que
  las tecnicas de resolucion (`src/core/candidates.ts`): una nota automatica
  nunca ofrece un digito que el motor ya descarto.
- En la UI, **el valor de una celda y sus notas son informacion distinta**: viven
  en elementos separados (`.cell-value` y `.note-grid`), y una celda con valor
  **oculta** sus notas (vuelven a verse al borrar el valor).
- El **modo notas** es un estado de la interfaz, no del juego: no se persiste y
  no altera las reglas.

## Alternatives considered

| Alternative | Why it was discarded |
|---|---|
| **Las notas entran al historial de deshacer** | El jugador deshiciera "marcar el 5" mezclado con "poner el 5", y el historial de la partida dejaria de reflejar las jugadas. Ademas obliga a `apply` a distinguir mutaciones que cambian el valor de las que no, debilitando el invariante de SPEC-005. |
| **Las notas se borran al escribir un valor** | Es lo que hace la v1 de `kanam-sudoku` ("borrar un numero no rompe las notas" es su regla). Descartado: el jugador que anota 2, 5 y 7 y luego escribe el 2 quiere **recuperar** las notas cuando se equivoca. Borrarlas le haria perder el trabajo. En la v1 de este proyecto la nota se **oculta** pero se conserva. |
| **Un historial separado para las notas** | Habria dos pilas de undo, dos teclas de deshacer y una UI que tiene que explicar cual aplica. El beneficio (deshacer una nota) es marginal: marcar y desmarcar es mas rapido. |
| **Las notas automaticas se calculan en un modulo aparte, con su propia logica de candidatos** | Habria **dos** lugares que saben que digitos son legales: el motor de tecnicas y el de notas, que divergen sin que nadie lo note. Se usa el motor: una nota automatica y lo que el motor considera posible son la misma cosa. |
| **Un editor de notas con mini-teclado dentro de la celda** | Un teclado por celda en un tablero de 9x9 en un iPhone de 390px es imposible de usar con el dedo, y multiplica los objetivos tactiles por 81. El teclado numerico de abajo, con el modo notas, resuelve el caso con un solo teclado. |
| **Mostrar las notas como texto plano ("257") en vez de la grilla 3x3** | Ocupa menos codigo, pero no es legible: no se puede saber que el 5 es el 5 y no el 2. La disposicion 3x3 es la convencion de todos los sudokus y la que el jugador ya sabe leer. |

## Consequences

**Positive:**
- **La promesa de ADR-0004 se cumple y queda demostrada**: la v2 agrego una
  capacidad completa (modo, automaticos, limpieza, render, persistencia) y el
  nucleo (`core/`, `state/state.ts`) **no cambio de forma**: las notas ya estaban
  ahi. Eso es exactamente lo que la decision original compraba.
- **Un solo camino de escritura del valor**: `apply` sigue siendo el unico, y su
  invariante se sostiene sin excepciones.
- **El historial de la partida significa algo**: las entradas son jugadas, y el
  deshacer deshace jugadas.
- **Las notas automaticas no pueden mentir**: salen del motor, asi que un
  candidato que el motor descarto no aparece.
- **El DOM distingue valor de anotaciones**, lo que hace la celda legible para
  un lector de pantalla y para el e2e.

**Negative / costs:**
- **Deshacer no deshace notas.** Un jugador que marca muchas notas y se equivoca
  tiene que desmarcarlas a mano. Se acepta: el costo de esa decision (dos
  historiales) es mayor que el beneficio.
- **El modo notas es un estado extra de la interfaz** que hay que mantener
  coherente con el teclado (es un estado que no se persiste, y por lo tanto se
  reinicia al recargar).
- **La grilla de notas agrega DOM**: 9 elementos por celda anotada. Medido: el
  bundle paso de 23.8 kB a 26.8 kB (8.76 kB gzip), sin impacto apreciable.
- **El calculo automatico es O(celdas x unidades)**: instantaneo a este tamano
  (58 celdas vacias en el tablero de referencia), pero crece con el tablero.

## Reversibility

**Costo bajo.** La decision de diseno esta aislada en cuatro funciones
(`setNote`, `toggleNote`, `setAutoNotes`, `clearNotes`) y en el hecho de que
**no** llamen a `apply`. Convertir las notas en jugadas seria agregar un tipo de
mutacion y una pila de historial, o un flag en `Mutation`: es un cambio
acotado, en un solo modulo, con el riesgo de que el historial de la partida
deje de significar "las jugadas".

La parte cara de revertir no es el historial: es el **formato persistido**. Las
notas ya estan en el payload (`schemaVersion` 1), asi que un cliente que las
conoce y otro que no, conviven: la carga ignora el campo que no entiende. El
formato no se rompe.
