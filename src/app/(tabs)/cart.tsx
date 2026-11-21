import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { Button, Card, Empty, Muted, QuantityStepper, Row, Screen, Thumb } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { useCart } from '@/lib/cart';
import { formatPrice } from '@/lib/format';
import { useAutoCombos } from '@/lib/useAutoCombos';

export default function CartScreen() {
  const { lines, subtotal, setQuantity, clear } = useCart();
  const { session } = useAuth();
  const { matches, saving, describe } = useAutoCombos(lines);

  if (lines.length === 0) {
    return (
      <Empty emoji="🛍️" text="Il carrello è vuoto.">
        <Button title="Vai al menu" onPress={() => router.navigate('/')} />
      </Empty>
    );
  }

  return (
    <Screen>
      {lines.map((l) => (
        <Card key={l.key}>
          <Row style={{ gap: Spacing.md }}>
            <Thumb uri={l.image_url} size={56} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '700', color: Colors.text }}>{l.name}</Text>
              {l.notes ? <Muted>Note: {l.notes}</Muted> : null}
              <Text style={{ color: Colors.primary, fontWeight: '700', marginTop: 2 }}>{formatPrice(l.price_cents * l.quantity)}</Text>
            </View>
            <QuantityStepper value={l.quantity} onChange={(q) => setQuantity(l.key, q)} />
          </Row>
        </Card>
      ))}

      {matches.length > 0 ? (
        <Card style={{ backgroundColor: Colors.primarySoft, borderColor: Colors.primarySoft }}>
          <Text style={{ fontWeight: '800', color: Colors.primary, marginBottom: Spacing.xs }}>⭐ Combo applicate in automatico</Text>
          {matches.map((m) => (
            <View key={m.combo.id} style={{ marginTop: Spacing.xs }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Text style={{ fontWeight: '700', color: Colors.text, flex: 1 }}>{m.times > 1 ? `${m.times}× ` : ''}{m.combo.name}</Text>
                <Text style={{ fontWeight: '700', color: Colors.text }}>{formatPrice(m.combo.price_cents * m.times)}</Text>
              </Row>
              <Muted>{describe(m)} · risparmi {formatPrice(m.saving_cents * m.times)}</Muted>
            </View>
          ))}
        </Card>
      ) : null}

      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 16, color: Colors.text }}>{saving > 0 ? 'Prodotti' : 'Subtotale'}</Text>
          <Text style={{ fontSize: saving > 0 ? 16 : 18, fontWeight: saving > 0 ? '500' : '800', color: Colors.text }}>{formatPrice(subtotal)}</Text>
        </Row>
        {saving > 0 ? (
          <>
            <Row style={{ justifyContent: 'space-between', marginTop: 4 }}>
              <Text style={{ fontSize: 16, color: Colors.success }}>Risparmio combo</Text>
              <Text style={{ fontSize: 16, color: Colors.success, fontWeight: '700' }}>-{formatPrice(saving)}</Text>
            </Row>
            <Row style={{ justifyContent: 'space-between', marginTop: 4 }}>
              <Text style={{ fontSize: 16, color: Colors.text }}>Subtotale</Text>
              <Text style={{ fontSize: 18, fontWeight: '800', color: Colors.text }}>{formatPrice(subtotal - saving)}</Text>
            </Row>
          </>
        ) : null}
        <Muted style={{ marginTop: 4 }}>Sconti e costi di consegna calcolati al checkout.</Muted>
      </Card>

      <Button
        title={session ? 'Procedi all\'ordine' : 'Accedi per ordinare'}
        onPress={() => router.push(session ? '/checkout' : '/login')}
      />
      <Button title="Svuota carrello" variant="ghost" onPress={clear} style={{ marginTop: Spacing.sm }} />
    </Screen>
  );
}

