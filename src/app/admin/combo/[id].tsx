import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { ImagePickerField } from '@/components/ImagePickerField';
import { Button, Card, Field, Loading, Muted, QuantityStepper, Row, Screen, Subtitle, ToggleRow } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { centsToInput, formatPrice, parsePrice } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import type { Combo, Product } from '@/lib/types';
import { showAlert } from '@/lib/alert';

export default function EditCombo() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const navigation = useNavigation();
  const [loaded, setLoaded] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [available, setAvailable] = useState(true);
  const [sortOrder, setSortOrder] = useState('0');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    navigation.setOptions({ title: isNew ? 'Nuova combo' : 'Modifica combo' });
    (async () => {
      const { data: p } = await supabase.from('products').select('*').order('name');
      setProducts((p as Product[]) ?? []);
      if (!isNew) {
        const { data } = await supabase.from('combos').select('*, combo_items(product_id, quantity)').eq('id', id).single();
        const c = data as Combo;
        if (c) {
          setName(c.name); setDescription(c.description ?? ''); setPrice(centsToInput(c.price_cents));
          setImageUrl(c.image_url); setAvailable(c.available); setSortOrder(String(c.sort_order));
          setQty(Object.fromEntries((c.combo_items ?? []).map((ci) => [ci.product_id, ci.quantity])));
        }
      }
      setLoaded(true);
    })();
  }, [id, isNew, navigation]);

  if (!loaded) return <Loading />;

  const fullPrice = products.reduce((s, p) => s + (qty[p.id] ?? 0) * p.price_cents, 0);

  const save = async () => {
    const cents = parsePrice(price);
    const items = Object.entries(qty).filter(([, q]) => q > 0);
    if (!name.trim() || cents == null) { showAlert('Attenzione', 'Nome e prezzo sono obbligatori.'); return; }
    if (items.length === 0) { showAlert('Attenzione', 'Aggiungi almeno un prodotto alla combo.'); return; }
    setSaving(true);
    try {
      const row = { name: name.trim(), description: description.trim() || null, price_cents: cents, image_url: imageUrl, available, sort_order: parseInt(sortOrder, 10) || 0 };
      let comboId = id;
      if (isNew) {
        const { data, error } = await supabase.from('combos').insert(row).select('id').single();
        if (error) throw error;
        comboId = data.id;
      } else {
        const { error } = await supabase.from('combos').update(row).eq('id', id);
        if (error) throw error;
        await supabase.from('combo_items').delete().eq('combo_id', id);
      }
      const { error } = await supabase.from('combo_items').insert(items.map(([product_id, quantity]) => ({ combo_id: comboId, product_id, quantity })));
      if (error) throw error;
      router.back();
    } catch (e) {
      showAlert('Errore', (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const remove = () => showAlert('Eliminare la combo?', '', [
    { text: 'Annulla', style: 'cancel' },
    { text: 'Elimina', style: 'destructive', onPress: async () => { await supabase.from('combos').delete().eq('id', id); router.back(); } },
  ]);

  return (
    <Screen>
      <ImagePickerField value={imageUrl} onChange={setImageUrl} folder="combos" />
      <Field label="Nome *" value={name} onChangeText={setName} />
      <Field label="Prezzo combo (€) *" value={price} onChangeText={setPrice} keyboardType="decimal-pad" />
      {fullPrice > 0 ? <Muted style={{ marginTop: -Spacing.sm, marginBottom: Spacing.md }}>Prezzo dei singoli prodotti: {formatPrice(fullPrice)}</Muted> : null}
      <Field label="Descrizione" value={description} onChangeText={setDescription} multiline />
      <Field label="Ordine di visualizzazione" value={sortOrder} onChangeText={setSortOrder} keyboardType="number-pad" />
      <ToggleRow label="Disponibile" value={available} onChange={setAvailable} />
      <Muted style={{ marginBottom: Spacing.sm }}>Se un cliente mette nel carrello tutti i prodotti della combo, la combo viene applicata in automatico (solo se costa meno dei prodotti singoli).</Muted>

      <Subtitle>Prodotti inclusi</Subtitle>
      {products.map((p) => (
        <Card key={p.id} style={{ paddingVertical: Spacing.sm }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text style={{ flex: 1, color: Colors.text, fontWeight: (qty[p.id] ?? 0) > 0 ? '700' : '400' }}>{p.name}</Text>
            <QuantityStepper value={qty[p.id] ?? 0} onChange={(q) => setQty((prev) => ({ ...prev, [p.id]: q }))} />
          </Row>
        </Card>
      ))}

      <Button title="Salva" onPress={save} loading={saving} style={{ marginTop: Spacing.lg }} />
      {!isNew ? <Button title="Elimina combo" variant="ghost" onPress={remove} style={{ marginTop: Spacing.sm }} /> : null}
    </Screen>
  );
}
