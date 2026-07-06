# CETE ASC-Funnel — Deploy & Tracking (Schritt für Schritt)

Dieser Ordner ist **fertig zum Hochladen**. Er enthält die 4 Funnel-Seiten (LP + Pre-Sell v1/v2/v3),
die Assets und die Server-Funktion `api/lead.js`, die den Lead an n8n weiterleitet und das
Meta-CAPI-`Lead` serverseitig feuert.

Pixel-ID ist bereits im Code eingetragen: **1765163127144487** (auf allen 4 Seiten).
`leadEndpoint` steht auf `/api/lead` — funktioniert automatisch, sobald das hier auf Vercel liegt.

Reihenfolge: **A) n8n-Webhook → B) Meta-CAPI-Token → C) Vercel-Deploy (+ Env-Variablen) → D) Testen.**

---

## A) n8n-Webhook anlegen (das Lead-„Postfach")

Ziel: eine URL, die den Lead entgegennimmt und an CETE mailt (oder in ein Sheet schreibt).

1. n8n öffnen (Zugang siehe `_Strategie/ABOS_UND_ZUGAENGE.md`).
2. Neuen Workflow anlegen → Node **„Webhook"** hinzufügen.
   - HTTP-Method: **POST**
   - Path: z. B. `cete-lead`
3. Danach frei wählbar, was mit dem Lead passiert — z. B. Node **„Send Email"** (an das CETE-Team)
   und/oder **„Google Sheets → Append Row"**. Die Felder im Body sind:
   `email, phone, brand, model, year, air, src, source, ts, event_id, page_url`.
4. Workflow **aktivieren** (Toggle oben rechts) und die **Production-URL** des Webhooks kopieren.
   Die brauchen wir in Schritt C als `N8N_WEBHOOK_URL`.

> Hinweis: Die n8n-URL bleibt serverseitig (die Vercel-Funktion ruft sie auf). Der Browser sieht sie
> nie — deshalb ist das http/https-Mixed-Content-Problem hier gelöst.

---

## B) Meta Conversions-API-Token holen

1. **Events Manager** öffnen → euer Datensatz **„Cete Automotive GmbHs …" (1765163127144487)**.
2. **Einstellungen** (Settings) → runter zu **Conversions API** → **Zugriffstoken generieren**
   („Generate access token").
3. Den Token kopieren (langer Zeichen-String). Das ist `META_CAPI_TOKEN` in Schritt C.
   **Geheim halten** — nicht in den Code, nur als Vercel-Env-Variable.

---

## C) Auf Vercel deployen + Env-Variablen setzen

**Einfachster Weg (ohne Git):**

1. Auf <https://vercel.com> mit E-Mail/GitHub anmelden (kostenlos).
2. Vercel-CLI installieren und aus **diesem Ordner** deployen:
   ```
   npm i -g vercel
   cd <Pfad-zu-diesem-deploy-Ordner>
   vercel        # einmal einloggen + Projekt anlegen (Fragen mit Enter bestätigen)
   ```
3. Env-Variablen setzen (einmalig), dann Production-Deploy:
   ```
   vercel env add N8N_WEBHOOK_URL      # Webhook-URL aus Schritt A einfügen
   vercel env add META_PIXEL_ID        # 1765163127144487
   vercel env add META_CAPI_TOKEN      # Token aus Schritt B
   vercel --prod
   ```
   (Bei jeder `env add`-Frage „Production" auswählen.)
4. Vercel gibt dir eine `https://…vercel.app`-Adresse zurück. Das sind die **Live-Links** für die Ads.

**Alternative (Web-Oberfläche):** GitHub-Repo mit diesem Ordner anlegen → auf vercel.com
„Add New Project" → Repo importieren → unter **Settings → Environment Variables** die 3 Variablen
eintragen → Deploy.

---

## D) Testen (bevor Ads laufen)

1. **Meta Pixel Helper** (Chrome-Extension) installieren, Live-Seite öffnen → Cookie-Banner „Ja".
   Er sollte `PageView`, `ViewContent`, beim Scrollen `SectionView`/`ScrollDepth`, beim
   Weiter-Klick `ClickToOffer`, auf der LP `ReachedAngebot` und beim Absenden `Lead` zeigen.
2. **Events Manager → Test Events**: Test-Lead absenden → es müssen **zwei** Lead-Signale kommen,
   eines „Browser", eines „Server", zusammengeführt über die gleiche `event_id` (Dedup).
   Kommt nur „Browser", stimmt `META_CAPI_TOKEN`/`META_PIXEL_ID` nicht.
3. **n8n**: im Workflow unter „Executions" prüfen, dass der Test-Lead ankam und die Mail/Sheet-Aktion lief.
4. Browser-Konsole zeigt zusätzlich jedes Event als `[CETE track] …` — praktisch zum Mitlesen.

---

## Was schon erledigt ist
- Pixel-ID auf allen 4 Seiten eingetragen.
- Checkpoint-Events (SectionView, CP-Namen aus den Analyse-Karten) auf LP + Pre-Sell v2 gebaut.
- Lead-Dedup (Browser-`eventID` == Server-`event_id`) verdrahtet.
- `leadEndpoint = /api/lead` gesetzt.

## Offen (nicht Code — braucht dich/CETE)
- n8n-Webhook-URL (A), CAPI-Token (B), Vercel-Env-Variablen (C).
- Mit CETE final abstimmen, **wo** der Lead landen soll (Mail-Adresse / Sheet / CRM).
- Checkpoint-Events für Pre-Sell v1 + v3 (nur nötig, wenn die auch getestet werden).
