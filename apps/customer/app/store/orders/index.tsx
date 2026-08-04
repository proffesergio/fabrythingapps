import { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, ActivityIndicator, TouchableOpacity, Button } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { fetchOrders, t, useAuth, OrderListItem } from '@fabrything/core';
import { api } from '../../../src/providers';

// Order history: `store/orders/list/` is IsAuthenticated, unlike the public
// catalog screens, so this redirects to login rather than showing an empty
// list to a guest.
export default function OrderList() {
  const router = useRouter();
  const { role, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState<OrderListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    setOrders(null);
    fetchOrders(api)
      .then((res) => setOrders(res.items))
      .catch((e: { message?: string }) => setError(e?.message || t('somethingWrong', 'en')));
  }, []);

  useEffect(() => {
    if (role) load();
  }, [role, load]);

  if (authLoading) return <ActivityIndicator style={{ marginTop: 40 }} />;
  if (!role) return <Redirect href="/login" />;

  if (error) {
    return (
      <View style={{ padding: 24, gap: 12 }}>
        <Text>{error}</Text>
        <Button title={t('retry', 'en')} onPress={load} />
      </View>
    );
  }

  if (orders === null) return <ActivityIndicator style={{ marginTop: 40 }} />;

  return (
    <FlatList
      data={orders}
      keyExtractor={(o) => String(o.id)}
      renderItem={({ item }) => (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={item.order_number}
          style={{ padding: 16, borderBottomWidth: 1, borderColor: '#eee', gap: 4 }}
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
      ListEmptyComponent={<Text style={{ padding: 24 }}>{t('noOrders', 'en')}</Text>}
    />
  );
}
