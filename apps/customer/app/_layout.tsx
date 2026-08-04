import { View } from 'react-native';
import { Stack } from 'expo-router';
import { Providers } from '../src/providers';
import { CartHeaderButton } from '../src/CartHeaderButton';
import { OrdersHeaderButton } from '../src/OrdersHeaderButton';

function HeaderActions() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <OrdersHeaderButton />
      <CartHeaderButton />
    </View>
  );
}

export default function Root() {
  return (
    <Providers>
      <Stack screenOptions={{ headerTitle: 'Fabrything', headerRight: () => <HeaderActions /> }} />
    </Providers>
  );
}
