import { useState } from 'react';
import { Minus, Plus, PlusCircle, X } from 'lucide-react';
import { getAvailableVariants, type TcgCard } from '../api/pokemonTcg';
import type { VariantSelection } from '../db/database';

interface Props {
  card: TcgCard;
  onClose: () => void;
  onConfirm: (card: TcgCard, variants: VariantSelection[]) => Promise<void>;
}

function formatPrice(price: number | null): string {
  return price === null ? '—' : `$${price.toFixed(2)}`;
}

export default function VariantPickerSheet({ card, onClose, onConfirm }: Props) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);

  const variants = getAvailableVariants(card);
  const totalToAdd = Object.values(quantities).reduce((sum, q) => sum + q, 0);

  function bump(type: string, delta: number) {
    setQuantities((prev) => ({ ...prev, [type]: Math.max(0, (prev[type] ?? 0) + delta) }));
  }

  async function handleConfirm() {
    if (totalToAdd === 0 || submitting) return;
    setSubmitting(true);
    try {
      const priceByType = new Map(variants.map((v) => [v.type, v.priceUsd]));
      const selections: VariantSelection[] = Object.entries(quantities)
        .filter(([, q]) => q > 0)
        .map(([variantType, quantity]) => ({
          variantType,
          quantity,
          priceUsd: priceByType.get(variantType) ?? null,
        }));
      await onConfirm(card, selections);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <span className="sheet-head-title">
            <PlusCircle size={18} color="var(--primary)" />
            ADD VARIANTS
          </span>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="sheet-body">
          <div className="hero">
            <img src={card.images.small} alt="" style={{ width: 64, height: 90 }} />
            <div>
              <h2 className="hero-name" style={{ fontSize: 15 }}>
                {card.name}
              </h2>
              <div className="hero-meta">
                {card.set.name} · #{card.number}
              </div>
              {card.rarity && <span className="chip">{card.rarity}</span>}
            </div>
          </div>

          {variants.map((v) => {
            const qty = quantities[v.type] ?? 0;
            return (
              <div className="variant-row" key={v.type}>
                <div className="variant-label">
                  {v.label}
                  <div className="variant-price">{formatPrice(v.priceUsd)}</div>
                </div>
                <div className="stepper">
                  <button onClick={() => bump(v.type, -1)} disabled={qty === 0} aria-label="Fewer">
                    <Minus size={14} />
                  </button>
                  <span className="v">{qty}</span>
                  <button onClick={() => bump(v.type, 1)} aria-label="More">
                    <Plus size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="sheet-foot">
          <button className="btn-secondary" onClick={onClose} disabled={submitting}>
            CANCEL
          </button>
          <button
            className="btn-primary"
            onClick={handleConfirm}
            disabled={totalToAdd === 0 || submitting}
          >
            <Plus size={14} />
            {submitting ? 'ADDING…' : totalToAdd > 0 ? `ADD ${totalToAdd}` : 'ADD'}
          </button>
        </div>
      </div>
    </div>
  );
}
