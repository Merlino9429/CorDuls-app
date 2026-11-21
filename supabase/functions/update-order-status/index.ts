// Solo admin: cambia lo stato di un ordine e avvisa il cliente con una notifica push.
import { admin, requireAdmin } from '../_shared/clients.ts';
import { handler, HttpError, json } from '../_shared/http.ts';
import { notifyCustomer } from '../_shared/orders.ts';
import { awardPoints, refundRedemption, reverseAward } from '../_shared/loyalty.ts';

const ALLOWED = ['received', 'preparing', 'ready', 'out_for_delivery', 'completed', 'cancelled'];

Deno.serve(handler(async (req) => {
  await requireAdmin(req);
  const { order_id, status } = await req.json();
  if (!ALLOWED.includes(status)) throw new HttpError('Stato non valido');

  const { data: order, error } = await admin.from('orders').update({ status }).eq('id', order_id).select().single();
  if (error || !order) throw new HttpError('Ordine non trovato', 404);

  await notifyCustomer(order, status);
  if (status === 'completed') await awardPoints(order);
  if (status === 'cancelled') {
    await refundRedemption(order);
    await reverseAward(order);
  }
  return json({ ok: true, order });
}));
