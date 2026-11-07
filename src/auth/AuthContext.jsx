import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase.js';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [ready, setReady] = useState(false);
  const [recovery, setRecovery] = useState(false); // arrived from a password-reset email

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const user = session ? session.user : null;
  const loadProfile = useCallback(async () => {
    if (!user) return setProfile(null);
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
    setProfile(data || { id: user.id, email: user.email, display_name: user.user_metadata?.display_name || 'Cadet', role: 'player' });
  }, [user]);
  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const value = useMemo(() => ({
    ready,
    user,
    profile,
    isAdmin: profile?.role === 'admin',
    recovery,
    clearRecovery: () => setRecovery(false),
    reloadProfile: loadProfile,
    signUp: async ({ email, password, displayName }) => {
      const redirect = window.location.origin + window.location.pathname;
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { display_name: displayName }, emailRedirectTo: redirect },
      });
      if (error) throw error;
      // Supabase hides "already registered" behind an empty identities list.
      if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        throw new Error('User already registered');
      }
      return { needsConfirm: !data.session };
    },
    signIn: async ({ email, password }) => {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    },
    resetPassword: async (email) => {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + window.location.pathname });
      if (error) throw error;
    },
    updatePassword: async (password) => {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
    },
    updateName: async (displayName) => {
      if (!user) return;
      const { error } = await supabase.from('profiles').update({ display_name: displayName.slice(0, 40) }).eq('id', user.id);
      if (error) throw error;
      await loadProfile();
    },
    recordWin: async (difficulty) => {
      if (!user || !profile) return;
      const order = ['cadet', 'astronaut', 'commander', 'live'];
      const best = order.indexOf(difficulty) > order.indexOf(profile.best_difficulty || '') ? difficulty : profile.best_difficulty;
      await supabase.from('profiles').update({ missions_won: (profile.missions_won || 0) + 1, best_difficulty: best }).eq('id', user.id);
      await loadProfile();
    },
    signOut: async () => {
      await supabase.auth.signOut();
      setProfile(null);
    },
  }), [ready, user, profile, recovery, loadProfile]);

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  return useContext(AuthCtx);
}
