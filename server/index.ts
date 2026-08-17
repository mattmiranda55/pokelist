import { Hono } from 'hono';
import { serveStatic } from 'hono/bun';
import {
  addCardWithVariants,
  addVariantToCard,
  getCollection,
  getCollectionTcgIds,
  getExportRows,
  getPriceHistory,
  removeCard,
  removeVariant,
  setVariantQuantity,
  type AddCardInput,
  type ExportRow,
  type QuantityMode,
  type VariantSelection,
} from './db';
import {
  findCardForImport,
  getCardById,
  getCardsInSet,
  searchCardsByName,
  searchSets,
} from './tcg';
import { refreshPrices, startPriceRefreshSchedule } from './priceRefresh';

const PORT = Number(process.env.PORT ?? 3000);

const app = new Hono();

function intParam(raw: string | undefined, label: string): number {
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) throw new Error(`Invalid ${label}: ${raw}`);
  return n;
}

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: err.message }, 500);
});

app.get('/api/health', (c) => c.json({ ok: true }));

app.get('/api/collection', (c) => c.json(getCollection()));

app.get('/api/collection/ids', (c) => c.json(getCollectionTcgIds()));

app.post('/api/cards', async (c) => {
  const body = (await c.req.json()) as {
    input: AddCardInput;
    variants: VariantSelection[];
    mode?: QuantityMode;
  };
  const id = addCardWithVariants(body.input, body.variants, body.mode ?? 'add');
  return c.json({ id });
});

app.delete('/api/cards/:id', (c) => {
  removeCard(intParam(c.req.param('id'), 'card id'));
  return c.json({ ok: true });
});

app.post('/api/cards/:id/variants', async (c) => {
  const body = (await c.req.json()) as { variantType: string; quantity: number };
  addVariantToCard(
    intParam(c.req.param('id'), 'card id'),
    body.variantType,
    body.quantity
  );
  return c.json({ ok: true });
});

app.patch('/api/variants/:id', async (c) => {
  const body = (await c.req.json()) as { quantity: number };
  if (!Number.isInteger(body.quantity) || body.quantity <= 0) {
    return c.json({ error: `Invalid quantity: ${body.quantity}` }, 400);
  }
  setVariantQuantity(intParam(c.req.param('id'), 'variant id'), body.quantity);
  return c.json({ ok: true });
});

app.delete('/api/variants/:id', (c) => {
  removeVariant(intParam(c.req.param('id'), 'variant id'));
  return c.json({ ok: true });
});

function escapeCell(value: string): string {
  if (/[,"\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

const VARIANT_LABELS: Record<string, string> = {
  normal: 'Normal',
  holofoil: 'Holofoil',
  reverseHolofoil: 'Reverse Holofoil',
  '1stEditionHolofoil': '1st Ed Holofoil',
  unlimitedHolofoil: 'Unlimited Holofoil',
  '1stEdition': '1st Edition',
};

function rowsToCsv(rows: ExportRow[]): string {
  const headers = [
    'Name',
    'Set',
    'Series',
    'Card Number',
    'Rarity',
    'Variant',
    'Quantity',
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
        escapeCell(VARIANT_LABELS[r.variant_type] ?? r.variant_type),
        String(r.quantity),
        r.price_usd != null ? r.price_usd.toFixed(2) : '',
        escapeCell(r.pokemon_tcg_id),
        escapeCell(r.added_at),
      ].join(',')
    );
  }
  return lines.join('\n');
}

app.get('/api/export.csv', (c) => {
  const csv = rowsToCsv(getExportRows());
  const filename = `pokelist-${new Date().toISOString().slice(0, 10)}.csv`;
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv;charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
});

app.get('/api/price-history', (c) => {
  const range = c.req.query('range') ?? '7D';
  return c.json(getPriceHistory(range));
});

// Manual trigger; the schedule also runs this daily.
app.post('/api/price-refresh', async (c) => c.json(await refreshPrices()));

app.get('/api/tcg/cards', async (c) => {
  const name = c.req.query('name');
  if (!name) return c.json({ error: 'name is required' }, 400);
  return c.json(await searchCardsByName(name));
});

app.get('/api/tcg/sets', async (c) => {
  const q = c.req.query('q');
  if (!q) return c.json({ error: 'q is required' }, 400);
  return c.json(await searchSets(q));
});

app.get('/api/tcg/sets/:id/cards', async (c) =>
  c.json(await getCardsInSet(c.req.param('id')))
);

app.get('/api/tcg/card/:id', async (c) => c.json(await getCardById(c.req.param('id'))));

app.get('/api/tcg/match', async (c) => {
  const name = c.req.query('name');
  if (!name) return c.json({ error: 'name is required' }, 400);
  const card = await findCardForImport({
    name,
    set: c.req.query('set') || undefined,
    number: c.req.query('number') || undefined,
  });
  return c.json(card);
});

// In dev, Vite serves the frontend and proxies /api here. In production it has already built
// to dist/, so we just hand those files out.
if (process.env.NODE_ENV === 'production') {
  app.use('/*', serveStatic({ root: './dist' }));
  app.get('*', serveStatic({ path: './dist/index.html' }));
}

if (process.env.DISABLE_PRICE_REFRESH !== '1') {
  startPriceRefreshSchedule();
}

console.log(`pokelist api on http://localhost:${PORT}`);

export default {
  port: PORT,
  hostname: '0.0.0.0',
  fetch: app.fetch,
};
