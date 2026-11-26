import * as Notifications from 'expo-notifications';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { Colors } from '@/constants/theme';
import { AuthProvider, useAuth } from '@/lib/auth';
import { CartProvider } from '@/lib/cart';
import { Loading } from '@/components/ui';
import { handleNotificationTap, registerForPush } from '@/lib/push';
import '@/lib/installPrompt';
import { refreshWebPush, registerServiceWorker } from '@/lib/webPush';

SplashScreen.preventAutoHideAsync().catch(() => {});

function PushBridge() {
  const { session, loading } = useAuth();
  const handledInitial = useRef(false);

  useEffect(() => {
    if (!loading) SplashScreen.hideAsync().catch(() => {});
  }, [loading]);

  // web app: service worker per le notifiche del browser
  useEffect(() => {
    if (Platform.OS === 'web') registerServiceWorker();
  }, []);

  // registra il token push (app) o l'iscrizione alle notifiche web quando l'utente è loggato
  useEffect(() => {
    if (!session?.user.id) return;
    if (Platform.OS === 'web') refreshWebPush(session.user.id).catch(() => {});
    else registerForPush(session.user.id);
  }, [session?.user.id]);

  // apertura dell'app toccando una notifica (solo iOS/Android)
  useEffect(() => {
    if (Platform.OS === 'web') return;
    if (!handledInitial.current) {
      handledInitial.current = true;
      const last = Notifications.getLastNotificationResponse();
      if (last) setTimeout(() => handleNotificationTap(last), 300);
    }
    const sub = Notifications.addNotificationResponseReceivedListener(handleNotificationTap);
    return () => sub.remove();
  }, []);

  return null;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <CartProvider>
        <PushBridge />
        <StatusBar style="dark" />
        <RootNavigator />
      </CartProvider>
    </AuthProvider>
  );
}

// Chi non ha fatto l'accesso vede solo accesso/registrazione (e l'informativa privacy);
// chi è già registrato entra direttamente nel menu.
function RootNavigator() {
  const { session, loading } = useAuth();
  if (loading) return <Loading />;
  const signedIn = !!session;
  return (
        <Stack
          screenOptions={{
            headerTintColor: Colors.primary,
            headerStyle: { backgroundColor: Colors.background },
            headerTitleStyle: { color: Colors.text, fontWeight: '700' },
            headerBackButtonDisplayMode: 'minimal',
            contentStyle: { backgroundColor: Colors.background },
          }}>
          <Stack.Protected guard={signedIn}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="product/[id]" options={{ title: '', presentation: 'modal' }} />
            <Stack.Screen name="combo/[id]" options={{ title: '', presentation: 'modal' }} />
            <Stack.Screen name="checkout" options={{ title: 'Checkout' }} />
            <Stack.Screen name="order/[id]" options={{ title: 'Ordine' }} />
            <Stack.Screen name="admin" options={{ headerShown: false }} />
          </Stack.Protected>
          <Stack.Protected guard={!signedIn}>
            <Stack.Screen name="login" options={{ headerShown: false }} />
          </Stack.Protected>
          <Stack.Screen name="privacy" options={{ title: 'Privacy' }} />
          <Stack.Screen name="auth/callback" options={{ headerShown: false }} />
        </Stack>
  );
}
