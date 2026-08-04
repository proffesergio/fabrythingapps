import { render, screen, waitFor } from '@testing-library/react-native';
import Home from './index';

const mockUseAuth = jest.fn<{ role: string | null; loading: boolean }, []>(() => ({ role: 'Rider', loading: false }));

jest.mock('../src/providers', () => ({
  api: {
    get: jest.fn().mockResolvedValue({ data: { data: { name: 'R1', is_available: true, is_sharing_location: false } } }),
    post: jest.fn().mockResolvedValue({ data: { data: { is_sharing_location: true } } }),
  },
}));
jest.mock('../src/push', () => ({ registerPush: jest.fn() }));
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { version: '1.0.0' } } }));
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
  Redirect: ({ href }: { href: string }) => {
    const { Text } = require('react-native');
    return <Text testID="redirect">{href}</Text>;
  },
}));
jest.mock('@fabrything/core', () => ({
  useAuth: () => mockUseAuth(),
  t: (k: string) => k,
  endpoints: { riderMe: 'food/rider/me/', riderPrivacy: 'food/rider/privacy/' },
  fetchMobileConfig: jest.fn().mockResolvedValue({ min_supported_version: { rider: '0.0.1' } }),
  isVersionSupported: () => true,
}));

afterEach(() => {
  mockUseAuth.mockReturnValue({ role: 'Rider', loading: false });
});

test('shows rider name and a share-location control', async () => {
  await render(<Home />);
  await waitFor(() => expect(screen.getByText('R1')).toBeTruthy());
  // `t` is mocked to the identity function here, so the i18n key is what renders.
  expect(screen.getByLabelText('shareLocation')).toBeTruthy();
});

test('redirects to login when unauthenticated', async () => {
  mockUseAuth.mockReturnValue({ role: null, loading: false });
  const { getByTestId, queryByText } = await render(<Home />);
  expect(getByTestId('redirect')).toBeTruthy();
  expect(queryByText('R1')).toBeNull();
});
