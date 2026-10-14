# Proyecto login: ejecución local

## Perfil y control previo al push

La vista autenticada ofrece **Mi perfil** (nombre y correo de la sesión, solo lectura), regreso al inicio y cierre de sesión. No se exponen contraseñas ni se añade una API nueva.

Las cinco pruebas de `frontend/src/test/Profile.test.tsx` comprueban acceso, datos, regreso, cierre de sesión y privacidad. Se verificó que el hook rechazaba el correo incorrecto de una prueba temporal; la expectativa ya está corregida.

Git usa `.githooks/pre-push` mediante `core.hooksPath`. Este conserva las pruebas de `proyecto-demo` y llama a `proyecto-login/pre-push`, que ejecuta `typecheck`, **las cinco pruebas del perfil**, la suite completa del frontend, compilación y pruebas del backend. Cualquier fallo impide el push. Las dependencias deben instalarse con `npm ci` en cada carpeta. Si se clona el repositorio en otra máquina, activar los hooks con `git config core.hooksPath .githooks`. GitHub Actions ejecuta las cinco pruebas de perfil independientemente del hook local mediante `.github/workflows/proyecto-login.yml`.

Aplicación de inicio de sesión en español con React 19, Vite 7, TypeScript 5, Express 5 y PostgreSQL 16. Incluye login, restauración de sesión, recurso protegido y logout; **no hay registro público**, recuperación de contraseña ni roles. El contrato técnico está en `docs/login-contract.md`.

## Requisitos y estructura

- Recomendado: **Node.js 24.14.0 y npm 11.9.0**, versiones verificadas en este entorno. El backend declara Node `>=22.12.0`; ese mínimo no sustituye la combinación comprobada para todo el proyecto y Vitest 5.0.4.
- Docker con Docker Compose v2 (verificado: v2.35.1-desktop.1). En Windows, iniciar Docker Desktop con contenedores Linux.
- Terminal PowerShell o Bash; navegador para la comprobación manual. Puertos libres: 3000, 5173 y 5432.

```text
frontend/     React, componentes, cliente HTTP y pruebas UI; package.json y package-lock.json propios
backend/      Express, API, repositorio pg, scripts/, migrations/, compose.yaml y lockfile propio
docs/         contrato compartido de autenticación
.opencode/    agentes, comando y skill de desarrollo (no necesarios para ejecutar la aplicación)
```

Frontend y backend se ejecutan en el host; Compose arranca solo PostgreSQL (`postgres:16-alpine`). La BD guarda usuarios con contraseña bcrypt (coste 12) y sesiones con hash SHA-256 del token, nunca el token crudo. El volumen nombrado `login_pgdata` conserva los datos entre reinicios; Compose puede anteponer el nombre del proyecto al volumen.

## 1. Instalar desde una copia limpia

Ejecutar desde la raíz `proyecto-login`. No hay instalación npm en la raíz. Usar **npm ci** en cada carpeta: ambos lockfiles existen y deben conservarse. `npm install` queda para cambios deliberados de dependencias; si `npm ci` señala un desacuerdo entre manifiesto y lockfile, revisar la copia en vez de borrar el lockfile.

PowerShell (si fuera necesario, entrar primero con `Set-Location "C:\Users\DELL\Desktop\CERTIFICACION-II\otros-trabajos\proyecto-login"`):

```powershell
Set-Location backend
npm ci
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
Set-Location ../frontend
npm ci
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
Set-Location ..
```

Bash, desde la raíz:

```bash
(cd backend && npm ci && { test -f .env || cp .env.example .env; })
(cd frontend && npm ci && { test -f .env || cp .env.example .env; })
```

Comprobar el éxito de cada instalación antes de continuar. Las copias anteriores no sobrescriben un `.env` existente. No publicar ni versionar archivos `.env` con credenciales propias. Los valores siguientes son **exclusivamente de demostración local**, no secretos de producción.

## 2. Variables de entorno

| Archivo | Variable | Valor local | Función |
| --- | --- | --- | --- |
| `backend/.env` | `PORT` | `3000` | Puerto HTTP del backend |
| `backend/.env` | `FRONTEND_ORIGIN` | `http://localhost:5173` | Único origen autorizado para CORS y POST |
| `backend/.env` | `DATABASE_URL` | `postgresql://login:login_local@localhost:5432/login` | Conexión PostgreSQL desde el host |
| `backend/.env` | `NODE_ENV` | `development` | Cookie local sin Secure; `production` exige HTTPS |
| `backend/.env` | `SEED_EMAIL` | `demo@example.com` | Email de la cuenta que crea la semilla |
| `backend/.env` | `SEED_PASSWORD` | `DemoLogin2026!` | Contraseña de prueba obligatoria para la semilla |
| `backend/.env` | `SEED_NAME` | `Usuario Demo` | Nombre de la cuenta local |
| `frontend/.env` | `VITE_API_URL` | `http://localhost:3000` | URL base de API, sin `/api` añadido |

El backend y los scripts cargan `.env` con dotenv desde su directorio de ejecución. Las variables de la terminal prevalecen sobre `.env`. Vite incorpora sus variables en el cliente: **ninguna variable `VITE_*` debe contener secretos**. Reiniciar los procesos tras cambiar el entorno; reconstruir el frontend si se usa un build.

Compose define directamente `POSTGRES_DB=login`, `POSTGRES_USER=login`, `POSTGRES_PASSWORD=login_local` y publica `127.0.0.1:5432:5432`; no los toma de `DATABASE_URL` ni de las variables de semilla. Cambiar solo la URL no cambia las credenciales de la BD.

## 3. Arrancar la BD, migrar y crear cuenta

En PowerShell usar `Set-Location backend` desde la raíz; en Bash, `cd backend`. Todos los comandos de esta sección se ejecutan **en `backend/`** y son comunes a ambas terminales:

```text
docker compose up -d
docker compose ps
```

Esperar a que `db` figure como `healthy` antes de continuar. Si es necesario, repetir `docker compose ps` y consultar `docker compose logs db`.

```text
npm run db:migrate
npm run db:seed
```

Las migraciones SQL se ejecutan en transacción, con bloqueo y registro de checksum en `schema_migrations`. Repetir `db:migrate` verifica las ya aplicadas. La semilla es idempotente por email: repetirla **conserva el usuario existente, su nombre y su contraseña**, no los actualiza. Se esperan los mensajes `Migraciones verificadas` y `Cuenta local creada` o `Cuenta existente conservada`.

La contraseña ya viene en el `.env.example` local. También se puede suministrar temporalmente desde la terminal, sin editar el archivo:

```powershell
# Desde backend/: prevalece sobre .env; solo para la cuenta nueva.
$env:SEED_PASSWORD = 'DemoLogin2026!'
npm run db:seed
Remove-Item Env:SEED_PASSWORD
```

```bash
# Desde backend/: variable limitada a este comando.
SEED_PASSWORD='DemoLogin2026!' npm run db:seed
```

Para probar otra contraseña sin alterar cuentas existentes, configurar un `SEED_EMAIL` nuevo y la contraseña deseada antes de sembrar. No se ofrece un comando de restablecimiento de contraseña. No usar estas credenciales fuera del entorno local.

## 4. Backend y frontend en dos terminales

Abrir ambas terminales en la raíz del proyecto. Mantenerlas abiertas mientras se prueba la aplicación.

| Terminal | Directorio | PowerShell | Bash | Resultado |
| --- | --- | --- | --- | --- |
| 1 | `backend/` | `Set-Location backend`, después `npm run dev` | `cd backend`, después `npm run dev` | API en `http://localhost:3000` |
| 2 | `frontend/` | `Set-Location frontend`, después `npm run dev` | `cd frontend`, después `npm run dev` | UI en `http://localhost:5173` |

No iniciar dos instancias en el mismo puerto. El frontend usa `--host localhost --port 5173 --strictPort`: falla si el puerto está ocupado, no elige otro silenciosamente.

Abrir **http://localhost:5173**. La comprobación HTTP del backend es **http://localhost:3000/api/health**; devuelve `{"status":"ok"}`. Este endpoint comprueba HTTP, **no consulta PostgreSQL**: un 200 no garantiza que la BD esté disponible.

Comprobación opcional con el backend ya iniciado:

```powershell
Invoke-RestMethod -Uri 'http://localhost:3000/api/health'
```

```bash
curl http://localhost:3000/api/health
```

## 5. Probar login, sesión y logout

1. Abrir la UI. Sin cookie vigente debe aparecer el formulario tras la comprobación inicial de sesión.
2. Probar una contraseña incorrecta: debe mostrarse el error genérico `Correo o contraseña incorrectos`. No realizar intentos masivos: el login limita a 10 solicitudes por IP en 15 minutos y devuelve 429 al excederlo.
3. Entrar con **demo@example.com / DemoLogin2026!** (nombre **Usuario Demo**), siempre que la semilla no haya conservado una cuenta anterior con otra contraseña.
4. Verificar la vista autenticada y recargar la página: debe restaurarse la sesión. En las herramientas de red del navegador, `GET /api/auth/session` devuelve 200 con el usuario público; `GET /api/protected` requiere la misma cookie y devuelve `Acceso autorizado`.
5. Cerrar sesión desde la UI: `POST /api/auth/logout` devuelve 204, borra cookie y registro de sesión. Al recargar vuelve el formulario; consultar sesión o recurso protegido sin sesión devuelve 401. Logout es idempotente.

La cookie `login_session` tiene `HttpOnly`, `SameSite=Lax`, `Path=/`, sin `Domain`, y `Max-Age=28800` (8 horas). La expiración es absoluta, no se prolonga por actividad. `Secure` se habilita en producción. No se almacena la sesión en localStorage y JavaScript no puede leer la cookie HttpOnly. Reiniciar el backend no revoca por sí solo las sesiones persistidas; siguen vigentes si cookie, BD y plazo se conservan.

El cliente usa `fetch` con `credentials: "include"`. CORS autoriza únicamente `FRONTEND_ORIGIN`, con credenciales y sin comodín. **Todo POST**, incluido logout, exige `Origin: http://localhost:5173` y `Content-Type: application/json`; logout envía `{}`. Origin ausente/incorrecto o contenido no JSON produce 403. Estos controles y SameSite mitigan CSRF; CORS no sustituye la autenticación. Herramientas HTTP que no envían Origin por defecto deben añadirlo para probar POST. No confundir `localhost` con `127.0.0.1`: usar el mismo hostname en ambas URLs.

## 6. Scripts y verificaciones

Ejecutar cada script desde la carpeta indicada:

| Carpeta | Comando | Alcance |
| --- | --- | --- |
| backend | `npm run dev` | TS en modo watch con tsx |
| backend | `npm run build` | Compila a `dist/` con TypeScript |
| backend | `npm start` | Ejecuta `dist/server.js`; requiere build previo y BD preparada |
| backend | `npm test` | Vitest: `tests/app.test.ts`, repositorio sustituido |
| backend | `npm run db:migrate` | Aplica/verifica migraciones en la BD configurada |
| backend | `npm run db:seed` | Crea cuenta local si no existe |
| backend | `npm run db:test` | Restricciones, semilla, bcrypt, repositorio y sesiones con PostgreSQL real |
| backend | `npm run test:integration` | API con repositorio PostgreSQL real mediante Supertest |
| frontend | `npm run dev` | Vite en localhost:5173 |
| frontend | `npm run typecheck` | TypeScript sin emitir archivos |
| frontend | `npm run build` | Typecheck y build Vite a `dist/` |
| frontend | `npm test` | Vitest y Testing Library; fetch simulado |
| frontend | `npm run preview` | Sirve build previo en localhost:5173; detener dev antes |
| ambos, por separado | `npm audit` | Auditoría de dependencias, requiere acceso al registro |

`db:test` y `test:integration` requieren `DATABASE_URL` y permisos para crear esquemas. Crean esquemas de prueba únicos y los eliminan al finalizar; **no son pruebas de solo lectura**. Usar la BD local dedicada, nunca una BD de producción. No necesitan un backend HTTP permanente. No ejecutar `npm audit fix` indiscriminadamente.

### Evidencia y límites de validación

- **Reportado por el orquestador/especialistas:** PostgreSQL saludable; migraciones y semilla ejecutadas dos veces; backend build, 7 pruebas unitarias, `db:test` y `test:integration` con PostgreSQL real aprobados; frontend build y 7 pruebas aprobados; `npm audit` con cero vulnerabilidades en ambas carpetas.
- **Ejecutado por el documentador:** `node --version` → v24.14.0; `npm --version` → 11.9.0; `docker compose version` → v2.35.1-desktop.1; en backend `docker compose config --quiet` → éxito y `docker compose ps` → `db` saludable, publicado en 127.0.0.1:5432.
- **Contrastado con archivos, no ejecutado de nuevo por el documentador:** instalación, copias de entorno, semilla/migración, comandos dev/build/test, preview/start, paradas y diagnóstico. Se revisaron manifiestos, lockfiles existentes, ejemplos de entorno, Compose, configuración, API y scripts reales. No se arrancaron servicios persistentes ni se repitieron pruebas que escriben en BD durante la documentación.
- **Pendiente manual:** recorrido visual en navegador y comportamiento real UI–API–cookie de extremo a extremo. No hubo herramienta de navegador; las pruebas UI simulan fetch y no demuestran por sí solas CORS/cookies reales. Las pruebas API con PostgreSQL no equivalen a una prueba visual.

## 7. Detener y solucionar problemas

- **Parar aplicación:** `Ctrl+C` en las terminales de backend y frontend.
- **Parar BD sin perder datos:** desde `backend/`, `docker compose stop`. Para retirar contenedores y red conservando el volumen, `docker compose down`. No usar la opción `-v`: elimina la persistencia. No borrar el volumen para resolver un error de login.
- **Puerto ocupado:** cerrar primero la instancia propia anterior. PowerShell: `Get-NetTCPConnection -State Listen -LocalPort 3000,5173,5432` muestra PID en `OwningProcess`; identificarlo con `Get-Process -Id <PID>` antes de decidir detenerlo. No terminar procesos ajenos automáticamente.
- **Cambiar puertos HTTP:** si se cambia `PORT`, actualizar también `VITE_API_URL`. Para cambiar el puerto de UI en una sesión, desde frontend usar `npm run dev -- --port 5174` y establecer `FRONTEND_ORIGIN=http://localhost:5174` en backend; reiniciar ambos. La configuración predeterminada y preview siguen usando 5173.
- **5432 ocupado:** detener la otra BD local si es propia o ajustar deliberadamente el mapeo host de Compose (p. ej. `127.0.0.1:5433:5432`) y `DATABASE_URL` al puerto 5433. El puerto interno PostgreSQL sigue siendo 5432.
- **BD inaccesible:** comprobar Docker Desktop, `docker compose ps`, `docker compose logs db` y URL/puerto/credenciales. Desde el host se usa `localhost`, no el nombre de servicio `db`. Las credenciales iniciales de PostgreSQL solo se aplican al crear el volumen: modificarlas en Compose no altera usuarios de un volumen existente.
- **Tablas ausentes o migración fallida:** ejecutar `npm run db:migrate` desde backend con la URL correcta; comprobar conectividad y permisos. No editar una migración aplicada: el checksum lo detecta y la transacción se revierte. Resolver la discrepancia de versión con el responsable del proyecto, no borrar el historial.
- **Semilla falla o contraseña no sirve:** `SEED_PASSWORD` es obligatoria; comprobar `.env` y variables heredadas de la terminal. Una semilla repetida no cambia una cuenta existente. Crear otro email local si se necesita una nueva credencial, sin borrar usuarios.
- **URL de API / error de red:** revisar `frontend/.env`, reiniciar Vite y verificar `/api/health`. El frontend agrega las rutas `/api/...`; no poner `/api` al final de `VITE_API_URL`.
- **CORS o 403:** comparar el Origin exacto (esquema, hostname y puerto; sin barra final) con `FRONTEND_ORIGIN`; mantener JSON en POST incluso logout. No habilitar un comodín con cookies.
- **Cookie no enviada / 401 tras login:** mantener localhost en ambos servicios, comprobar `credentials: include` y que el navegador permita cookies; usar `NODE_ENV=development` con HTTP local. En producción hace falta HTTPS para Secure. Verificar expiración de 8 horas y que la BD siga disponible. No desactivar HttpOnly/SameSite para solucionar el problema.
- **429:** esperar la ventana de 15 minutos y reducir intentos; el limitador está en memoria del proceso, no en PostgreSQL.
- **PowerShell bloquea npm.ps1:** si la política local lo impide, usar `npm.cmd` en lugar de `npm`, sin cambiar globalmente la política de ejecución.

## Herramientas de desarrollo: orquestación con OpenCode

Este proyecto incluye una skill y cuatro subagentes locales para construir un login full-stack con `frontend/` y `backend/` separados.

## Activar y utilizar

1. Abre una terminal en `proyecto-login/` e inicia OpenCode con `opencode`.
2. Si ya estaba abierto, sal y vuelve a iniciarlo: las skills, agentes y comandos se cargan al arrancar.
3. Ejecuta el comando:

   ```text
   /crear-login
   ```

   Puedes añadir requisitos:

   ```text
   /crear-login Usa React, Express y PostgreSQL. Necesito inicio de sesión y cierre de sesión, sin registro público.
   ```

También puedes pedirlo en lenguaje natural:

> Usa la skill login-orchestrator para crear un login. Delega frontend, backend, base de datos y documentación a sus subagentes. Deja frontend y backend en carpetas separadas.

## Archivos incluidos

```text
.opencode/
├── agents/
│   ├── login-frontend.md
│   ├── login-backend.md
│   ├── login-database.md
│   └── login-docs.md
├── commands/
│   └── crear-login.md
└── skills/
    └── login-orchestrator/
        └── SKILL.md
```

OpenCode descubre estos archivos a nivel de proyecto sin requerir una configuración global ni un modelo específico. Los subagentes usan el modelo configurado en tu sesión y necesitan permisos para las herramientas de implementación correspondientes.

## Cómo se coordina el trabajo

El orquestador revisa el proyecto y escribe un contrato compartido en `docs/login-contract.md`. Coordina el esqueleto de backend, ejecuta base de datos y frontend en paralelo, integra la API y encarga la guía local al documentador cuando los comandos estén definidos. Evita escrituras simultáneas sobre los mismos archivos.

Si no indicas tecnologías y el proyecto está vacío, propone React/Vite/TypeScript, Express/TypeScript, SQLite y sesiones persistidas con cookie HttpOnly. Puedes pedir otras tecnologías en el comando.

La aplicación actual usa PostgreSQL 16 (no la alternativa SQLite propuesta por defecto por la skill). La guía anterior documenta los comandos y requisitos reales; OpenCode es opcional para ejecutarlos.
