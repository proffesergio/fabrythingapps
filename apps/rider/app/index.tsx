import { useEffect, useState } from 'react';
import { View, Text, Switch, ActivityIndicator } from 'react-native';
import { api } from '../src/providers';

export default function Home() {
  const [rider, setRider] = useState<any | null>(null);
  const [sharing, setSharing] = useState(false);
  useEffect(() => {
    api.get('food/rider/me/').then((r) => {
      const d = r.data.data ?? r.data;
      setRider(d);
      setSharing(!!d.is_sharing_location);
    });
  }, []);
  const toggle = async (v: boolean) => {
    setSharing(v);
    await api.post('food/rider/privacy/', { is_sharing_location: v });
  };
  if (!rider) return <ActivityIndicator style={{ marginTop: 40 }} />;
  return (
    <View style={{ padding: 24, gap: 16 }}>
      <Text style={{ fontSize: 20 }}>{rider.name}</Text>
      <Text>Available: {String(rider.is_available)}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text>Share location</Text>
        <Switch value={sharing} onValueChange={toggle} />
      </View>
    </View>
  );
}
