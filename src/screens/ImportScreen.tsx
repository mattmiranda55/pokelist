import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { colors, fontFamily, radius, spacing } from '../theme';
import {
  detectColumns,
  parseCsv,
  stripVariant,
  type ColumnMap,
  type ParsedCsv,
} from '../import/csv';
import { extractPriceUsd, findCardForImport } from '../api/pokemonTcg';
import { addCardToCollection } from '../db/database';

interface ImportScreenProps {
  onClose: () => void;
}

interface ImportResult {
  matched: number;
  unmatched: { row: Record<string, string>; reason: string }[];
}

type Phase = 'input' | 'preview' | 'importing' | 'done';

export default function ImportScreen({ onClose }: ImportScreenProps) {
  const [text, setText] = useState('');
  const [phase, setPhase] = useState<Phase>('input');
  const [error, setError] = useState<string | null>(null);

  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [result, setResult] = useState<ImportResult | null>(null);

  const parsed: ParsedCsv | null = useMemo(() => {
    if (!text.trim()) return null;
    try {
      return parseCsv(text);
    } catch (e) {
      return null;
    }
  }, [text]);

  const columns: ColumnMap | null = useMemo(
    () => (parsed ? detectColumns(parsed.headers) : null),
    [parsed]
  );

  const canImport = !!(parsed && columns?.name && parsed.rows.length > 0);

  async function handlePickFile() {
    setError(null);
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/plain', 'text/tab-separated-values', '*/*'],
        multiple: false,
        copyToCacheDirectory: true,
      });
      if (res.canceled) return;
      const asset = res.assets[0];
      const fileText = await (await fetch(asset.uri)).text();
      setText(fileText);
      setPhase('preview');
    } catch (e) {
      setError(`Could not read file: ${String(e)}`);
    }
  }

  async function handleImport() {
    if (!parsed || !columns?.name) return;
    setError(null);
    setPhase('importing');
    setProgress({ done: 0, total: parsed.rows.length });

    const unmatched: ImportResult['unmatched'] = [];
    let matched = 0;

    for (let i = 0; i < parsed.rows.length; i++) {
      const row = parsed.rows[i];
      const rawName = row[columns.name];
      const name = rawName ? stripVariant(rawName) : '';
      if (!name) {
        unmatched.push({ row, reason: 'Missing name' });
      } else {
        try {
          const card = await findCardForImport({
            name,
            set: columns.set ? row[columns.set] || undefined : undefined,
            number: columns.number ? row[columns.number] || undefined : undefined,
          });
          if (card) {
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
            matched++;
          } else {
            unmatched.push({ row, reason: 'No card matched' });
          }
        } catch (e) {
          unmatched.push({ row, reason: String(e) });
        }
      }
      setProgress({ done: i + 1, total: parsed.rows.length });
    }

    setResult({ matched, unmatched });
    setPhase('done');
  }

  function reset() {
    setText('');
    setPhase('input');
    setError(null);
    setResult(null);
    setProgress({ done: 0, total: 0 });
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <MaterialCommunityIcons name="tray-arrow-up" size={20} color={colors.primary} />
          <Text style={styles.headerTitle}>IMPORT COLLECTION</Text>
        </View>
        <Pressable onPress={onClose} hitSlop={10} style={styles.closeButton}>
          <MaterialCommunityIcons name="close" size={18} color={colors.text} />
        </Pressable>
      </View>

      {error && (
        <View style={styles.errorRow}>
          <MaterialCommunityIcons name="alert" size={14} color={colors.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {(phase === 'input' || phase === 'preview') && (
        <ScrollView contentContainerStyle={styles.bodyContent} keyboardShouldPersistTaps="handled">
          <Text style={styles.helperText}>
            Paste a CSV from Collectr, Dragon Shield, or any app with a{' '}
            <Text style={styles.helperEmphasis}>name</Text> column. Each row is matched to a
            Pokémon TCG card by name, set, and number.
          </Text>

          <View style={styles.tipBox}>
            <MaterialCommunityIcons name="information-outline" size={14} color={colors.cyan} />
            <Text style={styles.tipText}>
              <Text style={styles.tipLabel}>TCGPlayer: </Text>
              open your collection page, select the table rows, copy, and paste below — we
              auto-detect the format (no headers needed) and strip variant labels like{' '}
              <Text style={styles.tipMono}>[Holofoil]</Text> before matching.
            </Text>
          </View>

          <Pressable style={styles.fileButton} onPress={handlePickFile}>
            <MaterialCommunityIcons name="file-document-outline" size={18} color={colors.text} />
            <Text style={styles.fileButtonText}>CHOOSE CSV FILE</Text>
          </Pressable>

          <Text style={styles.orText}>OR PASTE BELOW</Text>

          <TextInput
            style={styles.textArea}
            value={text}
            onChangeText={(t) => {
              setText(t);
              if (t.trim()) setPhase('preview');
              else setPhase('input');
            }}
            placeholder={'Name,Set,Card Number,Quantity\nCharizard ex,Obsidian Flames,125,1\n…'}
            placeholderTextColor={colors.textDim}
            multiline
            autoCorrect={false}
            autoCapitalize="none"
          />

          {parsed && parsed.rows.length > 0 && columns && (
            <>
              {parsed.source === 'tcgplayer-paste' && (
                <View style={styles.sourceBadge}>
                  <MaterialCommunityIcons name="check-circle" size={12} color={colors.success} />
                  <Text style={styles.sourceBadgeText}>TCGPLAYER FORMAT DETECTED</Text>
                </View>
              )}

              <Text style={styles.sectionLabel}>DETECTED COLUMNS</Text>
              <View style={styles.detectedBox}>
                <DetectedRow label="NAME" value={columns.name} required />
                <DetectedRow label="SET" value={columns.set} />
                <DetectedRow label="NUMBER" value={columns.number} />
                <DetectedRow label="QUANTITY" value={columns.quantity} />
              </View>

              <Text style={styles.sectionLabel}>
                PREVIEW ({parsed.rows.length} rows total)
              </Text>
              <View style={styles.previewBox}>
                {parsed.rows.slice(0, 5).map((row, idx) => (
                  <View key={idx} style={styles.previewRow}>
                    <Text style={styles.previewIndex}>{idx + 1}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.previewName} numberOfLines={1}>
                        {columns.name ? row[columns.name] : '?'}
                      </Text>
                      <Text style={styles.previewMeta} numberOfLines={1}>
                        {[
                          columns.set ? row[columns.set] : null,
                          columns.number ? `#${row[columns.number]}` : null,
                        ]
                          .filter(Boolean)
                          .join(' · ') || '—'}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>

              <Pressable
                style={[styles.primaryButton, !canImport && styles.primaryButtonDisabled]}
                onPress={handleImport}
                disabled={!canImport}
              >
                <MaterialCommunityIcons name="tray-arrow-down" size={16} color={colors.text} />
                <Text style={styles.primaryButtonText}>
                  IMPORT {parsed.rows.length} CARDS
                </Text>
              </Pressable>

              {!columns.name && (
                <Text style={styles.warningText}>
                  Couldn't find a "name" column. Make sure your CSV has a header row with a
                  recognized name column (Name, Card Name, etc.).
                </Text>
              )}
            </>
          )}
        </ScrollView>
      )}

      {phase === 'importing' && (
        <View style={styles.centerBody}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.progressLabel}>MATCHING CARDS</Text>
          <Text style={styles.progressCount}>
            {progress.done} / {progress.total}
          </Text>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressBarFill,
                {
                  width: `${
                    progress.total === 0 ? 0 : (progress.done / progress.total) * 100
                  }%`,
                },
              ]}
            />
          </View>
        </View>
      )}

      {phase === 'done' && result && (
        <ScrollView contentContainerStyle={styles.bodyContent}>
          <View style={styles.resultCard}>
            <MaterialCommunityIcons
              name="check-circle"
              size={40}
              color={colors.success}
            />
            <Text style={styles.resultTitle}>IMPORT COMPLETE</Text>
            <Text style={styles.resultLine}>
              <Text style={styles.resultNum}>{result.matched}</Text> cards added
            </Text>
            {result.unmatched.length > 0 && (
              <Text style={styles.resultLine}>
                <Text style={[styles.resultNum, { color: colors.danger }]}>
                  {result.unmatched.length}
                </Text>{' '}
                couldn't be matched
              </Text>
            )}
          </View>

          {result.unmatched.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>UNMATCHED ROWS</Text>
              <View style={styles.previewBox}>
                <FlatList
                  data={result.unmatched.slice(0, 50)}
                  scrollEnabled={false}
                  keyExtractor={(_, idx) => String(idx)}
                  renderItem={({ item, index }) => (
                    <View style={styles.previewRow}>
                      <Text style={styles.previewIndex}>{index + 1}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.previewName} numberOfLines={1}>
                          {columns?.name ? item.row[columns.name] : '?'}
                        </Text>
                        <Text style={[styles.previewMeta, { color: colors.danger }]}>
                          {item.reason}
                        </Text>
                      </View>
                    </View>
                  )}
                />
              </View>
            </>
          )}

          <View style={styles.doneButtonRow}>
            <Pressable style={styles.secondaryButton} onPress={reset}>
              <Text style={styles.secondaryButtonText}>IMPORT MORE</Text>
            </Pressable>
            <Pressable style={styles.primaryButton} onPress={onClose}>
              <Text style={styles.primaryButtonText}>DONE</Text>
            </Pressable>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

function DetectedRow({
  label,
  value,
  required,
}: {
  label: string;
  value: string | null;
  required?: boolean;
}) {
  const found = !!value;
  return (
    <View style={styles.detectedRow}>
      <Text style={styles.detectedLabel}>{label}</Text>
      <View style={styles.detectedValueWrap}>
        <MaterialCommunityIcons
          name={found ? 'check-circle' : required ? 'alert-circle' : 'minus-circle-outline'}
          size={14}
          color={found ? colors.success : required ? colors.danger : colors.textDim}
        />
        <Text
          style={[
            styles.detectedValue,
            !found && { color: required ? colors.danger : colors.textDim },
          ]}
        >
          {value ?? '—'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: 1.5,
  },
  closeButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bodyContent: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  centerBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  helperText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  helperEmphasis: {
    color: colors.accent,
    fontWeight: '700',
  },
  tipBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: spacing.md,
    backgroundColor: 'rgba(34, 211, 238, 0.08)',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(34, 211, 238, 0.25)',
  },
  tipText: {
    flex: 1,
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  tipLabel: {
    color: colors.cyan,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  tipMono: {
    color: colors.text,
    fontFamily: fontFamily.mono,
    fontSize: 11,
  },
  sourceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.35)',
    marginTop: spacing.sm,
  },
  sourceBadgeText: {
    color: colors.success,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  fileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderStyle: 'dashed',
  },
  fileButtonText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  orText: {
    textAlign: 'center',
    fontSize: 10,
    color: colors.textDim,
    letterSpacing: 1.4,
    fontWeight: '700',
    marginVertical: spacing.xs,
  },
  textArea: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    padding: spacing.md,
    fontFamily: fontFamily.mono,
    fontSize: 12,
    minHeight: 140,
    textAlignVertical: 'top',
    outlineStyle: 'none' as any,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 1.4,
    marginTop: spacing.sm,
  },
  detectedBox: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  detectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  detectedLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 1.2,
  },
  detectedValueWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detectedValue: {
    fontSize: 12,
    color: colors.text,
    fontFamily: fontFamily.mono,
  },

  previewBox: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  previewIndex: {
    width: 22,
    color: colors.textDim,
    fontSize: 11,
    fontFamily: fontFamily.mono,
  },
  previewName: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  previewMeta: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },

  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    marginTop: spacing.sm,
  },
  primaryButtonDisabled: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  primaryButtonText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  secondaryButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryButtonText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.2,
  },

  warningText: {
    color: colors.danger,
    fontSize: 12,
    marginTop: spacing.sm,
  },

  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
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

  progressLabel: {
    fontSize: 11,
    color: colors.textMuted,
    letterSpacing: 1.4,
    fontWeight: '700',
    marginTop: spacing.lg,
  },
  progressCount: {
    fontSize: 28,
    color: colors.text,
    fontFamily: fontFamily.mono,
    fontWeight: '800',
  },
  progressBar: {
    width: '80%',
    height: 6,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.primary,
  },

  resultCard: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  resultTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: 1.4,
    marginTop: 8,
  },
  resultLine: {
    fontSize: 13,
    color: colors.textMuted,
  },
  resultNum: {
    color: colors.text,
    fontFamily: fontFamily.mono,
    fontWeight: '800',
  },
  doneButtonRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
  },
});
