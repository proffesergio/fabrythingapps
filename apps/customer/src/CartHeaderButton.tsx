import { Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useCart, t } from '@fabrything/core';

// Persistent header action (wired in `app/_layout.tsx`) so the cart is
// reachable from every screen, not just the product pages -- part of closing
// the Task 2 navigation gap, since a cart with no way back to it is as
// unreachable as the store screens were before this task.
export function CartHeaderButton() {
  const router = useRouter();
  const { totals } = useCart();
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={t('cart', 'en')}
      onPress={() => router.push('/store/cart')}
      style={{ paddingHorizontal: 12, minHeight: 44, justifyContent: 'center' }}
    >
      <Text style={{ fontWeight: '600' }}>
        {t('cart', 'en')}
        {totals.itemCount > 0 ? ` (${totals.itemCount})` : ''}
      </Text>
    </TouchableOpacity>
  );
}
