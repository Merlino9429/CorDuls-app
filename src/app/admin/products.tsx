import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import { Badge, Button, Card, Empty, Muted, Row, Thumb } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { formatPrice } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import type { Category, Product } from '@/lib/types';

export default function AdminProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Record<string, string>>({});

  useFocusEffect(useCallback(() => {
    Promise.all([
      supabase.from('products').select('*').order('sort_order').order('name'),
      supabase.from('categories').select('*'),
    ]).then(([p, c]) => {
      setProducts((p.data as Product[]) ?? []);
      setCategories(Object.fromEntries(((c.data as Category[]) ?? []).map((x) => [x.id, x.name])));
    });
  }, []));

  return (
    <FlatList
      style={{ backgroundColor: Colors.background }}
      contentContainerStyle={{ padding: Spacing.lg }}
      data={products}
      keyExtractor={(p) => p.id}
      ListHeaderComponent={<Button title="+ Nuovo prodotto" onPress={() => router.push('/admin/product/new')} style={{ marginBottom: Spacing.lg }} />}
      ListEmptyComponent={<Empty text="Nessun prodotto. Creane uno!" />}
      renderItem={({ item: p }) => (
        <Card onPress={() => router.push(`/admin/product/${p.id}`)}>
          <Row style={{ gap: Spacing.md }}>
            <Thumb uri={p.image_url} size={56} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '700', color: Colors.text }}>{p.name}</Text>
              <Muted>{p.category_id ? categories[p.category_id] ?? '—' : 'Senza categoria'} · {formatPrice(p.price_cents)}</Muted>
            </View>
            {!p.available ? <Badge label="Non disponibile" color={Colors.danger} /> : p.featured ? <Badge label="In evidenza" /> : null}
          </Row>
        </Card>
      )}
    />
  );
}
