/*
  Demo data for the Jal Watch dashboard.

  Replace this with a real fetch() call once you have live feeds wired up:
    - groundwater: CGWB DWLR via India-WRIS (see README.md for notes) — used
      for saffron (Pampore), which sits close to the aquifer
    - soil moisture: used for apple districts, which respond to rain-fed
      soil moisture and snowpack rather than the water table directly. The
      *current reading* shown on the page is already live, via NASA POWER's
      keyless GWETROOT parameter (see server.js / netlify function +
      README.md) — but the *historical trend* below is still a placeholder
      derived from the demo rainfall series (soilMoistureFromRainfall below)
    - prices: Agmarknet / data.gov.in API

  Each district object shape is what assets/app.js expects — keep the same
  keys if you swap in real data.
*/

const MONTHS = (() => {
  const out = [];
  const base = new Date(2023, 0, 1);
  for (let i = 0; i < 36; i++) {
    const d = new Date(base.getFullYear(), base.getMonth() + i, 1);
    out.push(d.toLocaleString('en-US', { month: 'short', year: '2-digit' }));
  }
  return out;
})();

function seasonal(amp, trend, noise, phase = 0) {
  return MONTHS.map((_, i) =>
    amp * Math.sin((i / 12) * 2 * Math.PI + phase) + trend * i + noise * (Math.sin(i * 2.1) * 0.5)
  );
}

// Root-zone soil moisture (% volumetric water content, 0-100) — modelled as a
// short-lag, damped response to rainfall rather than an independent series.
// This is the reason it exists as its own signal: soil moisture tracks
// recent rain/snowmelt, while the DWLR "water" series above tracks the much
// slower-moving aquifer. Apple orchards respond to the former; saffron corms
// and the aquifer respond more to the latter — see README "Which signal for
// which crop" section.
function soilMoistureFromRainfall(rainfall, baseline, trend, noise, seed = 0) {
  let level = baseline;
  return rainfall.map((r, i) => {
    const rainEffect = (r - 60) * 0.06; // wetter than ~60mm/mo pushes moisture up
    const drift = trend * i;
    const wobble = noise * Math.sin(i * 1.7 + seed);
    level = level * 0.7 + (baseline + drift + rainEffect + wobble) * 0.3; // damped lag
    return +Math.max(8, Math.min(45, level)).toFixed(1);
  });
}

// ---------------------------------------------------------------
// Flood Watch — Jhelum at Ram Munshi Bagh (Srinagar).
// This is a separate signal from the crop-water-stress index above:
// it answers "is the river running high right now", not "is the
// aquifer/soil running low over a season". See README for why this
// isn't folded into the DISTRICTS stress score.
//
// gaugeId matches Google Flood Hub / CWC's public gauge id for this
// station. Thresholds below are the commonly published CWC values for
// Ram Munshi Bagh (in metres, CWC's own datum) — used as the fallback
// if the live gaugeModels lookup fails, and to size the demo gauge.
// ---------------------------------------------------------------
const FLOOD_WATCH = {
  gaugeId: 'CWC_005-JHELUM',
  name: 'Jhelum at Ram Munshi Bagh, Srinagar',
  lat: 34.0631, lon: 74.8344,
  unit: 'm',
  thresholds: { warningLevel: 1585.48, dangerLevel: 1586.4, extremeDangerLevel: 1589 },
  // Demo fallback shown until a live reading is available (see
  // loadFloodWatch() in app.js) — deliberately mid-season/normal, not
  // an alarming number, so the demo state never overstates risk.
  demo: {
    severity: 'NO_FLOODING',
    trend: 'NO_CHANGE',
    currentLevel: 1583.9,
    issuedTime: null // filled in with "now" at render time
  }
};

const DISTRICTS = [
  {
    id: 'pampore',
    name: 'Pampore, Anantnag',
    crop: 'Saffron',
    status: 'stress',
    idx: 1.8,
    lat: 34.0136, lon: 74.9280,
    water: seasonal(1.1, 0.045, 0.3, 0).map(v => +(6.2 + v).toFixed(2)),
    rainfall: MONTHS.map((_, i) => Math.max(10, 90 - i * 0.6 + Math.sin(i / 2) * 25)),
    arrivals: seasonal(-8, -0.15, 3, 1).map(v => Math.max(20, +(120 + v).toFixed(0))),
    price: seasonal(400, 60, 200, 1).map(v => +(185000 + v).toFixed(0)),
    note: "Water table in Pampore's DWLR cluster has dropped steadily since late 2023, running roughly 1.8 standard deviations below the seasonal norm. In the last comparable dip (2019 season), saffron arrivals in the Pampore mandi fell by about a fifth over the following harvest — this district is the one to watch first."
  },
  {
    id: 'shopian',
    name: 'Shopian',
    crop: 'Apple',
    status: 'watch',
    idx: 0.7,
    lat: 33.7180, lon: 74.8300,
    water: seasonal(0.8, 0.02, 0.2, 0.6).map(v => +(5.4 + v).toFixed(2)),
    rainfall: MONTHS.map((_, i) => Math.max(15, 100 - i * 0.3 + Math.sin(i / 2 + 1) * 20)),
    arrivals: seasonal(-4, -0.05, 2, 0.6).map(v => Math.max(30, +(300 + v).toFixed(0))),
    price: seasonal(150, 20, 100, 0.6).map(v => +(95000 + v).toFixed(0)),
    soilMoisture: null, // filled below once `rainfall` exists
    note: "Root-zone soil moisture around Shopian's orchards is tracking mildly below average for this point in the season, consistent with a light March–April dry spell rather than any structural decline. No historical price correlation has triggered here — kept on watch mainly because it's the highest-volume apple mandi in the valley."
  },
  {
    id: 'sopore',
    name: 'Sopore, Baramulla',
    crop: 'Apple',
    status: 'normal',
    idx: 0.2,
    lat: 34.2996, lon: 74.4726,
    water: seasonal(0.6, 0.005, 0.15, 1.2).map(v => +(4.8 + v).toFixed(2)),
    rainfall: MONTHS.map((_, i) => Math.max(20, 95 - i * 0.1 + Math.sin(i / 2 + 2) * 18)),
    arrivals: seasonal(3, 0.02, 2, 1.2).map(v => Math.max(40, +(340 + v).toFixed(0))),
    price: seasonal(120, 10, 90, 1.2).map(v => +(88000 + v).toFixed(0)),
    soilMoisture: null,
    note: "Sopore's soil moisture is tracking its seasonal baseline closely, with rainfall in a normal range. No action indicated."
  },
  {
    id: 'pulwama',
    name: 'Pulwama',
    crop: 'Apple',
    status: 'watch',
    idx: 0.9,
    lat: 33.8712, lon: 74.8990,
    water: seasonal(0.7, 0.03, 0.25, 0.3).map(v => +(5.9 + v).toFixed(2)),
    rainfall: MONTHS.map((_, i) => Math.max(12, 85 - i * 0.4 + Math.sin(i / 2 + 0.5) * 22)),
    arrivals: seasonal(-3, -0.06, 2, 0.3).map(v => Math.max(35, +(280 + v).toFixed(0))),
    price: seasonal(140, 25, 110, 0.3).map(v => +(91000 + v).toFixed(0)),
    soilMoisture: null,
    note: "A gradual soil-moisture decline is visible but recent rainfall has partly offset it this season. Flagged for continued monitoring rather than immediate concern."
  }
];

// Derive soil moisture from each district's own rainfall series (damped lag
// response — see soilMoistureFromRainfall above). Saffron keeps a null here
// since Pampore's index still runs on the groundwater/aquifer signal.
const SOIL_BASELINES = { shopian: [26, 0.03, 1.6, 0.4], sopore: [24, 0.01, 1.2, 1.6], pulwama: [22, 0.02, 1.8, 0.8] };
DISTRICTS.forEach(d => {
  if (d.crop === 'Apple' && SOIL_BASELINES[d.id]) {
    const [baseline, trend, noise, seed] = SOIL_BASELINES[d.id];
    d.soilMoisture = soilMoistureFromRainfall(d.rainfall, baseline, trend, noise, seed);
  }
});

// Server-side export shim — ignored by browsers (there's no `module`
// global there), picked up by Node when lib/farmer-brief.js does
// `require('../assets/data.js')`. Keeps this file as the single source
// of truth for both the dashboard UI and the /api/farmer-brief endpoint.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { DISTRICTS, FLOOD_WATCH };
}
