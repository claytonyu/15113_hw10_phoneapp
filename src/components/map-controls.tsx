// Tappable map actions remain reachable even when map imagery is unavailable.
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { Pressable, Text } from 'react-native';

import { colors, spacing } from '@/constants/field-notes-theme';

/** Renders an icon with a visible label and a full-sized touch target. */
export function MapAction({
  icon, label, primary = false, disabled = false, onPress,
}: {
  icon: SymbolViewProps['name'];
  label: string;
  primary?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1, minHeight: 62, borderRadius: 16, borderCurve: 'continuous',
        justifyContent: 'center', alignItems: 'center', padding: spacing.small, gap: 3,
        backgroundColor: primary ? colors.accent : colors.surface,
        opacity: pressed || disabled ? 0.6 : 1,
      })}
    >
      <SymbolView name={icon} size={22} tintColor={colors.ink} />
      <Text style={{ color: colors.ink, fontWeight: '600', textAlign: 'center' }}>{label}</Text>
    </Pressable>
  );
}
