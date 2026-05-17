import { useCallback, useLayoutEffect, useState } from 'react';
import {
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getDatabase } from '../db/database';
import { exportCollectionToCsv } from '../export/exportCsv';
import { colors, fontFamily, radius, spacing } from '../theme';
import ImportScreen from './ImportScreen';

type TimeRange = '7D' | '3M' | '6M';

interface Card {
  id: number;
  name: string;
  image_url: string | null;
  price_usd: number | null;
}

function formatPrice(price: number | null): string {
  if (price === null) return '—';
  return `$${price.toFixed(2)}`;
}

function CardTile({ card }: { card: Card }) {
  return (
    <View style={styles.cardTile}>
      <View style={styles.cardImageWrap}>
        {card.image_url ? (
          <Image source={{ uri: card.image_url }} style={styles.cardImage} />
        ) : (
          <View style={styles.cardImagePlaceholder}>
            <MaterialCommunityIcons name="cards-outline" size={28} color={colors.textDim} />
          </View>
        )}
      </View>
      <Text style={styles.cardName} numberOfLines={1}>{card.name}</Text>
      <View style={styles.cardPriceRow}>
        <MaterialCommunityIcons name="flash" size={12} color={colors.accent} />
        <Text style={styles.cardPrice}>{formatPrice(card.price_usd)}</Text>
      </View>
    </View>
  );
}

function TopCardTile({ card, rank }: { card: Card; rank: number }) {
  return (
    <View style={styles.topCardTile}>
      <View style={styles.rankBadge}>
        <Text style={styles.rankText}>#{rank}</Text>
      </View>
      {card.image_url ? (
        <Image source={{ uri: card.image_url }} style={styles.topCardImage} />
      ) : (
        <View style={styles.topCardImagePlaceholder} />
      )}
      <Text style={styles.topCardName} numberOfLines={1}>{card.name}</Text>
      <Text style={styles.topCardPrice}>{formatPrice(card.price_usd)}</Text>
    </View>
  );
}

export default function CollectionScreen() {
  const navigation = useNavigation();
  const [timeRange, setTimeRange] = useState<TimeRange>('7D');
  const [cards, setCards] = useState<Card[]>([]);
  const [importOpen, setImportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleExport = useCallback(async () => {
    if (exporting) return;
    setExporting(true);
    try {
      await exportCollectionToCsv();
    } catch (e) {
      console.error('Export failed', e);
    } finally {
      setExporting(false);
    }
  }, [exporting]);

  const refetch = useCallback(async () => {
    const db = await getDatabase();
    const rows = await db.getAllAsync<Card>(`
      SELECT
        c.id AS id,
        c.name AS name,
        c.image_url AS image_url,
        (
          SELECT p.price_usd
          FROM price_history p
          WHERE p.card_id = c.id
          ORDER BY p.fetched_at DESC
          LIMIT 1
        ) AS price_usd
      FROM cards c
      ORDER BY c.added_at DESC
    `);
    setCards(rows);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      refetch().catch(() => {
        if (!cancelled) {
          /* swallow — empty state will render */
        }
      });
      return () => {
        cancelled = true;
      };
    }, [refetch])
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={styles.headerActions}>
          <Pressable
            onPress={handleExport}
            disabled={exporting || cards.length === 0}
            style={({ pressed }) => [
              styles.headerButton,
              (exporting || cards.length === 0) && styles.headerButtonDisabled,
              pressed && { backgroundColor: colors.surfaceHover },
            ]}
            hitSlop={8}
          >
            <MaterialCommunityIcons name="tray-arrow-down" size={16} color={colors.text} />
            <Text style={styles.headerButtonText}>
              {exporting ? 'EXPORTING' : 'EXPORT'}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setImportOpen(true)}
            style={({ pressed }) => [
              styles.headerButton,
              pressed && { backgroundColor: colors.surfaceHover },
            ]}
            hitSlop={8}
          >
            <MaterialCommunityIcons name="tray-arrow-up" size={16} color={colors.text} />
            <Text style={styles.headerButtonText}>IMPORT</Text>
          </Pressable>
        </View>
      ),
    });
  }, [navigation, handleExport, exporting, cards.length]);

  const topCards = [...cards]
    .filter((c) => c.price_usd !== null)
    .sort((a, b) => (b.price_usd ?? 0) - (a.price_usd ?? 0))
    .slice(0, 5);

  const totalValue = cards.reduce((sum, c) => sum + (c.price_usd ?? 0), 0);

  return (
    <>
      <FlatList
        style={styles.screen}
        contentContainerStyle={styles.scrollContent}
        data={cards}
        keyExtractor={(item) => String(item.id)}
        numColumns={2}
        columnWrapperStyle={styles.gridRow}
        renderItem={({ item }) => <CardTile card={item} />}
        ListHeaderComponent={
          <>
            <View style={styles.heroRow}>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>TOTAL VALUE</Text>
                <Text style={styles.statValue}>${totalValue.toFixed(2)}</Text>
                <View style={styles.statFooter}>
                  <MaterialCommunityIcons name="trending-up" size={12} color={colors.success} />
                  <Text style={styles.statFooterText}>USD</Text>
                </View>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>CARDS OWNED</Text>
                <Text style={styles.statValue}>{cards.length}</Text>
                <View style={styles.statFooter}>
                  <MaterialCommunityIcons name="cards" size={12} color={colors.cyan} />
                  <Text style={styles.statFooterText}>UNIQUE</Text>
                </View>
              </View>
            </View>

            <View style={styles.chartContainer}>
              <View style={styles.chartHeader}>
                <MaterialCommunityIcons name="chart-line" size={18} color={colors.primary} />
                <Text style={styles.chartTitle}>PRICE HISTORY</Text>
              </View>
              <View style={styles.chartArea}>
                <View style={styles.chartGridRow} />
                <View style={styles.chartGridRow} />
                <View style={styles.chartGridRow} />
                <Text style={styles.chartPlaceholder}>
                  {cards.length === 0
                    ? 'Add cards to track price history'
                    : 'Chart coming soon'}
                </Text>
              </View>
              <View style={styles.toggleRow}>
                {(['7D', '3M', '6M'] as TimeRange[]).map((range) => (
                  <Pressable
                    key={range}
                    style={[
                      styles.toggleButton,
                      timeRange === range && styles.toggleButtonActive,
                    ]}
                    onPress={() => setTimeRange(range)}
                  >
                    <Text
                      style={[
                        styles.toggleText,
                        timeRange === range && styles.toggleTextActive,
                      ]}
                    >
                      {range}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {topCards.length > 0 && (
              <>
                <View style={styles.sectionHeader}>
                  <MaterialCommunityIcons name="trending-up" size={16} color={colors.accent} />
                  <Text style={styles.sectionTitle}>TOP CARDS</Text>
                </View>
                <FlatList
                  data={topCards}
                  keyExtractor={(item) => `top-${item.id}`}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.topCardsRow}
                  renderItem={({ item, index }) => (
                    <TopCardTile card={item} rank={index + 1} />
                  )}
                />
              </>
            )}

            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="cards" size={16} color={colors.cyan} />
              <Text style={styles.sectionTitle}>COLLECTION</Text>
            </View>
          </>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>No cards yet</Text>
            <Text style={styles.emptyText}>
              Search to add cards, or import a collection from another app.
            </Text>
            <Pressable
              onPress={() => setImportOpen(true)}
              style={styles.emptyImportButton}
            >
              <MaterialCommunityIcons name="tray-arrow-up" size={16} color={colors.text} />
              <Text style={styles.emptyImportButtonText}>IMPORT COLLECTION</Text>
            </Pressable>
          </View>
        }
      />

      <Modal
        visible={importOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setImportOpen(false)}
      >
        <ImportScreen
          onClose={() => {
            setImportOpen(false);
            refetch();
          }}
        />
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scrollContent: {
    paddingBottom: spacing.xxl,
  },

  headerActions: {
    flexDirection: 'row',
    gap: 6,
    marginRight: spacing.md,
  },
  headerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerButtonDisabled: {
    opacity: 0.5,
  },
  headerButtonText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },

  heroRow: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
    fontFamily: fontFamily.mono,
  },
  statFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  statFooterText: {
    fontSize: 10,
    color: colors.textDim,
    letterSpacing: 0.6,
    fontWeight: '600',
  },

  chartContainer: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: spacing.md,
  },
  chartTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: 1.4,
  },
  chartArea: {
    height: 160,
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    justifyContent: 'space-evenly',
    padding: spacing.md,
    position: 'relative',
  },
  chartGridRow: {
    height: 1,
    backgroundColor: colors.border,
    opacity: 0.6,
  },
  chartPlaceholder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    textAlign: 'center',
    textAlignVertical: 'center',
    color: colors.textDim,
    fontSize: 12,
    letterSpacing: 0.8,
    paddingTop: 70,
    fontFamily: fontFamily.mono,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 6,
  },
  toggleButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.sm,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  toggleButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  toggleText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.8,
    fontFamily: fontFamily.mono,
  },
  toggleTextActive: {
    color: colors.text,
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: 1.4,
  },

  topCardsRow: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.sm,
  },
  topCardTile: {
    width: 130,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    position: 'relative',
  },
  rankBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.pill,
    zIndex: 1,
  },
  rankText: {
    color: colors.text,
    fontSize: 10,
    fontWeight: '800',
    fontFamily: fontFamily.mono,
  },
  topCardImage: {
    height: 110,
    borderRadius: radius.sm,
    marginBottom: spacing.sm,
    resizeMode: 'contain',
    backgroundColor: colors.bg,
  },
  topCardImagePlaceholder: {
    height: 110,
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    marginBottom: spacing.sm,
  },
  topCardName: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 2,
  },
  topCardPrice: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.accent,
    fontFamily: fontFamily.mono,
  },

  gridRow: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  cardTile: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardImageWrap: {
    borderRadius: radius.sm,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  cardImage: {
    height: 150,
    resizeMode: 'contain',
    backgroundColor: colors.bg,
  },
  cardImagePlaceholder: {
    height: 150,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  cardPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cardPrice: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.accent,
    fontFamily: fontFamily.mono,
  },

  emptyContainer: {
    paddingVertical: 64,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  emptyImportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
  },
  emptyImportButtonText: {
    color: colors.text,
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 1,
  },
});
