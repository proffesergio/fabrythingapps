import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { fetchProductDetail, fetchProducts } from './index';
import { buildProductQuery } from './query';
import { StoreApiError } from '../errors';

const sampleListProduct = {
  id: 1,
  name: 'Cotton Panjabi',
  slug: 'cotton-panjabi',
  image: ['https://fabrythingweb.onrender.com/api/media/abc123/'],
  description: 'A comfy panjabi',
  initial_selling_price: '1200.00',
  discount_price: '999.00',
  color: 'White',
  brand: 'Fabrilife',
  gender: 'Men',
  available_sizes: ['S', 'M', 'L'],
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

describe('buildProductQuery', () => {
  test('builds a query string in a stable order', () => {
    expect(
      buildProductQuery({ category: 'men', search: 'panjabi', ordering: 'price_low', page: 2, pageSize: 10 }),
    ).toBe('?category=men&search=panjabi&ordering=price_low&page=2&pageSize=10');
  });

  test('omits empty, undefined and zero-length params', () => {
    expect(buildProductQuery({ category: '', search: undefined, page: undefined })).toBe('');
  });

  test('returns an empty string for no params at all', () => {
    expect(buildProductQuery()).toBe('');
  });
});

describe('fetchProducts', () => {
  test('unwraps the nested storefront list envelope', async () => {
    const api = axios.create();
    const mock = new MockAdapter(api);
    mock.onGet('store/products/?category=men').reply(200, {
      data: {
        data: [sampleListProduct],
        totalPages: 3,
        totalItems: 25,
        currentPage: 1,
        pageSize: 10,
      },
      message: 'Data Retrieved Successfully',
    });

    const result = await fetchProducts(api, { category: 'men' });

    expect(result.totalPages).toBe(3);
    expect(result.totalItems).toBe(25);
    expect(result.currentPage).toBe(1);
    expect(result.pageSize).toBe(10);
    expect(result.items).toHaveLength(1);

    // The product type must carry what the screens need.
    const product = result.items[0];
    expect(product.initial_selling_price).toBe('1200.00');
    expect(product.discount_price).toBe('999.00');
    expect(product.image).toEqual(['https://fabrythingweb.onrender.com/api/media/abc123/']);
    expect(product.available_sizes).toEqual(['S', 'M', 'L']);
    expect(product.total_stock).toBe(25);
    expect(product.effective_shipping_fee).toBe(60);
    expect(product.free_shipping).toBe(false);
    expect(product.requires_prescription).toBe(false);
  });

  test('maps a non-2xx response to a StoreApiError', async () => {
    const api = axios.create();
    const mock = new MockAdapter(api);
    mock.onGet('store/products/').reply(500, { errors: ['Server error'], field_errors: {}, message: 'Failed' });

    await expect(fetchProducts(api)).rejects.toBeInstanceOf(StoreApiError);
  });
});

describe('fetchProductDetail', () => {
  test('unwraps the flat product-detail envelope and carries variant/stock/rx fields', async () => {
    const api = axios.create();
    const mock = new MockAdapter(api);
    mock.onGet('store/products/cotton-panjabi/').reply(200, {
      data: {
        ...sampleListProduct,
        html_description: '<p>A comfy panjabi</p>',
        specifications: {},
        highlights: ['100% cotton'],
        tax_percentage: '0.00',
        brand_model: null,
        size_chart: { M: { chest: 40 } },
        seo_title: null,
        seo_description: null,
        seo_keywords: null,
        variants: [
          {
            id: 11,
            sku: 'CP-M',
            size: 'M',
            color: 'White',
            price: '1200.00',
            discount_price: '999.00',
            effective_price: '999.00',
            stock_quantity: 5,
            in_stock: true,
          },
        ],
        rating_distribution: { '5': 80, '4': 20, '3': 0, '2': 0, '1': 0 },
        reviews: [],
        questions: [],
        related_products: [],
      },
      message: 'Product retrieved successfully',
    });

    const product = await fetchProductDetail(api, 'cotton-panjabi');

    expect(product.slug).toBe('cotton-panjabi');
    expect(product.variants).toHaveLength(1);
    expect(product.variants[0].effective_price).toBe('999.00');
    expect(product.variants[0].stock_quantity).toBe(5);
    expect(product.requires_prescription).toBe(false);
    expect(product.shipping_fee).toBeNull();
    expect(product.effective_shipping_fee).toBe(60);
  });

  test('maps a 404 to a StoreApiError', async () => {
    const api = axios.create();
    const mock = new MockAdapter(api);
    mock.onGet('store/products/missing/').reply(404, { errors: ['Product not found'], field_errors: {}, message: 'Product not found' });

    await expect(fetchProductDetail(api, 'missing')).rejects.toMatchObject({ message: 'Product not found' });
  });
});
