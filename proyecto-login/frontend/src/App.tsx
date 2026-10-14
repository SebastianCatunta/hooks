import { LoginForm } from './components/LoginForm';
import { Dashboard } from './components/Dashboard';
import { useSession } from './session';

export default function App() {
  const { user, restoring, restoreError, restore, notice } = useSession();
  return <div className="shell">
    <aside className="brand-panel" aria-label="Portal de acceso">
      <a className="brand" href="/" aria-label="Portal, inicio"><span className="brand-symbol" aria-hidden="true">p.</span> portal</a>
      <div className="brand-copy"><p className="eyebrow">SIMPLE. PERSONAL. SEGURO.</p><h2>Tu espacio.<br />Siempre contigo.</h2><p>Un solo acceso para volver a lo que importa.</p><div className="decor" aria-hidden="true"><span /><span /><span /></div></div>
      <p className="brand-footer">Un acceso seguro, de principio a fin.</p>
    </aside>
    <main id="main" className="main-panel"><div className="content">
      {notice && <p role="status" className="notice">{notice}</p>}
      {restoring ? <section aria-labelledby="restore-title" aria-busy="true"><p className="eyebrow">UN MOMENTO</p><h1 id="restore-title">Preparando tu espacio</h1><p role="status" className="muted">Comprobando tu sesión…</p></section> : restoreError ? <section><h1>No pudimos comprobar tu sesión</h1><p role="alert" className="error">{restoreError}</p><button className="primary" onClick={() => void restore()}>Reintentar conexión</button></section> : user ? <Dashboard /> : <LoginForm />}
    </div><footer className="main-footer">Portal · Acceso personal</footer></main>
  </div>;
}
