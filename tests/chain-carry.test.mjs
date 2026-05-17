// Aggressive chain test: imports the REAL lib/salary.ts (via Node's native TS stripping)
// and verifies multi-month carry-forward + retroactive past-edit ripple.

import { computeMonthlySalary } from './_salary-imported.mts';

let passed = 0, failed = 0;
function assertEq(actual, expected, label) {
  const a = typeof actual === 'number' ? Math.round(actual * 100) / 100 : actual;
  const e = typeof expected === 'number' ? Math.round(expected * 100) / 100 : expected;
  if (a === e) { passed++; console.log(`  ✓ ${label}`); }
  else { failed++; console.log(`  ✗ ${label}\n      expected: ${e}\n      actual:   ${a}`); }
}

const worker = {
  id: 'w1', name: 'Test', dailyWage: 500,
  previousBalance: 0, active: true, createdAt: '2025-01-01',
};

console.log('SCENARIO 1 — 3-month chain (Jan→Feb→Mar with activity)');
{
  const records = {};
  for (let d = 1; d <= 10; d++) {
    records[`2026-01-${String(d).padStart(2, '0')}`] = {
      w1: { status: 'full', employeeId: 'w1', recordedBy: 'u', recordedAt: '' },
    };
  }
  for (let d = 1; d <= 5; d++) {
    records[`2026-02-${String(d).padStart(2, '0')}`] = {
      w1: { status: 'full', employeeId: 'w1', recordedBy: 'u', recordedAt: '' },
    };
  }
  const advances = [
    { id: 'a1', workerId: 'w1', amount: 500,  date: '2026-01-25', recordedBy: 'u' },
    { id: 'a2', workerId: 'w1', amount: 1000, date: '2026-02-20', recordedBy: 'u' },
  ];

  const jan = computeMonthlySalary(worker, '2026-01', records, advances);
  const feb = computeMonthlySalary(worker, '2026-02', records, advances);
  const mar = computeMonthlySalary(worker, '2026-03', records, advances);

  assertEq(jan.openingBalance, 0,    'Jan opening = 0');
  assertEq(jan.grossEarned,    5000, 'Jan gross = 5000');
  assertEq(jan.totalAdvances,  500,  'Jan advances = 500');
  assertEq(jan.closingBalance, 4500, 'Jan closing = 4500');

  assertEq(feb.openingBalance, 4500, 'Feb opening = 4500 (Jan closing)');
  assertEq(feb.grossEarned,    2500, 'Feb gross = 2500');
  assertEq(feb.totalAdvances,  1000, 'Feb advances = 1000');
  assertEq(feb.closingBalance, 6000, 'Feb closing = 6000');

  assertEq(mar.openingBalance, 6000, 'Mar opening = 6000 (Feb closing)');
  assertEq(mar.grossEarned,    0,    'Mar gross = 0');
  assertEq(mar.closingBalance, 6000, 'Mar closing = 6000');
}

console.log('\nSCENARIO 2 — Past edits ripple through the entire chain');
{
  const records = {};
  for (let d = 1; d <= 10; d++) {
    records[`2026-01-${String(d).padStart(2, '0')}`] = {
      w1: { status: 'full', employeeId: 'w1', recordedBy: 'u', recordedAt: '' },
    };
  }
  for (let d = 1; d <= 5; d++) {
    records[`2026-02-${String(d).padStart(2, '0')}`] = {
      w1: { status: 'full', employeeId: 'w1', recordedBy: 'u', recordedAt: '' },
    };
  }
  const advances = [
    { id: 'a1', workerId: 'w1', amount: 500,  date: '2026-01-25', recordedBy: 'u' },
    { id: 'a2', workerId: 'w1', amount: 1000, date: '2026-02-20', recordedBy: 'u' },
    // Retroactive Jan advance
    { id: 'a3', workerId: 'w1', amount: 2000, date: '2026-01-15', recordedBy: 'u' },
  ];

  const feb = computeMonthlySalary(worker, '2026-02', records, advances);
  const mar = computeMonthlySalary(worker, '2026-03', records, advances);

  // Jan: gross 5000 - 500 - 2000 = 2500
  assertEq(feb.openingBalance, 2500, 'Feb opening reflects retroactive Jan advance');
  // Feb: opening 2500 + 2500 gross - 1000 adv = 4000
  assertEq(feb.closingBalance, 4000, 'Feb closing = 4000');
  assertEq(mar.openingBalance, 4000, 'Mar opening ripples through Feb');

  // Now retroactively add 1 more Jan full day
  records['2026-01-20'] = { w1: { status: 'full', employeeId: 'w1', recordedBy: 'u', recordedAt: '' } };
  const feb2 = computeMonthlySalary(worker, '2026-02', records, advances);
  const mar2 = computeMonthlySalary(worker, '2026-03', records, advances);
  // Jan: 5500 - 2500 = 3000
  assertEq(feb2.openingBalance, 3000, 'Feb opening after new Jan day');
  // Feb closing = 3000 + 1500 = 4500
  assertEq(mar2.openingBalance, 4500, 'Mar opening after Jan day ripples');
}

console.log('\nSCENARIO 3 — Worker createdAt mid-chain (records BEFORE createdAt still counted)');
{
  // startMonthKey walks the EARLIEST of {createdAt month, any record month, any advance month}
  // so back-dated attendance/advances DO contribute to carry-forward, even if logged before
  // the worker was nominally "created".
  const w3 = { ...worker, id: 'w3', createdAt: '2026-02-15' };
  const records = {
    '2026-01-15': { w3: { status: 'full', employeeId: 'w3', recordedBy: 'u', recordedAt: '' } },
    '2026-02-20': { w3: { status: 'full', employeeId: 'w3', recordedBy: 'u', recordedAt: '' } },
  };
  const advances = [
    { id: 'a1', workerId: 'w3', amount: 100, date: '2026-01-10', recordedBy: 'u' },
  ];

  const feb = computeMonthlySalary(w3, '2026-02', records, advances);
  // Jan: gross 500, advance 100, net 400 → Feb opening = 400
  assertEq(feb.openingBalance, 400, 'Feb opening = 400 (back-dated Jan day minus advance)');
  assertEq(feb.grossEarned,    500, 'Feb gross = 500');
  assertEq(feb.closingBalance, 900, 'Feb closing = 400 carry + 500 - 0');
}

console.log('\nSCENARIO 4 — 16-month walk (seed worker)');
{
  const records = {};
  // 1 full day per month from Jan 2025 to Apr 2026
  for (let y = 2025, m = 1, count = 0; count < 16; count++) {
    const k = `${y}-${String(m).padStart(2, '0')}-05`;
    records[k] = { w1: { status: 'full', employeeId: 'w1', recordedBy: 'u', recordedAt: '' } };
    m++;
    if (m === 13) { m = 1; y++; }
  }
  const may = computeMonthlySalary(worker, '2026-05', records, []);
  assertEq(may.openingBalance, 8000, 'May 2026 opening = 16 × 500');
}

console.log(`\n────────\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
