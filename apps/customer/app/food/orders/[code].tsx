import { useCallback, useEffect, useState } from 'react';
import { Linking, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { FoodOrder, StoreApiError, t, theme, trackFoodOrder } from '@fabrything/core';
import { api } from '../../../src/providers';
import { ErrorView, LoadingView, SecondaryButton } from '../../../src/components/StateViews';

// The customer-visible half of the state machine. CANCELLED is deliberately
// absent: it is not a step on the way anywhere, so it is rendered as its own
// message rather than as a stalled progress bar.
const STEPS = ['PLACED', 'CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED'] as const;

const STEP_LABEL: Record<string, string> = {
  PLACED: 'Order placed',
  CONFIRMED: 'Confirmed',
  PREPARING: 'Being prepared',
  OUT_FOR_DELIVERY: 'On the way',
  DELIVERED: 'Delivered',
};

// The order moves through other people's hands (kitchen, then rider), so the
// screen has to poll — there is no client action that would trigger a refresh.
const POLL_MS = 15000;

export default function TrackFoodOrder() {
  const { code, phone } = useLocalSearchParams<{ code: string; phone?: string }>();
  const [order, setOrder] = useState<FoodOrder | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setOrder(await trackFoodOrder(api, String(code), phone ? String(phone) : undefined));
      setError(null);
    } catch (e) {
      setError((e as StoreApiError).message || t('somethingWrong', 'en'));
    }
  }, [code, phone]);

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  if (error && !order) return <ErrorView message={error} onRetry={load} />;
  if (!order) return <LoadingView />;

  const cancelled = order.status === 'CANCELLED';
  const reached = STEPS.indexOf(order.status as (typeof STEPS)[number]);

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
      <View>
        <Text style={{ fontSize: 20, fontWeight: '800', color: theme.light.text }}>
          #{order.order_code}
        </Text>
        <Text style={{ color: theme.light.muted }}>{order.restaurant_name}</Text>
      </View>

      {cancelled ? (
        <View
          accessibilityRole="alert"
          style={{ padding: 12, borderRadius: 8, backgroundColor: '#FDECEA' }}
        >
          <Text style={{ color: theme.light.primaryDeep, fontWeight: '600' }}>
            {t('orderCanceled', 'en')}
          </Text>
        </View>
      ) : (
        <View style={{ gap: 8 }}>
          <Text style={{ fontWeight: '700' }}>{t('orderStatus', 'en')}</Text>
          {STEPS.map((s, i) => {
            const done = reached >= i;
            return (
              <View key={s} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View
                  style={{
                    width: 14, height: 14, borderRadius: 7,
                    backgroundColor: done ? theme.light.primary : theme.light.line,
                  }}
                />
                <Text
                  accessibilityLabel={done ? `done-${s}` : `pending-${s}`}
                  style={{
                    color: done ? theme.light.text : theme.light.muted,
                    fontWeight: reached === i ? '700' : '400',
                  }}
                >
                  {STEP_LABEL[s]}
                </Text>
              </View>
            );
          })}
          {order.eta_minutes ? (
            <Text style={{ color: theme.light.muted, fontSize: 12 }}>
              {t('etaMinutes', 'en')}: ~{order.eta_minutes} min
            </Text>
          ) : null}
        </View>
      )}

      {order.rider_name ? (
        <View style={{ gap: 6, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: theme.light.line }}>
          <Text style={{ fontWeight: '700' }}>{t('yourRider', 'en')}</Text>
          <Text style={{ color: theme.light.text }}>{order.rider_name}</Text>
          {order.rider_phone ? (
            <SecondaryButton
              title={t('callRider', 'en')}
              onPress={() => Linking.openURL(`tel:${order.rider_phone}`)}
            />
          ) : null}
        </View>
      ) : null}

      <View style={{ gap: 6 }}>
        <Text style={{ fontWeight: '700' }}>{t('itemsLabel', 'en')}</Text>
        {order.items.map((it) => (
          <View key={it.id} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: theme.light.text, flex: 1 }}>
              {it.quantity} × {it.item_name}
            </Text>
            <Text style={{ color: theme.light.muted }}>৳{it.line_total}</Text>
          </View>
        ))}
      </View>

      <View style={{ gap: 4, borderTopWidth: 1, borderTopColor: theme.light.line, paddingTop: 10 }}>
        <Row label={t('subtotal', 'en')} value={`৳${order.subtotal}`} />
        {Number(order.discount) > 0 ? <Row label={t('discount', 'en')} value={`−৳${order.discount}`} /> : null}
        <Row label={t('deliveryFee', 'en')} value={`৳${order.delivery_fee}`} />
        {Number(order.tip) > 0 ? <Row label={t('tip', 'en')} value={`৳${order.tip}`} /> : null}
        <Row label={t('total', 'en')} value={`৳${order.total}`} strong />
        <Text style={{ color: theme.light.muted, fontSize: 12 }}>
          {order.payment_method} · {order.delivery_address}
        </Text>
      </View>
    </ScrollView>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text style={{ color: strong ? theme.light.text : theme.light.muted, fontWeight: strong ? '700' : '400' }}>
        {label}
      </Text>
      <Text style={{ fontWeight: strong ? '800' : '600', color: theme.light.text }}>{value}</Text>
    </View>
  );
}
