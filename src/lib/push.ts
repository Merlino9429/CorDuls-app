import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { Platform } from 'react-native';
import { supabase } from './supabase';

// Mostra le notifiche anche quando l'app è aperta
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

let currentToken: string | null = null;

/** Chiede il permesso, ottiene il token Expo e lo salva per l'utente. */
export async function registerForPush(userId: string): Promise<string | null> {
  if (Platform.OS === 'web' || !Device.isDevice) return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Ordini e promozioni',
      // eslint-disable-next-line import/namespace -- riesportato da expo-notifications
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#B23A5B',
    });
  }

  const existing = await Notifications.getPermissionsAsync();
  let granted = existing.granted;
  if (!granted && existing.canAskAgain) {
    granted = (await Notifications.requestPermissionsAsync()).granted;
  }
  if (!granted) return null;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) {
    console.warn('projectId EAS mancante: esegui `npx eas-cli init` per abilitare le notifiche push');
    return null;
  }

  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await supabase.from('push_tokens').upsert(
      { token, user_id: userId, platform: Platform.OS, updated_at: new Date().toISOString() },
      { onConflict: 'token' },
    );
    currentToken = token;
    return token;
  } catch (e) {
    console.warn('Registrazione push non riuscita', e);
    return null;
  }
}

/** Da chiamare al logout: questo dispositivo smette di ricevere le notifiche dell'utente. */
export async function unregisterPush() {
  if (currentToken) await supabase.from('push_tokens').delete().eq('token', currentToken);
  currentToken = null;
}

/** Apre la schermata giusta quando l'utente tocca una notifica. */
export function handleNotificationTap(response: Notifications.NotificationResponse) {
  const data = response.notification.request.content.data as { type?: string; orderId?: string } | undefined;
  if (data?.orderId) router.push(`/order/${data.orderId}`);
  else if (data?.type === 'broadcast') router.push('/promo');
  else if (data?.type === 'loyalty') router.push('/tessera');
}
