# kanam-spec

**ID:** SPEC-202610240001
**Title:** Motor de generacion de puzzles con solucion unica y dificultad por tecnica
**Owner:** Gonzo
**Status:** Draft
**Priority:** P1

## Intent & Context

### Problema

El juego necesita puzzles generados **en el momento** en el dispositivo, con tres
niveles de dificultad (Facil, Medio, Dificil), y cada puzzle tiene que tener
**exactamente una solucion**. Un puzzle con dos soluciones no es un sudoku: el
jugador puede llenar el tablero de una forma "correcta" que el juego marca como
error, o al reves, un tablero valido que el juego rechaza.

La dificultad no se define por la cantidad de celdas vacias (D2): un puzzle con 30
vacias puede ser mas facil que uno con 40, porque lo que cuesta no es completar
casillas sino **deducir** valores. La dificultad real la define **la tecnica de
resolucion que hace falta**: un puzzle que se resuelve con candidatos y pares
naked es Facil; uno que exige cadenas (X-Wing, Swordfish) o rectangulos unicos es
Dificil.

### Objetivo

Un modulo de motor, puro y testeable sin DOM, que:

1. Genere un puzzle completo con solucion unica **verificada**, no asumida.
2. Clasifique el puzzle en uno de los tres niveles **medido por la tecnica** que
   hace falta para resolverlo.
3. Lo haga en un tiempo acotado, y cuando no puede cumplir el nivel pedido, lo
   diga de forma explicita en vez de mentir.

### No-objetivo

- No es el motor de hints ni el explicador de tecnicas para el jugador (fuera de
  v1, C11). El motor **detecta** la tecnica; no la explica.
- No es un optimizador de puzzles. No busca el puzzle "mas lindo"; busca uno que
  cumpla el contrato.
- No maneja notas, deshacer, cronometro ni persistencia: eso es estado de juego
  (SPEC-005) y shell (SPEC-006).

### Modelo conceptual compartido

- **Puzzle**: grilla 9x9 con celdas vacias, con una solucion unica.
- **Solucion**: grilla 9x9 completa y valida.
- **Givens (pistas)**: celdas con valor que el generador conserva. Inmutables para
  el jugador.
- **Unidad**: fila, columna o bloque 3x3. Hay 27 unidades.
- **Tecnica**: patron de deduccion que resuelve una o mas celdas (candidato unico,
  par naked, X-Wing, rectangulo unico, etc.).
- **Tier**: nivel de dificultad de una tecnica, derivado de la tecnica, no escrito a
  mano. Un numero mas alto = tecnica mas avanzada.
- **Nivel** (Facil/Medio/Dificil): el tier maximo que hace falta para resolver el
  puzzle. Es una funcion del tier, no una tabla arbitraria.
- **Rating**: el resultado de medir un puzzle: su nivel, su tier maximo, cuantos
  pasos necesito y con que tecnicas.

## Requisitos funcionales

- **RF-1.** `generatePuzzle(difficulty, options?)` devuelve un puzzle con solucion
  unica y su rating.
- **RF-2.** El generador verifica la unicidad **despues de cada celda quitada**
  (`countSolutions(puzzle, 2) === 1`): si al quitar una celda el puzzle queda con dos
  o mas soluciones, esa quitada se descarta y se prueba otra.
- **RF-3.** El rating mide la resolucion completa del puzzle con el catalogo de
  tecnicas y devuelve: nivel, tier maximo, cantidad de pasos y las tecnicas
  usadas.
- **RF-4.** El nivel se deriva **unicamente** del tier maximo medido. No hay
  constantes que mapeen "cantidad de vacias" a nivel.
- **RF-5.** Si el generador no logra un puzzle del nivel pedido dentro del limite
  de intentos, devuelve un resultado con `matched: false` y el nivel realmente
  medido. **Nunca** devuelve un puzzle etiquetado con un nivel que no se midio.
- **RF-6.** El generador es **determinista dada una semilla**: la misma semilla y
  el mismo nivel producen el mismo puzzle. El motor no usa `Math.random`; usa un
  PRNG con semilla.
- **RF-7.** El motor no depende del DOM, de `window` ni de ninguna API de
  navegador: corre en `node --test` sin build ni jsdom.
- **RF-8.** El catalogo de tecnicas cubre, como minimo, los tres niveles:
  candidatos (unico visible y unico oculto), pares y tríos naked y hidden, y al
  menos una tecnica de nivel avanzado (X-Wing o equivalente) para que "Dificil"
  sea una categoria real y no un synonym de "Medio con mas vacias".
- **RF-9.** Un solo formato de mascara de candidatos en todo el motor, declarado en
  un unico modulo. No puede existir una segunda forma de construir la mascara en
  el arbol (leccion heredada del motor previo, queconvivia `1 << (d-1)` y
  `1 << d`).

## Restricciones tecnicas

- TypeScript, ejecutado por Node 26 con type stripping nativo: los tests corren
  con `node --test` **sin paso de build**.
- Cero dependencias de runtime.
- Modulo puro: sin `Date.now` interno no inyectado, sin I/O, sin aleatoriedad no
  sembrada. Todo lo que dependa del entorno entra por parametro (semilla, reloj).
- El PRNG es propio y con semilla: `mulberry32` o equivalente.
- La verificacion de unicidad tiene un tope (`cap = 2`): contar soluciones
  completas de un puzzle podria ser exponential, y el tope corta el trabajo.

## Modelo de datos minimo

```ts
type Cell = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
type Grid = Cell[];                    // 81 celdas, indice 0..80
type Difficulty = "facil" | "medio" | "dificil";

interface Puzzle {
  grid: Grid;                          // las pistas; 0 = vacia
  solution: Grid;                      // la solucion completa
  seed: number;
}

interface Rating {
  difficulty: Difficulty;              // el nivel MEDIDO
  maxTier: number;                     // el tier mas alto necesario
  steps: number;                       // pasos de resolucion
  techniqueCounts: Record<string, number>;
  solved: boolean;                     // false si no se pudo resolver con el catalogo
}

interface GenerateResult {
  puzzle: Puzzle;
  rating: Rating;
  matched: boolean;                    // false = el nivel pedido no se logro
}
```

## 5. Acceptance Criteria

- `generatePuzzle("medio", { seed: 42 })` devuelve un `puzzle` cuya grilla tiene
  `countSolutions(puzzle.grid, 2) === 1`, verificado por el test con el propio
  contador de soluciones del motor.
- Con la misma semilla y el mismo nivel, dos llamadas devuelven **el mismo**
  `puzzle.grid` (comparacion profunda, elemento a elemento).
- Con semillas distintas, los puzzles son distintos (probado sobre al menos 5
  semillas: ningun par coincide).
- `ratePuzzle(puzzle)` devuelve `maxTier` **mayor o igual** al tier de la tecnica mas
  avanzada usada, y `difficulty` coincide con el nivel que la escalera declara
  para ese tier.
- `ratePuzzle` de un puzzle que el catalogo no puede resolver devuelve
  `solved: false` y `maxTier` del ultimo tier alcanzado, **sin** inventar un tier
  mayor.
- Un puzzle resuelto **solo** con tecnicas de tier bajo tiene `difficulty: "facil"`;
  uno que requiere una tecnica de tier alto tiene `difficulty: "dificil"`. El test
  usa puzzles generados con el propio generador, no fixtures descargados.
- `generatePuzzle` con un limite de intentos ridiculamente bajo
  (`maxAttempts: 1` y una semilla adversa) devuelve `matched: false` en vez de
  colgar o de mentir el nivel.
- El generador con `maxAttempts` acotado **termina**: un test con
  `maxAttempts: 3` y un reloj inyectado que no avanza no se cuelga y falla por
  timeout si el bucle no termina.
- No existe en `src/core/` mas de una forma de construir la mascara de
  candidatos: un test o un grep sobre el arbol lo verifica (por ejemplo, todos los
  usos de `1 <<` siguen la misma convencion, documentada en el modulo que la
  declara).
- El modulo se importa y se ejecuta en `node --test` **sin** ninguna bandera de
  build, sin `tsc` y sin paso previo: el comando `node --test test/` encuentra y
  corre los tests de este motor.

## 6. Edge Cases & Error Handling

- **Puzzle con mas de una solucion** tras una quitada: la quitada se revierte y se
  prueba otra. Si se agotan las quitadas, el puzzle entero se descarta y se
  regenera desde una grilla completa nueva.
- **Grilla completa que no es valida** (por un bug de generacion): el generador
  la detecta y la descarta; nunca se entrega.
- **`countSolutions` con `cap = 2`** se corta en la segunda solucion: no cuenta mas
  alla, porque el generador solo necesita saber "hay mas de una?".
- **Semilla invalida** (negativa, `NaN`, no entera): el generador la normaliza a un
  entero de 32 bits sin signo. No lanza.
- **Nivel pedido desconocido** (un string que no es `facil`/`medio`/`dificil`):
  error explicito de tipo, no un nivel por defecto silencioso.
- **`maxAttempts` en 0 o negativo**: error explicito, no un bucle infinito.
- **El catalogo de tecnicas no resuelve un puzzle valido**: `solved: false` con el
  `maxTier` alcanzado. El generador puede entonces descartar ese puzzle, pero la
  API de rating **no** falla ni lanza.
- **Un puzzle con solucion multiple que llega al rating** (por un error de otro
  calling): el rating lo acepta, pero la generacion nunca lo produce.
- **Celdas sin candidatos** durante el analisis (una celda sin digito posible):
  el analisis detecta el estado imposible y lo reporta; no divide por cero ni
  asume candidato ninguno.

## 7. Verification Plan

**Automatico** (motor puro, sin DOM):

```bash
cd ~/projects/kanam-sudoku-iphone
node --test test/
```

El suite debe incluir, como minimo: unicidad real sobre al menos 10 puzzles
generados por nivel; determinismo por semilla; distincion entre semillas; el
rating de puzzles de cada nivel; el `matched: false` explicito; el corte del
contador de soluciones; la normalizacion de semilla invalida; y el test de que
el arbol usa una sola convencion de mascara.

**Manual** (en la app, no en el motor):

- Generar 5 puzzles de cada nivel y confirmar que el nivel coincide con el
  pedido y que la solucion es unica, leyendo el rating en la UI de desarrollo o
  con un script que imprima el rating.
- Medir el tiempo de generacion de un puzzle de cada nivel y confirmar que es
  imperceptible para el usuario (o que la UI muestra un estado de "generando").

**Evidencia a citar en el cierre:** la salida cruda de `node --test test/` con el
conteo de tests, y el resultado del script de rating sobre 5 puzzles por nivel.
