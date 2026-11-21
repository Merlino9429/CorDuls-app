// Crea un ordine. I prezzi vengono SEMPRE ricalcolati qui dal database:
// il client invia solo id e quantità.
import { admin, env, requireUser } from '../_shared/clients.ts';
import { handler, HttpError, json } from '../_shared/http.ts';
import { notifyCustomer, notifyNewOrder } from '../_shared/orders.ts';
import { createCheckout } from '../_shared/sumup.ts';
import { balanceOf, refundRedemption } from '../_shared/loyalty.ts';
import { type ComboRule, findBestCombos, groupIntoCombos } from '../_shared/combos.ts';

interface CartLine {
  type: 'product' | 'combo';
  id: string;
  quantity: number;
  notes?: string;
}

interface Body {
  items: CartLine[];
  fulfillment: 'pickup' | 'delivery';
  payment_method: 'sumup' | 'cash';
  customer_name: string;
  phone: string;
  address?: string;
  scheduled_for?: string | null;
  notes?: string;
  promo_code?: string;
  reward_id?: string | null;
  /** 'web' per la web app: dopo il pagamento si torna sul sito invece che nell'app */
  client?: 'web' | 'native';
}

const clean = (s: unknown, max = 500) => (typeof s === 'string' ? s.trim().slice(0, max) : '');

Deno.serve(handler(async (req) => {
  const user = await requireUser(req);
  const body = (await req.json()) as Body;

  // ---- validazione input ----
  if (!Array.isArray(body.items) || body.items.length === 0 || body.items.length > 50) {
    throw new HttpError('Il carrello è vuoto');
  }
  for (const l of body.items) {
    if (!['product', 'combo'].includes(l.type) || typeof l.id !== 'string' ||
        !Number.isInteger(l.quantity) || l.quantity < 1 || l.quantity > 50) {
      throw new HttpError('Carrello non valido');
    }
  }
  if (!['pickup', 'delivery'].includes(body.fulfillment)) throw new HttpError('Modalità non valida');
  if (!['sumup', 'cash'].includes(body.payment_method)) throw new HttpError('Metodo di pagamento non valido');
  const customerName = clean(body.customer_name, 120);
  const phone = clean(body.phone, 40);
  const address = clean(body.address, 300);
  if (!customerName || !phone) throw new HttpError('Inserisci nome e telefono');
  if (body.fulfillment === 'delivery' && !address) throw new HttpError('Inserisci l\'indirizzo di consegna');

  let scheduledFor: string | null = null;
  if (body.scheduled_for) {
    const d = new Date(body.scheduled_for);
    if (isNaN(d.getTime()) || d.getTime() < Date.now() - 5 * 60_000) throw new HttpError('Orario non valido');
    scheduledFor = d.toISOString();
  }

  // ---- impostazioni negozio ----
  const { data: settings } = await admin.from('store_settings').select('*').eq('id', 1).single();
  if (!settings?.accepting_orders) throw new HttpError('Al momento non accettiamo ordini');
  if (body.fulfillment === 'pickup' && !settings.pickup_enabled) throw new HttpError('Il ritiro non è disponibile');
  if (body.fulfillment === 'delivery' && !settings.delivery_enabled) throw new HttpError('La consegna non è disponibile');
  if (body.payment_method === 'cash' && !settings.cash_enabled) throw new HttpError('Il pagamento alla consegna non è disponibile');

  // ---- prezzi dal DB ----
  const productIds = body.items.filter((l) => l.type === 'product').map((l) => l.id);
  const comboIds = body.items.filter((l) => l.type === 'combo').map((l) => l.id);
  const [{ data: products }, { data: combos }] = await Promise.all([
    productIds.length
      ? admin.from('products').select('id,name,price_cents,available').in('id', productIds)
      : Promise.resolve({ data: [] as { id: string; name: string; price_cents: number; available: boolean }[] }),
    comboIds.length
      ? admin.from('combos').select('id,name,price_cents,available').in('id', comboIds)
      : Promise.resolve({ data: [] as { id: string; name: string; price_cents: number; available: boolean }[] }),
  ]);
  const catalog = new Map<string, { name: string; price_cents: number; available: boolean }>();
  for (const p of products ?? []) catalog.set(`product:${p.id}`, p);
  for (const c of combos ?? []) catalog.set(`combo:${c.id}`, c);

  const lines = body.items.map((l) => {
    const item = catalog.get(`${l.type}:${l.id}`);
    if (!item || !item.available) throw new HttpError('Alcuni articoli non sono più disponibili. Aggiorna il carrello.');
    return {
      item_type: l.type,
      product_id: l.type === 'product' ? l.id : null,
      combo_id: l.type === 'combo' ? l.id : null,
      name: item.name,
      unit_price_cents: item.price_cents,
      quantity: l.quantity,
      notes: clean(l.notes, 200) || null,
    };
  });

  // ---- combo automatiche: i prodotti che formano una combo più conveniente vengono raggruppati ----
  const { data: comboRows } = await admin
    .from('combos')
    .select('id,name,price_cents,combo_items(product_id,quantity)')
    .eq('available', true);
  const rules: ComboRule[] = (comboRows ?? []).map((c) => ({
    id: c.id, name: c.name, price_cents: c.price_cents,
    items: (c.combo_items ?? []) as { product_id: string; quantity: number }[],
  }));
  const productLines = lines.filter((l) => l.item_type === 'product') as (typeof lines[number] & { product_id: string })[];
  const counts: Record<string, number> = {};
  const prices: Record<string, number> = {};
  for (const l of productLines) {
    counts[l.product_id] = (counts[l.product_id] ?? 0) + l.quantity;
    prices[l.product_id] = l.unit_price_cents;
  }
  const matches = findBestCombos(counts, prices, rules);
  const grouped = groupIntoCombos(productLines, matches);
  const finalLines = [
    ...grouped.comboLines.map((c) => ({
      item_type: 'combo' as const, product_id: null, combo_id: c.combo.id, name: c.combo.name,
      unit_price_cents: c.combo.price_cents, quantity: c.quantity, notes: c.notes,
    })),
    ...grouped.rest,
    ...lines.filter((l) => l.item_type === 'combo'),
  ];

  const subtotal = finalLines.reduce((s, l) => s + l.unit_price_cents * l.quantity, 0);

  // ---- promozioni ----
  const now = new Date().toISOString();
  const promoCode = clean(body.promo_code, 40).toUpperCase();
  let promoQuery = admin.from('promotions').select('*').eq('active', true).neq('discount_type', 'none')
    .or(`starts_at.is.null,starts_at.lte.${now}`)
    .or(`ends_at.is.null,ends_at.gte.${now}`);
  promoQuery = promoCode ? promoQuery.eq('code', promoCode) : promoQuery.is('code', null);
  const { data: promos } = await promoQuery;
  if (promoCode && !promos?.length) throw new HttpError('Codice promozionale non valido o scaduto');

  const discountOf = (p: { discount_type: string; discount_value: number }) =>
    p.discount_type === 'percent'
      ? Math.round((subtotal * Math.min(p.discount_value, 100)) / 100)
      : Math.min(p.discount_value, subtotal);
  let best: { id: string; discount: number } | null = null;
  for (const p of promos ?? []) {
    if (subtotal < p.min_order_cents) continue;
    const d = discountOf(p);
    if (!best || d > best.discount) best = { id: p.id, discount: d };
  }
  if (promoCode && !best) {
    throw new HttpError('Il codice richiede un ordine minimo più alto');
  }
  const discount = best?.discount ?? 0;

  // ---- consegna ----
  let deliveryFee = 0;
  if (body.fulfillment === 'delivery') {
    if (subtotal < settings.delivery_min_order_cents) {
      throw new HttpError(`Ordine minimo per la consegna: € ${(settings.delivery_min_order_cents / 100).toFixed(2)}`);
    }
    const free = settings.delivery_free_over_cents != null && subtotal >= settings.delivery_free_over_cents;
    deliveryFee = free ? 0 : settings.delivery_fee_cents;
  }

  // ---- tessera punti: premio scelto dal cliente ----
  let reward: { id: string; title: string; points_cost: number; discount_cents: number } | null = null;
  let rewardDiscount = 0;
  if (body.reward_id) {
    if (!settings.loyalty_enabled) throw new HttpError('La tessera punti non è attiva');
    const { data: r } = await admin.from('loyalty_rewards').select('id,title,points_cost,discount_cents,active')
      .eq('id', body.reward_id).maybeSingle();
    if (!r || !r.active) throw new HttpError('Premio non disponibile');
    const balance = await balanceOf(user.id);
    if (balance < r.points_cost) throw new HttpError(`Ti servono ${r.points_cost} punti, ne hai ${balance}`);
    reward = r;
    rewardDiscount = Math.min(r.discount_cents, subtotal - discount);
  }

  const total = subtotal - discount - rewardDiscount + deliveryFee;
  if (body.payment_method === 'sumup' && total < 100) throw new HttpError('Importo minimo per il pagamento con carta: € 1,00');

  // ---- salvataggio ----
  const { data: order, error: orderErr } = await admin.from('orders').insert({
    user_id: user.id,
    status: body.payment_method === 'cash' ? 'received' : 'pending_payment',
    fulfillment: body.fulfillment,
    payment_method: body.payment_method,
    subtotal_cents: subtotal,
    discount_cents: discount,
    delivery_fee_cents: deliveryFee,
    total_cents: total,
    promotion_id: best?.id ?? null,
    promo_code: promoCode || null,
    reward_id: reward?.id ?? null,
    reward_title: reward?.title ?? null,
    points_redeemed: reward?.points_cost ?? 0,
    reward_discount_cents: rewardDiscount,
    customer_name: customerName,
    phone,
    address: body.fulfillment === 'delivery' ? address : null,
    scheduled_for: scheduledFor,
    notes: clean(body.notes, 500) || null,
  }).select().single();
  if (orderErr || !order) throw orderErr ?? new Error('Ordine non creato');

  const { error: itemsErr } = await admin.from('order_items').insert(finalLines.map((l) => ({ ...l, order_id: order.id })));
  if (itemsErr) {
    await admin.from('orders').delete().eq('id', order.id);
    throw itemsErr;
  }

  // scala subito i punti del premio (restituiti se l'ordine viene annullato o non pagato)
  if (reward) {
    const { error: txErr } = await admin.from('loyalty_transactions').insert({
      user_id: user.id, points: -reward.points_cost, reason: 'redeem', order_id: order.id, note: reward.title,
    });
    if (txErr) {
      await admin.from('orders').delete().eq('id', order.id);
      throw txErr;
    }
  }

  // aggiorna i dati del profilo per i prossimi ordini
  await admin.from('profiles').update({
    full_name: customerName, phone, ...(address ? { address } : {}),
  }).eq('id', user.id);

  if (body.payment_method === 'cash') {
    await Promise.all([notifyNewOrder(order), notifyCustomer(order, 'received')]);
    return json({ order_id: order.id });
  }

  // ---- pagamento SumUp ----
  const fnBase = `${env('SUPABASE_URL')}/functions/v1`;
  try {
    const checkout = await createCheckout({
      reference: order.id,
      amountCents: total,
      description: `Cor Duls - Ordine #${order.number}`,
      webhookUrl: `${fnBase}/sumup-webhook`,
      redirectUrl: `${fnBase}/payment-return?order=${order.id}${body.client === 'web' ? '&web=1' : ''}`,
    });
    await admin.from('orders').update({ sumup_checkout_id: checkout.id }).eq('id', order.id);
    if (!checkout.hosted_checkout_url) throw new Error('hosted_checkout_url mancante');
    return json({ order_id: order.id, checkout_url: checkout.hosted_checkout_url });
  } catch (e) {
    console.error(e);
    await admin.from('orders').update({ status: 'payment_failed' }).eq('id', order.id);
    await refundRedemption(order);
    throw new HttpError('Impossibile avviare il pagamento. Riprova.', 502);
  }
}));
