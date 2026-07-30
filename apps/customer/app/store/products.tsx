import { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, ActivityIndicator, TextInput, TouchableOpacity, Button, Image } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { fetchProducts, t, ProductOrdering, StoreProduct } from '@fabrything/core';
import { api } from '../../src/providers';

const PAGE_SIZE = 20;

const SORT_OPTIONS: { value: ProductOrdering; labelKey: 'sortNewest' | 'sortPriceLow' | 'sortPriceHigh' | 'sortName' }[] = [
  { value: 'newest', labelKey: 'sortNewest' },
  { value: 'price_low', labelKey: 'sortPriceLow' },
  { value: 'price_high', labelKey: 'sortPriceHigh' },
  { value: 'name', labelKey: 'sortName' },
];

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

// Product-list screen: search + sort + pagination, optionally scoped to a
// category (?category=<slug>&name=<display name>, set by the store home).
export default function ProductList() {
  const params = useLocalSearchParams<{ category?: string; name?: string }>();
  const router = useRouter();
  const category = firstParam(params.category);
  const categoryName = firstParam(params.name);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [ordering, setOrdering] = useState<ProductOrdering>('newest');
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    (targetPage: number, append: boolean) => {
      setLoading(true);
      setError(null);
      fetchProducts(api, { category, search, ordering, page: targetPage, pageSize: PAGE_SIZE })
        .then((res) => {
          setProducts((prev) => (append ? [...prev, ...res.items] : res.items));
          setTotalPages(res.totalPages);
          setPage(res.currentPage);
          setLoading(false);
        })
        .catch((e: { message?: string }) => {
          setError(e?.message || t('somethingWrong', 'en'));
          setLoading(false);
        });
    },
    [category, search, ordering],
  );

  useEffect(() => {
    load(1, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, search, ordering]);

  if (error) {
    return (
      <View style={{ padding: 24, gap: 12 }}>
        <Text>{error}</Text>
        <Button title={t('retry', 'en')} onPress={() => load(1, false)} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={{ padding: 12, gap: 8 }}>
        <TextInput
          value={searchInput}
          onChangeText={setSearchInput}
          onSubmitEditing={() => setSearch(searchInput)}
          placeholder={t('searchProducts', 'en')}
          style={{ borderWidth: 1, borderColor: '#eee', borderRadius: 8, padding: 10 }}
        />
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {SORT_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              accessibilityRole="button"
              onPress={() => setOrdering(opt.value)}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: ordering === opt.value ? '#E8452B' : '#eee',
              }}
            >
              <Text>{t(opt.labelKey, 'en')}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {loading && products.length === 0 ? (
        <ActivityIndicator style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={products}
          keyExtractor={(p) => String(p.id)}
          renderItem={({ item }) => (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={item.name}
              style={{ flexDirection: 'row', padding: 12, borderBottomWidth: 1, borderColor: '#eee', gap: 12 }}
              onPress={() => router.push({ pathname: '/store/product/[slug]', params: { slug: item.slug } })}
            >
              {item.image && item.image[0] ? (
                <Image source={{ uri: item.image[0] }} style={{ width: 64, height: 64, borderRadius: 8 }} />
              ) : (
                <View style={{ width: 64, height: 64, borderRadius: 8, backgroundColor: '#eee' }} />
              )}
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={{ fontSize: 16 }}>{item.name}</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Text style={{ fontWeight: '600' }}>{item.discount_price ?? item.initial_selling_price}</Text>
                  {item.discount_price ? (
                    <Text style={{ textDecorationLine: 'line-through', color: '#8C7B6E' }}>
                      {item.initial_selling_price}
                    </Text>
                  ) : null}
                  {item.requires_prescription ? <Text accessibilityLabel="Rx">Rx</Text> : null}
                </View>
              </View>
            </TouchableOpacity>
          )}
          ListHeaderComponent={categoryName ? <Text style={{ padding: 12, fontSize: 18 }}>{categoryName}</Text> : null}
          ListEmptyComponent={<Text style={{ padding: 24 }}>{t('noProducts', 'en')}</Text>}
          ListFooterComponent={
            page < totalPages ? (
              <Button title={t('loadMore', 'en')} onPress={() => load(page + 1, true)} />
            ) : null
          }
        />
      )}
    </View>
  );
}
