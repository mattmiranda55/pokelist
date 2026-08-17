import { useEffect, useMemo, useState } from 'react';
import { CreditCard, Layers, Minus, Plus, PlusCircle, Trash2, X } from 'lucide-react';
import {
  ALL_VARIANT_TYPES,
  getVariantTypesForCard,
  variantLabel,
} from '../api/pokemonTcg';
import {
  addVariantToCard,
  removeCard,
  removeVariant,
  setVariantQuantity,
  type CollectionCard,
  type CollectionVariant,
} from '../db/database';

interface Props {
  card: CollectionCard;
  onClose: () => void;
  onChanged: () => void;
}

function formatPrice(price: number | null): string {
  return price === null ? '—' : `$${price.toFixed(2)}`;
}

export default function CardDetailModal({ card, onClose, onChanged }: Props) {
  const [addPickerOpen, setAddPickerOpen] = useState(false);
  const [cardVariantTypes, setCardVariantTypes] = useState<string[] | null>(null);

  // Offer only variants this card actually exists in, not all six generic types.
  useEffect(() => {
    let cancelled = false;
    getVariantTypesForCard(card.pokemon_tcg_id)
      .then((types) => !cancelled && setCardVariantTypes(types))
      .catch(() => !cancelled && setCardVariantTypes(ALL_VARIANT_TYPES));
    return () => {
      cancelled = true;
    };
  }, [card.pokemon_tcg_id]);

  const availableNewVariantTypes = useMemo(() => {
    const owned = new Set(card.variants.map((v) => v.variant_type));
    return (cardVariantTypes ?? []).filter((t) => !owned.has(t));
  }, [card.variants, cardVariantTypes]);

  async function bump(v: CollectionVariant, delta: number) {
    const next = v.quantity + delta;
    if (next <= 0) await removeVariant(v.id);
    else await setVariantQuantity(v.id, next);
    onChanged();
  }

  async function handleAddVariant(variantType: string) {
    await addVariantToCard(card.id, variantType, 1);
    setAddPickerOpen(false);
    onChanged();
  }

  async function handleRemoveCard() {
    const ok = window.confirm(
      `Remove from collection?\n\nThis will remove ${card.name} and all of its variants.`
    );
    if (!ok) return;
    await removeCard(card.id);
    onChanged();
    onClose();
  }

  const value = card.variants.reduce(
    (sum, v) => sum + v.quantity * (v.price_usd ?? card.price_usd ?? 0),
    0
  );

  return (
    <div className="backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <span className="sheet-head-title">
            <CreditCard size={18} color="var(--primary)" />
            CARD DETAILS
          </span>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="sheet-body">
          <div className="hero">
            {card.image_url ? (
              <img src={card.image_url} alt="" />
            ) : (
              <div className="hero-img-empty" />
            )}
            <div>
              <h2 className="hero-name">{card.name}</h2>
              <div className="hero-meta">
                {[card.set_name, card.card_number ? `#${card.card_number}` : null]
                  .filter(Boolean)
                  .join(' · ')}
              </div>
              {card.series && <div className="hero-series">{card.series}</div>}
              {card.rarity && <span className="chip">{card.rarity}</span>}
            </div>
          </div>

          <div className="stats-row">
            <div className="stat-box">
              <div className="stat-label">LATEST PRICE</div>
              <div className="v">{formatPrice(card.price_usd)}</div>
            </div>
            <div className="stat-box">
              <div className="stat-label">QTY</div>
              <div className="v">{card.total_quantity}</div>
            </div>
            <div className="stat-box">
              <div className="stat-label">VALUE</div>
              <div className="v">{formatPrice(value)}</div>
            </div>
          </div>

          <div className="chart-head" style={{ margin: 0, fontSize: 12 }}>
            <Layers size={14} color="var(--cyan)" />
            VARIANTS
          </div>

          {card.variants.length === 0 && (
            <div className="empty" style={{ padding: 'var(--s-md)' }}>
              No variants tracked. Add one below.
            </div>
          )}

          {card.variants.map((v) => (
            <div className="variant-row" key={v.id}>
              <div className="variant-label">
                {variantLabel(v.variant_type)}
                {v.price_usd != null && (
                  <div className="variant-price">{formatPrice(v.price_usd)}</div>
                )}
              </div>
              <div className="stepper">
                <button onClick={() => bump(v, -1)} aria-label="Fewer">
                  <Minus size={14} />
                </button>
                <span className="v">{v.quantity}</span>
                <button onClick={() => bump(v, 1)} aria-label="More">
                  <Plus size={14} />
                </button>
              </div>
              <button
                className="icon-btn"
                onClick={async () => {
                  await removeVariant(v.id);
                  onChanged();
                }}
                aria-label={`Remove ${variantLabel(v.variant_type)}`}
              >
                <Trash2 size={16} color="var(--danger)" />
              </button>
            </div>
          ))}

          {availableNewVariantTypes.length > 0 && !addPickerOpen && (
            <button className="btn-dashed" onClick={() => setAddPickerOpen(true)}>
              <Plus size={14} />
              ADD VARIANT
            </button>
          )}

          {addPickerOpen && (
            <div className="picker-box">
              <span className="label">PICK A VARIANT TO ADD</span>
              {availableNewVariantTypes.map((type) => (
                <button
                  className="picker-row"
                  key={type}
                  onClick={() => handleAddVariant(type)}
                >
                  {variantLabel(type)}
                  <PlusCircle size={16} color="var(--primary)" />
                </button>
              ))}
              <button className="btn-secondary" onClick={() => setAddPickerOpen(false)}>
                CANCEL
              </button>
            </div>
          )}

          <button className="btn-danger" onClick={handleRemoveCard}>
            <Trash2 size={16} />
            REMOVE FROM COLLECTION
          </button>
        </div>
      </div>
    </div>
  );
}
