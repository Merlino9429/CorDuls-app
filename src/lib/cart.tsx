import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export interface CartLine {
  key: string;            // type:id:notes
  type: 'product' | 'combo';
  id: string;
  name: string;
  price_cents: number;    // solo per visualizzazione: il server ricalcola sempre
  image_url: string | null;
  quantity: number;
  notes?: string;
}

interface CartState {
  lines: CartLine[];
  count: number;
  subtotal: number;
  add: (line: Omit<CartLine, 'key' | 'quantity'>, quantity?: number) => void;
  setQuantity: (key: string, quantity: number) => void;
  clear: () => void;
}

const STORAGE_KEY = 'cor-duls-cart-v1';
/** Web app: ordine in attesa di pagamento SumUp (il carrello si svuota quando risulta pagato). */
export const PENDING_PAYMENT_KEY = 'cor-duls-pending-payment';
const CartContext = createContext<CartState | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => { if (raw) setLines(JSON.parse(raw)); })
      .catch(() => {})
      .finally(() => setHydrated(true));
  }, []);

  useEffect(() => {
    if (hydrated) AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(lines)).catch(() => {});
  }, [lines, hydrated]);

  const value = useMemo<CartState>(() => ({
    lines,
    count: lines.reduce((s, l) => s + l.quantity, 0),
    subtotal: lines.reduce((s, l) => s + l.quantity * l.price_cents, 0),
    add: (line, quantity = 1) => {
      const key = `${line.type}:${line.id}:${line.notes?.trim() ?? ''}`;
      setLines((prev) => {
        const existing = prev.find((l) => l.key === key);
        if (existing) return prev.map((l) => (l.key === key ? { ...l, quantity: Math.min(l.quantity + quantity, 50) } : l));
        return [...prev, { ...line, key, quantity }];
      });
    },
    setQuantity: (key, quantity) =>
      setLines((prev) => (quantity <= 0 ? prev.filter((l) => l.key !== key)
        : prev.map((l) => (l.key === key ? { ...l, quantity: Math.min(quantity, 50) } : l)))),
    clear: () => setLines([]),
  }), [lines]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart deve essere usato dentro CartProvider');
  return ctx;
}
