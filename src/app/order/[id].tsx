import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Text, View } from 'react-native';
import { OrderStatusBadge } from '@/components/OrderStatusBadge';
import { Button, Card, Loading, Muted, Row, Screen, Subtitle } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { callFunction } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { PENDING_PAYMENT_KEY, useCart } from '@/lib/cart';
import { formatDateTime, formatPrice, formatTime, STATUS_LABELS } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import type { Order, OrderStatus } from '@/lib/types';
import { showAlert } from '@/lib/alert';

const PICKUP_FLOW: OrderStatus[] = ['received', 'preparing', 'ready', 'completed'];
const DELIVERY_FLOW: OrderStatus[] = ['received', 'preparing', 'out_for_delivery', 'completed'];

export default function OrderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { isAdmin } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from('orders').select('*, order_items(*)').eq('id', id).maybeSingle();
    setOrder(data as Order);
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // ritorno dal pagamento: controlla subito lo stato su SumUp e, se pagato, svuota il carrello
  const { clear } = useCart();
  const autoChecked = useRef(false);
  useEffect(() => {
    if (!order || autoChecked.current) return;
    autoChecked.current = true;
    (async () => {
      if (order.status === 'pending_payment') {
        await callFunction('verify-payment', { order_id: order.id }).catch(() => null);
        await load();
      }
      const pending = await AsyncStorage.getItem(PENDING_PAYMENT_KEY);
      if (pending === order.id) {
        const { data } = await supabase.from('orders').select('paid,status').eq('id', order.id).single();
        if (data?.paid) clear();
        if (data && data.status !== 'pending_payment') await AsyncStorage.removeItem(PENDING_PAYMENT_KEY);
      }
    })();
  }, [order, load, clear]);

  useEffect(() => {
    const ch = supabase.channel(`order-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${id}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, load]);

  if (!order) return <Loading />;

  const flow = order.fulfillment === 'delivery' ? DELIVERY_FLOW : PICKUP_FLOW;
  const stepIndex = flow.indexOf(order.status);

  const setStatus = async (status: OrderStatus) => {
    setBusy(status);
    try {
      await callFunction('update-order-status', { order_id: order.id, status });
      await load();
    } catch (e) {
      showAlert('Errore', (e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const verify = async () => {
    setBusy('verify');
    try {
      await callFunction('verify-payment', { order_id: order.id });
      await load();
    } catch (e) {
      showAlert('Errore', (e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 26, fontWeight: '800', color: Colors.text }}>Ordine #{order.number}</Text>
        <OrderStatusBadge status={order.status} />
      </Row>
      <Muted>{formatDateTime(order.created_at)}</Muted>

      {stepIndex >= 0 ? (
        <Card style={{ marginTop: Spacing.lg }}>
          {flow.map((st, i) => (
            <Row key={st} style={{ paddingVertical: 6 }}>
              <View style={{ width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: i <= stepIndex ? Colors.primary : Colors.border }}>
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>{i < stepIndex ? '✓' : i + 1}</Text>
              </View>
              <Text style={{ color: i <= stepIndex ? Colors.text : Colors.textMuted, fontWeight: i === stepIndex ? '800' : '500' }}>{STATUS_LABELS[st]}</Text>
            </Row>
          ))}
        </Card>
      ) : null}

      {order.status === 'pending_payment' ? (
        <Card style={{ backgroundColor: '#FFF1E0', marginTop: Spacing.md }}>
          <Text style={{ fontWeight: '700', color: Colors.warning }}>Stiamo verificando il pagamento…</Text>
          <Muted>Se hai completato il pagamento, lo stato si aggiornerà a breve.</Muted>
          <Button title="Verifica ora" variant="secondary" onPress={verify} loading={busy === 'verify'} style={{ marginTop: Spacing.sm }} />
        </Card>
      ) : null}

      <Subtitle>Dettagli</Subtitle>
      <Card>
        <Text style={{ color: Colors.text, fontWeight: '700' }}>{order.fulfillment === 'delivery' ? '🛵 Consegna a domicilio' : '🛍️ Ritiro in negozio'}</Text>
        <Muted>{order.scheduled_for ? `Per le ${formatTime(order.scheduled_for)}` : 'Prima possibile'}</Muted>
        {order.address ? <Muted>📍 {order.address}</Muted> : null}
        <Muted>👤 {order.customer_name} · {order.phone}</Muted>
        <Muted>{order.payment_method === 'sumup' ? '💳 Carta' : '💶 Contanti'} · {order.paid ? 'Pagato' : 'Da pagare'}</Muted>
        {order.notes ? <Muted>📝 {order.notes}</Muted> : null}
      </Card>

      <Card>
        {order.order_items?.map((it) => (
          <View key={it.id} style={{ marginBottom: Spacing.sm }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text style={{ color: Colors.text, flex: 1 }}>{it.quantity}× {it.item_type === 'combo' ? '⭐ ' : ''}{it.name}</Text>
              <Text style={{ color: Colors.text }}>{formatPrice(it.unit_price_cents * it.quantity)}</Text>
            </Row>
            {it.notes ? <Muted>{it.notes}</Muted> : null}
          </View>
        ))}
        <View style={{ borderTopWidth: 1, borderTopColor: Colors.border, marginTop: Spacing.sm, paddingTop: Spacing.sm, gap: 2 }}>
          <Row style={{ justifyContent: 'space-between' }}><Muted>Subtotale</Muted><Muted>{formatPrice(order.subtotal_cents)}</Muted></Row>
          {order.discount_cents > 0 ? <Row style={{ justifyContent: 'space-between' }}><Muted>Sconto{order.promo_code ? ` (${order.promo_code})` : ''}</Muted><Muted>-{formatPrice(order.discount_cents)}</Muted></Row> : null}
          {order.reward_discount_cents > 0 ? <Row style={{ justifyContent: 'space-between' }}><Muted>⭐ {order.reward_title ?? 'Premio tessera'} ({order.points_redeemed} punti)</Muted><Muted>-{formatPrice(order.reward_discount_cents)}</Muted></Row> : null}
          {order.fulfillment === 'delivery' ? <Row style={{ justifyContent: 'space-between' }}><Muted>Consegna</Muted><Muted>{formatPrice(order.delivery_fee_cents)}</Muted></Row> : null}
          <Row style={{ justifyContent: 'space-between', marginTop: 4 }}>
            <Text style={{ fontWeight: '800', color: Colors.text }}>Totale</Text>
            <Text style={{ fontWeight: '800', color: Colors.primary }}>{formatPrice(order.total_cents)}</Text>
          </Row>
        </View>
      </Card>

      {isAdmin ? (
        <>
          <Subtitle>Gestione (admin)</Subtitle>
          <Button title={`📞 Chiama ${order.customer_name}`} variant="secondary" onPress={() => Linking.openURL(`tel:${order.phone}`)} style={{ marginBottom: Spacing.sm }} />
          {flow.filter((st) => st !== order.status).map((st) => (
            <Button key={st} title={`Segna come: ${STATUS_LABELS[st]}`} onPress={() => setStatus(st)} loading={busy === st} style={{ marginBottom: Spacing.sm }} />
          ))}
          {order.status !== 'cancelled' ? (
            <Button
              title="Annulla ordine"
              variant="danger"
              loading={busy === 'cancelled'}
              onPress={() => showAlert('Annullare l\'ordine?', order.paid ? 'Ricorda di rimborsare il cliente dalla dashboard SumUp.' : '', [
                { text: 'No', style: 'cancel' },
                { text: 'Sì, annulla', style: 'destructive', onPress: () => setStatus('cancelled') },
              ])}
            />
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}
