import { useEffect, useState } from 'react';
import { View, Text, Switch, ActivityIndicator } from 'react-native';
import { Redirect } from 'expo-router';
import Constants from 'expo-constants';
import { useAuth, endpoints, fetchMobileConfig, isVersionSupported } from '@fabrything/core';
import { api } from '../src/providers';
import { registerPush } from '../src/push';

const APP = 'rider' as const;

export default function Home() {
  const { role, loading } = useAuth();
  const [rider, setRider] = useState<any | null>(null);
  const [sharing, setSharing] = useState(false);
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
      .get(endpoints.riderMe)
      .then((r) => {
        const d = r.data.data ?? r.data;
        setRider(d);
        setSharing(!!d.is_sharing_location);
      })
      .catch(() => setError(true));
  }, [role]);

  const toggle = async (v: boolean) => {
    setSharing(v);
    await api.post(endpoints.riderPrivacy, { is_sharing_location: v });
  };

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
  if (!rider) return <ActivityIndicator style={{ marginTop: 40 }} />;
  return (
    <View style={{ padding: 24, gap: 16 }}>
      <Text style={{ fontSize: 20 }}>{rider.name}</Text>
      <Text>Available: {String(rider.is_available)}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text>Share location</Text>
        <Switch value={sharing} onValueChange={toggle} />
      </View>
    </View>
  );
}
