import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { t } from '@fabrything/core';

// App entry point. Task 2 built the `/store/*` screens but nothing linked to
// them, so they were unreachable -- the app opened straight on the
// food-oriented screen (now moved to `/food`, unchanged). This hub reaches
// both surfaces and, unlike `/food`, does not force a login: store browsing
// (categories/products) is a public, AllowAny API, so a guest can shop before
// ever signing in.
export default function Hub() {
  const router = useRouter();
  return (
    <View style={{ flex: 1, padding: 24, gap: 16, justifyContent: 'center' }}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={t('browseStore', 'en')}
        style={{ padding: 20, borderRadius: 12, backgroundColor: '#E8452B' }}
        onPress={() => router.push('/store')}
      >
        <Text style={{ color: '#fff', fontSize: 18, fontWeight: '600', textAlign: 'center' }}>
          {t('browseStore', 'en')}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={t('orderFood', 'en')}
        style={{ padding: 20, borderRadius: 12, borderWidth: 1, borderColor: '#E8452B' }}
        onPress={() => router.push('/food')}
      >
        <Text style={{ color: '#E8452B', fontSize: 18, fontWeight: '600', textAlign: 'center' }}>
          {t('orderFood', 'en')}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
