import { AxiosInstance } from 'axios';
import { toStoreApiError } from '../store/errors';
import {
  DeliveryQuote,
  DeliveryZone,
  FoodOrder,
  PlaceFoodOrderInput,
  Restaurant,
  RestaurantDetail,
} from './types';

const FOOD = {
  restaurants: 'food/restaurants/',
  restaurant: (slug: string) => `food/restaurants/${slug}/`,
  zones: 'food/zones/',
  quote: 'food/delivery-quote/',
  orders: 'food/orders/',
  order: (code: string) => `food/orders/${code}/`,
  couponValidate: 'food/coupons/validate/',
} as const;

// Two envelope shapes exist in this API and reading the wrong one is a known
// bug source (see ../../fabrythingweb/CLAUDE.md, "Two different list
// envelopes"): CommonListAPIMixin nests as {data: {data: [...]}} while the
// plain renderResponse views are flat {data: ...}. Unwrap defensively rather
// than hard-coding one and breaking whenever a view changes mixin.
function unwrap<T>(res: { data: any }): T {
  return (res.data?.data ?? res.data) as T;
}

function unwrapList<T>(res: { data: any }): T[] {
  const payload = res.data?.data ?? res.data;
  const rows = Array.isArray(payload) ? payload : payload?.data;
  return Array.isArray(rows) ? rows : [];
}

/** Drops undefined/null keys so axios does not serialise them as empty params. */
function clean<T extends Record<string, unknown>>(params?: T) {
  if (!params) return undefined;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') out[k] = v;
  }
  return Object.keys(out).length ? out : undefined;
}

export interface RestaurantFilters {
  zone?: number | null;
  lat?: number | null;
  lng?: number | null;
  sort?: 'distance' | 'popular';
  exclude?: string;
  all?: boolean;
  search?: string;
}

export async function fetchRestaurants(
  api: AxiosInstance,
  filters?: RestaurantFilters,
): Promise<Restaurant[]> {
  try {
    return unwrapList<Restaurant>(
      await api.get(FOOD.restaurants, { params: clean(filters as Record<string, unknown>) }),
    );
  } catch (e) {
    throw toStoreApiError(e);
  }
}

export async function fetchRestaurant(api: AxiosInstance, slug: string): Promise<RestaurantDetail> {
  try {
    return unwrap<RestaurantDetail>(await api.get(FOOD.restaurant(slug)));
  } catch (e) {
    throw toStoreApiError(e);
  }
}

export async function fetchZones(api: AxiosInstance): Promise<DeliveryZone[]> {
  try {
    return unwrapList<DeliveryZone>(await api.get(FOOD.zones));
  } catch (e) {
    throw toStoreApiError(e);
  }
}

export interface QuoteParams {
  restaurant: string;
  zone?: number | null;
  village?: number | null;
  lat?: number | null;
  lng?: number | null;
}

/**
 * What this delivery will cost, priced by the same function the order endpoint
 * charges with — so the quote can never disagree with the bill.
 *
 * An undeliverable address comes back as a 200 with `deliverable: false` and a
 * reason; that is data the UI must explain, not an error to throw on.
 */
export async function fetchDeliveryQuote(
  api: AxiosInstance,
  params: QuoteParams,
): Promise<DeliveryQuote> {
  try {
    return unwrap<DeliveryQuote>(
      await api.get(FOOD.quote, { params: clean(params as unknown as Record<string, unknown>) }),
    );
  } catch (e) {
    throw toStoreApiError(e);
  }
}

export async function placeFoodOrder(
  api: AxiosInstance,
  input: PlaceFoodOrderInput,
): Promise<FoodOrder> {
  try {
    return unwrap<FoodOrder>(await api.post(FOOD.orders, input));
  } catch (e) {
    throw toStoreApiError(e);
  }
}

/**
 * A guest can only track with the phone the order was placed under — the view
 * 404s (never 403) when it does not match, so as not to confirm the code exists.
 */
export async function trackFoodOrder(
  api: AxiosInstance,
  orderCode: string,
  guestPhone?: string,
): Promise<FoodOrder> {
  try {
    return unwrap<FoodOrder>(
      await api.get(FOOD.order(orderCode), { params: clean({ phone: guestPhone }) }),
    );
  } catch (e) {
    throw toStoreApiError(e);
  }
}

export async function fetchFoodOrders(api: AxiosInstance): Promise<FoodOrder[]> {
  try {
    return unwrapList<FoodOrder>(await api.get(FOOD.orders));
  } catch (e) {
    throw toStoreApiError(e);
  }
}

export interface CouponCheck {
  valid: boolean;
  code?: string;
  discount?: string;
  message?: string;
}

export async function validateCoupon(
  api: AxiosInstance,
  input: { code: string; restaurant_slug: string; subtotal: string },
): Promise<CouponCheck> {
  try {
    return unwrap<CouponCheck>(await api.post(FOOD.couponValidate, input));
  } catch (e) {
    throw toStoreApiError(e);
  }
}
