import Ionicons from '@expo/vector-icons/Ionicons';
import { Redirect, router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Card, Muted, Screen, Subtitle } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { ACTIVE_STATUSES, formatPrice } from '@/lib/format';
import { supabase } from '@/lib/supabase';

const TILES: { title: string; hint: string; icon: keyof typeof Ionicons.glyphMap; href: Href }[] = [
  { title: 'Ordini', hint: 'Ordini in arrivo e stato', icon: 'receipt-outline', href: '/admin/orders' },
  { title: 'Prodotti', hint: 'Menu, prezzi e foto', icon: 'fast-food-outline', href: '/admin/products' },
  { title: 'Categorie', hint: 'Sezioni del menu', icon: 'albums-outline', href: '/admin/categories' },
  { title: 'Combo', hint: 'Menu combinati', icon: 'layers-outline', href: '/admin/combos' },
  { title: 'Promozioni', hint: 'Sconti, codici e banner', icon: 'pricetag-outline', href: '/admin/promotions' },
  { title: 'Tessera punti', hint: 'Clienti, punti e premi', icon: 'card-outline', href: '/admin/loyalty' },
  { title: 'Notifiche push', hint: 'Invia un messaggio a tutti', icon: 'notifications-outline', href: '/admin/notifications' },
  { title: 'Impostazioni', hint: 'Orari, consegna, pagamenti', icon: 'settings-outline', href: '/admin/settings' },
];

export default function AdminHome() {
  const { isAdmin, loading } = useAuth();
  const [stats, setStats] = useState({ active: 0, todayCount: 0, todayTotal: 0 });

  const load = useCallback(async () => {
    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
    const [{ count }, { data: today }] = await Promise.all([
      supabase.from('orders').select('id', { count: 'exact', head: true }).in('status', ACTIVE_STATUSES),
      supabase.from('orders').select('total_cents,status').gte('created_at', startOfDay.toISOString())
        .not('status', 'in', '(pending_payment,payment_failed,cancelled)'),
    ]);
    setStats({
      active: count ?? 0,
      todayCount: today?.length ?? 0,
      todayTotal: (today ?? []).reduce((s, o) => s + o.total_cents, 0),
    });
  }, []);

  useFocusEffect(useCallback(() => { if (isAdmin) load(); }, [isAdmin, load]));
  useEffect(() => {
    if (!isAdmin) return;
    const ch = supabase.channel('admin-dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [isAdmin, load]);

  if (!loading && !isAdmin) return <Redirect href="/" />;

  return (
    <Screen>
      <View style={{ flexDirection: 'row', gap: Spacing.md }}>
        <Card style={{ flex: 1 }} onPress={() => router.push('/admin/orders')}>
          <Muted>Ordini attivi</Muted>
          <Text style={{ fontSize: 28, fontWeight: '900', color: Colors.primary }}>{stats.active}</Text>
        </Card>
        <Card style={{ flex: 1 }}>
          <Muted>Oggi</Muted>
          <Text style={{ fontSize: 20, fontWeight: '900', color: Colors.text }}>{stats.todayCount} ordini</Text>
          <Muted>{formatPrice(stats.todayTotal)}</Muted>
        </Card>
      </View>
      <Card onPress={() => router.push('/admin/scan')} style={{ backgroundColor: Colors.primary, borderColor: Colors.primary }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md }}>
          <Ionicons name="qr-code-outline" size={26} color="#fff" />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16, fontWeight: '800', color: '#fff' }}>Scansiona tessera</Text>
            <Text style={{ color: '#fff', opacity: 0.85 }}>Aggiungi punti a un cliente in cassa</Text>
          </View>
        </View>
      </Card>
      <Subtitle>Gestione</Subtitle>
      {TILES.map((t) => (
        <Card key={t.title} onPress={() => router.push(t.href)}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md }}>
            <Ionicons name={t.icon} size={26} color={Colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: Colors.text }}>{t.title}</Text>
              <Muted>{t.hint}</Muted>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
          </View>
        </Card>
      ))}
    </Screen>
  );
}
