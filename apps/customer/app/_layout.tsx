import { View } from 'react-native';
import { Stack } from 'expo-router';
import { Providers } from '../src/providers';
import { CartHeaderButton } from '../src/CartHeaderButton';
import { FoodCartHeaderButton } from '../src/FoodCartHeaderButton';
import { OrdersHeaderButton } from '../src/OrdersHeaderButton';

// Each cart button renders only on its own surface (see the components), so
// exactly one of them is visible at a time.
function HeaderActions() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <OrdersHeaderButton />
      <CartHeaderButton />
      <FoodCartHeaderButton />
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
