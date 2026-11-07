import { useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthContext.jsx';
import { friendlyError } from '../lib/supabase.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function strength(pw) {
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[a-z]/i.test(pw) && /\d/.test(pw)) s++;
  if (/[^a-z0-9]/i.test(pw)) s++;
  return s; // 0..4
}
const STRENGTH = ['Too short', 'Weak', 'OK', 'Strong', 'Very strong'];

// mode: 'signin' | 'signup' | 'forgot' | 'reset'
export default function AuthModal({ initialMode = 'signin', onClose }) {
  const auth = useAuth();
  const [mode, setMode] = useState(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [name, setName] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const first = useRef(null);

  useEffect(() => {
    setError('');
    setDone('');
    first.current && first.current.focus();
  }, [mode]);
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    const em = email.trim().toLowerCase();
    if (mode !== 'reset' && !EMAIL_RE.test(em)) return setError('Please enter a valid email address.');
    if ((mode === 'signup' || mode === 'reset') && password.length < 8) return setError('Your password needs at least 8 characters.');
    if ((mode === 'signup' || mode === 'reset') && password !== confirm) return setError('The two passwords do not match.');
    if (mode === 'signup' && name.trim().length < 2) return setError('Pick a call sign with at least 2 letters.');
    setBusy(true);
    try {
      if (mode === 'signin') {
        await auth.signIn({ email: em, password });
        onClose();
      } else if (mode === 'signup') {
        const r = await auth.signUp({ email: em, password, displayName: name.trim() });
        if (r.needsConfirm) setDone(`Almost there, ${name.trim()}! We sent a confirmation link to ${em}. Open it to activate your account, then sign in.`);
        else onClose();
      } else if (mode === 'forgot') {
        await auth.resetPassword(em);
        setDone(`If ${em} has an account, a password-reset link is on its way.`);
      } else if (mode === 'reset') {
        await auth.updatePassword(password);
        auth.clearRecovery();
        setDone('Password updated. You are signed in.');
      }
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  const titles = {
    signin: ['Welcome back, astronaut', 'Sign in to keep your missions, tickets and badges.'],
    signup: ['Join Mission Control', 'Create a free account. You can still play as a guest without one.'],
    forgot: ['Reset your password', "Enter your email and we'll send you a reset link."],
    reset: ['Choose a new password', 'Pick something you have not used before.'],
  };
  const st = strength(password);

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        <div className="auth-badge" aria-hidden="true">🧑‍🚀</div>
        <h2 id="auth-title">{titles[mode][0]}</h2>
        <p className="muted small">{titles[mode][1]}</p>

        {(mode === 'signin' || mode === 'signup') && (
          <div className="seg-tabs" role="tablist">
            <button role="tab" aria-selected={mode === 'signin'} className={mode === 'signin' ? 'on' : ''} onClick={() => setMode('signin')}>Sign in</button>
            <button role="tab" aria-selected={mode === 'signup'} className={mode === 'signup' ? 'on' : ''} onClick={() => setMode('signup')}>Sign up</button>
          </div>
        )}

        {done ? (
          <div className="notice ok" role="status">
            <p>✅ {done}</p>
            <button className="btn btn-primary wide" onClick={() => (mode === 'signup' || mode === 'forgot' ? setMode('signin') : onClose())}>
              {mode === 'signup' || mode === 'forgot' ? 'Back to sign in' : 'Continue'}
            </button>
          </div>
        ) : (
          <form onSubmit={submit} noValidate className="form">
            {mode === 'signup' && (
              <label className="field">
                <span>Call sign (shown to your team)</span>
                <input ref={first} value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="e.g. Nova Rider" autoComplete="nickname" />
              </label>
            )}
            {mode !== 'reset' && (
              <label className="field">
                <span>Email</span>
                <input ref={mode === 'signup' ? null : first} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" inputMode="email" />
              </label>
            )}
            {mode !== 'forgot' && (
              <label className="field">
                <span>{mode === 'reset' ? 'New password' : 'Password'}</span>
                <div className="pw-wrap">
                  <input ref={mode === 'reset' ? first : null} type={showPw ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} placeholder={mode === 'signin' ? '••••••••' : 'At least 8 characters'} />
                  <button type="button" className="pw-toggle" onClick={() => setShowPw(!showPw)} aria-label={showPw ? 'Hide password' : 'Show password'}>{showPw ? '🙈' : '👁'}</button>
                </div>
              </label>
            )}
            {(mode === 'signup' || mode === 'reset') && (
              <>
                <div className="pw-meter" aria-label={`Password strength: ${STRENGTH[st]}`}>
                  {[0, 1, 2, 3].map((i) => <i key={i} className={i < st ? `on s${st}` : ''} />)}
                  <span className="muted small">{password ? STRENGTH[st] : ''}</span>
                </div>
                <label className="field">
                  <span>Confirm password</span>
                  <input type={showPw ? 'text' : 'password'} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
                </label>
              </>
            )}
            {error && <p className="notice bad" role="alert">⚠ {error}</p>}
            <button className="btn btn-primary wide" disabled={busy} type="submit">
              {busy ? '⏳ Contacting Mission Control…' : { signin: '🚀 Sign in', signup: '✨ Create account', forgot: '📨 Send reset link', reset: '🔐 Save new password' }[mode]}
            </button>
            {mode === 'signin' && <button type="button" className="link-btn" onClick={() => setMode('forgot')}>Forgot your password?</button>}
            {mode === 'forgot' && <button type="button" className="link-btn" onClick={() => setMode('signin')}>← Back to sign in</button>}
          </form>
        )}

        {(mode === 'signin' || mode === 'signup') && !done && (
          <button className="btn btn-ghost wide" onClick={onClose}>Continue as guest</button>
        )}
        {mode === 'signup' && !done && <p className="muted small center">By signing up you agree that we store your email to run your account and reply to your tickets. Nothing is shared.</p>}
      </div>
    </div>
  );
}
