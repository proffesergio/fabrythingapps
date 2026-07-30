import { useCallback, useEffect, useState } from 'react';
import { View, Text, Image, ScrollView, ActivityIndicator, Button, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { fetchProductDetail, t, useCart, ProductVariant, StoreProductDetail } from '@fabrything/core';
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
  const router = useRouter();
  const { addItem } = useCart();
  const [product, setProduct] = useState<StoreProductDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<number | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  const load = useCallback(() => {
    setError(null);
    setProduct(null);
    fetchProductDetail(api, slug)
      .then((p) => {
        setProduct(p);
        // Default to the first in-stock variant so a single-variant product
        // (the common case) needs no extra tap to add to cart.
        const firstInStock = p.variants.find((v) => v.in_stock);
        setSelectedVariantId(firstInStock ? firstInStock.id : null);
        setQuantity(1);
        setAdded(false);
      })
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
  const selectedVariant: ProductVariant | undefined = product.variants.find((v) => v.id === selectedVariantId);

  const handleAdd = () => {
    if (!selectedVariant) return;
    addItem(
      {
        variantId: selectedVariant.id,
        productId: product.id,
        productSlug: product.slug,
        productName: product.name,
        sku: selectedVariant.sku,
        size: selectedVariant.size,
        color: selectedVariant.color,
        unitPrice: selectedVariant.effective_price,
        stockQuantity: selectedVariant.stock_quantity,
        requiresPrescription: product.requires_prescription,
        image: images[0] ?? null,
      },
      quantity,
    );
    setAdded(true);
  };

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

      {product.variants.length ? (
        <View style={{ gap: 6 }}>
          <Text style={{ fontWeight: '600' }}>{t('selectSize', 'en')}</Text>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {product.variants.map((v) => (
              <TouchableOpacity
                key={v.id}
                accessibilityRole="button"
                accessibilityLabel={`${v.size} ${v.color}`}
                disabled={!v.in_stock}
                onPress={() => {
                  setSelectedVariantId(v.id);
                  setAdded(false);
                }}
                style={{
                  borderWidth: 1,
                  borderColor: selectedVariantId === v.id ? '#E8452B' : '#eee',
                  opacity: v.in_stock ? 1 : 0.4,
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 8,
                }}
              >
                <Text>{`${v.size} · ${v.effective_price}`}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ) : null}

      {selectedVariant ? (
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="decrease-quantity"
            onPress={() => setQuantity((q) => Math.max(1, q - 1))}
            style={{ borderWidth: 1, borderColor: '#eee', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 }}
          >
            <Text>-</Text>
          </TouchableOpacity>
          <Text>{quantity}</Text>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="increase-quantity"
            onPress={() => setQuantity((q) => q + 1)}
            style={{ borderWidth: 1, borderColor: '#eee', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 }}
          >
            <Text>+</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <Button
        title={added ? t('addedToCart', 'en') : t('addToCart', 'en')}
        disabled={!selectedVariant}
        onPress={handleAdd}
      />
      {added ? <Button title={t('viewCart', 'en')} onPress={() => router.push('/store/cart')} /> : null}
    </ScrollView>
  );
}
