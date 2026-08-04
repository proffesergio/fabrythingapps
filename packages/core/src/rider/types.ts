// Shapes returned by the `food/rider/*` endpoints. Money and coordinates come
// back from Django as strings (Decimal is serialised as a string to avoid float
// drift) — keep them strings here and format at the edge rather than parsing
// into a float that could lose paisa.

export interface RiderProfile {
  id: number;
  name?: string;
  username?: string;
  phone?: string;
  is_available: boolean;
  is_online?: boolean;
  is_sharing_location?: boolean;
  cash_in_hand?: string;
}

export interface RiderOffer {
  offer_id: number;
  /** Server-authoritative countdown. The offer TTL is 60s server-side; never
   *  compute the deadline from the device clock, which can be wrong. */
  seconds_left: number;
  order_code: string;
  restaurant_name: string;
  restaurant_lat: string | null;
  restaurant_lng: string | null;
  delivery_address: string;
  delivery_lat: string | null;
  delivery_lng: string | null;
  distance_km: string | null;
  payment_method: string;
  total: string;
  /** The distance-priced snapshot for THIS delivery (base pay + tip), not a
   *  flat guess — the same number that settles into the ledger on delivery. */
  rider_pay: string;
}

export interface RiderOrder {
  id: number;
  order_code: string;
  status: string;
  restaurant_name?: string;
  delivery_address?: string;
  total?: string;
  payment_method?: string;
  rider_base_pay?: string;
  tip?: string;
  items?: Array<{ name?: string; quantity?: number }>;
}

export interface RiderEarnings {
  today_payout?: string;
  lifetime_payout?: string;
  deliveries_completed?: number;
  /** COD cash the rider is still carrying and owes back. Derived server-side
   *  from collections minus deposits — never stored, so never stale. */
  cash_in_hand?: string;
}

export type OfferAction = 'accept' | 'decline';

export interface OfferResponse {
  accepted?: boolean;
  declined?: boolean;
  order_id?: number;
}
