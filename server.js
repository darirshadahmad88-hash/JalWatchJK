# Jal Watch — Water Stress Early Warning (J&K)

A site pitching a water-stress early-warning tool for Jammu & Kashmir's
saffron and apple economy: it lines up CGWB groundwater telemetry against
Agmarknet mandi price history to give officials and farmers a lead-time signal.

**Which signal for which crop:** saffron corms sit close to the aquifer, so
Pampore's index still runs on DWLR depth-to-water. Apple orchards in Kashmir
are largely rain-fed — growers and agronomists report they respond to
root-zone soil moisture and winter snowpack, not the water table directly —
so Shopian, Sopore, and Pulwama are scored on a soil-moisture series instead.
See methodology step 1 on the page.

**What's real vs. demo, honestly:**
- **Mandi prices** — genuinely live once you add a free API key (steps below).
  A small serverless function fetches the latest reported price per market
  from the real Agmarknet dataset on data.gov.in.
- **Groundwater (DWLR)** — still demo data. India-WRIS has no stable public
  API, so making this live needs a manual browser-devtools capture step
  (see "Making the data real" below) that only a human can do interactively.
- **Soil moisture** — the *current reading* shown next to the chart title is
  now genuinely live, pulled from NASA POWER's `GWETROOT` parameter (root-zone
  soil wetness, no API key needed — see `/api/soil-moisture` in
  `server.js`/`netlify/functions/soil-moisture.js`). One honest caveat: this
  is a MERRA-2 *reanalysis* product (model + satellite + station data
  blended), not a raw SMAP satellite retrieval — SMAP itself needs a NASA
  Earthdata login and heavier processing, so POWER is the practical
  free/live substitute, not literally "SMAP data." The *historical trend
  line* in the chart is still demo, derived from the demo rainfall series
  (`soilMoistureFromRainfall` in `assets/data.js`) — same asymmetry as the
  price chart (live latest value, illustrative history).
- The historical trend lines in all three series are illustrative either
  way — the live pieces are the "latest reported price" line under the price
  chart, the live-soil-moisture badge next to the water/soil chart title,
  and the live/demo badge next to the stress index.

No build step for the frontend itself — plain HTML/CSS/JS + Chart.js from a
CDN. The live-price feature needs one small serverless function (Netlify) or
a tiny Node server (Render) — both are included and already wired up.

## File structure

```
jk-water-watch/
├── index.html                  # the whole site: hero, overview, dashboard, methodology, sources
├── assets/
│   ├── styles.css
│   ├── data.js                 # demo data (water levels + historical trend) — swap for a real feed later
│   └── app.js                  # chart rendering + live-price fetch
├── netlify/functions/
│   └── mandi-prices.js         # serverless proxy to the Agmarknet API (Netlify path)
├── server.js                   # Express server exposing the same API (Render/Node path)
├── package.json                # only needed for the Render/Node path
├── scripts/
│   └── ingestion_starter.py    # Python scaffold for the WRIS/groundwater side
├── netlify.toml                # functions + /api redirect + headers
├── render.yaml
└── README.md
```

Both deploy paths expose the **same** endpoint — `/api/mandi-prices` — so
`assets/app.js` doesn't need to know which platform it's on.

## Run it locally

No build tools needed. Either:

```bash
# Python's built-in server
python3 -m http.server 8000
# then open http://localhost:8000
```

or just open `index.html` directly in a browser (Chart.js loads from a CDN,
so you need internet access either way).

## Get a data.gov.in API key first (2 minutes)

The live-price feature needs a free key:
1. Register at [data.gov.in/user/register](https://data.gov.in/user/register)
2. Once logged in, go to "My Account" → "API Keys" and copy your key
3. You'll paste this into an environment variable in whichever platform you deploy to — never commit it into the code

Without this key set, the site still works fine — the badge just shows
"Demo price data" and the charts run on the bundled sample values.

## Deploy to Netlify (drag-and-drop still works, plus the live function)

**Drag-and-drop:**
1. Go to [app.netlify.com/drop](https://app.netlify.com/drop) and drag the
   `jk-water-watch` folder onto the page — you get a live URL immediately
2. To enable live prices: Site settings → Environment variables → add
   `DATA_GOV_IN_API_KEY` with your key → trigger a redeploy (drag the folder
   again, or use "Deploys" → "Trigger deploy")

**From a Git repo (recommended once you want the function working smoothly):**
1. Push this folder to a GitHub repo
2. In Netlify: "Add new site" → "Import an existing project" → pick the repo
3. Build command: leave blank. Publish directory: `.` — `netlify.toml`
   already points Netlify at the `netlify/functions` folder
4. Site settings → Environment variables → add `DATA_GOV_IN_API_KEY`
5. Deploy. The badge on the dashboard should flip to "● Live from Agmarknet"
   for markets the API returns data for

## Deploy to Render

The static-site path (no live prices) works exactly as before: New → Static
Site → publish directory `.`.

**For the live-price version, deploy as a Web Service instead** (Render's
static sites can't run server code):
1. Push this folder to a GitHub repo
2. In Render: "New" → "Web Service" → connect the repo
3. Build command: `npm install`. Start command: `node server.js`
4. Environment → add `DATA_GOV_IN_API_KEY`
5. Deploy — `server.js` serves the static site *and* `/api/mandi-prices`

Either platform redeploys automatically on every push once connected.

## Flood Watch widget (top-right corner)

A small floating widget, separate from the crop-water-stress dashboard,
tracks flood risk on the Jhelum at Ram Munshi Bagh (Srinagar) — the
opposite signal from the rest of the site (too much water, not too
little), so it's kept as its own module rather than folded into the
`DISTRICTS` stress score.

- **What it shows:** a Normal / Watch / Alert / Danger status pill
  (mapped from the gauge's flood severity), a rising/falling/steady
  trend, and the gauge's warning/danger/extreme threshold levels for
  context.
- **Source:** Google Flood Hub's Flood Forecasting API
  (`floodforecasting.googleapis.com`), which republishes CWC's own
  gauge for this station (gauge id `CWC_005-JHELUM`). It's free and
  public, but currently requires joining a waitlist to get an API key
  — see [developers.google.com/flood-forecasting](https://developers.google.com/flood-forecasting).
- **Without a key set:** the widget shows a clearly labelled "Demo
  flood data" reading (a calm, non-alarming Normal status) rather than
  guessing — same honesty pattern as the rest of this project.
- **To make it live:** once approved, set `GOOGLE_FLOOD_API_KEY` as an
  environment variable (same place as `DATA_GOV_IN_API_KEY`) on
  Netlify or Render and redeploy. The endpoint is `/api/flood-level`,
  wired up identically on both platforms
  (`netlify/functions/flood-level.js` / the route in `server.js`).
- **What's deliberately not included:** live NH44 road/traffic status.
  There's no public dataset or API for this — closures are announced
  via J&K Traffic Police's social media posts, which aren't reliably
  scrapeable or structured. Rather than fake a status, the widget
  leaves this out; if you want it later, the honest options are a
  manually-updated field or a link out to the traffic police's account.

## Crop health triage widget (bottom-left corner)

A small floating widget where a grower uploads a photo of an apple and
gets a quick first-look triage. **Scoped deliberately as triage +
point-to-a-human, not diagnosis or prescription:**

- **What it does:** sends the photo to a vision-capable Claude model
  (`lib/crop-triage.js`) with a system prompt that returns, as strict
  JSON: an overall confidence (low/medium/high), up to 3 plausible
  plain-language issue names, up to 4 general cultural-practice
  suggestions, and a one-line caveat if the photo is ambiguous.
- **What it will never do, by design:** name a specific pesticide,
  fungicide, or fertilizer product/active ingredient, or give a
  dosage/mixing ratio/application timing. That's a real agronomic
  recommendation — getting it wrong from a single fruit photo could
  cause real crop or health harm, so the system prompt hard-bans it
  and the UI always appends a static pointer to a real Krishi Vigyan
  Kendra (KVK) / the Kisan Call Centre (1800-180-1551) instead.
- **The water-stress line is not the model's guess.** When the result
  card mentions "this district is currently in the 'stress'/'watch'
  band," that's read directly from this project's own `DISTRICTS`
  index — the same deterministic score driving the main dashboard —
  never generated by the vision model.
- **Source:** the Anthropic Messages API
  (`api.anthropic.com/v1/messages`), called server-side so the key
  never reaches the browser.
- **Without a key set:** returns a clearly labelled demo response
  (`mode: "demo"`) rather than silently pretending to have analyzed
  the photo — same honesty pattern as every other live/demo feed on
  this page.
- **To make it live:** set `ANTHROPIC_API_KEY` (get one at
  [console.anthropic.com](https://console.anthropic.com)) as an
  environment variable on Netlify or Render and redeploy. Optionally
  set `ANTHROPIC_MODEL` to override the default model. The endpoint is
  `/api/crop-triage`, wired up on both platforms
  (`netlify/functions/crop-triage.js` / the route in `server.js`).
- **Real limitation worth stating up front:** a single fruit photo
  often isn't enough to tell fungal disease, pest damage, and nutrient
  deficiency apart — that's exactly why this is framed as low-stakes
  triage with a human pointer at the end, not a standalone answer.

## Dashboard features

- **Map view** — a live Leaflet map (dark CARTO tiles, no API key needed)
  with a marker per district; click a marker to select that district.
- **Search box** — filters the district list by name or crop as you type.
- **Compare mode** — check "Compare with another district" and pick a
  second one; both charts overlay a dashed second line for it.
- **Date-range slider** — drag either handle to zoom the charts into a
  sub-range of the 36-month history.
- **Export CSV** — downloads the currently visible range (and both
  districts, if compare mode is on) as a CSV file.

All five read from the same `DISTRICTS` array in `assets/data.js`, so once
you swap in real groundwater data, every feature above works on it
automatically — no extra wiring needed.

## Making the rest of the data real

**Mandi prices are wired up already** (see above) — once your API key is
set, that half is live.

**Groundwater is still the piece to finish:**
1. India-WRIS doesn't have a stable, documented public API. The DWLR data
   is reachable because the portal's own frontend calls internal endpoints
   — open your browser's devtools Network tab while selecting Jammu &
   Kashmir → a district → a DWLR station on indiawris.gov.in, capture the
   actual request, and replicate it with Python's `requests` (see
   `scripts/ingestion_starter.py` for the shape this should take). Several
   open-source "WRIS extractor" scrapers on GitHub show working examples of
   this request sequence.
2. Once you can pull real readings, either (a) add a second API route
   (`/api/groundwater`, same pattern as `mandi-prices.js`) if you want it
   live on page load, or (b) run a scheduled script that regenerates
   `assets/data.js` with real values daily — simpler, and often good enough
   for a demo. Keep the same object shape so `assets/app.js` doesn't need
   to change.

**Soil moisture — the current reading is done; the historical chart is what's left:**
1. `/api/soil-moisture` (in `server.js` and `netlify/functions/soil-moisture.js`)
   already pulls the live current reading from NASA POWER's `GWETROOT`
   parameter — no API key needed, nothing to set up. `loadLiveSoilMoisture()`
   in `assets/app.js` calls it whenever you select an apple district and
   shows the result next to the chart title.
2. What's still demo: the *historical trend line* in the chart itself, which
   comes from `soilMoistureFromRainfall(...)` in `assets/data.js`. NASA
   POWER's daily/monthly point API can backfill this too (it has data back
   to 1981) — pull a year or two of `GWETROOT` per district and replace the
   `soilMoisture` array with real values, same shape (percent, one value per
   month), so `assets/app.js` doesn't need to change.
3. If you want true SMAP satellite retrievals instead of the MERRA-2
   reanalysis POWER serves, that means a NASA Earthdata login and heavier
   processing (or ISRO Bhuvan's soil-moisture layer as an India-specific
   alternative) — POWER was chosen here specifically because it needs
   neither.

**One honesty note on the resource ID:** the Agmarknet resource id baked
into `mandi-prices.js` and `server.js` is the one commonly published for
this dataset, but data.gov.in occasionally reissues resource ids — if the
live badge won't go green, the first thing to check is whether that id
still matches the current one listed on the dataset's page on data.gov.in.

## Honesty note for judges

The site is careful to frame this as a **decision-support signal**, not a
price prediction model — the historical sample size (a handful of comparable
seasons per district) doesn't support a real forecasting claim. If asked,
that's the correct answer to give.
