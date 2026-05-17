import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import pokemonNames from '../../pokemon-names.json';
import {
  extractPriceUsd,
  getCardsInSet,
  searchCardsByName,
  searchSets,
  type TcgCard,
  type TcgSet,
} from '../api/pokemonTcg';
import { addCardToCollection, getCollectionTcgIds } from '../db/database';
import { colors, fontFamily, radius, spacing } from '../theme';

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
  const scored: Array<{ name: string; score: number }> = [];
  for (const name of NAMES) {
    const s = fuzzyScore(name, query);
    if (s >= 0) scored.push({ name, score: s });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.name);
}

function formatPrice(price: number | null): string {
  if (price === null) return '—';
  return `$${price.toFixed(2)}`;
}

export default function SearchScreen() {
  const [mode, setMode] = useState<Mode>('pokemon');
  const [query, setQuery] = useState('');

  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [selectedSet, setSelectedSet] = useState<TcgSet | null>(null);

  const [setResults, setSetResults] = useState<TcgSet[]>([]);
  const [cards, setCards] = useState<TcgCard[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [ownedIds, setOwnedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    getCollectionTcgIds().then(setOwnedIds).catch((e) => setError(String(e)));
  }, []);

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
        .then((sets) => {
          if (!cancelled) setSetResults(sets);
        })
        .catch((e) => {
          if (!cancelled) setError(String(e));
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
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

  async function loadCardsForName(name: string) {
    setSelectedName(name);
    setSelectedSet(null);
    setLoading(true);
    setError(null);
    try {
      const result = await searchCardsByName(name);
      setCards(result);
    } catch (e) {
      setError(String(e));
      setCards([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadCardsForSet(set: TcgSet) {
    setSelectedSet(set);
    setSelectedName(null);
    setLoading(true);
    setError(null);
    try {
      const result = await getCardsInSet(set.id);
      setCards(result);
    } catch (e) {
      setError(String(e));
      setCards([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd(card: TcgCard) {
    try {
      await addCardToCollection({
        pokemon_tcg_id: card.id,
        name: card.name,
        set_name: card.set.name,
        series: card.set.series,
        image_url: card.images.small,
        rarity: card.rarity ?? null,
        card_number: card.number,
        price_usd: extractPriceUsd(card),
      });
      setOwnedIds((prev) => {
        const next = new Set(prev);
        next.add(card.id);
        return next;
      });
    } catch (e) {
      setError(String(e));
    }
  }

  const showingResults = selectedName !== null || selectedSet !== null;

  return (
    <View style={styles.screen}>
      {/* Mode toggle */}
      <View style={styles.modeRow}>
        <Pressable
          style={[styles.modeButton, mode === 'pokemon' && styles.modeButtonActive]}
          onPress={() => switchMode('pokemon')}
        >
          <MaterialCommunityIcons
            name="cards"
            size={14}
            color={mode === 'pokemon' ? colors.text : colors.textMuted}
          />
          <Text style={[styles.modeText, mode === 'pokemon' && styles.modeTextActive]}>
            POKÉMON
          </Text>
        </Pressable>
        <Pressable
          style={[styles.modeButton, mode === 'set' && styles.modeButtonActive]}
          onPress={() => switchMode('set')}
        >
          <MaterialCommunityIcons
            name="layers-triple"
            size={14}
            color={mode === 'set' ? colors.text : colors.textMuted}
          />
          <Text style={[styles.modeText, mode === 'set' && styles.modeTextActive]}>
            SET
          </Text>
        </Pressable>
      </View>

      {/* Search input */}
      <View style={styles.inputWrap}>
        <View style={styles.inputIcon}>
          <MaterialCommunityIcons name="magnify" size={18} color={colors.textMuted} />
        </View>
        <TextInput
          style={styles.input}
          placeholder={mode === 'pokemon' ? 'Search Pokémon…' : 'Search sets…'}
          placeholderTextColor={colors.textDim}
          value={query}
          onChangeText={(t) => {
            setQuery(t);
            resetSelection();
          }}
          autoCorrect={false}
          autoCapitalize="none"
        />
      </View>

      {error && (
        <View style={styles.errorRow}>
          <MaterialCommunityIcons name="alert" size={14} color={colors.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {!showingResults && mode === 'pokemon' && (
        <FlatList
          data={nameSuggestions}
          keyExtractor={(item) => item}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [
                styles.suggestionRow,
                pressed && styles.suggestionRowPressed,
              ]}
              onPress={() => loadCardsForName(item)}
            >
              <Text style={styles.suggestionText}>{item}</Text>
              <MaterialCommunityIcons name="chevron-right" size={16} color={colors.textDim} />
            </Pressable>
          )}
          ListEmptyComponent={
            query.trim() ? (
              <Text style={styles.emptyText}>No Pokémon match "{query}".</Text>
            ) : (
              <Text style={styles.emptyText}>Start typing to search 1000+ Pokémon.</Text>
            )
          }
        />
      )}

      {!showingResults && mode === 'set' && (
        <>
          {loading && <ActivityIndicator style={styles.loading} color={colors.primary} />}
          <FlatList
            data={setResults}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <Pressable
                style={({ pressed }) => [
                  styles.setRow,
                  pressed && styles.suggestionRowPressed,
                ]}
                onPress={() => loadCardsForSet(item)}
              >
                {item.images?.symbol && (
                  <View style={styles.setSymbolWrap}>
                    <Image
                      source={{ uri: item.images.symbol }}
                      style={styles.setSymbol}
                    />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.suggestionText}>{item.name}</Text>
                  <Text style={styles.setMeta}>
                    {item.series} · {item.releaseDate} · {item.total} CARDS
                  </Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={16} color={colors.textDim} />
              </Pressable>
            )}
            ListEmptyComponent={
              query.trim() && !loading ? (
                <Text style={styles.emptyText}>No sets match "{query}".</Text>
              ) : !query.trim() ? (
                <Text style={styles.emptyText}>Search for a TCG set name.</Text>
              ) : null
            }
          />
        </>
      )}

      {showingResults && (
        <View style={{ flex: 1 }}>
          <View style={styles.headerRow}>
            <Pressable onPress={resetSelection} hitSlop={10} style={styles.backButton}>
              <MaterialCommunityIcons name="arrow-left" size={16} color={colors.text} />
              <Text style={styles.backText}>BACK</Text>
            </Pressable>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {selectedName ?? selectedSet?.name}
            </Text>
          </View>

          {loading && <ActivityIndicator style={styles.loading} color={colors.primary} />}

          <FlatList
            data={cards}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => {
              const owned = ownedIds.has(item.id);
              const price = extractPriceUsd(item);
              return (
                <View style={styles.cardRow}>
                  <Image
                    source={{ uri: item.images.small }}
                    style={styles.cardImage}
                  />
                  <View style={styles.cardInfo}>
                    <Text style={styles.cardName} numberOfLines={2}>
                      {item.name}
                    </Text>
                    <Text style={styles.cardMeta} numberOfLines={1}>
                      {item.set.name} · #{item.number}
                    </Text>
                    {item.rarity && (
                      <View style={styles.rarityChip}>
                        <Text style={styles.rarityText}>{item.rarity}</Text>
                      </View>
                    )}
                    <Text style={styles.cardPrice}>{formatPrice(price)}</Text>
                  </View>
                  <Pressable
                    style={[styles.addButton, owned && styles.addButtonOwned]}
                    onPress={() => !owned && handleAdd(item)}
                    disabled={owned}
                  >
                    <MaterialCommunityIcons
                      name={owned ? 'check' : 'plus'}
                      size={14}
                      color={owned ? colors.textMuted : colors.text}
                    />
                    <Text
                      style={[
                        styles.addButtonText,
                        owned && styles.addButtonTextOwned,
                      ]}
                    >
                      {owned ? 'ADDED' : 'ADD'}
                    </Text>
                  </Pressable>
                </View>
              );
            }}
            ListEmptyComponent={
              !loading && !error ? (
                <Text style={styles.emptyText}>No cards found.</Text>
              ) : null
            }
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingTop: spacing.md,
  },

  modeRow: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  modeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: radius.sm,
  },
  modeButtonActive: {
    backgroundColor: colors.primary,
  },
  modeText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 1.2,
  },
  modeTextActive: {
    color: colors.text,
  },

  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  inputIcon: {
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
    outlineStyle: 'none' as any,
  },

  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    padding: spacing.sm,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  errorText: {
    color: colors.danger,
    fontSize: 12,
    flex: 1,
  },

  listContent: {
    paddingBottom: spacing.xxl,
  },

  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: spacing.lg,
    marginBottom: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  suggestionRowPressed: {
    backgroundColor: colors.surfaceHover,
    borderColor: colors.borderStrong,
  },
  suggestionText: {
    fontSize: 15,
    color: colors.text,
    fontWeight: '600',
  },

  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  setSymbolWrap: {
    width: 36,
    height: 36,
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },
  setSymbol: {
    width: 28,
    height: 28,
    resizeMode: 'contain',
  },
  setMeta: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 4,
    letterSpacing: 0.5,
    fontFamily: fontFamily.mono,
  },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  backText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    flex: 1,
    letterSpacing: 0.5,
  },

  cardRow: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    padding: spacing.md,
    gap: spacing.md,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardImage: {
    width: 64,
    height: 90,
    borderRadius: radius.sm,
    resizeMode: 'contain',
    backgroundColor: colors.bg,
  },
  cardInfo: {
    flex: 1,
  },
  cardName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  cardMeta: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 4,
    letterSpacing: 0.4,
  },
  rarityChip: {
    alignSelf: 'flex-start',
    backgroundColor: colors.bg,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.sm,
    marginTop: 6,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  rarityText: {
    fontSize: 10,
    color: colors.cyan,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  cardPrice: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.accent,
    marginTop: 6,
    fontFamily: fontFamily.mono,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.sm,
    backgroundColor: colors.primary,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  addButtonOwned: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  addButtonText: {
    color: colors.text,
    fontWeight: '800',
    fontSize: 11,
    letterSpacing: 1,
  },
  addButtonTextOwned: {
    color: colors.textMuted,
  },

  emptyText: {
    textAlign: 'center',
    color: colors.textDim,
    fontSize: 13,
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  loading: {
    paddingVertical: spacing.lg,
  },
});
