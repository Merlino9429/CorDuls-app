import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, Text } from 'react-native';
import { OrderStatusBadge } from '@/components/OrderStatusBadge';
import { Button, Card, Empty, Loading, Muted, Row } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { formatDateTime, formatPrice } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import type { Order } from '@/lib/types';

export default function OrdersScreen() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase.from('orders').select('*, order_items(*)').eq('user_id', userId)
      .order('created_at', { ascending: false }).limit(50);
    setOrders((data as Order[]) ?? []);
  }, [userId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // aggiornamenti in tempo reale dello stato
  useEffect(() => {
    if (!userId) return;
    const ch = supabase.channel(`my-orders-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `user_id=eq.${userId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId, load]);

  if (!session) {
    return (
      <Empty emoji="🧾" text="Accedi per vedere i tuoi ordini.">
        <Button title="Accedi" onPress={() => router.push('/login')} />
      </Empty>
    );
  }
  if (!orders) return <Loading />;

  return (
    <FlatList
      style={{ backgroundColor: Colors.background }}
      contentContainerStyle={{ padding: Spacing.lg }}
      data={orders}
      keyExtractor={(o) => o.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
      ListEmptyComponent={<Empty emoji="🧾" text="Non hai ancora fatto ordini." />}
      renderItem={({ item: o }) => (
        <Card onPress={() => router.push(`/order/${o.id}`)}>
          <Row style={{ justifyContent: 'space-between', marginBottom: Spacing.xs }}>
            <Text style={{ fontWeight: '800', fontSize: 16, color: Colors.text }}>Ordine #{o.number}</Text>
            <OrderStatusBadge status={o.status} />
          </Row>
          <Muted>{formatDateTime(o.created_at)} · {o.fulfillment === 'delivery' ? 'Consegna' : 'Ritiro'}</Muted>
          <Muted numberOfLines={1}>{o.order_items?.map((i) => `${i.quantity}× ${i.name}`).join(', ')}</Muted>
          <Text style={{ fontWeight: '800', color: Colors.primary, marginTop: Spacing.xs }}>{formatPrice(o.total_cents)}</Text>
        </Card>
      )}
    />
  );
}
