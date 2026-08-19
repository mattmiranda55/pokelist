import { useCallback, useEffect, useState } from 'react';
import { CloudOff, Heart, Trash2 } from 'lucide-react';
import { variantLabel } from '../api/pokemonTcg';
import { getWants, removeWant, type Want } from '../db/database';

interface Props {
  dataVersion: number;
  onWantsChanged: () => void;
}

export default function WantsScreen({ dataVersion, onWantsChanged }: Props) {
  const [wants, setWants] = useState<Want[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    try {
      setWants(await getWants());
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch, dataVersion]);

  async function handleRemove(want: Want) {
    await removeWant(want.id);
    refetch();
    onWantsChanged();
  }

  return (
    <>
      {loadError && (
        <div className="banner banner-error">
          <CloudOff size={16} />
          <span>Can't reach the collection server. {loadError}</span>
        </div>
      )}

      <div className="section-header" style={{ marginTop: 'var(--s-lg)' }}>
        <Heart size={16} color="var(--primary)" />
        WANTS
        <span className="section-count">{wants.length}</span>
      </div>

      {wants.length === 0 && !loadError ? (
        <div className="empty">
          Nothing on the want list yet. Search for a card and hit WANT to track it here.
        </div>
      ) : (
        <div className="rows">
          {wants.map((w) => (
            <div className="card-row" key={w.id}>
              {w.image_url ? (
                <img src={w.image_url} alt="" loading="lazy" />
              ) : (
                <div className="card-row-img-empty" />
              )}
              <div className="card-row-info">
                <div className="card-row-name">{w.name}</div>
                <div className="row-meta">
                  {[w.set_name, w.card_number ? `#${w.card_number}` : null]
                    .filter(Boolean)
                    .join(' · ') || '—'}
                </div>
                <span className="chip">
                  {w.variant_type ? variantLabel(w.variant_type) : 'ANY VARIANT'}
                </span>
              </div>
              <button
                className="icon-btn"
                onClick={() => handleRemove(w)}
                aria-label={`Remove ${w.name} from wants`}
              >
                <Trash2 size={16} color="var(--danger)" />
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
