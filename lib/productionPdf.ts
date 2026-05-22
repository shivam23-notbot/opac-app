import { Platform } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { bagsToKg } from '@/lib/units';
import type { Product } from '@/types';
import { escapeHtml, generatedOnString, wrapDocument } from './pdfUtils';

export type ProductionEntry = {
  date: string;
  productCode: string;
  productName: string;
  openingBags: number;
  closingBags: number;
  delta: number;
  deltaKg: number;
  recordedBy: string;
};

export type DayGroup = {
  date: string;
  totalDeltaBags: number;
  totalDeltaKg: number;
  entries: ProductionEntry[];
};

export function buildProductionDayGroups(
  products: Product[],
  monthKey: string,
  displayNameFor: (id: string) => string
): DayGroup[] {
  const entries: ProductionEntry[] = products.flatMap((p) =>
    p.stockHistory
      .filter((h) => h.date.startsWith(monthKey))
      .map((h) => ({
        date: h.date,
        productCode: p.code,
        productName: p.name,
        openingBags: h.openingBags,
        closingBags: h.closingBags,
        delta: h.closingBags - h.openingBags,
        deltaKg: bagsToKg(h.closingBags - h.openingBags),
        recordedBy: h.recordedBy ? displayNameFor(h.recordedBy) : '—',
      }))
  );

  const byDate = new Map<string, ProductionEntry[]>();
  for (const e of entries) {
    const bucket = byDate.get(e.date);
    if (bucket) bucket.push(e);
    else byDate.set(e.date, [e]);
  }

  return [...byDate.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, dayEntries]) => ({
      date,
      totalDeltaBags: dayEntries.reduce((s, e) => s + e.delta, 0),
      totalDeltaKg: dayEntries.reduce((s, e) => s + e.deltaKg, 0),
      entries: dayEntries,
    }));
}

export function buildProductionMonthlyHTML(
  label: string,
  dayGroups: DayGroup[],
  generatedOn: string
): string {
  const grandTotalBags = dayGroups.reduce((s, d) => s + d.totalDeltaBags, 0);
  const grandTotalKg = dayGroups.reduce((s, d) => s + d.totalDeltaKg, 0);
  const activeDays = dayGroups.filter((d) => d.totalDeltaBags > 0).length;

  const tableRows = dayGroups
    .map(
      (day) => `
    <tr class="day-header">
      <td><strong>${escapeHtml(day.date)}</strong></td>
      <td class="muted">${day.entries.length} product${day.entries.length !== 1 ? 's' : ''}</td>
      <td class="num accent"><strong>+${day.totalDeltaBags}</strong></td>
      <td class="num muted">—</td>
      <td class="num muted">—</td>
      <td class="num muted">${day.totalDeltaKg}</td>
      <td></td>
    </tr>
    ${day.entries
      .map(
        (e) => `
      <tr class="product-row">
        <td class="muted small indent">└</td>
        <td><span class="code">${escapeHtml(e.productCode)}</span> <span class="muted small">${escapeHtml(e.productName)}</span></td>
        <td class="num accent">${e.delta >= 0 ? '+' : ''}${e.delta}</td>
        <td class="num muted">${e.openingBags}</td>
        <td class="num muted">${e.closingBags}</td>
        <td class="num muted small">${e.deltaKg}</td>
        <td class="muted small">${escapeHtml(e.recordedBy)}</td>
      </tr>`
      )
      .join('')}`
    )
    .join('');

  const emptyMessage =
    dayGroups.length === 0
      ? `<tr><td colspan="7" class="center muted" style="padding:16px">No production records for this month.</td></tr>`
      : '';

  return `
  <section class="page">
    <header>
      <div class="brand">
        <div class="brand-mark">O</div>
        <div>
          <div class="brand-name">Opac Polymers</div>
          <div class="brand-sub">Monthly Production Report</div>
        </div>
      </div>
      <div class="meta">
        <div><strong>Month:</strong> ${escapeHtml(label)}</div>
        <div><strong>Generated:</strong> ${escapeHtml(generatedOn)}</div>
      </div>
    </header>

    <div class="summary-cards">
      <div class="card">
        <div class="card-label">Total Produced</div>
        <div class="card-value">${grandTotalBags} bags</div>
        <div class="card-sub">${grandTotalKg.toLocaleString('en-IN')} kg</div>
      </div>
      <div class="card">
        <div class="card-label">Active Days</div>
        <div class="card-value">${activeDays}</div>
        <div class="card-sub">production days</div>
      </div>
      <div class="card">
        <div class="card-label">Avg / Day</div>
        <div class="card-value">${activeDays > 0 ? (grandTotalBags / activeDays).toFixed(1) : '—'} bags</div>
        <div class="card-sub">on active days</div>
      </div>
    </div>

    <h2>Daily Production Detail</h2>
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Product</th>
          <th class="num">Δ Bags</th>
          <th class="num">Open</th>
          <th class="num">Close</th>
          <th class="num">Δ KG</th>
          <th>By</th>
        </tr>
      </thead>
      <tbody>
        ${emptyMessage}
        ${tableRows}
      </tbody>
      <tfoot>
        <tr>
          <td colspan="2" class="right"><strong>Monthly Total</strong></td>
          <td class="num accent"><strong>+${grandTotalBags}</strong></td>
          <td></td>
          <td></td>
          <td class="num"><strong>${grandTotalKg}</strong></td>
          <td></td>
        </tr>
      </tfoot>
    </table>

    <footer>
      <span>Opac Polymers · Devda, Rajkot</span>
      <span>Production Report · ${escapeHtml(label)}</span>
    </footer>
  </section>
  `;
}

const STYLE = `
  <style>
    @page { size: A4; margin: 12mm 12mm 12mm 12mm; }
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, sans-serif;
      color: #1f1e1c;
      font-size: 10px;
      margin: 0;
      padding: 0;
    }
    .page { page-break-after: always; padding: 0; }
    .page:last-of-type { page-break-after: auto; }

    header {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      padding-bottom: 8px;
      border-bottom: 2px solid #1f1e1c;
      margin-bottom: 12px;
    }
    .brand { display: flex; align-items: center; gap: 8px; }
    .brand-mark {
      width: 30px; height: 30px;
      background: #D97757; color: #fff;
      border-radius: 6px;
      display: flex; align-items: center; justify-content: center;
      font-size: 20px; font-weight: 700;
      font-family: Georgia, serif;
    }
    .brand-name { font-family: Georgia, serif; font-size: 16px; font-weight: 700; letter-spacing: -0.4px; }
    .brand-sub { font-size: 9px; color: #5e5b54; letter-spacing: 1px; text-transform: uppercase; }
    .meta { text-align: right; font-size: 9px; color: #5e5b54; line-height: 1.5; }
    .meta strong { color: #1f1e1c; }

    .summary-cards {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      margin-bottom: 14px;
    }
    .card {
      background: #f4f2ea;
      border: 1px solid #e8e4d6;
      border-radius: 6px;
      padding: 8px 10px;
    }
    .card-label { font-size: 8px; color: #8e8b82; letter-spacing: 1.5px; text-transform: uppercase; }
    .card-value { font-size: 16px; font-weight: 700; color: #D97757; margin-top: 2px; }
    .card-sub { font-size: 8px; color: #8e8b82; margin-top: 1px; }

    h2 {
      font-size: 9px; letter-spacing: 1.5px; text-transform: uppercase;
      color: #8e8b82; margin: 8px 0 4px 0; font-weight: 700;
    }

    table { width: 100%; border-collapse: collapse; font-size: 9px; }
    table th {
      text-align: left; padding: 4px 5px;
      background: #f4f2ea; border-bottom: 1px solid #d4cdb8;
      font-size: 8px; letter-spacing: 0.8px; text-transform: uppercase; color: #5e5b54;
    }
    table td { padding: 3px 5px; border-bottom: 1px solid #f0ecdf; line-height: 1.3; vertical-align: middle; }
    table tfoot td {
      background: #f4f2ea; border-top: 2px solid #1f1e1c;
      border-bottom: none; padding: 5px 5px;
    }

    .day-header td {
      background: #faf9f5;
      border-bottom: 1px solid #d4cdb8;
      border-top: 1px solid #d4cdb8;
      padding-top: 5px;
      padding-bottom: 5px;
    }
    .product-row td { background: #ffffff; }
    .indent { padding-left: 10px; }

    .num { text-align: right; font-variant-numeric: tabular-nums; }
    .right { text-align: right; }
    .center { text-align: center; }
    .muted { color: #8e8b82; }
    .small { font-size: 8px; }
    .accent { color: #D97757; }
    .code { font-family: ui-monospace, 'Courier New', monospace; font-weight: 700; }

    footer {
      display: flex; justify-content: space-between;
      margin-top: 10px; padding-top: 6px;
      border-top: 1px solid #e8e4d6;
      font-size: 8px; color: #8e8b82; letter-spacing: 0.5px;
    }
  </style>
`;

export async function generateProductionMonthlyPDF(
  products: Product[],
  monthKey: string,
  label: string,
  displayNameFor: (id: string) => string
): Promise<void> {
  const dayGroups = buildProductionDayGroups(products, monthKey, displayNameFor);
  const generatedOn = generatedOnString();
  const html = wrapDocument(STYLE, buildProductionMonthlyHTML(label, dayGroups, generatedOn));
  const filename = `opac-production-${monthKey}`;

  if (Platform.OS === 'web') {
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    if (win) {
      win.addEventListener('load', () => {
        win.print();
        URL.revokeObjectURL(url);
      });
    } else {
      URL.revokeObjectURL(url);
    }
    return;
  }

  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      UTI: 'com.adobe.pdf',
      dialogTitle: filename,
    });
  }
}
