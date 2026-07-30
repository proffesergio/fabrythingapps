import { render, screen, waitFor, fireEvent } from '@testing-library/react-native';
import ProductDetail from './[slug]';

const mockFetchProductDetail = jest.fn();
const mockAddItem = jest.fn();
const mockPush = jest.fn();

jest.mock('../../../src/providers', () => ({ api: {} }));
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ slug: 'cotton-panjabi' }),
  useRouter: () => ({ push: mockPush }),
}));
jest.mock('@fabrything/core', () => ({
  t: (k: string) => k,
  fetchProductDetail: (...args: unknown[]) => mockFetchProductDetail(...args),
  useCart: () => ({ addItem: mockAddItem }),
}));

afterEach(() => {
  mockFetchProductDetail.mockReset();
  mockAddItem.mockReset();
  mockPush.mockReset();
});

const sampleDetail = {
  id: 1,
  name: 'Cotton Panjabi',
  slug: 'cotton-panjabi',
  image: ['https://fabrythingweb.onrender.com/api/media/abc/'],
  description: 'A comfy panjabi',
  html_description: '<p>A comfy panjabi</p>',
  specifications: {},
  highlights: ['100% cotton'],
  initial_selling_price: '1200.00',
  discount_price: '999.00',
  tax_percentage: '0.00',
  color: 'White',
  brand: 'Fabrilife',
  brand_model: null,
  gender: 'Men',
  available_sizes: ['S', 'M', 'L'],
  size_chart: {},
  material: 'Cotton',
  generic_name: null,
  strength: null,
  dosage_form: null,
  manufacturer: null,
  pack_size: null,
  requires_prescription: false,
  seo_title: null,
  seo_description: null,
  seo_keywords: null,
  category_id: 3,
  category_name: 'Panjabi',
  average_rating: 4.5,
  review_count: 10,
  discount_percentage: 17,
  total_stock: 25,
  variants: [
    { id: 11, sku: 'CP-M', size: 'M', color: 'White', price: '1200.00', discount_price: '999.00', effective_price: '999.00', stock_quantity: 5, in_stock: true },
  ],
  rating_distribution: { '5': 100, '4': 0, '3': 0, '2': 0, '1': 0 },
  reviews: [],
  questions: [],
  related_products: [],
  created_at: '2026-07-01T00:00:00Z',
  shipping_fee: null,
  effective_shipping_fee: 60,
  free_shipping: false,
};

test('renders gallery, price with discount, sizes, stock and shipping note', async () => {
  mockFetchProductDetail.mockResolvedValue(sampleDetail);
  await render(<ProductDetail />);
  await waitFor(() => expect(screen.getByText('Cotton Panjabi')).toBeTruthy());

  expect(screen.getByText('999.00')).toBeTruthy();
  expect(screen.getByText('1200.00')).toBeTruthy();
  expect(screen.getByText('S')).toBeTruthy();
  expect(screen.getByText('M')).toBeTruthy();
  expect(screen.getByText('L')).toBeTruthy();
  expect(screen.getByText('inStock')).toBeTruthy();
  expect(screen.getByText(/shippingFee/)).toBeTruthy();
});

test('surfaces the Rx state instead of hiding the product', async () => {
  mockFetchProductDetail.mockResolvedValue({ ...sampleDetail, requires_prescription: true });
  await render(<ProductDetail />);
  await waitFor(() => expect(screen.getByText('Cotton Panjabi')).toBeTruthy());
  expect(screen.getByText('prescriptionRequired')).toBeTruthy();
});

test('shows out-of-stock state when total_stock is zero', async () => {
  mockFetchProductDetail.mockResolvedValue({ ...sampleDetail, total_stock: 0 });
  await render(<ProductDetail />);
  await waitFor(() => expect(screen.getByText('outOfStock')).toBeTruthy());
});

test('shows an error state with a retry action', async () => {
  mockFetchProductDetail.mockRejectedValue(new Error('Network down'));
  await render(<ProductDetail />);
  await waitFor(() => expect(screen.getByText('Network down')).toBeTruthy());
  expect(screen.getByText('retry')).toBeTruthy();
});

test('adding to cart passes the selected variant identity, not the product', async () => {
  mockFetchProductDetail.mockResolvedValue(sampleDetail);
  await render(<ProductDetail />);
  await waitFor(() => expect(screen.getByText('Cotton Panjabi')).toBeTruthy());

  fireEvent.press(screen.getByText('addToCart'));

  expect(mockAddItem).toHaveBeenCalledWith(
    expect.objectContaining({
      variantId: 11,
      productId: 1,
      sku: 'CP-M',
      size: 'M',
      unitPrice: '999.00',
    }),
    1,
  );
  await waitFor(() => expect(screen.getByText('addedToCart')).toBeTruthy());
});

test('view cart navigates to /store/cart after adding', async () => {
  mockFetchProductDetail.mockResolvedValue(sampleDetail);
  await render(<ProductDetail />);
  await waitFor(() => expect(screen.getByText('Cotton Panjabi')).toBeTruthy());

  fireEvent.press(screen.getByText('addToCart'));
  await waitFor(() => expect(screen.getByText('viewCart')).toBeTruthy());
  fireEvent.press(screen.getByText('viewCart'));

  expect(mockPush).toHaveBeenCalledWith('/store/cart');
});
