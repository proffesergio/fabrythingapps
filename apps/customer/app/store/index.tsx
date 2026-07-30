import { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, ActivityIndicator, TouchableOpacity, Button } from 'react-native';
import { useRouter } from 'expo-router';
import { fetchCategories, t, StoreCategory } from '@fabrything/core';
import { api } from '../../src/providers';

// Public store home: lists top-level categories (store/categories/ is
// AllowAny, unpaginated/flat — no auth gate here, unlike the food home).
export default function StoreHome() {
  const router = useRouter();
  const [categories, setCategories] = useState<StoreCategory[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    setCategories(null);
    fetchCategories(api)
      .then(setCategories)
      .catch((e: { message?: string }) => setError(e?.message || t('somethingWrong', 'en')));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (error) {
    return (
      <View style={{ padding: 24, alignItems: 'flex-start', gap: 12 }}>
        <Text>{error}</Text>
        <Button title={t('retry', 'en')} onPress={load} />
      </View>
    );
  }

  if (categories === null) return <ActivityIndicator style={{ marginTop: 40 }} />;

  return (
    <FlatList
      data={categories}
      keyExtractor={(c) => String(c.id)}
      renderItem={({ item }) => (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={item.name}
          style={{ padding: 16, borderBottomWidth: 1, borderColor: '#eee' }}
          onPress={() =>
            router.push({ pathname: '/store/products', params: { category: item.slug, name: item.name } })
          }
        >
          <Text style={{ fontSize: 16 }}>{item.name}</Text>
          <Text style={{ color: '#8C7B6E' }}>{item.product_count}</Text>
        </TouchableOpacity>
      )}
      ListEmptyComponent={<Text style={{ padding: 24 }}>{t('noCategories', 'en')}</Text>}
    />
  );
}
