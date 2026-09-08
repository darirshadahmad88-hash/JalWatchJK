// netlify/functions/soil-moisture.js
//
// Live root-zone soil moisture, for apple districts (Shopian, Sopore,
// Pulwama). Source: NASA POWER's GWETROOT parameter — root-zone soil
// wetness derived from NASA's GMAO MERRA-2 reanalysis model. This is a
// genuinely free, keyless, real-time NASA data product; it is NOT raw
// SMAP satellite retrieval (SMAP itself requires an Earthdata login and
// heavier processing), so it's labeled accurately rather than called
// "SMAP" in the UI. Docs: https://power.larc.nasa.gov/docs/services/api/
//
// No environment variables required — NASA POWER needs no API key.

exports.handler = async function (event) {
  const lat = parseFloat(event.queryStringParameters && event.queryStringParameters.lat);
  const lon = parseFloat(event.queryStringParameters && event.queryStringParameters.lon);

  if (Number.isNaN(lat) || Number.isNaN(lon)) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'lat and lon query params are required' })
    };
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
      return {
        statusCode: 502,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: `Upstream API returned ${upstream.status}` })
      };
    }
    const data = await upstream.json();
    const series = (data && data.properties && data.properties.parameter && data.properties.parameter.GWETROOT) || {};
    const entries = Object.entries(series)
      .filter(([, v]) => typeof v === 'number' && v > -900) // NASA POWER fills gaps with -999
      .sort((a, b) => a[0].localeCompare(b[0]));

    if (!entries.length) {
      return {
        statusCode: 502,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'No recent GWETROOT data returned for this point' })
      };
    }

    const [dateStr, wetnessFraction] = entries[entries.length - 1];

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=21600' // 6h — updates roughly daily upstream
      },
      body: JSON.stringify({
        source: 'NASA POWER (GWETROOT, root-zone soil wetness, MERRA-2 reanalysis)',
        date: `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`,
        root_zone_wetness_fraction: wetnessFraction,
        root_zone_wetness_pct: +(wetnessFraction * 100).toFixed(1)
      })
    };
  } catch (err) {
    return {
      statusCode: 502,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: String(err) })
    };
  }
};
