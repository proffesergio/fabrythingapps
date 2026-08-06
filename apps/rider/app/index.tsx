import { useEffect, useState } from 'react';
import { View, Text, Switch, ActivityIndicator, Pressable } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { useAuth, endpoints, fetchMobileConfig, isVersionSupported, setRiderAvailability, t } from '@fabrything/core';
import { api } from '../src/providers';
import { registerPush } from '../src/push';
import { useRiderPresence } from '../src/presence';

const APP = 'rider' as const;

export default function Home() {
  const router = useRouter();
  const { role, loading } = useAuth();
  const [rider, setRider] = useState<any | null>(null);
  const [sharing, setSharing] = useState(false);
  const [available, setAvailable] = useState(false);
  const [error, setError] = useState(false);
  const [unsupported, setUnsupported] = useState(false);

  // Availability is only one of the three things dispatch requires; this loop
  // supplies the other two (presence + position). It lives on the home screen
  // because expo-router's Stack keeps this screen mounted underneath /offer,
  // /deliveries and /earnings, so the pings continue while the rider works.
  const presence = useRiderPresence(available);

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
        setAvailable(!!d.is_available);
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

  const toggleAvailable = async (v: boolean) => {
    setAvailable(v);
    try {
      await setRiderAvailability(api, v);
    } catch {
      setAvailable(!v); // server refused — don't leave the switch lying
    }
  };

  return (
    <View style={{ padding: 24, gap: 18 }}>
      <Text style={{ fontSize: 20, fontWeight: '700' }}>{rider.name}</Text>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text>{t('availableForDeliveries')}</Text>
        <Switch
          value={available}
          onValueChange={toggleAvailable}
          accessibilityLabel={t('availableForDeliveries')}
        />
      </View>
      {/* Says what dispatch actually thinks, not what the switch says. A rider
          who is "Available" with location denied gets no work at all, and the
          only thing worse than that is not telling them. */}
      <Text
        style={{
          color: presence === 'no-location' ? '#B3261E' : '#8C7B6E',
          fontSize: 12,
          marginTop: -10,
        }}
      >
        {presence === 'no-location'
          ? t('locationNeeded')
          : presence === 'online'
            ? t('receivingOffers')
            : t('goOnlineToReceive')}
      </Text>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text>{t('shareLocation')}</Text>
        <Switch value={sharing} onValueChange={toggle} accessibilityLabel={t('shareLocation')} />
      </View>

      <View style={{ gap: 10, marginTop: 8 }}>
        <NavLink onPress={() => router.push('/offer')} label={t('newDeliveryOffer')} />
        <NavLink onPress={() => router.push('/deliveries')} label={t('myDeliveries')} />
        <NavLink onPress={() => router.push('/earnings')} label={t('earnings')} />
      </View>
    </View>
  );
}

function NavLink({ onPress, label }: { onPress: () => void; label: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={{
        minHeight: 48, borderRadius: 10, paddingHorizontal: 14,
        justifyContent: 'center', borderWidth: 1, borderColor: '#EFE6DC',
      }}
    >
      <Text style={{ fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}
