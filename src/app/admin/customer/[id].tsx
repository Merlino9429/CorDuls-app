import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { Button, Card, Field, Loading, Muted, Row, Screen, Segmented, Subtitle } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { showAlert } from '@/lib/alert';
import { useAuth } from '@/lib/auth';
import { formatDateTime, parsePrice } from '@/lib/format';
import { loadLoyalty, REASON_LABELS } from '@/lib/loyalty';
import { supabase } from '@/lib/supabase';
import type { LoyaltyTransaction, Profile } from '@/lib/types';

type Mode = 'spend' | 'points';

export default function AdminCustomer() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [balance, setBalance] = useState(0);
  const [tx, setTx] = useState<LoyaltyTransaction[]>([]);
  const [perEuro, setPerEuro] = useState(1);
  const [mode, setMode] = useState<Mode>('spend');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [{ data: p }, l, { data: st }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', id).single(),
      loadLoyalty(id),
      supabase.from('store_settings').select('points_per_euro').eq('id', 1).single(),
    ]);
    setProfile(p as Profile);
    setBalance(l.balance);
    setTx(l.transactions);
    setPerEuro(st?.points_per_euro ?? 1);
  }, [id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!profile) return <Loading />;

  const points = mode === 'spend'
    ? Math.floor((parsePrice(amount) ?? 0) / 100) * perEuro
    : parseInt(amount, 10) || 0;

  const save = async () => {
    if (!points) { showAlert('Attenzione', mode === 'spend' ? 'Inserisci l\'importo speso.' : 'Inserisci i punti (negativi per toglierli).'); return; }
    if (balance + points < 0) { showAlert('Attenzione', 'Il saldo non può diventare negativo.'); return; }
    setSaving(true);
    const { error } = await supabase.from('loyalty_transactions').insert({
      user_id: profile.id, points, reason: 'manual', created_by: session?.user.id,
      note: note.trim() || (mode === 'spend' ? `Spesa in negozio ${amount} €` : null),
    });
    setSaving(false);
    if (error) { showAlert('Errore', error.message); return; }
    setAmount(''); setNote('');
    showAlert('Fatto', `${points > 0 ? 'Aggiunti' : 'Tolti'} ${Math.abs(points)} punti.`);
    load();
  };

  return (
    <Screen>
      <Text style={{ fontSize: 22, fontWeight: '800', color: Colors.text }}>{profile.full_name || profile.email || 'Cliente'}</Text>
      <Muted>{profile.card_number}{profile.phone ? ` · ${profile.phone}` : ''}</Muted>
      {profile.email ? <Muted>{profile.email}</Muted> : null}

      <Card style={{ marginTop: Spacing.lg, alignItems: 'center' }}>
        <Muted>Saldo punti</Muted>
        <Text style={{ fontSize: 40, fontWeight: '900', color: Colors.primary }}>{balance}</Text>
      </Card>

      <Subtitle>Aggiungi punti</Subtitle>
      <Segmented value={mode} onChange={(m) => { setMode(m); setAmount(''); }} options={[
        { value: 'spend', label: 'Da una spesa' }, { value: 'points', label: 'Punti a mano' },
      ]} />
      <Field
        label={mode === 'spend' ? 'Importo speso in negozio (€)' : 'Punti (es. 20, oppure -20 per toglierli)'}
        value={amount}
        onChangeText={setAmount}
        keyboardType={mode === 'spend' ? 'decimal-pad' : 'numbers-and-punctuation'}
      />
      <Field label="Nota (facoltativa)" value={note} onChangeText={setNote} />
      <Button title={points ? `${points > 0 ? 'Aggiungi' : 'Togli'} ${Math.abs(points)} punti` : 'Aggiungi punti'} onPress={save} loading={saving} />

      <Subtitle>Movimenti</Subtitle>
      {tx.length === 0 ? <Muted>Nessun movimento.</Muted> : tx.map((t) => (
        <Row key={t.id} style={{ paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: Colors.text, fontWeight: '600' }}>{REASON_LABELS[t.reason]}{t.note ? ` · ${t.note}` : ''}</Text>
            <Muted>{formatDateTime(t.created_at)}</Muted>
          </View>
          <Text style={{ fontWeight: '800', color: t.points > 0 ? Colors.success : Colors.danger }}>{t.points > 0 ? '+' : ''}{t.points}</Text>
        </Row>
      ))}
    </Screen>
  );
}
