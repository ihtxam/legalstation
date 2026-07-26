# Calendar integrations (Google · Outlook · iCloud)

Per-user two-way sync between Cliavo agenda items and external calendars.

## What syncs

**Cliavo → external (push)**  
- Case deadlines  
- Case tasks (assigned/created by you)  
- Client activities / meetings  
- Personal agenda events created in Cliavo  

**External → Cliavo (pull)**  
- Events from the connected calendar appear on **Agenda** (not duplicated if Cliavo already pushed them)

## Connect

1. Open **Settings → Calendar**  
2. Connect a provider:  
   - **Google** / **Outlook**: OAuth (server env credentials required)  
   - **iCloud**: Apple ID + [app-specific password](https://support.apple.com/en-us/HT204397)  
3. Choose sync direction: two-way, push-only, or pull-only  
4. Use **Sync now**, or schedule `POST /api/scheduled/calendar-sync`

## Server env

```bash
GOOGLE_CALENDAR_CLIENT_ID=
GOOGLE_CALENDAR_CLIENT_SECRET=
# Redirect: {APP_URL}/api/oauth/calendar/google/callback

MICROSOFT_CALENDAR_CLIENT_ID=
MICROSOFT_CALENDAR_CLIENT_SECRET=
MICROSOFT_CALENDAR_TENANT=common
# Redirect: {APP_URL}/api/oauth/calendar/microsoft/callback
```

Tokens are stored encrypted (AES-GCM) using `JWT_SECRET`.

## Migration

Apply `drizzle/0017_calendar_sync.sql` (or `pnpm db:push`).
