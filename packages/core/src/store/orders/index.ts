import { AxiosInstance } from 'axios';
import { endpoints } from '../../api/endpoints';
import { toStoreApiError } from '../errors';
import { OrderDetail, OrderListItem, OrderListParams, PaginatedResult } from '../types';

function buildOrderListQuery(params: OrderListParams = {}): string {
  const usp = new URLSearchParams();
  const { page, pageSize } = params;
  if (page !== undefined && page !== null) usp.append('page', String(page));
  if (pageSize !== undefined && pageSize !== null) usp.append('pageSize', String(pageSize));
  const qs = usp.toString();
  return qs ? `?${qs}` : '';
}

// `store/orders/list/` uses `CommonListAPIMixin.common_list_decorator` — the
// same NESTED envelope as `store/products/`: `{data: {data: [...],
// totalPages, totalItems, currentPage, pageSize}}`. Unwrapped here so no
// screen ever sees it.
export async function fetchOrders(
  api: AxiosInstance,
  params: OrderListParams = {},
): Promise<PaginatedResult<OrderListItem>> {
  try {
    const res = await api.get(`${endpoints.storeOrderList}${buildOrderListQuery(params)}`);
    const envelope = res.data.data;
    return {
      items: envelope.data,
      totalPages: envelope.totalPages,
      totalItems: envelope.totalItems,
      currentPage: envelope.currentPage,
      pageSize: envelope.pageSize,
    };
  } catch (e) {
    throw toStoreApiError(e);
  }
}

// `store/orders/<pk>/` is a flat `{data, message}` endpoint (not a
// `storefront` list endpoint) — a 404 (order not found / belongs to another
// customer) maps to a StoreApiError like any other failure.
export async function fetchOrderDetail(api: AxiosInstance, id: number | string): Promise<OrderDetail> {
  try {
    const res = await api.get(endpoints.storeOrderDetail(id));
    return res.data.data;
  } catch (e) {
    throw toStoreApiError(e);
  }
}

// `store/orders/<pk>/cancel/` returns `{data: {status}, message}` on success.
// On a non-cancelable order it returns 400 with a plain message and no
// `field_errors` (it's a whole-order state check, not a bad input) — the
// caller reads `error.errors[0]`/`error.message` for a clear explanation.
export async function cancelOrder(
  api: AxiosInstance,
  id: number | string,
  reason?: string,
): Promise<{ status: string }> {
  try {
    const res = await api.post(endpoints.storeOrderCancel(id), reason ? { reason } : {});
    return res.data.data;
  } catch (e) {
    throw toStoreApiError(e);
  }
}
