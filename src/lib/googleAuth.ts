import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import { supabase } from './supabase';

WebBrowser.maybeCompleteAuthSession();

type OpenAuth = (url: string, redirect: string) => Promise<{ type: string; url?: string }>;

/**
 * Accesso con Google tramite Supabase Auth (OAuth + PKCE):
 * si apre la pagina di Google nel browser di sistema e si torna nell'app con un codice.
 * Restituisce false se l'utente ha chiuso la finestra.
 */
export async function signInWithGoogle(): Promise<boolean> {
  const demo = (globalThis as { __cdDemoOAuth?: OpenAuth }).__cdDemoOAuth;

  // web app: si va alla pagina di Google e si torna su /auth/callback (vedi src/app/auth/callback.tsx)
  if (Platform.OS === 'web' && !demo) {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback`, queryParams: { prompt: 'select_account' } },
    });
    if (error) throw new Error(error.message);
    return false; // il browser sta già cambiando pagina
  }

  const redirectTo = Linking.createURL('auth/callback');
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true, queryParams: { prompt: 'select_account' } },
  });
  if (error || !data.url) throw new Error(error?.message ?? 'Accesso con Google non disponibile');

  // nell'anteprima web la finestra di Google è simulata dalla pagina che ospita l'app
  const open: OpenAuth = Platform.OS === 'web' && demo ? demo : WebBrowser.openAuthSessionAsync;

  const result = await open(data.url, redirectTo);
  if (result.type !== 'success' || !result.url) return false;

  const params = new URL(result.url).searchParams;
  const errorDescription = params.get('error_description');
  if (errorDescription) throw new Error(errorDescription);
  const code = params.get('code');
  if (!code) throw new Error('Risposta di Google non valida');
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) throw new Error(exchangeError.message);
  return true;
}
