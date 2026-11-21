import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Text } from 'react-native';
import { Button, Card, Empty, Field, Muted, Screen, Subtitle } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { unregisterPush } from '@/lib/push';
import { callFunction } from '@/lib/api';
import { disableWebPush } from '@/lib/webPush';
import { NotificationsCard } from '@/components/NotificationsCard';
import { supabase } from '@/lib/supabase';
import type { Profile, StoreSettings } from '@/lib/types';
import { showAlert } from '@/lib/alert';

export default function ProfileScreen() {
  const { session, profile, signOut, isAdmin } = useAuth();
  const [store, setStore] = useState<StoreSettings | null>(null);

  useEffect(() => {
    supabase.from('store_settings').select('*').eq('id', 1).maybeSingle().then(({ data }) => setStore(data as StoreSettings));
  }, []);

  const storeCard = store ? (
    <Card>
      <Text style={{ fontWeight: '800', fontSize: 16, color: Colors.text }}>{store.store_name}</Text>
      {store.address ? <Muted>📍 {store.address}</Muted> : null}
      {store.opening_hours ? <Muted>🕒 {store.opening_hours}</Muted> : null}
      {store.phone ? (
        <Text style={{ color: Colors.primary, fontWeight: '700', marginTop: Spacing.sm }} onPress={() => Linking.openURL(`tel:${store.phone}`)}>
          📞 {store.phone}
        </Text>
      ) : null}
    </Card>
  ) : null;

  if (!session) {
    return (
      <Screen>
        <Empty emoji="👋" text="Accedi o registrati per ordinare e ricevere le notifiche sulle promozioni.">
          <Button title="Accedi / Registrati" onPress={() => router.push('/login')} />
        </Empty>
        {storeCard}
      </Screen>
    );
  }

  const deleteAccount = () => showAlert(
    'Eliminare l\'account?',
    'Cancelliamo profilo, tessera punti e notifiche. I punti accumulati andranno persi. L\'operazione non si può annullare.',
    [
      { text: 'Annulla', style: 'cancel' },
      {
        text: 'Elimina', style: 'destructive', onPress: async () => {
          try {
            await callFunction('delete-account', {});
            await disableWebPush().catch(() => {});
            await signOut();
            showAlert('Account eliminato', 'I tuoi dati sono stati cancellati.');
          } catch (e) {
            showAlert('Errore', (e as Error).message);
          }
        },
      },
    ],
  );

  const logout = async () => {
    await unregisterPush();
    await disableWebPush().catch(() => {});
    await signOut();
  };

  return (
    <Screen>
      <Muted>{session.user.email}</Muted>
      {isAdmin ? <Text style={{ color: Colors.primary, fontWeight: '700' }}>Account amministratore</Text> : null}
      <Subtitle>I miei dati</Subtitle>
      <ProfileForm key={profile?.id ?? 'none'} profile={profile} />
      <NotificationsCard userId={session.user.id} />
      <Subtitle>Il negozio</Subtitle>
      {storeCard}
      <Button title="Esci" variant="ghost" onPress={logout} style={{ marginTop: Spacing.lg }} />
      <Button title="Informativa privacy" variant="ghost" onPress={() => router.push('/privacy')} />
      <Button title="Elimina account" variant="ghost" onPress={deleteAccount} style={{ marginTop: Spacing.lg }} />
    </Screen>
  );
}

function ProfileForm({ profile }: { profile: Profile | null }) {
  const { refreshProfile } = useAuth();
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [address, setAddress] = useState(profile?.address ?? '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!profile) return;
    setSaving(true);
    const { error } = await supabase.from('profiles')
      .update({ full_name: fullName.trim(), phone: phone.trim(), address: address.trim() })
      .eq('id', profile.id);
    setSaving(false);
    if (error) showAlert('Errore', error.message);
    else { await refreshProfile(); showAlert('Salvato', 'Dati aggiornati.'); }
  };

  return (
    <>
      <Field label="Nome e cognome" value={fullName} onChangeText={setFullName} />
      <Field label="Telefono" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      <Field label="Indirizzo di consegna" value={address} onChangeText={setAddress} />
      <Button title="Salva" onPress={save} loading={saving} />
    </>
  );
}
