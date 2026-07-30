import { ProductListParams } from '../types';

// Builds the `store/products/` query string, omitting empty/undefined params
// so a screen can pass `{ category: '', search: undefined }` freely without
// polluting the request. `?ordering=` accepts newest|price_low|price_high|name
// only — enforced by ProductListParams['ordering'] at the type level.
export function buildProductQuery(params: ProductListParams = {}): string {
  const usp = new URLSearchParams();
  const { category, search, ordering, page, pageSize } = params;
  if (category) usp.append('category', category);
  if (search) usp.append('search', search);
  if (ordering) usp.append('ordering', ordering);
  if (page !== undefined && page !== null) usp.append('page', String(page));
  if (pageSize !== undefined && pageSize !== null) usp.append('pageSize', String(pageSize));
  const qs = usp.toString();
  return qs ? `?${qs}` : '';
}
