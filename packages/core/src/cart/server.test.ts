import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { fetchServerCart, mergeCartOnLogin } from './server';
import { StoreApiError } from '../store/errors';
import { CartLine } from './types';

const sampleServerLine = {
  variant_id: 11,
  product_id: 1,
  product_name: 'Cotton Panjabi',
  product_slug: 'cotton-panjabi',
  sku: 'CP-M',
  size: 'M',
  color: 'White',
  unit_price: '999.00',
  stock_quantity: 5,
  quantity: 2,
};

const localLine: CartLine = {
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

describe('fetchServerCart', () => {
  test('reads the flat data envelope', async () => {
    const api = axios.create();
    const mock = new MockAdapter(api);
    mock.onGet('store/cart/').reply(200, { data: [sampleServerLine], message: 'Cart retrieved' });

    const items = await fetchServerCart(api);
    expect(items).toEqual([sampleServerLine]);
  });

  test('maps a failure to a StoreApiError', async () => {
    const api = axios.create();
    const mock = new MockAdapter(api);
    mock.onGet('store/cart/').reply(401, { errors: ['Not authenticated'], field_errors: {}, message: 'Unauthorized' });

    await expect(fetchServerCart(api)).rejects.toBeInstanceOf(StoreApiError);
  });
});

describe('mergeCartOnLogin — guest cart merged into the server cart on sign-in', () => {
  test('posts variant_id/quantity pairs and returns the merged server cart', async () => {
    const api = axios.create();
    const mock = new MockAdapter(api);
    mock.onPost('store/cart/merge/').reply((config) => {
      expect(JSON.parse(config.data)).toEqual({ items: [{ variant_id: 11, quantity: 2 }] });
      return [200, { data: [sampleServerLine], message: 'Cart merged' }];
    });

    const merged = await mergeCartOnLogin(api, [localLine]);
    expect(merged).toEqual([sampleServerLine]);
  });

  test('drops zero/invalid-quantity lines before posting', async () => {
    const api = axios.create();
    const mock = new MockAdapter(api);
    mock.onPost('store/cart/merge/').reply((config) => {
      expect(JSON.parse(config.data)).toEqual({ items: [] });
      return [200, { data: [], message: 'Cart merged' }];
    });

    await mergeCartOnLogin(api, [{ ...localLine, quantity: 0 }]);
  });

  test('maps a merge failure to a StoreApiError', async () => {
    const api = axios.create();
    const mock = new MockAdapter(api);
    mock.onPost('store/cart/merge/').reply(400, { errors: [], field_errors: { items: ['This field is required.'] }, message: 'Validation error' });

    await expect(mergeCartOnLogin(api, [localLine])).rejects.toBeInstanceOf(StoreApiError);
  });
});
