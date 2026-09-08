// netlify/functions/rainfall.js
//
// Live rainfall, for the signal-links dashboard. Same NASA POWER point API
// as soil-moisture.js, just a different parameter (PRECTOTCORR — bias-
// corrected precipitation, mm/day). No API key required.

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
      return {
        statusCode: 502,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: `Upstream API returned ${upstream.status}` })
      };
    }
    const data = await upstream.json();
    const series = (data && data.properties && data.properties.parameter && data.properties.parameter.PRECTOTCORR) || {};
    const entries = Object.entries(series)
      .filter(([, v]) => typeof v === 'number' && v > -900)
      .sort((a, b) => a[0].localeCompare(b[0]));

    if (!entries.length) {
      return {
        statusCode: 502,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'No recent PRECTOTCORR data returned for this point' })
      };
    }

    const [dateStr, mmPerDay] = entries[entries.length - 1];
    const last7 = entries.slice(-7).map(([, v]) => v);
    const weeklyTotal = +last7.reduce((a, b) => a + b, 0).toFixed(1);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=21600'
      },
      body: JSON.stringify({
        source: 'NASA POWER (PRECTOTCORR, bias-corrected precipitation)',
        date: `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`,
        mm_per_day: +mmPerDay.toFixed(1),
        mm_last_7_days: weeklyTotal
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
