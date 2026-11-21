import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { Logo } from '@/components/Logo';
import { canPromptInstall, onInstallAvailabilityChange, promptInstall } from '@/lib/installPrompt';
import { isIos, isPreview, isStandalone } from '@/lib/webPush';

const KEY = 'cd-install-banner-dismissed';
const read = () => { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } };

/** Invito ad aggiungere la web app alla schermata Home (solo nel browser, non quando è già installata). */
export function WebAppBanner() {
  const [dismissed, setDismissed] = useState(read);
  const [canInstall, setCanInstall] = useState(canPromptInstall);

  useEffect(() => onInstallAvailabilityChange(() => setCanInstall(canPromptInstall())), []);

  if (Platform.OS !== 'web' || dismissed || isStandalone() || isPreview()) return null;
  const ios = isIos();
  if (!ios && !canInstall) return null;

  const close = () => { setDismissed(true); try { localStorage.setItem(KEY, '1'); } catch { /* ignore */ } };

  return (
    <View style={{ backgroundColor: Colors.card, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, marginBottom: Spacing.lg, flexDirection: 'row', gap: Spacing.md, alignItems: 'center' }}>
      <Logo size={48} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontWeight: '800', color: Colors.text }}>Aggiungi Cor Duls alla Home</Text>
        {ios ? (
          <Text style={{ color: Colors.textMuted, fontSize: 13 }}>
            Tocca <Ionicons name="share-outline" size={13} color={Colors.textMuted} /> Condividi, poi «Aggiungi alla schermata Home». Così ricevi anche le notifiche.
          </Text>
        ) : (
          <Pressable onPress={async () => { if (await promptInstall()) close(); }}>
            <Text style={{ color: Colors.primary, fontWeight: '700', fontSize: 14 }}>Installa l&apos;app</Text>
          </Pressable>
        )}
      </View>
      <Pressable onPress={close} hitSlop={10} accessibilityLabel="Chiudi">
        <Ionicons name="close" size={20} color={Colors.textMuted} />
      </Pressable>
    </View>
  );
}
