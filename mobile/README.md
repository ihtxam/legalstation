# LexFlow Mobile (React Native / Expo)

One Android & iOS app for **law firm staff** and **clients**, with role-based navigation after login.

| Role | Tabs |
|------|------|
| Firm (`admin` / `subadmin` / `lawyer` / `assistant`) | Home · Cases · Clients · Invoices · More |
| Client | My cases · Invoices · Profile |
| Platform superadmin | Overview · Firms · Leads · Account |

Clients can open a case, **scan documents with the camera**, pick photos/files, and message their lawyer. Staff see firm-wide (or assigned) cases according to LexFlow capabilities. Superadmins sign in with the same screen — the app retries `portal=platform` automatically.

## Prerequisites

- Node 22+
- [Expo Go](https://expo.dev/go) on a phone, or Android Studio / Xcode for simulators
- Running LexFlow API (local or production)

## Configure API URL

Default production host is set in `app.json` → `extra.apiUrl`.

Override at runtime:

```bash
export EXPO_PUBLIC_API_URL=http://YOUR_LAN_IP:3000
npm start
```

Use your machine’s LAN IP (not `localhost`) when testing on a physical device.

## Run

```bash
cd mobile
npm install --legacy-peer-deps
npm start
# then press `a` (Android), `i` (iOS), or scan the QR with Expo Go
```

## Auth

1. `POST /api/auth/login` returns `sessionToken` (JWT).
2. The app stores it in Secure Store and sends `Authorization: Bearer …` on tRPC + uploads.
3. Role routing: `auth.me.role === "superadmin"` → platform; else `firm.myFirm` → firm; else client.

## Document scan / upload

1. Camera or file picker → local URI  
2. `POST /api/upload` (multipart)  
3. `documents.register` via tRPC  

## Project layout

```
mobile/
  app/                 Expo Router screens
    (firm)/            Staff tabs
    (client)/          Client tabs
    login.tsx
  src/
    api/               tRPC + login + upload
    auth/              Session + AuthContext
    components/        UI + DocumentUploader
```

## Native builds (store)

```bash
npx expo prebuild
npx expo run:android
npx expo run:ios
```

Or use [EAS Build](https://docs.expo.dev/build/introduction/) with `eas build -p android|ios`.
