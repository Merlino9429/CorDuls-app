import { admin } from './clients.ts';
import { sendToAdmins, sendToUsers } from './push.ts';
import { getCheckout } from './sumup.ts';
import { refundRedemption } from './loyalty.ts';

export const STATUS_MESSAGES: Record<string, { title: string; body: string }> = {
  received: { title: 'Ordine ricevuto ✅', body: 'Abbiamo ricevuto il tuo ordine #{n}.' },
  preparing: { title: 'In preparazione 👩‍🍳', body: 'Stiamo preparando il tuo ordine #{n}.' },
  ready: { title: 'Pronto per il ritiro 🎉', body: 'Il tuo ordine #{n} è pronto! Ti aspettiamo.' },
  out_for_delivery: { title: 'In consegna 🛵', body: 'Il tuo ordine #{n} è in arrivo.' },
  completed: { title: 'Grazie! 💛', body: 'Ordine #{n} completato. Buon appetito!' },
  cancelled: { title: 'Ordine annullato', body: 'Il tuo ordine #{n} è stato annullato. Contattaci per info.' },
  payment_failed: { title: 'Pagamento non riuscito', body: 'Il pagamento dell\'ordine #{n} non è andato a buon fine.' },
};

export async function notifyCustomer(order: { id: string; number: number; user_id: string }, status: string) {
  const msg = STATUS_MESSAGES[status];
  if (!msg) return;
  await sendToUsers([order.user_id], {
    title: msg.title,
    body: msg.body.replace('{n}', String(order.number)),
    data: { type: 'order', orderId: order.id },
  });
}

export async function notifyNewOrder(order: { id: string; number: number; total_cents: number; fulfillment: string }) {
  await sendToAdmins({
    title: `Nuovo ordine #${order.number} 🔔`,
    body: `${order.fulfillment === 'delivery' ? 'Consegna' : 'Ritiro'} · € ${(order.total_cents / 100).toFixed(2).replace('.', ',')}`,
    data: { type: 'admin_order', orderId: order.id },
  });
}

/**
 * Controlla su SumUp lo stato del pagamento di un ordine e aggiorna il DB.
 * È idempotente: può essere chiamata dal webhook e dall'app più volte.
 */
export async function syncPayment(orderId: string) {
  const { data: order } = await admin.from('orders').select('*').eq('id', orderId).single();
  if (!order) return null;
  if (order.paid || !order.sumup_checkout_id) return order;

  const checkout = await getCheckout(order.sumup_checkout_id);
  const expected = order.total_cents / 100;

  if (checkout.status === 'PAID') {
    if (Math.abs(Number(checkout.amount) - expected) > 0.001 || checkout.checkout_reference !== order.id) {
      console.error('Importo/riferimento SumUp non corrispondente', { orderId, checkout });
      return order;
    }
    // update condizionale: solo la prima chiamata "vince" e invia le notifiche
    const { data: updated } = await admin
      .from('orders')
      .update({ paid: true, paid_at: new Date().toISOString(), status: 'received' })
      .eq('id', orderId)
      .eq('paid', false)
      .select()
      .maybeSingle();
    if (updated) {
      await Promise.all([notifyNewOrder(updated), notifyCustomer(updated, 'received')]);
      return updated;
    }
  } else if (checkout.status === 'FAILED' || checkout.status === 'EXPIRED') {
    const { data: updated } = await admin
      .from('orders')
      .update({ status: 'payment_failed' })
      .eq('id', orderId)
      .eq('status', 'pending_payment')
      .select()
      .maybeSingle();
    if (updated) {
      await refundRedemption(updated);
      return updated;
    }
  }

  const { data: fresh } = await admin.from('orders').select('*').eq('id', orderId).single();
  return fresh;
}
