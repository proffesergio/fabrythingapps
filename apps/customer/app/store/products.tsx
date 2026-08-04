import { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, Image, RefreshControl, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { fetchProducts, isNetworkError, t, ProductOrdering, StoreProduct, StoreApiError } from '@fabrything/core';
import { api } from '../../src/providers';
import { EmptyView, ErrorView, LoadingView, MIN_TAP_TARGET } from '../../src/components/StateViews';

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

// `fetchProducts` always rejects with a `StoreApiError` (see
// `toStoreApiError`), so a real network failure (offline/DNS/timeout, no
// HTTP response at all) is distinguished from the server answering with an
// error -- a raw axios message like "Network Error" means nothing to a
// customer, so it's replaced with a clear "you appear to be offline".
function messageFor(error: unknown): string {
  const err = error as StoreApiError;
  return isNetworkError(err) ? t('offline', 'en') : err.errors?.[0] || err.message || t('somethingWrong', 'en');
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
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (targetPage: number, mode: 'initial' | 'refresh' | 'append' = 'initial') => {
      if (mode === 'refresh') setRefreshing(true);
      else if (mode === 'append') setLoadingMore(true);
      else setLoading(true);
      setError(null);
      try {
        const res = await fetchProducts(api, { category, search, ordering, page: targetPage, pageSize: PAGE_SIZE });
        setProducts((prev) => (mode === 'append' ? [...prev, ...res.items] : res.items));
        setTotalPages(res.totalPages);
        setPage(res.currentPage);
      } catch (e) {
        setError(messageFor(e));
      } finally {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    [category, search, ordering],
  );

  useEffect(() => {
    load(1, 'initial');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, search, ordering]);

  if (loading && products.length === 0 && !error) {
    return <LoadingView />;
  }

  if (error && products.length === 0) {
    return <ErrorView message={error} onRetry={() => load(1, 'initial')} />;
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={{ padding: 12, gap: 8 }}>
        <TextInput
          value={searchInput}
          onChangeText={setSearchInput}
          onSubmitEditing={() => setSearch(searchInput)}
          placeholder={t('searchProducts', 'en')}
          accessibilityLabel={t('searchProducts', 'en')}
          style={{ borderWidth: 1, borderColor: '#eee', borderRadius: 8, padding: 10, minHeight: 44 }}
        />
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {SORT_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              accessibilityRole="button"
              accessibilityLabel={t(opt.labelKey, 'en')}
              accessibilityState={{ selected: ordering === opt.value }}
              onPress={() => setOrdering(opt.value)}
              style={{
                paddingHorizontal: 12,
                minHeight: 40,
                justifyContent: 'center',
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

      <FlatList
        testID="product-list"
        data={products}
        keyExtractor={(p) => String(p.id)}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(1, 'refresh')} accessibilityLabel={t('pullToRefresh', 'en')} />
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={item.name}
            style={{ flexDirection: 'row', padding: 12, borderBottomWidth: 1, borderColor: '#eee', gap: 12, minHeight: MIN_TAP_TARGET }}
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
                {item.requires_prescription ? (
                  <Text accessibilityLabel={t('prescriptionRequired', 'en')}>{t('rxBadge', 'en')}</Text>
                ) : null}
              </View>
            </View>
          </TouchableOpacity>
        )}
        ListHeaderComponent={categoryName ? <Text style={{ padding: 12, fontSize: 18 }}>{categoryName}</Text> : null}
        ListEmptyComponent={<EmptyView message={t('noProducts', 'en')} />}
        ListFooterComponent={
          page < totalPages ? (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={t('loadMore', 'en')}
              disabled={loadingMore}
              onPress={() => load(page + 1, 'append')}
              style={{ minHeight: MIN_TAP_TARGET, alignItems: 'center', justifyContent: 'center', padding: 12 }}
            >
              {loadingMore ? (
                <ActivityIndicator color="#E8452B" />
              ) : (
                <Text style={{ color: '#E8452B', fontWeight: '600' }}>{t('loadMore', 'en')}</Text>
              )}
            </TouchableOpacity>
          ) : null
        }
      />
    </View>
  );
}
