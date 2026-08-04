import { AxiosInstance } from 'axios';
import { toStoreApiError } from '../store/errors';

export interface VendorRestaurant {
  id: number;
  name: string;
  slug?: string;
  status?: string;
  logo?: string | null;
  cover_image?: string | null;
  is_open?: boolean;
}

export interface VendorOrderItem {
  name?: string;
  quantity?: number;
  unit_price?: string;
  line_total?: string;
}

export interface VendorOrder {
  id: number;
  order_code: string;
  status: string;
  created_at?: string;
  contact_name?: string;
  contact_phone?: string;
  delivery_address?: string;
  payment_method?: string;
  subtotal?: string;
  total?: string;
  rider_name?: string | null;
  items?: VendorOrderItem[];
}

const VENDOR = {
  restaurant: 'food/vendor/restaurant/',
  orders: 'food/vendor/orders/',
  orderStatus: (id: number | string) => `food/vendor/orders/${id}/status/`,
} as const;

function unwrap<T>(res: { data: any }): T {
  return (res.data?.data ?? res.data) as T;
}

export async function fetchVendorRestaurant(api: AxiosInstance): Promise<VendorRestaurant> {
  try {
    return unwrap<VendorRestaurant>(await api.get(VENDOR.restaurant));
  } catch (e) {
    throw toStoreApiError(e);
  }
}

/** `vendor/orders/` uses EnvelopeModelViewSetMixin-style flat `{data: [...]}`,
 *  not the nested storefront list envelope. Guard anyway — the repo has two
 *  different list envelopes and reading the wrong one has broken pages before. */
export async function fetchVendorOrders(api: AxiosInstance, status?: string): Promise<VendorOrder[]> {
  try {
    const qs = status ? `?status=${encodeURIComponent(status)}` : '';
    const payload = unwrap<VendorOrder[] | { data?: VendorOrder[] }>(await api.get(`${VENDOR.orders}${qs}`));
    if (Array.isArray(payload)) return payload;
    return Array.isArray(payload?.data) ? payload.data : [];
  } catch (e) {
    throw toStoreApiError(e);
  }
}

/** The order state machine is forward-only and enforced server-side
 *  (`transition_to` is the single choke point). An illegal jump comes back as a
 *  400 with the reason — surface it rather than assuming success. */
export async function setVendorOrderStatus(
  api: AxiosInstance,
  orderId: number | string,
  status: string,
): Promise<VendorOrder> {
  try {
    return unwrap<VendorOrder>(await api.patch(VENDOR.orderStatus(orderId), { status }));
  } catch (e) {
    throw toStoreApiError(e);
  }
}

export { VENDOR as vendorEndpoints };
