# AUDIT - kanam-sudoku-iphone

**Fecha:** 2026-10-28
**Auditor:** Kanam (CORE) - medición directa contra el repo, no lectura de README
**Sync con GitHub:** SYNC (`gonzoblasco/kanam-sudoku-iphone`)

---

## 1. Veredicto

**Cumple, y es el proyecto mejor gobernado del conjunto.** 91 tests verdes, build verde con service worker generado (versión `29b8addd`), **dos workflows de CI** (`ci.yml` + `deploy.yml`), y el `.knowledge/` más completo: DISCOVERY, BRIEF, STATUS, KNOWLEDGE, SESSIONS, handoff-history y specs.

Último commit 2026-10-27 (ayer). Está vivo y mantenido.

---

## 2. Estado técnico medido

| Dimensión | Dato real |
|---|---|
| Tests | **91 passed, 0 fail** (`node --test`, 1.46s) |
| Build | **Verde** - 26.81 kB (8.75 kB gzip) + `postbuild` genera `sw.js` |
| CI | **`ci.yml` + `deploy.yml`** - el único con ambos |
| Último commit | 2026-10-27 |
| Peso en disco | 46M (reconstruible: 44M `node_modules`) |

---

## 3. Promesas vs realidad

| Promesa | Fuente | Realidad medida |
|---|---|---|
| "zero runtime dependencies" | README | **Cierto.** El bundle es 26.81 kB y no hay deps de runtime; `node_modules` son devDependencies. |
| "Puzzles generated on the device, every one with a unique solution" | README | Soportado por el engine testeado (91 tests). |
| "Install it to the home screen, play offline" | README | El `postbuild` genera `sw.js` versionado: el soporte offline existe y se regenera en cada build. |
| "No accounts. No backend. No telemetry. No ads." | README | Coherente: build estático, sin llamadas salientes. |

**Delta principal:** ninguno. Es el proyecto donde el README y el repo coinciden sin fisuras.

---

## 4. Deuda

- **`node_modules` de 44M** para un proyecto sin deps de runtime: son solo herramientas de build. Limpiable.
- Nada más detectado: CI completo, docs completos, 0 TODO/FIXME.

---

## 5. Qué haría falta para cerrarlo

Nada urgente. Está en el mejor estado del conjunto. Si se quiere pulir:

1. Verificar que `ci.yml` corra el e2e de Chromium (las suites existen en `test/`).
2. Limpiar `node_modules` si no se toca por un tiempo.

---

_Auditoría generada el 2026-10-28. 91 tests de corrida real, build real con generación de SW._
