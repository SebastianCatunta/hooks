import express, { type ErrorRequestHandler } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config.js';
import { randomBytes, createHash } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { rateLimit } from 'express-rate-limit';
import type * as repository from './db/repository.js';

export type AuthRepository = Pick<typeof repository,
  'findUserByEmail' | 'createSession' | 'findSession' | 'deleteSession'>;
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
const duration = 8 * 60 * 60 * 1000;
const loginSchema = z.object({
  email: z.string().trim().toLowerCase().max(254).email(),
  password: z.string().min(1).max(128),
});
// Generated once; missing accounts still perform the same expensive bcrypt work.
const dummyHash = bcrypt.hash('dummy-not-an-account-password', 12);

// Inject the agreed repository; tests can replace it without opening a DB pool.
export function createApp(repo: AuthRepository, options: { loginLimit?: number } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({
    origin: (origin, callback) => callback(null, origin === config.FRONTEND_ORIGIN),
    credentials: true,
  }));
  app.use((req, res, next) => {
    if (req.method === 'POST' &&
      (req.get('Origin') !== config.FRONTEND_ORIGIN || !req.is('application/json'))) {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Solicitud no permitida' } });
      return;
    }
    next();
  });
  app.use(express.json({ limit: '16kb' }));

  const cookieOptions = {
    httpOnly: true, sameSite: 'lax' as const, secure: config.NODE_ENV === 'production', path: '/',
  };
  const tokenFrom = (req: express.Request): string | undefined => {
    const cookies = (req.headers.cookie ?? '').split(';').map((value) => value.trim());
    const values = cookies.filter((value) => value.startsWith('login_session='));
    if (values.length !== 1) return undefined;
    const token = values[0].slice('login_session='.length);
    return /^[a-f0-9]{64}$/.test(token) ? token : undefined;
  };
  const publicUser = (user: repository.PublicUser) => ({ id: user.id, email: user.email, name: user.name });
  const requireSession: express.RequestHandler = async (req, res, next) => {
    const token = tokenFrom(req);
    const session = token ? await repo.findSession(hashToken(token)) : null;
    if (!session || session.expiresAt.getTime() <= Date.now()) {
      res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Sesión no válida' } });
      return;
    }
    res.locals.user = publicUser(session.user);
    next();
  };

  app.post('/api/auth/login', rateLimit({
    windowMs: 15 * 60 * 1000, limit: options.loginLimit ?? 10,
    standardHeaders: 'draft-8', legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({ error: { code: 'TOO_MANY_REQUESTS', message: 'Demasiados intentos. Inténtalo más tarde' } });
    },
  }), async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Correo o contraseña no válidos' } });
      return;
    }
    const user = await repo.findUserByEmail(parsed.data.email);
    const valid = await bcrypt.compare(parsed.data.password, user?.passwordHash ?? await dummyHash);
    if (!user || !valid) {
      res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Correo o contraseña incorrectos' } });
      return;
    }
    const previous = tokenFrom(req);
    if (previous) await repo.deleteSession(hashToken(previous));
    res.clearCookie('login_session', cookieOptions);
    const token = randomBytes(32).toString('hex');
    await repo.createSession(hashToken(token), user.id, new Date(Date.now() + duration));
    res.cookie('login_session', token, { ...cookieOptions, maxAge: duration });
    res.json({ user: publicUser(user) });
  });
  app.get('/api/auth/session', requireSession, (_req, res) => {
    res.json({ user: res.locals.user });
  });
  app.get('/api/protected', requireSession, (_req, res) => {
    res.json({ message: 'Acceso autorizado', user: res.locals.user });
  });
  app.post('/api/auth/logout', async (req, res) => {
    const token = tokenFrom(req);
    if (token) await repo.deleteSession(hashToken(token));
    res.clearCookie('login_session', cookieOptions);
    res.status(204).end();
  });

  app.get('/api/health', (_request, response) => {
    response.json({ status: 'ok' });
  });

  app.use((_request, response) => {
    response.status(404).json({ error: { code: 'NOT_FOUND', message: 'Ruta no encontrada' } });
  });

  const errorHandler: ErrorRequestHandler = (error: unknown, _request, response, _next) => {
    const type = typeof error === 'object' && error !== null && 'type' in error
      ? error.type
      : undefined;
    if (type === 'entity.parse.failed' || type === 'entity.too.large') {
      response.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Cuerpo JSON inválido o demasiado grande' },
      });
      return;
    }
    response.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Error interno del servidor' },
    });
  };
  app.use(errorHandler);
  return app;
}
