// Supabase client. The URL and publishable key are public by design (row-level security protects the data),
// so they ship with the site. Override them with VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY.
import { createClient } from '@supabase/supabase-js';

const URL = import.meta.env.VITE_SUPABASE_URL || 'https://tqsnopqlbvoljekbpuiv.supabase.co';
const KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_lA-qyW8JTlKWmS4JFP3WYg_6ZOFzU-o';

export const supabase = createClient(URL, KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'survive30sols.auth' },
});

// Turn Supabase errors into sentences a 12-year-old can act on.
export function friendlyError(err) {
  const m = String((err && (err.message || err.error_description)) || err || '');
  if (/invalid login credentials/i.test(m)) return 'That email and password do not match. Check them, or reset your password.';
  if (/email not confirmed/i.test(m)) return 'Please confirm your email first: we sent you a link when you signed up.';
  if (/already registered|already been registered|user already exists/i.test(m)) return 'An account with this email already exists. Try signing in instead.';
  if (/password should be at least|weak password/i.test(m)) return 'Choose a stronger password: at least 8 characters with letters and numbers.';
  if (/rate limit|too many/i.test(m)) return 'Too many tries in a short time. Wait a minute and try again.';
  if (/failed to fetch|network/i.test(m)) return 'Could not reach the server. Check your internet connection.';
  if (/violates check constraint/i.test(m)) return 'Something in the form is too short or too long. Please check each field.';
  return m || 'Something went wrong. Please try again.';
}
