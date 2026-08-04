import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from 'react-native';
import { fetchRiderEarnings, RiderEarnings, StoreApiError, t, theme } from '@fabrything/core';
import { api } from '../src/providers';

export default function EarningsScreen() {
  const [data, setData] = useState<RiderEarnings | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await fetchRiderEarnings(api));
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

  if (loading) return <ActivityIndicator style={{ marginTop: 40 }} accessibilityLabel={t('earnings')} />;

  return (
    <ScrollView
      contentContainerStyle={{ padding: 20, gap: 16 }}
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
    >
      {error ? <Text style={{ color: theme.light.primaryDeep }}>{error}</Text> : null}

      <Stat label={t('todayPayout')} value={`৳${data?.today_payout ?? '0.00'}`} big />
      <Stat label={t('lifetimePayout')} value={`৳${data?.lifetime_payout ?? '0.00'}`} />
      <Stat label={t('deliveriesCompleted')} value={String(data?.deliveries_completed ?? 0)} />

      <View style={{ gap: 4, marginTop: 8 }}>
        <Stat label={t('cashInHand')} value={`৳${data?.cash_in_hand ?? '0.00'}`} big />
        {/* Riders get cut off from COD work above a ceiling, so this number is
            not trivia — it explains why offers may dry up. */}
        <Text style={{ color: theme.light.muted, fontSize: 12 }}>{t('cashInHandNote')}</Text>
      </View>
    </ScrollView>
  );
}

function Stat({ label, value, big }: { label: string; value: string; big?: boolean }) {
  return (
    <View style={{ gap: 2 }}>
      <Text style={{ fontSize: 12, color: theme.light.muted }}>{label}</Text>
      <Text style={{ fontSize: big ? 28 : 18, fontWeight: big ? '800' : '600', color: theme.light.text }}>
        {value}
      </Text>
    </View>
  );
}
