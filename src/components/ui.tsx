import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput,
  View, type TextInputProps, type TextProps, type ViewStyle, type StyleProp,
} from 'react-native';
import { Colors, Radius, Spacing } from '@/constants/theme';

export function Screen({ children, scroll = true, style }: { children: ReactNode; scroll?: boolean; style?: StyleProp<ViewStyle> }) {
  if (!scroll) return <View style={[styles.screen, style]}>{children}</View>;
  return (
    <ScrollView style={styles.screen} contentContainerStyle={[styles.screenContent, style]} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  );
}

export function Title({ children }: { children: ReactNode }) {
  return <Text style={styles.title}>{children}</Text>;
}

export function Subtitle({ children }: { children: ReactNode }) {
  return <Text style={styles.subtitle}>{children}</Text>;
}

export function Muted({ children, style, ...props }: TextProps) {
  return <Text {...props} style={[styles.muted, style]}>{children}</Text>;
}

export function Card({ children, style, onPress }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }, style]}>
        {children}
      </Pressable>
    );
  }
  return <View style={[styles.card, style]}>{children}</View>;
}

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

export function Button({
  title, onPress, variant = 'primary', loading, disabled, style,
}: {
  title: string; onPress: () => void; variant?: ButtonVariant; loading?: boolean; disabled?: boolean; style?: StyleProp<ViewStyle>;
}) {
  const bg = { primary: Colors.primary, secondary: Colors.primarySoft, danger: Colors.danger, ghost: 'transparent' }[variant];
  const fg = variant === 'secondary' || variant === 'ghost' ? Colors.primary : '#fff';
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button, { backgroundColor: bg }, (disabled || loading) && { opacity: 0.5 }, pressed && { opacity: 0.8 }, style,
      ]}>
      {loading ? <ActivityIndicator color={fg} /> : <Text style={[styles.buttonText, { color: fg }]}>{title}</Text>}
    </Pressable>
  );
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={{ marginBottom: Spacing.md }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput placeholderTextColor={Colors.textMuted} {...props} style={[styles.input, props.multiline && { minHeight: 80, textAlignVertical: 'top' }, props.style]} />
    </View>
  );
}

export function ToggleRow({ label, value, onChange, hint }: { label: string; value: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <View style={styles.toggleRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.toggleLabel}>{label}</Text>
        {hint ? <Muted>{hint}</Muted> : null}
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: Colors.primary }} />
    </View>
  );
}

export function Segmented<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <View style={styles.segmented}>
      {options.map((o) => (
        <Pressable key={o.value} onPress={() => onChange(o.value)} style={[styles.segment, value === o.value && styles.segmentActive]}>
          <Text style={[styles.segmentText, value === o.value && { color: '#fff' }]}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function Badge({ label, color = Colors.primary }: { label: string; color?: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: `${color}22` }]}>
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

export function Thumb({ uri, size = 72, style }: { uri: string | null | undefined; size?: number; style?: object }) {
  return (
    <View style={[{ width: size, height: size, borderRadius: Radius.md, backgroundColor: Colors.primarySoft, overflow: 'hidden' }, style]}>
      {uri ? <Image source={{ uri }} style={{ width: '100%', height: '100%' }} contentFit="cover" transition={150} /> : (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: size / 2.6 }}>🧁</Text></View>
      )}
    </View>
  );
}

export function QuantityStepper({ value, onChange, min = 0 }: { value: number; onChange: (v: number) => void; min?: number }) {
  return (
    <View style={styles.stepper}>
      <Pressable onPress={() => onChange(Math.max(min, value - 1))} style={styles.stepBtn} hitSlop={8}><Text style={styles.stepText}>−</Text></Pressable>
      <Text style={styles.stepValue}>{value}</Text>
      <Pressable onPress={() => onChange(value + 1)} style={styles.stepBtn} hitSlop={8}><Text style={styles.stepText}>+</Text></Pressable>
    </View>
  );
}

export function Loading() {
  return <View style={styles.center}><ActivityIndicator color={Colors.primary} size="large" /></View>;
}

export function Empty({ emoji = '🍰', text, children }: { emoji?: string; text: string; children?: ReactNode }) {
  return (
    <View style={[styles.center, { padding: Spacing.xxl }]}>
      <Text style={{ fontSize: 48, marginBottom: Spacing.md }}>{emoji}</Text>
      <Text style={[styles.muted, { textAlign: 'center', marginBottom: Spacing.lg }]}>{text}</Text>
      {children}
    </View>
  );
}

export function Row({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }, style]}>{children}</View>;
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  screenContent: { padding: Spacing.lg, paddingBottom: Spacing.xxl * 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background },
  title: { fontSize: 26, fontWeight: '800', color: Colors.text, marginBottom: Spacing.md },
  subtitle: { fontSize: 18, fontWeight: '700', color: Colors.text, marginTop: Spacing.lg, marginBottom: Spacing.sm },
  muted: { fontSize: 14, color: Colors.textMuted },
  card: {
    backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: Spacing.md,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 1,
  },
  button: { borderRadius: Radius.pill, paddingVertical: 14, paddingHorizontal: Spacing.xl, alignItems: 'center', justifyContent: 'center', minHeight: 50 },
  buttonText: { fontSize: 16, fontWeight: '700' },
  label: { fontSize: 13, fontWeight: '600', color: Colors.textMuted, marginBottom: Spacing.xs },
  input: {
    backgroundColor: Colors.card, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.md, paddingVertical: 12, fontSize: 16, color: Colors.text,
  },
  toggleRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm, gap: Spacing.md },
  toggleLabel: { fontSize: 16, color: Colors.text, fontWeight: '500' },
  segmented: { flexDirection: 'row', backgroundColor: Colors.primarySoft, borderRadius: Radius.pill, padding: 4, marginBottom: Spacing.md },
  segment: { flex: 1, paddingVertical: 10, borderRadius: Radius.pill, alignItems: 'center' },
  segmentActive: { backgroundColor: Colors.primary },
  segmentText: { fontWeight: '700', color: Colors.primary },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.pill, alignSelf: 'flex-start' },
  badgeText: { fontSize: 12, fontWeight: '700' },
  stepper: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.primarySoft, borderRadius: Radius.pill },
  stepBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  stepText: { fontSize: 20, fontWeight: '700', color: Colors.primary },
  stepValue: { minWidth: 24, textAlign: 'center', fontSize: 16, fontWeight: '700', color: Colors.text },
});
