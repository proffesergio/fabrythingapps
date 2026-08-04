import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { StoreApiError, toStoreApiError, isNetworkError } from './errors';

test('maps the {errors, field_errors, message} error envelope', async () => {
  const api = axios.create();
  const mock = new MockAdapter(api);
  mock.onPost('/store/orders/').reply(400, {
    errors: ['Enter a valid phone number.'],
    field_errors: { contact_phone: ['Enter a valid phone number.'] },
    message: 'Validation error',
  });

  await expect(api.post('/store/orders/')).rejects.toBeTruthy();
  try {
    await api.post('/store/orders/');
    throw new Error('should have rejected');
  } catch (raw) {
    const err = toStoreApiError(raw);
    expect(err).toBeInstanceOf(StoreApiError);
    expect(err.message).toBe('Validation error');
    expect(err.errors).toEqual(['Enter a valid phone number.']);
    expect(err.fieldErrors).toEqual({ contact_phone: ['Enter a valid phone number.'] });
    expect(err.status).toBe(400);
  }
});

test('passes an already-mapped StoreApiError through unchanged', () => {
  const original = new StoreApiError('Boom', ['Boom'], {}, 500);
  expect(toStoreApiError(original)).toBe(original);
});

test('falls back gracefully for a non-axios error', () => {
  const err = toStoreApiError(new Error('network down'));
  expect(err).toBeInstanceOf(StoreApiError);
  expect(err.message).toBe('network down');
  expect(err.errors).toEqual([]);
  expect(err.fieldErrors).toEqual({});
});

test('isNetworkError: true when axios never got a response (offline, DNS, timeout)', async () => {
  const api = axios.create();
  const mock = new MockAdapter(api);
  mock.onGet('/store/products/').networkError();

  try {
    await api.get('/store/products/');
    throw new Error('should have rejected');
  } catch (raw) {
    const err = toStoreApiError(raw);
    expect(err.status).toBeUndefined();
    expect(isNetworkError(err)).toBe(true);
  }
});

test('isNetworkError: false when the server answered with an error status', () => {
  const err = new StoreApiError('Validation error', ['bad'], {}, 400);
  expect(isNetworkError(err)).toBe(false);
});
