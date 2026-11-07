import { useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthContext.jsx';

export default function AccountMenu({ onSignIn, onNavigate }) {
  const auth = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);

  if (!auth.user) {
    return (
      <button className="icon-btn account-btn" data-tour="account" onClick={onSignIn} title="Sign in or create an account">
        👤 <span className="hide-sm">Sign in</span>
      </button>
    );
  }
  const name = auth.profile?.display_name || auth.user.email.split('@')[0];
  const go = (screen) => {
    setOpen(false);
    onNavigate(screen);
  };
  return (
    <div className="account" ref={ref}>
      <button className="icon-btn account-btn signed-in" data-tour="account" onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="menu" title={auth.user.email}>
        <span className="avatar" aria-hidden="true">{name.slice(0, 1).toUpperCase()}</span>
        <span className="hide-sm">{name}</span>
      </button>
      {open && (
        <div className="menu" role="menu">
          <div className="menu-head">
            <b>{name}</b>
            <span className="muted small">{auth.user.email}</span>
            {auth.profile && <span className="muted small">🏆 {auth.profile.missions_won || 0} missions won{auth.profile.best_difficulty ? ` · best: ${auth.profile.best_difficulty}` : ''}</span>}
          </div>
          <button role="menuitem" onClick={() => go('support:tickets')}>🎫 My tickets</button>
          <button role="menuitem" onClick={() => go('support:new')}>🆘 Get help / raise a ticket</button>
          <button role="menuitem" onClick={() => go('support:feedback')}>💬 Send feedback</button>
          <button role="menuitem" onClick={() => go('support:profile')}>⚙ Profile</button>
          {auth.isAdmin && <button role="menuitem" onClick={() => go('admin')}>🛠 Admin: tickets & players</button>}
          <button role="menuitem" className="danger" onClick={() => { setOpen(false); auth.signOut(); }}>↩ Sign out</button>
        </div>
      )}
    </div>
  );
}
