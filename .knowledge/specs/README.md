# Specs - Kanam Sudoku iPhone

<!-- project: github.com/gonzoblasco/kanam-sudoku-iphone -->

## Indice

| Spec | Capacidad | Prioridad |
|---|---|---|
| [SPEC-001](SPEC-001-motor-generacion.md) | Motor de generacion con solucion unica y dificultad por tecnica | P1 |
| [SPEC-002](SPEC-002-validacion-conflictos.md) | Validacion de reglas y marcado de conflictos | P1 |
| [SPEC-003](SPEC-003-tablero-tactil.md) | Tablero tactil movil: seleccion, escritura, borrado, resaltados | P1 |
| [SPEC-004](SPEC-004-teclado-victoria.md) | Teclado numerico en pantalla y pantalla de victoria | P1 |
| [SPEC-005](SPEC-005-estado-persistencia.md) | Estado de juego extensible y persistencia de la partida | P1 |
| [SPEC-006](SPEC-006-pwa-menu.md) | PWA instalable, offline, iconos y menu de niveles | P1 |
| [SPEC-007](SPEC-007-notas.md) | Sistema de notas: candidatos por celda, manual y automatico | P1 |

## Modelo conceptual compartido

Definir el vocabulario **una vez**, aca. Cada spec usa estos terminos con este
significado. Si dos specs usan la misma palabra para dos cosas, eso es un bug de
vocabulario, no una variacion de estilo.

### Entidades del dominio

| Termino | Significado | Sinonimos **rechazados** |
|---|---|---|
| **Puzzle** | Grilla 9x9 con celdas vacias y **una unica** solucion | "sudoku" (ambiguo: el juego, el puzzle y la app se confunden), "partida" (la partida es la sesion de juego, no el puzzle) |
| **Solucion** | Grilla 9x9 completa y valida | "respuesta", "solucion final" |
| **Givens / pistas** | Celdas con el valor inicial que el generador conserva. **Inmutables** para el jugador | "dadas" (termino interno valido, pero el glosario usa "pistas"), "numeros fijos" |
| **Jugada** | Celda con un valor que puso el jugador. Editable | "entrada del usuario", "numero del jugador" |
| **Unidad** | Fila, columna o bloque 3x3. Hay 27 | "region" (el termino del motor previo: se usa "unidad" aca), "grupo" |
| **Conflicto** | Un mismo digito en dos o mas celdas de una misma unidad | "error", "duplicado", "violacion" |
| **Celda en conflicto** | Celda que participa en al menos un conflicto | "celda invalida" (invalida suena a celda mal formada; el conflicto es de contenido) |
| **Tecnica** | Patron de deduccion que resuelve celdas (candidato unico, par naked, X-Wing, rectangulo unico...) | "truco", "hint" (el hint es lo que se le muestra al jugador: fuera de v1) |
| **Tier** | Nivel de dificultad de una tecnica, derivado de la tecnica. Mas alto = mas avanzada | "nivel" (el nivel del puzzle es una funcion del tier; no son lo mismo), "dificultad" |
| **Nivel** | `facil` / `medio` / `dificil`. Se deriva **unicamente** del tier maximo medido | "dificultad" (mixto con tier: aca nivel = el del puzzle), "modo" |
| **Rating** | Resultado de medir un puzzle: nivel, tier maximo, pasos, tecnicas usadas | "score" (el score es numerico; el rating es un conjunto) |
| **Pareja (pair)** | El conjunto de celdas y digitos de una tecnica, usada como evidencia | "hint", "sugerencia" |
| **Estado de juego** | La partida en curso: grilla, givens, seleccion, pistas usadas, tiempo, historial | "board" (el board es la grilla: el estado es mas), "juego" |
| **Mutacion** | Operacion con efecto reversible (`set` / `clear`). Toda escritura al tablero | "accion", "operacion" (la operacion es el efecto; la mutacion es el registro) |
| **Historial** | Pila de mutaciones aplicadas, con puntero de posicion | "undo stack", "undo" (el undo es la operacion sobre el historial) |
| **Notas** | Mapa celda -> mascara de candidatos. **Presente en el estado, vacio en la v1** | "anotaciones", "candidatos" (un candidato individual es un digito de la mascara) |
| **Partida en curso** | El estado completo de una partida, serializable | "save", "guardado" (el guardado es el mecanismo; la partida es el contenido) |
| **Esquema de persistencia** | La version del formato de guardado, para poder migrar | "version de save", "formato v2" |
| **Menu de niveles** | Pantalla de inicio con Facil / Medio / Dificil (y "Continuar") | "home", "start screen", "seleccion de dificultad" (esa es una parte, no toda la pantalla) |
| **Continuar** | Accion de retomar la partida en curso | "resume", "load game" |
| **Precache** | Conjunto de archivos que el service worker guarda en cache al instalar | "cache", "offline cache" |
| **Version de cache** | Identificador derivado del **contenido** del precache | "build version", "version de release" (no es la version del release: es un hash del contenido) |

### Distinciones que hay que sostener

1. **Givens y jugadas son celdas distintas.** Una dada no se borra ni se edita; una
   jugada si. El estado persistido guarda las dos, distinguidas.
2. **Tier y nivel son cosas distintas.** El tier es de una tecnica; el nivel es del
   puzzle y se deriva del tier maximo. No hay una tabla "vacias -> nivel".
3. **Unidad y region.** En el motor previo la unidad se llamaba "region". Aca es
   "unidad", en todo el codigo y en los docs.
4. **Completo no es ganado.** Un tablero lleno con conflictos no es una victoria.
5. **Puzzle y partida.** El puzzle es el contenido generado; la partida es la sesion
   de juego sobre ese puzzle.

## Relacion entre specs

```
SPEC-001 (motor)  ──┐
SPEC-002 (validacion) ──┼──> SPEC-005 (estado) ──> SPEC-003 (tablero) ──> SPEC-004 (teclado/victoria)
                      └──> SPEC-006 (PWA/menu)
```

- **SPEC-005** consume el puzzle de **SPEC-001** y usa **SPEC-002** para saber si
  hay conflictos y si la partida esta ganada.
- **SPEC-003** dibuja el estado de **SPEC-005**; no calcula conflictos ni
  resaltados por su cuenta (los recibe).
- **SPEC-004** opera sobre la seleccion de **SPEC-003** y dispara la victoria que
  decide **SPEC-002**.
- **SPEC-006** envuelve todo: el menu genera con **SPEC-001**, y el service
  worker sirve el build completo.

## Fuera de alcance en la v1

Las capacidades C11, C13-C17 del discovery (hints, deshacer visible, estadisticas,
cuentas/backend, variantes, notificaciones) **no** tienen spec: estan fuera de la v1
por decision de producto. Las que la v1 deja "preparadas" (notas en el estado,
historial con undo/redo) tienen su criterio de verificacion **dentro** de SPEC-005,
y esa verificacion es exactamente la prueba de que la extension no requiere
reescribir el nucleo.

**C12 (notas por celda) entro en la v1 el 2026-10-24**, a pedido de Gonzo, y tiene
su propia spec (SPEC-007). Es la **primera prueba real** de ADR-0004: la
capacidad se agrego entera y el nucleo (`core/`, `state/state.ts`) no cambio de
forma, porque el estado ya tenia `notes` y su API propia desde el primer dia.

## Como se validan

```bash
bash ~/.agents/skills/spec-driven-development/scripts/validate-spec.sh \
  ~/projects/kanam-sudoku-iphone/.knowledge/specs
```

El checker exige metadata (`ID`, `Title`, `Owner`, `Status`, `Priority`), las
secciones de contexto, `Acceptance Criteria`, `Edge Cases & Error Handling` y
`Verification Plan`, y rechaza placeholders. Los criterios de aceptacion tienen que
ser **binarios y evaluables con un comando** ("el POST devuelve 201", no "funciona
bien").
