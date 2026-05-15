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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

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

  const attendanceRows = salary.dailyLines
    .map(
      (line) => `
        <tr>
          <td class="num">${escapeHtml(formatDateShort(line.date))}</td>
          <td>${escapeHtml(line.weekday)}</td>
          <td>${escapeHtml(line.statusLabel)}</td>
          <td>${escapeHtml(line.calc)}</td>
          <td class="num">${line.earned > 0 ? `₹${line.earned.toFixed(0)}` : '—'}</td>
        </tr>`
    )
    .join('');

  const advanceRows =
    salary.advances.length === 0
      ? `<tr><td colspan="3" class="muted center">No advances recorded this month.</td></tr>`
      : salary.advances
          .map(
            (a) => `
        <tr>
          <td class="num">${escapeHtml(formatDateShort(a.date))}</td>
          <td>${escapeHtml(a.note ?? 'Advance payment')}</td>
          <td class="num">−₹${a.amount.toFixed(0)}</td>
        </tr>`
          )
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
        <div class="label">Daily Wage</div>
        <div class="value-lg">₹${worker.dailyWage}</div>
      </div>
      <div>
        <div class="label">Worker Since</div>
        <div class="value-lg">${escapeHtml(worker.createdAt)}</div>
      </div>
    </div>

    <h2>Attendance & Earnings</h2>
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
      </tfoot>
    </table>

    <div class="counts">
      <span>Present: <strong>${salary.presentDays}</strong></span>
      <span>Partial: <strong>${salary.partialDays}</strong></span>
      <span>Absent: <strong>${salary.absentDays}</strong></span>
      <span class="muted">Unmarked: ${salary.unmarkedDays}</span>
    </div>

    <h2>Advance Payments</h2>
    <table class="advances">
      <thead>
        <tr>
          <th class="num">Date</th>
          <th>Note</th>
          <th class="num">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${advanceRows}
      </tbody>
      <tfoot>
        <tr>
          <td colspan="2" class="right"><strong>Total Advances (B)</strong></td>
          <td class="num"><strong>−₹${salary.totalAdvances.toFixed(0)}</strong></td>
        </tr>
      </tfoot>
    </table>

    <h2>Carry-In Chain (months before ${escapeHtml(salary.monthLabel)})</h2>
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
          <td colspan="3" class="right"><strong>Opening balance entering ${escapeHtml(salary.monthLabel)} (C)</strong></td>
          <td class="num"><strong>${formatRupeeSigned(salary.openingBalance)}</strong></td>
        </tr>
      </tfoot>
    </table>
    <p class="muted small" style="margin: 4px 0 12px 0;">${escapeHtml(carryoverNote)}</p>

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
        <span>Previous Balance (C)</span>
        <span>${formatRupeeSigned(salary.openingBalance)}</span>
      </div>
      <div class="totals-row grand">
        <span>NET PAYABLE FOR ${escapeHtml(salary.monthLabel.toUpperCase())}</span>
        <span>${formatRupee(salary.closingBalance)}</span>
      </div>
      <div class="formula">A − B + C = Net Payable</div>
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
    @page { size: A4; margin: 14mm 14mm 14mm 14mm; }
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, sans-serif;
      color: #1f1e1c;
      font-size: 11px;
      margin: 0;
      padding: 0;
    }
    .page { page-break-after: always; padding: 0; }
    .page:last-of-type { page-break-after: auto; }

    header {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      padding-bottom: 10px;
      border-bottom: 2px solid #1f1e1c;
      margin-bottom: 14px;
    }
    .brand { display: flex; align-items: center; gap: 10px; }
    .brand-mark {
      width: 34px; height: 34px;
      background: #D97757; color: #fff;
      border-radius: 8px;
      display: flex; align-items: center; justify-content: center;
      font-size: 22px; font-weight: 700;
      font-family: Georgia, 'Source Serif 4', serif;
    }
    .brand-name {
      font-family: Georgia, 'Source Serif 4', serif;
      font-size: 18px; font-weight: 700; letter-spacing: -0.4px;
    }
    .brand-sub { font-size: 10px; color: #5e5b54; letter-spacing: 1px; text-transform: uppercase; }
    .meta { text-align: right; font-size: 10px; color: #5e5b54; line-height: 1.5; }
    .meta strong { color: #1f1e1c; }

    .worker-card {
      display: grid;
      grid-template-columns: 2fr 1fr 1fr;
      gap: 12px;
      background: #f4f2ea;
      border: 1px solid #e8e4d6;
      border-radius: 8px;
      padding: 10px 12px;
      margin-bottom: 14px;
    }
    .label { font-size: 9px; color: #8e8b82; letter-spacing: 1.5px; text-transform: uppercase; }
    .value-lg { font-size: 14px; font-weight: 700; margin-top: 2px; }

    h2 {
      font-size: 11px;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      color: #8e8b82;
      margin: 12px 0 6px 0;
      font-weight: 700;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10px;
    }
    table th {
      text-align: left;
      padding: 6px 8px;
      background: #f4f2ea;
      border-bottom: 1px solid #d4cdb8;
      font-size: 9px;
      letter-spacing: 0.8px;
      text-transform: uppercase;
      color: #5e5b54;
    }
    table td {
      padding: 5px 8px;
      border-bottom: 1px solid #f0ecdf;
    }
    table tfoot td {
      background: #f4f2ea;
      border-top: 2px solid #1f1e1c;
      border-bottom: none;
      padding: 7px 8px;
    }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    .right { text-align: right; }
    .center { text-align: center; }
    .muted { color: #8e8b82; }
    .small { font-size: 9px; }

    .counts {
      display: flex;
      gap: 14px;
      margin-top: 6px;
      font-size: 10px;
      color: #5e5b54;
    }
    .counts strong { color: #1f1e1c; }

    .summary tbody tr td:first-child { padding-left: 0; }
    .summary tbody tr td:last-child { padding-right: 0; }

    .totals {
      margin-top: 16px;
      border: 1px solid #1f1e1c;
      border-radius: 8px;
      padding: 12px 14px;
      background: #fff;
    }
    .totals-row {
      display: flex;
      justify-content: space-between;
      padding: 4px 0;
      font-size: 11px;
    }
    .totals-row.grand {
      border-top: 2px solid #1f1e1c;
      margin-top: 6px;
      padding-top: 10px;
      font-size: 14px;
      font-weight: 700;
      color: #D97757;
    }
    .formula {
      margin-top: 6px;
      text-align: right;
      font-size: 9px;
      color: #8e8b82;
      font-style: italic;
    }

    footer {
      display: flex;
      justify-content: space-between;
      margin-top: 18px;
      padding-top: 8px;
      border-top: 1px solid #e8e4d6;
      font-size: 9px;
      color: #8e8b82;
      letter-spacing: 0.5px;
    }
  </style>
`;

function wrapDocument(bodyHtml: string): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  ${STYLE}
</head>
<body>
${bodyHtml}
</body>
</html>`;
}

function generatedOnString(): string {
  return new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

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
  const html = wrapDocument(buildMonthlySalaryHTML(worker, salary, breakdown, generatedOn));
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
