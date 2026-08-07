import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  DeliveryQuote,
  DeliveryZone,
  RestaurantDetail,
  StoreApiError,
  Village,
  fetchDeliveryQuote,
  fetchRestaurant,
  fetchZones,
  placeFoodOrder,
  t,
  theme,
  toOrderItems,
  useFoodCart,
  validateCoupon,
} from '@fabrything/core';
import { api } from '../../src/providers';
import { ErrorView, LoadingView, MIN_TAP_TARGET, PrimaryButton } from '../../src/components/StateViews';

export default function FoodCheckout() {
  const router = useRouter();
  const cart = useFoodCart();
  const slug = cart.restaurantSlug;

  const [restaurant, setRestaurant] = useState<RestaurantDetail | null>(null);
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [zoneId, setZoneId] = useState<number | null>(null);
  const [villageId, setVillageId] = useState<number | null>(null);
  const [tip, setTip] = useState('0');

  const [couponInput, setCouponInput] = useState('');
  const [coupon, setCoupon] = useState<{ code: string; discount: string } | null>(null);
  const [couponMsg, setCouponMsg] = useState<string | null>(null);

  const [quote, setQuote] = useState<DeliveryQuote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const load = useCallback(async () => {
    if (!slug) return;
    setLoadError(null);
    try {
      const [r, z] = await Promise.all([fetchRestaurant(api, slug), fetchZones(api)]);
      setRestaurant(r);
      setZones(z);
    } catch (e) {
      setLoadError((e as StoreApiError).message || t('somethingWrong', 'en'));
    }
  }, [slug]);

  useEffect(() => {
    load();
  }, [load]);

  // Only the zones this restaurant actually serves. `served_zone_ids === null`
  // means "every zone" (the restaurant has no explicit allow-list), which is
  // exactly what food.services.served_zones() decides server-side. Offering a
  // zone the order endpoint would reject is the documented cause of the old
  // "Couldn't place order" 400 on web.
  const servedZones = useMemo(() => {
    if (!restaurant) return [];
    const allow = restaurant.served_zone_ids;
    return allow === null ? zones : zones.filter((z) => allow.includes(z.id));
  }, [restaurant, zones]);

  const villages: Village[] = useMemo(
    () => servedZones.find((z) => z.id === zoneId)?.villages ?? [],
    [servedZones, zoneId],
  );

  // Re-quote whenever the destination changes. The quote comes from the same
  // pricing function the order endpoint charges with, so what is shown here is
  // what gets billed.
  useEffect(() => {
    if (!slug || (!zoneId && !villageId)) {
      setQuote(null);
      return;
    }
    let cancelled = false;
    setQuoting(true);
    (async () => {
      try {
        const q = await fetchDeliveryQuote(api, { restaurant: slug, zone: zoneId, village: villageId });
        if (!cancelled) setQuote(q);
      } catch {
        if (!cancelled) setQuote(null);
      } finally {
        if (!cancelled) setQuoting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, zoneId, villageId]);

  const applyCoupon = async () => {
    if (!slug || !couponInput.trim()) return;
    setCouponMsg(null);
    try {
      const res = await validateCoupon(api, {
        code: couponInput.trim(),
        restaurant_slug: slug,
        subtotal: cart.totals.subtotal.toFixed(2),
      });
      if (res.valid && res.discount) {
        setCoupon({ code: res.code || couponInput.trim(), discount: res.discount });
        setCouponMsg(t('couponApplied', 'en'));
      } else {
        setCoupon(null);
        setCouponMsg(res.message || t('somethingWrong', 'en'));
      }
    } catch (e) {
      setCoupon(null);
      setCouponMsg((e as StoreApiError).message || t('somethingWrong', 'en'));
    }
  };

  const subtotal = cart.totals.subtotal;
  const discount = coupon ? Number(coupon.discount) : 0;
  const fee = quote?.deliverable && quote.fee ? Number(quote.fee) : 0;
  const tipAmount = Number(tip) || 0;
  const total = Math.max(0, subtotal - discount) + fee + tipAmount;

  const belowMinimum = !!restaurant && subtotal < Number(restaurant.min_order_amount);
  const closed = !!restaurant && (!restaurant.is_open_now || !restaurant.is_accepting_orders);
  const canPlace =
    !!slug &&
    !!name.trim() &&
    !!phone.trim() &&
    !!address.trim() &&
    (!!zoneId || !!villageId) &&
    quote?.deliverable === true &&
    !belowMinimum &&
    !closed &&
    !placing;

  const place = async () => {
    if (!slug || !canPlace) return;
    setPlacing(true);
    setErrors([]);
    setFieldErrors({});
    try {
      const order = await placeFoodOrder(api, {
        restaurant_slug: slug,
        items: toOrderItems(cart.lines),
        contact_name: name.trim(),
        contact_phone: phone.trim(),
        delivery_address: address.trim(),
        zone_id: zoneId,
        village_id: villageId,
        notes: notes.trim(),
        coupon_code: coupon?.code || '',
        tip: tipAmount.toFixed(2),
        payment_method: 'COD',
      });
      cart.clear();
      // Replace, not push: the cart it was built from is gone, so going "back"
      // to checkout would strand the customer on an empty, unusable form.
      router.replace(`/food/orders/${order.order_code}?phone=${encodeURIComponent(phone.trim())}`);
    } catch (e) {
      const err = e as StoreApiError;
      setErrors(err.errors?.length ? err.errors : [err.message || t('orderFailed', 'en')]);
      setFieldErrors(err.fieldErrors || {});
    } finally {
      setPlacing(false);
    }
  };

  if (!slug) {
    return <ErrorView message={t('emptyFoodCart', 'en')} onRetry={() => router.replace('/food')} />;
  }
  if (loadError && !restaurant) return <ErrorView message={loadError} onRetry={load} />;
  if (!restaurant) return <LoadingView />;

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}>
      <Text style={{ fontSize: 20, fontWeight: '800', color: theme.light.text }}>
        {t('checkout', 'en')}
      </Text>
      <Text style={{ color: theme.light.muted }}>{restaurant.display_name || restaurant.name}</Text>

      {closed ? (
        <Banner tone="error" text={t('restaurantClosedNow', 'en')} />
      ) : null}
      {belowMinimum ? (
        <Banner
          tone="error"
          text={`${t('minimumNotMet', 'en')} (${t('minOrder', 'en')} ৳${restaurant.min_order_amount})`}
        />
      ) : null}

      <Field
        label={t('contactName', 'en')}
        value={name}
        onChangeText={setName}
        errors={fieldErrors.contact_name}
      />
      <Field
        label={t('phone', 'en')}
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        errors={fieldErrors.contact_phone}
      />
      <Field
        label={t('deliveryAddress', 'en')}
        value={address}
        onChangeText={setAddress}
        multiline
        errors={fieldErrors.delivery_address}
      />

      <Text style={{ fontWeight: '700', marginTop: 6 }}>{t('deliveryArea', 'en')}</Text>
      <Text style={{ color: theme.light.muted, fontSize: 12 }}>{t('chooseZone', 'en')}</Text>
      <ChipRow
        options={servedZones.map((z) => ({ id: z.id, label: z.name_bn || z.name }))}
        selected={zoneId}
        onSelect={(id) => {
          setZoneId(id);
          setVillageId(null);
        }}
        prefix="zone"
      />

      {villages.length ? (
        <>
          <Text style={{ color: theme.light.muted, fontSize: 12 }}>{t('chooseVillage', 'en')}</Text>
          <ChipRow
            options={villages.map((v) => ({ id: v.id, label: v.name_bn || v.name }))}
            selected={villageId}
            onSelect={setVillageId}
            prefix="village"
          />
        </>
      ) : null}

      {quoting ? <Text style={{ color: theme.light.muted }}>{t('quoting', 'en')}</Text> : null}
      {quote && !quote.deliverable ? (
        <Banner tone="error" text={quote.reason || t('notDeliverable', 'en')} />
      ) : null}

      <Text style={{ fontWeight: '700', marginTop: 6 }}>{t('couponCode', 'en')}</Text>
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <TextInput
          value={couponInput}
          onChangeText={setCouponInput}
          autoCapitalize="characters"
          accessibilityLabel={t('couponCode', 'en')}
          style={inputStyle}
        />
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={t('apply', 'en')}
          onPress={applyCoupon}
          style={{
            minHeight: MIN_TAP_TARGET, paddingHorizontal: 16, borderRadius: 8,
            borderWidth: 1, borderColor: theme.light.primary,
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Text style={{ color: theme.light.primary, fontWeight: '600' }}>{t('apply', 'en')}</Text>
        </TouchableOpacity>
      </View>
      {couponMsg ? <Text style={{ color: theme.light.muted, fontSize: 12 }}>{couponMsg}</Text> : null}

      <Field label={t('tip', 'en')} value={tip} onChangeText={setTip} keyboardType="numeric" />
      <Field label={t('notes', 'en')} value={notes} onChangeText={setNotes} multiline />

      <View style={{ marginTop: 10, gap: 4 }}>
        <Row label={t('subtotal', 'en')} value={`৳${subtotal.toFixed(2)}`} />
        {discount > 0 ? <Row label={t('discount', 'en')} value={`−৳${discount.toFixed(2)}`} /> : null}
        <Row
          label={t('deliveryFee', 'en')}
          value={quote?.deliverable && quote.fee ? `৳${quote.fee}` : '—'}
        />
        {tipAmount > 0 ? <Row label={t('tip', 'en')} value={`৳${tipAmount.toFixed(2)}`} /> : null}
        <Row label={t('total', 'en')} value={`৳${total.toFixed(2)}`} strong />
        {quote?.eta_minutes ? (
          <Text style={{ color: theme.light.muted, fontSize: 12 }}>
            {t('etaMinutes', 'en')}: ~{quote.eta_minutes} min
          </Text>
        ) : null}
      </View>

      <Text style={{ color: theme.light.muted, fontSize: 12 }}>{t('codNote', 'en')}</Text>

      {errors.map((msg) => (
        <Banner key={msg} tone="error" text={msg} />
      ))}

      <PrimaryButton
        title={placing ? t('placingOrder', 'en') : t('placeOrder', 'en')}
        accessibilityLabel={t('placeOrder', 'en')}
        disabled={!canPlace}
        onPress={place}
      />
    </ScrollView>
  );
}

const inputStyle = {
  flex: 1,
  minHeight: MIN_TAP_TARGET,
  borderWidth: 1,
  borderColor: theme.light.line,
  borderRadius: 8,
  paddingHorizontal: 12,
} as const;

function Field({
  label,
  value,
  onChangeText,
  keyboardType,
  multiline,
  errors,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  keyboardType?: 'phone-pad' | 'numeric';
  multiline?: boolean;
  errors?: string[];
}) {
  return (
    <View style={{ gap: 4 }}>
      <Text style={{ color: theme.light.text }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        multiline={multiline}
        accessibilityLabel={label}
        style={{ ...inputStyle, paddingVertical: multiline ? 10 : 0 }}
      />
      {errors?.map((msg) => (
        <Text key={msg} style={{ color: theme.light.primaryDeep, fontSize: 12 }}>
          {msg}
        </Text>
      ))}
    </View>
  );
}

function ChipRow({
  options,
  selected,
  onSelect,
  prefix,
}: {
  options: { id: number; label: string }[];
  selected: number | null;
  onSelect: (id: number) => void;
  prefix: string;
}) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {options.map((o) => {
        const on = selected === o.id;
        return (
          <TouchableOpacity
            key={o.id}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={`${prefix}-${o.id}`}
            onPress={() => onSelect(o.id)}
            style={{
              minHeight: MIN_TAP_TARGET, paddingHorizontal: 14, borderRadius: 20,
              borderWidth: 1, alignItems: 'center', justifyContent: 'center',
              borderColor: on ? theme.light.primary : theme.light.line,
              backgroundColor: on ? '#FDF0ED' : 'transparent',
            }}
          >
            <Text style={{ color: on ? theme.light.primary : theme.light.text }}>{o.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text style={{ color: strong ? theme.light.text : theme.light.muted, fontWeight: strong ? '700' : '400' }}>
        {label}
      </Text>
      <Text style={{ fontWeight: strong ? '800' : '600', color: theme.light.text }}>{value}</Text>
    </View>
  );
}

function Banner({ tone, text }: { tone: 'error'; text: string }) {
  return (
    <View
      accessibilityRole="alert"
      style={{
        padding: 10, borderRadius: 8, backgroundColor: '#FDECEA',
        borderWidth: 1, borderColor: '#F5C6C2',
      }}
    >
      <Text style={{ color: theme.light.primaryDeep }}>{text}</Text>
    </View>
  );
}
