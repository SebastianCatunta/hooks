import request from 'supertest';
import bcrypt from 'bcryptjs';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp, hashToken, type AuthRepository } from '../src/app.js';
import type { Session, User } from '../src/db/repository.js';
import { config } from '../src/config.js';

const origin = 'http://localhost:5173';
let user: User;
beforeAll(async () => {
  user = { id: 'test-id', email: 'demo@example.com', name: 'Demo', createdAt: new Date(),
    passwordHash: await bcrypt.hash('DemoLogin2026!', 12) };
});
function fixture(limit = 10) {
  const sessions = new Map<string, Session>();
  const repo: AuthRepository = {
    findUserByEmail: vi.fn(async (email) => email === user.email ? user : null),
    createSession: vi.fn(async (tokenHash, userId, expiresAt) => {
      sessions.set(tokenHash, { tokenHash, userId, expiresAt, createdAt: new Date(), user });
    }),
    findSession: vi.fn(async (hash) => sessions.get(hash) ?? null),
    deleteSession: vi.fn(async (hash) => { sessions.delete(hash); }),
  };
  return { app: createApp(repo, { loginLimit: limit }), repo, sessions };
}
const credentials = { email: ' DEMO@example.com ', password: 'DemoLogin2026!' };
const post = (app: ReturnType<typeof createApp>, path: string, body: unknown = {}) =>
  request(app).post(path).set('Origin', origin).send(body);
const cookie = (response: request.Response) => (response.headers['set-cookie'] as unknown as string[]).at(-1)!.split(';')[0];

describe('authentication API', () => {
  it('health, login, session, protected, rotation and effective idempotent logout', async () => {
    const { app, sessions } = fixture();
    expect((await request(app).get('/api/health')).body).toEqual({ status: 'ok' });
    expect((await request(app).get('/api/protected')).status).toBe(401);
    const login = await post(app, '/api/auth/login', credentials);
    expect(login.status).toBe(200);
    expect(Object.keys(login.body.user).sort()).toEqual(['email', 'id', 'name']);
    const first = cookie(login);
    expect(login.headers['set-cookie'].at(-1)).toContain('HttpOnly');
    expect(login.headers['set-cookie'].at(-1)).toContain('SameSite=Lax');
    expect(login.headers['set-cookie'].at(-1)).toContain('Max-Age=28800');
    expect(sessions.has(hashToken(first.split('=')[1]))).toBe(true);
    expect((await request(app).get('/api/auth/session').set('Cookie', first)).status).toBe(200);
    expect((await request(app).get('/api/protected').set('Cookie', first)).body.message).toBe('Acceso autorizado');
    const rotated = await post(app, '/api/auth/login', credentials).set('Cookie', first);
    expect((await request(app).get('/api/auth/session').set('Cookie', first)).status).toBe(401);
    const second = cookie(rotated);
    expect((await post(app, '/api/auth/logout').set('Cookie', second)).status).toBe(204);
    expect((await request(app).get('/api/auth/session').set('Cookie', second)).status).toBe(401);
    expect((await post(app, '/api/auth/logout').set('Cookie', second)).status).toBe(204);
  });

  it('uses identical errors for unknown accounts and incorrect passwords', async () => {
    const { app } = fixture();
    const wrong = await post(app, '/api/auth/login', { ...credentials, password: 'wrong' });
    const absent = await post(app, '/api/auth/login', { ...credentials, email: 'absent@example.com' });
    expect(wrong.status).toBe(401);
    expect(absent.status).toBe(401);
    expect(wrong.body).toEqual(absent.body);
    expect(wrong.body.error.message).toBe('Correo o contraseña incorrectos');
  });

  it('validates fields, JSON and body size', async () => {
    const { app } = fixture();
    for (const body of [{}, { email: 'bad', password: 'x' }, { ...credentials, password: '' },
      { ...credentials, password: 'x'.repeat(129) }, { ...credentials, email: 'x'.repeat(255) }]) {
      expect((await post(app, '/api/auth/login', body)).status).toBe(400);
    }
    for (const body of ['{', JSON.stringify({ extra: 'x'.repeat(17000) })]) {
      const response = await request(app).post('/api/auth/login').set('Origin', origin)
        .set('Content-Type', 'application/json').send(body);
      expect(response.status).toBe(400);
    }
  });

  it('enforces CSRF, handles preflight and restricts CORS', async () => {
    const { app } = fixture();
    for (const path of ['/api/auth/login', '/api/auth/logout']) {
      expect((await request(app).post(path).send({})).status).toBe(403);
      expect((await request(app).post(path).set('Origin', 'https://evil.example').send({})).status).toBe(403);
      expect((await request(app).post(path).set('Origin', origin).type('text').send('{}')).status).toBe(403);
    }
    const preflight = await request(app).options('/api/auth/login').set('Origin', origin)
      .set('Access-Control-Request-Method', 'POST');
    expect(preflight.status).toBe(204);
    expect(preflight.headers['access-control-allow-origin']).toBe(origin);
    expect(preflight.headers['access-control-allow-credentials']).toBe('true');
    const foreign = await request(app).get('/api/health').set('Origin', 'https://evil.example');
    expect(foreign.headers['access-control-allow-origin']).not.toBe('https://evil.example');
  });

  it('limits login attempts and hides internal failures', async () => {
    const { app, repo } = fixture(1);
    vi.mocked(repo.findUserByEmail).mockRejectedValueOnce(new Error('sensitive database details'));
    const failed = await post(app, '/api/auth/login', credentials);
    expect(failed.status).toBe(500);
    expect(failed.body).toEqual({ error: { code: 'INTERNAL_ERROR', message: 'Error interno del servidor' } });
    expect((await post(app, '/api/auth/login', credentials)).body.error.code).toBe('TOO_MANY_REQUESTS');
  });

  it('rejects expired, malformed and duplicate session tokens', async () => {
    const { app, sessions } = fixture();
    const login = await post(app, '/api/auth/login', credentials);
    const value = cookie(login);
    sessions.get(hashToken(value.split('=')[1]))!.expiresAt = new Date(0);
    for (const header of [value, 'login_session=invalid', `${value}; ${value}`]) {
      expect((await request(app).get('/api/auth/session').set('Cookie', header)).status).toBe(401);
    }
  });

  it('preserves password whitespace and uses Secure cookies in production', async () => {
    const previous = config.NODE_ENV;
    config.NODE_ENV = 'production';
    try {
      const { app } = fixture();
      expect((await post(app, '/api/auth/login', { ...credentials, password: ` ${credentials.password} ` })).status).toBe(401);
      const login = await post(app, '/api/auth/login', credentials);
      const header = login.headers['set-cookie'].at(-1);
      expect(header).toContain('Secure');
      expect(header).not.toContain('Domain=');
      const logout = await post(app, '/api/auth/logout').set('Cookie', cookie(login));
      expect(logout.headers['set-cookie'][0]).toContain('Secure');
      expect(logout.headers['set-cookie'][0]).toContain('HttpOnly');
      expect(logout.headers['set-cookie'][0]).toContain('SameSite=Lax');
    } finally {
      config.NODE_ENV = previous;
    }
  });
});
