import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Colors, Spacing } from '@/constants/theme';
import { uploadImage } from '@/lib/api';
import { Thumb, styles } from './ui';
import { showAlert } from '@/lib/alert';

/** Campo foto per l'area admin: scegli dalla galleria → caricamento su Supabase Storage. */
export function ImagePickerField({ value, onChange, folder }: { value: string | null; onChange: (url: string | null) => void; folder: string }) {
  const [uploading, setUploading] = useState(false);

  const pick = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      showAlert('Permesso negato', 'Consenti l\'accesso alle foto dalle impostazioni del telefono.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setUploading(true);
    try {
      onChange(await uploadImage(asset.uri, folder, asset.mimeType));
    } catch (e) {
      showAlert('Errore', (e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={{ marginBottom: Spacing.md }}>
      <Text style={styles.label}>Foto</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md }}>
        <Thumb uri={value} size={96} />
        <View style={{ gap: Spacing.sm }}>
          <Pressable onPress={pick} disabled={uploading}>
            <Text style={{ color: Colors.primary, fontWeight: '700' }}>{uploading ? 'Caricamento…' : value ? 'Cambia foto' : 'Carica foto'}</Text>
          </Pressable>
          {value ? (
            <Pressable onPress={() => onChange(null)}>
              <Text style={{ color: Colors.danger, fontWeight: '600' }}>Rimuovi</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}
