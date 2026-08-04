import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, Pressable } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { useAuth, endpoints, fetchMobileConfig, isVersionSupported, t } from '@fabrything/core';
import { api } from '../src/providers';
import { registerPush } from '../src/push';

const APP = 'restaurant' as const;

export default function Home() {
  const router = useRouter();
  const { role, loading } = useAuth();
  const [r, setR] = useState<any | null>(null);
  const [error, setError] = useState(false);
  const [unsupported, setUnsupported] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cfg = await fetchMobileConfig(api);
        const current = Constants.expoConfig?.version ?? '1.0.0';
        const min = cfg.min_supported_version[APP];
        if (!cancelled && min && !isVersionSupported(current, min)) {
          setUnsupported(true);
        }
      } catch {
        // best-effort: proceed normally if the config fetch fails
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (role) {
      registerPush();
    }
  }, [role]);

  useEffect(() => {
    if (!role) return;
    api
      .get(endpoints.vendorRestaurant)
      .then((res) => setR(res.data.data ?? res.data))
      .catch(() => setError(true));
  }, [role]);

  if (loading) return <ActivityIndicator style={{ marginTop: 40 }} />;
  if (!role) return <Redirect href="/login" />;
  if (unsupported) {
    return (
      <View style={{ padding: 24 }}>
        <Text>Please update the app to continue.</Text>
      </View>
    );
  }
  if (error) {
    return (
      <View style={{ padding: 24 }}>
        <Text>Something went wrong. Please try again later.</Text>
      </View>
    );
  }
  if (!r) return <ActivityIndicator style={{ marginTop: 40 }} />;
  return (
    <View style={{ padding: 24, gap: 14 }}>
      <Text style={{ fontSize: 20, fontWeight: '700' }}>{r.name}</Text>
      <Text>{r.is_open ? 'Open' : 'Closed'}</Text>
      {r.status && r.status !== 'ACTIVE' ? (
        <Text style={{ color: '#8C7B6E' }}>{t('restaurantClosed')}</Text>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('incomingOrders')}
        onPress={() => router.push('/orders')}
        style={{
          minHeight: 48, borderRadius: 10, paddingHorizontal: 14, marginTop: 6,
          justifyContent: 'center', borderWidth: 1, borderColor: '#EFE6DC',
        }}
      >
        <Text style={{ fontWeight: '600' }}>{t('incomingOrders')}</Text>
      </Pressable>
    </View>
  );
}
