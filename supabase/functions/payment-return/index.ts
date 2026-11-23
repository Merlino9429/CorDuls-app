// Pagina di ritorno dopo il pagamento SumUp: riporta il cliente nell'app.
import { syncPayment } from '../_shared/orders.ts';

const APP_SCHEME = Deno.env.get('APP_SCHEME') ?? 'cordulsapp';
// indirizzo della web app, es. https://corduls.it
const APP_WEB_URL = (Deno.env.get('APP_WEB_URL') ?? '').replace(/\/$/, '');
const UUID = /^[0-9a-f-]{36}$/i;

Deno.serve(async (req) => {
  const params = new URL(req.url).searchParams;
  const orderId = params.get('order') ?? '';
  const web = params.get('web') === '1' && APP_WEB_URL;
  if (UUID.test(orderId)) {
    try { await syncPayment(orderId); } catch (e) { console.error(e); }
  }
  const base = web ? APP_WEB_URL : `${APP_SCHEME}:/`;
  const target = UUID.test(orderId) ? `${base}/order/${orderId}` : `${base}/`;
  return new Response(null, { status: 302, headers: { Location: target } });
});
