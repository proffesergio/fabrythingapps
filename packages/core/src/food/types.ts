// Shapes returned by the food API. Mirrors
// `../../fabrythingweb/backend/EcommerceInventory/food/serializers.py` and
// `food/serializers_orders.py`. Money is kept as the server sent it (a string
// from a DecimalField) wherever it will be displayed or posted back, so a
// float round-trip can never make the screen disagree with the charge.

export interface FoodOption {
  id: number;
  name: string;
  name_bn: string;
  price_delta: string;
  is_default: boolean;
  display_order: number;
}

export interface FoodOptionGroup {
  id: number;
  name: string;
  name_bn: string;
  min_select: number;
  max_select: number;
  is_required: boolean;
  options: FoodOption[];
}

export interface FoodItem {
  id: number;
  name: string;
  display_name: string;
  slug: string;
  description: string;
  image: string | null;
  price: string;
  discount_price: string | null;
  /** What the server actually charges before options. Never recompute it. */
  effective_price: string;
  prep_minutes: number;
  is_available: boolean;
  /** Honours the item's time-of-day/day-of-week window; `is_available` does not. */
  available_now: boolean;
  is_veg: boolean;
  is_featured: boolean;
  spice_level: number;
  display_order: number;
  option_groups: FoodOptionGroup[];
}

export interface FoodCategory {
  id: number;
  name: string;
  display_name: string;
  display_order: number;
  items: FoodItem[];
}

export interface Restaurant {
  id: number;
  name: string;
  display_name: string;
  slug: string;
  logo: string | null;
  cover_image: string | null;
  cuisine_type: string;
  base_delivery_fee: string;
  avg_prep_minutes: number;
  min_order_amount: string;
  /** The owner's master switch. Says nothing about opening hours. */
  is_open: boolean;
  /** Opening-hours aware — THIS is what the UI must gate ordering on. */
  is_open_now: boolean;
  next_open: { weekday: number; days_ahead: number; open_time: string } | null;
  is_accepting_orders: boolean;
  status: string;
  pickup_lat: string | null;
  pickup_lng: string | null;
  distance_km: number | null;
  delivers_to_zone: boolean | null;
}

export interface RestaurantDetail extends Restaurant {
  description: string;
  address: string;
  phone: string;
  categories: FoodCategory[];
  /** `null` means "every zone" (restaurant has no explicit zone allow-list). */
  served_zone_ids: number[] | null;
  opening_hours: { weekday: number; open_time: string; close_time: string }[];
}

export interface Village {
  id: number;
  name: string;
  name_bn: string;
}

export interface DeliveryZone {
  id: number;
  name: string;
  name_bn: string;
  center_lat: string | null;
  center_lng: string | null;
  is_active: boolean;
  villages: Village[];
}

/** Out-of-range is a 200 with `deliverable: false` — a refusal to explain, not an error. */
export interface DeliveryQuote {
  deliverable: boolean;
  reason?: string;
  fee?: string;
  distance_km?: string | null;
  /** 'pin' | 'village' | 'zone' — a zone-sourced distance can be km out. */
  distance_source?: string;
  priced_by?: string;
  eta_minutes?: number;
}

/** One line of the local food cart. */
export interface FoodCartLine {
  itemId: number;
  restaurantSlug: string;
  name: string;
  image: string | null;
  /** `effective_price` — options are added on top, never folded in here. */
  unitPrice: string;
  optionIds: number[];
  /** Display-only snapshot of the chosen options. */
  optionLabels: { name: string; price_delta: string }[];
  quantity: number;
}

export interface FoodCartTotals {
  itemCount: number;
  /** Plain arithmetic over server prices. The delivery fee is NEVER estimated
   *  here — it comes from `delivery-quote/`, priced by the same function the
   *  order endpoint charges with. */
  subtotal: number;
}

export interface FoodOrderItem {
  id: number;
  item_name: string;
  unit_price: string;
  quantity: number;
  selected_options: { name: string; price_delta: string }[];
  line_total: string;
}

export interface FoodOrder {
  id: number;
  order_code: string;
  status: string;
  restaurant_name: string;
  restaurant_slug: string;
  guest_name: string;
  guest_phone: string;
  delivery_address: string;
  village_name: string | null;
  zone_name: string | null;
  subtotal: string;
  discount: string;
  coupon_code: string;
  delivery_fee: string;
  tip: string;
  total: string;
  eta_minutes: number | null;
  payment_method: string;
  payment_status: string;
  rider_name: string | null;
  rider_phone: string | null;
  /** Null unless OUT_FOR_DELIVERY and the rider has not opted out of sharing. */
  rider_lat: string | null;
  rider_lng: string | null;
  restaurant_lat: string | null;
  restaurant_lng: string | null;
  created_at: string;
  items: FoodOrderItem[];
}

export interface PlaceFoodOrderInput {
  restaurant_slug: string;
  items: { item_id: number; quantity: number; option_ids?: number[] }[];
  contact_name: string;
  contact_phone: string;
  delivery_address: string;
  zone_id?: number | null;
  village_id?: number | null;
  delivery_lat?: number | null;
  delivery_lng?: number | null;
  tip?: string;
  notes?: string;
  coupon_code?: string;
  payment_method?: string;
  redeem_points?: number;
}
