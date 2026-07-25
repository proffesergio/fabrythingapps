import { useEffect, useState } from 'react';
import { View, Text, FlatList, ActivityIndicator } from 'react-native';
import { api } from '../src/providers';

export default function Home() {
  const [rows, setRows] = useState<any[] | null>(null);
  useEffect(() => {
    api
      .get('food/restaurants/')
      .then((r) => setRows(r.data.data ?? r.data))
      .catch(() => setRows([]));
  }, []);
  if (rows === null) return <ActivityIndicator style={{ marginTop: 40 }} />;
  return (
    <FlatList
      data={rows}
      keyExtractor={(x) => String(x.id)}
      renderItem={({ item }) => (
        <View style={{ padding: 16, borderBottomWidth: 1, borderColor: '#eee' }}>
          <Text style={{ fontSize: 16 }}>{item.name}</Text>
        </View>
      )}
      ListEmptyComponent={<Text style={{ padding: 24 }}>No restaurants yet.</Text>}
    />
  );
}
