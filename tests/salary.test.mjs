// Pure-JS port of lib/salary.ts so we can exercise the algorithm without a TS runtime.
// If any of these tests fail, salary.ts is wrong; if they pass but the app misbehaves,
// the bug is somewhere upstream (state, the screen, or the PDF caller).

function monthKeyFromISO(d) { return d.slice(0, 7); }
function shiftMonthKey(mk, delta) {
  const [y, m] = mk.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function daysOfMonth(mk) {
  const [y, m] = mk.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  const out = [];
  for (let i = 1; i <= last; i++) out.push(`${mk}-${String(i).padStart(2, '0')}`);
  return out;
}
function earningsFor(status, wage) {
  if (status === null || status === 'absent') return 0;
  if (status === 'full') return wage;
  return (status.hours / 12) * wage;
}
function singleMonth(worker, mk, records, advances) {
  let gross = 0;
  for (const date of daysOfMonth(mk)) {
    const rec = records[date]?.[worker.id];
    if (!rec) continue;
    gross += earningsFor(rec.status, worker.dailyWage);
  }
  const totalAdv = advances
    .filter((a) => a.workerId === worker.id && monthKeyFromISO(a.date) === mk)
    .reduce((s, a) => s + a.amount, 0);
  return { gross, totalAdv, net: gross - totalAdv };
}
function computeOpeningBalance(worker, targetMk, records, advances) {
  let bal = worker.previousBalance ?? 0;
  let cursor = monthKeyFromISO(worker.createdAt);
  while (cursor < targetMk) {
    const { net } = singleMonth(worker, cursor, records, advances);
    bal += net;
    cursor = shiftMonthKey(cursor, 1);
  }
  return bal;
}
function computeMonthlySalary(worker, mk, records, advances) {
  const opening = computeOpeningBalance(worker, mk, records, advances);
  const { gross, totalAdv } = singleMonth(worker, mk, records, advances);
  return { opening, gross, totalAdv, net: gross - totalAdv, closing: opening + gross - totalAdv };
}

// ---- harness ----
let passed = 0, failed = 0;
function assertEq(actual, expected, label) {
  const a = typeof actual === 'number' ? Math.round(actual * 100) / 100 : actual;
  const e = typeof expected === 'number' ? Math.round(expected * 100) / 100 : expected;
  if (a === e) { passed++; console.log(`  ✓ ${label}`); }
  else { failed++; console.log(`  ✗ ${label}\n      expected: ${e}\n      actual:   ${a}`); }
}

// ---- fixtures ----
const worker = { id: 'w1', name: 'Test', dailyWage: 500, previousBalance: 0, active: true, createdAt: '2026-01-01' };

// Test 1: empty history
console.log('TEST 1 — Empty month');
{
  const r = computeMonthlySalary(worker, '2026-02', {}, []);
  assertEq(r.opening, 0, 'opening = 0 with no history');
  assertEq(r.gross, 0, 'gross = 0');
  assertEq(r.totalAdv, 0, 'advances = 0');
  assertEq(r.closing, 0, 'closing = 0');
}

// Test 2: full / hours / absent in February
console.log('\nTEST 2 — Mixed attendance in Feb');
{
  const records = {
    '2026-02-05': { w1: { status: 'full', employeeId: 'w1', recordedBy: 'u', recordedAt: '' } },
    '2026-02-06': { w1: { status: { hours: 8 }, employeeId: 'w1', recordedBy: 'u', recordedAt: '' } },
    '2026-02-07': { w1: { status: 'absent', employeeId: 'w1', recordedBy: 'u', recordedAt: '' } },
  };
  const advances = [{ id: 'a1', workerId: 'w1', amount: 200, date: '2026-02-10', recordedBy: 'u' }];
  const feb = computeMonthlySalary(worker, '2026-02', records, advances);
  assertEq(feb.gross, 500 + (8/12)*500, 'Feb gross = 500 + 333.33');
  assertEq(feb.totalAdv, 200, 'Feb advances = 200');
  assertEq(feb.net, 500 + (8/12)*500 - 200, 'Feb net');
  assertEq(feb.opening, 0, 'Feb opening = 0 (no Jan activity)');
  assertEq(feb.closing, 500 + (8/12)*500 - 200, 'Feb closing');
}

// Test 3: prior-month carry-forward
console.log('\nTEST 3 — Carry-forward Feb → March');
{
  const records = {
    '2026-02-05': { w1: { status: 'full', employeeId: 'w1', recordedBy: 'u', recordedAt: '' } },
    '2026-02-06': { w1: { status: 'full', employeeId: 'w1', recordedBy: 'u', recordedAt: '' } },
  };
  const advances = [{ id: 'a1', workerId: 'w1', amount: 200, date: '2026-02-10', recordedBy: 'u' }];
  const mar = computeMonthlySalary(worker, '2026-03', records, advances);
  // Feb: gross 1000, adv 200, net 800 → March opening should be 800
  assertEq(mar.opening, 800, 'March opening = 800 (Feb net)');
  assertEq(mar.gross, 0, 'March gross = 0');
  assertEq(mar.closing, 800, 'March closing = 800');
}

// Test 4: retroactive edit to PAST month flows into CURRENT month
console.log('\nTEST 4 — Past edits reflect in current month');
{
  // Before edit: nothing in Feb, look at March
  let records = {};
  let advances = [];
  const marBefore = computeMonthlySalary(worker, '2026-03', records, advances);
  assertEq(marBefore.opening, 0, 'March opening before any Feb data = 0');

  // Now retroactively add Feb attendance
  records = {
    '2026-02-12': { w1: { status: 'full', employeeId: 'w1', recordedBy: 'u', recordedAt: '' } },
  };
  const marAfterAttendance = computeMonthlySalary(worker, '2026-03', records, advances);
  assertEq(marAfterAttendance.opening, 500, 'March opening after adding Feb full day = 500');

  // Now also add a Feb advance
  advances = [{ id: 'a1', workerId: 'w1', amount: 300, date: '2026-02-20', recordedBy: 'u' }];
  const marAfterAdvance = computeMonthlySalary(worker, '2026-03', records, advances);
  assertEq(marAfterAdvance.opening, 200, 'March opening after adding Feb advance = 200');
}

// Test 5: previousBalance seeds carry-forward
console.log('\nTEST 5 — previousBalance is the seed');
{
  const w2 = { ...worker, id: 'w2', previousBalance: 1000, createdAt: '2026-01-01' };
  const records = {};
  const advances = [];
  const may = computeMonthlySalary(w2, '2026-05', records, advances);
  assertEq(may.opening, 1000, 'May opening = previousBalance (1000)');
  assertEq(may.closing, 1000, 'May closing = 1000');
}

// Test 6: negative net (overpaid) flows forward
console.log('\nTEST 6 — Negative carry-forward (overpaid)');
{
  const records = {};
  const advances = [{ id: 'a1', workerId: 'w1', amount: 1000, date: '2026-02-15', recordedBy: 'u' }];
  const mar = computeMonthlySalary(worker, '2026-03', records, advances);
  assertEq(mar.opening, -1000, 'March opening = -1000 (Feb overpaid)');
}

// Test 7: month-key arithmetic crosses year boundary
console.log('\nTEST 7 — Year boundary');
{
  assertEq(shiftMonthKey('2026-01', -1), '2025-12', 'Jan → prev month = Dec last year');
  assertEq(shiftMonthKey('2026-12', 1), '2027-01', 'Dec → next month = Jan next year');
  assertEq(daysOfMonth('2026-02').length, 28, '2026 Feb has 28 days');
  assertEq(daysOfMonth('2024-02').length, 29, '2024 Feb has 29 days (leap)');
}

console.log(`\n────────\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
