import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { SessionProvider } from '../session';

const user = { id: 'user-1', email: 'demo@example.com', name: 'Usuario Demo' };
const ok = (data: unknown, status = 200) => new Response(status === 204 ? null : JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
const unauthorized = () => ok({ error: { code: 'UNAUTHORIZED', message: 'Sin sesión' } }, 401);
function mount() { render(<SessionProvider><App /></SessionProvider>); }
afterEach(() => vi.unstubAllGlobals());

describe('sesión y acceso', () => {
  it('muestra carga inicial y restaura una sesión con acceso protegido', async () => {
    let resolve!: (value: Response) => void;
    const fetchMock = vi.fn().mockImplementationOnce(() => new Promise<Response>(done => { resolve = done; }))
      .mockResolvedValueOnce(ok({ message: 'Acceso autorizado', user }));
    vi.stubGlobal('fetch', fetchMock);
    mount();
    expect(screen.getByText('Comprobando tu sesión…')).toBeInTheDocument();
    await act(async () => resolve(ok({ user })));
    expect(await screen.findByRole('heading', { name: 'Hola, Usuario Demo' })).toBeInTheDocument();
    expect(await screen.findByText('✓ Acceso autorizado')).toBeInTheDocument();
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'GET', credentials: 'include' });
    expect(fetchMock.mock.calls[1][0]).toContain('/api/protected');
  });

  it('normaliza correo, conserva contraseña, bloquea duplicados y completa login/logout', async () => {
    const interaction = userEvent.setup();
    let resolveLogin!: (value: Response) => void;
    const fetchMock = vi.fn().mockResolvedValueOnce(unauthorized())
      .mockImplementationOnce(() => new Promise<Response>(done => { resolveLogin = done; }))
      .mockResolvedValueOnce(ok({ message: 'Acceso autorizado', user }))
      .mockResolvedValueOnce(ok(null, 204));
    vi.stubGlobal('fetch', fetchMock);
    mount();
    await screen.findByRole('button', { name: 'Iniciar sesión' });
    await interaction.type(screen.getByLabelText('Correo electrónico'), 'DEMO@example.com');
    await interaction.type(screen.getByLabelText('Contraseña', { exact: true }), ' Pass123! ');
    await interaction.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
    expect(screen.getByRole('button', { name: 'Iniciando sesión…' })).toBeDisabled();
    await interaction.click(screen.getByRole('button', { name: 'Iniciando sesión…' }));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'demo@example.com', password: ' Pass123! ' }) });
    await act(async () => resolveLogin(ok({ user })));
    await screen.findByText('✓ Acceso autorizado');
    await interaction.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    expect(await screen.findByRole('button', { name: 'Iniciar sesión' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Has cerrado la sesión de forma segura.');
    expect(fetchMock.mock.calls[3][0]).toContain('/api/auth/logout');
    expect(fetchMock.mock.calls[3][1]).toMatchObject({ body: '{}', credentials: 'include', headers: { 'Content-Type': 'application/json' } });
  });

  it('presenta error genérico de credenciales y permite volver a intentarlo', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(unauthorized()).mockResolvedValueOnce(ok({ error: { code: 'INVALID_CREDENTIALS', message: 'Correo o contraseña incorrectos' } }, 401));
    vi.stubGlobal('fetch', fetchMock);
    mount();
    const interaction = userEvent.setup();
    await screen.findByLabelText('Correo electrónico');
    await interaction.type(screen.getByLabelText('Correo electrónico'), 'demo@example.com');
    await interaction.type(screen.getByLabelText('Contraseña', { exact: true }), 'incorrecta');
    await interaction.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Correo o contraseña incorrectos');
    expect(screen.getByRole('button', { name: 'Iniciar sesión' })).toBeEnabled();
  });

  it('no envía un formulario vacío y permite mostrar la contraseña con teclado', async () => {
    const fetchMock = vi.fn().mockResolvedValue(unauthorized());
    vi.stubGlobal('fetch', fetchMock);
    mount();
    const interaction = userEvent.setup();
    await screen.findByLabelText('Correo electrónico');
    await interaction.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    screen.getByRole('button', { name: 'Mostrar contraseña' }).focus();
    await interaction.keyboard('{Enter}');
    expect(screen.getByLabelText('Contraseña', { exact: true })).toHaveAttribute('type', 'text');
  });

  it('permite reintentar una restauración fallida sin mostrar el formulario prematuramente', async () => {
    const fetchMock = vi.fn().mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValueOnce(unauthorized());
    vi.stubGlobal('fetch', fetchMock);
    mount();
    const retry = await screen.findByRole('button', { name: 'Reintentar conexión' });
    expect(screen.queryByLabelText('Correo electrónico')).not.toBeInTheDocument();
    await userEvent.click(retry);
    expect(await screen.findByLabelText('Correo electrónico')).toBeInTheDocument();
  });

  it('vuelve al login cuando el recurso protegido indica sesión caducada', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(ok({ user })).mockResolvedValueOnce(unauthorized()));
    mount();
    expect(await screen.findByRole('button', { name: 'Iniciar sesión' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Tu sesión ha caducado');
  });

  it('mantiene la sesión visible si logout falla y permite reintentarlo', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(ok({ user }))
      .mockResolvedValueOnce(ok({ message: 'Acceso autorizado', user }))
      .mockRejectedValueOnce(new TypeError('offline'))
      .mockResolvedValueOnce(ok(null, 204));
    vi.stubGlobal('fetch', fetchMock);
    mount();
    await screen.findByText('✓ Acceso autorizado');
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos conectar');
    expect(screen.getByRole('heading', { name: 'Hola, Usuario Demo' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    await waitFor(() => expect(screen.getByLabelText('Correo electrónico')).toBeInTheDocument());
  });
});
