import { render, screen, waitFor, fireEvent } from '@testing-library/react-native';
import ProductList from './products';

const mockFetchProducts = jest.fn();
const mockPush = jest.fn();

jest.mock('../../src/providers', () => ({ api: {} }));
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  useLocalSearchParams: () => ({ category: 'men', name: 'Men' }),
}));
jest.mock('@fabrything/core', () => ({
  t: (k: string) => k,
  fetchProducts: (...args: unknown[]) => mockFetchProducts(...args),
}));

afterEach(() => {
  mockFetchProducts.mockReset();
  mockPush.mockReset();
});

const sampleProduct = {
  id: 1,
  name: 'Cotton Panjabi',
  slug: 'cotton-panjabi',
  image: [],
  description: 'A comfy panjabi',
  initial_selling_price: '1200.00',
  discount_price: '999.00',
  color: 'White',
  brand: 'Fabrilife',
  gender: 'Men',
  available_sizes: ['M'],
  material: 'Cotton',
  generic_name: null,
  strength: null,
  dosage_form: null,
  manufacturer: null,
  pack_size: null,
  requires_prescription: false,
  category_id: 3,
  category_name: 'Panjabi',
  average_rating: 4.5,
  review_count: 10,
  discount_percentage: 17,
  total_stock: 25,
  created_at: '2026-07-01T00:00:00Z',
  shipping_fee: null,
  effective_shipping_fee: 60,
  free_shipping: false,
};

test('renders products from the API, scoped to the category param', async () => {
  mockFetchProducts.mockResolvedValue({ items: [sampleProduct], totalPages: 1, totalItems: 1, currentPage: 1, pageSize: 20 });
  await render(<ProductList />);
  await waitFor(() => expect(screen.getByText('Cotton Panjabi')).toBeTruthy());
  expect(mockFetchProducts).toHaveBeenCalledWith(
    {},
    expect.objectContaining({ category: 'men', ordering: 'newest', page: 1 }),
  );
});

test('flags a prescription-only product instead of hiding it', async () => {
  mockFetchProducts.mockResolvedValue({
    items: [{ ...sampleProduct, id: 2, name: 'Paracetamol', requires_prescription: true }],
    totalPages: 1,
    totalItems: 1,
    currentPage: 1,
    pageSize: 20,
  });
  await render(<ProductList />);
  await waitFor(() => expect(screen.getByText('Paracetamol')).toBeTruthy());
  expect(screen.getByText('Rx')).toBeTruthy();
});

test('shows a Load more footer when another page exists and fetches it on press', async () => {
  mockFetchProducts.mockResolvedValueOnce({ items: [sampleProduct], totalPages: 2, totalItems: 21, currentPage: 1, pageSize: 20 });
  await render(<ProductList />);
  await waitFor(() => expect(screen.getByText('Cotton Panjabi')).toBeTruthy());

  mockFetchProducts.mockResolvedValueOnce({
    items: [{ ...sampleProduct, id: 99, name: 'Second Page Item' }],
    totalPages: 2,
    totalItems: 21,
    currentPage: 2,
    pageSize: 20,
  });
  fireEvent.press(screen.getByText('loadMore'));
  await waitFor(() => expect(screen.getByText('Second Page Item')).toBeTruthy());
  // Both pages stay in the list — Load more appends rather than replaces.
  expect(screen.getByText('Cotton Panjabi')).toBeTruthy();
});

test('shows an empty state when there are no products', async () => {
  mockFetchProducts.mockResolvedValue({ items: [], totalPages: 1, totalItems: 0, currentPage: 1, pageSize: 20 });
  await render(<ProductList />);
  await waitFor(() => expect(screen.getByText('noProducts')).toBeTruthy());
});

test('shows an error state with a retry action', async () => {
  mockFetchProducts.mockRejectedValue(new Error('Network down'));
  await render(<ProductList />);
  await waitFor(() => expect(screen.getByText('Network down')).toBeTruthy());
  expect(screen.getByText('retry')).toBeTruthy();
});
