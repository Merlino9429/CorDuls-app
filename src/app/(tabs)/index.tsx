import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card, Empty, Loading, Muted, Thumb } from '@/components/ui';
import { WebAppBanner } from '@/components/WebAppBanner';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { formatPrice } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import type { Category, Combo, Product, Promotion, StoreSettings } from '@/lib/types';

type Entry =
  | { kind: 'product'; item: Product }
  | { kind: 'combo'; item: Combo };

export default function MenuScreen() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [combos, setCombos] = useState<Combo[]>([]);
  const [promos, setPromos] = useState<Promotion[]>([]);
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [selected, setSelected] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [c, p, co, pr, s] = await Promise.all([
      supabase.from('categories').select('*').eq('active', true).order('sort_order'),
      supabase.from('products').select('*').eq('available', true).order('sort_order'),
      supabase.from('combos').select('*, combo_items(product_id, quantity, products(id, name))').eq('available', true).order('sort_order'),
      supabase.from('promotions').select('*').eq('active', true).eq('show_in_app', true).order('sort_order').limit(5),
      supabase.from('store_settings').select('*').eq('id', 1).maybeSingle(),
    ]);
    setCategories((c.data as Category[]) ?? []);
    setProducts((p.data as Product[]) ?? []);
    setCombos((co.data as Combo[]) ?? []);
    setPromos((pr.data as Promotion[]) ?? []);
    setSettings((s.data as StoreSettings) ?? null);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const entries = useMemo<Entry[]>(() => {
    if (selected === 'combo') return combos.map((item) => ({ kind: 'combo', item }));
    const list = selected === 'all' ? products : products.filter((p) => p.category_id === selected);
    const base: Entry[] = list.map((item) => ({ kind: 'product', item }));
    return selected === 'all' ? [...combos.map((item) => ({ kind: 'combo' as const, item })), ...base] : base;
  }, [selected, products, combos]);

  if (loading) return <Loading />;

  const chips = [
    { id: 'all', name: 'Tutto' },
    ...(combos.length ? [{ id: 'combo', name: '⭐ Combo' }] : []),
    ...categories.map((c) => ({ id: c.id, name: c.name })),
  ];

  return (
    <FlatList
      style={{ backgroundColor: Colors.background }}
      contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 100 }}
      data={entries}
      keyExtractor={(e) => `${e.kind}:${e.item.id}`}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
      ListHeaderComponent={
        <View>
          <WebAppBanner />
          {settings && !settings.accepting_orders ? (
            <Card style={{ backgroundColor: '#FFF1E0' }}>
              <Text style={{ fontWeight: '700', color: Colors.warning }}>Ordini momentaneamente chiusi</Text>
              {settings.opening_hours ? <Muted>{settings.opening_hours}</Muted> : null}
            </Card>
          ) : null}

          {promos.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Spacing.lg }} contentContainerStyle={{ gap: Spacing.md }}>
              {promos.map((p) => (
                <Pressable key={p.id} onPress={() => router.push('/promo')} style={s.promo}>
                  {p.image_url ? <Thumb uri={p.image_url} size={64} /> : <Text style={{ fontSize: 34 }}>🎁</Text>}
                  <View style={{ flex: 1 }}>
                    <Text style={s.promoTitle} numberOfLines={1}>{p.title}</Text>
                    {p.description ? <Text style={s.promoText} numberOfLines={2}>{p.description}</Text> : null}
                    {p.code ? <Text style={s.promoCode}>Codice: {p.code}</Text> : null}
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          ) : null}

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Spacing.sm, marginBottom: Spacing.lg }}>
            {chips.map((c) => (
              <Pressable key={c.id} onPress={() => setSelected(c.id)} style={[s.chip, selected === c.id && s.chipActive]}>
                <Text style={[s.chipText, selected === c.id && { color: '#fff' }]}>{c.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      }
      ListEmptyComponent={<Empty text="Il menu è in arrivo!" />}
      renderItem={({ item: e }) => (
        <Card onPress={() => router.push(e.kind === 'product' ? `/product/${e.item.id}` : `/combo/${e.item.id}`)}>
          <View style={{ flexDirection: 'row', gap: Spacing.md }}>
            <Thumb uri={e.item.image_url} size={84} />
            <View style={{ flex: 1, justifyContent: 'space-between' }}>
              <View>
                <Text style={s.name}>{e.kind === 'combo' ? '⭐ ' : ''}{e.item.name}</Text>
                {e.item.description ? <Muted style={{ marginTop: 2 }}>{e.item.description}</Muted> : null}
                {e.kind === 'combo' && e.item.combo_items?.length ? (
                  <Muted style={{ marginTop: 2 }}>
                    {e.item.combo_items.map((ci) => `${ci.quantity}× ${ci.products?.name ?? ''}`).join(' · ')}
                  </Muted>
                ) : null}
              </View>
              <Text style={s.price}>{formatPrice(e.item.price_cents)}</Text>
            </View>
          </View>
        </Card>
      )}
    />
  );
}

const s = StyleSheet.create({
  promo: { width: 300, flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: Colors.primary, borderRadius: Radius.lg, padding: Spacing.md },
  promoTitle: { color: '#fff', fontWeight: '800', fontSize: 16 },
  promoText: { color: '#fff', opacity: 0.9, fontSize: 13 },
  promoCode: { color: '#fff', fontWeight: '700', fontSize: 12, marginTop: 2 },
  chip: { paddingHorizontal: Spacing.lg, paddingVertical: 8, borderRadius: Radius.pill, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontWeight: '600', color: Colors.text },
  name: { fontSize: 16, fontWeight: '700', color: Colors.text },
  price: { fontSize: 16, fontWeight: '800', color: Colors.primary, marginTop: Spacing.sm },
});
