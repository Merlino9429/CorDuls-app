import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import { Badge, Button, Card, Empty, Muted, Row, Thumb } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { promoLabel } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import type { Promotion } from '@/lib/types';

function isLive(p: Promotion) {
  const now = Date.now();
  return p.active && (!p.starts_at || new Date(p.starts_at).getTime() <= now) && (!p.ends_at || new Date(p.ends_at).getTime() >= now);
}

export default function AdminPromotions() {
  const [promos, setPromos] = useState<Promotion[]>([]);

  useFocusEffect(useCallback(() => {
    supabase.from('promotions').select('*').order('sort_order').order('created_at', { ascending: false })
      .then(({ data }) => setPromos((data as Promotion[]) ?? []));
  }, []));

  return (
    <FlatList
      style={{ backgroundColor: Colors.background }}
      contentContainerStyle={{ padding: Spacing.lg }}
      data={promos}
      keyExtractor={(p) => p.id}
      ListHeaderComponent={<Button title="+ Nuova promozione" onPress={() => router.push('/admin/promotion/new')} style={{ marginBottom: Spacing.lg }} />}
      ListEmptyComponent={<Empty emoji="🎁" text="Nessuna promozione." />}
      renderItem={({ item: p }) => (
        <Card onPress={() => router.push(`/admin/promotion/${p.id}`)}>
          <Row style={{ gap: Spacing.md }}>
            <Thumb uri={p.image_url} size={56} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '700', color: Colors.text }}>{p.title}</Text>
              <Muted>{[promoLabel(p), p.code ? `codice ${p.code}` : 'automatica'].filter(Boolean).join(' · ')}</Muted>
            </View>
            <Badge label={isLive(p) ? 'Attiva' : 'Non attiva'} color={isLive(p) ? Colors.success : Colors.textMuted} />
          </Row>
        </Card>
      )}
    />
  );
}
