import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, Text, View } from 'react-native';
import { Button, Card, Field, Loading, Muted, Row, Screen, Segmented, Subtitle } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { callFunction } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { PENDING_PAYMENT_KEY, useCart } from '@/lib/cart';
import { formatPrice } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import type { StoreSettings } from '@/lib/types';
import { useAutoCombos } from '@/lib/useAutoCombos';
import { useLoyalty } from '@/lib/loyalty';
import { showAlert } from '@/lib/alert';

type Fulfillment = 'pickup' | 'delivery';
type Payment = 'sumup' | 'cash';

const SLOT_MINUTES = 15;

/** Fasce orarie a partire da "adesso + tempo di preparazione", per le prossime ~4 ore. */
function buildSlots(prepMinutes: number) {
  const start = new Date(Date.now() + prepMinutes * 60_000);
  start.setSeconds(0, 0);
  start.setMinutes(Math.ceil(start.getMinutes() / SLOT_MINUTES) * SLOT_MINUTES);
  return Array.from({ length: 16 }, (_, i) => new Date(start.getTime() + i * SLOT_MINUTES * 60_000));
}

export default function CheckoutScreen() {
  const { session, profile } = useAuth();
  const { lines, subtotal: productsTotal, clear } = useCart();
  const { saving: comboSaving } = useAutoCombos(lines);
  const subtotal = productsTotal - comboSaving;
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [fulfillment, setFulfillment] = useState<Fulfillment>('pickup');
  const [payment, setPayment] = useState<Payment>('sumup');
  const [name, setName] = useState(profile?.full_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [address, setAddress] = useState(profile?.address ?? '');
  const [notes, setNotes] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [slot, setSlot] = useState<string | null>(null); // null = prima possibile
  const [rewardId, setRewardId] = useState<string | null>(null);
  const { balance, rewards } = useLoyalty(session?.user.id);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    supabase.from('store_settings').select('*').eq('id', 1).maybeSingle().then(({ data }) => {
      const s = data as StoreSettings;
      setSettings(s);
      if (s && !s.pickup_enabled && s.delivery_enabled) setFulfillment('delivery');
    });
  }, []);

  useEffect(() => {
    if (!session) router.replace('/login');
  }, [session]);

  if (!settings) return <Loading />;

  const deliveryFee = fulfillment === 'delivery'
    ? (settings.delivery_free_over_cents != null && subtotal >= settings.delivery_free_over_cents ? 0 : settings.delivery_fee_cents)
    : 0;
  const belowMinimum = fulfillment === 'delivery' && subtotal < settings.delivery_min_order_cents;
  const slots = buildSlots(settings.prep_time_minutes);
  const reward = settings.loyalty_enabled ? rewards.find((r) => r.id === rewardId && balance >= r.points_cost) ?? null : null;
  const rewardDiscount = reward ? Math.min(reward.discount_cents, subtotal) : 0;

  const submit = async () => {
    if (!name.trim() || !phone.trim()) { showAlert('Attenzione', 'Inserisci nome e telefono.'); return; }
    if (fulfillment === 'delivery' && !address.trim()) { showAlert('Attenzione', 'Inserisci l\'indirizzo di consegna.'); return; }
    setSubmitting(true);
    try {
      const res = await callFunction<{ order_id: string; checkout_url?: string }>('create-order', {
        items: lines.map((l) => ({ type: l.type, id: l.id, quantity: l.quantity, notes: l.notes })),
        fulfillment,
        payment_method: payment,
        customer_name: name,
        phone,
        address: fulfillment === 'delivery' ? address : undefined,
        scheduled_for: slot,
        notes,
        promo_code: promoCode.trim() || undefined,
        reward_id: reward?.id ?? null,
        client: Platform.OS === 'web' ? 'web' : 'native',
      });

      if (res.checkout_url && Platform.OS === 'web') {
        // web app: si va sulla pagina SumUp, che al termine riporta su /order/<id>
        await AsyncStorage.setItem(PENDING_PAYMENT_KEY, res.order_id);
        window.location.assign(res.checkout_url);
        return;
      }
      if (res.checkout_url) {
        // pagina di pagamento SumUp; al termine SumUp ci riporta su cordulsapp://order/<id>
        await WebBrowser.openAuthSessionAsync(res.checkout_url, Linking.createURL(`order/${res.order_id}`));
        const check = await callFunction<{ status: string; paid: boolean }>('verify-payment', { order_id: res.order_id })
          .catch(() => null);
        if (!check || check.status === 'payment_failed') {
          showAlert('Pagamento non completato', 'Il pagamento non è andato a buon fine. Puoi riprovare.');
          return;
        }
        // se è ancora "in attesa" (es. webhook in ritardo) la schermata ordine si aggiorna da sola
        if (check.paid) clear();
      } else {
        clear();
      }
      router.replace(`/order/${res.order_id}`);
    } catch (e) {
      showAlert('Ordine non inviato', (e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!settings.accepting_orders) {
    return (
      <Screen>
        <Card><Text style={{ fontWeight: '700', color: Colors.warning }}>Al momento non accettiamo ordini.</Text>
          {settings.opening_hours ? <Muted>{settings.opening_hours}</Muted> : null}</Card>
      </Screen>
    );
  }

  const fulfillmentOptions = [
    ...(settings.pickup_enabled ? [{ value: 'pickup' as const, label: '🛍️ Ritiro' }] : []),
    ...(settings.delivery_enabled ? [{ value: 'delivery' as const, label: '🛵 Consegna' }] : []),
  ];
  const paymentOptions = [
    { value: 'sumup' as const, label: '💳 Carta' },
    ...(settings.cash_enabled ? [{ value: 'cash' as const, label: fulfillment === 'delivery' ? '💶 Alla consegna' : '💶 Al ritiro' }] : []),
  ];

  return (
    <Screen>
      <Subtitle>{'Come vuoi ricevere l\'ordine?'}</Subtitle>
      <Segmented options={fulfillmentOptions} value={fulfillment} onChange={setFulfillment} />

      <Subtitle>Quando?</Subtitle>
      <Row style={{ flexWrap: 'wrap', marginBottom: Spacing.md }}>
        <Button title="Prima possibile" variant={slot === null ? 'primary' : 'secondary'} onPress={() => setSlot(null)} style={{ paddingVertical: 8, minHeight: 38 }} />
        {slots.map((d) => (
          <Button
            key={d.toISOString()}
            title={d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
            variant={slot === d.toISOString() ? 'primary' : 'secondary'}
            onPress={() => setSlot(d.toISOString())}
            style={{ paddingVertical: 8, paddingHorizontal: 14, minHeight: 38 }}
          />
        ))}
      </Row>

      <Subtitle>I tuoi dati</Subtitle>
      <Field label="Nome" value={name} onChangeText={setName} />
      <Field label="Telefono" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      {fulfillment === 'delivery' ? <Field label="Indirizzo di consegna" value={address} onChangeText={setAddress} placeholder="Via, numero civico, città, citofono" /> : null}
      <Field label="Note per il negozio" value={notes} onChangeText={setNotes} multiline maxLength={500} />
      <Field label="Codice promozionale" value={promoCode} onChangeText={(t) => setPromoCode(t.toUpperCase())} autoCapitalize="characters" />

      {settings.loyalty_enabled && rewards.length > 0 ? (
        <>
          <Subtitle>{`Tessera punti · ${balance} punti`}</Subtitle>
          {rewards.map((r) => {
            const usable = balance >= r.points_cost;
            const selected = reward?.id === r.id;
            return (
              <Card
                key={r.id}
                onPress={usable ? () => setRewardId(selected ? null : r.id) : undefined}
                style={[{ paddingVertical: Spacing.sm }, selected && { borderColor: Colors.primary, borderWidth: 2 }, !usable && { opacity: 0.5 }]}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '700', color: Colors.text }}>{selected ? '✓ ' : ''}{r.title}</Text>
                    <Muted>{usable ? `-${formatPrice(r.discount_cents)} · usa ${r.points_cost} punti` : `Servono ${r.points_cost} punti`}</Muted>
                  </View>
                </Row>
              </Card>
            );
          })}
        </>
      ) : null}

      <Subtitle>Pagamento</Subtitle>
      <Segmented options={paymentOptions} value={payment} onChange={setPayment} />

      <Card>
        {comboSaving > 0 ? (
          <Row style={{ justifyContent: 'space-between' }}><Muted>Risparmio combo</Muted><Text style={{ color: Colors.success }}>-{formatPrice(comboSaving)}</Text></Row>
        ) : null}
        <Row style={{ justifyContent: 'space-between', marginTop: comboSaving > 0 ? 4 : 0 }}><Muted>Subtotale</Muted><Text style={{ color: Colors.text }}>{formatPrice(subtotal)}</Text></Row>
        {reward ? (
          <Row style={{ justifyContent: 'space-between', marginTop: 4 }}><Muted>{reward.title}</Muted><Text style={{ color: Colors.success }}>-{formatPrice(rewardDiscount)}</Text></Row>
        ) : null}
        {fulfillment === 'delivery' ? (
          <Row style={{ justifyContent: 'space-between', marginTop: 4 }}><Muted>Consegna</Muted><Text style={{ color: Colors.text }}>{deliveryFee === 0 ? 'Gratis' : formatPrice(deliveryFee)}</Text></Row>
        ) : null}
        <Row style={{ justifyContent: 'space-between', marginTop: Spacing.sm }}>
          <Text style={{ fontWeight: '800', fontSize: 16, color: Colors.text }}>Totale stimato</Text>
          <Text style={{ fontWeight: '800', fontSize: 18, color: Colors.primary }}>{formatPrice(subtotal - rewardDiscount + deliveryFee)}</Text>
        </Row>
        <Muted style={{ marginTop: 4 }}>Eventuali sconti vengono applicati alla conferma.</Muted>
      </Card>

      {belowMinimum ? <Muted style={{ color: Colors.danger, marginBottom: Spacing.md }}>Ordine minimo per la consegna: {formatPrice(settings.delivery_min_order_cents)}</Muted> : null}

      <Button
        title={payment === 'sumup' ? 'Paga con carta' : 'Conferma ordine'}
        onPress={submit}
        loading={submitting}
        disabled={lines.length === 0 || belowMinimum || fulfillmentOptions.length === 0}
      />
    </Screen>
  );
}
