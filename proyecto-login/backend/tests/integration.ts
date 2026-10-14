import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import request from 'supertest';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL es obligatoria');
const admin = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const schema = `api_test_${randomUUID().replaceAll('-', '')}`;
let closeRepository: (() => Promise<void>) | undefined;
let created = false;
try {
  await admin.query(`CREATE SCHEMA "${schema}"`);
  created = true;
  const url = new URL(process.env.DATABASE_URL);
  url.searchParams.set('options', `-c search_path=${schema}`);
  process.env.DATABASE_URL = url.toString();
  const repo = await import('../src/db/repository.js');
  const { pool, closePool } = await import('../src/db/pool.js');
  closeRepository = closePool;
  const migration = await readFile(new URL('../migrations/001_auth.sql', import.meta.url), 'utf8');
  await pool.query(migration);
  const email = process.env.SEED_EMAIL ?? 'demo@example.com';
  const password = process.env.SEED_PASSWORD ?? 'DemoLogin2026!';
  const passwordHash = await bcrypt.hash(password, 12);
  await pool.query('INSERT INTO users(email,name,password_hash) VALUES($1,$2,$3)',
    [email.trim().toLowerCase(), 'API integration fixture', passwordHash]);
  assert.equal(bcrypt.getRounds((await repo.findUserByEmail(email))!.passwordHash), 12);
  assert.equal(await bcrypt.compare(password, passwordHash), true);
  const { createApp, hashToken } = await import('../src/app.js');
  const app = createApp(repo);
  const origin = process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173';
  const post = (path: string, body: unknown = {}) => request(app).post(path).set('Origin', origin).send(body);
  const get = (path: string, cookie?: string) => {
    const req = request(app).get(path);
    return cookie ? req.set('Cookie', cookie) : req;
  };
  const publicOnly = (body: { user: object }) => assert.deepEqual(Object.keys(body.user).sort(), ['email', 'id', 'name']);
  assert.equal((await get('/api/health')).status, 200);
  assert.equal((await get('/api/protected')).status, 401);
  assert.equal((await get('/api/auth/session')).status, 401);
  assert.equal((await post('/api/auth/login', { email: 'invalid', password })).status, 400);
  const incorrect = await post('/api/auth/login', { email, password: 'incorrect' });
  const unknown = await post('/api/auth/login', { email: 'absent@example.com', password });
  assert.equal(incorrect.status, 401);
  assert.equal(unknown.status, 401);
  assert.deepEqual(incorrect.body, unknown.body);
  assert.equal((await request(app).post('/api/auth/login').send({ email, password })).status, 403);
  assert.equal((await request(app).post('/api/auth/logout').set('Origin', 'https://evil.example').send({})).status, 403);
  assert.equal((await request(app).post('/api/auth/logout').set('Origin', origin).type('text').send('{}')).status, 403);
  const login = await post('/api/auth/login', { email: ` ${email.toUpperCase()} `, password });
  assert.equal(login.status, 200);
  publicOnly(login.body);
  const setCookie = (login.headers['set-cookie'] as unknown as string[]).at(-1)!;
  for (const attribute of ['HttpOnly', 'SameSite=Lax', 'Path=/', 'Max-Age=28800']) assert.ok(setCookie.includes(attribute));
  const cookie = setCookie.split(';')[0];
  const token = cookie.split('=')[1];
  assert.match(token, /^[a-f0-9]{64}$/);
  const session = await repo.findSession(hashToken(token));
  assert.ok(session);
  assert.notEqual(session.tokenHash, token);
  assert.ok(Math.abs(session.expiresAt.getTime() - Date.now() - 28_800_000) < 10_000);
  for (const path of ['/api/auth/session', '/api/protected']) {
    const response = await get(path, cookie);
    assert.equal(response.status, 200);
    publicOnly(response.body);
  }
  const rotated = await post('/api/auth/login', { email, password }).set('Cookie', cookie);
  assert.equal(rotated.status, 200);
  assert.equal((await get('/api/auth/session', cookie)).status, 401);
  assert.equal(await repo.findSession(hashToken(token)), null);
  const current = (rotated.headers['set-cookie'] as unknown as string[]).at(-1)!.split(';')[0];
  const logout = await post('/api/auth/logout').set('Cookie', current);
  assert.equal(logout.status, 204);
  assert.equal(logout.text, '');
  assert.equal(await repo.findSession(hashToken(current.split('=')[1])), null);
  assert.equal((await get('/api/protected', current)).status, 401);
  assert.equal((await get('/api/auth/session', current)).status, 401);
  assert.equal((await post('/api/auth/logout').set('Cookie', current)).status, 204);
  console.info('PASS PostgreSQL API: login, validation, generic errors, sessions, protection, rotation, logout, token/hash, public fields and CSRF');
} finally {
  await closeRepository?.();
  if (created) await admin.query(`DROP SCHEMA "${schema}" CASCADE`);
  await admin.end();
}
