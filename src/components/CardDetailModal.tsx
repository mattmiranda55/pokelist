import { useEffect, useMemo, useState } from 'react';
import { Award, CreditCard, Layers, Minus, Plus, PlusCircle, Trash2, X } from 'lucide-react';
import {
  ALL_VARIANT_TYPES,
  getVariantTypesForCard,
  variantLabel,
} from '../api/pokemonTcg';
import { GRADING_COMPANIES, gradesForCompany } from '../grading';
import {
  addGradedCopy,
  addVariantToCard,
  removeCard,
  removeGradedCopy,
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

export default function CardDetailModal({ card, onClose, onChanged }: Props) {
  const [addPickerOpen, setAddPickerOpen] = useState(false);
  const [gradedFormOpen, setGradedFormOpen] = useState(false);
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
      `Remove from collection?\n\nThis will remove ${card.name}, all of its variants, and any graded copies.`
    );
    if (!ok) return;
    await removeCard(card.id);
    onChanged();
    onClose();
  }

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
              <div className="stat-label">QTY</div>
              <div className="v">{card.total_quantity}</div>
            </div>
            <div className="stat-box">
              <div className="stat-label">VARIANTS</div>
              <div className="v">{card.variants.length}</div>
            </div>
            <div className="stat-box">
              <div className="stat-label">GRADED</div>
              <div className="v">{card.graded.length}</div>
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
              <div className="variant-label">{variantLabel(v.variant_type)}</div>
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

          <div className="chart-head" style={{ margin: 0, fontSize: 12 }}>
            <Award size={14} color="var(--accent)" />
            GRADED COPIES
          </div>

          {card.graded.length === 0 && !gradedFormOpen && (
            <div className="empty" style={{ padding: 'var(--s-md)' }}>
              No graded copies. Each slab is tracked on its own.
            </div>
          )}

          {card.graded.map((g) => (
            <div className="variant-row" key={g.id}>
              <div className="variant-label">
                <span className="slab-grade">
                  {g.company} {g.grade}
                </span>
                <div className="slab-meta">
                  {[
                    g.variant_type ? variantLabel(g.variant_type) : 'Variant not recorded',
                    g.cert_number ? `CERT ${g.cert_number}` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
              </div>
              <button
                className="icon-btn"
                onClick={async () => {
                  await removeGradedCopy(g.id);
                  onChanged();
                }}
                aria-label={`Remove ${g.company} ${g.grade}`}
              >
                <Trash2 size={16} color="var(--danger)" />
              </button>
            </div>
          ))}

          {!gradedFormOpen ? (
            <button className="btn-dashed" onClick={() => setGradedFormOpen(true)}>
              <Plus size={14} />
              ADD GRADED COPY
            </button>
          ) : (
            <GradedForm
              variantTypes={cardVariantTypes ?? ALL_VARIANT_TYPES}
              onCancel={() => setGradedFormOpen(false)}
              onSubmit={async (input) => {
                await addGradedCopy(card.id, input);
                setGradedFormOpen(false);
                onChanged();
              }}
            />
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

interface GradedFormProps {
  variantTypes: string[];
  onCancel: () => void;
  onSubmit: (input: {
    variantType: string | null;
    company: string;
    grade: string;
    certNumber: string | null;
  }) => Promise<void>;
}

function GradedForm({ variantTypes, onCancel, onSubmit }: GradedFormProps) {
  const [company, setCompany] = useState(GRADING_COMPANIES[0]);
  const [grade, setGrade] = useState('10');
  const [variantType, setVariantType] = useState('');
  const [certNumber, setCertNumber] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const grades = gradesForCompany(company);

  // Switching companies can strip the designation that was selected (BGS Black Label → PSA).
  function pickCompany(next: string) {
    setCompany(next);
    if (!gradesForCompany(next).includes(grade)) setGrade('10');
  }

  async function submit() {
    if (submitting) return;
    setSubmitting(true);
    try {
      await onSubmit({
        variantType: variantType || null,
        company,
        grade,
        certNumber: certNumber.trim() || null,
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="picker-box">
      <span className="label">NEW GRADED COPY</span>

      <label className="field">
        <span>COMPANY</span>
        <select
          className="select"
          value={company}
          onChange={(e) => pickCompany(e.target.value)}
        >
          {GRADING_COMPANIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>GRADE</span>
        <select
          className="select"
          value={grade}
          onChange={(e) => setGrade(e.target.value)}
        >
          {grades.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>VARIANT</span>
        <select
          className="select"
          value={variantType}
          onChange={(e) => setVariantType(e.target.value)}
        >
          <option value="">Not recorded</option>
          {variantTypes.map((t) => (
            <option key={t} value={t}>
              {variantLabel(t)}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>CERT #</span>
        <input
          className="text-input"
          value={certNumber}
          onChange={(e) => setCertNumber(e.target.value)}
          placeholder="Optional"
          autoCorrect="off"
          autoCapitalize="none"
        />
      </label>

      <div className="sheet-foot" style={{ border: 'none', padding: 0 }}>
        <button className="btn-secondary" onClick={onCancel} disabled={submitting}>
          CANCEL
        </button>
        <button className="btn-primary" onClick={submit} disabled={submitting}>
          <Plus size={14} />
          {submitting ? 'ADDING…' : 'ADD SLAB'}
        </button>
      </div>
    </div>
  );
}
