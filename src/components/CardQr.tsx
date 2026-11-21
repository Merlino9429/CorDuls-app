import { Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { cardQrValue } from '@/lib/card';

/** QR della tessera da mostrare alla cassa. */
export function CardQr({ cardNumber, size = 190 }: { cardNumber: string; size?: number }) {
  return (
    <View style={{ alignItems: 'center', backgroundColor: '#fff', borderRadius: Radius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border }}>
      <QRCode value={cardQrValue(cardNumber)} size={size} color={Colors.text} backgroundColor="#fff" ecl="M" quietZone={8} />
      <Text style={{ marginTop: Spacing.sm, fontSize: 18, fontWeight: '800', letterSpacing: 2, color: Colors.text, fontVariant: ['tabular-nums'] }}>{cardNumber}</Text>
      <Text style={{ marginTop: 2, fontSize: 13, color: Colors.textMuted, textAlign: 'center' }}>Mostra questo codice alla cassa per accumulare punti</Text>
    </View>
  );
}
