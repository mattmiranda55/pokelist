import { apiGet, apiSend } from '../api/client';

export interface AddCardInput {
  pokemon_tcg_id: string;
  name: string;
  set_name: string | null;
  series: string | null;
  image_url: string | null;
  rarity: string | null;
  card_number: string | null;
  price_usd: number | null;
}

export interface VariantSelection {
  variantType: string;
  quantity: number;
  priceUsd?: number | null;
}

export interface CollectionVariant {
  id: number;
  variant_type: string;
  quantity: number;
  price_usd: number | null;
}

export interface CollectionCard {
  id: number;
  pokemon_tcg_id: string;
  name: string;
  set_name: string | null;
  series: string | null;
  image_url: string | null;
  rarity: string | null;
  card_number: string | null;
  price_usd: number | null;
  total_quantity: number;
  variants: CollectionVariant[];
}

/** 'add' increments existing quantities (manual add); 'set' overwrites them so re-imports converge. */
export type QuantityMode = 'add' | 'set';

export async function initDatabase(): Promise<void> {
  await apiGet<{ ok: boolean }>('/health');
}

export function getCollection(): Promise<CollectionCard[]> {
  return apiGet<CollectionCard[]>('/collection');
}

export async function getCollectionTcgIds(): Promise<Set<string>> {
  const ids = await apiGet<string[]>('/collection/ids');
  return new Set(ids);
}

export async function addCardWithVariants(
  input: AddCardInput,
  variants: VariantSelection[],
  mode: QuantityMode = 'add'
): Promise<void> {
  await apiSend('POST', '/cards', { input, variants, mode });
}

export async function removeCard(cardId: number): Promise<void> {
  await apiSend('DELETE', `/cards/${cardId}`);
}

export async function setVariantQuantity(
  variantId: number,
  quantity: number
): Promise<void> {
  await apiSend('PATCH', `/variants/${variantId}`, { quantity });
}

export async function removeVariant(variantId: number): Promise<void> {
  await apiSend('DELETE', `/variants/${variantId}`);
}

export async function addVariantToCard(
  cardId: number,
  variantType: string,
  quantity: number
): Promise<void> {
  await apiSend('POST', `/cards/${cardId}/variants`, { variantType, quantity });
}
