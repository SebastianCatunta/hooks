import { useRef, useState, type FormEvent } from 'react';
import { errorMessage, useSession } from '../session';

export function LoginForm() {
  const { login } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const locked = useRef(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locked.current) return;
    if (!email.trim() || !password || password.length > 128) {
      setError('Introduce un correo válido y una contraseña de entre 1 y 128 caracteres.');
      return;
    }
    locked.current = true;
    setBusy(true);
    setError('');
    try { await login(email, password); setPassword(''); }
    catch (error) { setError(errorMessage(error)); }
    finally { locked.current = false; setBusy(false); }
  }
  return <section aria-labelledby="login-title">
    <p className="eyebrow">TU ESPACIO PERSONAL</p>
    <h1 id="login-title">Te damos la bienvenida</h1>
    <p className="muted intro">Inicia sesión para acceder a tu cuenta.</p>
    <form onSubmit={submit} aria-busy={busy}>
      <fieldset disabled={busy}>
        <label htmlFor="email">Correo electrónico</label>
        <input id="email" name="email" type="email" autoComplete="username" required maxLength={254} placeholder="nombre@ejemplo.com" value={email} onChange={e => setEmail(e.target.value)} />
        <label htmlFor="password">Contraseña</label>
        <div className="password-field">
          <input id="password" name="password" type={visible ? 'text' : 'password'} autoComplete="current-password" required maxLength={128} value={password} onChange={e => setPassword(e.target.value)} aria-describedby="password-help" />
          <button type="button" className="reveal" aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'} aria-pressed={visible} onClick={() => setVisible(!visible)}>{visible ? 'Ocultar' : 'Mostrar'}</button>
        </div>
        <p id="password-help" className="hint">Utiliza la contraseña de tu cuenta.</p>
        {error && <p role="alert" className="error">{error}</p>}
        <button className="primary" type="submit">{busy ? 'Iniciando sesión…' : 'Iniciar sesión'}<span aria-hidden="true">→</span></button>
      </fieldset>
      {busy && <p role="status" className="hint">Verificando tus credenciales…</p>}
    </form>
    <p className="security-note"><span aria-hidden="true">◇</span> Tu sesión está protegida. Nunca compartas tu contraseña.</p>
  </section>;
}
