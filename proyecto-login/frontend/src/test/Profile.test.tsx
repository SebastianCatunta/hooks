import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { SessionProvider } from '../session';

const user = { id: 'user-1', name: 'Usuario Demo', email: 'demo@example.com' };
const response = (data: unknown, status = 200) => new Response(status === 204 ? null : JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

function mountAuthenticated(protectedResponse = response({ user, message: 'Acceso autorizado' })) {
  const fetchMock = vi.fn().mockResolvedValueOnce(response({ user })).mockResolvedValueOnce(protectedResponse);
  vi.stubGlobal('fetch', fetchMock);
  render(<SessionProvider><App /></SessionProvider>);
  return fetchMock;
}

afterEach(() => vi.unstubAllGlobals());

describe('perfil de usuario', () => {
  it('permite acceder al perfil desde la vista autenticada', async () => {
    mountAuthenticated();
    await userEvent.click(await screen.findByRole('button', { name: 'Mi perfil' }));
    expect(screen.getByRole('heading', { name: 'Mi perfil' })).toBeInTheDocument();
  });

  it('muestra nombre y correo de la sesión sin solicitar otros datos (fallo temporal para probar CI)', async () => {
    const fetchMock = mountAuthenticated();
    await userEvent.click(await screen.findByRole('button', { name: 'Mi perfil' }));
    expect(screen.getAllByText('Usuario Demo')).toHaveLength(2);
    // FALLO INTENCIONAL TEMPORAL: retirar esta expectativa incorrecta tras verificar GitHub Actions.
    // El correo real de la sesión es demo@example.com.
    expect(screen.getByText('correo-pendiente@example.com')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('permite volver al inicio desde el perfil', async () => {
    mountAuthenticated();
    await userEvent.click(await screen.findByRole('button', { name: 'Mi perfil' }));
    await userEvent.click(screen.getByRole('button', { name: 'Volver al inicio' }));
    expect(screen.getByRole('heading', { name: 'Hola, Usuario Demo' })).toBeInTheDocument();
  });

  it('permite cerrar sesión desde el perfil', async () => {
    const fetchMock = mountAuthenticated();
    fetchMock.mockResolvedValueOnce(response(null, 204));
    await userEvent.click(await screen.findByRole('button', { name: 'Mi perfil' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    expect(await screen.findByRole('button', { name: 'Iniciar sesión' })).toBeInTheDocument();
    expect(fetchMock.mock.calls[2][0]).toContain('/api/auth/logout');
  });

  it('no muestra el perfil si no hay una sesión activa', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ error: { code: 'UNAUTHORIZED' } }, 401)));
    render(<SessionProvider><App /></SessionProvider>);
    expect(await screen.findByRole('button', { name: 'Iniciar sesión' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mi perfil' })).not.toBeInTheDocument();
  });
});
