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

Demo credentials (seeded into `usersStore` on first launch): `worker@opac.in / 1234`, `admin@opac.in / 1234`. They are no longer displayed on the login screen.

## Architecture

### Routing (Expo Router v6)
File-based routing with three route groups:
- `app/(auth)/` — login screen, no auth required
- `app/(worker)/` — bottom tab navigator: Home (dashboard), Attendance, Production, Dispatch
- `app/(admin)/` — six screens (Dashboard, Attendance, Production, Dispatch, Reports, Users). On web a sidebar layout renders them all; on mobile they appear as a bottom tab bar
- `app/stock-update/[productId]` — modal screen pushed from the production tab

`app/index.tsx` reads auth state from `useAuthStore` and redirects to the correct group. Guards live in each group's `_layout.tsx` — non-admins are redirected to login if they hit `/(admin)/*`.

Several admin screens are thin re-exports of the worker version (e.g. `app/(admin)/dispatch.tsx` is `export { default } from '@/app/(worker)/dispatch'`). Behavior diverges via the `role` from `useAuthStore` (e.g. delete buttons only render for admins; the worker-deletion icon on `(worker)/attendance.tsx` is admin-only).

### State (Zustand v5 + AsyncStorage persist)
All stores are in `store/`. Each uses `persist` middleware with a unique storage key (`opac-*`):

| Store | Key data | Notable methods |
|---|---|---|
| `authStore` | `user`, `role`, `_hasHydrated` | `login()` delegates to `usersStore.findByCredentials`; `logout()` |
| `usersStore` | `users[]` (email/password/name/role) | `addUser()`, `updateUser()`, `removeUser()`, `findByCredentials()`. Guards prevent removing the last admin. Seeded from `mocks/users.ts` on first hydrate |
| `workersStore` | `workers[]`, `advances[]` | `addWorker()`, `removeWorker()` (soft delete, sets `active=false`), `settleWorker()`/`unsettleWorker()`, `addAdvance()`, `getTotalAdvances()` |
| `attendanceStore` | `records: Record<date, Record<employeeId, AttendanceRecord>>` | `mark()`, `getRecordsForDate()`, `canEdit(date, isAdmin)` |
| `inventoryStore` | `products[]` | `updateStock()` (writes today's row only), `decrementStock()`, `restoreStock()`, `addProduct()`, `deleteStockEntry()` |
| `dispatchStore` | `entries[]` | `record()` (also `inventoryStore.decrementStock`), `editEntry()` (diffs bags/productId and reconciles stock — see below), `deleteEntry()` (calls `restoreStock`), `getTodayEntries()` |
| `auditStore` | `logs[]` | `log()`, `getLogsForEntity()`, `getRecentLogs(days)`, `pruneOldLogs()` |
| `uiStore` | `toast` | `showToast()`, `hideToast()` |

`store/useAttendanceStore.ts` is an unused legacy file — do not import from it. The canonical attendance store is `store/attendanceStore.ts`.

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

For `style={}` prop values (not className) use the constants from `constants/index.ts` (`COLORS.bgPrimary`, `COLORS.accent`, etc.) rather than literal hex — the file also exposes soft-accent variants (`accentSoftBg`, `accentSoftBorder`, `errorSoftBg`) that don't exist in Tailwind. `FONTS` in the same file maps to the Inter / Source Serif 4 families loaded by `@expo-google-fonts`.

### Destructive actions
Use `components/ConfirmDialog.tsx` for every delete / settle / reopen. Render it once at the bottom of the screen, gated on a `*Target` state object that the icon's `onPress` sets. The actual mutation runs in the `onConfirm` callback. This pattern is in use across `(admin)/users.tsx`, `(admin)/reports.tsx`, `(worker)/attendance.tsx`, and `(worker)/dispatch.tsx`.

### Audit Trail Pattern
Every mutation that changes business data must call `useAuditStore.getState().log(...)` with `userId`, `userName`, `action`, `entity`, `entityId`, and a human-readable `detail`. Audit logs are displayed only in the admin Reports → Audit Log tab. Retention is enforced by `AUDIT_LOG_RETENTION_DAYS` (90 days) — logs never auto-prune unless `pruneOldLogs()` is called.

### 3-Day Edit Restriction
`attendanceStore.canEdit(date, isAdmin)` returns `false` for non-admins editing records older than 3 days. Check this before any attendance mutation and show an error toast if blocked. Admins bypass.

### Units
1 bag = 25 kg. Use `lib/units.ts` helpers (`formatBagsKg`, `bagsToKg`) for all bag/kg conversions.

### Dispatch / Stock Coupling
Dispatch only operates on products with `currentBags > 0`. The picker filters by stock; submission is blocked if bags requested exceeds `currentBags`. Editing an existing dispatch must still find its product via the unfiltered list (so a now-empty product is still resolvable). `editEntry` reconciles stock automatically.

### Production rule
`inventoryStore.updateStock` only ever writes the entry whose `date === todayISO()`. Past `stockHistory` rows are immutable through the UI — there is no "edit a past production day" API. If you need to backfill, add a fresh helper rather than mutating history in place (downstream openings rely on history being append-only).

### Toast
`useUiStore().showToast('success' | 'error', message)` — the `<Toast />` component is mounted once in `app/_layout.tsx` at z-index 9999.

### Advance entry display on attendance
On the worker attendance screen, advances dated to the currently displayed day render as a sub-section under that worker's card. When you open the advance sheet from a worker row, `advDate` defaults to the on-screen `selectedDate`; on save, the screen jumps to that date so the new entry is immediately visible.
