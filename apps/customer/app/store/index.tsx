import { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { fetchCategories, isNetworkError, t, StoreApiError, StoreCategory } from '@fabrything/core';
import { api } from '../../src/providers';
import { EmptyView, ErrorView, LoadingView, MIN_TAP_TARGET } from '../../src/components/StateViews';

function messageFor(error: unknown): string {
  const err = error as StoreApiError;
  return isNetworkError(err) ? t('offline', 'en') : err.errors?.[0] || err.message || t('somethingWrong', 'en');
}

// Public store home: lists top-level categories (store/categories/ is
// AllowAny, unpaginated/flat — no auth gate here, unlike the food home).
export default function StoreHome() {
  const router = useRouter();
  const [categories, setCategories] = useState<StoreCategory[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    if (mode === 'refresh') setRefreshing(true);
    setError(null);
    try {
      const cats = await fetchCategories(api);
      setCategories(cats);
    } catch (e) {
      setError(messageFor(e));
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load('initial');
  }, [load]);

  if (error && categories === null) {
    return <ErrorView message={error} onRetry={() => load('initial')} />;
  }

  if (categories === null) return <LoadingView />;

  return (
    <FlatList
      testID="category-list"
      data={categories}
      keyExtractor={(c) => String(c.id)}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => load('refresh')} accessibilityLabel={t('pullToRefresh', 'en')} />
      }
      renderItem={({ item }) => (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={item.name}
          style={{ padding: 16, minHeight: MIN_TAP_TARGET, justifyContent: 'center', borderBottomWidth: 1, borderColor: '#eee' }}
          onPress={() =>
            router.push({ pathname: '/store/products', params: { category: item.slug, name: item.name } })
          }
        >
          <Text style={{ fontSize: 16 }}>{item.name}</Text>
          <Text style={{ color: '#8C7B6E' }}>{item.product_count}</Text>
        </TouchableOpacity>
      )}
      ListEmptyComponent={<EmptyView message={t('noCategories', 'en')} />}
    />
  );
}
