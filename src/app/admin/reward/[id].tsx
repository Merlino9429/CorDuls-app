import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useEffect, useState } from 'react';
import { ImagePickerField } from '@/components/ImagePickerField';
import { Button, Field, Loading, Muted, Screen, ToggleRow } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { showAlert } from '@/lib/alert';
import { centsToInput, parsePrice } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import type { LoyaltyReward } from '@/lib/types';

export default function EditReward() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const navigation = useNavigation();
  const [loaded, setLoaded] = useState(isNew);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [cost, setCost] = useState('');
  const [discount, setDiscount] = useState('');
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    navigation.setOptions({ title: isNew ? 'Nuovo premio' : 'Modifica premio' });
    if (isNew) return;
    supabase.from('loyalty_rewards').select('*').eq('id', id).single().then(({ data }) => {
      const r = data as LoyaltyReward;
      if (r) {
        setTitle(r.title); setDescription(r.description ?? ''); setImageUrl(r.image_url);
        setCost(String(r.points_cost)); setDiscount(centsToInput(r.discount_cents)); setActive(r.active);
      }
      setLoaded(true);
    });
  }, [id, isNew, navigation]);

  if (!loaded) return <Loading />;

  const save = async () => {
    const points = parseInt(cost, 10);
    const cents = parsePrice(discount);
    if (!title.trim() || !(points > 0) || !cents) {
      showAlert('Attenzione', 'Titolo, punti necessari e valore dello sconto sono obbligatori.');
      return;
    }
    setSaving(true);
    const row = { title: title.trim(), description: description.trim() || null, image_url: imageUrl, points_cost: points, discount_cents: cents, active };
    const { error } = isNew
      ? await supabase.from('loyalty_rewards').insert(row)
      : await supabase.from('loyalty_rewards').update(row).eq('id', id);
    setSaving(false);
    if (error) showAlert('Errore', error.message);
    else router.back();
  };

  const remove = () => showAlert('Eliminare il premio?', 'I punti già usati dai clienti non cambiano.', [
    { text: 'Annulla', style: 'cancel' },
    { text: 'Elimina', style: 'destructive', onPress: async () => { await supabase.from('loyalty_rewards').delete().eq('id', id); router.back(); } },
  ]);

  return (
    <Screen>
      <ImagePickerField value={imageUrl} onChange={setImageUrl} folder="rewards" />
      <Field label="Titolo *" value={title} onChangeText={setTitle} placeholder="Es. Caffè omaggio" />
      <Field label="Descrizione" value={description} onChangeText={setDescription} multiline />
      <Field label="Punti necessari *" value={cost} onChangeText={setCost} keyboardType="number-pad" placeholder="50" />
      <Field label="Sconto sull'ordine (€) *" value={discount} onChangeText={setDiscount} keyboardType="decimal-pad" placeholder="1,20" />
      <Muted style={{ marginTop: -Spacing.sm, marginBottom: Spacing.md }}>Per un prodotto omaggio, imposta lo sconto uguale al suo prezzo.</Muted>
      <ToggleRow label="Attivo" hint="Se disattivato, i clienti non lo vedono" value={active} onChange={setActive} />
      <Button title="Salva" onPress={save} loading={saving} style={{ marginTop: Spacing.lg }} />
      {!isNew ? <Button title="Elimina premio" variant="ghost" onPress={remove} style={{ marginTop: Spacing.sm }} /> : null}
    </Screen>
  );
}
