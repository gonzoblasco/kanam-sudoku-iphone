# ADR-0001: TypeScript + Vite como stack, con cero dependencias de runtime

- **Status:** accepted
- **Date:** 2026-10-24
- **Deciders:** Gonzo / Kanam

## Context

El proyecto es un juego web **movil-first** que se usa a diario en un iPhone sobre
una red movil, y su repo es publico. De ahi salen tres restricciones que el stack
tiene que absorber:

1. **La logica de juego tiene que ser testeable sin DOM.** El motor (generador,
   validador, rating, estado) es donde estan los bugs caros: un puzzle con dos
   soluciones, un conflicto que no se marca, un estado que se corrompe al guardar.
   Si esa logica vive mezclada con el DOM, probarla exige un navegador y el ciclo
   de tests se vuelve lento e insostenible.
2. **El bundle viaja por una red movil.** Cada kilobyte es latencia al abrir la
   app. Un framework entero para un tablero de 81 celdas es peso sin retorno.
3. **La extension futura (deshacer, notas) tiene que poder agregarse sin reescribir
   el nucleo** (ver ADR-0004). Eso pide un contrato de estado explicito, no
   implicito.

Ademas, el pedido exige separacion entre logica de juego e interfaz, y el AGENTS.md
del workspace exige verificacion de UI en navegador real (no jsdom) y tests sobre
codigo nuevo.

## Decision

**TypeScript + Vite**, con **cero dependencias de runtime**.

- **TypeScript** para el codigo de la app y el motor. Node 26.8.1 (el de la
  maquina) ejecuta TypeScript con **type stripping nativo**: `node --test` corre
  los tests `.ts` **sin paso de build**. Verificado en `/tmp/tscheck`: un test
  `.ts` importando un modulo `.ts` corrio con 1 test, 0 fallos, y `node --test
  test/` lo discovery sin configuracion extra.
- **Vite** como dev server y build, con `base: "./"` (relativo) para el subpath de
  GitHub Pages (ADR-0005).
- **Cero dependencias de runtime**: el motor de sudoku se escribe, no se importa.
  `vite` es la unica devDependency.
- **Tests con `node --test`** sobre la logica pura, y **e2e con Chromium real**
  (Playwright-core, ya instalado en la maquina) para la UI. El e2e no agrega
  dependencias al proyecto: usa el Chromium del sistema.

## Alternatives considered

| Alternative | Why it was discarded |
|---|---|
| **JavaScript vanilla sin TypeScript** (el stack de `kanam-sudoku` v1) | Se verifico que funciona, pero el requisito de "extender sin reescribir" (ADR-0004) pide un contrato de estado explicito. En JS, el historial y las notas son convenciones; en TS son tipos que el compilador de type-stripping **verifica**. El costo es marginal (type stripping no necesita build) y el beneficio es que el error de estado se ve antes de la UI. |
| **React / Preact / Vue** | Un tablero de 81 celdas con un teclado de 10 teclas no tiene el estado dinamico que justifica un framework. Se paga el peso del runtime (el bundle viaja por red movil) y la ceremonia (build, ciclo de vida) a cambio de nada. La UI es un re-render por cambio de estado, y eso lo hace un `render()` de 200 lineas sin framework. |
| **Svelte / Solid / signals** | Son la mejor alternativa *si* se quisiera un framework. Se descartaron por el mismo motivo que React: el bundle y la ceremonia no se pagan solos en un juego de 81 celdas. Un "signals" nativo de 30 lineas cubre el caso de uso si hiciera falta. |
| **TypeScript + Next.js** | Aporta SSR y routing, que el juego no necesita: todo el contenido es dinamico y no hay SEO que defender (una PWA de juego no se indexa). Se paga el servidor y la complejidad de un segundo runtime por nada. |
| **WebAssembly (Rust) para el motor** | El motor de un sudoku 9x9 no justifica WASM: el cuello de botella real es la generacion, que es un backtracking acotado, y en JS tarda menos de lo que tarda el usuario en levantar el dedo. WASM agregaria toolchain, binarios y complejidad de carga para un gain despreciable. |
| **Tests con Vitest / Jest en vez de `node --test`** | Vitest agrega una devDependency y una capa de configuracion para correr tests que `node --test` ya corre, incluido el type stripping. El workspace ya estandarizo `node --test` en el resto de sus proyectos; divergir aqui no compra nada. |

## Consequences

**Positive:**
- El motor corre en `node --test` sin build ni jsdom: el ciclo de tests es
  instantaneo y la logica de juego se puede ejercitar a fondo (unicidad real de 10
  puzzles por nivel, undo/redo de 20 mutaciones, ida y vuelta de serializacion).
- La verificacion de UI es en **Chromium real** (que es lo que el AGENTS.md
  exige) sin agregar dependencias: Playwright-core y el Chromium ya estan en la
  maquina.
- Bundle chico: sin framework, la app pesa lo que pesan el motor, el render y los
  estilos. Importa en una red movil.
- El contrato del estado (historial, notas) queda **verificado por el
  compilador**, no por la disciplina del developer.

**Negative / costs:**
- **No hay refactor automatico de IDE** tan completo como con `tsc` (type
  stripping no hace rename ni "go to definition" de tipos cruzados con la misma
  riqueza). El editor sigue siendo util, pero el loop de errores de tipo es mas
  pobre que con type-checking completo.
- **TypeScript no se verifica en CI con `tsc --noEmit`** en el estado actual: el
  type stripping de Node **no comprueba** los tipos, los borra. Si el proyecto
  quiere type-checking real, hay que agregar `tsc --noEmit` como paso del CI
  (decidido en `architecture.md`, seccion "Verificacion").
- Sin framework, **el render es manual**: cada cambio de estado tiene que
  re-renderizar lo que corresponde. Con 81 celdas es barato, pero es codigo que
  hay que escribir y mantener.
- El type stripping impose limites: **no se puede usar `enum`, ni `namespace`, ni
  parameter properties, ni decorators** (todo lo que requiere transformacion de
  tipo). Se usan `const` objects + `union types` en su lugar.

## Reversibility

**Costo bajo en el motor, medio en la UI.** El motor es TypeScript puro con tipos
estructurales: pasarlo a JavaScript es borrar anotaciones. La UI es la parte
atada: migrar a React significaria reescribir el render y el estado de la
aplicacion (no el del juego), y perder la ligereza del bundle. El repo publico
hace que la migracion sea visible en el historial, asi que un cambio de stack
seria notorio y deliberado, no accidental.
