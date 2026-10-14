---
name: login-orchestrator
description: Orquesta subagentes de frontend, backend, base de datos y documentación para crear, completar o integrar un login con autenticación y ejecución local. Usar cuando se pida construir un login full-stack, coordinar estas áreas o implementar inicio de sesión con frontend y backend separados.
compatibility: OpenCode con herramienta task y los cuatro subagentes login-* del proyecto.
---

# Orquestador de login

Actúa como coordinador responsable de entregar un login integrado y verificable. Delega la implementación a los especialistas; conserva el contexto global, resuelve dependencias y verifica sus entregas.

## 1. Entender el proyecto

- Lee las instrucciones del repositorio y revisa archivos, dependencias y configuración existentes antes de decidir tecnologías.
- Mantén `frontend/` y `backend/` separados. La persistencia, migraciones y semillas viven en `backend/`, salvo convención previa. La guía vive en `README.md` y, si hace falta, `docs/`.
- Pregunta únicamente por decisiones que bloqueen el trabajo: stack exigido, tipo de sesión, base de datos o alcance de registro/recuperación. Si el proyecto está vacío y el usuario no expresa preferencias, propón React con Vite y TypeScript, Express con TypeScript, SQLite y sesiones persistidas con cookie HttpOnly; comunica la elección y avanza.
- No incluyas registro público, recuperación de contraseña, OAuth o roles adicionales a menos que sean solicitados. Para probar un login sin registro, acuerda una semilla local reproducible.
- Usa una lista de tareas para reflejar planificación, delegación, integración y verificación.

## 2. Fijar un contrato antes de delegar

Escribe `docs/login-contract.md` con las decisiones necesarias para trabajar de forma independiente:

- Stack, versiones compatibles, estructura, puertos y URLs locales.
- Modelo de usuario y campos públicos; normalización de correo y estrategia de hash.
- Endpoints, métodos, cuerpos, respuestas, códigos de estado y formato de errores. Incluye inicio de sesión, consulta de sesión y cierre de sesión.
- Mecanismo de sesión, expiración, invalidación, cookies, credenciales del cliente, CORS y protección CSRF cuando aplique.
- Variables de entorno por componente y ubicación de los archivos de ejemplo.
- Comandos previstos para instalar, migrar, sembrar, ejecutar y verificar.
- Criterios de aceptación y límites de escritura de cada especialista.

Adapta el contrato al sistema existente; no impongas una API nueva sobre una ya implementada. El contrato es compartido y lo mantiene el orquestador: los especialistas proponen ajustes, no lo editan simultáneamente.

## 3. Delegar con task

Utiliza estos nombres exactos en `subagent_type`:

| Subagente | Responsabilidad y archivos |
| --- | --- |
| `login-database` | Modelo, migraciones, repositorio de persistencia, semillas y configuración de BD dentro de `backend/`. |
| `login-backend` | API, validación, sesiones, seguridad y pruebas del servidor dentro de `backend/`. |
| `login-frontend` | Interfaz, cliente API, estado de sesión y pruebas de UI dentro de `frontend/`. |
| `login-docs` | Guía de arranque local de frontend, backend y BD en `README.md` y documentación acordada. |

Cada solicitud debe incluir: objetivo concreto, raíz del proyecto, ruta del contrato, decisiones relevantes, archivos permitidos, dependencias disponibles, criterios de aceptación, comandos de verificación y formato del informe. Los subagentes no heredan automáticamente toda tu conversación: transmite el contexto necesario explícitamente.

Secuencia recomendada:

1. Delega a `login-backend` el esqueleto del servidor y sus manifiestos, si todavía no existen. Deja que finalice antes de que base de datos modifique dependencias compartidas.
2. Ejecuta `login-database` y `login-frontend` en paralelo: trabajan en carpetas distintas y ambos conocen el contrato.
3. Al terminar persistencia, envía su informe y su interfaz a `login-backend` para implementar e integrar la autenticación.
4. Revisa frontend y backend juntos y delega correcciones al dueño de cada área. Serializa cambios a manifiestos, lockfiles y otros archivos compartidos; nunca envíes dos agentes a escribir el mismo archivo simultáneamente.
5. Ejecuta `login-docs` cuando los scripts y variables reales estén estabilizados. Proporciónale los informes y resultados de verificación.

Puedes paralelizar backend y frontend después de estabilizar persistencia si sus archivos no se solapan. No uses el subagente genérico como reemplazo de los especialistas salvo que no estén disponibles. Si `task` no reconoce un nombre, comunica el bloqueo y solicita reiniciar OpenCode desde este proyecto para cargar los agentes; no simules una delegación.

## 4. Integrar y comprobar

- Revisa los archivos producidos, además de leer los informes. Comprueba compatibilidad entre consultas, migraciones, API, cookies y cliente.
- Ejecuta los comandos reales de instalación y las verificaciones pertinentes al stack. Registra fallos y delega su corrección antes de cerrar.
- Comprueba login correcto, credenciales incorrectas con mensaje genérico, validación de entrada, consulta de sesión, acceso protegido y logout que invalide la sesión. Verifica que las contraseñas estén hasheadas y nunca se devuelvan ni se registren.
- Prueba desde el frontend cuando haya herramientas de navegador. Si no las hay, comprueba la API y el build del cliente y declara explícitamente que el recorrido visual no se verificó.
- Contrasta los comandos de documentación con los manifiestos y los archivos `.env.example`. No inventes resultados ni marques como ejecutadas pruebas que solo se describieron.

## 5. Entregar

Resume qué implementó cada agente, la estructura final, las verificaciones realizadas y sus resultados. Indica los pasos exactos de arranque o remite a las secciones correspondientes del README. Señala bloqueos reales y tareas pendientes si los hay.
