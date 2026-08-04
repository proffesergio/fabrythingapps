import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import {
  FOOD_STATUS,
  fetchVendorOrders,
  forwardStatus,
  setVendorOrderStatus,
  StoreApiError,
  t,
  theme,
  VendorOrder,
} from '@fabrything/core';
import { api } from '../src/providers';

// Vendor-facing wording for each forward step. The step itself comes from the
// shared status machine, which mirrors the server's ALLOWED_TRANSITIONS — so a
// button is only ever offered for a transition the server would actually take.
const ACTION_LABEL: Record<string, string> = {
  [FOOD_STATUS.CONFIRMED]: 'acceptOrder',
  [FOOD_STATUS.PREPARING]: 'startPreparing',
  [FOOD_STATUS.OUT_FOR_DELIVERY]: 'readyForPickup',
};

// New orders sit at the top; a vendor's whole job on this screen is reacting to
// PLACED. Orders already out for delivery are informational.
const PRIORITY: Record<string, number> = {
  PLACED: 0, CONFIRMED: 1, PREPARING: 2, OUT_FOR_DELIVERY: 3,
};

export default function OrdersScreen() {
  const [orders, setOrders] = useState<VendorOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const list = await fetchVendorOrders(api);
      setOrders(
        [...list].sort(
          (a, b) => (PRIORITY[a.status] ?? 9) - (PRIORITY[b.status] ?? 9),
        ),
      );
    } catch (e) {
      setError((e as StoreApiError).message || t('somethingWrong'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const advance = async (order: VendorOrder) => {
    const next = forwardStatus(order.status);
    if (!next) return;
    setBusyId(order.id);
    try {
      await setVendorOrderStatus(api, order.id, next);
      await load();
    } catch (e) {
      const err = e as StoreApiError;
      setError(err.errors?.[0] || err.message || t('transitionFailed'));
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <ActivityIndicator style={{ marginTop: 40 }} accessibilityLabel={t('incomingOrders')} />;

  return (
    <FlatList
      data={orders}
      keyExtractor={(o) => String(o.id)}
      contentContainerStyle={{ padding: 16, gap: 12 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            load();
          }}
          accessibilityLabel={t('pullToRefresh')}
        />
      }
      ListHeaderComponent={
        error ? <Text style={{ color: theme.light.primaryDeep, marginBottom: 8 }}>{error}</Text> : null
      }
      ListEmptyComponent={
        <Text style={{ color: theme.light.muted, padding: 8 }}>{t('noIncomingOrders')}</Text>
      }
      renderItem={({ item }) => {
        const next = forwardStatus(item.status);
        const labelKey = next ? ACTION_LABEL[next] : undefined;
        const isNew = item.status === FOOD_STATUS.PLACED;
        return (
          <View
            style={{
              padding: 14, borderRadius: 12, gap: 6,
              backgroundColor: theme.light.surface,
              borderWidth: isNew ? 2 : 1,
              borderColor: isNew ? theme.light.primary : theme.light.line,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontWeight: '700', color: theme.light.text }}>#{item.order_code}</Text>
              <Text style={{ color: theme.light.muted }}>{item.status}</Text>
            </View>

            {item.contact_name ? (
              <Text style={{ color: theme.light.muted }}>
                {t('customer')}: {item.contact_name}
                {item.contact_phone ? ` · ${item.contact_phone}` : ''}
              </Text>
            ) : null}

            {item.items?.length ? (
              <View style={{ gap: 2, marginTop: 4 }}>
                <Text style={{ fontSize: 12, color: theme.light.muted }}>{t('orderItems')}</Text>
                {item.items.map((it, i) => (
                  <Text key={i} style={{ color: theme.light.text }}>
                    {it.quantity ?? 1} × {it.name}
                  </Text>
                ))}
              </View>
            ) : null}

            <Text style={{ fontWeight: '600', color: theme.light.text }}>
              {t('total')}: ৳{item.total} ({item.payment_method})
            </Text>

            <Text style={{ fontSize: 12, color: theme.light.muted }}>
              {t('riderAssigned')}: {item.rider_name || t('awaitingRider')}
            </Text>

            {next && labelKey ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t(labelKey as any)}
                disabled={busyId === item.id}
                onPress={() => advance(item)}
                style={{
                  marginTop: 8, minHeight: 46, borderRadius: 10,
                  alignItems: 'center', justifyContent: 'center',
                  backgroundColor: busyId === item.id ? theme.light.muted : theme.light.primary,
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '700' }}>{t(labelKey as any)}</Text>
              </Pressable>
            ) : null}
          </View>
        );
      }}
    />
  );
}
