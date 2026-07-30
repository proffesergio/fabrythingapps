// Shapes returned by the `storefront` public catalog API (`store/categories/`,
// `store/products/`, `store/products/<slug>/`, `store/config/`). Kept in one
// file so a screen never has to guess a field name — see
// `../../../fabrythingweb/backend/EcommerceInventory/storefront/serializers.py`
// for the source of truth.

export interface StoreCategory {
  id: number;
  name: string;
  slug: string;
  // Already-absolute image URLs (or null) — never prepend a host.
  image: string[] | null;
  description: string;
  display_order: number;
  children: StoreCategory[];
  product_count: number;
}

export interface ProductVariant {
  id: number;
  sku: string;
  size: string;
  color: string;
  // DRF DecimalField serializes as a string ("250.00"), not a JSON number.
  price: string;
  discount_price: string | null;
  effective_price: string;
  stock_quantity: number;
  in_stock: boolean;
}

// Fields a product card / list row carries.
export interface StoreProduct {
  id: number;
  name: string;
  slug: string;
  image: string[] | null;
  description: string;
  initial_selling_price: string;
  discount_price: string | null;
  color: string | null;
  brand: string | null;
  gender: string | null;
  available_sizes: string[];
  material: string | null;
  generic_name: string | null;
  strength: string | null;
  dosage_form: string | null;
  manufacturer: string | null;
  pack_size: string | null;
  // If true, the server blocks purchase while Rx sales are disabled — surface
  // this state, never hide the product.
  requires_prescription: boolean;
  category_id: number | null;
  category_name: string | null;
  average_rating: number;
  review_count: number;
  discount_percentage: number;
  total_stock: number;
  created_at: string;
  // Raw per-product override, null when unset (distinct from "explicitly free").
  shipping_fee: number | null;
  // Always concrete: falls back to the store's flat rate when shipping_fee is null.
  effective_shipping_fee: number;
  free_shipping: boolean;
}

export interface ProductReview {
  id: number;
  rating: number;
  reviews: string;
  review_images: string[];
  reviewer_name: string;
  created_at: string;
}

export interface ProductQuestion {
  id: number;
  question: string;
  answer: string;
  asked_by: string;
  created_at: string;
}

// Everything a list row has, plus the detail-only fields.
export type StoreProductDetail = StoreProduct & {
  html_description: string;
  specifications: Record<string, unknown>;
  highlights: string[];
  tax_percentage: string;
  brand_model: string | null;
  size_chart: Record<string, Record<string, number>>;
  seo_title: string | null;
  seo_description: string | null;
  seo_keywords: string | null;
  variants: ProductVariant[];
  rating_distribution: Record<string, number>;
  reviews: ProductReview[];
  questions: ProductQuestion[];
  related_products: StoreProduct[];
};

export interface StoreConfig {
  store_name: string;
  currency: string;
  cod_enabled: boolean;
  fixed_shipping_rate: number;
  free_shipping_threshold: number | null;
  support_phone: string;
  // Blank string means "hide the button", not a broken link.
  messenger_page_id: string;
  whatsapp_chat_number: string;
}

export type ProductOrdering = 'newest' | 'price_low' | 'price_high' | 'name';

export interface ProductListParams {
  category?: string;
  search?: string;
  ordering?: ProductOrdering;
  page?: number;
  pageSize?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  totalPages: number;
  totalItems: number;
  currentPage: number;
  pageSize: number;
}
