import { useEffect, useRef, useState } from 'react';
import { api, ApiError, type ProtectedResponse } from '../api';
import { errorMessage, useSession } from '../session';
import { Profile } from './Profile';

export function Dashboard() {
  const { user, logout, expired } = useSession();
  const [resource, setResource] = useState<ProtectedResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [logoutError, setLogoutError] = useState('');
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [showProfile, setShowProfile] = useState(false);
  const locked = useRef(false);
  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    api.protected().then(result => { if (active) setResource(result); }).catch(error => {
      if (!active) return;
      if (error instanceof ApiError && error.status === 401) expired();
      else setError(errorMessage(error));
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [attempt, expired]);
  async function signOut() {
    if (locked.current) return;
    locked.current = true; setBusy(true); setLogoutError('');
    try { await logout(); }
    catch (error) { setLogoutError(errorMessage(error)); }
    finally { locked.current = false; setBusy(false); }
  }
  return <section aria-labelledby="dashboard-title">
    {showProfile && user ? <Profile user={user} onBack={() => setShowProfile(false)} /> : <>
    <p className="eyebrow">SESIÓN ACTIVA</p>
    <h1 id="dashboard-title">Hola, {user?.name}</h1>
    <p className="muted intro">Este es tu espacio privado.</p>
    <div className="account"><span className="avatar" aria-hidden="true">{user?.name.slice(0, 1).toUpperCase()}</span><div><strong>{user?.name}</strong><p>{user?.email}</p></div></div>
    <button type="button" className="profile-link" onClick={() => setShowProfile(true)}>Mi perfil <span aria-hidden="true">→</span></button>
    <div className="resource" aria-busy={loading}>
      <h2>Área protegida</h2>
      {loading ? <p role="status">Comprobando el acceso…</p> : error ? <><p role="alert" className="error">{error}</p><button className="secondary" onClick={() => setAttempt(attempt + 1)}>Reintentar acceso</button></> : <><p className="verified">✓ {resource?.message}</p><p className="muted">El servidor ha verificado tu sesión.</p></>}
    </div>
    </>}
    {logoutError && <p className="error" role="alert">{logoutError}</p>}
    <button className="primary" onClick={signOut} disabled={busy}>{busy ? 'Cerrando sesión…' : 'Cerrar sesión'}<span aria-hidden="true">↗</span></button>
    {busy && <p role="status" className="hint">Cerrando tu sesión en el servidor…</p>}
  </section>;
}
