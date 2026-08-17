import { useEffect, useState } from 'react';
import { AlertTriangle, ArrowLeft, Check, ChevronRight, Search } from 'lucide-react';
import { getCardsInSet, searchSets, type TcgCard, type TcgSet } from '../api/pokemonTcg';
import { getCollectionTcgIds } from '../db/database';

type Filter = 'all' | 'owned' | 'missing';

export default function MasterSetScreen({ collectionVersion }: { collectionVersion: number }) {
  const [query, setQuery] = useState('');
  const [sets, setSets] = useState<TcgSet[]>([]);
  const [selectedSet, setSelectedSet] = useState<TcgSet | null>(null);
  const [cards, setCards] = useState<TcgCard[]>([]);
  const [ownedIds, setOwnedIds] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getCollectionTcgIds()
      .then((ids) => !cancelled && setOwnedIds(ids))
      .catch((e) => !cancelled && setError(String(e)));
    return () => {
      cancelled = true;
    };
  }, [collectionVersion]);

  useEffect(() => {
    if (selectedSet) return;
    const q = query.trim();
    if (!q) {
      setSets([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    const timer = setTimeout(() => {
      searchSets(q)
        .then((r) => !cancelled && setSets(r))
        .catch((e) => !cancelled && setError(String(e)))
        .finally(() => !cancelled && setLoading(false));
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, selectedSet]);

  async function openSet(set: TcgSet) {
    setSelectedSet(set);
    setLoading(true);
    setError(null);
    try {
      setCards(await getCardsInSet(set.id));
    } catch (e) {
      setError(String(e));
      setCards([]);
    } finally {
      setLoading(false);
    }
  }

  function back() {
    setSelectedSet(null);
    setCards([]);
    setFilter('all');
    setError(null);
  }

  const ownedCount = cards.filter((c) => ownedIds.has(c.id)).length;
  const pct = cards.length === 0 ? 0 : (ownedCount / cards.length) * 100;
  const visible = cards.filter((c) =>
    filter === 'owned' ? ownedIds.has(c.id) : filter === 'missing' ? !ownedIds.has(c.id) : true
  );

  if (!selectedSet) {
    return (
      <>
        <div className="toolbar">
          <label className="search-input">
            <Search size={18} />
            <input
              placeholder="Search a set to track…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoCorrect="off"
              autoCapitalize="none"
            />
          </label>
        </div>

        {error && (
          <div className="banner banner-error">
            <AlertTriangle size={14} />
            <span>{error}</span>
          </div>
        )}
        {loading && <div className="spinner" />}

        <div className="rows">
          {sets.map((set) => (
            <button className="row" key={set.id} onClick={() => openSet(set)}>
              {set.images?.symbol && (
                <img className="set-symbol" src={set.images.symbol} alt="" />
              )}
              <span style={{ flex: 1 }}>
                <span className="row-title">{set.name}</span>
                <span className="row-meta" style={{ display: 'block' }}>
                  {set.series} · {set.releaseDate} · {set.total} CARDS
                </span>
              </span>
              <ChevronRight size={16} color="var(--text-dim)" />
            </button>
          ))}
          {sets.length === 0 && !loading && (
            <div className="empty">
              {query.trim()
                ? `No sets match "${query}".`
                : 'Search for a set to see how close you are to completing it.'}
            </div>
          )}
        </div>
      </>
    );
  }

  return (
    <>
      <div className="back-row" style={{ paddingTop: 'var(--s-md)' }}>
        <button className="back-btn" onClick={back}>
          <ArrowLeft size={16} />
          BACK
        </button>
        <span className="back-title">{selectedSet.name}</span>
      </div>

      <div className="progress-card">
        <div className="progress-top">
          <span className="count">
            {ownedCount} / {cards.length}
          </span>
          <span className="pct">{pct.toFixed(1)}%</span>
        </div>
        <div className="progress-track">
          <div style={{ width: `${pct}%` }} />
        </div>
        <div className="range-row">
          {(['all', 'owned', 'missing'] as Filter[]).map((f) => (
            <button
              key={f}
              className={f === filter ? 'active' : undefined}
              onClick={() => setFilter(f)}
            >
              {f.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="banner banner-error">
          <AlertTriangle size={14} />
          <span>{error}</span>
        </div>
      )}
      {loading && <div className="spinner" />}

      <div className="set-grid">
        {visible.map((card) => {
          const owned = ownedIds.has(card.id);
          return (
            <div className={owned ? 'set-cell' : 'set-cell missing'} key={card.id}>
              {owned && (
                <span className="owned-badge">
                  <Check size={11} />
                </span>
              )}
              <img src={card.images.small} alt={card.name} loading="lazy" />
              <div className="num">#{card.number}</div>
            </div>
          );
        })}
      </div>
      {visible.length === 0 && !loading && <div className="empty">Nothing to show.</div>}
    </>
  );
}
