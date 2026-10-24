# DISCOVERY - Kanam Sudoku iPhone

<!-- project: github.com/gonzoblasco/kanam-sudoku-iphone -->

## La idea en una linea

Un juego de sudoku clasico 9x9, táctil, pensado para el iPhone, que se instala en la
pantalla de inicio y se juega offline, con puzzles de solución unica y dificultad
definida por la tecnica de resolucion que hace falta.

## El problema

Hoy el juego diario de sudoku de Gonzo depende de una app de terceros (Apple Arcade):
contenido, anuncios y una experiencia pensada para otra plataforma. Falta un sudoku
que sea **nuestro**, que funcione en Safari sin cuenta ni backend, y que se sienta
nativo en el telefono en lugar de una web app estirada dentro de un navegador.

El problema no es "no hay sudoku en la web" (hay cientos). El problema es que **ninguno
esta hecho para el dedo en un iPhone de 390px**: teclado de escritorio, hover, scroll
y areas tactiles chicas. Ademas la mayoria no te deja **agregar la app a la pantalla
de inicio** y seguir jugando sin conexion.

## Usuarios y sus trabajos

| Usuario | Trabajo | Paga | Usa |
|---|---|---|---|
| Gonzo (unico usuario declarado) | Jugar un sudoku por dia, en el celular, en ratos | no | iPhone, Safari, sin conexion a veces |
| Visitante del repo (repo publico) | Ver el juego funcionando y leer el codigo | no | desktop o mobile, uno o dos minutos |

Separando quien paga de quien no: **nadie paga**. No hay cuentas, ni pagos, ni
telemetria, ni anuncios. El valor es la experiencia y, en el caso del repo, que el
codigo sea legible y la app funcione de verdad.

## Escenario de punta a punta

1. Gonzo abre la URL en Safari en el iPhone, toca Compartir -> **Anadir a pantalla de
   inicio**. Aparece un icono propio, sin barra de Safari.
2. Toca el icono. La app abre a pantalla completa. Si no hay senal, **igual carga**:
   el service worker tiene todo cacheado.
3. Pantalla de inicio con tres botones grandes: **Facil / Medio / Dificil**.
4. Toca "Medio". El generador produce un puzzle con **solucion unica** y con el
   tier de tecnica que corresponde a Medio.
5. Toca una celda: se resaltan su fila, columna y bloque, y todas las celdas que ya
   tienen ese mismo numero.
6. Toca un numero en el teclado de pantalla: entra en la celda. Si ese numero rompe
   las reglas, la celda queda **en rojo**.
7. Toca "borrar": la celda se vacia. Las pistas iniciales **no se pueden editar**.
8. Completa el tablero: pantalla de victoria con el tiempo.
9. Cierra la app sin terminar, la reabre: **retoma la partida** (no hay estadisticas,
   pero tampoco se pierde el progreso).

## Capacidades candidatas

| ID | Capacidad | Marca |
|---|---|---|
| C1 | Generacion de puzzle con solucion unica | `[core]` |
| C2 | Clasificacion de dificultad por tecnica de resolucion | `[core]` |
| C3 | Validacion de reglas y marcado de conflictos | `[core]` |
| C4 | Tablero tactil movil: seleccion, escritura, borrado, resaltados | `[core]` |
| C5 | Teclado numerico en pantalla | `[core]` |
| C6 | Flujo inicial (menu de niveles) y pantalla de victoria | `[core]` |
| C7 | PWA instalable: manifest, service worker, offline, iconos | `[core]` |
| C8 | Estado de juego extensible (deshacer, notas, guardado) | `[core]` - solo la forma, no las funciones |
| C9 | Persistencia de la partida en curso | `[core]` - el pedido no lo pide, pero sin el el escenario "retomar" no cierra |
| C10 | Cronometro | `[apoyo]` - asumido, D5 |
| C11 | Hints que explican la tecnica | `[fuera de v1]` - lo pide el producto de referencia, no Gonzo |
| C12 | Notas por celda | `[fuera de v1]` - pedido explicitamente como extension futura |
| C13 | Deshacer/rehacer | `[fuera de v1]` - pedido explicitamente como extension futura |
| C14 | Estadisticas, records, ranking | `[fuera de v1]` - el pedido lo excluye |
| C15 | Cuentas, multijugador, backend, telemetria, anuncios | `[fuera de v1]` - el pedido lo excluye |
| C16 | Variantes (6x6, 12x12, killer, diagonal) | `[fuera de v1]` - el pedido pide 9x9 clasico |
| C17 | Notificaciones o recordatorios | `[fuera de v1]` |

C8 es `[core]` por una razon precisa: el pedido dice *"Disena el estado para que mas
adelante pueda agregar deshacer, notas por celda y guardado de partida sin
reescribirlo"*. C8 no es una funcion, es una **restriccion de forma** sobre C4/C5/C9.
Se verifica en la spec, no en el tablero.

## Alcance propuesto para la v1

**Adentro:** C1-C10. Sudoku 9x9 clasico, 3 dificultades, instalable, offline, tactil,
sin cuentas ni backend.

**Afuera:** C11-C17. Explicitamente: sin hints, sin notas, sin deshacer, sin
estadisticas, sin variantes, sin backend.

**La paradoja que hay que resolver de entrada:** C11 (hints) y C12/C13 (notas y
deshacer) son *"extensions futuras"*, pero el pedido tambien dice que la UI tiene que
dejar espacio para ellas. La respuesta es **una sola**: el estado del juego se
modela con historial y notas **presentes en la estructura** (con unidades
minimas) aunque la v1 no los exponga en la UI. La UI no los renderiza, pero el
estado no los prohibe. Esa es la diferencia entre *"dejar el lugar"* y *"dejar el
hueco"*.

## Riesgos

| Riesgo | Impacto | Mitigacion |
|---|---|---|
| Generar un puzzle con mas de una solucion | Alto: el juego es invalido | El generador verifica unicidad (`countSolutions(puzzle, 2) === 1`) **despues de cada quitado** y descarta el candidato |
| La difficulty "por tecnica" no converge en un tiempo razonable | Alto: el menu se queda colgado | El generador acota intentos y devuelve un resultado honesto; el tiempo maximo de generacion se mide |
| El tablero no entra en 390px con el teclado abajo | Alto: en un iPhone chico se ve cortado | Alto fijo con `dvh`, `safe-area-inset`, y el tablero con `aspect-ratio: 1`; se verifica en un viewport de 390x844 real |
| Safari mobile no soporta alguna API usada | Medio: la app no arranca | Solo APIs con soporte amplio en Safari iOS 16+; sin dependencias de runtime |
| El service worker cachea una version vieja y el usuario ve un bug fixed | Medio | Version derivada del contenido del precache; el SW actualiza en segundo plano |
| La PWA no abre a pantalla completa en iOS | Medio: se ve la barra de Safari | `apple-mobile-web-app-capable` + `apple-mobile-web-app-status-bar-style` en el manifest |
| Se confunde con el `kanam-sudoku` viejo y alguien copia codigo | Medio | Repo y root propios; el codigo viejo se declara prehistoria, no fuente |

## Prior art (reconocimiento con evidencia)

**Este proyecto arranca desde cero. No se reutiliza codigo de ningun proyecto
existente.** Lo que sigue es reconocimiento, no material de copia.

| Fuente | Que aporta | Que NO se hace con ella |
|---|---|---|
| `projects/kanam-sudoku/` (repo publico, v1 previa) | Evidencia de que un motor propio con generador verificado es viable; 257 tests | **No se copia ni se reusa ningun archivo.** Es un repo distinto, con nombre distinto, y no se toca. Su deuda de dos convenciones de bitmask (`src/core/analysis.js:10` documenta `1 << (d-1)` conviviendo con `1 << d` de `solver.js`) es exactamente lo que este proyecto NO hereda |
| `projects/kanam-logik/` (borrador de v2) | Especificacion de que la escalera de dificultad debe derivar de la tecnica, no de una tabla | No se implementa: su idea es la misma que C2, pero el motor es nuevo |
| Node 26.8.1 de la maquina | **TypeScript nativo con type stripping**: `node --test` corre tests `.ts` sin paso de build (verificado en `/tmp/tscheck`: 1 test, 0 fallos) | - |
| Playwright-core + Chromium headless en la maquina | Verificacion de UI en navegador real (el AGENTS.md exige browser real, no jsdom) | - |
| `~/Library/Caches/ms-playwright/chromium_headless_shell-1243` | Binario de Chromium para el smoke test e2e | - |

**Conclusion del reconocimiento:** existe un motor previo que resuelve el problema
tecnico, pero el pedido es explicito - *proyecto fresco desde cero* - y ademas el
pedido apunta a un iPhone con un alcance de features distinto (mobile-first, sin
hints, sin notas, sin deshacer). Se construye de cero, sin arrastrar las deudas del
v1.

## Decisiones de negocio

| ID | Decision | Estado | Notas |
|---|---|---|---|
| D1 | Hosting: GitHub Pages desde repo **publico** | **Cerrada** (Gonzo, 2026-10-24) | URL `gonzoblasco.github.io/kanam-sudoku-iphone` |
| D2 | Dificultad: **por tecnica de resolucion**, no por cantidad de vacios | **Cerrada** (Gonzo, 2026-10-24) | "Facil de verdad facil" |
| D3 | Instalacion: **PWA completa** (manifest + service worker) | **Cerrada** (Gonzo, 2026-10-24) | Offline real, pantalla completa sin barra |
| D4 | Nombre del proyecto y del repo: `kanam-sudoku-iphone` | **Asumida** | Reversible: es el nombre de la URL. Cambiarlo antes del primer push es trivial |
| D5 | Cronometro: **si**, simple, sin stats ni records | **Asumida** | El pedido excluye estadisticas pero no el tiempo. Reversible |
| D6 | Flujo inicial: **menu de bienvenida** con los 3 niveles | **Asumida** | Reversible: es la pantalla de arranque, no la arquitectura |
| D7 | Stack: **TypeScript + Vite, cero dependencias de runtime** | **Asumida** | Fundamento: type stripping nativo de Node 26 (verificado), logica de juego testeable sin DOM, y el estado tipado hace explicito el contrato de "dejar el lugar" para deshacer/notas (C8) |
| D8 | Visibilidad del repo: **publico** | **Cerrada** (consecuencia de D1) | - |

**Ninguna decision abierta.** Las 4 asumidas (D4-D7) son reversibles antes del
primer push y estan marcadas como asumidas, no como respondidas.
