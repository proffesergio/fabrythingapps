import { render, screen, waitFor, fireEvent } from '@testing-library/react-native';
import StoreHome from './index';

const mockFetchCategories = jest.fn();
const mockPush = jest.fn();

jest.mock('../../src/providers', () => ({ api: {} }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('@fabrything/core', () => ({
  t: (k: string) => k,
  fetchCategories: (...args: unknown[]) => mockFetchCategories(...args),
}));

afterEach(() => {
  mockFetchCategories.mockReset();
  mockPush.mockReset();
});

const sampleCategory = {
  id: 1,
  name: 'Men',
  slug: 'men',
  image: null,
  description: '',
  display_order: 1,
  children: [],
  product_count: 5,
};

test('renders categories from the API', async () => {
  mockFetchCategories.mockResolvedValue([sampleCategory]);
  await render(<StoreHome />);
  await waitFor(() => expect(screen.getByText('Men')).toBeTruthy());
});

test('navigates to the product list, passing the category slug', async () => {
  mockFetchCategories.mockResolvedValue([sampleCategory]);
  await render(<StoreHome />);
  const row = await screen.findByText('Men');
  fireEvent.press(row);
  expect(mockPush).toHaveBeenCalledWith({
    pathname: '/store/products',
    params: { category: 'men', name: 'Men' },
  });
});

test('shows an empty state when there are no categories', async () => {
  mockFetchCategories.mockResolvedValue([]);
  await render(<StoreHome />);
  await waitFor(() => expect(screen.getByText('noCategories')).toBeTruthy());
});

test('shows an error state with a retry action', async () => {
  mockFetchCategories.mockRejectedValue(new Error('Network down'));
  await render(<StoreHome />);
  await waitFor(() => expect(screen.getByText('Network down')).toBeTruthy());
  expect(screen.getByText('retry')).toBeTruthy();
});
