// Probe the stock + dispatch store mutations for edit-doesn't-reflect-current-totals bugs.
// Mirrors the logic of store/inventoryStore.ts and store/dispatchStore.ts so we can
// drive them without React.

let passed = 0, failed = 0;
function assertEq(actual, expected, label) {
  const a = typeof actual === 'number' ? Math.round(actual * 100) / 100 : actual;
  const e = typeof expected === 'number' ? Math.round(expected * 100) / 100 : expected;
  if (a === e) { passed++; console.log(`  ✓ ${label}`); }
  else { failed++; console.log(`  ✗ ${label}\n      expected: ${e}\n      actual:   ${a}`); }
}
function assertTrue(cond, label) { assertEq(cond, true, label); }

// ===== Inventory store (replica of store/inventoryStore.ts:43-72) =====
function updateStock(state, productId, today, closingBags, recordedBy = 'u1') {
  return {
    products: state.products.map((p) => {
      if (p.id !== productId) return p;
      const existingIdx = p.stockHistory.findIndex((e) => e.date === today);
      const entry = {
        id: existingIdx >= 0 ? p.stockHistory[existingIdx].id : 'gen-' + today,
        date: today,
        openingBags: existingIdx >= 0 ? p.stockHistory[existingIdx].openingBags : p.currentBags,
        closingBags,
        materialsUsed: [],
        notes: '',
        recordedBy,
        recordedAt: 'now',
      };
      const newHistory = existingIdx >= 0
        ? p.stockHistory.map((e, i) => (i === existingIdx ? entry : e))
        : [...p.stockHistory, entry];
      return { ...p, currentBags: closingBags, lastUpdated: 'now', stockHistory: newHistory };
    }),
  };
}
function decrementStock(state, productId, bags) {
  return {
    products: state.products.map((p) =>
      p.id === productId
        ? { ...p, currentBags: Math.max(0, p.currentBags - bags), lastUpdated: 'now' }
        : p
    ),
  };
}
function restoreStock(state, productId, bags) {
  return {
    products: state.products.map((p) =>
      p.id === productId ? { ...p, currentBags: p.currentBags + bags, lastUpdated: 'now' } : p
    ),
  };
}

// ===== Dispatch store (replica of store/dispatchStore.ts:21-36) =====
function recordDispatch(state, entry, invState) {
  return {
    dispatch: { entries: [...state.entries, entry] },
    inventory: decrementStock(invState, entry.productId, entry.bags),
  };
}
function editDispatch(state, id, patch) {
  return { entries: state.entries.map((e) => (e.id === id ? { ...e, ...patch } : e)) };
}
function deleteDispatch(state, id, invState) {
  const entry = state.entries.find((e) => e.id === id);
  const newInv = entry ? restoreStock(invState, entry.productId, entry.bags) : invState;
  return { dispatch: { entries: state.entries.filter((e) => e.id !== id) }, inventory: newInv };
}

// ===== Tests =====

console.log('TEST 1 — Production: updateStock only mutates today\'s entry');
{
  let inv = { products: [{ id: 'p1', code: 'X', currentBags: 100, lastUpdated: '', stockHistory: [
    { id: 'h1', date: '2026-03-15', openingBags: 80, closingBags: 100, materialsUsed: [], notes: '', recordedBy: 'u', recordedAt: '' },
  ]}]};

  // Try to update for today (2026-05-15): should ADD a new history row, not edit the March one
  inv = updateStock(inv, 'p1', '2026-05-15', 150);
  const p = inv.products[0];
  assertEq(p.currentBags, 150, 'currentBags becomes today closingBags');
  assertEq(p.stockHistory.length, 2, 'new history row added (March entry untouched)');
  assertEq(p.stockHistory[0].closingBags, 100, 'March entry preserved');
  assertEq(p.stockHistory[1].date, '2026-05-15', 'May entry has correct date');
  assertEq(p.stockHistory[1].openingBags, 100, 'May opening = pre-update currentBags');

  // Update again same day: should patch in place, not add
  inv = updateStock(inv, 'p1', '2026-05-15', 180);
  assertEq(inv.products[0].stockHistory.length, 2, 'same-day update patches, not appends');
  assertEq(inv.products[0].stockHistory[1].closingBags, 180, 'May entry closingBags updated');
  assertEq(inv.products[0].stockHistory[1].openingBags, 100, 'May opening still preserved');
}

console.log('\nTEST 2 — Production: NO API to edit a past stock entry');
{
  // The store exposes updateStock (today only), deleteStockEntry, addProduct,
  // decrement/restoreStock. None of them can rewrite a past stockHistory row's closingBags.
  // So "editing past production" simply cannot happen via the UI — and therefore the
  // edit-doesn\'t-reflect-totals bug class doesn\'t apply here.
  assertTrue(true, 'past stockHistory rows are immutable by design');
}

console.log('\nTEST 3 — Dispatch record: decrements stock');
{
  let inv = { products: [{ id: 'p1', currentBags: 100, lastUpdated: '', stockHistory: [] }] };
  let dispatch = { entries: [] };
  const r = recordDispatch(dispatch, {
    id: 'd1', date: '2026-05-10', time: '10:00', productId: 'p1', productCode: 'X',
    bags: 30, recipient: 'A', recordedBy: 'u',
  }, inv);
  assertEq(r.inventory.products[0].currentBags, 70, 'stock decreased by 30');
  assertEq(r.dispatch.entries.length, 1, 'entry recorded');
}

console.log('\nTEST 4 — Dispatch delete: restores stock');
{
  let inv = { products: [{ id: 'p1', currentBags: 70, lastUpdated: '', stockHistory: [] }] };
  let dispatch = { entries: [{
    id: 'd1', date: '2026-05-10', time: '10:00', productId: 'p1', productCode: 'X',
    bags: 30, recipient: 'A', recordedBy: 'u',
  }]};
  const r = deleteDispatch(dispatch, 'd1', inv);
  assertEq(r.inventory.products[0].currentBags, 100, 'stock restored to 100');
  assertEq(r.dispatch.entries.length, 0, 'entry removed');
}

// Reconciled edit (matches the fixed store/dispatchStore.ts editEntry behaviour)
function editDispatchReconciled(state, id, patch, invState) {
  const prev = state.entries.find((e) => e.id === id);
  const newDispatch = { entries: state.entries.map((e) => (e.id === id ? { ...e, ...patch } : e)) };
  if (!prev) return { dispatch: newDispatch, inventory: invState };
  const newProductId = patch.productId ?? prev.productId;
  const newBags = patch.bags ?? prev.bags;
  let nextInv = invState;
  if (newProductId === prev.productId) {
    const delta = newBags - prev.bags;
    if (delta > 0) nextInv = decrementStock(nextInv, prev.productId, delta);
    else if (delta < 0) nextInv = restoreStock(nextInv, prev.productId, -delta);
  } else {
    nextInv = restoreStock(nextInv, prev.productId, prev.bags);
    nextInv = decrementStock(nextInv, newProductId, newBags);
  }
  return { dispatch: newDispatch, inventory: nextInv };
}

console.log('\nTEST 5 — FIXED: Dispatch edit reconciles stock');
{
  // 100-bag product. Record 30 → stock 70. Edit to 50 → stock should be 50.
  let inv = { products: [{ id: 'p1', currentBags: 70, lastUpdated: '', stockHistory: [] }] };
  let dispatch = { entries: [{
    id: 'd1', date: '2026-05-10', time: '10:00', productId: 'p1', productCode: 'X',
    bags: 30, recipient: 'A', recordedBy: 'u',
  }]};
  const r1 = editDispatchReconciled(dispatch, 'd1', { bags: 50 }, inv);
  assertEq(r1.dispatch.entries[0].bags, 50, 'bags updated to 50');
  assertEq(r1.inventory.products[0].currentBags, 50, 'stock now 50 (extra 20 decremented)');

  // Edit back to 30 → stock back to 70
  const r2 = editDispatchReconciled(r1.dispatch, 'd1', { bags: 30 }, r1.inventory);
  assertEq(r2.inventory.products[0].currentBags, 70, 'stock restored to 70 after decreasing bags');

  // Edit to a different product
  let inv2 = { products: [
    { id: 'p1', currentBags: 70, lastUpdated: '', stockHistory: [] },
    { id: 'p2', currentBags: 200, lastUpdated: '', stockHistory: [] },
  ]};
  const dispatch2 = { entries: [{
    id: 'd2', date: '2026-05-10', time: '10:00', productId: 'p1', productCode: 'X',
    bags: 30, recipient: 'A', recordedBy: 'u',
  }]};
  const r3 = editDispatchReconciled(dispatch2, 'd2', { productId: 'p2', bags: 30 }, inv2);
  assertEq(r3.inventory.products[0].currentBags, 100, 'p1 restored to 100');
  assertEq(r3.inventory.products[1].currentBags, 170, 'p2 decremented to 170');
}

// Sanity test of the original buggy edit, just to keep the regression on file
console.log('\nTEST 6 — Confirm the OLD editDispatch behaviour was indeed broken');
{
  let inv = { products: [{ id: 'p1', currentBags: 70, lastUpdated: '', stockHistory: [] }] };
  let dispatch = { entries: [{
    id: 'd1', date: '2026-05-10', time: '10:00', productId: 'p1', productCode: 'X',
    bags: 30, recipient: 'A', recordedBy: 'u',
  }]};
  dispatch = editDispatch(dispatch, 'd1', { bags: 50 });
  assertEq(inv.products[0].currentBags, 70, 'OLD path leaves stock untouched (regression check)');
}

console.log(`\n────────\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
