# kanam-spec

**ID:** SPEC-202610240003
**Title:** Tablero tactil movil: seleccion, escritura, borrado y resaltados contextuales
**Owner:** Gonzo
**Status:** Draft
**Priority:** P1

## Intent & Context

### Problema

El tablero es el corazon del juego y tiene que funcionar **con el dedo, en un iPhone
de 390px**, sin scroll y con areas tactiles de 44x44px. El pedido es explicito en
la seccion de plataforma: mobile-first, 100% tactil, nada de hover ni teclado fisico,
safe areas, `100dvh` para que la pantalla no scrollee, tablero cuadrado que ocupe el
ancho disponible, lineas mas gruesas separando los bloques 3x3, y modo claro y
oscuro segun la configuracion del sistema.

Ademas hay un comportamiento de juego central: al seleccionar una celda, se
resaltan **su fila, su columna, su bloque y todas las celdas con el mismo numero**.
Ese resaltado es lo que permite al jugador ver de un vistazo donde puede ir un
digito, y es la diferencia entre un sudoku jugable y un sudoku tedioso.

Y hay un estado que **no** es solo color: la pista inicial tiene que distinguirse
visualmente de lo que carga el jugador, y las celdas en conflicto tienen que estar
en rojo. Ninguno de esos dos estados puede depender unicamente del color.

### Objetivo

Un tablero que:

1. Se dibuja cuadrado, ocupa el ancho disponible y nunca fuerza scroll vertical.
2. Responde a toques con areas de 44x44px minimo.
3. Expone seleccion, escritura y borrado, con las pistas protegidas.
4. Resalta los cuatro contextos (fila, columna, bloque, mismo numero) de forma
   distinta entre si.
5. Distingue dado, seleccionado, en conflicto y resaltado **por mas de un canal**
   (atributo, forma, peso, contorno), no solo por color.
6. Tenga modo claro y oscuro que sigan la preferencia del sistema.

### No-objetivo

- No hay teclado fisico como via principal. El teclado numerico en pantalla es
  SPEC-004. El tablero **tolera** teclado por accesibilidad, pero no lo exige.
- No hay notas por celda, ni modo de anotaciones (fuera de v1, C12).
- No hay arrastrar, seleccionar multiples celdas, ni copiar/pegar.
- No hay animaciones que bloqueen el toque. Las transiciones duran lo que el
  dispositivo puede, y se desactivan con `prefers-reduced-motion`.

### Modelo conceptual compartido

- **Celda**: una de las 81. Tiene un valor (`0` = vacia), un estado (dada, jugada,
  vacia) y un contexto visual.
- **Dada (pista)**: celda con valor inicial del puzzle. No editable.
- **Jugada**: celda con valor puesto por el jugador. Editable.
- **Contexto de seleccion**: el conjunto de celdas resaltadas por la celda
  seleccionada: su fila, su columna, su bloque y las celdas con el mismo valor.
- **Estado visual de celda**: dado / vacia / jugada / seleccionada / en conflicto /
  resaltada por contexto. Cada uno tiene su propio canal (atributo `data-*`,
  peso, contorno, subrayado) ademas del color.

## Requisitos funcionales

- **RF-1.** El tablero es un cuadrado (`aspect-ratio: 1`) que mide exactamente el
  ancho disponible de su contenedor.
- **RF-2.** El layout de la pantalla usa `100dvh` (con fallback `100vh`), respeta
  `env(safe-area-inset-*)` y **no produce scroll vertical** en un viewport de
  390x844.
- **RF-3.** Cada celda es un objetivo tactil de **al menos 44x44px** en el viewport
  de referencia.
- **RF-4.** Los limites entre bloques 3x3 son visualmente mas gruesos que los
  internos.
- **RF-5.** Al tocar una celda, se la selecciona y se resalta: su fila, su columna,
  su bloque, y todas las celdas que tienen el mismo valor que ella (si tiene).
- **RF-6.** Los cuatro contextos son **distinguibles entre si**: la celda
  seleccionada no se confunde con las celdas de su fila, ni estas con las de su
  bloque.
- **RF-7.** Tocar una celda **la selecciona**, sin escribir nada. Tocar otra celda
  cambia la seleccion.
- **RF-8.** La UI expone una operacion `setValue(index, digit)` y una
  `clearValue(index)`, que son las unicas que escriben en el tablero.
- **RF-9.** Escribir sobre una **dada** no la modifica: la operacion es un no-op y
  el estado no cambia. (El flujo real de la app usa el teclado en pantalla, que
  solo escribe en la celda seleccionada.)
- **RF-10.** El modo claro y el modo oscuro siguen la preferencia del sistema
  (`prefers-color-scheme`), y ambos cumplen contraste AA.
- **RF-11.** Cada estado de celda tiene un canal propio mas alla del color:
  - dada: **peso** tipografico distinto (y `data-given="true"`).
  - seleccionada: **contorno** visible (`data-selected="true"`).
  - en conflicto: **borde interior + subrayado** y `data-conflict="true"`.
  - resaltada por contexto: **fondo tenue** y `data-highlight="row|column|block|same"`.
  - vacia: sin atributos de estado.
- **RF-12.** Al pasar a modo oscuro, **todos** los pares texto/fondo mantienen
  contraste AA (4.5:1 para texto de cuerpo).

## Restricciones tecnicas

- TypeScript + Vite, `base: "./"` (relativo) para que funcione bajo el subpath de
  GitHub Pages.
- Cero dependencias de runtime.
- La logica de estado del tablero (que celda esta seleccionada, que celdas estan en
  conflicto, que celdas se resaltan) es **puro y testeable sin DOM**. El render
  solo cablea: no calcula nada.
- CSS con custom properties para los dos temas, de modo que el cambio de tema sea
  un cambio de variables y no una hoja de estilos paralela.
- `prefers-reduced-motion` respetado: sin transiciones si el usuario las pidio
  desactivar.
- Sin `hover` como canal de informacion: `:hover` puede existir como efecto
  estetico, nunca como unico indicador de estado.
- Sin scroll: `overflow: hidden` en el contenedor de la app y `touch-action`
  adecuado en el tablero para que el toque no scrollee la pagina.

## Modelo de datos minimo

```ts
type Cell = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
type Grid = Cell[];
type HighlightKind = "row" | "column" | "block" | "same";

interface CellView {
  index: number;              // 0..80
  value: Cell;                // 0 = vacia
  given: boolean;             // pista inicial
  selected: boolean;
  conflict: boolean;
  highlight: HighlightKind | null;
  row: number;                // 0..8
  column: number;             // 0..8
  block: number;              // 0..8
}
```

## 5. Acceptance Criteria

- Con un viewport de **390x844**, el documento **no tiene scroll vertical**:
  `document.documentElement.scrollHeight <= window.innerHeight`.
- La celda mide **al menos 44x44px** en ese viewport: el test mide el
  `getBoundingClientRect()` de una celda y falla si algun lado es < 44.
- El tablero es **cuadrado**: la diferencia entre ancho y alto medidos es **<= 1px**.
- El ancho del tablero es **>= 340px** en un viewport de 390 (ocupa el ancho
  disponible descontando el padding).
- Los bordes de bloque son **mas gruesos** que los internos: el test mide el grosor
  de un borde de bloque y el de uno interno y compara.
- Seleccionar la celda 40 marca **las otras 8 celdas** de su fila, **las otras 8**
  de su columna y **las otras 8** de su bloque con `data-highlight`, y exactamente
  **1** celda con `data-selected="true"`.
- `data-highlight` toma **un solo valor** por celda, con la precedencia
  `same > block > column > row` (ver `docs/data-model.md`): una celda que pertenece
  a mas de un contexto lleva el de mayor precedencia. Por eso los conteos por
  etiqueta **no** son 9/9/9: con la celda 40 seleccionada son 8 con `"block"`, 6
  con `"column"` y 6 con `"row"` (las 2 celdas de la fila que estan en el bloque
  toman `"block"`). La propiedad que se verifica es que **las 8 de cada unidad
  estan marcadas**, no el reparto por etiqueta.
- Al seleccionar una celda con un valor que aparece en otra celda, esa otra celda
  tiene `data-highlight="same"`.
- El atributo `data-highlight` de una celda es **uno** de los cuatro valores, nunca
  una combinacion: los cuatro contextos se distinguen por atributo.
- Escribir un numero en una **dada** no cambia el valor: se compara el valor antes y
  despues y son iguales, y el atributo `data-given="true"` sigue presente.
- Los estados son **independientes del color**: existe al menos un par de celdas
  con el mismo color de fondo y distinto estado, y el test verifica que sus
  atributos `data-*` difieren.
- En modo oscuro (`prefers-color-scheme: dark` emulado), el texto principal sobre
  el fondo del tablero mantiene contraste **>= 4.5:1**, medido por un script
  (no estimado).
- Tocar una celda **no** hace scroll: tras el toque, `scrollY` sigue en `0`.
- Con `prefers-reduced-motion: reduce`, la transicion de la celda seleccionada es
  de duracion **0**.

## 6. Edge Cases & Error Handling

- **Tocar una celda mientras se esta generando un puzzle**: la app no esta en
  estado jugable todavia; el toque no hace nada y no rompe nada.
- **Tocar el mismo numero en una celda que ya lo tiene**: no hay error, el valor
  queda igual (idempotente).
- **Seleccionar una celda y luego tocar el tablero en otro lado**: la seleccion
  cambia a la nueva celda.
- **La celda seleccionada queda en conflicto**: la celda muestra **ambos** estados
  (`data-selected="true"` y `data-conflict="true"`) y el conflicto no tapa la
  seleccion.
- **Una dada que somehow esta en conflicto**: se dibuja como dada y como conflicto
  (el puzzle generado no produce ese caso, pero la UI no debe romperse).
- **Viewport mas angosto que 360px** (iPhone SE): el tablero se reduce y las celdas
  quedan por debajo de 44px. La app no rompe ni desborda: el tablero sigue
  cuadrado y centrado. La app declara que 44px es el objetivo del viewport de
  referencia, no una garantia para todos los tamanos.
- **Orientacion horizontal**: el tablero se mantiene cuadrado y centrado; no es el
  caso de uso principal.
- **Pulsacion larga**: el navegador puede abrir el menu contextual nativo sobre la
  celda. La app lo desactiva en el tablero (`user-select: none`, `-webkit-touch-callout:
  none`) para que un toque largo no interrumpa el juego.
- **Zoom de accessibility** (iOS hasta 200%): el tablero sigue siendo usable y
  escalable; el texto no se corta.
- **La app vuelve del background con el puzzle a medio generar**: el estado de
  generacion se resuelve al volver, y la UI no queda en un spinner eterno.

## 7. Verification Plan

**Automatico** (navegador real, Chromium headless con Playwright-core; el AGENTS.md
del workspace exige browser real, no jsdom):

```bash
cd ~/projects/kanam-sudoku-iphone
npm run build
node test/e2e.board.mjs          # viewport 390x844
```

Checks minimos: sin scroll vertical; celda >= 44x44px; tablero cuadrado; ancho
>= 340px; bordes de bloque mas gruesos; los cuatro `data-highlight` con sus
conteos; `data-selected` unico; dada inmutable; scrollY == 0 tras un toque;
contraste del modo oscuro >= 4.5:1.

**Manual** (en el iPhone, antes de dar la v1 por cerrada):

- Abrir la app en Safari, agregar a la pantalla de inicio, y jugar una partida
  completa con el dedo.
- Confirmar que el teclado en pantalla (SPEC-004) no tapa el tablero.
- Confirmar el comportamiento del modo oscuro con el sistema en dark.

**Evidencia a citar en el cierre:** la salida cruda del e2e con el conteo de
checks, y el resultado del script de contraste para los dos temas.
