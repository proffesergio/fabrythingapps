import { render, screen, waitFor } from '@testing-library/react-native';
import Home from './index';

jest.mock('../src/providers', () => ({
  api: { get: jest.fn().mockResolvedValue({ data: { data: [{ id: 1, name: 'Rahim Hotel', slug: 'rahim' }] } }) },
}));
jest.mock('@fabrything/core', () => ({ useAuth: () => ({ role: 'Customer' }), t: (k: string) => k }));

test('renders a restaurant from the API', async () => {
  render(<Home />);
  await waitFor(() => expect(screen.getByText('Rahim Hotel')).toBeTruthy());
});
