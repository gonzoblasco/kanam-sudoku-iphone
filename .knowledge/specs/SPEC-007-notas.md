# kanam-spec

**ID:** SPEC-202610240007
**Title:** Sistema de notas: candidatos por celda, manual y automatico
**Owner:** Gonzo
**Status:** Draft
**Priority:** P1

## Intent & Context

### Problema

Gonzo pidio el sistema de notas el 2026-10-24, despues de que la v1 se publicara
sin el. Quedo fuera de la v1 por decision de producto, pero el nucleo lo soporto
desde el primer dia: el estado tiene `notes` desde ADR-0004, la persistencia ya
guarda el mapa de notas, y la API `setNote`/`getNote` existe. Lo que faltaba era
**todo lo de arriba**: la interfaz.

Un sudoku sin notas obliga al jugador a recordar los candidatos en la cabeza. Con
notas, la celda vacia muestra los digitos todavia posibles, y el jugador puede
usarlos para deduplicar. Es la herramienta de trabajo basica del juego.

El sistema tiene dos mitades que van juntas:

1. **Notas manuales**: el jugador marca y desmarca candidatos en una celda.
2. **Candidatos automaticos**: el motor calcula, para cada celda vacia, que
   digitos siguen siendo legales segun el tablero actual, y los escribe como
   notas. Sirve para arrancar la partida con el tablero anotado, y para
   **recalcular** cuando el jugador coloca un numero y cambia lo que es
   posible en el resto.

La pregunta de diseno que decide el resto: **las notas son parte de la partida o
son una ayuda de trabajo?** Si fueran parte de la partida, tendrian su propia
historia de deshacer. La decision es que **no**: una nota no cambia el valor de
una celda, no es una jugada, y no entra al historial de mutaciones. Por eso la
API de notas ya vivia separada de `apply`.

### Objetivo

1. Un **modo notas** activable, que hace que las teclas del teclado numerico
   marquen candidatos en vez de escribir valores.
2. Las **notas se dibujan** en la celda, en la disposicion clasica de lapiz
   (3x3, cada digito en su posicion).
3. Un boton de **candidatos automaticos** que calcula y escribe los candidatos
   de todas las celdas vacias.
4. Un boton para **borrar las anotaciones**.
5. Las notas **se guardan y se recuperan** con la partida.
6. Las notas de una celda **no se ven cuando la celda tiene un valor**, y
   **vuelven cuando se borra el valor**.

### No-objetivo

- No hay deshacer/rehacer de notas (las notas no entran al historial de
  mutaciones; ver la decision de diseno arriba).
- No hay "notas por pencil marks" con trazo: las notas son candidatos, no
  marcas dibujadas.
- No hay un modo de edicion de notas distinto del teclado numerico (no hay
  mini-teclado dentro de la celda).
- No hay hints que expliquen la tecnica (siguen fuera de alcance, C11).
- No hay estadisticas sobre el uso de notas.

### Modelo conceptual compartido

- **Nota**: un conjunto de digitos candidatos marcados en una celda. Se guarda
  como una **mascara de 9 bits** (la misma convencion del motor, `bit (d-1)`).
- **Candidato**: un digito que la nota de una celda incluye.
- **Digitos legales**: los digitos que no aparecen todavia en la fila, la columna
  ni el bloque de la celda. Es la base del calculo automatico.
- **Modo notas**: el estado de la interfaz en el que las teclas numericas
  marcan candidatos en vez de escribir valores.
- **Anotaciones automaticas**: la operacion de escribir, en todas las celdas
  vacias, los digitos legales como notas.

## Requisitos funcionales

- **RF-1.** Un boton **"Notas"** activa y desactiva el modo notas. El boton
  expone `aria-pressed` y su estado activo es visible por mas de un canal
  (atributo, clase y color).
- **RF-2.** En **modo notas**, pulsar un digito del teclado **marca** ese digito
  como candidato de la celda seleccionada; pulsarlo de nuevo lo **desmarca**.
  La operacion es idempotente en el sentido de que el resultado depende solo del
  estado, no de la secuencia.
- **RF-3.** En **modo normal**, las teclas escriben valores, igual que hasta
  ahora. El modo notas **no** cambia ese comportamiento por defecto.
- **RF-4.** Las notas se dibujan en la celda con la disposicion 3x3 clasica: el
  digito 1 arriba a la izquierda, el 9 abajo a la derecha, y los huecos vacios.
- **RF-5.** Una celda **con valor** no muestra sus notas. Al **borrar** el
  valor, las notas vuelven a verse: las notas son un mapa aparte del tablero, no
  un valor de la celda.
- **RF-6.** Un boton **"Auto"** calcula los digitos legales de cada celda vacia
  y los escribe como notas de todas ellas. Recalcular **reemplaza** las notas
  anteriores.
- **RF-7.** Un boton **"Limpiar"** borra todas las anotaciones de la partida.
- **RF-8.** En **modo notas**, la tecla **"Borrar"** borra las notas de la celda
  seleccionada y **no** toca su valor.
- **RF-9.** Las notas se **guardan** con la partida y se **recuperan** al
  continuar, con la misma mascara.
- **RF-10.** Las notas se **anuncian** por la region `aria-live`, en el mismo
  formato que los valores: "Fila 3, columna 5: anotaciones 2, 5 y 7".
- **RF-11.** La celda con notas tiene un **nombre accesible** que incluye los
  candidatos, para que un lector de pantalla sepa que hay.
- **RF-12.** El calculo de digitos legales usa el **mismo motor** que las
  tecnicas: los candidatos que el motor considera imposibles **no** aparecen
  como notas.

## Restricciones tecnicas

- TypeScript + Vite, `base: "./"`, cero dependencias de runtime.
- La logica de notas es **puro y testeable sin DOM**: `src/core/candidates.ts`
  (digitos legales) y `src/state/state.ts` (mascaras de notas).
- **Una sola convencion de mascara en todo el arbol** (`bit (d-1)`): las notas
  usan `bitFor`/`maskOf` de `src/core/mask.ts`, como todo lo demas.
- Las notas **no** entran al historial de mutaciones: una nota no cambia el
  valor de una celda.
- El render sigue el contrato de `docs/architecture.md` 3.12: recibe las vistas
  ya calculadas y no calcula nada. La mascara de notas viaja en `CellView`.
- La grilla de notas se marca `aria-hidden`: la informacion la lleva el
  `aria-label` de la celda, para no leerla dos veces.
- El color de las notas cumple contraste AA contra el fondo de la celda.

## Modelo de datos minimo

```ts
type Mask = number;              // 9 bits, bit (d-1)

interface CellView {
  index: number;
  value: Cell;                   // 0 = vacia
  given: boolean;
  selected: boolean;
  conflict: boolean;
  highlight: HighlightKind | null;
  notes: Mask;                   // 0 = sin notas
  row: number;
  column: number;
  block: number;
}
```

La mascara de notas vive en `GameState.notes: Record<number, Mask>`, y se
persiste en `SavedGame.notes` (ya estaba en el formato: `schemaVersion` 1).

## 5. Acceptance Criteria

- Pulsar el boton "Notas" cambia su `aria-pressed` a `"true"`, y las teclas
  numericas dejan de escribir valores y pasan a marcar candidatos.
- En modo notas, pulsar la tecla `5` sobre una celda seleccionada hace que esa
  celda muestre el digito `5` como nota; volver a pulsarla lo quita.
- En modo notas, **la celda NO queda con el valor 5**: el valor de la celda
  sigue siendo 0 y la partida no registra ninguna jugada.
- En modo normal (el de siempre), pulsar `5` escribe el valor 5, y la celda no
  muestra ninguna nota.
- Las notas se dibujan en la disposicion 3x3: el DOM de una celda con las
  notas {2, 5, 7} tiene 9 posiciones, con el 2 en la primera, el 5 en la
  quinta y el 7 en la septima.
- Una celda con **valor** no muestra sus notas: el DOM de esa celda no
  contiene la grilla de notas. Al borrar el valor, la grilla vuelve.
- El boton "Auto" escribe notas en **todas** las celdas vacias: el numero de
  celdas con notas es igual al numero de celdas vacias.
- Las notas automaticas **no incluyen** un digito que ya aparece en la fila, la
  columna o el bloque de la celda: para una celda dada, cada nota automatica es
  un digito que el motor considera legal.
- "Auto" **reemplaza** las notas anteriores: una nota manual que el calculo no
  produce desaparece tras recalcular.
- "Limpiar" deja el mapa de notas vacio: ninguna celda muestra notas.
- En modo notas, la tecla "Borrar" vacia las notas de la celda seleccionada y
  **deja intacto el valor** de la celda.
- Las notas **se guardan**: tras marcar una nota, recargar la pagina y
  continuar, la celda muestra la misma nota.
- La region `aria-live` anuncia las notas con el texto "anotaciones" y lista los
  digitos: "Fila 3, columna 5: anotaciones 2, 5 y 7".
- El `aria-label` de una celda con notas incluye los candidatos, y la grilla de
  notas dentro de la celda esta marcada `aria-hidden="true"`.
- Las notas **no** crean entradas en el historial de mutaciones: tras marcar y
  desmarcar una nota, el historial tiene la misma cantidad de entradas que
  antes.
- El boton "Notas" tiene nombre accesible con su proposito, y el boton "Auto"
  se llama "Auto: calcular candidatos" y el "Limpiar" "Limpiar anotaciones".
- `axe-core` sobre la app viva sigue reportando **0 violaciones** con las
  notas presentes en el tablero.
- El contraste del color de las notas contra el fondo de la celda es **>= 4.5:1**
  en los dos temas, medido por `scripts/check-contrast.mjs`.

## 6. Edge Cases & Error Handling

- **Marcar una nota sobre una dada**: la celda tiene valor, asi que las notas no
  se ven. La nota se guarda igual (y vuelve a verse si el valor se borra, lo que
  en una dada no ocurre porque una dada no se borra). El juego no rompe.
- **Marcar una nota sobre una celda en conflicto**: las notas y el conflicto son
  estados distintos; la celda puede mostrarse con ambos, y el conflicto manda en
  el color del texto.
- **Celda sin candidatos legales** (una celda whose fila, columna y bloque ya
  estan completos con los 9 digitos, lo que en un tablero valido no pasa): la
  mascara queda en 0, y la celda no muestra grilla de notas. "Auto" no falla.
- **"Auto" con el tablero completo**: no hay celdas vacias, no se escribe nada y
  no hay error.
- **"Auto" con un tablero invalido** (digitos repetidos): calcula lo que puede y
  no lanza. Es una ayuda de trabajo, no un validador.
- **Pulsa repetida y rapida de la misma nota**: el resultado es el mismo que con
  una sola pulsacion (toggle, no toggle-toggle). No hay estado intermedio.
- **Borrar el valor de una celda con notas**: las notas vuelven a verse. Es el
  comportamiento de SPEC-005 ("borrar un numero no rompe las notas").
- **Escribir un valor sobre una celda con notas**: las notas se conservan, quedan
  ocultas, y vuelven a verse si el valor se borra.
- **Marcar notas mientras se genera el puzzle**: la app no esta en estado
  jugable todavia; la accion se ignora.
- **Mascara de notas invalida** (fuera de 0..511, o un indice fuera de 0..80):
  la API del estado lanza un error explicito, y la UI nunca lo produce.
- **Continuar una partida con notas**: las notas restauradas se dibujan tal
  cual, sin recalcular.

## 7. Verification Plan

**Automatico** (motor y estado, sin DOM):

```bash
cd ~/projects/kanam-sudoku-iphone
node --test test/
```

Cubre, como minimo: los digitos legales de una celda (la mascara de candidatos
del motor y la de auto-notas coinciden); una nota no crea entrada en el
historial; la mascara de notas se persiste y se recupera; una nota fuera de
rango lanza; y el render de la grilla de notas coloca cada digito en su
posicion.

**Automatico** (navegador real, viewport 390x844):

```bash
cd ~/projects/kanam-sudoku-iphone
npm run build
node test/e2e.notes.mjs
```

Checks minimos: el boton "Notas" cambia `aria-pressed`; en modo notas la tecla
escribe una nota y **no** un valor; la nota se dibuja en la posicion 3x3
correcta; una celda con valor no muestra notas; "Auto" anota todas las celdas
vacias; "Auto" reemplaza las notas manuales; "Limpiar" las borra; "Borrar" en
modo notas vacia la nota y no el valor; las notas sobreviven a una recarga; la
region `aria-live` anuncia las notas; y `axe-core` sigue en 0 violaciones.

**Manual** (en el iPhone):

- Marcar un par de notas con el dedo,y playar un numero, y comprobar que la nota
  no estorba.
- "Auto" con un tablero a medias, para ver si el recalculo ayuda o confunde.

**Evidencia a citar en el cierre:** la salida cruda de `node --test test/`, la
del e2e de notas con su conteo de checks, y el ratio de contraste del color de
las notas en los dos temas.
