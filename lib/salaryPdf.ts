import { Platform } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import type { Worker, AttendanceRecord, AdvancePayment } from '@/types';
import {
  computeMonthlySalary,
  computeCarryInBreakdown,
  type MonthlySalary,
  type CarryInLine,
} from './salary';
import { escapeHtml, generatedOnString, wrapDocument } from './pdfUtils';

function formatRupee(amount: number): string {
  const sign = amount < 0 ? '−' : '';
  return `${sign}₹${Math.abs(amount).toFixed(0)}`;
}

function formatRupeeSigned(amount: number): string {
  if (amount === 0) return '₹0';
  const sign = amount > 0 ? '+' : '−';
  return `${sign}₹${Math.abs(amount).toFixed(0)}`;
}

function formatDateShort(dateISO: string): string {
  const [, m, d] = dateISO.split('-');
  return `${d}/${m}`;
}

export function buildMonthlySalaryHTML(
  worker: Worker,
  salary: MonthlySalary,
  breakdown: { seed: number; lines: CarryInLine[]; opening: number },
  generatedOn: string
): string {
  const carryoverNote =
    salary.openingBalance === 0
      ? 'No carry-forward from previous months.'
      : salary.openingBalance > 0
        ? 'Unpaid balance carried from prior months (added).'
        : 'Overpaid balance carried from prior months (subtracted).';

  const breakdownRows =
    breakdown.lines.length === 0 && breakdown.seed === 0
      ? `<tr><td colspan="4" class="muted center">No prior-month activity.</td></tr>`
      : [
          breakdown.seed !== 0
            ? `<tr>
                <td>—</td>
                <td>Seed (worker.previousBalance)</td>
                <td class="num">—</td>
                <td class="num">${formatRupeeSigned(breakdown.seed)}</td>
              </tr>`
            : '',
          ...breakdown.lines.map(
            (line) => `
              <tr>
                <td>${escapeHtml(line.monthLabel)}</td>
                <td class="muted small">Gross ₹${line.gross.toFixed(0)} − Adv ₹${line.advance.toFixed(0)}</td>
                <td class="num">${formatRupeeSigned(line.net)}</td>
                <td class="num">${formatRupeeSigned(line.runningBalance)}</td>
              </tr>`
          ),
        ]
          .filter(Boolean)
          .join('');

  // Group advances by date for inline rendering within attendance rows
  const advsByDate = new Map<string, AdvancePayment[]>();
  for (const adv of salary.advances) {
    const dk = adv.date.slice(0, 10);
    const bucket = advsByDate.get(dk);
    if (bucket) bucket.push(adv);
    else advsByDate.set(dk, [adv]);
  }

  const attendanceRows = salary.dailyLines
    .map((line) => {
      const dayAdvances = advsByDate.get(line.date) ?? [];
      const advSubRows = dayAdvances
        .map(
          (a) => `
          <tr class="adv-row">
            <td></td>
            <td colspan="3" class="adv-detail">↳ ${escapeHtml(a.note ?? 'Advance payment')}</td>
            <td class="num adv-detail">${formatRupee(-a.amount)}</td>
          </tr>`
        )
        .join('');
      return `
        <tr>
          <td class="num">${escapeHtml(formatDateShort(line.date))}</td>
          <td>${escapeHtml(line.weekday)}</td>
          <td>${escapeHtml(line.statusLabel)}</td>
          <td>${escapeHtml(line.calc)}</td>
          <td class="num">${line.earned > 0 ? `₹${line.earned.toFixed(0)}` : '—'}</td>
        </tr>${advSubRows}`;
    })
    .join('');

  return `
  <section class="page">
    <header>
      <div class="brand">
        <div class="brand-mark">O</div>
        <div>
          <div class="brand-name">Opac Polymers</div>
          <div class="brand-sub">Worker Salary Statement</div>
        </div>
      </div>
      <div class="meta">
        <div><strong>Month:</strong> ${escapeHtml(salary.monthLabel)}</div>
        <div><strong>Generated:</strong> ${escapeHtml(generatedOn)}</div>
      </div>
    </header>

    <div class="worker-card">
      <div>
        <div class="label">Worker</div>
        <div class="value-lg">${escapeHtml(worker.name)}</div>
      </div>
      <div>
        <div class="label">Worker Since</div>
        <div class="value-lg">${escapeHtml(worker.createdAt)}</div>
      </div>
    </div>

    <div class="body-columns">
      <div class="col-left">
        <h2>Attendance &amp; Earnings</h2>
        <table class="attendance">
          <thead>
            <tr>
              <th class="num">Date</th>
              <th>Day</th>
              <th>Status</th>
              <th>Calculation</th>
              <th class="num">Earned</th>
            </tr>
          </thead>
          <tbody>
            ${attendanceRows}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="4" class="right"><strong>Gross Earned (A)</strong></td>
              <td class="num"><strong>₹${salary.grossEarned.toFixed(0)}</strong></td>
            </tr>
            <tr class="tfoot-adv">
              <td colspan="4" class="right muted">Total Advances (B)</td>
              <td class="num muted">−₹${salary.totalAdvances.toFixed(0)}</td>
            </tr>
          </tfoot>
        </table>
        <div class="counts">
          <span>Present: <strong>${salary.presentDays}</strong></span>
          <span>Partial: <strong>${salary.partialDays}</strong></span>
          <span>Absent: <strong>${salary.absentDays}</strong></span>
          <span class="muted">Unmarked: ${salary.unmarkedDays}</span>
        </div>
      </div>

      <div class="col-right">
        <div class="totals">
          <div class="totals-row">
            <span>Gross Earned (A)</span>
            <span>+₹${salary.grossEarned.toFixed(0)}</span>
          </div>
          <div class="totals-row">
            <span>Advances (B)</span>
            <span>−₹${salary.totalAdvances.toFixed(0)}</span>
          </div>
          <div class="totals-row">
            <span>Prev. Balance (C)</span>
            <span>${formatRupeeSigned(salary.openingBalance)}</span>
          </div>
          <div class="totals-row grand">
            <span>NET PAYABLE</span>
            <span>${formatRupee(salary.closingBalance)}</span>
          </div>
          <div class="net-month">${escapeHtml(salary.monthLabel.toUpperCase())}</div>
          <div class="formula">A − B + C = Net Payable</div>
        </div>

        <h2>Carry-In Chain</h2>
        <table class="breakdown">
          <thead>
            <tr>
              <th>Month</th>
              <th>Detail</th>
              <th class="num">Net</th>
              <th class="num">Running</th>
            </tr>
          </thead>
          <tbody>
            ${breakdownRows}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="3" class="right"><strong>Opening (C)</strong></td>
              <td class="num"><strong>${formatRupeeSigned(salary.openingBalance)}</strong></td>
            </tr>
          </tfoot>
        </table>
        <p class="muted small" style="margin: 4px 0 0 0;">${escapeHtml(carryoverNote)}</p>
      </div>
    </div>

    <footer>
      <span>Opac Polymers · Devda, Rajkot</span>
      <span>${escapeHtml(worker.name)} · ${escapeHtml(salary.monthLabel)}</span>
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
      margin-bottom: 10px;
    }
    .brand { display: flex; align-items: center; gap: 8px; }
    .brand-mark {
      width: 30px; height: 30px;
      background: #D97757; color: #fff;
      border-radius: 6px;
      display: flex; align-items: center; justify-content: center;
      font-size: 20px; font-weight: 700;
      font-family: Georgia, 'Source Serif 4', serif;
    }
    .brand-name {
      font-family: Georgia, 'Source Serif 4', serif;
      font-size: 16px; font-weight: 700; letter-spacing: -0.4px;
    }
    .brand-sub { font-size: 9px; color: #5e5b54; letter-spacing: 1px; text-transform: uppercase; }
    .meta { text-align: right; font-size: 9px; color: #5e5b54; line-height: 1.5; }
    .meta strong { color: #1f1e1c; }

    .worker-card {
      display: grid;
      grid-template-columns: 2fr 1fr;
      gap: 10px;
      background: #f4f2ea;
      border: 1px solid #e8e4d6;
      border-radius: 6px;
      padding: 8px 10px;
      margin-bottom: 10px;
    }
    .label { font-size: 8px; color: #8e8b82; letter-spacing: 1.5px; text-transform: uppercase; }
    .value-lg { font-size: 13px; font-weight: 700; margin-top: 2px; }

    h2 {
      font-size: 9px;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      color: #8e8b82;
      margin: 8px 0 4px 0;
      font-weight: 700;
    }

    .body-columns {
      display: flex;
      gap: 12px;
      align-items: flex-start;
    }
    .col-left { flex: 0 0 59%; min-width: 0; }
    .col-left h2:first-child { margin-top: 0; }
    .col-right { flex: 1; min-width: 0; }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 9px;
    }
    table th {
      text-align: left;
      padding: 4px 5px;
      background: #f4f2ea;
      border-bottom: 1px solid #d4cdb8;
      font-size: 8px;
      letter-spacing: 0.8px;
      text-transform: uppercase;
      color: #5e5b54;
    }
    table td {
      padding: 3px 5px;
      border-bottom: 1px solid #f0ecdf;
      line-height: 1.3;
    }
    table tfoot td {
      background: #f4f2ea;
      border-top: 2px solid #1f1e1c;
      border-bottom: none;
      padding: 5px 5px;
    }
    table tfoot tr.tfoot-adv td {
      border-top: none;
      padding-top: 2px;
      font-size: 8px;
    }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    .right { text-align: right; }
    .center { text-align: center; }
    .muted { color: #8e8b82; }
    .small { font-size: 8px; }

    .adv-row td {
      background: #fef8f0;
      border-bottom: none;
      padding-top: 1px;
      padding-bottom: 2px;
    }
    .adv-detail { color: #b07040; font-size: 8px; }

    .counts {
      display: flex;
      gap: 10px;
      margin-top: 4px;
      font-size: 9px;
      color: #5e5b54;
    }
    .counts strong { color: #1f1e1c; }

    .totals {
      border: 1px solid #1f1e1c;
      border-radius: 6px;
      padding: 10px 12px;
      background: #fff;
    }
    .totals-row {
      display: flex;
      justify-content: space-between;
      padding: 3px 0;
      font-size: 10px;
    }
    .totals-row.grand {
      border-top: 2px solid #1f1e1c;
      margin-top: 6px;
      padding-top: 8px;
      font-size: 14px;
      font-weight: 700;
      color: #D97757;
    }
    .net-month {
      text-align: center;
      font-size: 8px;
      color: #8e8b82;
      letter-spacing: 1px;
      margin-top: 2px;
    }
    .formula {
      margin-top: 4px;
      text-align: right;
      font-size: 8px;
      color: #8e8b82;
      font-style: italic;
    }

    footer {
      display: flex;
      justify-content: space-between;
      margin-top: 10px;
      padding-top: 6px;
      border-top: 1px solid #e8e4d6;
      font-size: 8px;
      color: #8e8b82;
      letter-spacing: 0.5px;
    }
  </style>
`;

function safeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9]+/g, '_');
}

export async function generateWorkerMonthlyPDF(
  worker: Worker,
  monthKey: string,
  records: Record<string, Record<string, AttendanceRecord>>,
  allAdvances: AdvancePayment[]
): Promise<void> {
  const salary = computeMonthlySalary(worker, monthKey, records, allAdvances);
  const breakdown = computeCarryInBreakdown(worker, monthKey, records, allAdvances);
  const generatedOn = generatedOnString();
  const html = wrapDocument(STYLE, buildMonthlySalaryHTML(worker, salary, breakdown, generatedOn));
  const filename = `opac-salary-${safeFilename(worker.name)}-${monthKey}`;

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
