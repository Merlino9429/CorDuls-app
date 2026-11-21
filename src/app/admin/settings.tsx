import { useEffect, useState } from 'react';
import { Button, Field, Loading, Screen, Subtitle, ToggleRow } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { centsToInput, parsePrice } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import type { StoreSettings } from '@/lib/types';
import { showAlert } from '@/lib/alert';

export default function AdminSettings() {
  const [s, setS] = useState<StoreSettings | null>(null);
  const [fee, setFee] = useState('');
  const [minOrder, setMinOrder] = useState('');
  const [freeOver, setFreeOver] = useState('');
  const [prep, setPrep] = useState('');
  const [perEuro, setPerEuro] = useState('');
  const [welcome, setWelcome] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from('store_settings').select('*').eq('id', 1).single().then(({ data }) => {
      const st = data as StoreSettings;
      setS(st);
      if (st) {
        setFee(centsToInput(st.delivery_fee_cents));
        setMinOrder(centsToInput(st.delivery_min_order_cents));
        setFreeOver(centsToInput(st.delivery_free_over_cents));
        setPrep(String(st.prep_time_minutes));
        setPerEuro(String(st.points_per_euro ?? 1));
        setWelcome(String(st.loyalty_welcome_points ?? 0));
      }
    });
  }, []);

  if (!s) return <Loading />;
  const set = <K extends keyof StoreSettings>(k: K, v: StoreSettings[K]) => setS({ ...s, [k]: v });

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from('store_settings').update({
      store_name: s.store_name, address: s.address, phone: s.phone, opening_hours: s.opening_hours,
      accepting_orders: s.accepting_orders, pickup_enabled: s.pickup_enabled, delivery_enabled: s.delivery_enabled,
      cash_enabled: s.cash_enabled,
      delivery_fee_cents: parsePrice(fee) ?? 0,
      delivery_min_order_cents: parsePrice(minOrder) ?? 0,
      delivery_free_over_cents: parsePrice(freeOver),
      prep_time_minutes: parseInt(prep, 10) || 0,
      loyalty_enabled: s.loyalty_enabled,
      points_per_euro: Math.max(0, parseInt(perEuro, 10) || 0),
      loyalty_welcome_points: Math.max(0, parseInt(welcome, 10) || 0),
    }).eq('id', 1);
    setSaving(false);
    showAlert(error ? 'Errore' : 'Salvato', error ? error.message : 'Impostazioni aggiornate.');
  };

  return (
    <Screen>
      <ToggleRow label="Accetto ordini" hint="Disattiva per chiudere temporaneamente gli ordini" value={s.accepting_orders} onChange={(v) => set('accepting_orders', v)} />

      <Subtitle>Negozio</Subtitle>
      <Field label="Nome" value={s.store_name} onChangeText={(v) => set('store_name', v)} />
      <Field label="Indirizzo" value={s.address ?? ''} onChangeText={(v) => set('address', v)} />
      <Field label="Telefono" value={s.phone ?? ''} onChangeText={(v) => set('phone', v)} keyboardType="phone-pad" />
      <Field label="Orari" value={s.opening_hours ?? ''} onChangeText={(v) => set('opening_hours', v)} multiline placeholder="Lun–Sab 7:00–19:30" />
      <Field label="Tempo di preparazione (minuti)" value={prep} onChangeText={setPrep} keyboardType="number-pad" />

      <Subtitle>Ritiro e consegna</Subtitle>
      <ToggleRow label="Ritiro in negozio" value={s.pickup_enabled} onChange={(v) => set('pickup_enabled', v)} />
      <ToggleRow label="Consegna a domicilio" value={s.delivery_enabled} onChange={(v) => set('delivery_enabled', v)} />
      {s.delivery_enabled ? (
        <>
          <Field label="Costo consegna (€)" value={fee} onChangeText={setFee} keyboardType="decimal-pad" />
          <Field label="Ordine minimo per consegna (€)" value={minOrder} onChangeText={setMinOrder} keyboardType="decimal-pad" />
          <Field label="Consegna gratis sopra (€)" value={freeOver} onChangeText={setFreeOver} keyboardType="decimal-pad" placeholder="Mai" />
        </>
      ) : null}

      <Subtitle>Pagamenti</Subtitle>
      <ToggleRow label="Contanti al ritiro / alla consegna" hint="Il pagamento con carta (SumUp) è sempre attivo" value={s.cash_enabled} onChange={(v) => set('cash_enabled', v)} />

      <Subtitle>Tessera punti</Subtitle>
      <ToggleRow label="Tessera punti attiva" value={s.loyalty_enabled} onChange={(v) => set('loyalty_enabled', v)} />
      {s.loyalty_enabled ? (
        <>
          <Field label="Punti per ogni euro speso" value={perEuro} onChangeText={setPerEuro} keyboardType="number-pad" />
          <Field label="Punti di benvenuto alla registrazione" value={welcome} onChangeText={setWelcome} keyboardType="number-pad" />
        </>
      ) : null}

      <Button title="Salva impostazioni" onPress={save} loading={saving} style={{ marginTop: Spacing.lg }} />
    </Screen>
  );
}
