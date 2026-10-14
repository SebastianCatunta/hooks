import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { api, ApiError, type User } from './api';

interface SessionState {
  user: User | null;
  restoring: boolean;
  restoreError: string;
  notice: string;
  restore: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  expired: () => void;
}
const SessionContext = createContext<SessionState | null>(null);
export const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Ocurrió un error. Inténtalo de nuevo.';

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [restoring, setRestoring] = useState(true);
  const [restoreError, setRestoreError] = useState('');
  const [notice, setNotice] = useState('');
  const generation = useRef(0);
  const restore = useCallback(async () => {
    const current = ++generation.current;
    setRestoring(true);
    setRestoreError('');
    try {
      const result = await api.session();
      if (current === generation.current) setUser(result.user);
    } catch (error) {
      if (current === generation.current) {
        setUser(null);
        if (!(error instanceof ApiError && error.status === 401)) setRestoreError(errorMessage(error));
      }
    } finally {
      if (current === generation.current) setRestoring(false);
    }
  }, []);
  useEffect(() => { void restore(); return () => { generation.current++; }; }, [restore]);
  const login = async (email: string, password: string) => {
    const result = await api.login(email, password);
    setUser(result.user);
    setNotice('Has iniciado sesión correctamente.');
  };
  const logout = async () => {
    await api.logout();
    setUser(null);
    setNotice('Has cerrado la sesión de forma segura.');
  };
  const expired = useCallback(() => {
    setUser(null);
    setNotice('Tu sesión ha caducado. Inicia sesión de nuevo.');
  }, []);
  return <SessionContext.Provider value={{ user, restoring, restoreError, notice, restore, login, logout, expired }}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error('SessionProvider requerido');
  return value;
}
