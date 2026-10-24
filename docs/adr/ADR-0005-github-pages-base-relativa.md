# ADR-0005: GitHub Pages con `base: "./"` y rutas relativas

- **Status:** accepted
- **Date:** 2026-10-24
- **Deciders:** Gonzo / Kanam

## Context

El hosting es **GitHub Pages desde un repo publico** (decision D1 de Gonzo, 2026-10-24).
Eso implica que la app se sirve en:

```
https://gonzoblasco.github.io/kanam-sudoku-iphone/
```

es decir, **bajo un subpath**, no en la raiz del dominio. Ese detalle tiene
consecuencias en toda la capa de rutas:

- Vite, por defecto, genera assets con ruta **absoluta** (`/assets/index-abc.js`).
  Bajo Pages, `/assets/...` apunta a `https://gonzoblasco.github.io/assets/...`, que
  **no existe**: la app carga el HTML y no carga el JS.
- El `start_url` y el `scope` del manifest tienen que ser **relativos** por la
  misma razon.
- El **service worker** tiene que registrar con el scope correcto bajo el subpath,
  y su precache tiene que apuntar a los archivos reales relativos.
- El **fallback de navegacion offline** tiene que servir el `index.html`
  precacheado por su ruta relativa. Servir `./` (la raiz del subpath) no
  funciona: en una navegacion en frio offline, esa ruta no esta en la cache
  (la cache tiene `./index.html`, no `./`).

Esto ya se pago en el `kanam-sudoku` v1: la app se developaba en la raiz
(`localhost:5173`) y se rompia en Pages. Alli la correccion fue poner `base: "./"`,
pero **el fallback offline se corrigio aparte y despues**, con una corrida offline
real en Chromium: el `./` no encontraba nada y habia que servir `./index.html`.

## Decision

**GitHub Pages, con `base: "./"` (relativo) en Vite y todas las rutas del proyecto
relativas al documento.**

Concretamente:

- `vite.config.ts` declara `base: "./"`.
- El manifest usa `start_url: "./"` y `scope: "./"` (relativos).
- El `service worker` se registra con una ruta **relativa al documento**, de modo
  que su scope sea el subpath real.
- La **lista de precache** se arma con rutas relativas (`./index.html`,
  `./assets/...`).
- El **fallback de navegacion offline** responde con `./index.html` (el archivo
  precacheado), **no** con `./`.
- La **app se verifica en las dos rutas**: en la raiz (dev server) y bajo un
  subpath (el e2e sirve el build con un prefijo de path y comprueba que la app
  carga, online y offline, con el scope del SW correcto).
- El HTML declara `<link rel="manifest" href="./manifest.webmanifest">` y los
  iconos con rutas relativas.

## Alternatives considered

| Alternative | Why it was discarded |
|---|---|
| **Custom domain (un dominio propio, tipo `sudoku.gonzoblasco.dev`)** | Da la raiz del dominio, lo que simplifica las rutas y permite un nombre mas lindo. Descartado por costo y friccion: hay que configurar DNS y, sobre todo, un certificado TLS valido (Let's Encrypt,renewal, etc.) que hay que mantener. El repo publico de Pages ya resuelve el hosting sin mantenimiento. **Es la via de upgrade si el proyecto crece**: el `base` relativo funciona en la raiz tambien, asi que migrar despues es cambiar DNS, no reescribir el codigo. |
| **Base absoluto (`base: "/kanam-sudoku-iphone/"`)** | Es explicito y funciona en Pages, pero **rompe el dev server** (los assets se piden en `/kanam-sudoku-iphone/assets/...` y en local no existen) y rompe cualquier otro hosting. El relativo funciona en **todas** las rutas: subpath, raiz y `file://`. |
| **Base vacio (`base: "/"`)** | El default de Vite. No funciona bajo Pages: los assets se piden en la raiz del dominio. Es el error clasico de "funciona en local y se rompe en Pages". |
| **Rutas relativas escritas a mano en el codigo** (sin `base`) | Hay que construir cada URL a mano y acordarse del subpath en cada lugar. La opcion `base: "./"` de Vite resuelve el problema de una vez, en un solo lugar, y es la que Vite soporta. |
| **Servir el build con un servidor propio que reescriba las rutas** | Agrega un componente (el server) y una configuracion mas, para resolver un problema que `base: "./"` resuelve en una linea. |

## Consequences

**Positive:**
- **El mismo build funciona en la raiz y en el subpath**, y en cualquier otro
  hosting estatico. No hay un "solo funciona en Pages" que se descubre tarde.
- **El dev server y el build de produccion se parecen**: mismo `base`, mismas rutas
  relativas. El e2e puede servir el `dist/` con un prefijo de path y reproducir el
  caso de Pages sin deploy.
- **El SW tiene un scope correcto** sin configuracion por entorno: el scope se
  deriva de la ruta del propio script.
- **Migrar a un dominio propio despues es cambiar DNS**, no reescribir el codigo.
  La decision no cierra la puerta.

**Negative / costs:**
- **Las rutas relativas tienen un costo real**: si el usuario navega a
  `/kanam-sudoku-iphone/otra/ruta` (deep link), las rutas relativas apuntan a
  `/kanam-sudoku-iphone/otra/assets/...`. La app no usa deep links (es una
  pantalla unica, sin router), asi que no hay problema hoy. Si alguna vez hay
  routing, hay que usar rutas absolutas **con base dinamica** o el fallback del
  SW.
- **El SW sirve el fallback con `./index.html`**, y esa es una decision que hay que
  recordar (en el v1 se ofrecio como `./` y rompio el offline). Queda escrito en el
  ADR y en los edge cases de spec-006 justamente para que no se repita.
- **El test tiene que correr en las dos rutas**: el e2e de PWA duplica parte de
  los checks (raiz y subpath). Es trabajo de test que se paga una vez.

## Reversibility

**Costo bajo.** `base` es una linea de configuracion, y las rutas del manifest, del
SW y del HTML son relativas en un solo lugar cada una. Migrar a un dominio propio
(cambiar `base` a `"/"` o dejarlo relativo, y cambiar DNS) no toca la logica. Lo
unico que habria que rehacer es el fallback offline, que esta explicito en un solo
sitio.
