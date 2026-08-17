import { getPricedCardIds, recordPrice, setVariantPrice } from './db';
import { extractPriceUsd, getCardById, variantPrices } from './tcg';

const REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000;
/** Spacing between upstream calls so a large collection doesn't burst the rate limit. */
const PER_CARD_DELAY_MS = 250;

export interface RefreshSummary {
  checked: number;
  priced: number;
  failed: number;
}

export async function refreshPrices(): Promise<RefreshSummary> {
  const cards = getPricedCardIds();
  let priced = 0;
  let failed = 0;

  for (const card of cards) {
    try {
      const fresh = await getCardById(card.pokemon_tcg_id);
      if (!fresh) {
        failed++;
        continue;
      }

      const overall = extractPriceUsd(fresh);
      if (overall != null) {
        recordPrice(card.id, overall);
        priced++;
      }

      for (const [variantType, price] of Object.entries(variantPrices(fresh))) {
        setVariantPrice(card.id, variantType, price);
      }
    } catch (e) {
      failed++;
      console.error(`price refresh failed for ${card.pokemon_tcg_id}:`, e);
    }
    await Bun.sleep(PER_CARD_DELAY_MS);
  }

  const summary = { checked: cards.length, priced, failed };
  console.log('price refresh:', JSON.stringify(summary));
  return summary;
}

export function startPriceRefreshSchedule(): void {
  // Kick off once on boot so a fresh container starts building history immediately.
  refreshPrices().catch((e) => console.error('initial price refresh failed:', e));
  setInterval(() => {
    refreshPrices().catch((e) => console.error('scheduled price refresh failed:', e));
  }, REFRESH_INTERVAL_MS);
}
