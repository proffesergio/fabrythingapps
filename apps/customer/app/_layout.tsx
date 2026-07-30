import { Stack } from 'expo-router';
import { Providers } from '../src/providers';
import { CartHeaderButton } from '../src/CartHeaderButton';

export default function Root() {
  return (
    <Providers>
      <Stack screenOptions={{ headerTitle: 'Fabrything', headerRight: () => <CartHeaderButton /> }} />
    </Providers>
  );
}
