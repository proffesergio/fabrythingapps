import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { cancelOrder, fetchOrderDetail, fetchOrders } from './index';
import { StoreApiError } from '../errors';

const sampleListOrder = {
  id: 7,
  order_number: 'ORD-0007',
  status: 'CONFIRMED',
  status_display: 'Confirmed',
  payment_method: 'COD',
  subtotal: '1998.00',
  shipping_amount: '60.00',
  total_amount: '2058.00',
  currency: 'BDT',
  contact_name: 'Karim',
  contact_phone: '01711112222',
  item_count: 2,
  created_at: '2026-08-01T10:00:00Z',
};

describe('fetchOrders', () => {
  test('unwraps the nested storefront list envelope', async () => {
    const api = axios.create();
    const mock = new MockAdapter(api);
    mock.onGet('store/orders/list/?page=1').reply(200, {
      data: {
        data: [sampleListOrder],
        totalPages: 2,
        totalItems: 11,
        currentPage: 1,
        pageSize: 10,
      },
      message: 'Data Retrieved Successfully',
    });

    const result = await fetchOrders(api, { page: 1 });

    expect(result.totalPages).toBe(2);
    expect(result.totalItems).toBe(11);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].order_number).toBe('ORD-0007');
    expect(result.items[0].total_amount).toBe('2058.00');
  });

  test('omits query params when none are passed', async () => {
    const api = axios.create();
    const mock = new MockAdapter(api);
    mock.onGet('store/orders/list/').reply(200, {
      data: { data: [], totalPages: 1, totalItems: 0, currentPage: 1, pageSize: 20 },
      message: 'Data Retrieved Successfully',
    });

    const result = await fetchOrders(api);
    expect(result.items).toEqual([]);
  });

  test('maps a non-2xx response to a StoreApiError', async () => {
    const api = axios.create();
    const mock = new MockAdapter(api);
    mock.onGet('store/orders/list/').reply(401, { errors: ['Not authenticated'], field_errors: {}, message: 'Unauthorized' });

    await expect(fetchOrders(api)).rejects.toBeInstanceOf(StoreApiError);
  });
});

describe('fetchOrderDetail', () => {
  test('unwraps the flat detail envelope and carries items + status_logs', async () => {
    const api = axios.create();
    const mock = new MockAdapter(api);
    mock.onGet('store/orders/7/').reply(200, {
      data: {
        ...sampleListOrder,
        shipping_address: {
          address_type: 'Home',
          address: '1 Test Rd',
          city: 'Dhaka',
          state: '',
          pincode: '',
          country: 'Bangladesh',
        },
        notes: '',
        canceled_reason: '',
        items: [
          {
            id: 1,
            product_name: 'Cotton Panjabi',
            product_slug: 'cotton-panjabi',
            product_image: null,
            sku: 'CP-M',
            size: 'M',
            color: 'White',
            unit_price: '999.00',
            quantity: 2,
            line_total: '1998.00',
          },
        ],
        status_logs: [
          { from_status: '', to_status: 'PENDING_VERIFICATION', reason: '', created_at: '2026-08-01T10:00:00Z' },
          { from_status: 'PENDING_VERIFICATION', to_status: 'CONFIRMED', reason: '', created_at: '2026-08-01T11:00:00Z' },
        ],
      },
      message: 'Order retrieved',
    });

    const order = await fetchOrderDetail(api, 7);

    expect(order.order_number).toBe('ORD-0007');
    expect(order.items).toHaveLength(1);
    expect(order.items[0].line_total).toBe('1998.00');
    expect(order.status_logs).toHaveLength(2);
    expect(order.status_logs[0].from_status).toBe('');
    expect(order.status_logs[1].to_status).toBe('CONFIRMED');
  });

  test('maps a 404 to a StoreApiError', async () => {
    const api = axios.create();
    const mock = new MockAdapter(api);
    mock.onGet('store/orders/999/').reply(404, { errors: ['Order not found'], field_errors: {}, message: 'Not found' });

    await expect(fetchOrderDetail(api, 999)).rejects.toMatchObject({ message: 'Not found' });
  });
});

describe('cancelOrder', () => {
  test('posts to the cancel endpoint and returns the new status', async () => {
    const api = axios.create();
    const mock = new MockAdapter(api);
    mock.onPost('store/orders/7/cancel/').reply(200, { data: { status: 'CANCELED' }, message: 'Order canceled' });

    const result = await cancelOrder(api, 7);
    expect(result.status).toBe('CANCELED');
  });

  test('maps a non-cancelable rejection to a StoreApiError carrying the server message', async () => {
    const api = axios.create();
    const mock = new MockAdapter(api);
    mock.onPost('store/orders/7/cancel/').reply(400, {
      errors: ['This order can no longer be canceled'],
      field_errors: {},
      message: 'Not allowed',
    });

    const err = await cancelOrder(api, 7).catch((e) => e);
    expect(err).toBeInstanceOf(StoreApiError);
    expect(err.errors).toEqual(['This order can no longer be canceled']);
  });
});
