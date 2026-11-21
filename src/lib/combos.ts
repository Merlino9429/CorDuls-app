// Combo automatiche: trova le combo che fanno risparmiare il cliente
// in base ai prodotti nel carrello.
//
// ⚠️ Questo file è copiato identico in supabase/functions/_shared/combos.ts
// (il server ricalcola sempre i prezzi). Se lo modifichi, copialo anche lì:
// `npm run check:shared` verifica che le due copie coincidano.

export interface ComboRule {
  id: string;
  name: string;
  price_cents: number;
  items: { product_id: string; quantity: number }[];
}

export interface ComboMatch {
  combo: ComboRule;
  /** quante volte la combo viene applicata */
  times: number;
  /** prezzo dei singoli prodotti di UNA combo */
  regular_cents: number;
  /** risparmio di UNA combo rispetto ai prodotti singoli */
  saving_cents: number;
}

/**
 * Sceglie la combinazione di combo che dà il risparmio totale più alto.
 * Una combo si applica solo se costa meno dei suoi prodotti presi singolarmente.
 *
 * @param counts  quantità per prodotto nel carrello { product_id: quantità }
 * @param prices  prezzo attuale di ogni prodotto { product_id: centesimi }
 * @param combos  combo disponibili
 */
export function findBestCombos(
  counts: Record<string, number>,
  prices: Record<string, number>,
  combos: ComboRule[],
): ComboMatch[] {
  const useful = combos
    .filter((c) => c.items.length > 0 && c.items.every((i) => prices[i.product_id] != null && i.quantity > 0))
    .map((c) => {
      const regular = c.items.reduce((s, i) => s + prices[i.product_id] * i.quantity, 0);
      return { combo: c, regular, saving: regular - c.price_cents };
    })
    .filter((u) => u.saving > 0);
  if (useful.length === 0) return [];

  const ids = Object.keys(counts).filter((k) => counts[k] > 0).sort();
  const index = new Map(ids.map((id, i) => [id, i]));
  const start = ids.map((id) => counts[id]);

  const memo = new Map<string, { saving: number; picks: number[] }>();
  let budget = 20000; // limite di sicurezza per carrelli enormi

  const solve = (state: number[]): { saving: number; picks: number[] } => {
    const key = state.join(',');
    const cached = memo.get(key);
    if (cached) return cached;
    let best = { saving: 0, picks: [] as number[] };
    if (budget-- > 0) {
      for (let k = 0; k < useful.length; k++) {
        const items = useful[k].combo.items;
        const fits = items.every((i) => {
          const at = index.get(i.product_id);
          return at !== undefined && state[at] >= i.quantity;
        });
        if (!fits) continue;
        const next = state.slice();
        for (const i of items) next[index.get(i.product_id)!] -= i.quantity;
        const sub = solve(next);
        if (sub.saving + useful[k].saving > best.saving) {
          best = { saving: sub.saving + useful[k].saving, picks: [k, ...sub.picks] };
        }
      }
    }
    memo.set(key, best);
    return best;
  };

  const times = new Map<number, number>();
  for (const k of solve(start).picks) times.set(k, (times.get(k) ?? 0) + 1);
  return [...times.entries()].map(([k, t]) => ({
    combo: useful[k].combo,
    times: t,
    regular_cents: useful[k].regular,
    saving_cents: useful[k].saving,
  }));
}

export interface ProductLine {
  product_id: string;
  name: string;
  quantity: number;
  notes?: string | null;
}

/**
 * Trasforma le righe prodotto in righe combo + righe rimanenti.
 * Le note dei prodotti finiti dentro una combo vengono riportate sulla combo
 * (es. "Cappuccino: senza zucchero").
 */
export function groupIntoCombos<L extends ProductLine>(lines: L[], matches: ComboMatch[]) {
  // prima si usano le righe senza note, così le richieste particolari restano visibili
  const left = lines.map((l) => ({ line: l, qty: l.quantity }));
  const order = [...left].sort((a, b) => Number(!!a.line.notes) - Number(!!b.line.notes));
  const comboLines: { combo: ComboRule; quantity: number; notes: string | null }[] = [];

  for (const m of matches) {
    const notes: string[] = [];
    for (const item of m.combo.items) {
      let need = item.quantity * m.times;
      for (const slot of order) {
        if (need === 0) break;
        if (slot.line.product_id !== item.product_id || slot.qty === 0) continue;
        const take = Math.min(slot.qty, need);
        slot.qty -= take;
        need -= take;
        if (slot.line.notes) notes.push(`${slot.line.name}: ${slot.line.notes}`);
      }
    }
    comboLines.push({ combo: m.combo, quantity: m.times, notes: notes.length ? notes.join(' · ') : null });
  }

  const rest = left.filter((s) => s.qty > 0).map((s) => ({ ...s.line, quantity: s.qty }));
  return { comboLines, rest };
}
