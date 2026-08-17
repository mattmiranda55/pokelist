import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeft, ChevronRight, Layers, Plus, Search } from 'lucide-react';
import pokemonNames from '../../pokemon-names.json';
import {
  extractPriceUsd,
  getCardsInSet,
  searchCardsByName,
  searchSets,
  type TcgCard,
  type TcgSet,
} from '../api/pokemonTcg';
import {
  addCardWithVariants,
  getCollectionTcgIds,
  type VariantSelection,
} from '../db/database';
import VariantPickerSheet from '../components/VariantPickerSheet';

type Mode = 'pokemon' | 'set';

const NAMES = pokemonNames as string[];

function fuzzyScore(name: string, query: string): number {
  const n = name.toLowerCase();
  const q = query.toLowerCase();
  if (n === q) return 1000;
  if (n.startsWith(q)) return 600 - (n.length - q.length);
  const idx = n.indexOf(q);
  if (idx >= 0) return 300 - idx - (n.length - q.length);
  let qi = 0;
  for (let i = 0; i < n.length && qi < q.length; i++) {
    if (n[i] === q[qi]) qi++;
  }
  if (qi === q.length) return 100 - n.length;
  return -1;
}

function fuzzyFilter(query: string, limit = 25): string[] {
  if (!query.trim()) return [];
  const scored: { name: string; score: number }[] = [];
  for (const name of NAMES) {
    const s = fuzzyScore(name, query);
    if (s >= 0) scored.push({ name, score: s });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.name);
}

function formatPrice(price: number | null): string {
  return price === null ? '—' : `$${price.toFixed(2)}`;
}

interface Props {
  collectionVersion: number;
  onCollectionChanged: () => void;
}

export default function SearchScreen({ collectionVersion, onCollectionChanged }: Props) {
  const [mode, setMode] = useState<Mode>('pokemon');
  const [query, setQuery] = useState('');
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [selectedSet, setSelectedSet] = useState<TcgSet | null>(null);
  const [setResults, setSetResults] = useState<TcgSet[]>([]);
  const [cards, setCards] = useState<TcgCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ownedIds, setOwnedIds] = useState<Set<string>>(new Set());
  const [pickerCard, setPickerCard] = useState<TcgCard | null>(null);

  // Re-reads whenever the collection changes elsewhere, so ADD/OWNED never goes stale.
  useEffect(() => {
    let cancelled = false;
    getCollectionTcgIds()
      .then((ids) => !cancelled && setOwnedIds(ids))
      .catch((e) => !cancelled && setError(String(e)));
    return () => {
      cancelled = true;
    };
  }, [collectionVersion]);

  const nameSuggestions = useMemo(
    () => (mode === 'pokemon' ? fuzzyFilter(query) : []),
    [mode, query]
  );

  useEffect(() => {
    if (mode !== 'set') {
      setSetResults([]);
      return;
    }
    const q = query.trim();
    if (!q) {
      setSetResults([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    const timer = setTimeout(() => {
      searchSets(q)
        .then((s) => !cancelled && setSetResults(s))
        .catch((e) => !cancelled && setError(String(e)))
        .finally(() => !cancelled && setLoading(false));
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [mode, query]);

  function resetSelection() {
    setSelectedName(null);
    setSelectedSet(null);
    setCards([]);
    setError(null);
  }

  function switchMode(next: Mode) {
    setMode(next);
    setQuery('');
    resetSelection();
  }

  async function load(fn: () => Promise<TcgCard[]>) {
    setLoading(true);
    setError(null);
    try {
      setCards(await fn());
    } catch (e) {
      setError(String(e));
      setCards([]);
    } finally {
      setLoading(false);
    }
  }

  function openName(name: string) {
    setSelectedName(name);
    setSelectedSet(null);
    load(() => searchCardsByName(name));
  }

  function openSet(set: TcgSet) {
    setSelectedSet(set);
    setSelectedName(null);
    load(() => getCardsInSet(set.id));
  }

  async function handleConfirmAdd(card: TcgCard, variants: VariantSelection[]) {
    try {
      await addCardWithVariants(
        {
          pokemon_tcg_id: card.id,
          name: card.name,
          set_name: card.set.name,
          series: card.set.series,
          image_url: card.images.small,
          rarity: card.rarity ?? null,
          card_number: card.number,
          price_usd: extractPriceUsd(card),
        },
        variants
      );
      setOwnedIds((prev) => new Set(prev).add(card.id));
      setPickerCard(null);
      onCollectionChanged();
    } catch (e) {
      setError(String(e));
    }
  }

  const showingResults = selectedName !== null || selectedSet !== null;

  return (
    <>
      <div className="toolbar">
        <div className="mode-row">
          <button
            className={mode === 'pokemon' ? 'active' : undefined}
            onClick={() => switchMode('pokemon')}
          >
            <Layers size={14} />
            POKÉMON
          </button>
          <button
            className={mode === 'set' ? 'active' : undefined}
            onClick={() => switchMode('set')}
          >
            <Layers size={14} />
            SET
          </button>
        </div>

        <label className="search-input">
          <Search size={18} />
          <input
            placeholder={mode === 'pokemon' ? 'Search Pokémon…' : 'Search sets…'}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              resetSelection();
            }}
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

      {!showingResults && mode === 'pokemon' && (
        <div className="rows">
          {nameSuggestions.map((name) => (
            <button className="row" key={name} onClick={() => openName(name)}>
              <span className="row-title" style={{ flex: 1 }}>
                {name}
              </span>
              <ChevronRight size={16} color="var(--text-dim)" />
            </button>
          ))}
          {nameSuggestions.length === 0 && (
            <div className="empty">
              {query.trim()
                ? `No Pokémon match "${query}".`
                : 'Start typing to search 1000+ Pokémon.'}
            </div>
          )}
        </div>
      )}

      {!showingResults && mode === 'set' && (
        <div className="rows">
          {setResults.map((set) => (
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
          {setResults.length === 0 && !loading && (
            <div className="empty">
              {query.trim() ? `No sets match "${query}".` : 'Search for a TCG set name.'}
            </div>
          )}
        </div>
      )}

      {showingResults && (
        <>
          <div className="back-row">
            <button className="back-btn" onClick={resetSelection}>
              <ArrowLeft size={16} />
              BACK
            </button>
            <span className="back-title">{selectedName ?? selectedSet?.name}</span>
          </div>

          <div className="rows">
            {cards.map((card) => {
              const owned = ownedIds.has(card.id);
              return (
                <div className="card-row" key={card.id}>
                  <img src={card.images.small} alt="" loading="lazy" />
                  <div className="card-row-info">
                    <div className="card-row-name">{card.name}</div>
                    <div className="row-meta">
                      {card.set.name} · #{card.number}
                    </div>
                    {card.rarity && <span className="chip">{card.rarity}</span>}
                    <div className="price">{formatPrice(extractPriceUsd(card))}</div>
                  </div>
                  <button
                    className={owned ? 'add-btn owned' : 'add-btn'}
                    onClick={() => setPickerCard(card)}
                  >
                    <Plus size={14} />
                    {owned ? 'OWNED' : 'ADD'}
                  </button>
                </div>
              );
            })}
            {cards.length === 0 && !loading && !error && (
              <div className="empty">No cards found.</div>
            )}
          </div>
        </>
      )}

      {pickerCard && (
        <VariantPickerSheet
          card={pickerCard}
          onClose={() => setPickerCard(null)}
          onConfirm={handleConfirmAdd}
        />
      )}
    </>
  );
}
