# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Dev server
npm start                 # all platforms (Expo CLI)
npm run android           # Android emulator / device
npm run ios               # iOS simulator
npm run web               # admin portal (browser)

# Code quality
npm run lint              # ESLint on .ts/.tsx
npm run format            # Prettier write

# Tests (Node-based, no Jest)
node tests/salary.test.mjs
node tests/store-mutations.test.mjs
node --experimental-strip-types --no-warnings tests/chain-carry.test.mjs
```

The chain-carry test imports the *real* `lib/salary.ts` via Node 24's native TS stripping (the file is copied at `tests/_salary-imported.mts` with local type stubs — keep them in sync when types in `@/types` change).

All `npm` start scripts wrap Expo CLI with `NODE_OPTIONS=--no-experimental-require-module` to suppress ESM warnings on Node 22+.

Install with `npm install --legacy-peer-deps` (Expo 54 + RN 0.81 peer-dep mismatches).

Demo credentials exist in Supabase Auth and are linked to `app_users` rows: `admin@opac.in / admin123`, `manager@opac.in / manager123`, `supervisor@opac.in / worker123`, `operator@opac.in / worker123`. Treat the passwords as throwaway; rotate before any non-dev usage. For fresh Supabase projects, follow the bootstrap recipe in `README.md`.

## Architecture

### Backend (Supabase)
`lib/supabase.ts` exports a single `supabase` client (anon/publishable key — safe to embed for internal apps with RLS disabled). All stores import it for remote sync.

**Tables** (must exist in Supabase before the app can sync):
`app_users`, `workers`, `advances`, `attendance`, `products`, `stock_history`, `dispatch_entries`, `audit_logs`

RLS is enabled on every table. Identity comes from Supabase Auth JWTs (`auth.uid()`), and identity columns (`recorded_by`, `user_id`) have `default auth.uid()::text` plus a WITH CHECK clause that pins them to the caller. Roles are determined by `app_users.role` joined via `public.is_admin(auth.uid())`. **Never re-introduce client-supplied `recorded_by` arguments** — leave the column out of the insert payload entirely and let the DB default fill it in. The local Zustand mirror may temporarily hold a different value optimistically; the next `hydrate()` reconciles it.

Auth flow: `useAuthStore.login(email, password)` calls `supabase.auth.signInWithPassword`, then looks up the matching `app_users` row by `auth_user_id`. There is **no client-side credential comparison** and **no `password` column** on `app_users` — Supabase Auth owns credentials. User CRUD that touches `auth.users` (create / delete / password reset) goes through the `manage-users` Edge Function with `verify_jwt: true` and a service-role-backed admin check.

**Sync pattern** used in every store:
1. `hydrate()` — called once at startup from `app/_layout.tsx` via `Promise.all`, and **again inside `authStore.login()` after every successful login**. The second call ensures stale AsyncStorage cache from a previous session is replaced with live Supabase data immediately after login, not just on next cold start.
2. **Optimistic mutations** — every write (`addUser`, `mark`, `record`, etc.) updates local Zustand state immediately (no spinner), then fires a Supabase insert/update/delete in the background. On Supabase error, the local state is rolled back.
3. AsyncStorage `persist` middleware is still present as a local cache — so the last known state is available instantly on next launch before `hydrate()` completes. The users list (`usersStore`) is **not persisted** — it lives in memory only after `hydrate()`.

If Supabase tables don't exist yet, `hydrate()` fails silently (`.catch(() => {})`) and the app falls back to AsyncStorage-only state (isolated per platform, no cross-device sync).

### Routing (Expo Router v6)
File-based routing with three route groups:
- `app/(auth)/` — login screen, no auth required
- `app/(worker)/` — bottom tab navigator: Home (dashboard), Attendance, Production, Dispatch
- `app/(admin)/` — six screens (Dashboard, Attendance, Production, Dispatch, Reports, Users). Wide viewports (≥768 px) get a sidebar layout; narrow viewports and native get a bottom tab bar.
- `app/stock-update/[productId]` — modal screen pushed from the production tab

`app/index.tsx` reads auth state from `useAuthStore` and redirects to the correct group. Guards live in each group's `_layout.tsx` — non-admins are redirected to login if they hit `/(admin)/*`. **Both layout guards check `_hasHydrated` before redirecting** — return `null` until AsyncStorage has rehydrated, otherwise the still-null `role` causes a spurious redirect to login on cold start.

### Responsive layout
`hooks/useIsMobile.ts` exports `useIsMobile(): boolean` (true when `useWindowDimensions().width < 768`). Use this — not `Platform.OS` — to branch between sidebar and tab-bar layouts. `Platform.OS === 'web'` only distinguishes runtime platform, not viewport size; a phone browser is `'web'` but narrow. Both `(admin)/_layout.tsx` and `(worker)/_layout.tsx` use this hook.

Several admin screens are thin re-exports of the worker version (e.g. `app/(admin)/dispatch.tsx` is `export { default } from '@/app/(worker)/dispatch'`). Behavior diverges via the `role` from `useAuthStore` (e.g. delete buttons only render for admins; the worker-deletion icon on `(worker)/attendance.tsx` is admin-only).

### State (Zustand v5 + AsyncStorage persist + Supabase)
All stores are in `store/`. Each uses `persist` middleware with a unique storage key (`opac-*`) for the local cache layer, and imports `supabase` from `lib/supabase.ts` for remote sync:

| Store | Key data | Notable methods |
|---|---|---|
| `authStore` | `user`, `role`, `_hasHydrated` | `login()` calls Supabase Auth then looks up `app_users` by `auth_user_id`; re-hydrates all stores on success; `logout()` |
| `usersStore` | `users[]` (email/name/role — no password) | `addUser()`, `updateUser()`, `removeUser()`. User CRUD goes through the `manage-users` Edge Function. Guards prevent removing the last admin. **Not persisted to AsyncStorage.** |
| `workersStore` | `workers[]`, `advances[]` | `addWorker({ ..., createdAt? })` (optional past hire date), `removeWorker()` (soft delete, sets `active=false`), `settleWorker()`/`unsettleWorker()`, `addAdvance()`, `editAdvance()`, `deleteAdvance()`, `updateWorkerWage(id, wage, effectiveFrom)`, `getTotalAdvances()` |
| `attendanceStore` | `records: Record<date, Record<employeeId, AttendanceRecord>>`, `syncStatus: Record<string, SyncStatus>` | `mark()`, `unmark()`, `toggleNight()`, `getRecordsForDate()`, `canEdit(date, isAdmin)`, `getSyncStatus(date, employeeId)`, `retrySync(date, employeeId)` |
| `inventoryStore` | `products[]` | `updateStock()` (accepts optional `date`; omit for today, pass YYYY-MM-DD for backdated entries), `decrementStock()`, `restoreStock()`, `addProduct()`, `deleteStockEntry()`, `getProduct(id)` — use this instead of hand-rolling `.products.find()` |
| `dispatchStore` | `entries[]` | `record()` (stock guard then `inventoryStore.decrementStock`), `editEntry()` (stock guard then diffs bags/productId and reconciles stock — see below), `deleteEntry()` (calls `restoreStock`), `getTodayEntries()` |
| `auditStore` | `logs[]` | `log()`, `getLogsForEntity()`, `getRecentLogs(days)`, `pruneOldLogs()` |
| `uiStore` | `toast` | `showToast()`, `hideToast()` |

`store/useAttendanceStore.ts` is an unused legacy file — do not import from it. The canonical attendance store is `store/attendanceStore.ts`.

### Attendance sync details
Each attendance record tracks its own sync state via `syncStatus: Record<"date:employeeId", SyncStatus>` where `SyncStatus = 'synced' | 'syncing' | 'error'`. Use `getSyncStatus(date, employeeId)` to read it in a component; the worker card renders a spinner (syncing) or `<WifiOff>` icon (error) accordingly.

The underlying `upsertRecord` uses **delete-then-insert** rather than Supabase's `upsert`. This is intentional: the RLS `UPDATE WITH CHECK` policy pins a row to its original author (`recorded_by = auth.uid()`), so a second user re-marking attendance would fail on update. Deleting first lets any authenticated user replace the row. Do not revert this to `upsert`.

`retrySync(date, employeeId)` re-runs `upsertRecord` for a specific record that landed in `'error'` state, without touching the rest of the store.

### Wage history
`Worker` has a `wageHistory: { wage: number; effectiveFrom: string }[]` field. `updateWorkerWage(id, wage, effectiveFrom)` appends a new entry and re-sorts by date; `worker.dailyWage` always holds the current (latest) wage. The attendance screen shows full wage history by making the worker's name a `<Pressable>` that opens a "Wage Details" bottom sheet — non-admins see read-only history + prior-month salary summary; the update form is admin-only.

Cross-store coupling lives in store actions (`dispatchStore.record` / `.editEntry` / `.deleteEntry` all mutate `inventoryStore`). Don't duplicate that logic in screens.

`dispatchStore.editEntry` is non-trivial: when `bags` or `productId` is patched, it diffs against the prior entry and applies `decrementStock`/`restoreStock` to keep `currentBags` consistent. If you add fields to `DispatchEntry` that affect stock, mirror this pattern.

### Key Types (`types/index.ts`)
```ts
type AttendanceStatus = 'absent' | 'full' | { hours: number };
```
Central union — always handle all three variants when reading attendance records.

### Salary computation (`lib/salary.ts` — authoritative)
**Never recompute salary from raw records in a screen.** All salary numbers — on-screen totals, modal detail, PDF — must come from `computeMonthlySalary(worker, monthKey, records, allAdvances)`.

Model:
- `openingBalance` = `worker.previousBalance` (seed) + chained net of every prior month from `startMonthKey(worker, records, advances)` to `monthKey − 1`.
- `startMonthKey` picks the **earliest** of {createdAt month, any record month for this worker, any advance month for this worker}. So back-dated attendance/advances DO contribute to carry-forward.
- `closingBalance` = `openingBalance + grossEarned − totalAdvances`.
- A month's `closingBalance` becomes the next month's `openingBalance` — the chain is computed on every call, so edits to any past month immediately ripple into all later months' totals. This is exercised by `tests/chain-carry.test.mjs`.

`computeCarryInBreakdown` returns the per-month chain that produced an opening balance — render it in the detail modal and the PDF whenever you need to *explain* a carry-in number to the user.

Per-day earnings: `full → dailyWage`, `{ hours } → (hours/12) * dailyWage`, `absent → 0`.

A worker with `settled: true` represents a closed account; the Reports → Salary tab shows them by default (toggle is open by default) and exposes a Reopen action via `ConfirmDialog`.

**Salary tab month-range filtering:** `salaryRows` and `removedRows` in `reports.tsx` are filtered so a worker only appears for months they were actually employed:
- Active workers: hidden if `salaryMonth < worker.createdAt.slice(0, 7)` (not hired yet)
- Removed workers: also hidden if `salaryMonth > worker.removedAt.slice(0, 7)` (already gone)
This means a worker hired 2026-03-05 and removed 2026-04-10 appears only in March and April salary tabs.

### PDF salary reports (`lib/salaryPdf.ts`)
`generateWorkerMonthlyPDF(worker, monthKey, records, allAdvances)` is the single entry point. Internals:
- Builds A4 HTML with the carry-in chain table, attendance table (every day of the month), advance table, and the `A − B + C = NET PAYABLE` totals box.
- **Web**: `Print.printAsync({ html })` opens the browser print dialog → Save as PDF.
- **Native**: `Print.printToFileAsync` writes a temp PDF, then `Sharing.shareAsync` opens the OS share sheet.

The Reports → Salary tab has a month stepper (separate from the From/To date pickers, which still drive Production/Dispatch/Audit tabs). "Save All PDFs" generates one separate PDF per worker for the selected month.

### Reports screen month vs. range
- **Salary tab** uses `salaryMonth` (month-only stepper). `salaryRows` and the detail modal both call `computeMonthlySalary(worker, salaryMonth, …)`. Attendance and advance lists inside the modal are scoped to `daysOfMonth(salaryMonth)`.
- **Production / Dispatch / Audit tabs** use the `dateFrom`/`dateTo` pickers at the top of the screen.
- Both controls are always visible; each tab reads the one it needs.

### Styling (NativeWind v4 + Tailwind)
The actual theme is **warm / light** (Anthropic-ish). Custom color tokens are in `tailwind.config.js`. In `className` props use these tokens rather than raw hex:
- Backgrounds: `bg-bg-primary` (`#faf9f5`), `bg-bg-secondary` (`#ffffff`), `bg-bg-tertiary` (`#f4f2ea`)
- Borders: `border-border-color` (`#e8e4d6`), `border-border-strong` (`#d4cdb8`)
- Text: `text-text-primary` (`#1f1e1c`), `text-text-secondary`, `text-text-tertiary`
- Accent: `text-accent` / `bg-accent` (`#D97757` warm orange)
- Polymer badges: `polymer-hdpe`, `polymer-pp`, `polymer-ldpe`

For `style={}` prop values (not className) use the constants from `constants/index.ts` (`COLORS.bgPrimary`, `COLORS.accent`, etc.) rather than literal hex — the file also exposes soft-accent variants (`accentSoftBg`, `accentSoftBorder`, `errorSoftBg`) that don't exist in Tailwind. Additional semantic tokens: `COLORS.warning` (amber, used for advances and partial hours), `COLORS.error` (red, used for absent and sync failures).

`FONTS` maps to Inter (sans) and Source Serif 4 (serif) loaded by `@expo-google-fonts`. Inter weights: `sansRegular`, `sansMedium`, `sansSemibold`, `sansBold`, `sansExtraBold`, `sansBlack`. Serif weights: `serifMedium`, `serifSemibold`, `serifBold`. Monospace fallback: `FONTS.mono` (`'ui-monospace'`).

### Shared UI components
- `components/ConfirmDialog.tsx` — use for every delete / settle / reopen. Render it once at the bottom of the screen, gated on a `*Target` state object that the icon's `onPress` sets. The actual mutation runs in the `onConfirm` callback.
- `components/DatePickerModal.tsx` — full-screen modal date picker. Props: `visible`, `value` (YYYY-MM-DD), `label`, `maxDate?`, `onConfirm`, `onClose`. Used in `reports.tsx` date-range pickers.
- `components/InlineDatePicker.tsx` — compact inline date input with `±1 day` buttons and typed entry. Props: `label`, `value`, `onChange`, `maxDate?`. Used inside bottom sheets (Add Worker, Add Product, wage update, advance recording) and the stock-update modal (entry date picker). Prefer this over `DatePickerModal` inside `<BottomSheet>`.

### Audit Trail Pattern
Every mutation that changes business data must call `useAuditStore.getState().log(...)` with `userId`, `userName`, `action`, `entity`, `entityId`, and a human-readable `detail`. Audit logs are displayed only in the admin Reports → Audit Log tab. Retention is enforced by `AUDIT_LOG_RETENTION_DAYS` (90 days) — logs never auto-prune unless `pruneOldLogs()` is called.

### 3-Day Edit Restriction
`attendanceStore.canEdit(date, isAdmin)` returns `false` for non-admins editing records older than 3 days. Check this before any attendance mutation and show an error toast if blocked. Admins bypass.

### Utilities
- `lib/utils.ts` — exports `generateId()` (nanoid non-secure) used for all local IDs before Supabase sync. Also re-exports `todayISO()`.
- `lib/date.ts` — beyond `todayISO()` and `formatDateReadable()`, exports `relativeTime(iso)` ("5m ago", "Yesterday") used in audit log display, and `subtractDays(n)` for date-range defaults.

### Units
1 bag = 25 kg. Use `lib/units.ts` helpers (`formatBagsKg`, `bagsToKg`) for all bag/kg conversions.

### Dispatch / Stock Coupling
Dispatch only operates on products with `currentBags > 0`. The picker filters by stock; submission is blocked if bags requested exceeds the effective available stock. Editing an existing dispatch must still find its product via the unfiltered list (so a now-empty product is still resolvable).

Stock is enforced at **two layers**:
1. **UI** — `effectiveAvailable` is computed as `currentBags + editRestoreBags` where `editRestoreBags` is the original entry's bag count when editing the same product (because `currentBags` is already decremented by the prior dispatch; those bags are logically restored before re-dispatching). `wouldGoNegative` and `canSubmit` gate the submit button.
2. **Store** — `record()` and `editEntry()` each re-check stock via `inv.getProduct(id)` and return early if the guard fails, as a safety net against race conditions or direct store calls. Use `inv.getProduct(id)` (not `inv.products.find()`) — the selector is already exposed by `inventoryStore`.

`editEntry` reconciles stock automatically: same-product edits apply the delta (`decrementStock` or `restoreStock`); product-switch edits restore the old product and decrement the new one.

### Production rule
`inventoryStore.updateStock` accepts an optional `date` field (YYYY-MM-DD, defaults to today):
- **Today** (default): sets `product.currentBags = closingBags` and writes the Supabase `products` row. `openingBags` is taken from `product.currentBags` (or from the existing today entry if re-updating).
- **Past date**: upserts only the `stock_history` row. `currentBags` is **not** changed — the physical stock level is unaffected. `openingBags` is taken from the existing history entry if one exists, otherwise `0`.

The `stock-update/[productId]` modal exposes this via `InlineDatePicker` (max = today). Selecting a past date with an existing entry auto-fills the form. Monthly production totals in the production screen and reports already aggregate all `stockHistory` entries filtered by date range, so backdated entries appear automatically.

`inventoryStore.addProduct` accepts an optional `entryDate` (defaults to `todayISO()`). The "Add Product" sheet exposes a **Start Date** picker so opening stock can be backdated to the actual first production day.

### Toast
`useUiStore().showToast('success' | 'error', message)` — the `<Toast />` component is mounted once in `app/_layout.tsx` at z-index 9999.

### Advance entry display on attendance
On the worker attendance screen, advances dated to the currently displayed day render as a sub-section under that worker's card. When you open the advance sheet from a worker row, `advDate` defaults to the on-screen `selectedDate`; on save, the screen jumps to that date so the new entry is immediately visible.
