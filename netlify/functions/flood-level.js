// netlify/functions/flood-level.js
//
// Live flood status for the Jhelum near Ram Munshi Bagh, Srinagar.
// Tries the "official" CWC gauge via Google Flood Hub first (needs a
// waitlisted GOOGLE_FLOOD_API_KEY), then falls back to Open-Meteo's
// keyless GloFAS river-discharge feed — which is genuinely live right
// now, no key or waitlist needed. Only if BOTH fail does the frontend
// fall back to the labelled demo reading in assets/data.js. See
// lib/flood-sources.js for the honesty notes on each source.

const { fetchGoogleFloodHub, fetchOpenMeteoFlood } = require('../../lib/flood-sources');

exports.handler = async function (event) {
  const q = event.queryStringParameters || {};
  const gaugeId = q.gaugeId || 'CWC_005-JHELUM';
  const lat = parseFloat(q.lat) || 34.0631;
  const lon = parseFloat(q.lon) || 74.8344;
  const API_KEY = process.env.GOOGLE_FLOOD_API_KEY;

  if (API_KEY) {
    try {
      const payload = await fetchGoogleFloodHub(gaugeId, API_KEY);
      if (payload) {
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=900' },
          body: JSON.stringify(payload)
        };
      }
    } catch (err) { /* fall through to the keyless GloFAS feed below */ }
  }

  try {
    const payload = await fetchOpenMeteoFlood(lat, lon);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600' },
      body: JSON.stringify(payload)
    };
  } catch (err) {
    return {
      statusCode: 502,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: String(err) })
    };
  }
};
