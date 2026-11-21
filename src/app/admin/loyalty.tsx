import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { Badge, Button, Card, Field, Muted, Row, Screen, Subtitle, Thumb } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { formatPrice } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import type { LoyaltyReward, Profile } from '@/lib/types';

export default function AdminLoyalty() {
  const [rewards, setRewards] = useState<LoyaltyReward[]>([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Profile[] | null>(null);
  const [searching, setSearching] = useState(false);

  useFocusEffect(useCallback(() => {
    supabase.from('loyalty_rewards').select('*').order('points_cost')
      .then(({ data }) => setRewards((data as LoyaltyReward[]) ?? []));
  }, []));

  const search = async () => {
    const q = query.trim().replace(/[%,()]/g, '');
    if (!q) return;
    setSearching(true);
    const like = `%${q}%`;
    const { data } = await supabase.from('profiles').select('*')
      .or(`card_number.ilike.${like},full_name.ilike.${like},email.ilike.${like},phone.ilike.${like}`)
      .limit(20);
    setResults((data as Profile[]) ?? []);
    setSearching(false);
  };

  return (
    <Screen>
      <Button title="📷 Scansiona QR tessera" onPress={() => router.push('/admin/scan')} style={{ marginTop: Spacing.sm }} />
      <Subtitle>Cerca un cliente</Subtitle>
      <Field label="N. tessera, nome, email o telefono" value={query} onChangeText={setQuery} onSubmitEditing={search} autoCapitalize="characters" placeholder="CD-12345678" returnKeyType="search" />
      <Button title="Cerca" onPress={search} loading={searching} style={{ marginBottom: Spacing.md }} />
      {results && results.length === 0 ? <Muted>Nessun cliente trovato.</Muted> : null}
      {results?.map((p) => (
        <Card key={p.id} onPress={() => router.push(`/admin/customer/${p.id}`)}>
          <Text style={{ fontWeight: '700', color: Colors.text }}>{p.full_name || p.email || 'Cliente'}</Text>
          <Muted>{p.card_number}{p.phone ? ` · ${p.phone}` : ''}{p.email ? ` · ${p.email}` : ''}</Muted>
        </Card>
      ))}

      <Subtitle>Premi</Subtitle>
      <Muted style={{ marginBottom: Spacing.md }}>I clienti scelgono il premio al checkout: i punti vengono scalati e lo sconto applicato all&apos;ordine.</Muted>
      <Button title="+ Nuovo premio" variant="secondary" onPress={() => router.push('/admin/reward/new')} style={{ marginBottom: Spacing.md }} />
      {rewards.map((r) => (
        <Card key={r.id} onPress={() => router.push(`/admin/reward/${r.id}`)}>
          <Row style={{ gap: Spacing.md }}>
            <Thumb uri={r.image_url} size={48} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '700', color: Colors.text }}>{r.title}</Text>
              <Muted>{r.points_cost} punti → -{formatPrice(r.discount_cents)}</Muted>
            </View>
            {!r.active ? <Badge label="Nascosto" color={Colors.textMuted} /> : null}
          </Row>
        </Card>
      ))}
    </Screen>
  );
}
