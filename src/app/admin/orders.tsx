import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, Text, View } from 'react-native';
import { OrderStatusBadge } from '@/components/OrderStatusBadge';
import { Card, Empty, Muted, Row, Segmented } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { ACTIVE_STATUSES, formatPrice, formatTime } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import type { Order } from '@/lib/types';

type Filter = 'active' | 'done' | 'all';

export default function AdminOrders() {
  const [filter, setFilter] = useState<Filter>('active');
  const [orders, setOrders] = useState<Order[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    let q = supabase.from('orders').select('*, order_items(*)').order('created_at', { ascending: filter === 'active' }).limit(100);
    if (filter === 'active') q = q.in('status', ACTIVE_STATUSES);
    else if (filter === 'done') q = q.in('status', ['completed', 'cancelled']);
    else q = q.neq('status', 'pending_payment');
    const { data } = await q;
    setOrders((data as Order[]) ?? []);
  }, [filter]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    const ch = supabase.channel('admin-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  return (
    <FlatList
      style={{ backgroundColor: Colors.background }}
      contentContainerStyle={{ padding: Spacing.lg }}
      data={orders}
      keyExtractor={(o) => o.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
      ListHeaderComponent={
        <Segmented value={filter} onChange={setFilter} options={[
          { value: 'active', label: 'Attivi' }, { value: 'done', label: 'Conclusi' }, { value: 'all', label: 'Tutti' },
        ]} />
      }
      ListEmptyComponent={<Empty emoji="☕" text="Nessun ordine qui." />}
      renderItem={({ item: o }) => (
        <Card onPress={() => router.push(`/order/${o.id}`)}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 18, fontWeight: '900', color: Colors.text }}>#{o.number}</Text>
            <OrderStatusBadge status={o.status} />
          </Row>
          <Text style={{ color: Colors.text, fontWeight: '600', marginTop: 2 }}>
            {o.fulfillment === 'delivery' ? '🛵' : '🛍️'} {o.customer_name} · {o.scheduled_for ? `ore ${formatTime(o.scheduled_for)}` : 'prima possibile'}
          </Text>
          <View style={{ marginTop: Spacing.xs }}>
            {o.order_items?.map((i) => <Muted key={i.id}>{i.quantity}× {i.item_type === 'combo' ? '⭐ ' : ''}{i.name}{i.notes ? ` (${i.notes})` : ''}</Muted>)}
          </View>
          <Row style={{ justifyContent: 'space-between', marginTop: Spacing.xs }}>
            <Muted>Ricevuto alle {formatTime(o.created_at)} · {o.paid ? 'Pagato' : 'Da incassare'}</Muted>
            <Text style={{ fontWeight: '800', color: Colors.primary }}>{formatPrice(o.total_cents)}</Text>
          </Row>
        </Card>
      )}
    />
  );
}
