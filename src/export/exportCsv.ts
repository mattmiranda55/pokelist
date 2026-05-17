import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { getDatabase } from '../db/database';

interface ExportRow {
  pokemon_tcg_id: string;
  name: string;
  set_name: string | null;
  series: string | null;
  rarity: string | null;
  card_number: string | null;
  price_usd: number | null;
  added_at: string;
}

function escapeCell(value: string): string {
  if (/[,"\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function rowsToCsv(rows: ExportRow[]): string {
  const headers = [
    'Name',
    'Set',
    'Series',
    'Card Number',
    'Rarity',
    'Price (USD)',
    'TCG ID',
    'Added At',
  ];
  const lines = [headers.join(',')];
  for (const r of rows) {
    lines.push(
      [
        escapeCell(r.name),
        escapeCell(r.set_name ?? ''),
        escapeCell(r.series ?? ''),
        escapeCell(r.card_number ?? ''),
        escapeCell(r.rarity ?? ''),
        r.price_usd != null ? r.price_usd.toFixed(2) : '',
        escapeCell(r.pokemon_tcg_id),
        escapeCell(r.added_at),
      ].join(',')
    );
  }
  return lines.join('\n');
}

export interface ExportResult {
  filename: string;
  cardCount: number;
  destination: 'download' | 'share' | 'unavailable';
}

export async function exportCollectionToCsv(): Promise<ExportResult> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<ExportRow>(`
    SELECT
      c.pokemon_tcg_id,
      c.name,
      c.set_name,
      c.series,
      c.rarity,
      c.card_number,
      c.added_at,
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

  const csv = rowsToCsv(rows);
  const filename = `pokelist-${new Date().toISOString().slice(0, 10)}.csv`;

  if (Platform.OS === 'web') {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return { filename, cardCount: rows.length, destination: 'download' };
  }

  const uri = `${FileSystem.cacheDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(uri, csv);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'text/csv',
      dialogTitle: 'Export Pokémon Collection',
      UTI: 'public.comma-separated-values-text',
    });
    return { filename, cardCount: rows.length, destination: 'share' };
  }
  return { filename, cardCount: rows.length, destination: 'unavailable' };
}
