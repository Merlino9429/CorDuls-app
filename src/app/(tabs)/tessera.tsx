import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CardQr } from '@/components/CardQr';
import { NotificationsCard } from '@/components/NotificationsCard';
import { Button, Card, Empty, Loading, Muted, Row, Screen, Subtitle, Thumb } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { formatDateTime, formatPrice } from '@/lib/format';
import { REASON_LABELS, useLoyalty } from '@/lib/loyalty';
import { supabase } from '@/lib/supabase';
import type { StoreSettings } from '@/lib/types';

export default function LoyaltyCardScreen() {
  const { session, profile } = useAuth();
  const { balance, transactions, rewards, loaded } = useLoyalty(session?.user.id);
  const [settings, setSettings] = useState<StoreSettings | null>(null);

  useFocusEffect(useCallback(() => {
    supabase.from('store_settings').select('*').eq('id', 1).maybeSingle().then(({ data }) => setSettings(data as StoreSettings));
  }, []));

  if (!loaded || !settings) return <Loading />;
  if (!settings.loyalty_enabled) return <Empty emoji="⭐" text="La tessera punti arriverà presto!" />;

  const earnText = `Guadagni ${settings.points_per_euro} ${settings.points_per_euro === 1 ? 'punto' : 'punti'} per ogni euro speso.`;

  if (!session) {
    return (
      <Screen>
        <View style={[s.card, { marginBottom: Spacing.lg }]}>
          <Text style={s.cardBrand}>Cor Duls</Text>
          <Text style={s.cardTitle}>Tessera punti</Text>
          <Text style={s.cardText}>{earnText}{settings.loyalty_welcome_points > 0 ? ` In regalo ${settings.loyalty_welcome_points} punti all'iscrizione.` : ''}</Text>
        </View>
        <Button title="Accedi per avere la tessera" onPress={() => router.push('/login')} />
        <RewardsList rewards={rewards} balance={0} />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={s.card}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text style={s.cardBrand}>Cor Duls</Text>
          <Text style={s.cardBrandSmall}>TESSERA PUNTI</Text>
        </Row>
        <Text style={s.points}>{balance}</Text>
        <Text style={s.pointsLabel}>punti</Text>
        <Row style={{ justifyContent: 'space-between', marginTop: Spacing.lg }}>
          <View>
            <Text style={s.cardSmall}>Titolare</Text>
            <Text style={s.cardText}>{profile?.full_name || session.user.email}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={s.cardSmall}>N. tessera</Text>
            <Text style={[s.cardText, { letterSpacing: 1.5, fontVariant: ['tabular-nums'] }]}>{profile?.card_number ?? '—'}</Text>
          </View>
        </Row>
      </View>
      <Muted style={{ textAlign: 'center', marginTop: Spacing.sm, marginBottom: Spacing.lg }}>{earnText}</Muted>
      {profile?.card_number ? <CardQr cardNumber={profile.card_number} /> : null}
      <NotificationsCard userId={session.user.id} />

      <RewardsList rewards={rewards} balance={balance} />

      <Subtitle>Movimenti</Subtitle>
      {transactions.length === 0 ? <Muted>Nessun movimento: i punti arrivano quando un ordine viene completato.</Muted> : transactions.map((t) => (
        <Row key={t.id} style={s.txRow}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: Colors.text, fontWeight: '600' }}>{REASON_LABELS[t.reason]}{t.note ? ` · ${t.note}` : ''}</Text>
            <Muted>{formatDateTime(t.created_at)}</Muted>
          </View>
          <Text style={{ fontWeight: '800', color: t.points > 0 ? Colors.success : Colors.danger }}>{t.points > 0 ? '+' : ''}{t.points}</Text>
        </Row>
      ))}
      <Button title="Vedi le promozioni" variant="ghost" onPress={() => router.push('/promo')} style={{ marginTop: Spacing.lg }} />
    </Screen>
  );
}

function RewardsList({ rewards, balance }: { rewards: { id: string; title: string; description: string | null; image_url: string | null; points_cost: number; discount_cents: number }[]; balance: number }) {
  if (rewards.length === 0) return null;
  return (
    <>
      <Subtitle>Premi</Subtitle>
      {rewards.map((r) => {
        const progress = Math.min(1, balance / r.points_cost);
        const ready = balance >= r.points_cost;
        return (
          <Card key={r.id}>
            <Row style={{ gap: Spacing.md }}>
              <Thumb uri={r.image_url} size={52} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '700', color: Colors.text }}>{r.title}</Text>
                <Muted>{r.description || `${formatPrice(r.discount_cents)} di sconto`}</Muted>
              </View>
              <Text style={{ fontWeight: '800', color: Colors.primary }}>{r.points_cost} pt</Text>
            </Row>
            <View style={s.bar}><View style={[s.barFill, { width: `${progress * 100}%` }]} /></View>
            <Muted style={{ marginTop: 4, color: ready ? Colors.success : Colors.textMuted }}>
              {ready ? 'Disponibile: sceglilo al checkout' : `Ti mancano ${r.points_cost - balance} punti`}
            </Muted>
          </Card>
        );
      })}
    </>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: Colors.primary, borderRadius: Radius.lg, padding: Spacing.xl,
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 4,
  },
  cardBrand: { color: '#fff', fontSize: 20, fontWeight: '900' },
  cardBrandSmall: { color: '#fff', opacity: 0.8, fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  cardTitle: { color: '#fff', fontSize: 26, fontWeight: '800', marginTop: Spacing.md },
  cardText: { color: '#fff', fontSize: 15, fontWeight: '600', marginTop: 2 },
  cardSmall: { color: '#fff', opacity: 0.75, fontSize: 11, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  points: { color: '#fff', fontSize: 52, fontWeight: '900', marginTop: Spacing.lg, fontVariant: ['tabular-nums'] },
  pointsLabel: { color: '#fff', opacity: 0.85, fontSize: 15, fontWeight: '700', marginTop: -6 },
  bar: { height: 8, borderRadius: 4, backgroundColor: Colors.primarySoft, marginTop: Spacing.md, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4, backgroundColor: Colors.primary },
  txRow: { paddingVertical: Spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border },
});
