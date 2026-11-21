// Invio notifiche: servizio push di Expo (app iOS/Android) + Web Push (web app installata).
import webpush from 'npm:web-push@3.6.7';
import { admin } from './clients.ts';

const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC_KEY');
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY');
if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT') ?? 'mailto:info@corduls.it', VAPID_PUBLIC, VAPID_PRIVATE);
}

interface WebSub { endpoint: string; p256dh: string; auth: string }

/** Notifiche al browser (Android, computer, iPhone con l'app aggiunta alla Home). */
export async function sendToWebSubscriptions(subs: WebSub[], payload: PushPayload): Promise<number> {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE || subs.length === 0) return 0;
  const body = JSON.stringify({ title: payload.title, body: payload.body, data: payload.data ?? {} });
  const expired: string[] = [];
  let sent = 0;
  // a gruppi per non aprire troppe connessioni insieme
  for (let i = 0; i < subs.length; i += 50) {
    await Promise.all(subs.slice(i, i + 50).map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, { TTL: 60 * 60 * 12, urgency: 'high' });
        sent++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) expired.push(s.endpoint);
        else console.error('Web push non inviata', code, (e as Error).message);
      }
    }));
  }
  if (expired.length) await admin.from('web_push_subscriptions').delete().in('endpoint', expired);
  return sent;
}

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export async function sendToTokens(tokens: string[], payload: PushPayload): Promise<number> {
  const unique = [...new Set(tokens)].filter((t) => t.startsWith('ExponentPushToken') || t.startsWith('ExpoPushToken'));
  if (unique.length === 0) return 0;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  const accessToken = Deno.env.get('EXPO_ACCESS_TOKEN');
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  let sent = 0;
  const invalid: string[] = [];

  // Expo accetta al massimo 100 messaggi per richiesta
  for (let i = 0; i < unique.length; i += 100) {
    const chunk = unique.slice(i, i + 100);
    const messages = chunk.map((to) => ({
      to,
      title: payload.title,
      body: payload.body,
      data: payload.data ?? {},
      sound: 'default',
      channelId: 'default',
    }));
    try {
      const res = await fetch(EXPO_PUSH_URL, { method: 'POST', headers, body: JSON.stringify(messages) });
      const out = await res.json();
      const tickets: Array<{ status: string; details?: { error?: string } }> = out?.data ?? [];
      tickets.forEach((t, idx) => {
        if (t.status === 'ok') sent++;
        else if (t.details?.error === 'DeviceNotRegistered') invalid.push(chunk[idx]);
      });
    } catch (e) {
      console.error('Errore invio push', e);
    }
  }

  if (invalid.length) await admin.from('push_tokens').delete().in('token', invalid);
  return sent;
}

export async function sendToUsers(userIds: string[], payload: PushPayload): Promise<number> {
  if (userIds.length === 0) return 0;
  const [{ data: tokens }, { data: subs }] = await Promise.all([
    admin.from('push_tokens').select('token').in('user_id', userIds),
    admin.from('web_push_subscriptions').select('endpoint,p256dh,auth').in('user_id', userIds),
  ]);
  const [a, b] = await Promise.all([
    sendToTokens((tokens ?? []).map((r) => r.token), payload),
    sendToWebSubscriptions(subs ?? [], payload),
  ]);
  return a + b;
}

export async function sendToAdmins(payload: PushPayload): Promise<number> {
  const { data } = await admin.from('profiles').select('id').eq('role', 'admin');
  return sendToUsers((data ?? []).map((r) => r.id), payload);
}
