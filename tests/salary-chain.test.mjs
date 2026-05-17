// Long-chain carry-forward test. Reproduces the user's reported scenario:
// past-month edits must propagate through ALL subsequent months.

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

// Uses the FIXED logic from lib/salary.ts
function startMonthKey(worker, records, advances) {
  let earliest = monthKeyFromISO(worker.createdAt);
  for (const date in records) {
    if (records[date]?.[worker.id]) {
      const mk = monthKeyFromISO(date);
      if (mk < earliest) earliest = mk;
    }
  }
  for (const a of advances) {
    if (a.workerId === worker.id) {
      const mk = monthKeyFromISO(a.date);
      if (mk < earliest) earliest = mk;
    }
  }
  return earliest;
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
function computeOpeningBalance(worker, target, records, advances) {
  let bal = worker.previousBalance ?? 0;
  let cursor = startMonthKey(worker, records, advances);
  while (cursor < target) {
    bal += singleMonth(worker, cursor, records, advances).net;
    cursor = shiftMonthKey(cursor, 1);
  }
  return bal;
}
function computeMonthlySalary(worker, mk, records, advances) {
  const opening = computeOpeningBalance(worker, mk, records, advances);
  const { gross, totalAdv } = singleMonth(worker, mk, records, advances);
  return { opening, gross, totalAdv, closing: opening + gross - totalAdv };
}

let passed = 0, failed = 0;
function assertEq(actual, expected, label) {
  const a = typeof actual === 'number' ? Math.round(actual * 100) / 100 : actual;
  const e = typeof expected === 'number' ? Math.round(expected * 100) / 100 : expected;
  if (a === e) { passed++; console.log(`  ✓ ${label}`); }
  else { failed++; console.log(`  ✗ ${label}\n      expected: ${e}\n      actual:   ${a}`); }
}

// =================================================================
// TEST: SEED worker — 3-month chain Feb → Mar → Apr → May
// =================================================================
console.log('TEST A — Seed worker, chained carry-forward Feb→Mar→Apr→May');
{
  const worker = { id: 'w1', name: 'Seed', dailyWage: 500, previousBalance: 0, active: true, createdAt: '2025-01-01' };
  const records = {
    '2026-02-10': { w1: { status: 'full' } },     // Feb earns 500
    '2026-03-10': { w1: { status: 'full' } },     // Mar earns 500
    '2026-03-11': { w1: { status: 'full' } },     // Mar earns another 500
    '2026-04-10': { w1: { status: 'full' } },     // Apr earns 500
  };
  const advances = [
    { id: 'a1', workerId: 'w1', amount: 200, date: '2026-02-20' },  // Feb adv 200
    { id: 'a2', workerId: 'w1', amount: 400, date: '2026-04-05' },  // Apr adv 400
  ];

  // Feb: gross 500, adv 200, net 300. closing 300.
  // Mar: opening 300, gross 1000, adv 0, net 1000. closing 1300.
  // Apr: opening 1300, gross 500, adv 400, net 100. closing 1400.
  // May: opening 1400, gross 0, adv 0, net 0. closing 1400.

  const feb = computeMonthlySalary(worker, '2026-02', records, advances);
  assertEq(feb.closing, 300, 'Feb closing = 300');
  const mar = computeMonthlySalary(worker, '2026-03', records, advances);
  assertEq(mar.opening, 300, 'Mar opening picks up Feb closing');
  assertEq(mar.closing, 1300, 'Mar closing = 1300');
  const apr = computeMonthlySalary(worker, '2026-04', records, advances);
  assertEq(apr.opening, 1300, 'Apr opening picks up Mar closing');
  assertEq(apr.closing, 1400, 'Apr closing = 1400');
  const may = computeMonthlySalary(worker, '2026-05', records, advances);
  assertEq(may.opening, 1400, 'May opening picks up Apr closing');
  assertEq(may.closing, 1400, 'May closing = 1400');
}

// =================================================================
// TEST: Retroactive edit — add Apr advance AFTER May has been viewed.
// May opening must drop by the new advance amount.
// =================================================================
console.log('\nTEST B — Retroactive Apr advance bleeds into May');
{
  const worker = { id: 'w1', name: 'Seed', dailyWage: 500, previousBalance: 0, active: true, createdAt: '2025-01-01' };
  let records = { '2026-04-10': { w1: { status: 'full' } } };
  let advances = [];

  const mayBefore = computeMonthlySalary(worker, '2026-05', records, advances);
  assertEq(mayBefore.opening, 500, 'May opening before Apr adv = 500 (1 full day in Apr)');

  // Now record an April advance retroactively
  advances = [{ id: 'a1', workerId: 'w1', amount: 200, date: '2026-04-15' }];
  const mayAfter = computeMonthlySalary(worker, '2026-05', records, advances);
  assertEq(mayAfter.opening, 300, 'May opening after Apr adv = 500 - 200 = 300');

  // Add another retroactive Apr attendance day
  records = {
    '2026-04-10': { w1: { status: 'full' } },
    '2026-04-12': { w1: { status: 'full' } },
  };
  const mayAfter2 = computeMonthlySalary(worker, '2026-05', records, advances);
  assertEq(mayAfter2.opening, 800, 'May opening after extra Apr full day = 800');
}

// =================================================================
// TEST: NEW worker — createdAt = today, but admin backdates attendance
// to a prior month. CURRENT BUG: startMonthKey starts at createdAt month,
// so prior-month records are silently skipped.
// =================================================================
console.log('\nTEST C — New worker (createdAt today) with backdated attendance');
{
  const worker = { id: 'w1', name: 'New', dailyWage: 500, previousBalance: 0, active: true, createdAt: '2026-05-15' };
  const records = {
    '2026-04-10': { w1: { status: 'full' } },    // backdated
    '2026-03-10': { w1: { status: 'full' } },    // even older
  };
  const advances = [
    { id: 'a1', workerId: 'w1', amount: 100, date: '2026-04-05' },
  ];
  const may = computeMonthlySalary(worker, '2026-05', records, advances);
  // EXPECTED: May opening should be 500 (Mar) + 500 (Apr) - 100 (Apr adv) = 900
  // CURRENT BUG: cursor starts at "2026-05" which == target, so loop skips → opening = 0
  console.log(`  current behavior: May opening = ${may.opening}`);
  console.log(`  expected:         May opening = 900`);
  if (may.opening === 900) {
    passed++;
    console.log('  ✓ Backdated data IS counted in carry-forward');
  } else {
    failed++;
    console.log('  ✗ BUG: Backdated data is dropped from carry-forward');
  }
}

// =================================================================
// TEST: Advance dated BEFORE worker.createdAt
// =================================================================
console.log('\nTEST D — Advance dated before worker.createdAt');
{
  const worker = { id: 'w1', name: 'New', dailyWage: 500, previousBalance: 0, active: true, createdAt: '2026-05-15' };
  const advances = [{ id: 'a1', workerId: 'w1', amount: 300, date: '2026-04-05' }];
  const may = computeMonthlySalary(worker, '2026-05', {}, advances);
  console.log(`  current behavior: May opening = ${may.opening}`);
  console.log(`  expected:         May opening = -300`);
  if (may.opening === -300) {
    passed++;
    console.log('  ✓ Pre-createdAt advance counted in carry-forward');
  } else {
    failed++;
    console.log('  ✗ BUG: Pre-createdAt advance dropped from carry-forward');
  }
}

console.log(`\n────────\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
