import { render, screen, fireEvent } from '@testing-library/react-native';
import Cart from './cart';

const mockPush = jest.fn();
const mockUpdateQuantity = jest.fn();
const mockRemoveItem = jest.fn();
let mockCartState: { lines: unknown[]; totals: { itemCount: number; subtotal: number } };

jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('@fabrything/core', () => ({
  t: (k: string) => k,
  useCart: () => ({
    lines: mockCartState.lines,
    totals: mockCartState.totals,
    updateQuantity: mockUpdateQuantity,
    removeItem: mockRemoveItem,
  }),
}));

const line = {
  variantId: 11,
  productId: 1,
  productSlug: 'cotton-panjabi',
  productName: 'Cotton Panjabi',
  sku: 'CP-M',
  size: 'M',
  color: 'White',
  unitPrice: '999.00',
  quantity: 2,
  stockQuantity: 5,
  requiresPrescription: false,
  image: null,
};

afterEach(() => {
  mockPush.mockReset();
  mockUpdateQuantity.mockReset();
  mockRemoveItem.mockReset();
});

test('shows the empty state when the cart has no lines', async () => {
  mockCartState = { lines: [], totals: { itemCount: 0, subtotal: 0 } };
  await render(<Cart />);
  expect(screen.getByText('emptyCart')).toBeTruthy();
});

test('renders a line with variant details, subtotal and the shipping note', async () => {
  mockCartState = { lines: [line], totals: { itemCount: 2, subtotal: 1998 } };
  await render(<Cart />);
  expect(screen.getByText('Cotton Panjabi')).toBeTruthy();
  expect(screen.getByText(/M/)).toBeTruthy();
  expect(screen.getByText('999.00')).toBeTruthy();
  expect(screen.getByText('1998.00')).toBeTruthy();
  expect(screen.getByText('shippingCalculatedAtCheckout')).toBeTruthy();
});

test('increasing quantity calls updateQuantity with quantity + 1', async () => {
  mockCartState = { lines: [line], totals: { itemCount: 2, subtotal: 1998 } };
  await render(<Cart />);
  fireEvent.press(screen.getByLabelText('increase-11'));
  expect(mockUpdateQuantity).toHaveBeenCalledWith(11, 3);
});

test('decreasing quantity calls updateQuantity with quantity - 1', async () => {
  mockCartState = { lines: [line], totals: { itemCount: 2, subtotal: 1998 } };
  await render(<Cart />);
  fireEvent.press(screen.getByLabelText('decrease-11'));
  expect(mockUpdateQuantity).toHaveBeenCalledWith(11, 1);
});

test('remove calls removeItem for the right variant', async () => {
  mockCartState = { lines: [line], totals: { itemCount: 2, subtotal: 1998 } };
  await render(<Cart />);
  fireEvent.press(screen.getByText('remove'));
  expect(mockRemoveItem).toHaveBeenCalledWith(11);
});

test('proceed to checkout navigates to /store/checkout', async () => {
  mockCartState = { lines: [line], totals: { itemCount: 2, subtotal: 1998 } };
  await render(<Cart />);
  fireEvent.press(screen.getByText('proceedToCheckout'));
  expect(mockPush).toHaveBeenCalledWith('/store/checkout');
});
