# BRIEF - Kanam Sudoku iPhone

<!-- project: github.com/gonzoblasco/kanam-sudoku-iphone -->

## Que

Juego de sudoku clasico 9x9, táctil, mobile-first para iPhone. Se instala en la
pantalla de inicio, funciona sin conexión, y no tiene cuentas ni backend.

## Por que

Gonzo juega sudoku a diario desde una app de terceros (Apple Arcade) que no esta
pensada para el dedo ni para instalarse como PWA. Falta un sudoku **nuestro** que
funcione en Safari a pantalla completa, se use offline, y no tenga anuncios ni
cuentas.

Ademas el repo es publico: es una pieza de portfolio. "Un sudoku" no es interesante;
"un sudoku que se siente nativo en iPhone, con un motor propio verificado y
accesibilidad de fabrica" si.

## Alcance de la v1

**Sudoku clasico 9x9, ejecutado para el iPhone.** Sin variantes en la v1: nada de
6x6, 12x12, killer ni diagonal. El foco esta en que se sienta nativo en el telefono
y en que el motor sea correcto, no en la cantidad de modos.

## Imprescindibles (del pedido de Gonzo, 2026-10-24)

1. **Mobile-first real.** Optimizado para ~390px de ancho, vertical. Tactil: nada de
   hover ni teclado fisico. Areas tactiles de 44x44px minimo. Safe areas del iPhone y
   `100dvh` para que la pantalla no scrollee.
2. **Tablero cuadrado** que ocupe el ancho disponible, con lineas mas gruesas
   separando los bloques 3x3.
3. **Modo claro y oscuro** segun la configuracion del sistema.
4. **Nueva partida con 3 dificultades** generadas en el momento, cada una con
   **solucion unica**.
5. **Teclado numerico en pantalla** (1-9) debajo del tablero.
6. **Pistas iniciales no editables**, distinguibles visualmente de lo que carga el
   jugador.
7. **Resaltado contextual** al seleccionar: fila, columna, bloque y todas las celdas
   con el mismo numero.
8. **Conflictos en rojo**: los numeros que rompen las reglas (repetido en fila,
   columna o bloque).
9. **Borrado** de celda.
10. **Pantalla de victoria** al completar el tablero correctamente.
11. **Instalable**: add-to-home-screen con icono propio, sin barra de Safari, y
   **funciona sin conexion**.
12. **Estado extensible**: el diseno del estado tiene que permitir agregar deshacer,
    notas por celda y guardado de partida **sin reescribirlo**. Las notas por celda
    ya se agregaron (2026-10-24) y la promesa se cumplio: el nucleo no se reescribio.
    Quedan el deshacer y el resto del guardado.

## No-objetivos de la v1

- Hints que explican la tecnica.
- Notas por celda y modo de anotaciones. **(Agregado el 2026-10-24, a pedido de
  Gonzo: entra en la v1. Ver SPEC-007.)**
- Deshacer/rehacer.
- Estadisticas, records, ranking, racha.
- Cuentas, multijugador, backend, telemetria, anuncios, pagos.
- Variantes de tablero (6x6, 12x12, jigsaw, killer, diagonal).
- Teclado fisico / shortcuts de escritorio.

## Stack

- **TypeScript + Vite.** TypeScript da el contrato explicito del estado (imprescindible
  12) y Node 26 corre los tests `.ts` con type stripping nativo, **sin paso de
  build** (verificado: `node --test` encuentra y ejecuta tests `.ts`).
- **Cero dependencias de runtime.** El motor de sudoku se escribe, no se importa: es
  el corazon del juego y de el dependen la generacion, la validacion y la
  clasificacion de dificultad.
- **Vite** como dev server y build, con `base` relativo para que funcione bajo el
  subpath de GitHub Pages.
- **PWA**: manifest + service worker escritos a mano, sin plugin de PWA. Iconos
  generados localmente.
- **`localStorage`** para la partida en curso y las preferencias.
- **Tests con `node --test`** sobre la logica de juego, sin DOM.
- **Verificacion de UI en Chromium real** (Playwright-core, ya en la maquina) con
  viewport de iPhone.

## Accesibilidad

De fabrica, no como parche: grilla navegable por teclado, roles y etiquetas ARIA
correctas, foco visible, contraste AA en modo claro y oscuro, y **ningun estado que
dependa solo del color** (dada, seleccionada, en conflicto, resaltada).

## Estado

- [x] Reconocimiento (2026-10-24)
- [x] Discovery (2026-10-24)
- [ ] Definition
- [ ] En desarrollo
- [ ] Live
- [ ] Archivado

## Decisiones clave

- **Clasico 9x9 primero** - pedido explicito; las variantes son ruido antes de que el
  core este bien.
- **Dificultad por tecnica, no por cantidad de vacios** (D2) - un "Dificil" con
  muchos vacios puede ser facil. El generador mide que tecnica hace falta.
- **Solucion unica verificada por el generador**, no asumida.
- **Motor propio** - sin el, la dificultad por tecnica no es medible.
- **Sin dependencias de runtime** - el bundle va a la app de Gonzo por una red movil.
- **Repo publico + GitHub Pages** (D1) - sin costos, y queda de portfolio.
