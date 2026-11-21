import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router/tabs';
import { View, type ColorValue } from 'react-native';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { useCart } from '@/lib/cart';
import { useHostBadgeInset } from '@/lib/webOverlay';

type IconName = keyof typeof Ionicons.glyphMap;
function icon(name: IconName) {
  return function TabIcon({ color, size }: { color: ColorValue; size: number }) {
    return <Ionicons name={name} color={color as string} size={size} />;
  };
}

export default function TabsLayout() {
  const { count } = useCart();
  const { isAdmin } = useAuth();
  const badgeInset = useHostBadgeInset();
  return (
    <View style={{ flex: 1, paddingBottom: badgeInset, backgroundColor: Colors.card }}>
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarStyle: { backgroundColor: Colors.card, borderTopColor: Colors.border },
        headerStyle: { backgroundColor: Colors.background },
        headerTitleStyle: { color: Colors.text, fontWeight: '800' },
        headerShadowVisible: false,
        sceneStyle: { backgroundColor: Colors.background },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Menu', headerTitle: 'Cor Duls', tabBarIcon: icon('restaurant-outline') }} />
      <Tabs.Screen name="tessera" options={{ title: 'Tessera', headerTitle: 'Tessera punti', tabBarIcon: icon('card-outline') }} />
      <Tabs.Screen name="promo" options={{ title: 'Promozioni', href: null }} />
      <Tabs.Screen
        name="cart"
        options={{ title: 'Carrello', tabBarIcon: icon('bag-handle-outline'), tabBarBadge: count > 0 ? count : undefined, tabBarBadgeStyle: { backgroundColor: Colors.primary } }}
      />
      <Tabs.Screen name="orders" options={{ title: 'Ordini', tabBarIcon: icon('receipt-outline') }} />
      <Tabs.Screen name="profile" options={{ title: 'Profilo', tabBarIcon: icon('person-circle-outline') }} />
      <Tabs.Screen name="admin" options={{ title: 'Admin', href: isAdmin ? undefined : null, tabBarIcon: icon('settings-outline') }} />
    </Tabs>
    </View>
  );
}
