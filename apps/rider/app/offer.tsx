import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import {
  fetchRiderOffer,
  respondToOffer,
  RiderOffer,
  StoreApiError,
  t,
  theme,
} from '@fabrything/core';
import { api } from '../src/providers';

// The server expires an offer after 60s and its GET also drives the lazy sweep
// that cascades stale offers to the next rider — so polling is not just for
// this screen, it keeps dispatch moving for everyone. 5s is a compromise
// between reacting fast and not draining a rider's battery all shift.
const POLL_MS = 5000;

export default function OfferScreen() {
  const [offer, setOffer] = useState<RiderOffer | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  // Local ticker for the countdown only. `seconds_left` from the server is
  // authoritative on every poll; this just avoids a frozen number between polls.
  const [secondsLeft, setSecondsLeft] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const next = await fetchRiderOffer(api);
      setOffer(next);
      setSecondsLeft(next?.seconds_left ?? 0);
      if (!next) setMessage(null);
    } catch {
      // A failed poll is not worth shouting about — the next one is 5s away.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    timer.current = setInterval(load, POLL_MS);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [load]);

  useEffect(() => {
    if (!offer) return;
    const tick = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(tick);
  }, [offer]);

  const respond = async (action: 'accept' | 'decline') => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await respondToOffer(api, action);
      if (action === 'accept' && res.accepted) {
        setOffer(null);
        setMessage(null);
      } else {
        setOffer(null);
      }
    } catch (e) {
      const err = e as StoreApiError;
      // 409 is a normal race, not a fault: the offer expired or an admin
      // reassigned it between the rider's last poll and this tap.
      setMessage(err.status === 409 ? t('offerTaken') : err.message || t('somethingWrong'));
      setOffer(null);
    } finally {
      setBusy(false);
      load();
    }
  };

  if (loading) return <ActivityIndicator style={{ marginTop: 40 }} accessibilityLabel={t('newDeliveryOffer')} />;

  if (!offer) {
    return (
      <View style={{ padding: 24, gap: 8 }}>
        <Text style={{ fontSize: 16, color: theme.light.text }}>{t('noOffers')}</Text>
        {message ? <Text style={{ color: theme.light.muted }}>{message}</Text> : null}
      </View>
    );
  }

  const expired = secondsLeft <= 0;

  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }}>
      <Text style={{ fontSize: 20, fontWeight: '700', color: theme.light.text }}>
        {t('newDeliveryOffer')}
      </Text>

      <Text
        accessibilityLabel={`${secondsLeft} ${t('secondsLeft')}`}
        style={{ fontSize: 32, fontWeight: '800', color: expired ? theme.light.muted : theme.light.primary }}
      >
        {secondsLeft}s
      </Text>

      <Row label={t('pickupFrom')} value={offer.restaurant_name} />
      <Row label={t('dropAt')} value={offer.delivery_address} />
      {offer.distance_km ? <Row label={t('distance')} value={`${offer.distance_km} km`} /> : null}
      <Row label={t('youEarn')} value={`৳${offer.rider_pay}`} emphasise />
      <Row label={t('total')} value={`৳${offer.total} (${offer.payment_method})`} />

      {expired ? (
        <Text style={{ color: theme.light.muted }}>{t('offerExpired')}</Text>
      ) : (
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('accept')}
            disabled={busy}
            onPress={() => respond('accept')}
            style={{
              flex: 1, minHeight: 48, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
              backgroundColor: busy ? theme.light.muted : theme.light.primary,
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '700' }}>{t('accept')}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('decline')}
            disabled={busy}
            onPress={() => respond('decline')}
            style={{
              flex: 1, minHeight: 48, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
              borderWidth: 1, borderColor: theme.light.line,
            }}
          >
            <Text style={{ color: theme.light.text, fontWeight: '600' }}>{t('decline')}</Text>
          </Pressable>
        </View>
      )}

      {message ? <Text style={{ color: theme.light.muted }}>{message}</Text> : null}
    </ScrollView>
  );
}

function Row({ label, value, emphasise }: { label: string; value: string; emphasise?: boolean }) {
  return (
    <View style={{ gap: 2 }}>
      <Text style={{ fontSize: 12, color: theme.light.muted }}>{label}</Text>
      <Text
        style={{
          fontSize: emphasise ? 20 : 15,
          fontWeight: emphasise ? '700' : '500',
          color: theme.light.text,
        }}
      >
        {value}
      </Text>
    </View>
  );
}
