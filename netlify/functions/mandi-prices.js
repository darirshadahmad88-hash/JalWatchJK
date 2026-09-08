// netlify/functions/mandi-prices.js
//
// Server-side proxy for the Agmarknet resource on data.gov.in.
// Keeps the API key out of the browser and normalizes the response to
// "most recent record per market" for a given commodity in J&K.
//
// Required environment variable (set in Netlify: Site settings ->
// Environment variables):
//   DATA_GOV_IN_API_KEY   — your key from https://data.gov.in/user/register
//
// Optional:
//   AGMARKNET_RESOURCE_ID — defaults to the commonly-published resource id
//                           for "Variety-wise Daily Market Prices Data of
//                           Commodity". Confirm the current id on data.gov.in
//                           before relying on this in production — resource
//                           ids are occasionally reissued.

const DEFAULT_RESOURCE_ID = '9ef84268-d588-465a-a308-a864a43d0070';

exports.handler = async function (event) {
  const API_KEY = process.env.DATA_GOV_IN_API_KEY;
  const RESOURCE_ID = process.env.AGMARKNET_RESOURCE_ID || DEFAULT_RESOURCE_ID;

  if (!API_KEY) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Missing DATA_GOV_IN_API_KEY. Set it in your deploy platform\'s environment variables.'
      })
    };
  }

  const commodity = (event.queryStringParameters && event.queryStringParameters.commodity) || 'Apple';

  const url = `https://api.data.gov.in/resource/${RESOURCE_ID}` +
    `?api-key=${encodeURIComponent(API_KEY)}` +
    `&format=json&limit=200` +
    `&filters[state]=${encodeURIComponent('Jammu and Kashmir')}` +
    `&filters[commodity]=${encodeURIComponent(commodity)}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      return {
        statusCode: 502,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: `Upstream API returned ${res.status}` })
      };
    }
    const data = await res.json();
    const records = Array.isArray(data.records) ? data.records : [];

    // Collapse to the single most recent record per market.
    const latestByMarket = {};
    for (const r of records) {
      const market = r.market;
      if (!market) continue;
      const existing = latestByMarket[market];
      if (!existing || new Date(r.arrival_date) > new Date(existing.arrival_date)) {
        latestByMarket[market] = r;
      }
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=1800' // cache 30 min — this is a daily-updated dataset
      },
      body: JSON.stringify({
        commodity,
        fetched_at: new Date().toISOString(),
        markets: Object.values(latestByMarket)
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
