import { apiGet } from './client';
import type { PricePoint } from '../components/PriceChart';

export type TimeRange = '7D' | '3M' | '6M';

export function getPriceHistory(range: TimeRange): Promise<PricePoint[]> {
  return apiGet<PricePoint[]>(`/price-history?range=${range}`);
}
