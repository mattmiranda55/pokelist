import { apiGet, apiSend } from '../api/client';

export interface AddCardInput {
  pokemon_tcg_id: string;
  name: string;
  set_name: string | null;
  series: string | null;
  image_url: string | null;
  rarity: string | null;
  card_number: string | null;
}

export interface VariantSelection {
  variantType: string;
  quantity: number;
}

export interface CollectionVariant {
  id: number;
  variant_type: string;
  quantity: number;
}

export interface GradedCopy {
  id: number;
  variant_type: string | null;
  company: string;
  grade: string;
  cert_number: string | null;
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
  total_quantity: number;
  variants: CollectionVariant[];
  graded: GradedCopy[];
}

export interface Want {
  id: number;
  pokemon_tcg_id: string;
  name: string;
  set_name: string | null;
  series: string | null;
  image_url: string | null;
  rarity: string | null;
  card_number: string | null;
  variant_type: string | null;
  added_at: string;
}

export interface AddGradedInput {
  variantType: string | null;
  company: string;
  grade: string;
  certNumber: string | null;
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

export async function addGradedCopy(
  cardId: number,
  input: AddGradedInput
): Promise<void> {
  await apiSend('POST', `/cards/${cardId}/graded`, input);
}

export async function removeGradedCopy(gradedId: number): Promise<void> {
  await apiSend('DELETE', `/graded/${gradedId}`);
}

export function getWants(): Promise<Want[]> {
  return apiGet<Want[]>('/wants');
}

export async function getWantTcgIds(): Promise<Set<string>> {
  const ids = await apiGet<string[]>('/wants/ids');
  return new Set(ids);
}

export async function addWant(
  input: AddCardInput,
  variantType: string | null
): Promise<void> {
  await apiSend('POST', '/wants', { ...input, variantType });
}

export async function removeWant(wantId: number): Promise<void> {
  await apiSend('DELETE', `/wants/${wantId}`);
}
