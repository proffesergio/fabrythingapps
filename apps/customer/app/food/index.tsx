import { useCallback, useEffect, useState } from 'react';
import { FlatList, Image, RefreshControl, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import {
  Restaurant,
  StoreApiError,
  fetchMobileConfig,
  fetchRestaurants,
  isVersionSupported,
  t,
  theme,
  useAuth,
} from '@fabrything/core';
import { api } from '../../src/providers';
import { registerPush } from '../../src/push';
import { EmptyView, ErrorView, LoadingView, MIN_TAP_TARGET } from '../../src/components/StateViews';

const APP = 'customer' as const;

// Browsing restaurants is a public (AllowAny) endpoint, like the store. This
// screen therefore does NOT force a login — a guest can read menus and is only
// asked to identify themselves at checkout, which is where the backend starts
// caring too (place_food_cod_order accepts guest orders).
export default function FoodHome() {
  const router = useRouter();
  const { role } = useAuth();
  const [rows, setRows] = useState<Restaurant[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [unsupported, setUnsupported] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setRows(await fetchRestaurants(api));
    } catch (e) {
      setError((e as StoreApiError).message || t('somethingWrong', 'en'));
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cfg = await fetchMobileConfig(api);
        const current = Constants.expoConfig?.version ?? '1.0.0';
        const min = cfg.min_supported_version[APP];
        if (!cancelled && min && !isVersionSupported(current, min)) setUnsupported(true);
      } catch {
        // best-effort: a failed config fetch must not block ordering
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (role) registerPush();
  }, [role]);

  if (unsupported) return <EmptyView message={t('updateRequired', 'en')} />;
  if (error && rows === null) return <ErrorView message={error} onRetry={load} />;
  if (rows === null) return <LoadingView />;

  return (
    <FlatList
      data={rows}
      keyExtractor={(r) => String(r.id)}
      contentContainerStyle={{ padding: 12, gap: 12 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            load();
          }}
          accessibilityLabel={t('pullToRefresh', 'en')}
        />
      }
      ListEmptyComponent={<EmptyView message={t('noRestaurants', 'en')} />}
      renderItem={({ item }) => (
        <RestaurantCard r={item} onPress={() => router.push(`/food/${item.slug}`)} />
      )}
    />
  );
}

function RestaurantCard({ r, onPress }: { r: Restaurant; onPress: () => void }) {
  // `is_open_now` is opening-hours aware; `is_open` is only the owner's master
  // switch and reads as "open" around the clock. Ordering is gated on the
  // former server-side, so the card must show the former too.
  const closed = !r.is_open_now || !r.is_accepting_orders;
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={r.display_name || r.name}
      onPress={onPress}
      style={{
        borderRadius: 12,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: theme.light.line,
        backgroundColor: theme.light.surface,
        minHeight: MIN_TAP_TARGET,
      }}
    >
      {r.cover_image ? (
        <Image
          source={{ uri: r.cover_image }}
          style={{ width: '100%', height: 130, opacity: closed ? 0.5 : 1 }}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
        />
      ) : null}
      <View style={{ padding: 12, gap: 4 }}>
        <Text style={{ fontSize: 16, fontWeight: '700', color: theme.light.text }}>
          {r.display_name || r.name}
        </Text>
        {r.cuisine_type ? (
          <Text style={{ color: theme.light.muted, fontSize: 13 }}>{r.cuisine_type}</Text>
        ) : null}
        <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap', marginTop: 2 }}>
          {r.distance_km !== null ? (
            <Text style={{ color: theme.light.muted, fontSize: 12 }}>{r.distance_km} km</Text>
          ) : null}
          <Text style={{ color: theme.light.muted, fontSize: 12 }}>
            {t('minOrder', 'en')} ৳{r.min_order_amount}
          </Text>
          <Text style={{ color: theme.light.muted, fontSize: 12 }}>~{r.avg_prep_minutes} min</Text>
        </View>
        {closed ? (
          <Text
            style={{ color: theme.light.primaryDeep, fontSize: 12, fontWeight: '600', marginTop: 2 }}
          >
            {r.next_open
              ? `${t('closedNow', 'en')} · ${t('opens', 'en')} ${r.next_open.open_time}`
              : t('closedNow', 'en')}
          </Text>
        ) : (
          <Text style={{ color: '#2E7D32', fontSize: 12, fontWeight: '600', marginTop: 2 }}>
            {t('openNow', 'en')}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}
