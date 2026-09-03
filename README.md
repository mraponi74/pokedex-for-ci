[![Deployment Pipeline](https://github.com/mraponi74/pokedex-for-ci/actions/workflows/pipeline.yml/badge.svg)](https://github.com/mraponi74/pokedex-for-ci/actions/workflows/pipeline.yml)

# Pokedex — CI/CD

Pokedex hecha con React que consume la [PokeAPI](https://pokeapi.co/). Proyecto del módulo de CI/CD de Full Stack Open, con un pipeline de GitHub Actions que testea, construye y despliega la app automáticamente en cada push a `main`.

## Comandos locales

Instalar dependencias:

```bash
npm install
```

| Comando | Qué hace |
|---|---|
| `npm run dev` | Levanta el servidor de desarrollo (webpack-dev-server) con hot reload |
| `npm test` | Corre los tests unitarios (Jest) |
| `npm run eslint` | Corre el linter sobre todo el código |
| `npm run build` | Genera el build de producción en `dist/` |
| `npm start` | Levanta el servidor Express sirviendo `dist/` (requiere haber corrido `build` antes) |
| `npm run test:e2e` | Corre los tests end-to-end (Cypress) contra la app ya levantada |

## El pipeline de CI/CD

Cada `push` o Pull Request a `main` dispara `.github/workflows/pipeline.yml`, con estas etapas:

```
avoid_reduncy

lint ──┐
       ├──► test ──┐
build ─┘           ├──► deploy
       e2e ─────────┘
```

### `avoid_reduncy`
Cancela corridas anteriores del mismo pipeline si llega un push nuevo antes de que terminen, para no gastar minutos de CI de más.

### `lint`
Corre ESLint sobre todo el código (`npm run eslint`). Busca errores de sintaxis, malas prácticas y problemas de estilo **sin ejecutar nada** — es la verificación más rápida y barata, por eso corre primero.

### `build`
Compila la app con Webpack (`npm run build`) y sube el resultado (`dist/`) como *artifact* de GitHub Actions, para que los jobs siguientes lo reutilicen sin tener que compilar de nuevo.

### `test`
Corre los tests unitarios con Jest (`npm test`). Testean componentes de React de forma aislada (sin navegador real, sin red), verificando que cada pieza haga lo que tiene que hacer por separado.

### `e2e` (end-to-end)
Levanta la app compilada de verdad (`npm run start-test`) y la testea con Cypress, controlando un navegador real como lo haría una persona: abre la página, hace click, verifica que el contenido aparezca en pantalla. Es más lento que Jest pero detecta problemas que los tests unitarios no ven (rutas rotas, la app no arranca, algo no se renderiza).

### `deploy`
Solo corre en `push` a `main` (no en Pull Requests), y solo si `test` y `e2e` pasaron. Hace tres cosas:
1. Construye la imagen Docker de la app.
2. La publica en GitHub Container Registry (`ghcr.io/mraponi74/pokedex-for-ci`).
3. Se conecta por SSH al VPS y le dice a Docker que baje la imagen nueva y reinicie el contenedor (`docker compose pull && docker compose up -d`).

## Despliegue

La app corre en un VPS propio (Hostinger) dentro de un contenedor Docker, junto a otros servicios (n8n, Traefik, etc.) bajo `~/nervic_cloud/`.

- **Imagen**: se publica en GitHub Container Registry, no en Docker Hub — es gratis e ilimitado para paquetes públicos.
- **Runtime en el VPS**: [`docker-compose.yml`](docker-compose.yml) define cómo correr esa imagen (puerto, reinicio automático, healthcheck). Este archivo vive **directamente en el VPS** (`~/nervic_cloud/pokedex-for-ci/docker-compose.yml`) — el pipeline nunca copia el repo ahí, solo actualiza la imagen.
- **Acceso**: `http://62.72.63.66:8080`
- **Endpoints de control**: `/health` (chequeo de salud) y `/version` (versión desplegada, según `package.json`)

### Secrets necesarios en GitHub (Settings → Secrets and variables → Actions)

| Secret | Para qué |
|---|---|
| `VPS_HOST` | IP del VPS |
| `VPS_USER` | usuario SSH |
| `VPS_SSH_KEY` | clave privada SSH (par dedicado, sin passphrase) |
| `VPS_PORT` | opcional, solo si no es el puerto 22 |

`GITHUB_TOKEN` lo provee Actions automáticamente, no hace falta cargarlo — solo requiere el permiso `packages: write` (ya configurado en el job `deploy`).

## Historial de cambios importantes (Sept 2026)

El pipeline original usaba Heroku y varias versiones deprecadas de herramientas. Se migró y arregló lo siguiente:

- **Runner deprecado**: `ubuntu-18.04` (retirado por GitHub) → `ubuntu-latest`.
- **Actions deprecadas**: `checkout@v2`, `setup-node@v2`, `upload/download-artifact@v2` (dejaron de funcionar) → versiones `v4`/`v6`.
- **Deploy**: de Heroku (de pago desde 2022) a VPS propio vía Docker + GitHub Container Registry.
- **Cypress**: no estaba pineado como dependencia, así que instalaba siempre la última versión — que dejó de ser compatible con Node 14. Se fijó a `9.7.0` (compatible con el formato de configuración `cypress.json` del proyecto) y se subió Node a `18` en todo el pipeline.
- **Webpack 4 + OpenSSL 3**: Node 17+ rompe el hashing de Webpack 4 (`ERR_OSSL_EVP_UNSUPPORTED`). Se agregó `NODE_OPTIONS=--openssl-legacy-provider` al build, tanto en CI como en el `Dockerfile`.
- **Permisos de GHCR**: el `GITHUB_TOKEN` es de solo lectura por defecto; se agregó `permissions: packages: write` al job `deploy`.
- **Ruta de deploy incorrecta**: el script apuntaba a una carpeta del VPS que no existía, y por un `docker image prune -f` como último comando el job igual se mostraba en verde sin haber desplegado nada. Se corrigió la ruta y se agregó `set -e` para que futuros errores se vean de verdad.
- **Puerto 5000 → 8080**: el router doméstico usado para probar bloqueaba el 5000 (confirmado abierto desde afuera con datos móviles y un verificador de puertos externo); se cambió el mapeo de puerto en `docker-compose.yml`.
- Se eliminó `hello.yml`, un workflow de práctica del curso sin función real.
