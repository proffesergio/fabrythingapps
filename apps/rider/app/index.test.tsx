import { render, screen, waitFor } from '@testing-library/react-native';
import Home from './index';

jest.mock('../src/providers', () => ({
  api: {
    get: jest.fn().mockResolvedValue({ data: { data: { name: 'R1', is_available: true, is_sharing_location: false } } }),
    post: jest.fn().mockResolvedValue({ data: { data: { is_sharing_location: true } } }),
  },
}));
jest.mock('@fabrything/core', () => ({ useAuth: () => ({ role: 'Rider' }), t: (k: string) => k }));

test('shows rider name and a share-location control', async () => {
  render(<Home />);
  await waitFor(() => expect(screen.getByText('R1')).toBeTruthy());
  expect(screen.getByText(/share location/i)).toBeTruthy();
});
