import { Image } from 'expo-image';
import type { StyleProp, ImageStyle } from 'react-native';

/** Logo ufficiale Cor Duls (tondo, sfondo trasparente). */
export function Logo({ size = 48, style }: { size?: number; style?: StyleProp<ImageStyle> }) {
  return (
    <Image
      source={require('@/assets/images/logo.png')}
      style={[{ width: size, height: size }, style]}
      contentFit="contain"
      accessibilityLabel="Cor Duls - Voglia di dolce"
    />
  );
}
