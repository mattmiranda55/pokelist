import { useCallback, useEffect, useState } from 'react';
import { Award, CloudOff, Import, Info, Layers, Upload } from 'lucide-react';
import { getCollection, type CollectionCard } from '../db/database';
import { exportCollectionToCsv } from '../export/exportCsv';
import CardDetailModal from '../components/CardDetailModal';
import ImportPanel from './ImportPanel';

interface Props {
  dataVersion: number;
  onHeaderActions: (node: React.ReactNode) => void;
  onCollectionChanged: () => void;
}

export default function CollectionScreen({
  dataVersion,
  onHeaderActions,
  onCollectionChanged,
}: Props) {
  const [cards, setCards] = useState<CollectionCard[]>([]);
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
  }, [refetch, dataVersion]);

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

      <div className="section-header" style={{ marginTop: 'var(--s-lg)' }}>
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
              {c.graded.length > 0 && (
                <span className="graded-badge">
                  <Award size={11} />
                  {c.graded.length}
                </span>
              )}
              {c.image_url ? (
                <img className="tile-img" src={c.image_url} alt="" loading="lazy" />
              ) : (
                <div className="tile-img tile-img-empty">
                  <Layers size={28} />
                </div>
              )}
              <div className="tile-name">{c.name}</div>
              <div className="tile-meta">
                {[c.set_name, c.card_number ? `#${c.card_number}` : null]
                  .filter(Boolean)
                  .join(' · ') || '—'}
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
