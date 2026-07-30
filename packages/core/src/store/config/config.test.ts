import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { fetchStoreConfig } from './index';
import { StoreApiError } from '../errors';

test('unwraps the flat store-config envelope', async () => {
  const api = axios.create();
  const mock = new MockAdapter(api);
  mock.onGet('store/config/').reply(200, {
    data: {
      store_name: 'Fabrything',
      currency: 'BDT',
      cod_enabled: true,
      fixed_shipping_rate: 60,
      free_shipping_threshold: 1500,
      support_phone: '+8801700000000',
      messenger_page_id: '',
      whatsapp_chat_number: '',
    },
    message: 'Store configuration',
  });

  const cfg = await fetchStoreConfig(api);

  expect(cfg.store_name).toBe('Fabrything');
  expect(cfg.cod_enabled).toBe(true);
  expect(cfg.fixed_shipping_rate).toBe(60);
  expect(cfg.free_shipping_threshold).toBe(1500);
  // Blank strings mean "hide the button", not a broken link — must pass through untouched.
  expect(cfg.messenger_page_id).toBe('');
});

test('maps an error response to a StoreApiError', async () => {
  const api = axios.create();
  const mock = new MockAdapter(api);
  mock.onGet('store/config/').reply(500, { errors: ['boom'], field_errors: {}, message: 'Failed' });

  await expect(fetchStoreConfig(api)).rejects.toBeInstanceOf(StoreApiError);
});
