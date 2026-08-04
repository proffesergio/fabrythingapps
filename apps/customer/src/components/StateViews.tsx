import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { t, theme, useSlowRequestHint } from '@fabrything/core';

// Shared across the store/cart/checkout/orders screens so "loading",
// "failed", "empty" and "tappable" look and behave the same everywhere
// instead of five slightly different ad-hoc renderings.

// Apple/Android accessibility guidelines both land on ~44pt/dp as the
// minimum comfortable touch target; several of the original steppers and
// chips were well under that.
export const MIN_TAP_TARGET = 44;

export function LoadingView() {
  // Loading is always `true` here -- this only mounts while a screen has
  // nothing to show yet -- so the slow-request hint just needs a stable
  // `true` to time against.
  const slow = useSlowRequestHint(true);
  return (
    <View
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 }}
      accessibilityRole="progressbar"
    >
      <ActivityIndicator size="large" color={theme.light.primary} />
      {slow ? (
        <Text style={{ color: theme.light.muted, textAlign: 'center' }}>{t('slowRequestHint', 'en')}</Text>
      ) : null}
    </View>
  );
}

export function ErrorView({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View
      style={{ flex: 1, padding: 24, gap: 16, alignItems: 'flex-start', justifyContent: 'center' }}
      accessibilityRole="alert"
    >
      <Text style={{ color: theme.light.text, fontSize: 15 }}>{message}</Text>
      <PrimaryButton title={t('retry', 'en')} onPress={onRetry} accessibilityLabel={t('retry', 'en')} />
    </View>
  );
}

export function EmptyView({ message }: { message: string }) {
  return (
    <View style={{ flex: 1, padding: 24, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: theme.light.muted, textAlign: 'center' }}>{message}</Text>
    </View>
  );
}

export function PrimaryButton({
  title,
  onPress,
  disabled,
  accessibilityLabel,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{
        minHeight: MIN_TAP_TARGET,
        paddingHorizontal: 20,
        borderRadius: 8,
        backgroundColor: disabled ? theme.light.line : theme.light.primary,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: disabled ? theme.light.muted : '#fff', fontWeight: '600', fontSize: 15 }}>{title}</Text>
    </TouchableOpacity>
  );
}

export function SecondaryButton({
  title,
  onPress,
  accessibilityLabel,
}: {
  title: string;
  onPress: () => void;
  accessibilityLabel?: string;
}) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      onPress={onPress}
      style={{
        minHeight: MIN_TAP_TARGET,
        paddingHorizontal: 20,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: theme.light.primary,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: theme.light.primary, fontWeight: '600', fontSize: 15 }}>{title}</Text>
    </TouchableOpacity>
  );
}

// Compact +/- stepper used by the cart line and the product-detail quantity
// picker. `count` label is exposed via `accessibilityLabel` on request
// since the callers need distinct labels per cart line (e.g.
// `decrease-${variantId}`) to keep existing tests' `getByLabelText` lookups
// unambiguous when a list has more than one line.
export function StepperButton({
  label,
  accessibilityLabel,
  onPress,
  disabled,
}: {
  label: string;
  accessibilityLabel: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{
        minWidth: MIN_TAP_TARGET,
        minHeight: MIN_TAP_TARGET,
        borderWidth: 1,
        borderColor: theme.light.line,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <Text style={{ fontSize: 18 }}>{label}</Text>
    </TouchableOpacity>
  );
}
