import { API_BASE } from '../api/client';

export interface ExportResult {
  filename: string;
  rowCount: number;
}

function filenameFromDisposition(header: string | null): string | null {
  const match = header?.match(/filename="([^"]+)"/);
  return match ? match[1] : null;
}

export async function exportCollectionToCsv(): Promise<ExportResult> {
  const res = await fetch(`${API_BASE}/export.csv`);
  if (!res.ok) {
    throw new Error(`Export failed: ${res.status} ${res.statusText}`);
  }

  const csv = await res.text();
  const filename =
    filenameFromDisposition(res.headers.get('Content-Disposition')) ??
    `pokelist-${new Date().toISOString().slice(0, 10)}.csv`;

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  const lines = csv.trim().split('\n');
  return { filename, rowCount: Math.max(0, lines.length - 1) };
}
