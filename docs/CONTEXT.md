# CONTEXT - Glosario del proyecto

<!-- project: github.com/gonzoblasco/kanam-sudoku-iphone -->

Glosario **autoritativo** del proyecto: un termino por concepto, con lo que el
termino **es**, y los sinonimos **rechazados** bajo _Avoid_.

Si un termino necesita significar algo distinto de lo que dice este archivo, eso es
un **bloqueo**: el significado se acuerda en la spec antes de seguir. Un termino
redefinido en silencio es la forma mas cara de perder tiempo.

---

## Puzzle

Grilla de 9x9 con celdas vacias y **exactamente una** solucion.

_Avoid_: sudoku (ambiguo: el juego, el puzzle y la app se confunden), partida (la
partida es la sesion de juego, no el puzzle), tablero (el tablero es la
representacion visual, no el dato).

## Solucion

Grilla 9x9 completa y valida, sin celdas vacias.

_Avoid_: respuesta, solucion final, resultado.

## Givens (pistas)

Las celdas del puzzle que traen un valor inicial, conservado por el generador.
**Inmutables** para el jugador: no se pueden editar ni borrar.

_Avoid_: dadas (termino interno valido, pero el glosario usa "pistas"), numeros
fijos, celdas bloqueadas (sugiere bloqueo por software, no por diseno del puzzle).

## Jugada

Celda con un valor que puso el jugador. Editable y borrable.

_Avoid_: entrada del usuario, numero del jugador, celda cargada.

## Unidad

Fila, columna o bloque 3x3. Hay **27** (9 filas + 9 columnas + 9 bloques).

_Avoid_: region (el termino del motor previo; aca es "unidad"), grupo, zona.

## Conflicto

Un mismo digito presente en dos o mas celdas de una misma unidad.

_Avoid_: error (generico: un error puede ser de cualquier tipo), duplicado, violacion.

## Celda en conflicto

Celda que participa en al menos un conflicto. Un mismo digito repetido en tres
celdas de una fila produce **un** conflicto con tres celdas.

_Avoid_: celda invalida ("invalida" suena a celda mal formada; el conflicto es de
contenido, la celda esta bien formada), celda roja (un color, no un concepto).

## Completo

El tablero tiene las 81 celdas con valor, **haya o no** conflictos.

_Avoid_: resuelto, ganado, terminado.

## Ganado

El tablero esta **completo y sin conflictos**. Es la unica condicion que dispara la
pantalla de victoria.

_Avoid_: completo (completo no implica ganado), resuelto, terminado, victoria (la
victoria es la pantalla; lo ganado es la condicion).

## Tecnica

Patron de deduccion que permite resolver una o mas celdas: candidato unico
(visible y oculto), par o trio naked, par o trio hidden, candidatos apuntados o
reclamados, X-Wing, Swordfish, rectangulo unico, cadenas, entre otros.

_Avoid_: truco, metodo, hint (el hint es lo que se le muestra al jugador: fuera de
v1), regla (una regla es una restriccion; una tecnica es un patron de resolucion).

## Tier

El nivel de dificultad de una **tecnica**, derivado de la tecnica y declarado en el
catalogo. Mas alto = tecnica mas avanzada.

_Avoid_: nivel (el nivel es del puzzle, no de la tecnica), dificultad (el glosario
la reserva para el puzzle), rating (el rating es el resultado de medir).

## Nivel

`facil` / `medio` / `dificil`. Se deriva **unicamente** del tier maximo medido del
puzzle. Es la unidad de dificultad que ve el jugador.

_Avoid_: dificultad (mixto con tier), modo, clase.

## Rating

El resultado de medir un puzzle: su nivel, su tier maximo, cuantos pasos necesito
y con que tecnicas se resolvio.

_Avoid_: score (el score es un numero; el rating es un conjunto), resultado, medida.

## Pareja (pair)

El conjunto de celdas y digitos que una tecnica usa como evidencia. En la v1 el
rating la cuenta; no se muestra al jugador.

_Avoid_: hint, sugerencia, combo.

## Estado de juego

La partida en curso: grilla, givens, celda seleccionada, pistas usadas, tiempo
efectivo, historial de mutaciones y notas.

_Avoid_: board (el board es la grilla: el estado es mas), juego, sesion (la sesion
de OpenClaw es otra cosa).

## Mutacion

Operacion con efecto reversible sobre el tablero: `{ type: "set", index, value }` o
`{ type: "clear", index }`. Toda escritura al tablero es una mutacion.

_Avoid_: accion, operacion (la operacion es el efecto; la mutacion es el registro
reversible), cambio, evento.

## Historial

Pila de mutaciones aplicadas, con un puntero de posicion que habilita deshacer y
rehacer.

_Avoid_: undo stack (el undo es la operacion, no el historial), historial de
navegador, snapshots (el historial guarda mutaciones, no copias del estado).

## Notas

Mapa de celda a mascara de candidatos. **Presente en el estado desde el primer dia,
vacia en la v1**: la UI no las renderiza.

_Avoid_: anotaciones, candidatos (un candidato individual es un digito de la
mascara), pencil marks, marcas.

## Partida en curso

El estado completo de una partida, serializable y persistible.

_Avoid_: save, guardado (el guardado es el mecanismo; la partida es el contenido),
progreso.

## Esquema de persistencia

La version del formato de guardado, que permite migrar cuando el formato cambia.
Hoy es `1`.

_Avoid_: version de save, version de la app, formato v2.

## Menu de niveles

Pantalla de inicio con los tres niveles (Facil / Medio / Dificil) y, si hay
partida en curso, la accion **Continuar**.

_Avoid_: home, start screen, selector de dificultad (esa es una parte de la
pantalla, no la pantalla), lobby.

## Continuar

La accion de retomar la partida en curso desde el menu de niveles.

_Avoid_: resume, load game, cargar partida, "abrir partida".

## Precache

El conjunto de archivos que el service worker guarda en cache al instalarse.

_Avoid_: cache (la cache es el mecanismo de almacenamiento; el precache es el
conjunto), offline cache, assets.

## Version de cache

Identificador del precache, derivado de su **contenido**. Un cambio de archivo la
cambia, y con ella se invalida la cache anterior.

_Avoid_: version de release, build version, version de la app (el release y la app
tienen su propia version; esta es un hash del contenido).

## Modo claro / Modo oscuro

Los dos temas de la UI, que siguen la preferencia del sistema
(`prefers-color-scheme`). Ambos cumplen contraste AA.

_Avoid_: tema claro (es un tema, no un modo), light mode / dark mode (terminos en
ingles, pero el glosario es en espanol), skin.

---

## Distinciones que hay que sostener

1. **Givens y jugadas son celdas distintas.** Una dada no se borra ni se edita; una
   jugada si. El estado persistido guarda las dos, distinguidas.
2. **Tier y nivel son cosas distintas.** El tier es de una tecnica; el nivel es del
   puzzle y se deriva del tier maximo medido. No existe una tabla "vacias ->
   nivel".
3. **Unidad y region.** En el motor previo la unidad se llamaba "region". Aca es
   "unidad", en todo el codigo y en los docs.
4. **Completo no es ganado.** Un tablero lleno con conflictos no es una victoria.
5. **Puzzle y partida.** El puzzle es el contenido generado; la partida es la sesion
   de juego sobre ese puzzle.
6. **Nivel y dificultad.** El nivel es el valor que ve el jugador (`facil`/`medio`/
   `dificil`); la dificultad es la propiedad medida que lo determina.
