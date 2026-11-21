import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Button, Card, Loading, Muted, QuantityStepper, Row, Screen } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useCart } from '@/lib/cart';
import { formatPrice } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import type { Combo } from '@/lib/types';

export default function ComboScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [combo, setCombo] = useState<Combo | null>(null);
  const [qty, setQty] = useState(1);
  const { add } = useCart();

  useEffect(() => {
    supabase.from('combos').select('*, combo_items(product_id, quantity, products(id, name))').eq('id', id).maybeSingle()
      .then(({ data }) => setCombo(data as Combo));
  }, [id]);

  if (!combo) return <Loading />;

  return (
    <Screen>
      {combo.image_url ? (
        <Image source={{ uri: combo.image_url }} style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: Radius.lg, marginBottom: Spacing.lg }} contentFit="cover" />
      ) : null}
      <Text style={{ fontSize: 26, fontWeight: '800', color: Colors.text }}>⭐ {combo.name}</Text>
      <Text style={{ fontSize: 22, fontWeight: '800', color: Colors.primary, marginVertical: Spacing.sm }}>{formatPrice(combo.price_cents)}</Text>
      {combo.description ? <Muted style={{ fontSize: 16, marginBottom: Spacing.md }}>{combo.description}</Muted> : null}
      <Card>
        <Text style={{ fontWeight: '700', color: Colors.text, marginBottom: Spacing.xs }}>Cosa contiene</Text>
        {combo.combo_items?.map((ci) => <Muted key={ci.product_id}>• {ci.quantity}× {ci.products?.name}</Muted>)}
      </Card>
      <Row style={{ justifyContent: 'space-between', marginTop: Spacing.md }}>
        <QuantityStepper value={qty} onChange={setQty} min={1} />
        <View style={{ flex: 1, marginLeft: Spacing.lg }}>
          <Button
            title={`Aggiungi · ${formatPrice(combo.price_cents * qty)}`}
            disabled={!combo.available}
            onPress={() => {
              add({ type: 'combo', id: combo.id, name: combo.name, price_cents: combo.price_cents, image_url: combo.image_url }, qty);
              router.back();
            }}
          />
        </View>
      </Row>
    </Screen>
  );
}
