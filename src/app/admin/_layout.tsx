import { Redirect, Stack } from 'expo-router';
import { Loading } from '@/components/ui';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/lib/auth';

// Tutte le schermate in /admin sono accessibili solo agli amministratori.
// (La vera protezione è lato server: RLS + controlli nelle Edge Functions.)
export default function AdminLayout() {
  const { isAdmin, loading } = useAuth();
  if (loading) return <Loading />;
  if (!isAdmin) return <Redirect href="/" />;
  return (
    <Stack
      screenOptions={{
        headerTintColor: Colors.primary,
        headerStyle: { backgroundColor: Colors.background },
        headerTitleStyle: { color: Colors.text, fontWeight: '700' },
        headerBackButtonDisplayMode: 'minimal',
        contentStyle: { backgroundColor: Colors.background },
      }}>
      <Stack.Screen name="orders" options={{ title: 'Ordini' }} />
      <Stack.Screen name="products" options={{ title: 'Prodotti' }} />
      <Stack.Screen name="product/[id]" options={{ title: 'Prodotto' }} />
      <Stack.Screen name="categories" options={{ title: 'Categorie' }} />
      <Stack.Screen name="combos" options={{ title: 'Combo' }} />
      <Stack.Screen name="combo/[id]" options={{ title: 'Combo' }} />
      <Stack.Screen name="promotions" options={{ title: 'Promozioni' }} />
      <Stack.Screen name="promotion/[id]" options={{ title: 'Promozione' }} />
      <Stack.Screen name="loyalty" options={{ title: 'Tessera punti' }} />
      <Stack.Screen name="customer/[id]" options={{ title: 'Cliente' }} />
      <Stack.Screen name="scan" options={{ title: 'Scansiona tessera' }} />
      <Stack.Screen name="reward/[id]" options={{ title: 'Premio' }} />
      <Stack.Screen name="notifications" options={{ title: 'Notifiche push' }} />
      <Stack.Screen name="settings" options={{ title: 'Impostazioni' }} />
    </Stack>
  );
}
