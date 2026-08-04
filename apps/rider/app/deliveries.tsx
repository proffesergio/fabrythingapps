import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import {
  fetchRiderOrders,
  forwardStatus,
  RiderOrder,
  setRiderOrderStatus,
  StoreApiError,
  t,
  theme,
} from '@fabrything/core';
import { api } from '../src/providers';

const LABEL: Record<string, string> = {
  OUT_FOR_DELIVERY: 'markPickedUp',
  DELIVERED: 'markDelivered',
};

export default function DeliveriesScreen() {
  const [orders, setOrders] = useState<RiderOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setOrders(await fetchRiderOrders(api));
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

  const advance = async (order: RiderOrder) => {
    const next = forwardStatus(order.status);
    if (!next) return;
    setBusyId(order.id);
    try {
      await setRiderOrderStatus(api, order.id, next);
      await load();
    } catch (e) {
      // The server owns the state machine; if it refuses, show why rather than
      // optimistically moving the card and lying to the rider.
      setError((e as StoreApiError).message || t('statusUpdateFailed'));
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <ActivityIndicator style={{ marginTop: 40 }} accessibilityLabel={t('myDeliveries')} />;

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
        <Text style={{ color: theme.light.muted, padding: 8 }}>{t('noActiveDeliveries')}</Text>
      }
      renderItem={({ item }) => {
        const next = forwardStatus(item.status);
        const labelKey = next ? LABEL[next] : undefined;
        return (
          <View
            style={{
              padding: 14, borderRadius: 12, gap: 6,
              backgroundColor: theme.light.surface, borderWidth: 1, borderColor: theme.light.line,
            }}
          >
            <Text style={{ fontWeight: '700', color: theme.light.text }}>#{item.order_code}</Text>
            {item.restaurant_name ? (
              <Text style={{ color: theme.light.muted }}>
                {t('pickupFrom')}: {item.restaurant_name}
              </Text>
            ) : null}
            {item.delivery_address ? (
              <Text style={{ color: theme.light.muted }}>
                {t('dropAt')}: {item.delivery_address}
              </Text>
            ) : null}
            <Text style={{ color: theme.light.text }}>{item.status}</Text>
            {next && labelKey ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t(labelKey as any)}
                disabled={busyId === item.id}
                onPress={() => advance(item)}
                style={{
                  marginTop: 6, minHeight: 44, borderRadius: 10,
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
