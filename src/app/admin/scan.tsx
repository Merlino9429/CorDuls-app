import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { Button, Empty, Field, Muted, Screen } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { showAlert } from '@/lib/alert';
import { parseCardQr } from '@/lib/card';
import { supabase } from '@/lib/supabase';

/** Cassa: inquadra il QR della tessera e apre la scheda del cliente. */
export default function ScanCard() {
  const [permission, requestPermission] = useCameraPermissions();
  const [manual, setManual] = useState('');
  const busy = useRef(false);

  const openCard = async (card: string) => {
    const { data } = await supabase.from('profiles').select('id').eq('card_number', card).maybeSingle();
    if (data?.id) {
      router.replace(`/admin/customer/${data.id}`);
      return true;
    }
    showAlert('Tessera non trovata', `Nessun cliente con la tessera ${card}.`);
    return false;
  };

  const onScan = async ({ data }: BarcodeScanningResult) => {
    if (busy.current) return;
    busy.current = true;
    const card = parseCardQr(data);
    if (!card) {
      showAlert('QR non valido', 'Questo codice non è una tessera Cor Duls.', [{ text: 'OK', onPress: () => { busy.current = false; } }]);
      return;
    }
    const found = await openCard(card);
    if (!found) setTimeout(() => { busy.current = false; }, 1500);
  };

  const manualSearch = async () => {
    const card = parseCardQr(manual) ?? parseCardQr(`CD-${manual.replace(/\D/g, '')}`);
    if (!card) { showAlert('Numero non valido', 'Il numero di tessera ha il formato CD-12345678.'); return; }
    await openCard(card);
  };

  const manualEntry = (
    <View style={{ marginTop: Spacing.lg }}>
      <Field label="Oppure scrivi il numero di tessera" value={manual} onChangeText={setManual} placeholder="CD-12345678" autoCapitalize="characters" onSubmitEditing={manualSearch} />
      <Button title="Apri tessera" variant="secondary" onPress={manualSearch} />
    </View>
  );

  if (Platform.OS === 'web') {
    return (
      <Screen>
        <Empty emoji="📷" text="La scansione del QR funziona nell'app su telefono o tablet. Qui puoi cercare la tessera con il numero." />
        {manualEntry}
      </Screen>
    );
  }
  if (!permission) return <Screen>{manualEntry}</Screen>;
  if (!permission.granted) {
    return (
      <Screen>
        <Empty emoji="📷" text="Per leggere il QR delle tessere serve il permesso di usare la fotocamera.">
          <Button title="Consenti fotocamera" onPress={requestPermission} />
        </Empty>
        {manualEntry}
      </Screen>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <CameraView style={StyleSheet.absoluteFill} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={onScan} />
      <View style={s.overlay} pointerEvents="none">
        <View style={s.frame} />
        <Text style={s.hint}>Inquadra il QR sulla tessera del cliente</Text>
      </View>
      <View style={s.bottom}>
        <Muted style={{ color: '#fff', textAlign: 'center' }}>Si apre la scheda del cliente per aggiungere i punti</Muted>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  frame: { width: 240, height: 240, borderRadius: Radius.lg, borderWidth: 4, borderColor: Colors.primarySoft },
  hint: { color: '#fff', fontSize: 16, fontWeight: '700', marginTop: Spacing.lg, textShadowColor: '#000', textShadowRadius: 6 },
  bottom: { position: 'absolute', left: Spacing.lg, right: Spacing.lg, bottom: Spacing.xxl },
});
