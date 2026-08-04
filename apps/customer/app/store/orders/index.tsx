import { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, Text, TouchableOpacity, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { fetchOrders, isNetworkError, t, useAuth, OrderListItem, StoreApiError } from '@fabrything/core';
import { api } from '../../../src/providers';
import { EmptyView, ErrorView, LoadingView, MIN_TAP_TARGET } from '../../../src/components/StateViews';

function messageFor(error: unknown): string {
  const err = error as StoreApiError;
  return isNetworkError(err) ? t('offline', 'en') : err.errors?.[0] || err.message || t('somethingWrong', 'en');
}

// Order history: `store/orders/list/` is IsAuthenticated, unlike the public
// catalog screens, so this redirects to login rather than showing an empty
// list to a guest.
export default function OrderList() {
  const router = useRouter();
  const { role, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState<OrderListItem[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    if (mode === 'refresh') setRefreshing(true);
    setError(null);
    try {
      const res = await fetchOrders(api);
      setOrders(res.items);
    } catch (e) {
      setError(messageFor(e));
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (role) load('initial');
  }, [role, load]);

  if (authLoading) return <LoadingView />;
  if (!role) return <Redirect href="/login" />;

  if (error && orders === null) {
    return <ErrorView message={error} onRetry={() => load('initial')} />;
  }

  if (orders === null) return <LoadingView />;

  return (
    <FlatList
      testID="order-list"
      data={orders}
      keyExtractor={(o) => String(o.id)}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => load('refresh')} accessibilityLabel={t('pullToRefresh', 'en')} />
      }
      renderItem={({ item }) => (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={item.order_number}
          style={{ padding: 16, minHeight: MIN_TAP_TARGET, borderBottomWidth: 1, borderColor: '#eee', gap: 4 }}
          onPress={() => router.push({ pathname: '/store/orders/[id]', params: { id: String(item.id) } })}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontWeight: '600' }}>{item.order_number}</Text>
            <Text>{item.status_display}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: '#8C7B6E' }}>
              {item.item_count} {t('itemsLabel', 'en')}
            </Text>
            <Text style={{ fontWeight: '600' }}>
              {item.total_amount} {item.currency}
            </Text>
          </View>
        </TouchableOpacity>
      )}
      ListEmptyComponent={<EmptyView message={t('noOrders', 'en')} />}
    />
  );
}
