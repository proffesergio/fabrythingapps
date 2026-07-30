import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { placeOrder } from './placeOrder';
import { isRxBlockedError } from './rx';
import { toStoreApiError } from '../store/errors';
import { PlaceOrderInput } from './types';

const input: PlaceOrderInput = {
  items: [{ variant_id: 11, quantity: 2 }],
  shipping_address: { address: '12 Lake Road', city: 'Dhaka' },
  contact_name: 'Rahim Uddin',
  contact_phone: '01711111111',
};

describe('placeOrder', () => {
  test('posts the order and returns the server-resolved subtotal/shipping/total', async () => {
    const api = axios.create();
    const mock = new MockAdapter(api);
    mock.onPost('store/orders/').reply(201, {
      data: {
        order_id: 42,
        order_number: 'ORD-0042',
        subtotal: 1998,
        shipping_amount: 60,
        total_amount: 2058,
        currency: 'BDT',
        status: 'PLACED',
      },
      message: 'Order placed successfully',
    });

    const result = await placeOrder(api, input);
    expect(result.order_number).toBe('ORD-0042');
    expect(result.shipping_amount).toBe(60);
    expect(result.total_amount).toBe(2058);
  });

  test('a field validation failure surfaces field_errors', async () => {
    const api = axios.create();
    const mock = new MockAdapter(api);
    mock.onPost('store/orders/').reply(400, {
      errors: ['Enter a valid phone number.'],
      field_errors: { contact_phone: ['Enter a valid phone number.'] },
      message: 'Validation error',
    });

    await expect(placeOrder(api, input)).rejects.toMatchObject({
      fieldErrors: { contact_phone: ['Enter a valid phone number.'] },
    });
  });

  test('an Rx-disabled rejection has no field association but a clear message', async () => {
    const api = axios.create();
    const mock = new MockAdapter(api);
    mock.onPost('store/orders/').reply(400, {
      errors: ['Cotton Panjabi requires a prescription and is not yet available for online purchase.'],
      message: 'Could not place order',
    });

    try {
      await placeOrder(api, input);
      throw new Error('expected placeOrder to reject');
    } catch (e) {
      expect(isRxBlockedError(e as any)).toBe(true);
    }
  });

  test('an out-of-stock rejection is not mistaken for an Rx block', async () => {
    const api = axios.create();
    const mock = new MockAdapter(api);
    mock.onPost('store/orders/').reply(409, {
      errors: ['Only 1 left of Cotton Panjabi (M).'],
      message: 'Could not place order',
    });

    try {
      await placeOrder(api, input);
      throw new Error('expected placeOrder to reject');
    } catch (e) {
      expect(isRxBlockedError(e as any)).toBe(false);
    }
  });
});

describe('isRxBlockedError', () => {
  test('is false for a generic error with no messages', () => {
    expect(isRxBlockedError(toStoreApiError(new Error('network down')))).toBe(false);
  });
});
