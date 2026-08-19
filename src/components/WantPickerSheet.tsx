import { useState } from 'react';
import { Heart, X } from 'lucide-react';
import { getAvailableVariants, type TcgCard } from '../api/pokemonTcg';

interface Props {
  card: TcgCard;
  onClose: () => void;
  onConfirm: (card: TcgCard, variantType: string | null) => Promise<void>;
}

export default function WantPickerSheet({ card, onClose, onConfirm }: Props) {
  const [variantType, setVariantType] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const variants = getAvailableVariants(card);

  async function handleConfirm() {
    if (submitting) return;
    setSubmitting(true);
    try {
      await onConfirm(card, variantType);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <span className="sheet-head-title">
            <Heart size={18} color="var(--primary)" />
            ADD TO WANTS
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

          <span className="label">WHICH VARIANT ARE YOU AFTER?</span>

          <button
            className={variantType === null ? 'picker-row selected' : 'picker-row'}
            onClick={() => setVariantType(null)}
          >
            Any variant
          </button>
          {variants.map((v) => (
            <button
              key={v.type}
              className={variantType === v.type ? 'picker-row selected' : 'picker-row'}
              onClick={() => setVariantType(v.type)}
            >
              {v.label}
            </button>
          ))}
        </div>

        <div className="sheet-foot">
          <button className="btn-secondary" onClick={onClose} disabled={submitting}>
            CANCEL
          </button>
          <button className="btn-primary" onClick={handleConfirm} disabled={submitting}>
            <Heart size={14} />
            {submitting ? 'SAVING…' : 'ADD WANT'}
          </button>
        </div>
      </div>
    </div>
  );
}
