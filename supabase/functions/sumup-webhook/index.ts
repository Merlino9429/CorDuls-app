// Webhook chiamato da SumUp quando cambia lo stato di un checkout.
// Non ci fidiamo del contenuto: rileggiamo sempre lo stato da SumUp (syncPayment).
import { admin } from '../_shared/clients.ts';
import { handler, json } from '../_shared/http.ts';
import { syncPayment } from '../_shared/orders.ts';

Deno.serve(handler(async (req) => {
  const payload = await req.json().catch(() => ({}));
  const checkoutId: string | undefined = payload?.id ?? payload?.checkout_id;
  if (!checkoutId) return json({ ok: true });

  const { data: order } = await admin.from('orders').select('id').eq('sumup_checkout_id', checkoutId).maybeSingle();
  if (order) await syncPayment(order.id);
  return json({ ok: true });
}));
