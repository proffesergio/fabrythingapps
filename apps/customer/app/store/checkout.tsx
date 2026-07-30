import { useState } from 'react';
import { View, Text, TextInput, Button, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { placeOrder, isRxBlockedError, StoreApiError, useCart, t } from '@fabrything/core';
import { api } from '../../src/providers';

// COD checkout: address + contact, place order via store/orders/. On
// failure, `field_errors` is read and each message shown against the right
// input -- the error envelope is `{errors, field_errors, message}`, not
// `{data}` (see `toStoreApiError`). A Rx-disabled rejection has no field
// association (it's a whole-order policy block, not a bad input) so it's
// shown as a clear banner instead of the raw backend sentence.
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
        <Button title={t('continueShopping', 'en')} onPress={() => router.push('/store')} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 18, fontWeight: '600' }}>{t('checkout', 'en')}</Text>

      {rxBlocked ? (
        <View style={{ padding: 12, backgroundColor: '#FDECEA', borderRadius: 8 }}>
          <Text>{t('rxBlocked', 'en')}</Text>
        </View>
      ) : null}
      {formError ? <Text style={{ color: '#E8452B' }}>{formError}</Text> : null}

      <Text>{t('contactName', 'en')}</Text>
      <TextInput
        value={contactName}
        onChangeText={setContactName}
        style={{ borderWidth: 1, borderColor: '#eee', borderRadius: 8, padding: 10 }}
      />
      {fieldErrors.contact_name?.map((msg) => (
        <Text key={msg} style={{ color: '#E8452B' }}>
          {msg}
        </Text>
      ))}

      <Text>{t('phone', 'en')}</Text>
      <TextInput
        value={contactPhone}
        onChangeText={setContactPhone}
        keyboardType="phone-pad"
        style={{ borderWidth: 1, borderColor: '#eee', borderRadius: 8, padding: 10 }}
      />
      {fieldErrors.contact_phone?.map((msg) => (
        <Text key={msg} style={{ color: '#E8452B' }}>
          {msg}
        </Text>
      ))}

      <Text style={{ fontWeight: '600', marginTop: 8 }}>{t('deliveryAddress', 'en')}</Text>

      <Text>{t('address', 'en')}</Text>
      <TextInput
        value={address}
        onChangeText={setAddress}
        style={{ borderWidth: 1, borderColor: '#eee', borderRadius: 8, padding: 10 }}
      />
      {fieldErrors['shipping_address.address']?.map((msg) => (
        <Text key={msg} style={{ color: '#E8452B' }}>
          {msg}
        </Text>
      ))}

      <Text>{t('city', 'en')}</Text>
      <TextInput
        value={city}
        onChangeText={setCity}
        style={{ borderWidth: 1, borderColor: '#eee', borderRadius: 8, padding: 10 }}
      />
      {fieldErrors['shipping_address.city']?.map((msg) => (
        <Text key={msg} style={{ color: '#E8452B' }}>
          {msg}
        </Text>
      ))}

      <Text>{t('stateRegion', 'en')}</Text>
      <TextInput
        value={stateRegion}
        onChangeText={setStateRegion}
        style={{ borderWidth: 1, borderColor: '#eee', borderRadius: 8, padding: 10 }}
      />

      <Text>{t('pincode', 'en')}</Text>
      <TextInput
        value={pincode}
        onChangeText={setPincode}
        style={{ borderWidth: 1, borderColor: '#eee', borderRadius: 8, padding: 10 }}
      />

      <Text>{t('notes', 'en')}</Text>
      <TextInput
        value={notes}
        onChangeText={setNotes}
        style={{ borderWidth: 1, borderColor: '#eee', borderRadius: 8, padding: 10 }}
      />

      <Text style={{ color: '#8C7B6E' }}>{t('codNote', 'en')}</Text>

      <Button
        title={submitting ? t('placingOrder', 'en') : t('placeOrder', 'en')}
        disabled={submitting || lines.length === 0}
        onPress={onSubmit}
      />
    </ScrollView>
  );
}
