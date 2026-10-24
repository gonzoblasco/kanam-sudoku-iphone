# kanam-spec

**ID:** SPEC-202610240004
**Title:** Teclado numerico en pantalla y pantalla de victoria
**Owner:** Gonzo
**Status:** Draft
**Priority:** P1

## Intent & Context

### Problema

En un iPhone no hay teclado fisico. El jugador necesita **escribir un digito en la
celda seleccionada** con el dedo, y **borrar** la celda. El pedido lo pide: *"Seleccionar
una celda y cargar un numero con un teclado numerico en pantalla (1-9) debajo del
tablero"* y *"Boton para borrar una celda"*.

El teclado en pantalla tiene un requisito que no es obvio: **tiene que estar debajo
del tablero sin taparlo ni provocar scroll**, en un iPhone de 390x844. Ese es el
numero magico de la altura disponible: 844px menos las safe areas, menos el
encabezado, menos el tablero. El teclado se tiene que **adaptar a lo que queda**, no
ocupar un ancho fijo que obligue a scrollear.

Ademas, completar el tablero tiene que **celebrarse**: *"Pantalla de victoria al
completar el tablero correctamente"*. Y hay un detalle de correctitud que importa: un
tablero **completo pero con errores** no se celebra. La victoria es "correctamente",
no "lleno".

### Objetivo

1. Un teclado numerico **1-9** debajo del tablero, con un area tactil de 44x44px
   minimo por tecla, que escribe en la celda seleccionada.
2. Un boton de **borrar** que vacia la celda seleccionada.
3. El teclado y el tablero conviven en pantalla **sin scroll** en 390x844.
4. Una **pantalla de victoria** que aparece solo con el tablero completo y correcto.
5. El teclado es **accesible**: cada tecla es un boton con nombre, y el estado de la
   celda seleccionada se anuncia.

### No-objetivo

- No hay teclado numerico del sistema (el de iOS) ni campos de texto: el teclado es
  propio, siempre visible, siempre el mismo.
- No hay "sugerencias" ni auto-escritura de digitos.
- No hay animaciones de celebracion pesadas (confeti, sonido): la victoria es una
  pantalla clara con el tiempo y dos acciones.

### Modelo conceptual compartido

- **Celda seleccionada**: la celda destino de la proxima pulsacion del teclado.
- **Tecla**: un digito del 1 al 9, o la tecla de borrar.
- **Partida ganada**: tablero completo y sin conflictos (ver SPEC-002).
- **Pantalla de victoria**: el estado que se muestra cuando la partida se gana.

## Requisitos funcionales

- **RF-1.** El teclado tiene 9 teclas de digito (`1`-`9`) y 1 tecla de borrar, en un
  layout de 3 filas (1-2-3 / 4-5-6 / 7-8-9) con la de borrar a un lado.
- **RF-2.** Cada tecla mide **al menos 44x44px**.
- **RF-3.** Pulsar un digito escribe ese digito en la celda **seleccionada** y
  **mantiene la seleccion** en esa celda (para poder encadenar digitos rapido).
- **RF-4.** Pulsar una tecla sin celda seleccionada no hace nada ni lanza error.
- **RF-5.** Pulsar una tecla cuando la celda seleccionada es una **dada** no
  modifica el tablero.
- **RF-6.** La tecla de borrar vacia la celda seleccionada. Si la celda ya esta
  vacia, no hace nada.
- **RF-7.** Borrar una celda **no rompe nada mas**: en la v1 no hay notas, pero la
  operacion es la misma que en la v2 lo sera, y no deja estado colgando.
- **RF-8.** El teclado es un `role="group"` con nombre accesible, y cada tecla es un
  `button` con etiqueta ("5", "Borrar").
- **RF-9.** El valor de la celda seleccionada se anuncia por `aria-live` al
  cambiar ("Fila 3, columna 5: 7").
- **RF-10.** La pantalla de victoria aparece **solo** cuando `complete && solved`.
- **RF-11.** La pantalla de victoria muestra el **tiempo** de la partida (D5) y
  dos acciones: **Jugar de nuevo** (mismo nivel) y **Elegir otro nivel**.
- **RF-12.** La pantalla de victoria **no** ofrece "continuar": si se gano, la
  partida termino.
- **RF-13.** Con el teclado en pantalla, el documento **no scrollea** en 390x844.

## Restricciones tecnicas

- TypeScript + Vite, `base: "./"`.
- Cero dependencias de runtime.
- El teclado se implementa con **botones HTML nativos**, no con `<div>`s y
  listeners: el foco, la activacion por teclado y la semantica vienen gratis.
- El layout del area de juego es **flex con `min-height: 0`** en el medio, para que
  el teclado se ajuste al espacio disponible en vez de desbordar.
- El area de juego usa `100dvh` con fallback `100vh`, y `env(safe-area-inset-bottom)`
  en el padding del teclado.
- La logica "que celda esta seleccionada" y "que ocurre al pulsar una tecla" es
  **puro y testeable sin DOM**; el render solo cablea los eventos.

## Modelo de datos minimo

```ts
interface KeypadAction {
  kind: "digit" | "erase";
  digit?: number;              // 1..9, presente si kind === "digit"
}

interface KeypadModel {
  selectedIndex: number | null;
  canErase: boolean;           // hay algo que borrar
  keys: { digit: number }[];   // 1..9
}
```

## 5. Acceptance Criteria

- El teclado muestra **9** teclas de digito con las etiquetas `1`-`9` y **1** tecla
  con la etiqueta "Borrar": el conteo del DOM coincide.
- Todas las teclas miden **al menos 44x44px** en un viewport de 390x844 (medicion
  con `getBoundingClientRect()`, no estimada).
- Con una celda seleccionada, pulsar la tecla `7` deja el valor `7` en esa celda.
- Tras pulsar `7`, la **seleccion sigue en la misma celda** (`data-selected="true"`
  sigue en ella).
- Con **ninguna** celda seleccionada, pulsar una tecla no cambia el tablero (se
  compara la grilla antes y despues) y no produce error en consola.
- Con una **dada** seleccionada, pulsar una tecla no cambia su valor.
- Pulsar "Borrar" con una celda con valor la deja en `0`; con una celda vacia no
  cambia nada.
- Con el teclado visible, `document.documentElement.scrollHeight <=
  window.innerHeight` en 390x844: **no hay scroll**.
- El teclado queda **debajo** del tablero en el layout (el `top` del teclado es
  mayor que el `bottom` del tablero) y **no se solapa** con el tablero.
- El boton de borrar es un `button` con nombre accesible "Borrar" (verificable con
  el arbol de accesibilidad).
- La region de estado tiene `aria-live="polite"` y su texto **cambia** al escribir
  un digito: el texto anterior no es igual al nuevo.
- Un tablero **completo con un conflicto** **no** muestra la pantalla de victoria:
  el elemento de victoria no esta en el DOM.
- Un tablero **completo y correcto** muestra la pantalla de victoria con el tiempo
  final y los botones "Jugar de nuevo" y "Elegir otro nivel".
- Pulsar "Jugar de nuevo" en la victoria **empieza otra partida del mismo nivel**,
  con las pistas nuevas (una grilla distinta de la anterior).
- Pulsar "Elegir otro nivel" **vuelve al menu de niveles** (SPEC-005).

## 6. Edge Cases & Error Handling

- **Pulsar el mismo digito dos veces**: el segundo toque no cambia nada (es
  idempotente). No hay error.
- **Pulsar una tecla con el puzzle generandose**: la app no esta en estado jugable;
  la pulsacion se ignora.
- **Borrar una dada**: no se puede: la operacion es un no-op. La dada no se borra.
- **El dedo tapa la tecla que se quiere pulsar**: las teclas tienen 44x44px minimo
  y margen entre ellas, para que el error de punteria sea raro.
- **Safari muestra el menu contextual al mantener pulsado un boton**: se desactiva
  en el teclado (`-webkit-touch-callout: none`).
- **La app pasa a segundo plano con el teclado abierto**: al volver, el teclado
  sigue en su sitio y el tablero no quedo tapado.
- **Teclado con safe area de un iPhone con home indicator**: el padding inferior
  del area de teclas incluye `env(safe-area-inset-bottom)`, y la app sigue sin
  scrollear.
- **Orientacion horizontal**: el teclado se mantiene visible y el tablero se
  reduce; no es el caso principal, pero no se rompe.
- **Un tablero completo con conflictos**: la app **no** celebra y **no** bloquea:
  el jugador puede seguir corrigiendo. (Es el unico caso en que "lleno" no es
  "ganado".)
- **Pulsa rapido varios digitos**: la app procesa cada pulsacion; no hay debounce
  que se coma una pulsacion.

## 7. Verification Plan

**Automatico** (Chromium headless, viewport 390x844):

```bash
cd ~/projects/kanam-sudoku-iphone
npm run build
node test/e2e.keypad.mjs
```

Checks minimos: conteo de teclas; tamano minimo de cada tecla; escritura de un
digito; seleccion que se mantiene; no-op sin seleccion; no-op sobre dada; borrado;
sin scroll; teclado debajo y sin solape; nombre accesible de la tecla de borrar;
`aria-live` que cambia; victoria que **no** aparece con conflictos; victoria que si
aparece con tablero correcto; "Jugar de nuevo" y "Elegir otro nivel".

**Manual** (en el iPhone):

- Escribir varios digitos con el dedo, uno tras otro, sin que la seleccion se mueva.
- Borrar y volver a escribir.
- Completar una partida hasta la victoria.

**Evidencia a citar en el cierre:** la salida cruda del e2e con el conteo de
checks.
