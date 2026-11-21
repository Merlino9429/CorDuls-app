import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Button, Field, Muted, Screen, Segmented } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { isGoogleSignInEnabled, signInWithGoogle } from '@/lib/googleAuth';
import { supabase } from '@/lib/supabase';
import { showAlert } from '@/lib/alert';

export default function LoginScreen() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!email.trim() || password.length < 6) {
      showAlert('Attenzione', 'Inserisci email e una password di almeno 6 caratteri.');
      return;
    }
    setLoading(true);
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        router.back();
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { full_name: fullName.trim(), phone: phone.trim() } },
        });
        if (error) throw error;
        if (data.session) router.back();
        else showAlert('Controlla la tua email', 'Ti abbiamo inviato un link per confermare l\'account.');
      }
    } catch (e) {
      const msg = (e as Error).message;
      showAlert('Errore', msg.includes('Invalid login') ? 'Email o password errati.' : msg);
    } finally {
      setLoading(false);
    }
  };

  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleEnabled, setGoogleEnabled] = useState(false);
  useEffect(() => { isGoogleSignInEnabled().then(setGoogleEnabled); }, []);
  const google = async () => {
    setGoogleLoading(true);
    try {
      if (await signInWithGoogle()) router.back();
    } catch (e) {
      showAlert('Accesso con Google non riuscito', (e as Error).message);
    } finally {
      setGoogleLoading(false);
    }
  };

  const reset = async () => {
    if (!email.trim()) { showAlert('Inserisci la tua email'); return; }
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
    showAlert(error ? 'Errore' : 'Email inviata', error ? error.message : 'Segui le istruzioni per reimpostare la password.');
  };

  return (
    <Screen>
      <Text style={{ fontSize: 30, fontWeight: '900', color: Colors.primary, textAlign: 'center', marginVertical: Spacing.xl }}>Cor Duls 💛</Text>
      {googleEnabled ? (
        <>
      <Pressable
        accessibilityRole="button"
        onPress={google}
        disabled={googleLoading}
        style={({ pressed }) => [{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
          borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.card, borderRadius: 999,
          minHeight: 50, opacity: pressed || googleLoading ? 0.7 : 1,
        }]}>
        <Ionicons name="logo-google" size={20} color="#4285F4" />
        <Text style={{ fontSize: 16, fontWeight: '700', color: Colors.text }}>{googleLoading ? 'Attendere…' : 'Continua con Google'}</Text>
      </Pressable>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginVertical: Spacing.lg }}>
        <View style={{ flex: 1, height: 1, backgroundColor: Colors.border }} />
        <Muted>oppure con email</Muted>
        <View style={{ flex: 1, height: 1, backgroundColor: Colors.border }} />
      </View>
        </>
      ) : null}
      <Segmented
        value={mode}
        onChange={setMode}
        options={[{ value: 'login', label: 'Accedi' }, { value: 'register', label: 'Registrati' }]}
      />
      {mode === 'register' ? (
        <>
          <Field label="Nome e cognome" value={fullName} onChangeText={setFullName} autoComplete="name" />
          <Field label="Telefono" value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" />
        </>
      ) : null}
      <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
      <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
      <Button title={mode === 'login' ? 'Accedi' : 'Crea account'} onPress={submit} loading={loading} />
      {mode === 'login' ? <Button title="Password dimenticata?" variant="ghost" onPress={reset} style={{ marginTop: Spacing.sm }} /> : (
        <Muted style={{ textAlign: 'center', marginTop: Spacing.md }}>
          Registrandoti dichiari di aver letto l&apos;<Text style={{ color: Colors.primary, fontWeight: '700' }} onPress={() => router.push('/privacy')}>informativa privacy</Text>.
        </Muted>
      )}
    </Screen>
  );
}
