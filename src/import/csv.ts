export interface ParsedCsv {
  headers: string[];
  rows: Record<string, string>[];
  source: 'csv' | 'tcgplayer-paste';
}

const PRICE_RE = /^\$[\d,]+\.\d{2}$/;
const VARIANT_RE = /\s+-\s+\[[^\]]+\]\s*$/;

export function stripVariant(name: string): string {
  return name.replace(VARIANT_RE, '').trim();
}

export function parseCsv(text: string): ParsedCsv {
  const cleaned = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n').trim();
  if (!cleaned) return { headers: [], rows: [], source: 'csv' };

  const delimiter = detectDelimiter(cleaned);
  const records = tokenize(cleaned, delimiter);
  if (records.length === 0) return { headers: [], rows: [], source: 'csv' };

  const firstHasPrice = records[0].some((c) => PRICE_RE.test(c.trim()));

  if (firstHasPrice) {
    const headers = synthesizeTcgPlayerHeaders(records[0]);
    const rows = recordsToRows(records, headers);
    return { headers, rows, source: 'tcgplayer-paste' };
  }

  const [headerRow, ...dataRows] = records;
  const headers = headerRow.map((h) => h.trim());
  const rows = recordsToRows(dataRows, headers);
  return { headers, rows, source: 'csv' };
}

function tokenize(text: string, delimiter: string): string[][] {
  const records: string[][] = [];
  let current: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      current.push(field);
      field = '';
    } else if (ch === '\n') {
      current.push(field);
      records.push(current);
      current = [];
      field = '';
    } else {
      field += ch;
    }
  }
  current.push(field);
  records.push(current);
  return records.filter((r) => r.some((c) => c.trim() !== ''));
}

function recordsToRows(records: string[][], headers: string[]): Record<string, string>[] {
  return records.map((r) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h] = (r[i] ?? '').trim();
    });
    return obj;
  });
}

function synthesizeTcgPlayerHeaders(sampleRow: string[]): string[] {
  // TCGPlayer collection page rows render as:
  //   [Name - [Variant], Game, Set, Quantity, Low, Mid, High]
  // But layouts have shifted over the years — derive from content where possible.
  const headers: string[] = [];
  let priceLabelIdx = 0;
  const priceLabels = ['Low Price', 'Mid Price', 'High Price', 'Market Price'];
  for (let i = 0; i < sampleRow.length; i++) {
    const cell = sampleRow[i].trim();
    if (PRICE_RE.test(cell)) {
      headers.push(priceLabels[priceLabelIdx] ?? `Price ${priceLabelIdx + 1}`);
      priceLabelIdx++;
    } else if (/^\d+$/.test(cell)) {
      headers.push('Quantity');
    } else if (VARIANT_RE.test(cell)) {
      headers.push('Card Name');
    } else if (/^(pokemon|magic|yu-?gi-?oh|lorcana)$/i.test(cell)) {
      headers.push('Game');
    } else if (headers.indexOf('Card Name') < 0) {
      headers.push('Card Name');
    } else if (headers.indexOf('Set') < 0) {
      headers.push('Set');
    } else {
      headers.push(`Column ${i + 1}`);
    }
  }
  return headers;
}

function detectDelimiter(text: string): string {
  const firstLine = text.split('\n', 1)[0];
  const counts = {
    ',': (firstLine.match(/,/g) ?? []).length,
    '\t': (firstLine.match(/\t/g) ?? []).length,
    ';': (firstLine.match(/;/g) ?? []).length,
  };
  let best = ',';
  let bestCount = counts[','];
  for (const [d, c] of Object.entries(counts)) {
    if (c > bestCount) {
      best = d;
      bestCount = c;
    }
  }
  return best;
}

export interface ColumnMap {
  name: string | null;
  set: string | null;
  number: string | null;
  quantity: string | null;
}

const COLUMN_ALIASES: Record<keyof ColumnMap, string[]> = {
  name: ['card name', 'cardname', 'name', 'card', 'product name'],
  set: ['set name', 'setname', 'set', 'expansion', 'edition'],
  number: ['card number', 'cardnumber', 'number', 'no.', 'no', '#', 'collector number'],
  quantity: ['quantity', 'qty', 'count', 'owned', 'total quantity'],
};

export function detectColumns(headers: string[]): ColumnMap {
  const lower = headers.map((h) => h.toLowerCase().trim());
  const map: ColumnMap = { name: null, set: null, number: null, quantity: null };
  for (const key of Object.keys(COLUMN_ALIASES) as (keyof ColumnMap)[]) {
    for (const alias of COLUMN_ALIASES[key]) {
      const idx = lower.indexOf(alias);
      if (idx >= 0) {
        map[key] = headers[idx];
        break;
      }
    }
  }
  return map;
}
