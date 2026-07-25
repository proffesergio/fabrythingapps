import { Stack } from 'expo-router';
import { Providers } from '../src/providers';

export default function Root() {
  return (
    <Providers>
      <Stack screenOptions={{ headerTitle: 'Fabrything Partner' }} />
    </Providers>
  );
}
