import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Text } from 'react-native';
import { Button, Card, Field, Muted, Screen, Subtitle } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { callFunction } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { showAlert } from '@/lib/alert';

interface LogRow { id: string; title: string; body: string; sent_count: number; created_at: string }

export default function AdminNotifications() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [log, setLog] = useState<LogRow[]>([]);

  const load = useCallback(async () => {
    const { data } = await supabase.from('notifications_log').select('*').order('created_at', { ascending: false }).limit(20);
    setLog((data as LogRow[]) ?? []);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const send = () => {
    if (!title.trim() || !body.trim()) { showAlert('Attenzione', 'Titolo e messaggio sono obbligatori.'); return; }
    showAlert('Inviare a tutti?', 'La notifica arriverà a tutti i clienti con l\'app.', [
      { text: 'Annulla', style: 'cancel' },
      {
        text: 'Invia', onPress: async () => {
          setSending(true);
          try {
            const res = await callFunction<{ sent: number; total: number }>('send-push', { title, body, audience: 'all' });
            showAlert('Inviata!', `Dispositivi raggiunti: ${res.sent} su ${res.total}.`);
            setTitle(''); setBody('');
            load();
          } catch (e) {
            showAlert('Errore', (e as Error).message);
          } finally {
            setSending(false);
          }
        },
      },
    ]);
  };

  return (
    <Screen>
      <Field label="Titolo" value={title} onChangeText={setTitle} maxLength={100} placeholder="Es. Torte fresche appena sfornate! 🍰" />
      <Field label="Messaggio" value={body} onChangeText={setBody} multiline maxLength={300} placeholder="Es. Solo oggi -20% su tutte le crostate" />
      <Card style={{ backgroundColor: Colors.primarySoft }}>
        <Muted>Anteprima</Muted>
        <Text style={{ fontWeight: '800', color: Colors.text }}>{title || 'Titolo'}</Text>
        <Text style={{ color: Colors.text }}>{body || 'Messaggio'}</Text>
      </Card>
      <Button title="Invia notifica" onPress={send} loading={sending} />

      <Subtitle>Inviate di recente</Subtitle>
      {log.length === 0 ? <Muted>Nessuna notifica inviata.</Muted> : log.map((l) => (
        <Card key={l.id} style={{ marginBottom: Spacing.sm }}>
          <Text style={{ fontWeight: '700', color: Colors.text }}>{l.title}</Text>
          <Muted>{l.body}</Muted>
          <Muted>{formatDateTime(l.created_at)} · {l.sent_count} dispositivi</Muted>
        </Card>
      ))}
    </Screen>
  );
}
