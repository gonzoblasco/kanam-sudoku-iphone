# ADR-0006: Proyecto nuevo desde cero, sin reutilizar el motor de `kanam-sudoku`

- **Status:** accepted
- **Date:** 2026-10-24
- **Deciders:** Gonzo / Kanam

## Context

En el workspace existen dos proyectos de sudoku:

- **`projects/kanam-sudoku/`** (repo publico `gonzoblasco/kanam-sudoku`): la v1.
  Vanilla JS + Vite, motor propio (solver, generador, validador, rater, catalogo de
  tecnicas con `explain`), UI jugable, PWA offline, 257 tests. Es un proyecto
  terminado y funcional.
- **`projects/kanam-logik/`** (repo privado `gonzoblasco/kanam-logik`): un
  **borrador** de v2 en TS, que nacio para arreglar las deudas del v1.

El pedido de Gonzo para este trabajo fue explicitamente: **"no usar proyectos
actuales, crear un proyecto fresco desde cero"**, con un alcance de producto
distinto: mobile-first para iPhone, sin hints, sin notas, sin deshacer, sin
estadisticas, y con una UI pensada para el dedo.

La tentacion tecnica es obvio: el v1 ya tiene un motor de sudoku con generador
verificado, catalogo de tecnicas, rater, PWA offline y 257 tests. Why write it
again? Porque **copiarlo arrastra sus deudas**:

- El v1 tiene **dos convenciones de mascara conviviendo** (`1 << (d-1)` en
  `analysis.js`/`techniques.js` y `1 << d` en `solver.js`), documentadas como
  "ambas validas". Es exactamente el tipo de fuente de bug que el `kanam-logik`
  nacio para eliminar.
- El v1 define **4 niveles** en el motor y expone **3** en la UI.
- El v1 es **JavaScript**, sin tipos: el contrato del estado (la extension sin
  reescribir) no esta verificado por el compilador.
- El v1 fue **verificado en escritorio**, no en un iPhone de 390px con teclado en
  pantalla. Su UI cumple contraste AA y roles ARIA correctos, pero el layout no
  esta pensado para 100dvh, safe areas y areas tactiles de 44px.
- El v1 tiene **hints, notas, deshacer, estadisticas y selector de nivel en el
  tablero**: features que el pedido deja **fuera de alcance**. Adoptarlo implica
  elegir que se desarma.

Y hay una razon de **propiedad del repo**: el v1 es publico y esta en
`gonzoblasco/kanam-sudoku`. Un proyecto nuevo que se llamara casi igual, con
codigo casi igual, seria confuso para cualquiera que lea los dos repos.

## Decision

**Proyecto nuevo desde cero: `kanam-sudoku-iphone`, con motor propio. Cero lineas
de codigo copiadas de `kanam-sudoku` o `kanam-logik`.**

Lo que se **hereda** (y se declara explicitamente):

- **El conocimiento, no el codigo.** El research de tecnicas y sus tiers, la
  escalera de niveles, los patrones de conflict detection, la leccion de las dos
  convenciones de mascara, la leccion del fallback offline con `./`. Todo eso esta
  en la `KNOWLEDGE.md` y en los ADRs de este proyecto, **escrito desde cero**.
- **Las specs y ADRs de los proyectos previos**, como *estructura* de artefactos
  (que es lo que el workspace ya estandarizo), no como contenido.
- **El verificador de specs** del workspace
  (`~/.agents/skills/spec-driven-development/scripts/validate-spec.sh`).
- **Playwright-core y Chromium**, que ya estan instalados en la maquina: el e2e
  no agrega dependencias al proyecto.

Lo que **no** se hereda: ningun archivo, ninguna funcion, ningun test, ninguna
decision de codigo. El motor se escribe de nuevo, en TypeScript, con una sola
convencion de mascara declarada en un unico modulo (spec-001, RF-9), y el
catalogo de tecnicas arranca con el conjunto propio que la v1 necesita (que es
**menor** que el del v1: no hay hints ni explicador).

**Los dos proyectos previos no se tocan.** No se borran, no se archivan, no se
mueven: `kanam-sudoku` sigue siendo lo que es.

## Alternatives considered

| Alternative | Why it was discarded |
|---|---|
| **Forkear / clonar `kanam-sudoku` y adaptarlo** | Es la opcion mas tempting: el motor ya funciona y esta probado. Se descarta por (a) el pedido explicito de Gonzo ("proyecto fresco desde cero"), (b) las deudas que arrastra (dos convenciones de mascara, 4 niveles vs 3, sin tipos), y (c) el alcance de producto distinto: la v1 tiene hints, notas, deshacer y estadisticas, que hay que **desarmar** para llegar al alcance pedido. Desarmar features es mas caro y mas riesgoso que no construirlas. |
| **Reanudar `kanam-logik` (la v2 en borrador)** | Es la v2 de la v1: motor TS, escalera de 4 niveles, UI editorial. Se descarta porque (a) es un **borrador de spec, sin codigo**: habria que construir todo desde una spec de otro producto, (b) su alcance es "sudoku de escritorio con identidad editorial", no "sudoku tactil para iPhone de 390px", y (c) el pedido dice "proyecto fresco". Reanudarlo seria, de hecho, "usar un proyecto actual". |
| **Usar `kanam-sudoku` como libreria (importar su motor)** | El motor no esta publicado como paquete: habria que copiar archivos igual, y `import` de un repoSibling por ruta relativa es una dependencia no declarada que rompe el build de cualquier clon. Ademas arrastra la doble convencion de mascara. |
| **Buscar y usar una libreria OSS de sudoku** (por ejemplo `sudoku-solver`, `sudoku.js`, `@sugarsam/sudoku`) | Descartado por el mismo motivo que en ADR-0002: el nivel de dificultad depende del **tier de la tecnica**, y la jerarquia de tiers de una libreria externa habria que traducirla a la nuestra y mantenerla alineada. Ademas, la mayoria de las librerias resuelven el tablero pero **no exponen el paso logico**, que es lo que hace falta para clasificar por tecnica y (en la v2) para explicar hints. Y agrega una dependencia de runtime, contra ADR-0001. **Nota:** esto se evaluo en el reconocimiento (paso 1 del ciclo) y queda registrado como opcion descartada, no comoolvido. |
| **Escribir el motor en Rust/WASM y compilarlo** | El cuello de botella real es la generacion (un backtracking acotado), que en JS tarda menos de lo que el usuario tarda en levantar el dedo. WASM agrega toolchain, binarios y complejidad de carga para un gain despreciable. Ver ADR-0001. |

## Consequences

**Positive:**
- **El repo tiene un solo motor, con una sola convencion.** La deuda del v1 (dos
  mascaras conviviendo) no se reproduce: el esquema de mascara se declara en un
  unico modulo y hay un criterio de aceptacion que verifica que no exista una
  segunda forma.
- **El codigo esta en TypeScript y el estado esta tipado**: el contrato de la
  extension (ADR-0004) lo verifica el compilador de tipos, no la disciplina.
- **El alcance es exactamente el pedido**: sin hints, sin notas visibles, sin
  deshacer visible, sin estadisticas. No hay features que haya que desarmar.
- **La UI esta disenada para el objetivo real** (iPhone, 390px, tactil, 100dvh,
  safe areas) y no adaptada de una UI de escritorio.
- **Los dos repos son distinguibles**: `kanam-sudoku` (el de escritorio) y
  `kanam-sudoku-iphone` (el tactil), con codigo, stack y alcance distintos.
- **El catalogo de tecnicas arranca chico** (lo que la v1 necesita) y crece solo si
  hace falta: menos superficie que mantener.

**Negative / costs:**
- **Se reescribe codigo que ya existia y funcionaba.** Eso es exactamente lo que
  Gonzo pidio, pero el costo es real: se pierde el trabajo de 257 tests del v1 (que
  se **reimplementan** como tests nuevos, con criterios distintos) y hay que
  reescribir el catalogo de tecnicas.
- **Se reimplementanOffline, PWA, a11y y persistencia**, que el v1 ya tenia
  resueltos. Es la parte mas cara del costo.
- **Dos motores de sudoku en el workspace**, con dos catalogo de tecnicas que
  podrian divergir. Se acepta: el de este proyecto es mas chico y esta tipado, y
  los dos proyectos tienen alcances distintos. Si alguno dejara de avanzar, la
  decision se revisa explicitamente (no por deriva silenciosa).
- **El catalogo de tecnicas propio es mas chico que el del v1**, asi que el nivel
  "Dificil" de este proyecto puede no alcanzar la dificultad del "experto" del
  v1. Es una decision consciente: la v2 amplia el catalogo si hace falta.

## Reversibility

**Costo alto, y esa es la idea.** La decision "no reutilizar" es la que convierte
este repositorio en un proyecto con historia propia. Revertirla (volver a
consumir el motor del v1) significaria: dejar de mantener el catalogo propio,
adoptar la doble convencion de mascara o resolverla en un adaptor, y perder el
motor tipado. **No se revierte por conveniencia**: solo con evidencia de que el
motor propio quedo corto, y en ese caso lo que se hace es **ampliar el catalogo**,
no volver al v1. El ADR queda abierto a esa revision, pero la carga de la prueba
esta del lado de quien quiera revertir.
