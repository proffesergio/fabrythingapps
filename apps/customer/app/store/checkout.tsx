import { useState } from 'react';
import { View, Text, TextInput, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { placeOrder, isRxBlockedError, isNetworkError, useSlowRequestHint, useCart, t, StoreApiError } from '@fabrything/core';
import { api } from '../../src/providers';
import { PrimaryButton, SecondaryButton } from '../../src/components/StateViews';

// COD checkout: address + contact, place order via store/orders/. On
// failure, `field_errors` is read and each message shown against the right
// input -- the error envelope is `{errors, field_errors, message}`, not
// `{data}` (see `toStoreApiError`). A Rx-disabled rejection has no field
// association (it's a whole-order policy block, not a bad input) so it's
// shown as a clear banner instead of the raw backend sentence. A real
// network failure (the server never answered at all, e.g. still waking up
// from a Render free-tier nap) gets the same honest "offline" message the
// other screens use, not a raw axios string.
export default function Checkout() {
  const router = useRouter();
  const { lines, clear } = useCart();

  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [stateRegion, setStateRegion] = useState('');
  const [pincode, setPincode] = useState('');
  const [notes, setNotes] = useState('');

  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [rxBlocked, setRxBlocked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const slow = useSlowRequestHint(submitting);
  const [result, setResult] = useState<{
    order_number: string;
    subtotal: number;
    shipping_amount: number;
    total_amount: number;
    currency: string;
  } | null>(null);

  const onSubmit = async () => {
    setSubmitting(true);
    setFieldErrors({});
    setFormError(null);
    setRxBlocked(false);
    try {
      const order = await placeOrder(api, {
        items: lines.map((l) => ({ variant_id: l.variantId, quantity: l.quantity })),
        contact_name: contactName,
        contact_phone: contactPhone,
        shipping_address: {
          address,
          city,
          state: stateRegion,
          pincode,
        },
        notes,
      });
      setResult(order);
      clear();
    } catch (e) {
      const err = e as StoreApiError;
      if (isRxBlockedError(err)) {
        setRxBlocked(true);
      } else if (Object.keys(err.fieldErrors ?? {}).length > 0) {
        setFieldErrors(err.fieldErrors);
      } else if (isNetworkError(err)) {
        setFormError(t('offline', 'en'));
      } else {
        setFormError(err.errors?.[0] || err.message || t('orderFailed', 'en'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (result) {
    return (
      <View style={{ padding: 24, gap: 12 }}>
        <Text style={{ fontSize: 20, fontWeight: '600' }}>{t('orderPlaced', 'en')}</Text>
        <Text>
          {t('orderNumber', 'en')}: {result.order_number}
        </Text>
        <Text>
          {t('subtotal', 'en')}: {result.subtotal}
        </Text>
        {/* Verbatim server-resolved shipping/total -- never recomputed here. */}
        <Text>
          {t('shippingAmount', 'en')}: {result.shipping_amount}
        </Text>
        <Text style={{ fontWeight: '700' }}>
          {t('total', 'en')}: {result.total_amount} {result.currency}
        </Text>
        <SecondaryButton title={t('continueShopping', 'en')} onPress={() => router.push('/store')} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 18, fontWeight: '600' }}>{t('checkout', 'en')}</Text>

      {rxBlocked ? (
        <View style={{ padding: 12, backgroundColor: '#FDECEA', borderRadius: 8 }} accessibilityRole="alert">
          <Text>{t('rxBlocked', 'en')}</Text>
        </View>
      ) : null}
      {formError ? (
        <Text style={{ color: '#E8452B' }} accessibilityRole="alert">
          {formError}
        </Text>
      ) : null}

      <Text>{t('contactName', 'en')}</Text>
      <TextInput
        value={contactName}
        onChangeText={setContactName}
        accessibilityLabel={t('contactName', 'en')}
        style={{ borderWidth: 1, borderColor: '#eee', borderRadius: 8, padding: 10, minHeight: 44 }}
      />
      {fieldErrors.contact_name?.map((msg) => (
        <Text key={msg} style={{ color: '#E8452B' }} accessibilityRole="alert">
          {msg}
        </Text>
      ))}

      <Text>{t('phone', 'en')}</Text>
      <TextInput
        value={contactPhone}
        onChangeText={setContactPhone}
        keyboardType="phone-pad"
        accessibilityLabel={t('phone', 'en')}
        style={{ borderWidth: 1, borderColor: '#eee', borderRadius: 8, padding: 10, minHeight: 44 }}
      />
      {fieldErrors.contact_phone?.map((msg) => (
        <Text key={msg} style={{ color: '#E8452B' }} accessibilityRole="alert">
          {msg}
        </Text>
      ))}

      <Text style={{ fontWeight: '600', marginTop: 8 }}>{t('deliveryAddress', 'en')}</Text>

      <Text>{t('address', 'en')}</Text>
      <TextInput
        value={address}
        onChangeText={setAddress}
        accessibilityLabel={t('address', 'en')}
        style={{ borderWidth: 1, borderColor: '#eee', borderRadius: 8, padding: 10, minHeight: 44 }}
      />
      {fieldErrors['shipping_address.address']?.map((msg) => (
        <Text key={msg} style={{ color: '#E8452B' }} accessibilityRole="alert">
          {msg}
        </Text>
      ))}

      <Text>{t('city', 'en')}</Text>
      <TextInput
        value={city}
        onChangeText={setCity}
        accessibilityLabel={t('city', 'en')}
        style={{ borderWidth: 1, borderColor: '#eee', borderRadius: 8, padding: 10, minHeight: 44 }}
      />
      {fieldErrors['shipping_address.city']?.map((msg) => (
        <Text key={msg} style={{ color: '#E8452B' }} accessibilityRole="alert">
          {msg}
        </Text>
      ))}

      <Text>{t('stateRegion', 'en')}</Text>
      <TextInput
        value={stateRegion}
        onChangeText={setStateRegion}
        accessibilityLabel={t('stateRegion', 'en')}
        style={{ borderWidth: 1, borderColor: '#eee', borderRadius: 8, padding: 10, minHeight: 44 }}
      />

      <Text>{t('pincode', 'en')}</Text>
      <TextInput
        value={pincode}
        onChangeText={setPincode}
        accessibilityLabel={t('pincode', 'en')}
        style={{ borderWidth: 1, borderColor: '#eee', borderRadius: 8, padding: 10, minHeight: 44 }}
      />

      <Text>{t('notes', 'en')}</Text>
      <TextInput
        value={notes}
        onChangeText={setNotes}
        accessibilityLabel={t('notes', 'en')}
        style={{ borderWidth: 1, borderColor: '#eee', borderRadius: 8, padding: 10, minHeight: 44 }}
      />

      <Text style={{ color: '#8C7B6E' }}>{t('codNote', 'en')}</Text>

      <PrimaryButton
        title={submitting ? t('placingOrder', 'en') : t('placeOrder', 'en')}
        disabled={submitting || lines.length === 0}
        onPress={onSubmit}
      />
      {slow ? <Text style={{ color: '#8C7B6E', textAlign: 'center' }}>{t('slowRequestHint', 'en')}</Text> : null}
    </ScrollView>
  );
}
