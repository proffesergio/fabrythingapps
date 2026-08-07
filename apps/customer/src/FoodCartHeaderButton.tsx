import { Text, TouchableOpacity } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { t, useFoodCart } from '@fabrything/core';

// Shown only on /food routes. The store cart and the food cart are separate,
// and putting both in the header at once would give the customer two "Cart"
// buttons with different contents and no way to tell them apart.
export function FoodCartHeaderButton() {
  const router = useRouter();
  const pathname = usePathname();
  const { totals } = useFoodCart();
  if (!pathname?.startsWith('/food')) return null;
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={t('foodCart', 'en')}
      onPress={() => router.push('/food/cart')}
      style={{ paddingHorizontal: 12, minHeight: 44, justifyContent: 'center' }}
    >
      <Text style={{ fontWeight: '600' }}>
        {t('foodCart', 'en')}
        {totals.itemCount > 0 ? ` (${totals.itemCount})` : ''}
      </Text>
    </TouchableOpacity>
  );
}
