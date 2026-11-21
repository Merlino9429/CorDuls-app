import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import { Badge, Button, Card, Empty, Muted, Row, Thumb } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { formatPrice } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import type { Combo } from '@/lib/types';

export default function AdminCombos() {
  const [combos, setCombos] = useState<Combo[]>([]);

  useFocusEffect(useCallback(() => {
    supabase.from('combos').select('*, combo_items(product_id, quantity, products(id, name))').order('sort_order')
      .then(({ data }) => setCombos((data as Combo[]) ?? []));
  }, []));

  return (
    <FlatList
      style={{ backgroundColor: Colors.background }}
      contentContainerStyle={{ padding: Spacing.lg }}
      data={combos}
      keyExtractor={(c) => c.id}
      ListHeaderComponent={<Button title="+ Nuova combo" onPress={() => router.push('/admin/combo/new')} style={{ marginBottom: Spacing.lg }} />}
      ListEmptyComponent={<Empty text="Nessuna combo. Creane una, es. 'Colazione completa'." />}
      renderItem={({ item: c }) => (
        <Card onPress={() => router.push(`/admin/combo/${c.id}`)}>
          <Row style={{ gap: Spacing.md }}>
            <Thumb uri={c.image_url} size={56} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '700', color: Colors.text }}>{c.name} · {formatPrice(c.price_cents)}</Text>
              <Muted numberOfLines={2}>{c.combo_items?.map((ci) => `${ci.quantity}× ${ci.products?.name}`).join(', ')}</Muted>
            </View>
            {!c.available ? <Badge label="Nascosta" color={Colors.danger} /> : null}
          </Row>
        </Card>
      )}
    />
  );
}
