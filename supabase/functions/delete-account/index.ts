// Il cliente cancella il proprio account (GDPR).
// Gli ordini restano per la contabilità, ma senza dati personali.
import { admin, requireUser } from '../_shared/clients.ts';
import { handler, json } from '../_shared/http.ts';

Deno.serve(handler(async (req) => {
  const user = await requireUser(req);
  await admin.from('orders')
    .update({ customer_name: 'Cliente eliminato', phone: '-', address: null, notes: null })
    .eq('user_id', user.id);
  // a cascata: profilo, tessera punti, token e iscrizioni alle notifiche
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) throw error;
  return json({ ok: true });
}));
