import { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { Redirect, useLocalSearchParams } from 'expo-router';
import {
  cancelOrder,
  fetchOrderDetail,
  isNetworkError,
  t,
  useAuth,
  CANCELABLE_ORDER_STATUSES,
  OrderDetail,
  StoreApiError,
} from '@fabrything/core';
import { api } from '../../../src/providers';
import { ErrorView, LoadingView, PrimaryButton } from '../../../src/components/StateViews';

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function messageFor(error: unknown): string {
  const err = error as StoreApiError;
  return isNetworkError(err) ? t('offline', 'en') : err.errors?.[0] || err.message || t('somethingWrong', 'en');
}

// Order detail + status timeline + cancel. `order.status_logs` is already
// ordered oldest-first by the server (`OrderStatusLog.Meta.ordering`), so no
// client-side re-sort is needed to render it as a timeline.
export default function OrderDetailScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = firstParam(params.id);
  const { role, loading: authLoading } = useAuth();

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [canceling, setCanceling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    setOrder(null);
    try {
      const detail = await fetchOrderDetail(api, id);
      setOrder(detail);
    } catch (e) {
      setError(messageFor(e));
    }
  }, [id]);

  useEffect(() => {
    if (role) load();
  }, [role, load]);

  const onCancel = async () => {
    if (!id) return;
    setCanceling(true);
    setCancelError(null);
    try {
      await cancelOrder(api, id);
      // Awaited (not fire-and-forget) so `canceling` only clears once the
      // reload has actually landed -- otherwise the button re-enables while
      // the screen is still showing the pre-cancel status.
      await load();
    } catch (e) {
      const err = e as StoreApiError;
      setCancelError(isNetworkError(err) ? t('offline', 'en') : err.errors?.[0] || err.message || t('cancelOrderFailed', 'en'));
    } finally {
      setCanceling(false);
    }
  };

  if (authLoading) return <LoadingView />;
  if (!role) return <Redirect href="/login" />;

  if (error) {
    return <ErrorView message={error} onRetry={load} />;
  }

  if (order === null) return <LoadingView />;

  const cancelable = CANCELABLE_ORDER_STATUSES.includes(order.status);

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
      <View style={{ gap: 4 }}>
        <Text style={{ fontSize: 18, fontWeight: '600' }}>{order.order_number}</Text>
        <Text>{order.status_display}</Text>
        <Text style={{ color: '#8C7B6E' }}>
          {t('placedOn', 'en')}: {order.created_at}
        </Text>
      </View>

      <View style={{ gap: 6 }}>
        <Text style={{ fontWeight: '600' }}>{t('itemsLabel', 'en')}</Text>
        {order.items.map((item) => (
          <View key={item.id} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text>
              {item.quantity} × {item.product_name} {item.size ? `(${item.size})` : ''}
            </Text>
            <Text>{item.line_total}</Text>
          </View>
        ))}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
          <Text>{t('subtotal', 'en')}</Text>
          <Text>{order.subtotal}</Text>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text>{t('shippingAmount', 'en')}</Text>
          <Text>{order.shipping_amount}</Text>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ fontWeight: '700' }}>{t('total', 'en')}</Text>
          <Text style={{ fontWeight: '700' }}>
            {order.total_amount} {order.currency}
          </Text>
        </View>
      </View>

      <View style={{ gap: 4 }}>
        <Text style={{ fontWeight: '600' }}>{t('shippingAddressLabel', 'en')}</Text>
        <Text>{order.shipping_address.address}</Text>
        <Text>
          {order.shipping_address.city}
          {order.shipping_address.state ? `, ${order.shipping_address.state}` : ''}
        </Text>
      </View>

      <View style={{ gap: 8 }}>
        <Text style={{ fontWeight: '600' }}>{t('statusTimeline', 'en')}</Text>
        {order.status_logs.map((log, idx) => (
          <View key={`${log.to_status}-${log.created_at}-${idx}`} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text>{log.to_status}</Text>
            <Text style={{ color: '#8C7B6E' }}>{log.created_at}</Text>
          </View>
        ))}
      </View>

      {order.status === 'CANCELED' && order.canceled_reason ? (
        <Text style={{ color: '#8C7B6E' }}>{order.canceled_reason}</Text>
      ) : null}

      {cancelError ? (
        <Text style={{ color: '#E8452B' }} accessibilityRole="alert">
          {cancelError}
        </Text>
      ) : null}

      {cancelable ? (
        <PrimaryButton
          title={canceling ? t('cancelingOrder', 'en') : t('cancelOrder', 'en')}
          disabled={canceling}
          onPress={onCancel}
        />
      ) : (
        <Text style={{ color: '#8C7B6E' }}>{t('orderNotCancelable', 'en')}</Text>
      )}
    </ScrollView>
  );
}
