import { Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { t } from '@fabrything/core';

// Persistent header action reaching order history from anywhere in the app,
// the same navigation-gap fix Task 4 applied to the cart (see
// `CartHeaderButton.tsx`) -- a screen nothing links to is unreachable.
export function OrdersHeaderButton() {
  const router = useRouter();
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={t('myOrders', 'en')}
      onPress={() => router.push('/store/orders')}
      style={{ paddingHorizontal: 12, minHeight: 44, justifyContent: 'center' }}
    >
      <Text style={{ fontWeight: '600' }}>{t('myOrders', 'en')}</Text>
    </TouchableOpacity>
  );
}
