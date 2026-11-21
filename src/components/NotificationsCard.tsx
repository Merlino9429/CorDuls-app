import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Platform, Text } from 'react-native';
import { Button, Card, Muted } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { showAlert } from '@/lib/alert';
import { enableWebPush, webPushState, type WebPushState } from '@/lib/webPush';

/** Nella web app: attiva le notifiche del browser (ordini pronti, punti, promozioni). */
export function NotificationsCard({ userId }: { userId: string }) {
  const [state, setState] = useState<WebPushState>('unsupported');
  const [busy, setBusy] = useState(false);

  useFocusEffect(useCallback(() => {
    if (Platform.OS === 'web') webPushState().then(setState).catch(() => setState('unsupported'));
  }, []));

  if (Platform.OS !== 'web' || state === 'unsupported' || state === 'on') return null;

  const enable = async () => {
    setBusy(true);
    try {
      const next = await enableWebPush(userId);
      setState(next);
      if (next === 'on') showAlert('Notifiche attive', 'Ti avviseremo quando il tuo ordine è pronto e quando ci sono nuove promozioni.');
    } catch (e) {
      showAlert('Notifiche non attivate', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card style={{ backgroundColor: Colors.primarySoft, borderColor: Colors.primarySoft, marginTop: Spacing.md }}>
      <Text style={{ fontWeight: '800', color: Colors.text }}>🔔 Notifiche</Text>
      {state === 'needs-install' ? (
        <Muted style={{ marginTop: 4 }}>Su iPhone le notifiche funzionano con l&apos;app aggiunta alla schermata Home: tocca Condividi e poi «Aggiungi alla schermata Home», quindi apri Cor Duls dall&apos;icona.</Muted>
      ) : state === 'denied' ? (
        <Muted style={{ marginTop: 4 }}>Hai bloccato le notifiche per questo sito. Puoi riattivarle dalle impostazioni del browser.</Muted>
      ) : (
        <>
          <Muted style={{ marginTop: 4, marginBottom: Spacing.sm }}>Ricevi un avviso quando l&apos;ordine è pronto, quando guadagni punti e quando ci sono promozioni.</Muted>
          <Button title="Attiva notifiche" onPress={enable} loading={busy} />
        </>
      )}
    </Card>
  );
}
