import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text } from 'react-native';
import { ImagePickerField } from '@/components/ImagePickerField';
import { Button, Field, Loading, Row, Screen, ToggleRow, styles } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { centsToInput, parsePrice } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import type { Category, Product } from '@/lib/types';
import { showAlert } from '@/lib/alert';

export default function EditProduct() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const navigation = useNavigation();
  const [loaded, setLoaded] = useState(isNew);
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [allergens, setAllergens] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [available, setAvailable] = useState(true);
  const [featured, setFeatured] = useState(false);
  const [sortOrder, setSortOrder] = useState('0');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    navigation.setOptions({ title: isNew ? 'Nuovo prodotto' : 'Modifica prodotto' });
    supabase.from('categories').select('*').order('sort_order').then(({ data }) => setCategories((data as Category[]) ?? []));
    if (!isNew) {
      supabase.from('products').select('*').eq('id', id).single().then(({ data }) => {
        const p = data as Product;
        if (p) {
          setName(p.name); setDescription(p.description ?? ''); setPrice(centsToInput(p.price_cents));
          setAllergens(p.allergens ?? ''); setCategoryId(p.category_id); setImageUrl(p.image_url);
          setAvailable(p.available); setFeatured(p.featured); setSortOrder(String(p.sort_order));
        }
        setLoaded(true);
      });
    }
  }, [id, isNew, navigation]);

  if (!loaded) return <Loading />;

  const save = async () => {
    const cents = parsePrice(price);
    if (!name.trim() || cents == null) { showAlert('Attenzione', 'Nome e prezzo sono obbligatori.'); return; }
    setSaving(true);
    const row = {
      name: name.trim(), description: description.trim() || null, price_cents: cents,
      allergens: allergens.trim() || null, category_id: categoryId, image_url: imageUrl,
      available, featured, sort_order: parseInt(sortOrder, 10) || 0,
    };
    const { error } = isNew
      ? await supabase.from('products').insert(row)
      : await supabase.from('products').update(row).eq('id', id);
    setSaving(false);
    if (error) showAlert('Errore', error.message);
    else router.back();
  };

  const remove = () => showAlert('Eliminare il prodotto?', 'Verrà rimosso anche dalle combo.', [
    { text: 'Annulla', style: 'cancel' },
    {
      text: 'Elimina', style: 'destructive', onPress: async () => {
        const { error } = await supabase.from('products').delete().eq('id', id);
        if (error) showAlert('Errore', error.message); else router.back();
      },
    },
  ]);

  return (
    <Screen>
      <ImagePickerField value={imageUrl} onChange={setImageUrl} folder="products" />
      <Field label="Nome *" value={name} onChangeText={setName} />
      <Field label="Prezzo (€) *" value={price} onChangeText={setPrice} keyboardType="decimal-pad" placeholder="4,50" />
      <Field label="Descrizione" value={description} onChangeText={setDescription} multiline />
      <Field label="Allergeni" value={allergens} onChangeText={setAllergens} placeholder="Glutine, latte, uova…" />

      <Text style={styles.label}>Categoria</Text>
      <Row style={{ flexWrap: 'wrap', marginBottom: Spacing.md }}>
        {[{ id: null, name: 'Nessuna' } as { id: string | null; name: string }, ...categories].map((c) => (
          <Pressable key={c.id ?? 'none'} onPress={() => setCategoryId(c.id)}
            style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: categoryId === c.id ? Colors.primary : Colors.primarySoft }}>
            <Text style={{ color: categoryId === c.id ? '#fff' : Colors.primary, fontWeight: '600' }}>{c.name}</Text>
          </Pressable>
        ))}
      </Row>

      <Field label="Ordine di visualizzazione" value={sortOrder} onChangeText={setSortOrder} keyboardType="number-pad" />
      <ToggleRow label="Disponibile" hint="Se disattivato non compare nel menu" value={available} onChange={setAvailable} />
      <ToggleRow label="In evidenza" value={featured} onChange={setFeatured} />

      <Button title="Salva" onPress={save} loading={saving} style={{ marginTop: Spacing.lg }} />
      {!isNew ? <Button title="Elimina prodotto" variant="ghost" onPress={remove} style={{ marginTop: Spacing.sm }} /> : null}
    </Screen>
  );
}
