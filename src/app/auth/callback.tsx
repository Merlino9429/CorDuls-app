import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { Loading } from '@/components/ui';
import { showAlert } from '@/lib/alert';
import { supabase } from '@/lib/supabase';

// Ritorno da Google.
// - App iOS/Android: la sessione viene creata in signInWithGoogle(); qui basta tornare alla Home.
// - Web app: Google riporta il browser qui con ?code=..., che va scambiato con la sessione.
export default function AuthCallback() {
  const { code, error_description } = useLocalSearchParams<{ code?: string; error_description?: string }>();
  const web = Platform.OS === 'web';

  useEffect(() => {
    if (!web) return;
    (async () => {
      if (error_description) showAlert('Accesso con Google non riuscito', String(error_description));
      else if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(String(code));
        if (error) showAlert('Accesso con Google non riuscito', error.message);
      }
      router.replace('/');
    })();
  }, [web, code, error_description]);

  if (!web) return <Redirect href="/" />;
  return <Loading />;
}
