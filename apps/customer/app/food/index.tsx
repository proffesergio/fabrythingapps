import { useEffect, useState } from 'react';
import { View, Text, FlatList, ActivityIndicator } from 'react-native';
import { Redirect } from 'expo-router';
import Constants from 'expo-constants';
import { useAuth, endpoints, fetchMobileConfig, isVersionSupported } from '@fabrything/core';
import { api } from '../../src/providers';
import { registerPush } from '../../src/push';

const APP = 'customer' as const;

export default function Home() {
  const { role, loading } = useAuth();
  const [rows, setRows] = useState<any[] | null>(null);
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
    if (role) {
      api
        .get(endpoints.restaurants)
        .then((r) => setRows(r.data.data ?? r.data))
        .catch(() => setRows([]));
    }
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
  if (rows === null) return <ActivityIndicator style={{ marginTop: 40 }} />;
  return (
    <FlatList
      data={rows}
      keyExtractor={(x) => String(x.id)}
      renderItem={({ item }) => (
        <View style={{ padding: 16, borderBottomWidth: 1, borderColor: '#eee' }}>
          <Text style={{ fontSize: 16 }}>{item.name}</Text>
        </View>
      )}
      ListEmptyComponent={<Text style={{ padding: 24 }}>No restaurants yet.</Text>}
    />
  );
}
