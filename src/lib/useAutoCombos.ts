import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import type { CartLine } from './cart';
import { type ComboMatch, type ComboRule, findBestCombos } from './combos';
import { supabase } from './supabase';

/**
 * Combo che verranno applicate in automatico ai prodotti nel carrello.
 * È solo un'anteprima per il cliente: il server rifà lo stesso calcolo alla conferma.
 */
export function useAutoCombos(lines: CartLine[]) {
  const [rules, setRules] = useState<ComboRule[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});

  useFocusEffect(useCallback(() => {
    supabase
      .from('combos')
      .select('id,name,price_cents,combo_items(product_id,quantity,products(id,name))')
      .eq('available', true)
      .then(({ data }) => {
        const rows = (data ?? []) as unknown as {
          id: string; name: string; price_cents: number;
          combo_items: { product_id: string; quantity: number; products: { id: string; name: string } | null }[];
        }[];
        setRules(rows.map((c) => ({
          id: c.id, name: c.name, price_cents: c.price_cents,
          items: c.combo_items.map((i) => ({ product_id: i.product_id, quantity: i.quantity })),
        })));
        const n: Record<string, string> = {};
        rows.forEach((c) => c.combo_items.forEach((i) => { if (i.products) n[i.product_id] = i.products.name; }));
        setNames(n);
      });
  }, []));

  return useMemo(() => {
    const counts: Record<string, number> = {};
    const prices: Record<string, number> = {};
    for (const l of lines) {
      if (l.type !== 'product') continue;
      counts[l.id] = (counts[l.id] ?? 0) + l.quantity;
      prices[l.id] = l.price_cents;
    }
    const matches: ComboMatch[] = findBestCombos(counts, prices, rules);
    const saving = matches.reduce((s, m) => s + m.saving_cents * m.times, 0);
    const describe = (m: ComboMatch) =>
      m.combo.items.map((i) => `${i.quantity > 1 ? `${i.quantity}× ` : ''}${names[i.product_id] ?? ''}`).join(' + ');
    return { matches, saving, describe };
  }, [lines, rules, names]);
}
