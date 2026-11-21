import type { OrderStatus, Promotion } from './types';

export const formatPrice = (cents: number) =>
  `€ ${(cents / 100).toFixed(2).replace('.', ',')}`;

/** "4,50" / "4.50" / "4" -> 450. Restituisce null se non valido. */
export function parsePrice(input: string): number | null {
  const n = Number(input.replace(',', '.').trim());
  if (!input.trim() || !Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

export const centsToInput = (cents: number | null | undefined) =>
  cents == null ? '' : (cents / 100).toFixed(2).replace('.', ',');

export const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString('it-IT', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });

export const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

export const STATUS_LABELS: Record<OrderStatus, string> = {
  pending_payment: 'In attesa di pagamento',
  payment_failed: 'Pagamento non riuscito',
  received: 'Ricevuto',
  preparing: 'In preparazione',
  ready: 'Pronto',
  out_for_delivery: 'In consegna',
  completed: 'Completato',
  cancelled: 'Annullato',
};

export const STATUS_COLORS: Record<OrderStatus, string> = {
  pending_payment: '#D48A1A',
  payment_failed: '#C0392B',
  received: '#2D6CDF',
  preparing: '#8E44AD',
  ready: '#2E8B57',
  out_for_delivery: '#16A085',
  completed: '#7F8C8D',
  cancelled: '#C0392B',
};

export const ACTIVE_STATUSES: OrderStatus[] = ['received', 'preparing', 'ready', 'out_for_delivery'];

export function promoLabel(p: Pick<Promotion, 'discount_type' | 'discount_value'>) {
  if (p.discount_type === 'percent') return `-${p.discount_value}%`;
  if (p.discount_type === 'fixed') return `-${formatPrice(p.discount_value)}`;
  return null;
}
