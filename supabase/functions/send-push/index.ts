// Solo admin: invia una notifica push a tutti gli utenti dell'app (es. nuova promo).
import { admin, requireAdmin } from '../_shared/clients.ts';
import { handler, HttpError, json } from '../_shared/http.ts';
import { sendToTokens, sendToWebSubscriptions } from '../_shared/push.ts';

Deno.serve(handler(async (req) => {
  const user = await requireAdmin(req);
  const { title, body, audience = 'all', data } = await req.json();
  if (typeof title !== 'string' || typeof body !== 'string' || !title.trim() || !body.trim()) {
    throw new HttpError('Titolo e messaggio sono obbligatori');
  }

  let userFilter: string[] | null = null;
  if (audience === 'customers') {
    const { data: customers } = await admin.from('profiles').select('id').eq('role', 'customer');
    userFilter = (customers ?? []).map((c) => c.id);
  }

  const tokens: string[] = [];
  for (let from = 0; ; from += 1000) {
    let q = admin.from('push_tokens').select('token').range(from, from + 999);
    if (userFilter) q = q.in('user_id', userFilter);
    const { data: page } = await q;
    tokens.push(...(page ?? []).map((r) => r.token));
    if (!page || page.length < 1000) break;
  }

  const subs: { endpoint: string; p256dh: string; auth: string }[] = [];
  for (let from = 0; ; from += 1000) {
    let q = admin.from('web_push_subscriptions').select('endpoint,p256dh,auth').range(from, from + 999);
    if (userFilter) q = q.in('user_id', userFilter);
    const { data: page } = await q;
    subs.push(...(page ?? []));
    if (!page || page.length < 1000) break;
  }

  const payload = {
    title: title.trim().slice(0, 100),
    body: body.trim().slice(0, 300),
    data: data && typeof data === 'object' ? data : { type: 'broadcast' },
  };
  const [sentApp, sentWeb] = await Promise.all([sendToTokens(tokens, payload), sendToWebSubscriptions(subs, payload)]);
  const sent = sentApp + sentWeb;
  await admin.from('notifications_log').insert({ title, body, audience, sent_count: sent, sent_by: user.id });
  return json({ ok: true, sent, total: tokens.length + subs.length });
}));
