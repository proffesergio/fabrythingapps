import { FlatList, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { lineKey, t, theme, useFoodCart } from '@fabrything/core';
import {
  EmptyView,
  LoadingView,
  PrimaryButton,
  SecondaryButton,
  StepperButton,
} from '../../src/components/StateViews';

export default function FoodCartScreen() {
  const router = useRouter();
  const { lines, loading, totals, updateQuantity, removeItem } = useFoodCart();

  if (loading) return <LoadingView />;
  if (!lines.length) {
    return (
      <View style={{ flex: 1, gap: 16, padding: 24, justifyContent: 'center' }}>
        <EmptyView message={t('emptyFoodCart', 'en')} />
        <SecondaryButton
          title={t('browseRestaurants', 'en')}
          onPress={() => router.push('/food')}
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={lines}
        keyExtractor={(l) => lineKey(l)}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        renderItem={({ item }) => {
          const key = lineKey(item);
          const unit =
            Number(item.unitPrice) +
            item.optionLabels.reduce((s, o) => s + Number(o.price_delta), 0);
          return (
            <View
              style={{
                padding: 12, borderRadius: 10, gap: 6,
                borderWidth: 1, borderColor: theme.light.line, backgroundColor: theme.light.surface,
              }}
            >
              <Text style={{ fontWeight: '700', color: theme.light.text }}>{item.name}</Text>
              {item.optionLabels.length ? (
                <Text style={{ color: theme.light.muted, fontSize: 12 }}>
                  {item.optionLabels.map((o) => o.name).join(', ')}
                </Text>
              ) : null}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <StepperButton
                    label="−"
                    accessibilityLabel={`decrease-${key}`}
                    onPress={() => updateQuantity(key, item.quantity - 1)}
                  />
                  <Text accessibilityLabel={`quantity-${key}`} style={{ minWidth: 24, textAlign: 'center' }}>
                    {item.quantity}
                  </Text>
                  <StepperButton
                    label="+"
                    accessibilityLabel={`increase-${key}`}
                    onPress={() => updateQuantity(key, item.quantity + 1)}
                  />
                </View>
                <Text style={{ fontWeight: '700', color: theme.light.text }}>
                  ৳{(unit * item.quantity).toFixed(2)}
                </Text>
              </View>
              <SecondaryButton
                title={t('remove', 'en')}
                accessibilityLabel={`remove-${key}`}
                onPress={() => removeItem(key)}
              />
            </View>
          );
        }}
      />
      <View
        style={{
          padding: 16, gap: 10, borderTopWidth: 1,
          borderTopColor: theme.light.line, backgroundColor: theme.light.surface,
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ color: theme.light.muted }}>{t('subtotal', 'en')}</Text>
          <Text style={{ fontWeight: '700' }}>৳{totals.subtotal.toFixed(2)}</Text>
        </View>
        {/* Delivery is priced server-side from the destination, so it cannot be
            shown until checkout collects one. Saying so beats a blank line. */}
        <Text style={{ color: theme.light.muted, fontSize: 12 }}>
          {t('shippingCalculatedAtCheckout', 'en')}
        </Text>
        <PrimaryButton
          title={t('proceedToCheckout', 'en')}
          onPress={() => router.push('/food/checkout')}
        />
      </View>
    </View>
  );
}
