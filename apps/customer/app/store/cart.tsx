import { View, Text, FlatList, TouchableOpacity, Button, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useCart, t } from '@fabrything/core';

// Cart screen: variant-line items, quantity edit, remove, subtotal, empty
// state. Deliberately does NOT show a shipping figure here -- the backend has
// no shipping-quote endpoint (`StoreConfiguration.shipping_for` only runs
// inside `place_cod_order`, at the moment an order is actually created), so
// the only honest options are "guess" or "not yet known". Per the
// money-correctness rule (never recompute/estimate shipping client-side),
// this screen shows a fixed note instead of a number, and the *actual*
// shipping_amount/total_amount the server resolves is shown verbatim on the
// checkout screen's confirmation, straight from the place-order response.
export default function Cart() {
  const router = useRouter();
  const { lines, totals, updateQuantity, removeItem } = useCart();

  if (lines.length === 0) {
    return (
      <View style={{ flex: 1, padding: 24, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <Text>{t('emptyCart', 'en')}</Text>
        <Button title={t('continueShopping', 'en')} onPress={() => router.push('/store')} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={lines}
        keyExtractor={(l) => String(l.variantId)}
        renderItem={({ item }) => (
          <View style={{ flexDirection: 'row', padding: 12, borderBottomWidth: 1, borderColor: '#eee', gap: 12 }}>
            {item.image ? (
              <Image source={{ uri: item.image }} style={{ width: 56, height: 56, borderRadius: 8 }} />
            ) : (
              <View style={{ width: 56, height: 56, borderRadius: 8, backgroundColor: '#eee' }} />
            )}
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={{ fontSize: 16 }}>{item.productName}</Text>
              <Text style={{ color: '#8C7B6E' }}>
                {item.size} {item.color ? `· ${item.color}` : ''}
              </Text>
              <Text style={{ fontWeight: '600' }}>{item.unitPrice}</Text>
              <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={`decrease-${item.variantId}`}
                  onPress={() => updateQuantity(item.variantId, item.quantity - 1)}
                  style={{ borderWidth: 1, borderColor: '#eee', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 }}
                >
                  <Text>-</Text>
                </TouchableOpacity>
                <Text accessibilityLabel={`quantity-${item.variantId}`}>{item.quantity}</Text>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={`increase-${item.variantId}`}
                  onPress={() => updateQuantity(item.variantId, item.quantity + 1)}
                  style={{ borderWidth: 1, borderColor: '#eee', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 }}
                >
                  <Text>+</Text>
                </TouchableOpacity>
                <TouchableOpacity accessibilityRole="button" onPress={() => removeItem(item.variantId)}>
                  <Text style={{ color: '#E8452B' }}>{t('remove', 'en')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      />

      <View style={{ padding: 16, gap: 8, borderTopWidth: 1, borderColor: '#eee' }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text>{t('subtotal', 'en')}</Text>
          <Text>{totals.subtotal.toFixed(2)}</Text>
        </View>
        <Text style={{ color: '#8C7B6E' }}>{t('shippingCalculatedAtCheckout', 'en')}</Text>
        <Button title={t('proceedToCheckout', 'en')} onPress={() => router.push('/store/checkout')} />
      </View>
    </View>
  );
}
