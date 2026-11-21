import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useEffect, useState } from 'react';
import { ImagePickerField } from '@/components/ImagePickerField';
import { Button, Field, Loading, Muted, Screen, Segmented, Subtitle, ToggleRow } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { callFunction } from '@/lib/api';
import { centsToInput, parsePrice } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import type { DiscountType, Promotion } from '@/lib/types';
import { showAlert } from '@/lib/alert';

/** "31/12/2026" -> ISO (fine giornata se endOfDay). Stringa vuota -> null. undefined se non valida. */
function parseDate(s: string, endOfDay = false): string | null | undefined {
  if (!s.trim()) return null;
  const m = s.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return undefined;
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), endOfDay ? 23 : 0, endOfDay ? 59 : 0);
  return isNaN(d.getTime()) ? undefined : d.toISOString();
}
const toDateInput = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '');

export default function EditPromotion() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const navigation = useNavigation();
  const [loaded, setLoaded] = useState(isNew);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [type, setType] = useState<DiscountType>('percent');
  const [value, setValue] = useState('');
  const [minOrder, setMinOrder] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [active, setActive] = useState(true);
  const [showInApp, setShowInApp] = useState(true);
  const [notify, setNotify] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    navigation.setOptions({ title: isNew ? 'Nuova promozione' : 'Modifica promozione' });
    if (isNew) return;
    supabase.from('promotions').select('*').eq('id', id).single().then(({ data }) => {
      const p = data as Promotion;
      if (p) {
        setTitle(p.title); setDescription(p.description ?? ''); setImageUrl(p.image_url); setCode(p.code ?? '');
        setType(p.discount_type);
        setValue(p.discount_type === 'fixed' ? centsToInput(p.discount_value) : String(p.discount_value));
        setMinOrder(p.min_order_cents ? centsToInput(p.min_order_cents) : '');
        setStartsAt(toDateInput(p.starts_at)); setEndsAt(toDateInput(p.ends_at));
        setActive(p.active); setShowInApp(p.show_in_app);
      }
      setLoaded(true);
    });
  }, [id, isNew, navigation]);

  if (!loaded) return <Loading />;

  const save = async () => {
    if (!title.trim()) { showAlert('Attenzione', 'Il titolo è obbligatorio.'); return; }
    let discountValue = 0;
    if (type === 'percent') {
      discountValue = parseInt(value, 10);
      if (!(discountValue > 0 && discountValue <= 100)) { showAlert('Attenzione', 'Percentuale tra 1 e 100.'); return; }
    } else if (type === 'fixed') {
      const c = parsePrice(value);
      if (!c) { showAlert('Attenzione', 'Inserisci l\'importo dello sconto.'); return; }
      discountValue = c;
    }
    const s = parseDate(startsAt), e = parseDate(endsAt, true);
    if (s === undefined || e === undefined) { showAlert('Attenzione', 'Date nel formato GG/MM/AAAA.'); return; }

    setSaving(true);
    const row = {
      title: title.trim(), description: description.trim() || null, image_url: imageUrl,
      code: code.trim().toUpperCase() || null, discount_type: type, discount_value: discountValue,
      min_order_cents: parsePrice(minOrder) ?? 0, starts_at: s, ends_at: e, active, show_in_app: showInApp,
    };
    const { error } = isNew
      ? await supabase.from('promotions').insert(row)
      : await supabase.from('promotions').update(row).eq('id', id);
    if (error) {
      setSaving(false);
      showAlert('Errore', error.message.includes('duplicate') ? 'Questo codice esiste già.' : error.message);
      return;
    }
    if (notify) {
      await callFunction('send-push', {
        title: `🎁 ${row.title}`,
        body: row.description ?? (row.code ? `Usa il codice ${row.code}` : 'Scoprila nell\'app!'),
        data: { type: 'broadcast' },
      }).catch((err) => showAlert('Notifica non inviata', (err as Error).message));
    }
    setSaving(false);
    router.back();
  };

  const remove = () => showAlert('Eliminare la promozione?', '', [
    { text: 'Annulla', style: 'cancel' },
    { text: 'Elimina', style: 'destructive', onPress: async () => { await supabase.from('promotions').delete().eq('id', id); router.back(); } },
  ]);

  return (
    <Screen>
      <ImagePickerField value={imageUrl} onChange={setImageUrl} folder="promotions" />
      <Field label="Titolo *" value={title} onChangeText={setTitle} placeholder="Es. Happy hour" />
      <Field label="Descrizione" value={description} onChangeText={setDescription} multiline />

      <Subtitle>Sconto</Subtitle>
      <Segmented value={type} onChange={setType} options={[
        { value: 'percent', label: '%' }, { value: 'fixed', label: '€' }, { value: 'none', label: 'Solo banner' },
      ]} />
      {type !== 'none' ? (
        <>
          <Field label={type === 'percent' ? 'Percentuale di sconto' : 'Sconto in €'} value={value} onChangeText={setValue} keyboardType="decimal-pad" />
          <Field label="Ordine minimo (€)" value={minOrder} onChangeText={setMinOrder} keyboardType="decimal-pad" placeholder="Nessuno" />
          <Field label="Codice promozionale" value={code} onChangeText={(t) => setCode(t.toUpperCase())} autoCapitalize="characters" placeholder="Vuoto = applicata in automatico" />
          <Muted style={{ marginTop: -Spacing.sm, marginBottom: Spacing.md }}>Senza codice lo sconto si applica automaticamente a tutti gli ordini idonei (viene scelto quello più conveniente).</Muted>
        </>
      ) : null}

      <Subtitle>Validità</Subtitle>
      <Field label="Dal (GG/MM/AAAA)" value={startsAt} onChangeText={setStartsAt} placeholder="Subito" />
      <Field label="Al (GG/MM/AAAA)" value={endsAt} onChangeText={setEndsAt} placeholder="Senza scadenza" />
      <ToggleRow label="Attiva" value={active} onChange={setActive} />
      <ToggleRow label="Mostra nella sezione Promo" hint="Disattiva per codici riservati" value={showInApp} onChange={setShowInApp} />
      <ToggleRow label="Invia notifica push a tutti" hint="Annuncia la promo dopo il salvataggio" value={notify} onChange={setNotify} />

      <Button title="Salva" onPress={save} loading={saving} style={{ marginTop: Spacing.lg }} />
      {!isNew ? <Button title="Elimina promozione" variant="ghost" onPress={remove} style={{ marginTop: Spacing.sm }} /> : null}
    </Screen>
  );
}
