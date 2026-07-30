import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { fetchCategories } from './index';
import { StoreApiError } from '../errors';

test('unwraps the flat category-list envelope (categories are not paginated)', async () => {
  const api = axios.create();
  const mock = new MockAdapter(api);
  mock.onGet('store/categories/').reply(200, {
    data: [
      {
        id: 1,
        name: 'Men',
        slug: 'men',
        image: ['https://fabrythingweb.onrender.com/api/media/cat1/'],
        description: '',
        display_order: 1,
        children: [
          { id: 2, name: 'Panjabi', slug: 'panjabi', image: null, description: '', display_order: 1, children: [], product_count: 12 },
        ],
        product_count: 40,
      },
    ],
    message: 'Categories retrieved successfully',
  });

  const categories = await fetchCategories(api);

  expect(categories).toHaveLength(1);
  expect(categories[0].slug).toBe('men');
  expect(categories[0].children[0].slug).toBe('panjabi');
  expect(categories[0].product_count).toBe(40);
});

test('maps an error response to a StoreApiError', async () => {
  const api = axios.create();
  const mock = new MockAdapter(api);
  mock.onGet('store/categories/').reply(500, { errors: ['boom'], field_errors: {}, message: 'Failed' });

  await expect(fetchCategories(api)).rejects.toBeInstanceOf(StoreApiError);
});
