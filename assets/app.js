const COLORS = {
  ink: '#ede8dc',
  inkDim: '#a9ab9f',
  water: '#5c8aa6',
  waterDim: '#8fb2c4',
  saffron: '#c97a2b',
  saffronDim: '#e0ac74',
  stress: '#a8442f',
  watch: '#b4842f',
  normal: '#5f7746',
  grid: 'rgba(255,255,255,0.06)'
};

function statusColor(s) {
  return s === 'stress' ? COLORS.stress : s === 'watch' ? COLORS.watch : COLORS.normal;
}
function hexToRgba(hex, alpha) {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16), g = parseInt(h.substring(2, 4), 16), b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
function fadeSwap(el) {
  if (prefersReducedMotion) return;
  el.classList.remove('fade-swap');
  void el.offsetWidth; // force reflow so the animation restarts
  el.classList.add('fade-swap');
}

// Tween a numeric display value rather than snapping it — used for glance
// stats, the forecast panel, and the hero counters. Respects reduced-motion.
const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function animateValue(el, to, { duration = 550, format = v => Math.round(v).toString() } = {}) {
  if (prefersReducedMotion) { el.textContent = format(to); return; }
  const from = parseFloat((el.textContent || '').replace(/[^0-9.-]/g, '')) || 0;
  const start = performance.now();
  function tick(now) {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = format(from + (to - from) * eased);
    if (t < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

// ---------------------------------------------------------------
// State
// ---------------------------------------------------------------
let currentId = 'pampore';
let compareId = null;
let rangeStart = 0;
let rangeEnd = MONTHS.length - 1;
let waterChart, priceChart, leafletMap, markers = {};

function districtById(id) {
  return DISTRICTS.find(x => x.id === id);
}

// ---------------------------------------------------------------
// Which primary signal a district's index runs on. Apple districts use
// root-zone soil moisture (rain/snowmelt-driven, short lag); saffron and
// anything without a soilMoisture series falls back to DWLR groundwater
// depth. See methodology step 1 on the page for why.
// ---------------------------------------------------------------
function signalMeta(d) {
  if (d.crop === 'Apple' && d.soilMoisture) {
    return { key: 'soilMoisture', label: 'Soil moisture', unit: '%', reversed: false, axisTitle: 'root-zone soil moisture (%)' };
  }
  return { key: 'water', label: 'Depth to water', unit: 'm', reversed: true, axisTitle: 'metres (deeper ↓)' };
}

function slice(arr) {
  return arr.slice(rangeStart, rangeEnd + 1);
}

// ---------------------------------------------------------------
// Sidebar list + search filter
// ---------------------------------------------------------------
function renderSidebar() {
  const list = document.getElementById('districtList');
  list.innerHTML = '';
  DISTRICTS.forEach(d => {
    const row = document.createElement('div');
    row.className = 'district-row' + (d.id === currentId ? ' active' : '');
    row.dataset.search = (d.name + ' ' + d.crop).toLowerCase();
    const cropDotClass = d.crop === 'Apple' ? 'dot-apple' : 'dot-saffron';
    row.innerHTML = `
      <div>
        <div class="name">${d.name.split(',')[0]}</div>
        <span class="crop"><span class="crop-dot ${cropDotClass}"></span>${d.crop}</span>
      </div>
      <div class="idx" style="color:${statusColor(d.status)}">
        <span class="status-dot" style="background:${statusColor(d.status)}"></span>${d.idx.toFixed(1)}
      </div>
    `;
    row.addEventListener('click', () => selectDistrict(d.id));
    list.appendChild(row);
  });
  applySearchFilter();
}

function applySearchFilter() {
  const q = (document.getElementById('districtSearch').value || '').trim().toLowerCase();
  document.querySelectorAll('.district-row').forEach(row => {
    row.classList.toggle('hidden', q.length > 0 && !row.dataset.search.includes(q));
  });
}

// ---------------------------------------------------------------
// Compare mode
// ---------------------------------------------------------------
function renderCompareSelect() {
  const select = document.getElementById('compareSelect');
  select.innerHTML = '';
  DISTRICTS.filter(d => d.id !== currentId).forEach(d => {
    const opt = document.createElement('option');
    opt.value = d.id;
    opt.textContent = `${d.name.split(',')[0]} (${d.crop})`;
    select.appendChild(opt);
  });
  if (compareId && compareId !== currentId) {
    select.value = compareId;
  } else {
    compareId = select.value || null;
  }
}

// ---------------------------------------------------------------
// Date-range slider
// ---------------------------------------------------------------
function updateSliderVisual() {
  const total = MONTHS.length - 1;
  const fill = document.getElementById('sliderFill');
  const leftPct = (rangeStart / total) * 100;
  const rightPct = (rangeEnd / total) * 100;
  fill.style.left = leftPct + '%';
  fill.style.width = (rightPct - leftPct) + '%';
  document.getElementById('rangeReadout').textContent = `${MONTHS[rangeStart]} — ${MONTHS[rangeEnd]}`;
}

function initSlider() {
  const startInput = document.getElementById('rangeStart');
  const endInput = document.getElementById('rangeEnd');

  startInput.addEventListener('input', () => {
    rangeStart = Math.min(Number(startInput.value), rangeEnd);
    startInput.value = rangeStart;
    updateSliderVisual();
    renderCharts();
  });
  endInput.addEventListener('input', () => {
    rangeEnd = Math.max(Number(endInput.value), rangeStart);
    endInput.value = rangeEnd;
    updateSliderVisual();
    renderCharts();
  });

  updateSliderVisual();
}

// ---------------------------------------------------------------
// Map
// ---------------------------------------------------------------
function initMap() {
  leafletMap = L.map('mapView', { zoomControl: true, attributionControl: true }).setView([34.0, 74.75], 9);

  // CARTO's dark_all basemap now requires a paid/registered API key for
  // anonymous use (they locked down basemaps.cartocdn.com in 2024) — this
  // Esri layer is genuinely free, no key, and keeps the same dark look.
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ',
    maxZoom: 14
  }).addTo(leafletMap);

  DISTRICTS.forEach(d => {
    const marker = L.circleMarker([d.lat, d.lon], {
      radius: 9,
      color: statusColor(d.status),
      fillColor: statusColor(d.status),
      fillOpacity: 0.75,
      weight: 2
    }).addTo(leafletMap);
    marker.bindPopup(`<b>${d.name}</b><br>${d.crop} · stress index ${d.idx.toFixed(1)}`);
    marker.on('click', () => selectDistrict(d.id));
    markers[d.id] = marker;
  });

  refreshMapHighlight();
}

function refreshMapHighlight() {
  DISTRICTS.forEach(d => {
    const m = markers[d.id];
    if (!m) return;
    const isActive = d.id === currentId;
    m.setStyle({
      weight: isActive ? 4 : 2,
      radius: isActive ? 12 : 9
    });
  });
}

// ---------------------------------------------------------------
// Charts (respect the active date range + optional compare district)
// ---------------------------------------------------------------
function renderCharts() {
  const d = districtById(currentId);
  const cmp = compareId ? districtById(compareId) : null;
  const labels = slice(MONTHS);

  const meta = signalMeta(d);
  const cmpMeta = cmp ? signalMeta(cmp) : null;
  const sameSignal = cmp && cmpMeta.key === meta.key;

  document.getElementById('waterChartTitle').textContent =
    `${meta.label} vs. rainfall`;
  const noteEl = document.getElementById('waterChartNote');
  noteEl.textContent = (cmp && !sameSignal)
    ? `Note: ${cmp.name.split(',')[0]} runs on ${cmpMeta.label.toLowerCase()} (${cmpMeta.unit}), not shown here — the two aren't on a comparable axis. See its own chart when selected directly.`
    : '';

  if (waterChart) waterChart.destroy();
  const waterDatasets = [
    { type: 'bar', label: 'Rainfall (mm)', data: slice(d.rainfall), backgroundColor: 'rgba(92,138,166,0.35)', yAxisID: 'y1', borderRadius: 2 },
    { type: 'line', label: `${meta.label} — ${d.name.split(',')[0]} (${meta.unit})`, data: slice(d[meta.key]), borderColor: COLORS.saffron, backgroundColor: COLORS.saffron, pointRadius: 0, borderWidth: 2, tension: 0.3, yAxisID: 'y' }
  ];
  if (sameSignal) {
    waterDatasets.push({
      type: 'line', label: `${meta.label} — ${cmp.name.split(',')[0]} (${meta.unit})`, data: slice(cmp[meta.key]),
      borderColor: COLORS.saffronDim, backgroundColor: COLORS.saffronDim, borderDash: [5, 4],
      pointRadius: 0, borderWidth: 2, tension: 0.3, yAxisID: 'y'
    });
  }
  waterChart = new Chart(document.getElementById('waterChart'), {
    data: { labels, datasets: waterDatasets },
    options: {
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { labels: { color: COLORS.ink, font: { family: 'IBM Plex Sans', size: 11 } } } },
      scales: {
        x: { ticks: { color: COLORS.inkDim, maxTicksLimit: 9, font: { size: 10 } }, grid: { color: COLORS.grid } },
        y: { position: 'left', reverse: meta.reversed, title: { display: true, text: meta.axisTitle, color: COLORS.inkDim, font: { size: 10 } }, ticks: { color: COLORS.inkDim, font: { size: 10 } }, grid: { color: COLORS.grid } },
        y1: { position: 'right', ticks: { color: COLORS.inkDim, font: { size: 10 } }, grid: { display: false } }
      }
    }
  });

  if (priceChart) priceChart.destroy();
  const priceDatasets = [
    { type: 'bar', label: 'Arrivals (qtl)', data: slice(d.arrivals), backgroundColor: 'rgba(122,143,92,0.35)', yAxisID: 'y1', borderRadius: 2 },
    { type: 'line', label: `Modal price — ${d.name.split(',')[0]} (₹/qtl)`, data: slice(d.price), borderColor: COLORS.water, backgroundColor: COLORS.water, pointRadius: 0, borderWidth: 2, tension: 0.3, yAxisID: 'y' }
  ];
  if (cmp) {
    priceDatasets.push({
      type: 'line', label: `Modal price — ${cmp.name.split(',')[0]} (₹/qtl)`, data: slice(cmp.price),
      borderColor: COLORS.waterDim, backgroundColor: COLORS.waterDim, borderDash: [5, 4],
      pointRadius: 0, borderWidth: 2, tension: 0.3, yAxisID: 'y'
    });
  }
  priceChart = new Chart(document.getElementById('priceChart'), {
    data: { labels, datasets: priceDatasets },
    options: {
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { labels: { color: COLORS.ink, font: { family: 'IBM Plex Sans', size: 11 } } } },
      scales: {
        x: { ticks: { color: COLORS.inkDim, maxTicksLimit: 9, font: { size: 10 } }, grid: { color: COLORS.grid } },
        y: { position: 'left', title: { display: true, text: '₹ per quintal', color: COLORS.inkDim, font: { size: 10 } }, ticks: { color: COLORS.inkDim, font: { size: 10 } }, grid: { color: COLORS.grid } },
        y1: { position: 'right', title: { display: true, text: 'quintals', color: COLORS.inkDim, font: { size: 10 } }, ticks: { color: COLORS.inkDim, font: { size: 10 } }, grid: { display: false } }
      }
    }
  });
}

// ---------------------------------------------------------------
// Selecting a district
// ---------------------------------------------------------------
function selectDistrict(id) {
  currentId = id;
  if (compareId === id) compareId = null;
  const d = districtById(id);

  document.getElementById('cropLabel').textContent = d.crop;
  const nameEl = document.getElementById('districtName');
  nameEl.textContent = d.name;
  fadeSwap(nameEl);

  const pill = document.getElementById('statusPill');
  pill.innerHTML = `<span class="status-dot"></span>Water stress index: ${d.idx.toFixed(1)}`;
  const c = statusColor(d.status);
  pill.style.borderColor = c;
  pill.style.color = c;
  pill.style.background = hexToRgba(c, 0.1);
  pill.querySelector('.status-dot').style.background = c;

  const insightEl = document.getElementById('insightText');
  insightEl.innerHTML = d.note.replace(
    /(\d+(\.\d+)?\s?(standard deviations|fifth|percent|%))/i,
    '<b>$1</b>'
  );
  fadeSwap(insightEl);

  renderSidebar();
  renderCompareSelect();
  renderCharts();
  refreshMapHighlight();
  if (leafletMap) leafletMap.panTo([d.lat, d.lon]);
  updateSampleNote(d, null, null); // reset to a neutral "checking…" state first
  const token = ++sampleNoteToken;
  Promise.all([loadLivePrice(d), loadLiveSoilMoisture(d)]).then(([priceLive, soilLive]) => {
    if (token === sampleNoteToken) updateSampleNote(d, priceLive, soilLive);
  });
  renderForecast(d);
  renderLinkDashboard(d);
  renderMetricsGrid(d);
  if (typeof renderPlainInsight === 'function') renderPlainInsight(d);
  syncDistrictDropdown(id);
}

// ---------------------------------------------------------------
// District dropdown — the primary selector at the top-left of the
// dashboard. The searchable sidebar list still works too (and both
// stay in sync); the dropdown is just the fastest path on mobile.
// ---------------------------------------------------------------
function renderDistrictDropdown() {
  const el = document.getElementById('districtDropdown');
  if (!el) return;
  el.innerHTML = '';
  DISTRICTS.forEach(d => {
    const opt = document.createElement('option');
    opt.value = d.id;
    opt.textContent = `${d.name.split(',')[0]} — ${d.crop}`;
    el.appendChild(opt);
  });
  el.value = currentId;
  el.addEventListener('change', () => selectDistrict(el.value));
}
function syncDistrictDropdown(id) {
  const el = document.getElementById('districtDropdown');
  if (el && el.value !== id) el.value = id;
}

// ---------------------------------------------------------------
// Dashboard-wide "sample values" banner — instead of one static
// disclaimer, this reflects what's actually live vs. demo *for the
// currently selected district*: the mandi-price badge and (for apple
// districts) the current soil-moisture reading can be genuinely live;
// historical chart trends and groundwater depth are always demo (see
// README for why). Updated once both live checks below have resolved.
// ---------------------------------------------------------------
let sampleNoteToken = 0;
function updateSampleNote(d, priceLive, soilLive) {
  const note = document.getElementById('dashSampleNote');
  if (!note) return;
  const name = d.name.split(',')[0];
  const hasSoilSignal = signalMeta(d).key === 'soilMoisture';

  if (priceLive === null) {
    note.innerHTML = `Checking live feeds for ${name}…`;
    note.classList.remove('is-live', 'is-partial');
    return;
  }

  let html, cls;
  if (hasSoilSignal) {
    if (priceLive && soilLive) {
      html = `<b>Live for ${name}:</b> today's soil-moisture reading and the latest mandi price. Historical trend lines in the charts below are still illustrative demo data — see the README.`;
      cls = 'is-live';
    } else if (soilLive) {
      html = `<b>Live for ${name}:</b> today's soil-moisture reading. Mandi price and all historical trends below are still illustrative demo data.`;
      cls = 'is-partial';
    } else if (priceLive) {
      html = `<b>Live for ${name}:</b> the latest mandi price. Soil moisture and all historical trends below are still illustrative demo data.`;
      cls = 'is-partial';
    } else {
      html = `Live feeds aren't reachable right now for ${name} — every chart below is illustrative demo data. See the README for details.`;
      cls = '';
    }
  } else {
    if (priceLive) {
      html = `<b>Live for ${name}:</b> the latest mandi price. Groundwater readings and all historical trends below are still illustrative demo data — India-WRIS has no stable public API yet (see README).`;
      cls = 'is-partial';
    } else {
      html = `No live feed is reachable for ${name} right now — every value below, including groundwater and price, is illustrative demo data. See the README for details.`;
      cls = '';
    }
  }
  note.innerHTML = html;
  note.classList.toggle('is-live', cls === 'is-live');
  note.classList.toggle('is-partial', cls === 'is-partial');
}

// ---------------------------------------------------------------
// Live mandi price lookup — calls /api/mandi-prices (Netlify redirect
// or the Render Express route, depending on where this is deployed).
// Falls back silently to "demo data" badge if the API key isn't set
// yet, or the request fails for any reason — the chart above still
// works either way.
// ---------------------------------------------------------------
const livePriceCache = {}; // commodity -> { markets: [...] }

// ---------------------------------------------------------------
// Live root-zone soil moisture for apple districts — calls
// /api/soil-moisture (NASA POWER GWETROOT, see server.js/netlify function
// for details). Groundwater districts (saffron) don't have a live feed
// yet — the README's "making it real" section covers why (no stable
// public India-WRIS API), so we say so plainly rather than fake it.
// ---------------------------------------------------------------
async function loadLiveSoilMoisture(d) {
  const hint = document.getElementById('waterChartHint');
  const meta = signalMeta(d);

  if (meta.key !== 'soilMoisture') {
    hint.textContent = 'Groundwater feed not wired live yet — see README';
    hint.classList.remove('is-live');
    return false;
  }

  hint.textContent = 'Checking NASA POWER…';
  hint.classList.remove('is-live');
  try {
    const res = await fetch(`/api/soil-moisture?lat=${d.lat}&lon=${d.lon}`);
    if (!res.ok) throw new Error(`status ${res.status}`);
    const payload = await res.json();
    hint.textContent = `● Live: ${payload.root_zone_wetness_pct}% root-zone wetness (NASA POWER, ${payload.date})`;
    hint.classList.add('is-live');
    return true;
  } catch (err) {
    hint.textContent = 'Demo trend shown — live feed unavailable right now';
    hint.classList.remove('is-live');
    return false;
  }
}

async function loadLivePrice(d) {
  const badge = document.getElementById('liveBadge');
  const line = document.getElementById('livePriceLine');
  badge.textContent = 'Checking live prices…';
  badge.classList.remove('is-live');
  line.textContent = '';

  try {
    if (!livePriceCache[d.crop]) {
      const res = await fetch(`/api/mandi-prices?commodity=${encodeURIComponent(d.crop)}`);
      if (!res.ok) throw new Error(`status ${res.status}`);
      livePriceCache[d.crop] = await res.json();
    }
    const payload = livePriceCache[d.crop];
    const marketKeyword = d.name.split(',')[0].trim().toLowerCase();
    const match = (payload.markets || []).find(m =>
      (m.market || '').toLowerCase().includes(marketKeyword)
    );

    if (match) {
      badge.textContent = 'Live from Agmarknet';
      badge.classList.add('is-live');
      line.innerHTML = `Latest reported: <b>₹${Number(match.modal_price).toLocaleString('en-IN')}/quintal</b> at ${match.market} mandi, ${match.arrival_date}`;
      return true;
    } else {
      badge.textContent = 'Demo price data (no live match for this market)';
      line.textContent = '';
      return false;
    }
  } catch (err) {
    badge.textContent = 'Demo price data (live feed not connected yet)';
    line.textContent = '';
    return false;
  }
}

// ---------------------------------------------------------------
// Flood Watch widget — river-flood risk on the Jhelum, a separate
// signal from the crop-water-stress dashboard above (too much water,
// not too little). Calls /api/flood-level (Google Flood Hub, via CWC's
// gauge at Ram Munshi Bagh). Falls back to the labelled demo reading
// in FLOOD_WATCH (assets/data.js) if no API key is set yet or the
// request fails — same honest-fallback pattern as the price/soil-
// moisture widgets.
// ---------------------------------------------------------------
const FLOOD_SEVERITY_META = {
  NO_FLOODING: { label: 'Normal', level: 'normal' },
  WARNING: { label: 'Watch', level: 'watch' },
  DANGER: { label: 'Alert', level: 'danger' },
  EXTREME_DANGER: { label: 'Danger', level: 'extreme' }
};
const FLOOD_TREND_META = {
  RISING: '↑ Rising',
  FALLING: '↓ Falling',
  NO_CHANGE: '→ Steady'
};

function renderFloodWidget(payload, isLive) {
  const dot = document.getElementById('floodDot');
  const pill = document.getElementById('floodStatusPill');
  const trendEl = document.getElementById('floodTrend');
  const thresholdsEl = document.getElementById('floodThresholds');
  const badge = document.getElementById('floodLiveBadge');
  const updatedEl = document.getElementById('floodUpdated');

  const meta = FLOOD_SEVERITY_META[payload.severity] || { label: 'Unknown', level: '' };
  pill.textContent = meta.label;
  pill.className = `flood-status-pill lvl-${meta.level}`;
  pill.classList.remove('is-loading');
  dot.className = `flood-widget-dot lvl-${meta.level}`;

  trendEl.textContent = FLOOD_TREND_META[payload.trend] || '';

  // Official CWC/Google thresholds (metres) if we have them; otherwise,
  // for the keyless GloFAS discharge feed, show the reading against its
  // own recent baseline — a documented heuristic, not an official limit.
  const t = payload.thresholds || {};
  const thresholdParts = [];
  if (t.warningLevel != null) thresholdParts.push(`Warning ${t.warningLevel} m`);
  if (t.dangerLevel != null) thresholdParts.push(`Danger ${t.dangerLevel} m`);
  if (t.extremeDangerLevel != null) thresholdParts.push(`Extreme ${t.extremeDangerLevel} m`);

  if (thresholdParts.length) {
    thresholdsEl.textContent = thresholdParts.join(' · ');
  } else if (payload.currentValue != null) {
    const pctVsBaseline = payload.baselineMean
      ? Math.round(((payload.currentValue - payload.baselineMean) / payload.baselineMean) * 100)
      : null;
    thresholdsEl.textContent = pctVsBaseline != null
      ? `${payload.currentValue} m³/s (${pctVsBaseline >= 0 ? '+' : ''}${pctVsBaseline}% vs 60-day avg)`
      : `${payload.currentValue} m³/s`;
  } else {
    thresholdsEl.textContent = '';
  }

  if (isLive) {
    badge.textContent = payload.mode === 'heuristic' ? 'Live from Open-Meteo (GloFAS)' : 'Live from Google Flood Hub';
    badge.classList.add('is-live');
  } else {
    badge.textContent = 'Demo flood data';
    badge.classList.remove('is-live');
  }

  const when = payload.issuedTime ? new Date(payload.issuedTime) : new Date();
  updatedEl.textContent = `Updated ${when.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;
}

async function loadFloodWatch() {
  try {
    const res = await fetch(
      `/api/flood-level?gaugeId=${encodeURIComponent(FLOOD_WATCH.gaugeId)}&lat=${FLOOD_WATCH.lat}&lon=${FLOOD_WATCH.lon}`
    );
    if (!res.ok) throw new Error(`status ${res.status}`);
    const payload = await res.json();
    if (!payload.severity) throw new Error('no severity in response');
    renderFloodWidget(payload, true);
  } catch (err) {
    // Both the official and keyless feeds failed (or the network is
    // down) — fall back to the clearly-labelled demo reading.
    renderFloodWidget({
      mode: 'demo',
      severity: FLOOD_WATCH.demo.severity,
      trend: FLOOD_WATCH.demo.trend,
      thresholds: FLOOD_WATCH.thresholds,
      currentValue: null,
      baselineMean: null,
      issuedTime: new Date().toISOString()
    }, false);
  }
}

function initFloodWidget() {
  const widget = document.getElementById('floodWidget');
  const toggle = document.getElementById('floodWidgetToggle');
  toggle.addEventListener('click', () => {
    const collapsed = widget.classList.toggle('is-collapsed');
    toggle.setAttribute('aria-expanded', String(!collapsed));
  });
  loadFloodWatch();
  // Re-check periodically so the badge/severity stay current on a page
  // left open — matches the API's own 15-min cache window.
  setInterval(loadFloodWatch, 15 * 60 * 1000);
}

// ---------------------------------------------------------------
// Signal-links dashboard — cross-checks rainfall, soil moisture, flood
// risk, and mandi price for the currently selected district, and
// highlights which causal path (rainfall deficit -> low soil moisture,
// or rainfall excess -> flood) the live readings currently support.
// Rainfall + soil moisture: NASA POWER (live, keyless). Flood: same
// Google Flood Hub / Open-Meteo feed as the floating widget (live).
// Price: Agmarknet via data.gov.in (live once a key is set). Saffron
// (Pampore) has no live groundwater feed yet — shown honestly as demo.
// ---------------------------------------------------------------
async function renderLinkDashboard(d) {
  document.getElementById('linkDistrictName').textContent = d.name.split(',')[0];
  const meta = signalMeta(d);
  const isApple = meta.key === 'soilMoisture';

  document.getElementById('linkSoilLabel').textContent = isApple ? 'Soil moisture' : 'Groundwater';
  const flowSoilTitle = document.querySelector('#flowSoil .flow-title');
  const flowSoilSub = document.querySelector('#flowSoil .flow-sub');
  flowSoilTitle.textContent = isApple ? 'Soil moisture' : 'Groundwater';
  flowSoilSub.textContent = isApple ? 'Deficit path — apple orchards' : 'Deficit path — no live feed yet (demo)';

  // --- Rainfall (NASA POWER PRECTOTCORR, live, keyless) ---
  const rainCard = { val: document.getElementById('linkRainVal'), sub: document.getElementById('linkRainSub') };
  let rainMm = null;
  try {
    const res = await fetch(`/api/rainfall?lat=${d.lat}&lon=${d.lon}`);
    if (!res.ok) throw new Error(`status ${res.status}`);
    const payload = await res.json();
    rainMm = payload.mm_per_day;
    rainCard.val.classList.remove('is-loading');
    rainCard.val.textContent = `${rainMm} mm/day`;
    rainCard.sub.textContent = `● Live — ${payload.mm_last_7_days} mm over last 7 days (NASA POWER)`;
    rainCard.sub.classList.add('is-live');
  } catch (err) {
    rainCard.val.classList.remove('is-loading');
    rainCard.val.textContent = '—';
    rainCard.sub.textContent = 'Live feed unavailable right now';
    rainCard.sub.classList.remove('is-live');
  }

  // --- Soil moisture / groundwater ---
  const soilCard = { val: document.getElementById('linkSoilVal'), sub: document.getElementById('linkSoilSub') };
  let soilDeficit = false;
  if (isApple) {
    try {
      const res = await fetch(`/api/soil-moisture?lat=${d.lat}&lon=${d.lon}`);
      if (!res.ok) throw new Error(`status ${res.status}`);
      const payload = await res.json();
      const livePct = payload.root_zone_wetness_pct;
      const baseline = mean(d.soilMoisture || [livePct]);
      soilDeficit = livePct < baseline * 0.9;
      soilCard.val.classList.remove('is-loading');
      soilCard.val.textContent = `${livePct}%`;
      soilCard.sub.textContent = `● Live (NASA POWER, ${payload.date}) — vs. ${baseline.toFixed(1)}% seasonal avg`;
      soilCard.sub.classList.add('is-live');
    } catch (err) {
      soilCard.val.classList.remove('is-loading');
      soilCard.val.textContent = '—';
      soilCard.sub.textContent = 'Live feed unavailable right now';
      soilCard.sub.classList.remove('is-live');
    }
  } else {
    soilCard.val.classList.remove('is-loading');
    soilCard.val.textContent = `${d.water[d.water.length - 1].toFixed(1)} m`;
    soilCard.sub.textContent = '◦ Demo depth-to-water — no stable public WRIS API yet (see README)';
    soilCard.sub.classList.remove('is-live');
  }
  document.getElementById('linkCardSoil').classList.toggle('is-elevated', soilDeficit);

  // --- Floods (Jhelum at Ram Munshi Bagh — Google Flood Hub / Open-Meteo) ---
  const floodCard = { val: document.getElementById('linkFloodVal'), sub: document.getElementById('linkFloodSub') };
  let floodActive = false;
  let floodLabel = 'Normal';
  try {
    const res = await fetch(
      `/api/flood-level?gaugeId=${encodeURIComponent(FLOOD_WATCH.gaugeId)}&lat=${FLOOD_WATCH.lat}&lon=${FLOOD_WATCH.lon}`
    );
    if (!res.ok) throw new Error(`status ${res.status}`);
    const payload = await res.json();
    if (!payload.severity) throw new Error('no severity');
    const fm = FLOOD_SEVERITY_META[payload.severity] || { label: 'Unknown', level: '' };
    floodLabel = fm.label;
    floodActive = payload.severity !== 'NO_FLOODING';
    floodCard.val.classList.remove('is-loading');
    floodCard.val.textContent = fm.label;
    floodCard.sub.textContent = `● Live — ${FLOOD_TREND_META[payload.trend] || ''}`.trim();
    floodCard.sub.classList.add('is-live');
  } catch (err) {
    floodLabel = 'Normal';
    floodActive = false;
    floodCard.val.classList.remove('is-loading');
    floodCard.val.textContent = 'Normal';
    floodCard.sub.textContent = '◦ Demo flood data';
    floodCard.sub.classList.remove('is-live');
  }
  document.getElementById('linkCardFlood').classList.toggle('is-elevated', floodActive);

  // --- Mandi price (Agmarknet via data.gov.in) ---
  const priceCard = { val: document.getElementById('linkPriceVal'), sub: document.getElementById('linkPriceSub') };
  let priceText = null;
  try {
    if (!livePriceCache[d.crop]) {
      const res = await fetch(`/api/mandi-prices?commodity=${encodeURIComponent(d.crop)}`);
      if (!res.ok) throw new Error(`status ${res.status}`);
      livePriceCache[d.crop] = await res.json();
    }
    const payload = livePriceCache[d.crop];
    const marketKeyword = d.name.split(',')[0].trim().toLowerCase();
    const match = (payload.markets || []).find(m => (m.market || '').toLowerCase().includes(marketKeyword));
    if (match) {
      priceText = `₹${Number(match.modal_price).toLocaleString('en-IN')}/qtl`;
      priceCard.val.classList.remove('is-loading');
      priceCard.val.textContent = priceText;
      priceCard.sub.textContent = `● Live — ${match.market} mandi, ${match.arrival_date}`;
      priceCard.sub.classList.add('is-live');
    } else {
      throw new Error('no market match');
    }
  } catch (err) {
    const demoPrice = d.price[d.price.length - 1];
    priceText = `₹${Math.round(demoPrice).toLocaleString('en-IN')}/qtl`;
    priceCard.val.classList.remove('is-loading');
    priceCard.val.textContent = priceText;
    priceCard.sub.textContent = '◦ Demo price data';
    priceCard.sub.classList.remove('is-live');
  }

  // --- Highlight the active path(s) in the flow diagram ---
  const soilNode = document.getElementById('flowSoil');
  const floodNode = document.getElementById('flowFlood');
  const arrivalsNode = document.getElementById('flowArrivals');
  const arrowSoil = document.getElementById('flowArrowSoil');
  const arrowFlood = document.getElementById('flowArrowFlood');
  const arrowDown = document.getElementById('flowArrowDown');

  soilNode.classList.toggle('is-active', soilDeficit);
  arrowSoil.classList.toggle('is-active-teal', soilDeficit);
  floodNode.classList.toggle('is-active', floodActive);
  arrowFlood.classList.toggle('is-active-blue', floodActive);
  const anyActive = soilDeficit || floodActive;
  arrivalsNode.classList.toggle('is-active', anyActive);
  arrowDown.classList.toggle('is-active-teal', soilDeficit && !floodActive);
  arrowDown.classList.toggle('is-active-blue', floodActive);

  document.getElementById('flowArrivalsSub').textContent =
    `${d.crop} mandi — currently ${priceText || 'no live price'}`;

  // --- Narrative sentence ---
  const shortName = d.name.split(',')[0];
  const narrativeEl = document.getElementById('linkNarrative');
  let narrative;
  if (soilDeficit && floodActive) {
    narrative = `Unusual right now: ${shortName} shows below-average ${isApple ? 'soil moisture' : 'water level'}` +
      ` while the Jhelum is simultaneously reading "${floodLabel}" downstream — a drought-and-flood mismatch worth a manual check rather than trusting either signal alone.`;
  } else if (soilDeficit) {
    narrative = `${shortName}'s ${isApple ? 'soil moisture' : 'water level'} is running below its seasonal average with rainfall at ${rainMm != null ? rainMm + ' mm/day' : 'a low reading'} — the deficit path is active, the one historically associated with tighter arrivals and firmer prices at the ${d.crop.toLowerCase()} mandi.`;
  } else if (floodActive) {
    narrative = `The Jhelum at Ram Munshi Bagh is reading "${floodLabel}" — the excess-water path is active. This doesn't feed ${shortName}'s stress score directly, but flooding disrupts arrivals and transport the same way a deficit does, just from the opposite cause.`;
  } else {
    narrative = `${shortName} is quiet on both fronts right now: ${isApple ? 'soil moisture' : 'water level'} is close to its seasonal average and the Jhelum flood status is Normal. The current ${d.crop.toLowerCase()} price mainly reflects normal seasonal arrivals, not a water-stress signal.`;
  }
  narrativeEl.textContent = narrative;
  fadeSwap(narrativeEl);
}

// ---------------------------------------------------------------
// Top-of-dashboard metrics grid — current reading + a short forecast
// direction for the four variables that actually move mandi price
// here: soil moisture/groundwater, rainfall, flood situation, and
// demand & supply (arrivals + price). Reuses the same live feeds and
// forecast heuristic used elsewhere on the page (computeForecast,
// getCurrentPrice) rather than inventing a second model.
// ---------------------------------------------------------------
const TREND_ARROW = { up: '↑', down: '↓', flat: '→' };
function trendDirection(series, window = 3, priorWindow = 6) {
  const n = series.length;
  const recent = mean(series.slice(Math.max(0, n - window)));
  const prior = mean(series.slice(Math.max(0, n - window - priorWindow), Math.max(0, n - window)));
  if (!prior) return { dir: 'flat', deltaPct: 0 };
  const deltaPct = (recent - prior) / Math.abs(prior);
  const dir = deltaPct > 0.02 ? 'up' : deltaPct < -0.02 ? 'down' : 'flat';
  return { dir, deltaPct };
}

async function renderMetricsGrid(d) {
  const isApple = signalMeta(d).key === 'soilMoisture';

  // --- Soil moisture / groundwater ---
  document.getElementById('metricSoilLabel').textContent = isApple ? t('metric_soil') : t('metric_groundwater');
  const soilCur = document.getElementById('metricSoilCurrent');
  const soilSub = document.getElementById('metricSoilSub');
  const soilFc = document.getElementById('metricSoilForecast');
  const soilSeries = isApple ? d.soilMoisture : d.water;
  const soilTrend = trendDirection(soilSeries);
  // "Improving" means moving the healthy direction: rising soil moisture, or shallower (lower) water depth
  const soilImproving = isApple ? soilTrend.dir === 'up' : soilTrend.dir === 'down';
  soilFc.textContent = isApple
    ? `${TREND_ARROW[soilTrend.dir]} ${soilTrend.dir === 'flat' ? 'Expected to stay steady' : soilImproving ? 'Trending up — improving' : 'Trending down — worth watching'} over the next few weeks`
    : `${TREND_ARROW[soilTrend.dir]} ${soilTrend.dir === 'flat' ? 'Expected to stay steady' : soilImproving ? 'Water table trending shallower' : 'Water table trending deeper — worth watching'}`;
  if (isApple) {
    try {
      const res = await fetch(`/api/soil-moisture?lat=${d.lat}&lon=${d.lon}`);
      if (!res.ok) throw new Error(`status ${res.status}`);
      const payload = await res.json();
      soilCur.classList.remove('is-loading');
      soilCur.textContent = `${payload.root_zone_wetness_pct}%`;
      soilSub.textContent = `● Live — NASA POWER, ${payload.date}`;
      soilSub.classList.add('is-live');
    } catch (err) {
      soilCur.classList.remove('is-loading');
      soilCur.textContent = `${soilSeries[soilSeries.length - 1].toFixed(1)}%`;
      soilSub.textContent = '◦ Demo reading — live feed unavailable';
      soilSub.classList.remove('is-live');
    }
  } else {
    soilCur.classList.remove('is-loading');
    soilCur.textContent = `${soilSeries[soilSeries.length - 1].toFixed(1)} m deep`;
    soilSub.textContent = '◦ Demo depth-to-water — no stable public WRIS API yet';
    soilSub.classList.remove('is-live');
  }

  // --- Rainfall ---
  const rainCur = document.getElementById('metricRainCurrent');
  const rainSub = document.getElementById('metricRainSub');
  const rainFc = document.getElementById('metricRainForecast');
  const rainTrend = trendDirection(d.rainfall);
  rainFc.textContent = `${TREND_ARROW[rainTrend.dir]} ${rainTrend.dir === 'flat' ? 'Near the seasonal average, likely to continue' : rainTrend.dir === 'up' ? 'Above recent average — wetter pattern likely to continue short-term' : 'Below recent average — drier pattern likely to continue short-term'}`;
  try {
    const res = await fetch(`/api/rainfall?lat=${d.lat}&lon=${d.lon}`);
    if (!res.ok) throw new Error(`status ${res.status}`);
    const payload = await res.json();
    rainCur.classList.remove('is-loading');
    rainCur.textContent = `${payload.mm_per_day} mm/day`;
    rainSub.textContent = `● Live — ${payload.mm_last_7_days} mm over last 7 days`;
    rainSub.classList.add('is-live');
  } catch (err) {
    rainCur.classList.remove('is-loading');
    rainCur.textContent = `${d.rainfall[d.rainfall.length - 1].toFixed(0)} mm/mo`;
    rainSub.textContent = '◦ Demo reading — live feed unavailable';
    rainSub.classList.remove('is-live');
  }

  // --- Flood situation ---
  const floodCur = document.getElementById('metricFloodCurrent');
  const floodSub = document.getElementById('metricFloodSub');
  const floodFc = document.getElementById('metricFloodForecast');
  try {
    const res = await fetch(`/api/flood-level?gaugeId=${encodeURIComponent(FLOOD_WATCH.gaugeId)}&lat=${FLOOD_WATCH.lat}&lon=${FLOOD_WATCH.lon}`);
    if (!res.ok) throw new Error(`status ${res.status}`);
    const payload = await res.json();
    if (!payload.severity) throw new Error('no severity');
    const fm = FLOOD_SEVERITY_META[payload.severity] || { label: 'Unknown' };
    floodCur.classList.remove('is-loading');
    floodCur.textContent = fm.label;
    floodSub.textContent = payload.mode === 'heuristic' ? '● Live — Open-Meteo (GloFAS)' : '● Live — Google Flood Hub';
    floodSub.classList.add('is-live');
    const trendLabel = FLOOD_TREND_META[payload.trend] || '→ Steady';
    floodFc.textContent = `${trendLabel} — Jhelum gauge trend is the short-term outlook here`;
  } catch (err) {
    floodCur.classList.remove('is-loading');
    floodCur.textContent = 'Normal';
    floodSub.textContent = '◦ Demo flood data';
    floodSub.classList.remove('is-live');
    floodFc.textContent = '→ No live trend available right now';
  }

  // --- Demand & supply (mandi arrivals + price) ---
  const demandCur = document.getElementById('metricDemandCurrent');
  const demandSub = document.getElementById('metricDemandSub');
  const demandFc = document.getElementById('metricDemandForecast');
  const arrivalsTrend = trendDirection(d.arrivals);
  const { price: curPrice, isLive: priceIsLive, market } = await getCurrentPrice(d);
  const { pctChange } = computeForecast(d);
  const priceDir = pctChange > 0.01 ? 'up' : pctChange < -0.01 ? 'down' : 'flat';
  demandCur.classList.remove('is-loading');
  demandCur.textContent = `₹${Math.round(curPrice).toLocaleString('en-IN')}/qtl`;
  demandSub.textContent = priceIsLive
    ? `● Live — ${market} mandi · arrivals ${arrivalsTrend.dir === 'up' ? 'rising' : arrivalsTrend.dir === 'down' ? 'falling' : 'steady'}`
    : `◦ Demo price · arrivals ${arrivalsTrend.dir === 'up' ? 'rising' : arrivalsTrend.dir === 'down' ? 'falling' : 'steady'} (demo)`;
  const pctLabel = `${pctChange >= 0 ? '+' : ''}${(pctChange * 100).toFixed(1)}%`;
  demandFc.textContent = priceDir === 'flat'
    ? '→ No strong price signal for next season right now'
    : `${TREND_ARROW[priceDir]} Next-season price forecast: ${pctLabel} (supply ${arrivalsTrend.dir === 'down' ? 'tightening' : arrivalsTrend.dir === 'up' ? 'easing' : 'steady'})`;
}

// ---------------------------------------------------------------
// CSV export — exports the currently visible range for the selected
// district (and the compare district, if one is active).
// ---------------------------------------------------------------
function exportCsv() {
  const d = districtById(currentId);
  const cmp = compareId ? districtById(compareId) : null;
  const labels = slice(MONTHS);

  const headers = cmp
    ? ['month', 'district', 'water_level_m', 'soil_moisture_pct', 'rainfall_mm', 'arrivals_qtl', 'modal_price_inr_qtl']
    : ['month', 'water_level_m', 'soil_moisture_pct', 'rainfall_mm', 'arrivals_qtl', 'modal_price_inr_qtl'];

  const rows = [headers.join(',')];
  const soil = (x, idx) => (x.soilMoisture ? x.soilMoisture[idx] : '');

  labels.forEach((label, i) => {
    const idx = rangeStart + i;
    if (cmp) {
      rows.push([label, d.name, d.water[idx], soil(d, idx), d.rainfall[idx].toFixed(1), d.arrivals[idx], d.price[idx]].join(','));
      rows.push([label, cmp.name, cmp.water[idx], soil(cmp, idx), cmp.rainfall[idx].toFixed(1), cmp.arrivals[idx], cmp.price[idx]].join(','));
    } else {
      rows.push([label, d.water[idx], soil(d, idx), d.rainfall[idx].toFixed(1), d.arrivals[idx], d.price[idx]].join(','));
    }
  });

  const csv = rows.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const fileSuffix = cmp ? `${d.id}_vs_${cmp.id}` : d.id;
  a.href = url;
  a.download = `jal-watch_${fileSuffix}_${MONTHS[rangeStart]}_to_${MONTHS[rangeEnd]}.csv`.replace(/\s+/g, '');
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------
// At-a-glance bar: aggregate water level, live apple price, and a
// transparent heuristic "next-season signal" — explicitly NOT a
// trained forecast, just a documented formula reacting to water and
// rainfall anomalies. See the note in the card's tooltip.
// ---------------------------------------------------------------
function mean(arr) { return arr.reduce((a, b) => a + b, 0) / arr.length; }
function std(arr) {
  const m = mean(arr);
  return Math.sqrt(mean(arr.map(v => (v - m) ** 2))) || 1e-6;
}

function appleDistricts() {
  return DISTRICTS.filter(d => d.crop === 'Apple');
}
// Element-wise average of a named series across a set of districts
function aggregateSeries(districts, key) {
  const len = MONTHS.length;
  const out = new Array(len).fill(0);
  districts.forEach(d => { d[key].forEach((v, i) => { out[i] += v / districts.length; }); });
  return out;
}

async function renderGlance() {
  const apples = appleDistricts();
  const soilSeries = aggregateSeries(apples, 'soilMoisture');
  const rainSeries = aggregateSeries(apples, 'rainfall');
  const mockPriceSeries = aggregateSeries(apples, 'price');

  const currentSoil = soilSeries[soilSeries.length - 1];
  const currentRain = rainSeries[rainSeries.length - 1];
  let currentPrice = mockPriceSeries[mockPriceSeries.length - 1];
  let priceIsLive = false;

  // --- Soil moisture card (apple orchards respond to this, not the water
  // table directly — see methodology step 1) ---
  const waterEl = document.getElementById('glanceWater');
  waterEl.classList.remove('is-loading');
  animateValue(waterEl, currentSoil, { format: v => `${v.toFixed(1)}%` });
  document.getElementById('glanceWaterSub').textContent =
    `Avg root-zone soil moisture · ${apples.map(d => d.name.split(',')[0]).join(', ')}`;

  // --- Live price card (falls back to mock average) ---
  const priceEl = document.getElementById('glancePrice');
  const priceFormat = v => `₹${Math.round(v).toLocaleString('en-IN')}/qtl`;
  try {
    if (!livePriceCache['Apple']) {
      const res = await fetch(`/api/mandi-prices?commodity=Apple`);
      if (!res.ok) throw new Error(`status ${res.status}`);
      livePriceCache['Apple'] = await res.json();
    }
    const markets = livePriceCache['Apple'].markets || [];
    const matched = apples
      .map(d => markets.find(m => (m.market || '').toLowerCase().includes(d.name.split(',')[0].toLowerCase())))
      .filter(Boolean);

    if (matched.length) {
      currentPrice = mean(matched.map(m => Number(m.modal_price)));
      priceIsLive = true;
      priceEl.classList.remove('is-loading');
      animateValue(priceEl, currentPrice, { format: priceFormat });
      document.getElementById('glancePriceSub').textContent =
        `● Live avg across ${matched.length} reporting market${matched.length > 1 ? 's' : ''}`;
    } else {
      throw new Error('no matched markets');
    }
  } catch (err) {
    priceEl.classList.remove('is-loading');
    animateValue(priceEl, currentPrice, { format: priceFormat });
    document.getElementById('glancePriceSub').textContent = '◦ Demo data (live feed not connected yet)';
  }

  // --- Heuristic next-season signal ---
  // Negative soilZ = drier than average soil moisture (worse).
  // Negative rainZ = less rain than average (also worse).
  // Sensitivities (0.035 / 0.02) are illustrative constants, not fitted —
  // documented here rather than hidden, since this is a demo heuristic.
  const soilZ = (currentSoil - mean(soilSeries)) / std(soilSeries);
  const rainZ = (currentRain - mean(rainSeries)) / std(rainSeries);
  const stressScore = -0.6 * soilZ - 0.4 * rainZ;
  const pctChange = Math.max(-0.15, Math.min(0.25, stressScore * 0.035));
  const forecastPrice = currentPrice * (1 + pctChange);

  const fEl = document.getElementById('glanceForecast');
  fEl.classList.remove('is-loading');
  const dir = pctChange > 0.01 ? 'up' : pctChange < -0.01 ? 'down' : 'flat';
  animateValue(fEl, forecastPrice, { format: priceFormat });
  fEl.className = 'glance-value' + (dir === 'up' ? ' up' : dir === 'down' ? ' down' : '');

  const pctLabel = `${pctChange >= 0 ? '+' : ''}${(pctChange * 100).toFixed(1)}%`;
  const reason = dir === 'up'
    ? 'soil moisture and rainfall readings are running worse than seasonal average'
    : dir === 'down'
      ? 'soil moisture and rainfall readings are running better than seasonal average'
      : 'soil moisture and rainfall readings are close to seasonal average';
  document.getElementById('glanceForecastSub').textContent =
    `${pctLabel} vs. ${priceIsLive ? 'live' : 'demo'} price — ${reason}`;
}

// ---------------------------------------------------------------
// Per-district forecast + grower advisory (below the price chart).
// Reuses the same "documented heuristic, not a trained model" approach as
// the top-of-page next-season signal, but per-district and adding an
// arrivals-trend term. Works for saffron (groundwater) and apple
// (soil moisture) districts alike via signalMeta().
// ---------------------------------------------------------------
function computeForecast(d) {
  const meta = signalMeta(d);
  const series = d[meta.key];
  const rain = d.rainfall;
  const arrivals = d.arrivals;

  const currentSignal = series[series.length - 1];
  const currentRain = rain[rain.length - 1];
  const signalZ = (currentSignal - mean(series)) / std(series);
  const rainZ = (currentRain - mean(rain)) / std(rain);

  // "Badness" direction differs by signal: deeper water table is worse,
  // but LOWER soil moisture is worse — see signalMeta().
  const badness = meta.key === 'water' ? signalZ : -signalZ;
  const rainBadness = -rainZ;

  // Arrivals trend: recent 3-month average vs. the preceding 6 months.
  // Falling arrivals (tightening supply) nudges the score toward "price up".
  const n = arrivals.length;
  const recent = mean(arrivals.slice(Math.max(0, n - 3)));
  const prior = mean(arrivals.slice(Math.max(0, n - 9), Math.max(0, n - 3)));
  const arrivalsBadness = prior ? (prior - recent) / std(arrivals) : 0;

  const stressScore = 0.5 * badness + 0.3 * rainBadness + 0.2 * arrivalsBadness;
  const pctChange = Math.max(-0.15, Math.min(0.25, stressScore * 0.035));
  return { meta, pctChange };
}

async function getCurrentPrice(d) {
  try {
    if (!livePriceCache[d.crop]) {
      const res = await fetch(`/api/mandi-prices?commodity=${encodeURIComponent(d.crop)}`);
      if (!res.ok) throw new Error(`status ${res.status}`);
      livePriceCache[d.crop] = await res.json();
    }
    const payload = livePriceCache[d.crop];
    const marketKeyword = d.name.split(',')[0].trim().toLowerCase();
    const match = (payload.markets || []).find(m => (m.market || '').toLowerCase().includes(marketKeyword));
    if (match) return { price: Number(match.modal_price), isLive: true, market: match.market };
  } catch (err) { /* fall through to demo */ }
  return { price: d.price[d.price.length - 1], isLive: false };
}

function renderAdvisory(d, dir) {
  const list = document.getElementById('advisoryList');
  const apple = d.crop === 'Apple';
  const bullets = [];

  if (d.status === 'stress' || d.status === 'severe') {
    bullets.push(apple
      ? 'If irrigation is limited, prioritize it during flowering and fruit-set rather than spreading it evenly across the season — that\'s when soil moisture matters most for yield.'
      : 'Don\'t over-correct on watering — Pampore\'s corms are more sensitive to waterlogging than to short dry spells, so add water carefully rather than heavily.');
    bullets.push('Mulching or drip lines, where feasible, cut evaporation loss — the water saved matters most exactly when the signal is running this high.');
  } else if (d.status === 'watch') {
    bullets.push('No urgent irrigation change needed, but keep water use efficient — this district is one dry spell away from moving into stress.');
  } else {
    bullets.push('Readings are in a normal range — a good window for routine irrigation-system upkeep rather than reactive fixes once the season turns.');
  }

  if (dir === 'up') {
    bullets.push(apple
      ? 'Where cold storage is available, holding part of the crop rather than selling the full lot at first arrival can capture more of a price recovery — stagger sales rather than betting everything on one heuristic.'
      : 'A tightening signal like this tends to favor growers who spread sales across a few weeks instead of dumping the full harvest into the first mandi window.');
    bullets.push('Selling collectively through an FPO or growers\' cooperative usually gets a better modal price than many small individual lots, especially when local supply is genuinely tight.');
  } else if (dir === 'down') {
    bullets.push(apple
      ? 'Where storage is accessible, deferring part of the sale can help avoid a soft market — even a few weeks can matter if the softness is supply-driven rather than a real demand drop.'
      : 'A softening signal is a good reason to check forward contracts or MSP-linked procurement options rather than waiting for prices to recover on their own.');
  } else {
    bullets.push('No strong price signal either way right now — normal grading and marketing timing should carry more weight than trying to time this particular reading.');
  }

  bullets.push('Crop insurance (PMFBY) and FPO/APMC registration are worth doing before a stress season, not during one — paperwork lead time is usually the bottleneck.');

  list.innerHTML = bullets.map(b => `<li>${b}</li>`).join('');
  fadeSwap(list);
}

async function renderForecast(d) {
  const { meta, pctChange } = computeForecast(d);
  const { price: currentPrice, isLive, market } = await getCurrentPrice(d);
  const forecastPrice = currentPrice * (1 + pctChange);
  const dir = pctChange > 0.01 ? 'up' : pctChange < -0.01 ? 'down' : 'flat';

  document.getElementById('fcCurrentPrice').classList.remove('is-loading');
  animateValue(document.getElementById('fcCurrentPrice'), currentPrice, { format: v => `₹${Math.round(v).toLocaleString('en-IN')}/qtl` });
  document.getElementById('fcCurrentSub').textContent = isLive ? `● Live — ${market} mandi` : '◦ Demo price data';

  const fEl = document.getElementById('fcForecastPrice');
  fEl.classList.remove('is-loading');
  animateValue(fEl, forecastPrice, { format: v => `₹${Math.round(v).toLocaleString('en-IN')}/qtl` });
  fEl.className = 'forecast-stat-value' + (dir === 'up' ? ' up' : dir === 'down' ? ' down' : '');
  const pctLabel = `${pctChange >= 0 ? '+' : ''}${(pctChange * 100).toFixed(1)}%`;
  document.getElementById('fcPctSub').textContent = `${pctLabel} vs. current`;

  const signalWord = meta.key === 'water' ? 'groundwater depth' : 'soil moisture';
  const shortName = d.name.split(',')[0];
  const basisEl = document.getElementById('fcBasis');
  basisEl.textContent = dir === 'flat'
    ? `${shortName}'s ${signalWord}, rainfall, and arrivals are all close to their seasonal averages — the heuristic sees no strong signal either way.`
    : `Based on ${shortName}'s ${signalWord}, rainfall, and recent arrivals trend against their own seasonal averages. ${dir === 'up' ? 'Tightening supply signals point to upward price pressure' : 'Easing supply signals point to downward price pressure'} — treat this as one input, not a guarantee.`;
  fadeSwap(basisEl);

  renderAdvisory(d, dir);
}

// ---------------------------------------------------------------
// Wire up static controls once, then do the initial render
// ---------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-count-to]').forEach(el => {
    const to = Number(el.dataset.countTo);
    const suffix = el.dataset.suffix || '';
    animateValue(el, to, { duration: 900, format: v => Math.round(v).toLocaleString('en-IN') + suffix });
  });

  document.getElementById('districtSearch').addEventListener('input', applySearchFilter);

  const compareToggle = document.getElementById('compareToggle');
  const compareSelect = document.getElementById('compareSelect');
  compareToggle.addEventListener('change', () => {
    compareSelect.disabled = !compareToggle.checked;
    if (compareToggle.checked) {
      renderCompareSelect();
    } else {
      compareId = null;
    }
    renderCharts();
  });
  compareSelect.addEventListener('change', () => {
    compareId = compareSelect.value || null;
    renderCharts();
  });

  document.getElementById('exportCsvBtn').addEventListener('click', exportCsv);

  initSlider();
  initMap();
  initFloodWidget();
  renderDistrictDropdown();
  selectDistrict(currentId);
  renderGlance();
});
