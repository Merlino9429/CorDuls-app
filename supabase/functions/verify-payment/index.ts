// Chiamata dall'app al rientro dalla pagina di pagamento.
import { admin, requireUser } from '../_shared/clients.ts';
import { handler, HttpError, json } from '../_shared/http.ts';
import { syncPayment } from '../_shared/orders.ts';

Deno.serve(handler(async (req) => {
  const user = await requireUser(req);
  const { order_id } = await req.json();
  const { data: order } = await admin.from('orders').select('id,user_id').eq('id', order_id).maybeSingle();
  if (!order || order.user_id !== user.id) throw new HttpError('Ordine non trovato', 404);
  const updated = await syncPayment(order.id);
  return json({ status: updated?.status, paid: updated?.paid });
}));
