import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, Switch, Text, TextInput, View } from 'react-native';
import { Button, Card, Field, Muted, Row, Screen, styles } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import type { Category } from '@/lib/types';
import { showAlert } from '@/lib/alert';

export default function AdminCategories() {
  const [items, setItems] = useState<Category[]>([]);
  const [newName, setNewName] = useState('');

  const load = useCallback(async () => {
    const { data } = await supabase.from('categories').select('*').order('sort_order');
    setItems((data as Category[]) ?? []);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const add = async () => {
    if (!newName.trim()) return;
    const { error } = await supabase.from('categories').insert({ name: newName.trim(), sort_order: items.length + 1 });
    if (error) showAlert('Errore', error.message);
    setNewName('');
    load();
  };

  const update = async (id: string, patch: Partial<Category>) => {
    setItems((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    const { error } = await supabase.from('categories').update(patch).eq('id', id);
    if (error) { showAlert('Errore', error.message); load(); }
  };

  const move = async (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= items.length) return;
    const reordered = [...items];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    setItems(reordered);
    await Promise.all(reordered.map((c, i) => supabase.from('categories').update({ sort_order: i + 1 }).eq('id', c.id)));
  };

  const remove = (c: Category) => showAlert(`Eliminare "${c.name}"?`, 'I prodotti resteranno senza categoria.', [
    { text: 'Annulla', style: 'cancel' },
    { text: 'Elimina', style: 'destructive', onPress: async () => { await supabase.from('categories').delete().eq('id', c.id); load(); } },
  ]);

  return (
    <Screen>
      <Field label="Nuova categoria" value={newName} onChangeText={setNewName} placeholder="Es. Torte" onSubmitEditing={add} />
      <Button title="Aggiungi" onPress={add} style={{ marginBottom: Spacing.lg }} />
      {items.map((c, i) => (
        <Card key={c.id}>
          <Row>
            <TextInput
              defaultValue={c.name}
              onEndEditing={(e) => { const v = e.nativeEvent.text.trim(); if (v && v !== c.name) update(c.id, { name: v }); }}
              style={[styles.input, { flex: 1, paddingVertical: 8 }]}
            />
            <Pressable onPress={() => move(i, -1)} hitSlop={6}><Text style={{ fontSize: 18, color: Colors.primary }}>▲</Text></Pressable>
            <Pressable onPress={() => move(i, 1)} hitSlop={6}><Text style={{ fontSize: 18, color: Colors.primary }}>▼</Text></Pressable>
          </Row>
          <Row style={{ justifyContent: 'space-between', marginTop: Spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
              <Switch value={c.active} onValueChange={(v) => update(c.id, { active: v })} trackColor={{ true: Colors.primary }} />
              <Muted>{c.active ? 'Visibile' : 'Nascosta'}</Muted>
            </View>
            <Pressable onPress={() => remove(c)}><Text style={{ color: Colors.danger, fontWeight: '600' }}>Elimina</Text></Pressable>
          </Row>
        </Card>
      ))}
    </Screen>
  );
}
