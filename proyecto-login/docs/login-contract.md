# Contrato de login

## Stack y estructura
- Node.js 22.12+ (entorno actual 24), npm, TypeScript 5, React 19, Vite 7, Express 5, PostgreSQL 16 mediante Docker Compose; driver `pg`, hash `bcryptjs`, validación `zod`, pruebas `vitest` y `supertest`.
- `frontend/` independiente en http://localhost:5173; `backend/` en http://localhost:3000; PostgreSQL localhost:5432. Cada componente tiene package.json y lockfile propios.
- Persistencia, migraciones SQL, semilla y compose en backend/. README existente debe conservar su información útil sobre OpenCode.

## Usuario y persistencia
- users: id UUID, email único normalizado trim/lowercase, name, password_hash, created_at. Público: {id,email,name} únicamente.
- bcrypt coste 12. Semilla local idempotente por email: demo@example.com / DemoLogin2026! / Usuario Demo. Variables permiten reemplazar credenciales; nunca imprimir contraseña ni hash en logs.
- sessions: token_hash SHA-256 como clave, user_id FK cascade, expires_at, created_at. Token aleatorio de 32 bytes; nunca almacenar token crudo. Expiración absoluta 8 horas.
- Interfaz compartida backend/src/db/repository.ts: findUserByEmail(email), findUserById(id), createSession(tokenHash,userId,expiresAt), findSession(tokenHash) (sesión vigente con usuario público), deleteSession(tokenHash). Exportar tipos explícitos. backend/src/db/pool.ts exporta pool y cierre de conexiones. DB especialista informa firmas exactas antes de integración.

## API
- GET /api/health: 200 {status:"ok"}; puede comprobar BD con 503 si no disponible.
- POST /api/auth/login: JSON {email,password}; validar email, password no vacía <=128, email <=254. 200 {user:{id,email,name}} y cookie. 400 VALIDATION_ERROR; 401 INVALID_CREDENTIALS mensaje genérico «Correo o contraseña incorrectos»; 429 TOO_MANY_REQUESTS. Normalizar email, nunca modificar password. Invalidar cookie/sesión previa al éxito.
- GET /api/auth/session: 200 {user}; 401 UNAUTHORIZED sin sesión o expirada.
- POST /api/auth/logout: 204 sin cuerpo; idempotente, borrar registro y cookie.
- GET /api/protected: 200 {message:"Acceso autorizado",user}; 401 UNAUTHORIZED.
- Errores uniformes {error:{code,message}}; errores internos 500 INTERNAL_ERROR sin detalles sensibles. JSON inválido 400. Límite cuerpo 16kb y limitación de intentos login.

## Cookie, CORS y CSRF
- Cookie login_session, HttpOnly, SameSite=Lax, Path=/, Max-Age 28800; Secure en producción, sin Domain. Logout usa mismos atributos.
- Cliente fetch credentials:"include". CORS permite solamente FRONTEND_ORIGIN con credentials:true, no comodín.
- POST requiere Origin igual a FRONTEND_ORIGIN y Content-Type application/json (incluido logout con cuerpo {}); Origin ausente/rechazado 403 FORBIDDEN. Esto junto con SameSite protege CSRF; OPTIONS se atiende por CORS. Tests envían Origin válido explícitamente.

## Variables y comandos previstos
- backend/.env.example: PORT=3000, FRONTEND_ORIGIN=http://localhost:5173, DATABASE_URL=postgresql://login:login_local@localhost:5432/login, NODE_ENV=development, SEED_EMAIL=demo@example.com, SEED_PASSWORD=DemoLogin2026!, SEED_NAME=Usuario Demo.
- frontend/.env.example: VITE_API_URL=http://localhost:3000.
- backend/compose.yaml: servicio db postgres:16-alpine, DB login, usuario login, password login_local, volumen persistente y healthcheck.
- Ambos: npm install, npm run build, npm test. Backend: npm run dev, npm start, npm run db:migrate, npm run db:seed; frontend npm run dev (puerto fijo 5173).
- Verificaciones adicionales implementadas: backend `npm run db:test` y `npm run test:integration` con DATABASE_URL configurada; frontend `npm run typecheck`. Vitest 5.0.4; ejecución verificada con Node 24.14.0.
- Arranque BD desde backend: docker compose up -d; migración y semilla usan dotenv y scripts TS via tsx. Migraciones repetibles con tabla schema_migrations, transacciones.

## Aceptación y límites
- Login correcto, error genérico, entradas inválidas, sesión consultable, recurso protegido, logout invalida token incluso reutilizado; hash verificable, ninguna respuesta expone contraseña/hash. Pruebas reales PostgreSQL cuando entorno lo permita; pruebas automatizadas API con repositorio sustituible también recomendadas.
- UI en español con formulario accesible, estados carga/error, restauración de sesión, vista autenticada y logout; no registro ni recuperación ni roles.
- login-backend escribe backend/ salvo src/db/, migrations/, scripts de BD y compose.yaml; crea manifiestos inicialmente. Tras DB puede modificar manifiestos serialmente. login-database escribe esos archivos de persistencia y backend/.env.example y puede ajustar manifiestos solo mientras backend está detenido.
- login-frontend solo frontend/. login-docs README.md y docs/ excepto este contrato. El orquestador mantiene este contrato. No modificar .opencode/.
- Cada informe: archivos, decisiones, firmas/interfaces, comandos ejecutados y resultados, pendientes reales.
