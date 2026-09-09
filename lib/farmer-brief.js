// lib/farmer-brief.js
//
// Aggregates every indicator on the dashboard into one flat JSON object
// for a single district, plus a ready-to-send Telegram message string —
// built specifically so a scheduler like n8n can hit one URL and forward
// the result straight to a farmer, no extra formatting step needed.
//
// Reuses the same DISTRICTS data and live-source helpers as the rest of
// the site (assets/data.js, lib/flood-sources.js) rather than duplicating
// logic, so this endpoint stays honest to the same live/demo pattern
// documented in README.md.
//
// Required env vars (all optional — each falls back to labelled demo
// data if unset, same as every other endpoint on this site):
//   DATA_GOV_IN_API_KEY   — live mandi prices
//   GOOGLE_FLOOD_API_KEY  — official CWC flood gauge (else keyless
//                           Open-Meteo/GloFAS fallback is used, which is
//                           genuinely live already)

const { DISTRICTS, FLOOD_WATCH } = require('../assets/data.js');
const { fetchGoogleFloodHub, fetchOpenMeteoFlood } = require('./flood-sources');

const DEFAULT_AGMARKNET_RESOURCE_ID = '9ef84268-d588-465a-a308-a864a43d0070';

const STRESS_LABELS = {
  stress: { emoji: '🔴', label: 'STRESS' },
  watch: { emoji: '🟡', label: 'WATCH' },
  normal: { emoji: '🟢', label: 'NORMAL' }
};

function findDistrict(districtId) {
  const id = String(districtId || '').trim().toLowerCase();
  return DISTRICTS.find(d => d.id === id || d.name.toLowerCase().includes(id)) || null;
}

// Latest mandi price for a district's crop. Tries the live Agmarknet feed
// first (same resource + filters as /api/mandi-prices); falls back to the
// district's own bundled demo series if no key is set or the market isn't
// in the day's Agmarknet return.
async function getMandiPrice(district) {
  const apiKey = process.env.DATA_GOV_IN_API_KEY;
  const demoValue = district.price[district.price.length - 1];
  const demoResult = {
    mode: 'demo',
    commodity: district.crop,
    market: district.name,
    modal_price: demoValue,
    unit: 'Rs per quintal',
    arrival_date: null
  };

  if (!apiKey) return demoResult;

  const resourceId = process.env.AGMARKNET_RESOURCE_ID || DEFAULT_AGMARKNET_RESOURCE_ID;
  const url = `https://api.data.gov.in/resource/${resourceId}` +
    `?api-key=${encodeURIComponent(apiKey)}` +
    `&format=json&limit=200` +
    `&filters[state]=${encodeURIComponent('Jammu and Kashmir')}` +
    `&filters[commodity]=${encodeURIComponent(district.crop)}`;

  try {
    const res = await fetch(url);
    if (!res.ok) return demoResult;
    const data = await res.json();
    const records = Array.isArray(data.records) ? data.records : [];
    // Prefer a record whose market name overlaps this district's name;
    // otherwise just take the most recent record for the crop statewide.
    const districtTown = district.name.split(',')[0].trim().toLowerCase();
    const matches = records.filter(r => (r.market || '').toLowerCase().includes(districtTown));
    const pool = matches.length ? matches : records;
    if (!pool.length) return demoResult;

    const latest = pool.reduce((a, b) => (new Date(b.arrival_date) > new Date(a.arrival_date) ? b : a));
    return {
      mode: 'live',
      commodity: district.crop,
      market: latest.market || district.name,
      modal_price: Number(latest.modal_price) || demoValue,
      unit: 'Rs per quintal',
      arrival_date: latest.arrival_date || null
    };
  } catch (err) {
    return demoResult;
  }
}

// Root-zone soil moisture for apple districts (live, NASA POWER GWETROOT —
// same source as /api/soil-moisture). Saffron (Pampore) doesn't use this;
// it returns its demo groundwater/DWLR reading instead — see README
// "Which signal for which crop".
async function getWaterSignal(district) {
  if (district.crop !== 'Apple') {
    return {
      type: 'groundwater',
      mode: 'demo',
      source: 'CGWB DWLR (demo — see README)',
      value: district.water[district.water.length - 1],
      unit: 'm below ground level'
    };
  }

  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - 12);
  const fmt = d => d.toISOString().slice(0, 10).replace(/-/g, '');
  const url = `https://power.larc.nasa.gov/api/temporal/daily/point` +
    `?parameters=GWETROOT&community=AG` +
    `&longitude=${district.lon}&latitude=${district.lat}` +
    `&start=${fmt(start)}&end=${fmt(end)}&format=JSON`;

  const demoValue = district.soilMoisture ? district.soilMoisture[district.soilMoisture.length - 1] : null;

  try {
    const upstream = await fetch(url);
    if (!upstream.ok) throw new Error(`Upstream ${upstream.status}`);
    const data = await upstream.json();
    const series = (data && data.properties && data.properties.parameter && data.properties.parameter.GWETROOT) || {};
    const entries = Object.entries(series)
      .filter(([, v]) => typeof v === 'number' && v > -900)
      .sort((a, b) => a[0].localeCompare(b[0]));
    if (!entries.length) throw new Error('No recent GWETROOT data');

    const [, wetnessFraction] = entries[entries.length - 1];
    return {
      type: 'soil_moisture',
      mode: 'live',
      source: 'NASA POWER (GWETROOT, root-zone soil wetness)',
      value: +(wetnessFraction * 100).toFixed(1),
      unit: '% root-zone wetness'
    };
  } catch (err) {
    return {
      type: 'soil_moisture',
      mode: 'demo',
      source: 'Modelled from demo rainfall series (see README)',
      value: demoValue,
      unit: '% root-zone wetness'
    };
  }
}

// Site-wide flood status (Jhelum @ Ram Munshi Bagh) — same fallback chain
// as /api/flood-level: official gauge -> keyless GloFAS -> labelled demo.
async function getFloodStatus() {
  const apiKey = process.env.GOOGLE_FLOOD_API_KEY;

  if (apiKey) {
    try {
      const payload = await fetchGoogleFloodHub(FLOOD_WATCH.gaugeId, apiKey);
      if (payload) return payload;
    } catch (err) { /* fall through */ }
  }

  try {
    return await fetchOpenMeteoFlood(FLOOD_WATCH.lat, FLOOD_WATCH.lon);
  } catch (err) {
    return {
      source: 'Demo flood data (see README)',
      mode: 'demo',
      severity: FLOOD_WATCH.demo.severity,
      trend: FLOOD_WATCH.demo.trend,
      currentValue: FLOOD_WATCH.demo.currentLevel,
      issuedTime: new Date().toISOString()
    };
  }
}

// Escapes the handful of characters that matter to Telegram's HTML
// parse_mode. HTML mode is used instead of legacy Markdown because
// Markdown treats bare "_" and "*" characters (which show up naturally in
// values like "NO_FLOODING" or district/commodity names) as formatting
// tokens, silently mangling the message. HTML only cares about &, <, >.
function esc(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatTelegramMessage({ district, waterSignal, mandiPrice, floodStatus, asOf }) {
  const stress = STRESS_LABELS[district.status] || STRESS_LABELS.normal;

  const waterLabel = waterSignal.type === 'soil_moisture' ? 'Soil Moisture' : 'Groundwater Level';
  const waterValue = waterSignal.type === 'soil_moisture'
    ? `${waterSignal.value ?? 'n/a'}%`
    : `${waterSignal.value ?? 'n/a'} m BGL`;
  const waterTag = waterSignal.mode === 'demo' ? 'Demo' : 'Live';

  const priceTag = mandiPrice.mode === 'demo' ? 'Demo' : `Live, ${esc(mandiPrice.market)}`;

  // Raw severity codes like "NO_FLOODING" read poorly and break legacy
  // Markdown; present them as clean title case instead.
  const floodSeverity = String(floodStatus.severity || 'Unknown')
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase());
  const floodTag = floodStatus.mode === 'demo' ? 'Demo' : 'Live';

  const asOfReadable = new Date(asOf).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata'
  });

  return [
    `${stress.emoji} <b>${esc(district.name)}</b> — Water Stress: <b>${esc(stress.label)}</b>`,
    '',
    `💧 <b>${waterLabel}:</b> ${esc(waterValue)}  <i>(${waterTag})</i>`,
    `🌾 <b>Mandi Price (${esc(mandiPrice.commodity)}):</b> ₹${esc(mandiPrice.modal_price)}/quintal  <i>(${priceTag})</i>`,
    `🌊 <b>Jhelum Flood Status:</b> ${esc(floodSeverity)}  <i>(${floodTag})</i>`,
    '',
    '<i>This is a current-conditions signal, not a forecast.</i>',
    `<i>As of ${asOfReadable} IST</i>`
  ].join('\n');
}

async function buildFarmerBrief(districtId) {
  const district = findDistrict(districtId);
  if (!district) {
    const known = DISTRICTS.map(d => d.id).join(', ');
    const err = new Error(`Unknown district "${districtId}". Valid ids: ${known}`);
    err.statusCode = 400;
    throw err;
  }

  const [waterSignal, mandiPrice, floodStatus] = await Promise.all([
    getWaterSignal(district),
    getMandiPrice(district),
    getFloodStatus()
  ]);

  const asOf = new Date().toISOString();
  const stress = STRESS_LABELS[district.status] || STRESS_LABELS.normal;

  const result = {
    district: district.name,
    districtId: district.id,
    crop: district.crop,
    stressBand: stress.label,
    stressIdx: district.idx,
    waterSignal,
    mandiPrice,
    floodStatus,
    asOf
  };

  result.telegramMessage = formatTelegramMessage({ district, waterSignal, mandiPrice, floodStatus, asOf });
  return result;
}

module.exports = { buildFarmerBrief, findDistrict };
