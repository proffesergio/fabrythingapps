import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { api } from '../src/providers';

export default function Home() {
  const [r, setR] = useState<any | null>(null);
  useEffect(() => {
    api.get('food/vendor/restaurant/').then((res) => setR(res.data.data ?? res.data));
  }, []);
  if (!r) return <ActivityIndicator style={{ marginTop: 40 }} />;
  return (
    <View style={{ padding: 24, gap: 8 }}>
      <Text style={{ fontSize: 20 }}>{r.name}</Text>
      <Text>{r.is_open ? 'Open' : 'Closed'}</Text>
    </View>
  );
}
