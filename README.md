# OPAC OPS

Internal operations app for OPAC Polymers — track worker attendance, production stock, and dispatch.

## Login Credentials

| Role   | Email             | Password |
|--------|-------------------|----------|
| Worker | worker@opac.in    | 1234     |
| Admin  | admin@opac.in     | 1234     |

> Admin dashboard (sidebar layout) is **web-only**. On mobile, admin login redirects to the worker dashboard.

---

## Running the App

### Prerequisites
- Node.js 18+
- Install **Expo Go** on your phone from the Play Store (Android) or App Store (iOS)

### Install dependencies
```bash
npm install --legacy-peer-deps
```

### Start the dev server
```bash
npx expo start
```

### On your phone (Expo Go)
1. Make sure your phone and PC are on the **same Wi-Fi network**
2. Open Expo Go and scan the QR code shown in the terminal
3. If the QR code doesn't connect (firewall issues), use tunnel mode:
   ```bash
   npx expo start --tunnel
   ```

### Android emulator
```bash
npx expo start --android
```

### iOS simulator (Mac only)
```bash
npx expo start --ios
```

### Web (admin portal)
```bash
npx expo start --web
# or press 'w' after starting
```
Then open `http://localhost:8081` in your browser and log in with `admin@opac.in / 1234`.

---

## File Structure

```
app/
  index.tsx              # Auth redirect (worker → dashboard, admin → admin)
  _layout.tsx            # Root layout with Toast overlay
  (auth)/login.tsx       # Login screen
  (worker)/              # Mobile worker shell (tab navigation)
    dashboard.tsx        # Home with 3 feature cards
    attendance.tsx       # Mark attendance for 8 employees
    production.tsx       # View product stock
    dispatch.tsx         # Record dispatches
  stock-update/
    [productId].tsx      # Modal: update closing stock + materials used
  (admin)/               # Web-only admin portal (sidebar layout)
    dashboard.tsx        # Stats + recent activity tables
    reports.tsx          # Attendance / Production / Dispatch reports + CSV export

store/
  authStore.ts           # Auth state (user, role), persisted
  attendanceStore.ts     # Attendance records, persisted
  inventoryStore.ts      # Product stock + history, persisted
  dispatchStore.ts       # Dispatch entries, persisted
  uiStore.ts             # Toast notifications (not persisted)

mocks/
  employees.ts           # 8 workers
  products.ts            # 3 products with seeded 14-day history
  rawMaterials.ts        # 5 raw materials
  users.ts               # 2 test accounts

components/
  PrimaryButton, SecondaryButton, PillButton
  TextField, Badge, PolymerBadge
  TopBar, Toast, EmptyState, Card

lib/
  date.ts      # todayISO, formatDateReadable, getGreeting, relativeTime
  units.ts     # bagsToKg, formatBagsKg (1 bag = 25 kg)
  storage.ts   # Typed AsyncStorage helpers
  utils.ts     # generateId
```

---

## Reset Seed Data

To clear all persisted data and start fresh, clear AsyncStorage from the app.
On web: open DevTools → Application → Local Storage → delete all `opac-*` keys.
On device: uninstall and reinstall the Expo Go app (or clear app data).
