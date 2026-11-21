import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Button, Field, Loading, Muted, QuantityStepper, Row, Screen } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useCart } from '@/lib/cart';
import { formatPrice } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import type { Product } from '@/lib/types';

export default function ProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [qty, setQty] = useState(1);
  const [notes, setNotes] = useState('');
  const { add } = useCart();

  useEffect(() => {
    supabase.from('products').select('*').eq('id', id).maybeSingle().then(({ data }) => setProduct(data as Product));
  }, [id]);

  if (!product) return <Loading />;

  return (
    <Screen>
      {product.image_url ? (
        <Image source={{ uri: product.image_url }} style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: Radius.lg, marginBottom: Spacing.lg }} contentFit="cover" />
      ) : null}
      <Text style={{ fontSize: 26, fontWeight: '800', color: Colors.text }}>{product.name}</Text>
      <Text style={{ fontSize: 22, fontWeight: '800', color: Colors.primary, marginVertical: Spacing.sm }}>{formatPrice(product.price_cents)}</Text>
      {product.description ? <Muted style={{ fontSize: 16, marginBottom: Spacing.md }}>{product.description}</Muted> : null}
      {product.allergens ? <Muted style={{ marginBottom: Spacing.md }}>Allergeni: {product.allergens}</Muted> : null}

      <Field label="Note (facoltative)" placeholder="Es. senza zucchero" value={notes} onChangeText={setNotes} maxLength={200} />

      <Row style={{ justifyContent: 'space-between', marginTop: Spacing.md }}>
        <QuantityStepper value={qty} onChange={setQty} min={1} />
        <View style={{ flex: 1, marginLeft: Spacing.lg }}>
          <Button
            title={`Aggiungi · ${formatPrice(product.price_cents * qty)}`}
            disabled={!product.available}
            onPress={() => {
              add({ type: 'product', id: product.id, name: product.name, price_cents: product.price_cents, image_url: product.image_url, notes: notes.trim() || undefined }, qty);
              router.back();
            }}
          />
        </View>
      </Row>
    </Screen>
  );
}
