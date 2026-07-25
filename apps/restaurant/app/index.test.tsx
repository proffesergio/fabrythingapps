import { render, screen, waitFor } from '@testing-library/react-native';
import Home from './index';

jest.mock('../src/providers', () => ({
  api: { get: jest.fn().mockResolvedValue({ data: { data: { name: 'Rahim Hotel', is_open: true } } }) },
}));
jest.mock('@fabrything/core', () => ({ useAuth: () => ({ role: 'Restaurant' }), t: (k: string) => k }));

test('shows the vendor restaurant name', async () => {
  render(<Home />);
  await waitFor(() => expect(screen.getByText('Rahim Hotel')).toBeTruthy());
});
