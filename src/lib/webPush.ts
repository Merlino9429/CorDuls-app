// Notifiche nella web app (Web Push). Su iPhone funzionano solo se il cliente
// ha aggiunto l'app alla schermata Home (iOS 16.4 o successivo).
import { Platform } from 'react-native';
import { supabase } from './supabase';

const VAPID_PUBLIC_KEY = process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY ?? '';

export type WebPushState = 'unsupported' | 'needs-install' | 'denied' | 'off' | 'on';

const isWeb = () => Platform.OS === 'web' && typeof window !== 'undefined' && typeof navigator !== 'undefined';

/** Anteprima su claude.ai: installazione e notifiche del browser non sono disponibili. */
export const isPreview = () => isWeb() && '__cdDemoOAuth' in globalThis;

export function isIos() {
  if (!isWeb()) return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function isStandalone() {
  if (!isWeb()) return false;
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function supported() {
  return isWeb() && !!VAPID_PUBLIC_KEY && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export async function registerServiceWorker() {
  if (!isWeb() || isPreview() || !('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register('/sw.js');
  } catch {
    return null;
  }
}

export async function webPushState(): Promise<WebPushState> {
  if (isPreview()) return 'unsupported';
  if (isIos() && !isStandalone()) return 'needs-install';
  if (!supported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  if (Notification.permission !== 'granted') return 'off';
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  return sub ? 'on' : 'off';
}

function keyToBytes(base64url: string) {
  const pad = '='.repeat((4 - (base64url.length % 4)) % 4);
  const raw = atob((base64url + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function saveSubscription(userId: string, sub: PushSubscription) {
  const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
  await supabase.from('web_push_subscriptions').upsert({
    endpoint: json.endpoint, user_id: userId, p256dh: json.keys.p256dh, auth: json.keys.auth,
    user_agent: navigator.userAgent.slice(0, 200),
  }, { onConflict: 'endpoint' });
}

/** Da chiamare dopo un tocco dell'utente: chiede il permesso e attiva le notifiche. */
export async function enableWebPush(userId: string): Promise<WebPushState> {
  if (!supported()) return isIos() && !isStandalone() ? 'needs-install' : 'unsupported';
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'off';
  const reg = (await registerServiceWorker()) ?? (await navigator.serviceWorker.ready);
  const sub = (await reg.pushManager.getSubscription())
    ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(VAPID_PUBLIC_KEY) }));
  await saveSubscription(userId, sub);
  return 'on';
}

/** All'avvio: se il permesso c'è già, aggiorna l'iscrizione (può cambiare nel tempo). */
export async function refreshWebPush(userId: string) {
  if (!supported() || Notification.permission !== 'granted') return;
  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription())
    ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(VAPID_PUBLIC_KEY) }));
  await saveSubscription(userId, sub);
}

/** Al logout: questo browser smette di ricevere le notifiche dell'utente. */
export async function disableWebPush() {
  if (!supported()) return;
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await supabase.from('web_push_subscriptions').delete().eq('endpoint', sub.endpoint);
  await sub.unsubscribe().catch(() => {});
}
