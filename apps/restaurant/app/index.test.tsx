import { render, screen, waitFor } from '@testing-library/react-native';
import Home from './index';

const mockUseAuth = jest.fn<{ role: string | null; loading: boolean }, []>(() => ({ role: 'Restaurant', loading: false }));

jest.mock('../src/providers', () => ({
  api: { get: jest.fn().mockResolvedValue({ data: { data: { name: 'Rahim Hotel', is_open: true } } }) },
}));
jest.mock('../src/push', () => ({ registerPush: jest.fn() }));
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { version: '1.0.0' } } }));
jest.mock('expo-router', () => ({
  Redirect: ({ href }: { href: string }) => {
    const { Text } = require('react-native');
    return <Text testID="redirect">{href}</Text>;
  },
}));
jest.mock('@fabrything/core', () => ({
  useAuth: () => mockUseAuth(),
  t: (k: string) => k,
  endpoints: { vendorRestaurant: 'food/vendor/restaurant/' },
  fetchMobileConfig: jest.fn().mockResolvedValue({ min_supported_version: { restaurant: '0.0.1' } }),
  isVersionSupported: () => true,
}));

afterEach(() => {
  mockUseAuth.mockReturnValue({ role: 'Restaurant', loading: false });
});

test('shows the vendor restaurant name', async () => {
  await render(<Home />);
  await waitFor(() => expect(screen.getByText('Rahim Hotel')).toBeTruthy());
});

test('redirects to login when unauthenticated', async () => {
  mockUseAuth.mockReturnValue({ role: null, loading: false });
  const { getByTestId, queryByText } = await render(<Home />);
  expect(getByTestId('redirect')).toBeTruthy();
  expect(queryByText('Rahim Hotel')).toBeNull();
});
