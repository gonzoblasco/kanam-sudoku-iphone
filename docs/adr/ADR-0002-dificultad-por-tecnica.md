# ADR-0002: La dificultad se define por la tecnica de resolucion, no por la cantidad de celdas vacias

- **Status:** accepted
- **Date:** 2026-10-24
- **Deciders:** Gonzo / Kanam

## Context

El pedido pide tres dificultades (Facil, Medio, Dificil) con puzzles generados en el
momento. La pregunta de diseno es: **que hace que un puzzle sea dificil?**

La respuesta obvia - "cuantas mas celdas vacias, mas dificil" - es falsa en la
practica, y el error se paga en el juego: un puzzle con 45 vacias puede resolverse
con candidatos unicos y ser un paseo, mientras que uno con 35 vacias que exige
detectar un X-Wing para salir de un atasco es un quilombo. Gonzo lo confirmo
explicitamente en la ronda de decisiones: eligio "por tecnica de resolucion" sobre
"por cantidad de celdas vacias".

Ademas, "cuantas mas vacias" tiene un problema adicional: **es monotono y
predecible**, asi que un jugador que ya conoce el truco sabe que el "Dificil" es
"el que tiene mas huecos", y el nivel deja de comunicar nada.

El punto de partida tecnico: el motor previo del workspace (`kanam-sudoku` v1)
ya tenia un *rater* que derivaba el nivel del tier de la tecnica, y un research
documentado de los niveles por tecnica. Ese es el modelo correcto, y la leccion
del v1 es que **la tabla de tier por tecnica si es explicita, pero el mapeo
tier -> nivel tiene que ser uniforme y medido**, no escrito a mano por puzzle.

## Decision

**La dificultad de un puzzle es el tier maximo de la tecnica que hace falta para
resolverlo.** El generador **mide** el puzzle con el catalogo de tecnicas y lo
clasifica; nunca le pone la etiqueta y espera que sea cierto.

Concretamente:

- El motor tiene un **catalogo de tecnicas**, cada una con un **tier** (una
  propiedad de la tecnica, declarada en el catalogo: no un heuristico por puzzle).
- El **rating** de un puzzle es el resultado de resolverlo con el catalogo:
  devuelve `maxTier`, `steps`, `techniqueCounts` y el `difficulty` derivado.
- El **mapeo tier -> nivel** (`facil` / `medio` / `dificil`) se aplica de forma
  uniforme a partir del `maxTier` medido.
- El generador **filtra por el nivel pedido**: produce candidatos y mide cada uno
  hasta que el nivel medido coincide con el pedido. Si agota los intentos,
  devuelve `matched: false` con el nivel **realmente medido**, y la UI lo dice
  (spec-006) en vez de fingir.
- **El vacio de celdas no participa del calculo del nivel.** Se usa como
  heuristica de *cuanto quitar* al generar, no como criterio de dificultad.

El catalogo de la v1 cubre, como minimo: candidato unico visible y oculto, pares y
trios naked y hidden, candidatos apuntados y reclamados, X-Wing, Swordfish, y al
menos una tecnica de nivel avanzado (rectangulo unico o cadena) para que
"Dificil" sea una categoria real y no un synonym de "Medio con mas vacias".

## Alternatives considered

| Alternative | Why it was discarded |
|---|---|
| **Dificultad por cantidad de celdas vacias** | Es monotono, predecible y falso: la dificultad real esta en la tecnica que hace falta, no en la cuenta de casillas. Un "Dificil" con 45 vacias resueltas por candidatos unicos hace que el jugador sienta que el nivel miente. Descartado por Gonzo de forma explicita. |
| **Mixto: vacios Y tecnica** | Temptador (el motor previo lo rozaba con "metas de huecos" calibradas empiricamente), pero mezcla dos señales que no se miden igual: las vacias no dicen nada, y agregar la condicion de vacios como **criterio** (no como heuristica de generacion) agrega un segundo parametro que el jugador no puede razonar. Se descarta como criterio; se conserva la idea de usar las vacias como heuristica de generacion. |
| **Dejar que el jugador etiquete la dificultad** | El generador no clasifica y cada puzzle es "dificil" por decreto. La UI mostraria tres grupos de puzzles sin diferencia real, y el jugador no tendria forma de notar la mejora. |
| **Dificultad por tiempo de resolucion estimado** | Depende de un modelo de "cuanto tarda una persona", que es una conjetura no verificada y varia por jugador. Ademas el mismo motor no puede clasificar sin una tabla de tiempos, que es tan arbitraria como la de vacias pero mas cara de mantener. |
| **4 niveles (facil / medio / dificil / experto)** | El motor previo tenia 4 y la UI exponia 3: una discrepancia que el propio v1 reconocio como deuda. El pedido pide 3. Se implementan 3 y el motor no inventa un cuarto. Si aparece el cuarto, se agrega con el mismo mecanismo (tier -> nivel), no como caso especial. |
| **Importar un catalogo de tecnicas de un solver externo** | Un solver como `sudoku-solver` o `sudoku.js` trae su propio catalogo, con su propio modelo de datos y su propia jerarquia de tiers, que habria que traducir. El motor propio da control del tier (que es lo que define el nivel) y evita una dependencia de runtime. |

## Consequences

**Positive:**
- "Facil" es facil **de verdad**: un puzzle que se resuelve con candidatos unicos
  se siente facil para cualquiera, sin importar cuantos huecos tenga.
- La generacion puede **filtrar por el nivel pedido** con un criterio verificable:
  el test mide el nivel de los puzzles entregados y compara con el pedido.
- El sistema es **honesto por construccion**: si no encuentra un puzzle del nivel
  pedido, lo dice con `matched: false`, y el jugador no recibe un puzzle
  etiquetado como "Dificil" que en realidad es Facil.
- El catalogo de tecnicas **es la base de los hints** de una v2 futura: si el motor
  detecta la tecnica, la v2 puede explicarla sin cambiar el motor.

**Negative / costs:**
- **El generador es mas lento.** Medir un puzzle (resolverlo con el catalogo) cuesta
  mucho mas que generarlo. Un "Dificil" puede necesitar muchos candidatos
  descartados antes de dar con uno del tier correcto. Hay que medir el tiempo real
  en el iPhone y acotar los intentos; si es molesto, la UI muestra "Generando..."
  (spec-006) y el limite de intentos esta en el generador.
- **El catalogo de tecnicas hay que mantenerlo.** Si el catalogo no cubre un
  patron que aparece en un puzzle valido, el rating puede devolver `solved: false`
  para un puzzle que un humano resuelve en un segundo. Eso es honesto, pero
  significa que "Dificil" se define por lo que el motor **sabe medir**, no por
  lo que un experto podria hacer. Hay que aceptarlo explicitamente.
- **Un tier por tecnica es knowledge que envejece.** Las tecnicas no cambian, pero
  sus limites si: un "hidden pair" puede ser mas o menosadvanced segun la
  convencion. El tier esta en un unico lugar (el catalogo) para que ajustarlo sea
  una edicion de una linea.
- El motor previo tiene **mas** tecnicas (tier 3) ya implementado; este proyecto
  no las copia y arranca con un catalogo propio, mas chico al principio.

## Reversibility

**Costo bajo.** El nivel es una funcion del `maxTier`, en un solo modulo. Cambiar la
tabla de umbrales o agregar un cuarto nivel es editar ese modulo y sus tests: el
formato de la grilla, del estado y de la UI no cambian. Lo **caro** de revertir no
es el nivel, sino el catalogo de tecnicas: si el catalogo resultara insuficiente
(por ejemplo, si generar "Dificil"|resultara demasiado lento), la alternativa no
es cambiar el criterio sino **ampliar el catalogo**, que es trabajo incremental y
localizado.
