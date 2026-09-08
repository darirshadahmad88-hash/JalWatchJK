// lib/flood-sources.js
//
// Two independent live sources for the Flood Watch widget, tried in
// order by /api/flood-level (server.js / netlify/functions/flood-level.js):
//
//   1. Google Flood Hub's Flood Forecasting API — the "official" CWC
//      gauge reading for Ram Munshi Bagh (severity bucketed against
//      CWC's own published warning/danger/extreme levels, in metres).
//      Needs GOOGLE_FLOOD_API_KEY, which currently requires a waitlist
//      approval (non-commercial pilot) — see
//      https://developers.google.com/flood-forecasting.
//
//   2. Open-Meteo's Flood API — genuinely live, free, and keyless, no
//      waitlist. It serves the GloFAS (Global Flood Awareness System)
//      hydrological model's river-discharge estimate (m3/s) for the
//      nearest modelled river channel to a coordinate. There's no
//      official CWC-style threshold in m3/s to compare against, so
//      severity here is a documented z-score heuristic against the
//      location's own trailing 60-day discharge — the same "seasonal
//      anomaly vs. own history" approach the rest of this project
//      already uses for the crop-water-stress index (see README
//      methodology step 1). This is clearly labelled as a heuristic
//      in the UI, not represented as an official flood warning.
//
// Both return the same shape so the frontend doesn't need to care
// which one answered:
//   { source, mode: 'official'|'heuristic', gaugeId, thresholds,
//     unit, qualityVerified, severity, trend, currentValue,
//     baselineMean, issuedTime }

async function fetchGoogleFloodHub(gaugeId, apiKey) {
  const modelUrl = `https://floodforecasting.googleapis.com/v1/gaugeModels/${encodeURIComponent(gaugeId)}?key=${apiKey}`;
  const statusUrl = `https://floodforecasting.googleapis.com/v1/floodStatus:queryLatestFloodStatusByGaugeIds` +
    `?gaugeIds=${encodeURIComponent(gaugeId)}&key=${apiKey}`;

  const [modelRes, statusRes] = await Promise.all([fetch(modelUrl), fetch(statusUrl)]);
  if (!modelRes.ok && !statusRes.ok) return null;

  const model = modelRes.ok ? await modelRes.json() : {};
  const statusData = statusRes.ok ? await statusRes.json() : {};
  const latest = (statusData.floodStatuses || [])[0] || null;
  if (!latest) return null;

  return {
    source: 'Google Flood Hub (Flood Forecasting API, CWC gauge)',
    mode: 'official',
    gaugeId,
    thresholds: model.thresholds || null,
    unit: model.gaugeValueUnit === 'METERS' ? 'm' : (model.gaugeValueUnit || null),
    qualityVerified: !!model.qualityVerified,
    severity: latest.severity,
    trend: latest.forecastTrend,
    currentValue: null,
    baselineMean: null,
    issuedTime: latest.issuedTime
  };
}

// Documented, disclosed bucketing — not fitted, not an official
// threshold. Mirrors the plain-language z-score buckets already used
// for the groundwater/soil-moisture stress index elsewhere in the app.
function severityFromZ(z) {
  if (z >= 2.5) return 'EXTREME_DANGER';
  if (z >= 1.5) return 'DANGER';
  if (z >= 0.5) return 'WARNING';
  return 'NO_FLOODING';
}

async function fetchOpenMeteoFlood(lat, lon) {
  const url = `https://flood-api.open-meteo.com/v1/flood` +
    `?latitude=${lat}&longitude=${lon}` +
    `&daily=river_discharge&past_days=60&forecast_days=7`;

  const upstream = await fetch(url);
  if (!upstream.ok) throw new Error(`Open-Meteo returned ${upstream.status}`);
  const data = await upstream.json();

  const times = (data.daily && data.daily.time) || [];
  const values = (data.daily && data.daily.river_discharge) || [];
  if (!times.length) throw new Error('No discharge series returned');

  // past_days=60 puts "today" (the last observed day) at index 59 —
  // everything after that in the array is forecast.
  const todayIdx = Math.min(59, times.length - 1);
  const past = values.slice(0, todayIdx + 1).filter(v => typeof v === 'number');
  const current = values[todayIdx];
  if (typeof current !== 'number' || !past.length) throw new Error('Incomplete discharge data');

  const mean = past.reduce((a, b) => a + b, 0) / past.length;
  const variance = past.reduce((a, b) => a + (b - mean) ** 2, 0) / past.length;
  const stdDev = Math.sqrt(variance) || 1e-6;
  const z = (current - mean) / stdDev;

  const future = values.slice(todayIdx + 1, todayIdx + 3).filter(v => typeof v === 'number');
  const futureAvg = future.length ? future.reduce((a, b) => a + b, 0) / future.length : current;
  const trend = futureAvg > current * 1.05 ? 'RISING' : futureAvg < current * 0.95 ? 'FALLING' : 'NO_CHANGE';

  return {
    source: 'Open-Meteo (GloFAS river-discharge model, live)',
    mode: 'heuristic',
    gaugeId: null,
    thresholds: null,
    unit: 'm3/s',
    qualityVerified: null,
    severity: severityFromZ(z),
    trend,
    currentValue: +current.toFixed(1),
    baselineMean: +mean.toFixed(1),
    issuedTime: new Date().toISOString()
  };
}

module.exports = { fetchGoogleFloodHub, fetchOpenMeteoFlood };
