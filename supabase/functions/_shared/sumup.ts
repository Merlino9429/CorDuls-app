// Integrazione SumUp Online Payments (Hosted Checkout).
// Riferimento: https://developer.sumup.com/online-payments/
// Variabili richieste: SUMUP_API_KEY (chiave segreta sk_...), SUMUP_MERCHANT_CODE.
import { env } from './clients.ts';

const SUMUP_API = 'https://api.sumup.com/v0.1';

export type SumUpStatus = 'PENDING' | 'PAID' | 'FAILED' | 'EXPIRED' | string;

export interface SumUpCheckout {
  id: string;
  status: SumUpStatus;
  amount: number;
  currency: string;
  checkout_reference: string;
  hosted_checkout_url?: string;
}

async function sumup<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${SUMUP_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${env('SUMUP_API_KEY')}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  if (!res.ok) {
    console.error('SumUp error', res.status, text);
    throw new Error(`SumUp ${res.status}: ${text}`);
  }
  return JSON.parse(text) as T;
}

export function createCheckout(opts: {
  reference: string;
  amountCents: number;
  description: string;
  webhookUrl: string;
  redirectUrl: string;
}): Promise<SumUpCheckout> {
  return sumup<SumUpCheckout>('/checkouts', {
    method: 'POST',
    body: JSON.stringify({
      checkout_reference: opts.reference,
      amount: opts.amountCents / 100,
      currency: 'EUR',
      merchant_code: env('SUMUP_MERCHANT_CODE'),
      description: opts.description,
      // SumUp invia qui la notifica di cambio stato (webhook)
      return_url: opts.webhookUrl,
      // dove viene riportato il cliente a pagamento concluso
      redirect_url: opts.redirectUrl,
      hosted_checkout: { enabled: true },
    }),
  });
}

export function getCheckout(id: string): Promise<SumUpCheckout> {
  return sumup<SumUpCheckout>(`/checkouts/${encodeURIComponent(id)}`);
}
