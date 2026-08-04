import { AxiosInstance } from 'axios';
import { toStoreApiError } from '../store/errors';
import {
  OfferAction,
  OfferResponse,
  RiderEarnings,
  RiderOffer,
  RiderOrder,
  RiderProfile,
} from './types';

export * from './types';

const RIDER = {
  me: 'food/rider/me/',
  availability: 'food/rider/availability/',
  heartbeat: 'food/rider/heartbeat/',
  privacy: 'food/rider/privacy/',
  orders: 'food/rider/orders/',
  earnings: 'food/rider/earnings/',
  offer: 'food/rider/offer/',
  orderStatus: (id: number | string) => `food/rider/orders/${id}/status/`,
} as const;

// These are flat `{data, message}` endpoints (not `storefront` list endpoints),
// so `.data.data` is the payload. Some older food views return the payload
// directly, hence the `?? res.data` fallback the rider screen already relied on.
function unwrap<T>(res: { data: any }): T {
  return (res.data?.data ?? res.data) as T;
}

export async function fetchRiderProfile(api: AxiosInstance): Promise<RiderProfile> {
  try {
    return unwrap<RiderProfile>(await api.get(RIDER.me));
  } catch (e) {
    throw toStoreApiError(e);
  }
}

export async function setRiderAvailability(api: AxiosInstance, isAvailable: boolean): Promise<RiderProfile> {
  try {
    return unwrap<RiderProfile>(await api.post(RIDER.availability, { is_available: isAvailable }));
  } catch (e) {
    throw toStoreApiError(e);
  }
}

export async function setRiderLocationSharing(api: AxiosInstance, isSharing: boolean): Promise<void> {
  try {
    await api.post(RIDER.privacy, { is_sharing_location: isSharing });
  } catch (e) {
    throw toStoreApiError(e);
  }
}

/** Presence ping. `Rider.is_online` is derived from this, and dispatch only
 *  offers to riders who are both available (their switch) and online (this
 *  heartbeat) — so a rider who stops sending these stops getting work. */
export async function sendRiderHeartbeat(
  api: AxiosInstance,
  coords?: { lat: number; lng: number },
): Promise<void> {
  try {
    await api.post(RIDER.heartbeat, coords ? { lat: coords.lat, lng: coords.lng } : {});
  } catch (e) {
    throw toStoreApiError(e);
  }
}

export async function fetchRiderOrders(api: AxiosInstance): Promise<RiderOrder[]> {
  try {
    const data = unwrap<RiderOrder[]>(await api.get(RIDER.orders));
    return Array.isArray(data) ? data : [];
  } catch (e) {
    throw toStoreApiError(e);
  }
}

export async function fetchRiderEarnings(api: AxiosInstance): Promise<RiderEarnings> {
  try {
    return unwrap<RiderEarnings>(await api.get(RIDER.earnings));
  } catch (e) {
    throw toStoreApiError(e);
  }
}

/** Returns null when there is nothing to answer. Polling this GET also drives
 *  the server's lazy offer sweep (there is no job runner), so an online rider
 *  polling keeps the whole dispatch cascade moving for everyone. */
export async function fetchRiderOffer(api: AxiosInstance): Promise<RiderOffer | null> {
  try {
    const data = unwrap<{ offer: RiderOffer | null }>(await api.get(RIDER.offer));
    return data?.offer ?? null;
  } catch (e) {
    throw toStoreApiError(e);
  }
}

/** Accept can legitimately fail with 409 when the offer expired or an admin
 *  reassigned the order between poll and tap — the caller must handle that as
 *  a normal outcome, not an error state. */
export async function respondToOffer(api: AxiosInstance, action: OfferAction): Promise<OfferResponse> {
  try {
    return unwrap<OfferResponse>(await api.post(RIDER.offer, { action }));
  } catch (e) {
    throw toStoreApiError(e);
  }
}

export async function setRiderOrderStatus(
  api: AxiosInstance,
  orderId: number | string,
  status: string,
): Promise<RiderOrder> {
  try {
    return unwrap<RiderOrder>(await api.patch(RIDER.orderStatus(orderId), { status }));
  } catch (e) {
    throw toStoreApiError(e);
  }
}

export { RIDER as riderEndpoints };
