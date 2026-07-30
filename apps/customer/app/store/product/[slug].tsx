import { useCallback, useEffect, useState } from 'react';
import { View, Text, Image, ScrollView, ActivityIndicator, Button } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { fetchProductDetail, t, StoreProductDetail } from '@fabrything/core';
import { api } from '../../../src/providers';

function firstParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] : value ?? '';
}

// Product detail: gallery, price with discount, sizes, stock, shipping note
// and the Rx state. requires_prescription is surfaced, never hidden — the
// server blocks the purchase while Rx sales are disabled, this screen just
// shows that state (no add-to-cart action here; that lands with the cart).
export default function ProductDetail() {
  const params = useLocalSearchParams<{ slug?: string | string[] }>();
  const slug = firstParam(params.slug);
  const [product, setProduct] = useState<StoreProductDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    setProduct(null);
    fetchProductDetail(api, slug)
      .then(setProduct)
      .catch((e: { message?: string }) => setError(e?.message || t('somethingWrong', 'en')));
  }, [slug]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) {
    return (
      <View style={{ padding: 24, gap: 12 }}>
        <Text>{error}</Text>
        <Button title={t('retry', 'en')} onPress={load} />
      </View>
    );
  }

  if (!product) return <ActivityIndicator style={{ marginTop: 40 }} />;

  const hasDiscount = !!product.discount_price;
  const images = product.image ?? [];
  const inStock = product.total_stock > 0;

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {images.length ? (
          images.map((uri) => (
            <Image key={uri} source={{ uri }} style={{ width: 280, height: 280, marginRight: 8, borderRadius: 12 }} />
          ))
        ) : (
          <View style={{ width: 280, height: 280, backgroundColor: '#eee', borderRadius: 12 }} />
        )}
      </ScrollView>

      <Text style={{ fontSize: 20, fontWeight: '600' }}>{product.name}</Text>

      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        {hasDiscount ? (
          <>
            <Text style={{ fontSize: 18, fontWeight: '700' }}>{product.discount_price}</Text>
            <Text style={{ textDecorationLine: 'line-through', color: '#8C7B6E' }}>
              {product.initial_selling_price}
            </Text>
          </>
        ) : (
          <Text style={{ fontSize: 18, fontWeight: '700' }}>{product.initial_selling_price}</Text>
        )}
      </View>

      {product.requires_prescription ? (
        <View style={{ padding: 12, backgroundColor: '#FDECEA', borderRadius: 8 }}>
          <Text>{t('prescriptionRequired', 'en')}</Text>
        </View>
      ) : null}

      {product.available_sizes?.length ? (
        <View style={{ gap: 6 }}>
          <Text style={{ fontWeight: '600' }}>{t('sizes', 'en')}</Text>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {product.available_sizes.map((size) => (
              <View
                key={size}
                style={{ borderWidth: 1, borderColor: '#eee', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 }}
              >
                <Text>{size}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      <Text>{inStock ? t('inStock', 'en') : t('outOfStock', 'en')}</Text>

      <Text>
        {product.free_shipping ? t('freeShipping', 'en') : `${t('shippingFee', 'en')}: ${product.effective_shipping_fee}`}
      </Text>

      <Text>{product.description}</Text>
    </ScrollView>
  );
}
