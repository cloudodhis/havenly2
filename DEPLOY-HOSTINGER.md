# Deploying Havenly to Hostinger

Havenly is a Vite + React single-page app. The backend is **Firebase** (auth,
Firestore, storage). The only Node process you run is [`server.js`](server.js),
which:

- serves the built static files from `dist/` with SPA fallback routing, and
- proxies Gemini AI calls (`/api/ai/*`) so the **`GEMINI_API_KEY` stays on the
  server** and is never shipped to the browser.

## Environment variables — two kinds, two lifetimes

**1. Build-time (baked into the browser bundle by `npm run build`).**
These are public client IDs; it's fine that they ship to the browser. Lock them
to your domain in their respective consoles.

```
VITE_GOOGLE_MAPS_API_KEY="your-maps-key"
VITE_PAYPAL_CLIENT_ID="your-paypal-client-id"
```

They must be present in a `.env` (or the shell) **wherever you run
`npm run build`**.

**2. Runtime (read by `server.js` when it starts — kept secret).**

```
GEMINI_API_KEY="your-gemini-key"
```

Set this on the **server**, either via a `.env` file in the project root
(`server.js` loads it with dotenv) or via Hostinger's Node.js environment-
variable panel. It is *not* baked into the build, so the browser never sees it.

> Copy `.env.example` to `.env` and fill in the values. `.env` is gitignored.

---

## Option A — Hostinger shared/cloud hosting (Node.js via hPanel)

Requires a plan with the **Node.js** feature (Premium/Business/Cloud).

1. **Build locally** (recommended — secrets never sit on the server bundle):
   ```
   npm install
   npm run build        # needs the two VITE_* vars in .env
   ```
   This produces `dist/`.

2. **Upload** the project to your hosting directory (e.g. `~/havenly`). You need
   at least: `dist/`, `server.js`, `package.json`, `package-lock.json`.

3. In hPanel → **Websites → Node.js** ("Setup Node.js App"):
   - **Application root**: the folder you uploaded to (e.g. `havenly`)
   - **Application startup file**: `server.js`
   - **Node version**: 18 or newer
   - Add an environment variable **`GEMINI_API_KEY`** = your key.
   - Click **Create**, then **Run NPM Install** (installs `express`, `@google/genai`, `dotenv`).

4. Start the app. Passenger sets `process.env.PORT` and maps your domain to it.
   Open your domain to verify. Test an AI feature (e.g. chat moderation) to
   confirm `GEMINI_API_KEY` is wired up.

> Prefer to build *on* the server? Upload everything except `dist/` and
> `node_modules/`, add a full `.env` (both VITE_* and GEMINI_API_KEY), then run
> `npm install && npm run build` over SSH before starting.

---

## Option B — Hostinger VPS (full control, recommended for production)

```bash
# one-time
sudo apt update && sudo apt install -y nodejs npm
sudo npm install -g pm2

# in the project dir, with .env present (VITE_* + GEMINI_API_KEY)
npm install
npm run build

# run + keep alive across reboots
pm2 start server.js --name havenly
pm2 save
pm2 startup
```

Point an Nginx reverse proxy at `http://127.0.0.1:3000`, or set `PORT=80`.
The app listens on `process.env.PORT || 3000`.

---

## Local development

`npm run dev` runs Vite on port 3000. To exercise the AI features locally, also
start the API server on **3001** in a second terminal (Vite proxies `/api` to
it — see `vite.config.ts`):

```powershell
# PowerShell
$env:PORT=3001; npm start
```
```bash
# bash
PORT=3001 npm start
```

`server.js` reads `GEMINI_API_KEY` from `.env`, so make sure it's filled in.

---

## Option C — Static only (NOT recommended now)

You *could* upload just `dist/` to `public_html` with an `.htaccess` SPA
rewrite, but then the `/api/ai/*` endpoints don't exist and the AI features
(chat moderation, conversation analysis) won't work. Use a Node option above.
