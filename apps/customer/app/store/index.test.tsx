import { act, screen, waitFor } from '@testing-library/react-native';
import StoreHome from './index';
import { renderFlushed, pressFlushed } from '../../src/test-utils';

const mockFetchCategories = jest.fn();
const mockPush = jest.fn();

jest.mock('../../src/providers', () => ({ api: {} }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('@fabrything/core', () => ({
  ...jest.requireActual('@fabrything/core'),
  t: (k: string) => k,
  fetchCategories: (...args: unknown[]) => mockFetchCategories(...args),
}));

class FakeStoreApiError extends Error {
  errors: string[];
  status?: number;
  constructor(message: string, errors: string[] = [], status?: number) {
    super(message);
    this.errors = errors;
    this.status = status;
  }
}

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
  await renderFlushed(<StoreHome />);
  await waitFor(() => expect(screen.getByText('Men')).toBeTruthy());
});

test('navigates to the product list, passing the category slug', async () => {
  mockFetchCategories.mockResolvedValue([sampleCategory]);
  await renderFlushed(<StoreHome />);
  const row = await screen.findByText('Men');
  await pressFlushed(row);
  expect(mockPush).toHaveBeenCalledWith({
    pathname: '/store/products',
    params: { category: 'men', name: 'Men' },
  });
});

test('shows an empty state when there are no categories', async () => {
  mockFetchCategories.mockResolvedValue([]);
  await renderFlushed(<StoreHome />);
  await waitFor(() => expect(screen.getByText('noCategories')).toBeTruthy());
});

test('shows an error state with a retry action', async () => {
  mockFetchCategories.mockRejectedValue(new FakeStoreApiError('Server error', ['Server error'], 500));
  await renderFlushed(<StoreHome />);
  await waitFor(() => expect(screen.getByText('Server error')).toBeTruthy());
  expect(screen.getByText('retry')).toBeTruthy();
});

test('shows an offline hint when the request never reaches the server', async () => {
  mockFetchCategories.mockRejectedValue(new FakeStoreApiError('Network Error', []));
  await renderFlushed(<StoreHome />);
  await waitFor(() => expect(screen.getByText('offline')).toBeTruthy());
});

test('retry re-fetches and clears the error state on success', async () => {
  mockFetchCategories.mockRejectedValueOnce(new FakeStoreApiError('Server error', ['Server error'], 500));
  await renderFlushed(<StoreHome />);
  await waitFor(() => expect(screen.getByText('Server error')).toBeTruthy());

  mockFetchCategories.mockResolvedValueOnce([sampleCategory]);
  await pressFlushed(screen.getByText('retry'));
  await waitFor(() => expect(screen.getByText('Men')).toBeTruthy());
});

test('pull-to-refresh re-fetches the category list', async () => {
  mockFetchCategories.mockResolvedValueOnce([sampleCategory]);
  await renderFlushed(<StoreHome />);
  await waitFor(() => expect(screen.getByText('Men')).toBeTruthy());

  mockFetchCategories.mockResolvedValueOnce([{ ...sampleCategory, name: 'Women', slug: 'women' }]);
  const list = screen.getByTestId('category-list');
  await act(async () => {
    list.props.refreshControl.props.onRefresh();
    await new Promise<void>((resolve) => setImmediate(resolve));
  });
  await waitFor(() => expect(screen.getByText('Women')).toBeTruthy());
});
