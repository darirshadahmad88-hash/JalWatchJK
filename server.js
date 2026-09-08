// server.js
//
// Use this if deploying to Render (or any plain Node host) as a Web Service,
// rather than as a Static Site. It serves the static files AND exposes
// /api/mandi-prices, so assets/app.js works identically on Netlify or Render.
//
// Local run:
//   npm install
//   DATA_GOV_IN_API_KEY=your_key node server.js
//
// Render setup:
//   New -> Web Service -> connect this repo
//   Build command:  npm install
//   Start command:  node server.js
//   Add environment variable DATA_GOV_IN_API_KEY in the Render dashboard

const express = require('express');
const path = require('path');
const { runCropTriage } = require('./lib/crop-triage');

const app = express();
const PORT = process.env.PORT || 3000;
const DEFAULT_RESOURCE_ID = '9ef84268-d588-465a-a308-a864a43d0070';

app.use(express.static(path.join(__dirname)));
// Photos are base64-encoded JSON for the crop-triage endpoint below —
// raise the default body-size limit so a phone photo actually fits.
app.use(express.json({ limit: '12mb' }));

app.get('/api/mandi-prices', async (req, res) => {
  const API_KEY = process.env.DATA_GOV_IN_API_KEY;
  const RESOURCE_ID = process.env.AGMARKNET_RESOURCE_ID || DEFAULT_RESOURCE_ID;

  if (!API_KEY) {
    return res.status(500).json({
      error: "Missing DATA_GOV_IN_API_KEY. Set it as an environment variable."
    });
  }

  const commodity = req.query.commodity || 'Apple';
  const url = `https://api.data.gov.in/resource/${RESOURCE_ID}` +
    `?api-key=${encodeURIComponent(API_KEY)}` +
    `&format=json&limit=200` +
    `&filters[state]=${encodeURIComponent('Jammu and Kashmir')}` +
    `&filters[commodity]=${encodeURIComponent(commodity)}`;

  try {
    const upstream = await fetch(url);
    if (!upstream.ok) {
      return res.status(502).json({ error: `Upstream API returned ${upstream.status}` });
    }
    const data = await upstream.json();
    const records = Array.isArray(data.records) ? data.records : [];

    const latestByMarket = {};
    for (const r of records) {
      const market = r.market;
      if (!market) continue;
      const existing = latestByMarket[market];
      if (!existing || new Date(r.arrival_date) > new Date(existing.arrival_date)) {
        latestByMarket[market] = r;
      }
    }

    res.set('Cache-Control', 'public, max-age=1800');
    res.json({
      commodity,
      fetched_at: new Date().toISOString(),
      markets: Object.values(latestByMarket)
    });
  } catch (err) {
    res.status(502).json({ error: String(err) });
  }
});

// ---------------------------------------------------------------
// Live flood status for the Jhelum near Ram Munshi Bagh, Srinagar.
// Tries the "official" CWC gauge via Google Flood Hub first (needs a
// waitlisted GOOGLE_FLOOD_API_KEY), then falls back to Open-Meteo's
// keyless GloFAS river-discharge feed — which is genuinely live right
// now, no key or waitlist needed. Only if BOTH fail does the frontend
// fall back to the labelled demo reading in assets/data.js. See
// lib/flood-sources.js for the honesty notes on each source.
// ---------------------------------------------------------------
const { fetchGoogleFloodHub, fetchOpenMeteoFlood } = require('./lib/flood-sources');

app.get('/api/flood-level', async (req, res) => {
  const gaugeId = req.query.gaugeId || 'CWC_005-JHELUM';
  const lat = parseFloat(req.query.lat) || 34.0631;
  const lon = parseFloat(req.query.lon) || 74.8344;
  const API_KEY = process.env.GOOGLE_FLOOD_API_KEY;

  if (API_KEY) {
    try {
      const payload = await fetchGoogleFloodHub(gaugeId, API_KEY);
      if (payload) {
        res.set('Cache-Control', 'public, max-age=900'); // 15 min
        return res.json(payload);
      }
    } catch (err) { /* fall through to the keyless GloFAS feed below */ }
  }

  try {
    const payload = await fetchOpenMeteoFlood(lat, lon);
    res.set('Cache-Control', 'public, max-age=3600'); // GloFAS updates ~daily
    return res.json(payload);
  } catch (err) {
    res.status(502).json({ error: String(err) });
  }
});

// ---------------------------------------------------------------
// "Apple health check" photo triage — see lib/crop-triage.js for the
// full scope notes and guardrails (triage only, never a specific
// chemical/dosage recommendation). Falls back to a clearly-labelled
// demo response if ANTHROPIC_API_KEY isn't set, same pattern as the
// other live/demo feeds on this page.
// ---------------------------------------------------------------
app.post('/api/crop-triage', async (req, res) => {
  try {
    const result = await runCropTriage(req.body || {});
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: String(err.message || err) });
  }
});

app.listen(PORT, () => console.log(`Jal Watch running on port ${PORT}`));

// ---------------------------------------------------------------
// Live root-zone soil moisture, for apple districts (Shopian, Sopore,
// Pulwama). Source: NASA POWER's GWETROOT parameter — root-zone soil
// wetness derived from NASA's GMAO MERRA-2 reanalysis model. This is a
// genuinely free, keyless, real-time NASA data product; it is NOT raw
// SMAP satellite retrieval (SMAP itself requires an Earthdata login and
// heavier processing), so we label it accurately rather than call it
// "SMAP" in the UI. Docs: https://power.larc.nasa.gov/docs/services/api/
// ---------------------------------------------------------------
app.get('/api/soil-moisture', async (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lon = parseFloat(req.query.lon);
  if (Number.isNaN(lat) || Number.isNaN(lon)) {
    return res.status(400).json({ error: 'lat and lon query params are required' });
  }

  // Ask for a ~12-day trailing window — MERRA-2 reanalysis typically lags
  // a few days behind real time, so the most recent single day can be
  // missing (-999 fill value); take the latest valid day in the window.
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - 12);
  const fmt = d => d.toISOString().slice(0, 10).replace(/-/g, '');

  const url = `https://power.larc.nasa.gov/api/temporal/daily/point` +
    `?parameters=GWETROOT&community=AG` +
    `&longitude=${lon}&latitude=${lat}` +
    `&start=${fmt(start)}&end=${fmt(end)}&format=JSON`;

  try {
    const upstream = await fetch(url);
    if (!upstream.ok) {
      return res.status(502).json({ error: `Upstream API returned ${upstream.status}` });
    }
    const data = await upstream.json();
    const series = (data && data.properties && data.properties.parameter && data.properties.parameter.GWETROOT) || {};
    const entries = Object.entries(series)
      .filter(([, v]) => typeof v === 'number' && v > -900) // NASA POWER fills gaps with -999
      .sort((a, b) => a[0].localeCompare(b[0]));

    if (!entries.length) {
      return res.status(502).json({ error: 'No recent GWETROOT data returned for this point' });
    }

    const [dateStr, wetnessFraction] = entries[entries.length - 1];
    res.set('Cache-Control', 'public, max-age=21600'); // 6h — updates roughly daily upstream
    res.json({
      source: 'NASA POWER (GWETROOT, root-zone soil wetness, MERRA-2 reanalysis)',
      date: `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`,
      root_zone_wetness_fraction: wetnessFraction,
      root_zone_wetness_pct: +(wetnessFraction * 100).toFixed(1)
    });
  } catch (err) {
    res.status(502).json({ error: String(err) });
  }
});

// ---------------------------------------------------------------
// Live rainfall, for the signal-links dashboard. Same NASA POWER point
// API as /api/soil-moisture, just a different parameter (PRECTOTCORR —
// bias-corrected precipitation, mm/day). Keyless, no setup needed.
// ---------------------------------------------------------------
app.get('/api/rainfall', async (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lon = parseFloat(req.query.lon);
  if (Number.isNaN(lat) || Number.isNaN(lon)) {
    return res.status(400).json({ error: 'lat and lon query params are required' });
  }

  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - 12);
  const fmt = d => d.toISOString().slice(0, 10).replace(/-/g, '');

  const url = `https://power.larc.nasa.gov/api/temporal/daily/point` +
    `?parameters=PRECTOTCORR&community=AG` +
    `&longitude=${lon}&latitude=${lat}` +
    `&start=${fmt(start)}&end=${fmt(end)}&format=JSON`;

  try {
    const upstream = await fetch(url);
    if (!upstream.ok) {
      return res.status(502).json({ error: `Upstream API returned ${upstream.status}` });
    }
    const data = await upstream.json();
    const series = (data && data.properties && data.properties.parameter && data.properties.parameter.PRECTOTCORR) || {};
    const entries = Object.entries(series)
      .filter(([, v]) => typeof v === 'number' && v > -900)
      .sort((a, b) => a[0].localeCompare(b[0]));

    if (!entries.length) {
      return res.status(502).json({ error: 'No recent PRECTOTCORR data returned for this point' });
    }

    const [dateStr, mmPerDay] = entries[entries.length - 1];
    const last7 = entries.slice(-7).map(([, v]) => v);
    const weeklyTotal = +last7.reduce((a, b) => a + b, 0).toFixed(1);

    res.set('Cache-Control', 'public, max-age=21600');
    res.json({
      source: 'NASA POWER (PRECTOTCORR, bias-corrected precipitation)',
      date: `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`,
      mm_per_day: +mmPerDay.toFixed(1),
      mm_last_7_days: weeklyTotal
    });
  } catch (err) {
    res.status(502).json({ error: String(err) });
  }
});
