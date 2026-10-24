# kanam-spec

**ID:** SPEC-202610240006
**Title:** PWA instalable, offline, con iconos propios y menu de niveles
**Owner:** Gonzo
**Status:** Draft
**Priority:** P1

## Intent & Context

### Problema

El uso real que pide Gonzo es: *"Lo voy a usar en Safari y agregarlo a la pantalla de
inicio"*. Eso tiene tres partes que tienen que funcionar de verdad, y las tres son
faciles de hacer mal:

1. **Que se pueda agregar a la pantalla de inicio con un icono propio** (no el
   screenshot ni el favicon por defecto).
2. **Que abra a pantalla completa**, sin la barra de Safari arriba. En iOS eso no
   sale del manifest estandar: sale de los meta tags de Apple
   (`apple-mobile-web-app-capable`) y del `apple-touch-icon`.
3. **Que funcione sin conexion.** Si no, la app es un atajo a una pagina web que
   falla sin señal, y en un subway es inútil.

Ademas, la app tiene que **arrancar bien**: la primera vez, un menu con los tres
niveles (D6); las siguientes, si hay una partida en curso, **ofrecer continuar**
(SPEC-005). Y tiene que **declararse instalable**: el prompt de instalacion de
Chrome/Edge y el boton "compartir -> anadir a pantalla de inicio" de iOS necesitan
un manifest valido.

### Objetivo

1. Un **manifest** valido, con nombre, icono, `display: standalone`, `start_url`
   y `theme_color`, y **meta tags de Apple** para que iOS lo trate como app.
2. Un **service worker** que precachea la app completa y la sirve **offline**.
3. **Iconos propios** generados localmente (sin dependencias), en los tamanos que
   pide la plataforma.
4. Un **menu de niveles** como pantalla de inicio, con "continuar" cuando hay
   partida en curso.
5. La app **se declara instalable** (criteria de instalabilidad del navegador).

### No-objetivo

- No hay notificaciones push, ni background sync, ni analytics.
- No hay "auto-update" con flujo de la app: el service worker actualiza en
  segundo plano y la nueva version se aplica en la siguiente carga.
- No hay iconos adaptativos por plataforma de mas de una variante (maskable y
  normal): lo minimo que la plataforma exige.
- No hay un boton de "instalar" propio: el prompt nativo del navegador es el
  camino, y en iOS es el menu Compartir.

### Modelo conceptual compartido

- **Manifest**: el archivo que describe la app instalable.
- **Service worker (SW)**: el script que intercepta las peticiones y sirve desde
  la cache.
- **Precache**: el conjunto de archivos que el SW guarda en la cache al instalar.
- **Version de cache**: un identificador derivado del **contenido** del precache,
  para que un cambio de archivo invalide la cache vieja.
- **Modo navegacion offline**: cuando no hay red, el SW responde con el
  `index.html` cacheado para las navegaciones.
- **Menu de niveles**: la pantalla de inicio con Facil / Medio / Dificil.
- **Continuar**: la accion de retomar la partida en curso.

## Requisitos funcionales

- **RF-1.** Existe `manifest.webmanifest` valido, con: `name`, `short_name`,
  `description`, `start_url` (relativo, con el subpath de Pages), `scope`
  (relativo), `display: "standalone"`, `orientation: "portrait"`,
  `background_color`, `theme_color` e `icons` (al menos 192, 512 y uno
  `maskable`).
- **RF-2.** El HTML declara los **meta tags de Apple**: `apple-mobile-web-app-capable`
  (o `mobile-web-app-capable`) con contenido `yes`,
  `apple-mobile-web-app-status-bar-style`, `apple-mobile-web-app-title` y
  `apple-touch-icon`.
- **RF-3.** `theme-color` del HTML coincide con el `theme_color` del manifest, y
  ambos coinciden con el color real de la barra de la app.
- **RF-4.** Existe un **service worker** que se registra **solo en produccion**
  (en desarrollo pelea con el HMR) y que en la instalacion precachea la lista real
  de archivos del build.
- **RF-5.** La **version de la cache** se deriva del **contenido** de la lista de
  precache (por ejemplo, un hash de los nombres y los hashes de los archivos), no
  de una constante escrita a mano: si cambia un archivo, cambia la version.
- **RF-6.** Con la app **offline** (contexto offline del navegador), una
  navegacion a la URL de la app devuelve la app completa: el tablero se dibuja, las
  celdas son 81, y se puede **jugar** (tocar celda, escribir digito).
- **RF-7.** En offline, la navegacion responde con el `index.html` **precacheado**
  (ruta relativa al subpath), no con la raiz del dominio: con `./` una navegacion
  en frio offline no encuentra nada.
- **RF-8.** Bajo un **subpath** (como `https://<user>.github.io/<slug>/`), la app
  carga, el SW registra con el scope correcto y el precache resuelve bien. (Es el
  caso real de GitHub Pages.)
- **RF-9.** Los **iconos** se generan con un script local, sin dependencias de
  runtime ni de build: el script escribe los PNG.
- **RF-10.** El **menu de niveles** muestra tres botones: Facil, Medio, Dificil.
- **RF-11.** Si hay **partida en curso**, el menu muestra ademas "Continuar" (con el
  nivel de la partida), y el menu es el **primer** pantallazo.
- **RF-12.** Pulsar un nivel del menu **genera el puzzle y arranca la partida** de
  ese nivel.
- **RF-13.** La generacion del puzzle puede tardar (Dificil): la UI muestra un
  estado de "Generando..." y **no** queda en un spinner eterno si la generacion
  falla.
- **RF-14.** Si la generacion **falla** (no se encuentra un puzzle del nivel
  pedido), la app lo dice con un mensaje honesto y ofrece reintentar o elegir
  otro nivel. No muestra un puzzle etiquetado con un nivel que no se midio.
- **RF-15.** "Continuar" restaura la partida guardada y **no** genera un puzzle
  nuevo.
- **RF-16.** La app declara los **criterios de instalabilidad** del navegador
  (manifest valido + service worker con fetch handler + iconos).

## Restricciones tecnicas

- TypeScript + Vite con `base: "./"` (relativo): todo el precache y las rutas
  del SW son relativas al subpath de Pages.
- Cero dependencias de runtime: **el service worker se escribe a mano**, sin
  plugin de PWA; los **iconos se generan** con un script Node propio (por ejemplo
  escribiendo el PNG con `node:zlib`), sin librerias de imagen.
- El SW se emite desde el build (por ejemplo, con un plugin de Vite que lo
  genera) de modo que la **lista de precache sea la real** del build, no una
  escrita a mano que se desactualiza.
- El script de generacion de iconos **corre antes** del build (o su salida se
  versiona en `public/`), y el build **falla** si los iconos no existen.
- La app **no** registra el SW en desarrollo.
- La UI no depende de `navigator.serviceWorker` para funcionar: si el SW no esta
  disponible (o el usuario lo bloqueo), la app **igual** juega, solo que sin
  offline. La instalacion en iOS tampoco requiere el SW.
- `apple-mobile-web-app-capable` es lo que hace que iOS abra la app sin barra de
  Safari; el manifest `display: standalone` no alcanza en iOS.

## Modelo de datos minimo

```ts
interface AppPhase {
  phase: "menu" | "generating" | "playing" | "victory";
  difficulty: Difficulty | null;
  savedGame: SavedGame | null;   // para el "Continuar" del menu
  error: string | null;          // mensaje honesto si la generacion fallo
}
```

## 5. Acceptance Criteria

- `manifest.webmanifest` **parsea como JSON** y contiene las claves `name`,
  `short_name`, `start_url`, `scope`, `display`, `orientation`, `theme_color`,
  `background_color` e `icons`.
- `manifest.display === "standalone"` y `manifest.orientation === "portrait"`.
- `manifest.start_url` y `manifest.scope` son **relativos** (no empiezan por `/`):
  bajo Pages funcionan.
- El manifest declara **al menos tres iconos** (uno de 192, uno de 512 y al menos
  uno con `"purpose": "maskable"`), y **cada archivo de icono existe** en disco.
- El HTML contiene `apple-mobile-web-app-capable` con valor `yes`, mas
  `apple-mobile-web-app-status-bar-style` y `apple-touch-icon`.
- El `theme-color` del HTML es **igual** al `theme_color` del manifest.
- En el build de produccion existe un service worker **registrado** y con
  `fetch` handler.
- Con `context.setOffline(true)` y una recarga, la app **carga**: el DOM tiene 81
  celdas y **se puede jugar** (un toque escribe un digito). La asercion falla si
  el tablero no aparece.
- Bajo un **subpath** (`/kanam-sudoku-iphone/`), online y offline, la app carga y
  el tablero dibuja 81 celdas.
- La **version de la cache cambia** cuando cambia el contenido del precache: el
  test compara la version con dos listas de precache distintas y verifica que
  difieren.
- El script de generacion de iconos produce **3 PNG validos** (verificable por la
  firma del archivo: bytes `89 50 4E 47`) y es **determinista**: dos corridas
  producen archivos identicos.
- El **menu** muestra 3 botones de nivel con los textos "Facil", "Medio" y
  "Dificil".
- Con una partida guardada, el menu muestra ademas un boton "Continuar".
- Al pulsar "Facil", la app **deja el menu** y muestra un tablero con 81 celdas y
  una partida en curso.
- Al pulsar "Continuar", la app **restaura la partida guardada**: la grilla es la
  misma que estaba guardada (comparada celda a celda) y **no** hay un puzzle
  nuevo.
- La app **no** queda en "Generando..." para siempre: con el generador forzado a
  fallar, la app muestra un mensaje de error y la opcion de reintentar, y el
  boton "Generando..." desaparece.
- Con un generador que no encuentra un puzzle del nivel pedido, la app **no**
  muestra un tablero con un nivel mentiroso: muestra el mensaje honesto.
- **Cero errores de consola** en el recorrido completo (menu -> partida -> juego ->
  victoria), online y offline.

## 6. Edge Cases & Error Handling

- **El navegador no soporta service workers** (o esta en un contexto insecure):
  la app **igual** juega; no hay offline, y no hay error visible. El registro
  falla en silencio (con un warning en consola, no un error).
- **El SW esta desactualizado en cache**: la version derivada del contenido
  invalida la cache anterior en la activacion; la nueva version se sirve en la
  carga siguiente.
- **La primera carga es offline y no hay nada en cache**: no hay nada que servir.
  La app muestra un mensaje claro de "sin conexion y sin copia local", no una
  pantalla en blanco. (Es honesto: la app se instala y precachea en la primera
  carga con red.)
- **El usuario borra los datos del sitio en iOS**: la cache y el guardado se van.
  La app arranca en el menu, sin partida en curso. Es el comportamiento esperado.
- **Generacion lenta en un iPhone viejo**: la UI muestra "Generando..." y no
  bloquea la interfaz; el menu sigue siendo accesible para cancelar.
- **El generador devuelve `matched: false`** (no encontro el nivel pedido): la app
  lo dice y propone el nivel realmente medido, en vez de fingir.
- **Un icono generado queda corrupto**: el build falla (el script verifica la
  firma PNG), en vez de publicar un icono roto.
- **El scope del SW no coincide con la ruta de Pages**: el registro falla y la app
  sigue funcionando, sin offline. El test e2e bajo subpath verifica que **si**
  coincide.
- **`localStorage` bloqueado** (modo privado estricto): la app juega igual, sin
  guardar partida. Ya lo cubre SPEC-005, pero el menu no debe romperse al no
  poder leer el guardado.
- **Un request a un recurso que no esta en el precache y no hay red**: el SW
  responde con un error controlado; la app no se rompe por un recurso faltante.

## 7. Verification Plan

**Automatico** (Chromium headless, con Playwright-core, en dos escenarios: online
y offline; y en dos rutas: raiz y subpath):

```bash
cd ~/projects/kanam-sudoku-iphone
npm run build
node test/e2e.pwa.mjs
```

Checks minimos: el manifest parsea y tiene todas las claves; los iconos existen y
tienen firma PNG; los meta tags de Apple estan; el SW registra y tiene fetch
handler; la app carga **offline** y se puede jugar; la app carga **bajo subpath**;
la version de cache cambia con el contenido; el menu muestra 3 niveles; "Continuar"
restaura la partida sin generar otra; el fallo de generacion muestra un mensaje y
no un spinner eterno; **cero errores de consola**.

**Manual** (en el iPhone, que es el objetivo real):

1. Abrir la URL en Safari.
2. Compartir -> **Anadir a pantalla de inicio**. Confirmar que el icono es el
   nuestro y no un screenshot.
3. Abrir la app desde el icono: **sin barra de Safari**, y el icono de la app se
   ve en el status bar con el color del tema.
4. **Desactivar los datos moviles** y abrir la app: tiene que cargar y jugar.
5. Sacudir/ir a Ajustes -> Safari -> Borrar historial y datos: la app sigue
   instalada y arranca en el menu.

**Evidencia a citar en el cierre:** la salida cruda del e2e (online, offline, raiz
y subpath) con el conteo de checks, y la captura de pantalla de la app instalada
en el iPhone.
