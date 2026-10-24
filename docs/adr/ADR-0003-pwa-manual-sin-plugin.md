# ADR-0003: PWA con manifest y service worker escritos a mano, sin plugin de PWA

- **Status:** accepted
- **Date:** 2026-10-24
- **Deciders:** Gonzo / Kanam

## Context

Gonzo quiere abrir el juego en Safari en el iPhone y **agregarlo a la pantalla de
inicio**. Eso no es "un link con un favicon": para que iOS lo trate como app hace
falta un manifest valido, los meta tags de Apple, un icono propio, y (para que
funcione sin conexion) un service worker con un precache.

El workspace ya tiene un precedente: el `kanam-sudoku` v1 uso un **plugin de PWA**
de Vite. La decision de no usar plugin viene de ADR-0001 (cero dependencias de
runtime) y de una limitacion concreta que el v1 ya sufrio: la lista de precache
del plugin hay que **mantenerla a mano**, y cuando el build produce un archivo
nuevo y la lista no se actualiza, el service worker sirve una version incompleta
en offline. El v1 lo resolvio a mano (con un script que genera los iconos y una
plantilla de SW), pero con una lista de precache escrita en el codigo: la deuda de
que la lista se desactualice sigue existiendo.

Aparte, iOS tiene una particularidad queSafari en desktop no tiene: **`display:
"standalone"` del manifest no alcanza para quitar la barra de Safari**. Eso sale de
los meta tags de Apple (`apple-mobile-web-app-capable`). Una implementacion que
solo se apoye en el manifest se ve "web con barra" en iOS, que es justo lo que
Gonzo quiere evitar.

## Decision

**Manifest + service worker escritos a mano, sin plugin de PWA**, con la lista de
precache **generada en el build**.

Concretamente:

- **`public/manifest.webmanifest`** escrito a mano, con `name`, `short_name`,
  `description`, `start_url` y `scope` **relativos**, `display: "standalone"`,
  `orientation: "portrait"`, `background_color`, `theme_color` e `icons` (192,
  512 y al menos uno `maskable`).
- **Meta tags de Apple en el HTML**: `apple-mobile-web-app-capable` = `yes`,
  `apple-mobile-web-app-status-bar-style`, `apple-mobile-web-app-title` y
  `apple-touch-icon`. El `theme-color` del HTML coincide con el `theme_color` del
  manifest.
- **El service worker se emite en el build** (plugin de Vite propio, de unas pocas
  lineas, o un paso previo a `vite build`) de modo que la **lista de precache sea
  la real del build**: se arma a partir de los archivos que Vite produjo. La
  **version de la cache se deriva del contenido** de esa lista (hash de nombres y
  hashes de los archivos), no de una constante escrita a mano.
- **La navegacion offline responde con el `index.html` precacheado** (ruta
  relativa), no con la raiz del dominio: con `./` una navegacion en frio offline no
  encuentra nada. (Verificado en el v1: `./` rompia el fallback offline.)
- **El service worker se registra solo en produccion** (en dev pelea con el HMR).
- **Los iconos se generan localmente** con un script Node propio que escribe los
  PNG (por ejemplo con `node:zlib`), **sin dependencias**: el build falla si los
  iconos no existen o no tienen firma PNG valida.
- La app **no depende del service worker para jugar**: si no hay SW (o esta
  bloqueado), la app juega igual, solo que sin offline.

## Alternatives considered

| Alternative | Why it was discarded |
|---|---|
| **`vite-plugin-pwa` (el que uso el v1)** | Agrega una devDependency (contraviene ADR-0001) y, mas importante, su lista de precache es **declarativa y manual**: hay que mantenerla sincronizada con el build. El v1 ya sufrio el caso de un archivo nuevo sin precachear, servido como "no encontrado" en offline. La version generada en el build no puede desincronizarse. |
| **Servicio de CDN / host de PWA (Netlify, Cloudflare, Firebase Hosting)** | Resuelve el SW y el hosting, pero agrega un proveedor, una cuenta y un panel mas. El proyecto ya tiene hosting decidido (GitHub Pages, D1) y no necesita un segundo sistema. El repo publico es el que se despliega, y|Pages ya es el pipeline. |
| **Solo `apple-mobile-web-app-capable`, sin service worker** | La app se instalaria y abriria a pantalla completa, pero **sin conexion no cargaria**: en un subway o en un vuelo la app es un icono que no abre. Gonzo la usa a diario, y la decision D3 fue explicitamente "PWA completa: manifest + service worker". Descartado por decision de producto, no tecnica. |
| **Cache-First puro sin precache** | Los assets cambian de hash en cada build y el cache serviria versiones viejas. Con precache + version derivada del contenido, el problema desaparece. |
| **Network-First para todo** | Correcto pero inutil offline: sin red, cada request falla y la app no muestra nada. El precache existe justamente para que el primer request ya tenga respuesta local. |
| **Escribir los PNG de los iconos a mano con un editor grafico** | Los iconos dejan de ser reproducibles: regenerarlos es una tarea manual y su diff no se ve en git. Un script determinista hace que "cambiar el icono" sea un commit. |
| **Usar SVG como icono** | iOS no usa SVG como `apple-touch-icon` (necesita PNG). Ademas el manifest requiere PNG para la instalacion en la mayoria de las plataformas. |

## Consequences

**Positive:**
- **El precache no puede desincronizarse del build**: se genera desde los archivos
  reales, asi que un archivo nuevo queda precacheado por definicion.
- **La version de la cache deriva del contenido**: un cambio de archivo invalida
  la cache anterior de forma automatica, sin constantes que actualizar a mano.
- **Cero dependencias**: el bundle no crece y el `package.json` tiene una sola
  devDependency (Vite).
- **Control del fallback offline**: el caso de la navegacion en frio (que en el v1
  estaba roto) es un comportamiento explicito y testeado, no un efecto colateral.
- **Los iconos son reproducibles**: el script es determinista, asi que regenerarlos
  no produce diff y "cambiar el logo" es un commit revisable.
- **Meta tags de Apple**, que es lo unico que hace que iOS abra la app sin barra de
  Safari.

**Negative / costs:**
- **El SW es codigo que hay que mantener**: el ciclo de instalacion/activacion/
  actualizacion y la estrategia de cache son propios. Un plugin los traia dados.
- **El paso de build que genera el SW** es codigo propio (unas pocas lineas) que
  hay que entender y mantener: si el build de Vite cambia sus internals, hay que
  ajustarlo.
- **El script de iconos tiene que escribir PNG a mano** (con `node:zlib`): es
  correcto pero es codigo poco obvio para quien lea el repo. La alternativa
  (plugin) tiene la misma complejidad oculta, pero mas dependencias.
- **Offline en iOS tiene limites de sistema**: iOS puede purgar la cache del
  sitio. La app debe arrancar limpio y sin error cuando eso pase (esta en los
  edge cases de spec-006).

## Reversibility

**Costo bajo.** Todo lo de esta decision vive en tres lugares acotados: el
manifest, el SW y el script de iconos. Cambiar a un plugin significa borrar esos
tres y agregar la devDependency: el resto de la app no lo toca. Lo unico que
afecta al resto es el `base` relativo (ADR-0005), que es una condicion del
hosting, no de esta decision.
