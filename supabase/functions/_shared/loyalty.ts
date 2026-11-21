// Tessera punti: saldo, accrediti e rimborsi (sempre idempotenti grazie
// all'indice unico su (order_id, reason)).
import { admin } from './clients.ts';
import { sendToUsers } from './push.ts';

export async function balanceOf(userId: string): Promise<number> {
  const { data, error } = await admin.rpc('loyalty_balance', { uid: userId });
  if (error) throw error;
  return (data as number) ?? 0;
}

async function insertOnce(row: Record<string, unknown>): Promise<boolean> {
  const { error } = await admin.from('loyalty_transactions').insert(row);
  if (!error) return true;
  if (error.code === '23505') return false; // già registrato
  throw error;
}

interface OrderLike {
  id: string; number: number; user_id: string; total_cents: number; points_redeemed: number;
}

/** Ordine completato: accredita i punti guadagnati e avvisa il cliente. */
export async function awardPoints(order: OrderLike) {
  const { data: s } = await admin.from('store_settings').select('loyalty_enabled,points_per_euro').eq('id', 1).single();
  if (!s?.loyalty_enabled || !s.points_per_euro) return;
  const points = Math.floor(order.total_cents / 100) * s.points_per_euro;
  if (points <= 0) return;
  const added = await insertOnce({ user_id: order.user_id, points, reason: 'order', order_id: order.id, note: `Ordine #${order.number}` });
  if (added) {
    await sendToUsers([order.user_id], {
      title: `+${points} punti ⭐`,
      body: `Grazie per l'ordine #${order.number}! I punti sono già sulla tua tessera.`,
      data: { type: 'loyalty' },
    });
  }
}

/** Ordine annullato o non pagato: restituisce i punti usati per il premio. */
export async function refundRedemption(order: OrderLike) {
  if (!order.points_redeemed) return;
  await insertOnce({ user_id: order.user_id, points: order.points_redeemed, reason: 'refund', order_id: order.id, note: `Rimborso premio ordine #${order.number}` });
}

/** Ordine annullato dopo essere stato completato: toglie i punti accreditati. */
export async function reverseAward(order: OrderLike) {
  const { data: earned } = await admin.from('loyalty_transactions').select('points')
    .eq('order_id', order.id).eq('reason', 'order').maybeSingle();
  if (!earned) return;
  await insertOnce({ user_id: order.user_id, points: -earned.points, reason: 'reversal', order_id: order.id, note: `Storno ordine #${order.number}` });
}
