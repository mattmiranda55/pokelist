import { useCallback, useEffect, useState } from 'react';
import {
  CloudOff,
  Import,
  Info,
  Layers,
  LineChart,
  TrendingUp,
  Upload,
  Zap,
} from 'lucide-react';
import { getCollection, type CollectionCard } from '../db/database';
import { exportCollectionToCsv } from '../export/exportCsv';
import { getPriceHistory, type TimeRange } from '../api/priceHistory';
import PriceChart, { type PricePoint } from '../components/PriceChart';
import CardDetailModal from '../components/CardDetailModal';
import ImportPanel from './ImportPanel';

interface Props {
  onHeaderActions: (node: React.ReactNode) => void;
  onCollectionChanged: () => void;
}

function formatPrice(price: number | null): string {
  return price === null ? '—' : `$${price.toFixed(2)}`;
}

/** Per-variant price where recorded; the card-level price stands in for older rows. */
function cardValue(card: CollectionCard): number {
  return card.variants.reduce(
    (sum, v) => sum + v.quantity * (v.price_usd ?? card.price_usd ?? 0),
    0
  );
}

export default function CollectionScreen({ onHeaderActions, onCollectionChanged }: Props) {
  const [cards, setCards] = useState<CollectionCard[]>([]);
  const [range, setRange] = useState<TimeRange>('7D');
  const [history, setHistory] = useState<PricePoint[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    try {
      setCards(await getCollection());
      setLoadError(null);
    } catch (e) {
      // An unreachable API must not look like an empty collection.
      setLoadError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  useEffect(() => {
    let cancelled = false;
    getPriceHistory(range)
      .then((p) => !cancelled && setHistory(p))
      .catch(() => !cancelled && setHistory([]));
    return () => {
      cancelled = true;
    };
  }, [range, cards.length]);

  const handleExport = useCallback(async () => {
    setExporting(true);
    setNotice(null);
    try {
      const result = await exportCollectionToCsv();
      setNotice(`Exported ${result.rowCount} rows to ${result.filename}`);
    } catch (e) {
      setNotice(`Export failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setExporting(false);
    }
  }, []);

  useEffect(() => {
    onHeaderActions(
      <>
        <button
          className="header-btn"
          onClick={handleExport}
          disabled={exporting || cards.length === 0}
        >
          <Import size={14} />
          {exporting ? 'EXPORTING' : 'EXPORT'}
        </button>
        <button className="header-btn" onClick={() => setImportOpen(true)}>
          <Upload size={14} />
          IMPORT
        </button>
      </>
    );
    return () => onHeaderActions(null);
  }, [onHeaderActions, handleExport, exporting, cards.length]);

  const totalValue = cards.reduce((sum, c) => sum + cardValue(c), 0);
  const totalCards = cards.reduce((sum, c) => sum + c.total_quantity, 0);
  const topCards = cards
    .filter((c) => c.price_usd !== null)
    .sort((a, b) => (b.price_usd ?? 0) - (a.price_usd ?? 0))
    .slice(0, 5);

  const selected = selectedId === null ? null : cards.find((c) => c.id === selectedId) ?? null;

  function changed() {
    refetch();
    onCollectionChanged();
  }

  return (
    <>
      {loadError && (
        <div className="banner banner-error">
          <CloudOff size={16} />
          <span>Can't reach the collection server. {loadError}</span>
        </div>
      )}
      {notice && (
        <button className="banner banner-info" onClick={() => setNotice(null)}>
          <Info size={16} />
          <span>{notice}</span>
        </button>
      )}

      <div className="hero-row">
        <div className="stat-card">
          <div className="stat-label">TOTAL VALUE</div>
          <div className="stat-value">${totalValue.toFixed(2)}</div>
          <div className="stat-footer">
            <TrendingUp size={12} color="var(--success)" />
            USD
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">CARDS OWNED</div>
          <div className="stat-value">{totalCards}</div>
          <div className="stat-footer">
            <Layers size={12} color="var(--cyan)" />
            {cards.length} UNIQUE
          </div>
        </div>
      </div>

      <div className="chart-panel">
        <div className="chart-head">
          <LineChart size={18} color="var(--primary)" />
          PRICE HISTORY
        </div>
        <PriceChart points={history} />
        <div className="range-row">
          {(['7D', '3M', '6M'] as TimeRange[]).map((r) => (
            <button
              key={r}
              className={r === range ? 'active' : undefined}
              onClick={() => setRange(r)}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {topCards.length > 0 && (
        <>
          <div className="section-header">
            <TrendingUp size={16} color="var(--accent)" />
            TOP CARDS
          </div>
          <div className="top-row">
            {topCards.map((c, i) => (
              <div className="top-tile" key={c.id}>
                <span className="rank-badge">#{i + 1}</span>
                {c.image_url ? (
                  <img className="top-img" src={c.image_url} alt="" loading="lazy" />
                ) : (
                  <div className="top-img" />
                )}
                <div className="tile-name">{c.name}</div>
                <div className="tile-price">{formatPrice(c.price_usd)}</div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="section-header">
        <Layers size={16} color="var(--cyan)" />
        COLLECTION
      </div>

      {cards.length === 0 && !loadError ? (
        <div className="empty-cta">
          <h3>No cards yet</h3>
          <p className="empty" style={{ padding: 0 }}>
            Search to add cards, or import a collection from another app.
          </p>
          <button className="btn-primary" onClick={() => setImportOpen(true)}>
            <Upload size={16} />
            IMPORT COLLECTION
          </button>
        </div>
      ) : (
        <div className="grid">
          {cards.map((c) => (
            <button className="tile" key={c.id} onClick={() => setSelectedId(c.id)}>
              {c.total_quantity > 1 && <span className="qty-badge">×{c.total_quantity}</span>}
              {c.image_url ? (
                <img className="tile-img" src={c.image_url} alt="" loading="lazy" />
              ) : (
                <div className="tile-img tile-img-empty">
                  <Layers size={28} />
                </div>
              )}
              <div className="tile-name">{c.name}</div>
              <div className="tile-price">
                <Zap size={12} />
                {formatPrice(c.price_usd)}
              </div>
            </button>
          ))}
        </div>
      )}

      {importOpen && (
        <ImportPanel
          onClose={() => {
            setImportOpen(false);
            changed();
          }}
        />
      )}

      {selected && (
        <CardDetailModal
          card={selected}
          onClose={() => setSelectedId(null)}
          onChanged={changed}
        />
      )}
    </>
  );
}
