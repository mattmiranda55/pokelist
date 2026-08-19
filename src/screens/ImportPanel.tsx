import { useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  FileText,
  Import,
  Info,
  MinusCircle,
  RefreshCw,
  Upload,
  X,
  XCircle,
} from 'lucide-react';
import {
  detectColumns,
  extractVariantFromName,
  parseCsv,
  stripVariant,
  type ColumnMap,
  type ParsedCsv,
} from '../import/csv';
import { findCardForImport } from '../api/pokemonTcg';
import { addCardWithVariants } from '../db/database';

/** 'no_match' means the API had no such card; 'fetch_error' means the lookup itself failed. */
type FailureKind = 'no_match' | 'fetch_error';

interface ImportFailure {
  row: Record<string, string>;
  reason: string;
  kind: FailureKind;
}

interface ImportResult {
  matched: number;
  unmatched: ImportFailure[];
  cancelled: boolean;
}

type Phase = 'input' | 'importing' | 'done';

export default function ImportPanel({ onClose }: { onClose: () => void }) {
  const [text, setText] = useState('');
  const [phase, setPhase] = useState<Phase>('input');
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [result, setResult] = useState<ImportResult | null>(null);
  const cancelRef = useRef(false);

  const parsed: ParsedCsv | null = useMemo(() => {
    if (!text.trim()) return null;
    try {
      return parseCsv(text);
    } catch {
      return null;
    }
  }, [text]);

  const columns: ColumnMap | null = useMemo(
    () => (parsed ? detectColumns(parsed.headers) : null),
    [parsed]
  );

  const canImport = !!(parsed && columns?.name && parsed.rows.length > 0);
  const noMatchCount = result?.unmatched.filter((u) => u.kind === 'no_match').length ?? 0;
  const fetchErrorCount = result?.unmatched.filter((u) => u.kind === 'fetch_error').length ?? 0;

  async function handlePickFile(file: File) {
    setError(null);
    try {
      setText(await file.text());
    } catch (e) {
      setError(`Could not read file: ${String(e)}`);
    }
  }

  async function runImport(rows: Record<string, string>[], baseMatched = 0) {
    if (!columns?.name) return;
    cancelRef.current = false;
    setError(null);
    setPhase('importing');
    setProgress({ done: 0, total: rows.length });

    const unmatched: ImportFailure[] = [];
    let matched = baseMatched;

    for (let i = 0; i < rows.length; i++) {
      if (cancelRef.current) break;
      const row = rows[i];
      const rawName = row[columns.name];
      const name = rawName ? stripVariant(rawName) : '';
      if (!name) {
        unmatched.push({ row, reason: 'Missing name', kind: 'no_match' });
      } else {
        try {
          const card = await findCardForImport({
            name,
            set: columns.set ? row[columns.set] || undefined : undefined,
            number: columns.number ? row[columns.number] || undefined : undefined,
          });
          if (card) {
            const qtyRaw = columns.quantity ? row[columns.quantity] : '';
            const parsedQty = parseInt(qtyRaw, 10);
            const quantity = Number.isFinite(parsedQty) && parsedQty > 0 ? parsedQty : 1;
            await addCardWithVariants(
              {
                pokemon_tcg_id: card.id,
                name: card.name,
                set_name: card.set.name,
                series: card.set.series,
                image_url: card.images.small,
                rarity: card.rarity ?? null,
                card_number: card.number,
              },
              [{ variantType: extractVariantFromName(rawName), quantity }],
              // Idempotent: re-running the same CSV converges instead of doubling quantities.
              'set'
            );
            matched++;
          } else {
            unmatched.push({ row, reason: 'No card matched', kind: 'no_match' });
          }
        } catch (e) {
          unmatched.push({ row, reason: String(e), kind: 'fetch_error' });
        }
      }
      setProgress({ done: i + 1, total: rows.length });
    }

    setResult({ matched, unmatched, cancelled: cancelRef.current });
    setPhase('done');
  }

  function reset() {
    setText('');
    setPhase('input');
    setError(null);
    setResult(null);
    setProgress({ done: 0, total: 0 });
    cancelRef.current = false;
  }

  return (
    <div className="backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <span className="sheet-head-title">
            <Upload size={20} color="var(--primary)" />
            IMPORT COLLECTION
          </span>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="banner banner-error">
            <AlertTriangle size={14} />
            <span>{error}</span>
          </div>
        )}

        {phase === 'input' && (
          <div className="sheet-body">
            <p className="help">
              Paste a CSV from Collectr, Dragon Shield, or any app with a <b>name</b> column.
              Each row is matched to a Pokémon TCG card by name, set, and number.
            </p>

            <div className="tip">
              <Info size={14} color="var(--cyan)" style={{ flex: '0 0 auto' }} />
              <span>
                <b>TCGPlayer: </b>open your collection page, select the table rows, copy, and
                paste below — we auto-detect the format (no headers needed) and strip variant
                labels like <span className="mono">[Holofoil]</span> before matching.
              </span>
            </div>

            <label className="file-btn">
              <FileText size={18} />
              CHOOSE CSV FILE
              <input
                type="file"
                accept=".csv,.txt,.tsv,text/csv,text/plain"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handlePickFile(f);
                }}
              />
            </label>

            <div className="or">OR PASTE BELOW</div>

            <textarea
              className="csv"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={'Name,Set,Card Number,Quantity\nCharizard ex,Obsidian Flames,125,1\n…'}
              spellCheck={false}
            />

            {parsed && parsed.rows.length > 0 && columns && (
              <>
                {parsed.source === 'tcgplayer-paste' && (
                  <div className="tip">
                    <CheckCircle size={12} color="var(--success)" />
                    TCGPLAYER FORMAT DETECTED
                  </div>
                )}

                <span className="label">DETECTED COLUMNS</span>
                <div className="detected">
                  <DetectedRow label="NAME" value={columns.name} required />
                  <DetectedRow label="SET" value={columns.set} />
                  <DetectedRow label="NUMBER" value={columns.number} />
                  <DetectedRow label="QUANTITY" value={columns.quantity} />
                </div>

                <span className="label">PREVIEW ({parsed.rows.length} rows total)</span>
                <div className="preview-box">
                  {parsed.rows.slice(0, 5).map((row, i) => (
                    <div className="preview-row" key={i}>
                      <span className="preview-idx">{i + 1}</span>
                      <span>
                        <div className="preview-name">
                          {columns.name ? row[columns.name] : '?'}
                        </div>
                        <div className="preview-meta">
                          {[
                            columns.set ? row[columns.set] : null,
                            columns.number ? `#${row[columns.number]}` : null,
                          ]
                            .filter(Boolean)
                            .join(' · ') || '—'}
                        </div>
                      </span>
                    </div>
                  ))}
                </div>

                <button
                  className="btn-primary"
                  onClick={() => runImport(parsed.rows)}
                  disabled={!canImport}
                >
                  <Import size={16} />
                  IMPORT {parsed.rows.length} CARDS
                </button>

                {!columns.name && (
                  <p style={{ color: 'var(--danger)', fontSize: 12 }}>
                    Couldn't find a "name" column. Make sure your CSV has a header row with a
                    recognized name column (Name, Card Name, etc.).
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {phase === 'importing' && (
          <div className="progress-wrap">
            <div className="spinner" />
            <span className="label">MATCHING CARDS</span>
            <span className="progress-count">
              {progress.done} / {progress.total}
            </span>
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{
                  width: `${progress.total === 0 ? 0 : (progress.done / progress.total) * 100}%`,
                }}
              />
            </div>
            <button
              className="btn-secondary"
              onClick={() => {
                cancelRef.current = true;
              }}
            >
              <XCircle size={14} />
              CANCEL
            </button>
          </div>
        )}

        {phase === 'done' && result && (
          <div className="sheet-body">
            <div className="result-card">
              {result.cancelled ? (
                <AlertCircle size={40} color="var(--accent)" />
              ) : (
                <CheckCircle size={40} color="var(--success)" />
              )}
              <h3>{result.cancelled ? 'IMPORT CANCELLED' : 'IMPORT COMPLETE'}</h3>
              <div>
                <span className="n">{result.matched}</span> cards added
              </div>
              {noMatchCount > 0 && (
                <div>
                  <span className="n" style={{ color: 'var(--text-muted)' }}>
                    {noMatchCount}
                  </span>{' '}
                  not found in the card database
                </div>
              )}
              {fetchErrorCount > 0 && (
                <div>
                  <span className="n" style={{ color: 'var(--danger)' }}>
                    {fetchErrorCount}
                  </span>{' '}
                  failed to look up — retryable
                </div>
              )}
            </div>

            {fetchErrorCount > 0 && (
              <button
                className="btn-secondary"
                onClick={() =>
                  runImport(
                    result.unmatched.filter((u) => u.kind === 'fetch_error').map((u) => u.row),
                    result.matched
                  )
                }
              >
                <RefreshCw size={16} />
                RETRY {fetchErrorCount} FAILED {fetchErrorCount === 1 ? 'ROW' : 'ROWS'}
              </button>
            )}

            {result.unmatched.length > 0 && (
              <>
                <span className="label">UNMATCHED ROWS</span>
                <div className="preview-box">
                  {result.unmatched.slice(0, 50).map((item, i) => (
                    <div className="preview-row" key={i}>
                      <span className="preview-idx">{i + 1}</span>
                      <span>
                        <div className="preview-name">
                          {columns?.name ? item.row[columns.name] : '?'}
                        </div>
                        <div
                          className="preview-meta"
                          style={{
                            color:
                              item.kind === 'fetch_error'
                                ? 'var(--danger)'
                                : 'var(--text-muted)',
                          }}
                        >
                          {item.kind === 'fetch_error' ? 'LOOKUP FAILED · ' : ''}
                          {item.reason}
                        </div>
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}

            <div className="sheet-foot" style={{ border: 'none', padding: 0 }}>
              <button className="btn-secondary" onClick={reset}>
                IMPORT MORE
              </button>
              <button className="btn-primary" onClick={onClose}>
                DONE
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
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
  const color = found ? 'var(--success)' : required ? 'var(--danger)' : 'var(--text-dim)';
  const Icon = found ? CheckCircle : required ? AlertCircle : MinusCircle;
  return (
    <div className="detected-row">
      {label}
      <span className="v" style={{ color: found ? undefined : color }}>
        <Icon size={14} color={color} />
        {value ?? '—'}
      </span>
    </div>
  );
}
