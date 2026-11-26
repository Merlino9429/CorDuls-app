// Email di benvenuto, inviata una sola volta al primo accesso del cliente
// (dopo la conferma dell'email o la registrazione con Google).
// Segreto richiesto: RESEND_API_KEY (Resend → API keys, permesso "Sending access").
import { admin, requireUser } from '../_shared/clients.ts';
import { handler, json } from '../_shared/http.ts';

const FROM = Deno.env.get('WELCOME_FROM') ?? 'Cor Duls <info@corduls.it>';
const SITE = (Deno.env.get('APP_WEB_URL') ?? 'https://corduls.it').replace(/\/$/, '');

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

function welcomeHtml(o: { name: string; card: string; points: number; perEuro: number; address: string | null; hours: string | null; enabled: boolean }) {
  const loyalty = o.enabled ? `
    <div style="background:#A9458F;border-radius:16px;padding:20px;color:#ffffff;margin:0 0 24px">
      <div style="font-size:12px;letter-spacing:1px;opacity:.85">LA TUA TESSERA PUNTI</div>
      <div style="font-size:22px;font-weight:bold;letter-spacing:2px;margin:6px 0">${esc(o.card)}</div>
      <div style="font-size:15px">${o.points > 0 ? `Ti abbiamo già regalato <b>${o.points} punti</b> di benvenuto. ` : ''}Guadagni ${o.perEuro} ${o.perEuro === 1 ? 'punto' : 'punti'} per ogni euro speso e li usi per sconti e prodotti omaggio.</div>
    </div>` : '';
  const shop = o.address || o.hours ? `
    <p style="font-size:14px;line-height:1.5;color:#76605A;margin:0 0 4px">${o.address ? `📍 ${esc(o.address)}` : ''}</p>
    <p style="font-size:14px;line-height:1.5;color:#76605A;margin:0 0 16px">${o.hours ? `🕒 ${esc(o.hours)}` : ''}</p>` : '';
  return `<div style="background:#FBF8F2;padding:32px 16px;font-family:Helvetica,Arial,sans-serif;color:#2B1611">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:18px;padding:32px 24px;border:1px solid #EADFD6">
    <img src="${SITE}/icons/icon-192.png" width="96" height="96" alt="Cor Duls" style="display:block;margin:0 auto 16px">
    <h1 style="margin:0 0 8px;font-size:24px;text-align:center">Benvenuto${o.name ? `, ${esc(o.name)}` : ''}! 💛</h1>
    <p style="font-size:15px;line-height:1.5;color:#76605A;text-align:center;margin:0 0 24px">Che bello averti con noi. Da oggi puoi ordinare i nostri dolci dall'app, scegliere se ritirarli in negozio o riceverli a casa, e non perderti nessuna promozione.</p>
    ${loyalty}
    <p style="text-align:center;margin:0 0 24px"><a href="${SITE}" style="background:#A9458F;color:#ffffff;text-decoration:none;font-weight:bold;padding:14px 32px;border-radius:999px;display:inline-block">Ordina ora</a></p>
    <p style="font-size:14px;line-height:1.5;color:#2B1611;margin:0 0 4px"><b>Consiglio:</b> aggiungi Cor Duls alla schermata Home del telefono, così la apri come un'app e ricevi le notifiche quando il tuo ordine è pronto.</p>
    <p style="font-size:13px;line-height:1.5;color:#76605A;margin:0 0 20px">iPhone: Safari → Condividi → Aggiungi alla schermata Home · Android: menu del browser → Installa app</p>
    ${shop}
    <p style="font-size:14px;line-height:1.5;color:#2B1611;margin:0">A presto,<br>lo staff di Cor Duls</p>
  </div>
  <p style="font-size:12px;color:#76605A;text-align:center;margin:16px 0 0">Cor Duls · Voglia di dolce · Lodi<br>Ricevi questa email perché ti sei registrato su <a href="${SITE}" style="color:#76605A">${SITE.replace('https://', '')}</a>.</p>
</div>`;
}

Deno.serve(handler(async (req) => {
  const user = await requireUser(req);
  const apiKey = Deno.env.get('RESEND_API_KEY');
  if (!apiKey) return json({ sent: false, reason: 'not_configured' });

  // "prenota" l'invio: solo la prima chiamata passa (evita doppioni)
  const { data: claimed } = await admin.from('profiles')
    .update({ welcome_sent_at: new Date().toISOString() })
    .eq('id', user.id).is('welcome_sent_at', null)
    .select('full_name, card_number, email').maybeSingle();
  if (!claimed) return json({ sent: false, reason: 'already_sent' });

  const email = claimed.email ?? user.email;
  const release = () => admin.from('profiles').update({ welcome_sent_at: null }).eq('id', user.id);
  if (!email) { await release(); return json({ sent: false, reason: 'no_email' }); }

  const { data: s } = await admin.from('store_settings')
    .select('address, opening_hours, loyalty_enabled, loyalty_welcome_points, points_per_euro').eq('id', 1).single();
  const firstName = (claimed.full_name ?? '').trim().split(/\s+/)[0] ?? '';

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: FROM,
      to: [email],
      subject: 'Benvenuto da Cor Duls! 💛',
      html: welcomeHtml({
        name: firstName, card: claimed.card_number, points: s?.loyalty_welcome_points ?? 0,
        perEuro: s?.points_per_euro ?? 1, address: s?.address ?? null, hours: s?.opening_hours ?? null,
        enabled: s?.loyalty_enabled ?? true,
      }),
    }),
  });
  if (!res.ok) {
    console.error('Resend', res.status, await res.text());
    await release(); // riproverà al prossimo accesso
    return json({ sent: false, reason: 'send_failed' }, 502);
  }
  return json({ sent: true });
}));
