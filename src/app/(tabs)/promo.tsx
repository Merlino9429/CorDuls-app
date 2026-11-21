import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { Badge, Card, Empty, Loading, Muted, Screen } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { formatPrice, promoLabel } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import type { Promotion } from '@/lib/types';

export default function PromoScreen() {
  const [promos, setPromos] = useState<Promotion[] | null>(null);

  useFocusEffect(useCallback(() => {
    supabase.from('promotions').select('*').eq('active', true).eq('show_in_app', true).order('sort_order')
      .then(({ data }) => setPromos((data as Promotion[]) ?? []));
  }, []));

  if (!promos) return <Loading />;
  if (promos.length === 0) return <Empty emoji="🎁" text="Nessuna promozione attiva al momento. Attiva le notifiche per non perdere le prossime!" />;

  return (
    <Screen>
      {promos.map((p) => (
        <Card key={p.id} style={{ padding: 0, overflow: 'hidden' }}>
          {p.image_url ? <Image source={{ uri: p.image_url }} style={{ width: '100%', aspectRatio: 16 / 9 }} contentFit="cover" /> : null}
          <View style={{ padding: Spacing.lg, gap: Spacing.sm }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: Colors.text, flex: 1 }}>{p.title}</Text>
              {promoLabel(p) ? <Badge label={promoLabel(p)!} /> : null}
            </View>
            {p.description ? <Muted>{p.description}</Muted> : null}
            {p.code ? (
              <View style={{ backgroundColor: Colors.primarySoft, borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center' }}>
                <Muted>Usa il codice al checkout</Muted>
                <Text style={{ fontSize: 22, fontWeight: '900', color: Colors.primary, letterSpacing: 2 }}>{p.code}</Text>
              </View>
            ) : p.discount_type !== 'none' ? <Muted>Sconto applicato automaticamente al checkout.</Muted> : null}
            {p.min_order_cents > 0 ? <Muted>Ordine minimo {formatPrice(p.min_order_cents)}</Muted> : null}
            {p.ends_at ? <Muted>Valida fino al {new Date(p.ends_at).toLocaleDateString('it-IT')}</Muted> : null}
          </View>
        </Card>
      ))}
    </Screen>
  );
}
