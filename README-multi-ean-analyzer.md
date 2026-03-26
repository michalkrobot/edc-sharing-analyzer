# Multi EAN Analyzer

A simple browser app for EDC CSV analysis with support for multiple production EAN.

## Files

- `multi-ean-analyzer.html`
- `multi-ean-analyzer.css`
- `multi-ean-analyzer.js`

## Run

1. Open `multi-ean-analyzer.html` in your browser.
2. Upload your EDC CSV report.
3. Set allocation and cost for each consumer EAN.
4. Use `Simulovat sdileni` or `Najit optimalni alokace`.

## Notes

- Designed for multiple producer EAN (`-D`) and multiple consumer EAN (`-O`).
- Allocation constraints: sum of consumer allocations must be <= 100%.
- Simulation uses all producer energy combined per interval.

## Passwordless Login (email OTP)

IndexedDB for EAN labels remains in the frontend. Authentication is now a separate backend layer.

### Frontend

- `auth-config.js` sets auth options (API base URL, required login flag).
- `auth-client.js` provides passwordless login overlay, session restore from browser storage, and logout.

### Backend

- Folder: `backend/`
- DB: SQLite (`auth.db`), tables: tenants, users, tenant_admins, user_eans, tenant_edc_imports, otp_codes, sessions
- Seeded global admin:
	- `krobot@enerkom-hp.cz`
- Seeded tenant:
	- `Enerkom horní pomoraví`
- Seeded tenant admin:
	- `krobotova@enerkom-hp.cz`
- API endpoints:
	- `POST /api/auth/request-otp` (send one-time code to email)
	- `POST /api/auth/verify-otp` (verify code, return session token)
	- `GET /api/auth/session` (validate stored session)
	- `POST /api/auth/logout` (revoke session)
	- `POST /api/admin/import-members` (admin-only import of `clenove.csv`)
	- `POST /api/admin/import-eans` (admin-only import of `eany.csv` and binding to users)
	- `GET /api/admin/edc-import` (admin-only current tenant EDC import status)
	- `POST /api/admin/import-edc` (admin-only import of the main EDC CSV for the active tenant)
	- `GET /api/member/sharing-data` (member page data from DB, filtered and anonymized server-side)
	- `GET /api/admin/tenants` (global admin only)
	- `POST /api/admin/tenants` (global admin only)

Only seeded admins and imported members can log in. Unknown emails are rejected.

### Multitenant model

- Tenant identifier is the tenant name.
- `krobot@enerkom-hp.cz` is `global_admin`.
- `krobotova@enerkom-hp.cz` is `tenant_admin` for `Enerkom horní pomoraví`.
- Tenant admins can see current settings for their tenant and imports are always assigned to their tenant.
- Global admin can view/edit tenants and assign one or more tenant admins.

### Members import

- Admin-only settings panel is shown only to users with role `global_admin` or `tenant_admin`.
- Members CSV import reads columns:
	- `jmeno clena`
	- `email`
	- `typ`
	- `mesto`
- `email` is used for login identity.
- CSV file can be uploaded in UTF-8 or Windows-1250.
- Tenant admins import members directly into their tenant.
- Global admin imports members into the currently selected tenant.

### EDC import to server

- Admin settings now contain a first-position import card for the main EDC CSV used on the sharing page.
- The uploaded file is validated on the backend with the same CSV structure rules as the sharing parser.
- Data are stored server-side in SQLite and scoped to the active tenant.
- Each tenant has one current EDC dataset; importing again for the same tenant updates the previously stored values.
- Admin settings show filename, import time, covered period, producer count, consumer count, and interval count for the current tenant.

### Member sharing page

- New page: `member-sharing.html`.
- This page does not allow file uploads and loads data from backend DB only.
- Data are filtered according to member-assigned EAN links.
- If member has assigned production EAN, page includes all tenant consumption points.
- If member has assigned consumption EAN, page includes all tenant production points.
- For any EAN that is not assigned to the user, or does not have `public` flag enabled, identity is hidden:
	- label is not shown
	- EAN is masked to first digit + stars + last 4 digits

### EAN import and binding

- Admin settings also support importing `eany.csv`.
- Required columns: `ean`, `jmeno clena` (optional `alias`).
- Optional column: `public` (`1/true/ano/yes` means public).
- Binding is created by member name (`jmeno clena`) to imported user full name within the active tenant.
- UTF-8 and Windows-1250 are both supported.
- In admin settings, imported members are shown as an expandable list with linked EAN detail per person.

### Quick start backend

1. Go to `backend/`
2. `npm install`
3. Create `.env` from `.env.example`
4. Set SMTP credentials for real email delivery
5. `npm start`

If SMTP is not configured, OTP codes are logged to server console (dev fallback).
