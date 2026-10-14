import type { User } from '../api';

export function Profile({ user, onBack }: { user: User; onBack: () => void }) {
  return <div className="profile-view">
    <button type="button" className="profile-back" onClick={onBack}><span aria-hidden="true">← </span>Volver al inicio</button>
    <p className="eyebrow">TU ESPACIO PERSONAL</p>
    <h1 id="dashboard-title">Mi perfil</h1>
    <p className="muted intro">Consulta los datos asociados a tu cuenta.</p>
    <div className="profile-card">
      <div className="profile-heading"><span className="avatar profile-avatar" aria-hidden="true">{user.name.slice(0, 1).toUpperCase()}</span><div><strong>{user.name}</strong><p className="muted">Cuenta personal</p></div></div>
      <dl className="profile-details"><div><dt>Nombre</dt><dd>{user.name}</dd></div><div><dt>Correo electrónico</dt><dd>{user.email}</dd></div></dl>
    </div>
    <p className="muted profile-note">Tus datos se muestran desde tu sesión activa. Para modificarlos, contacta al administrador.</p>
  </div>;
}
